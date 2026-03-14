import type { RecommendationCandidate } from "./rules-engine.js";
import type { ProjectAnalysis } from "../project-analyzer/analyze-project.js";

/**
 * Configuration for the OpenRouter reranker.
 */
export interface OpenRouterRerankerConfig {
  /** OpenRouter API key. Falls back to OPENROUTER_API_KEY env var. */
  apiKey?: string;
  /** Model to use for reranking. Default: "openrouter/hunter-alpha" */
  model?: string;
  /** API base URL. Default: "https://openrouter.ai/api/v1" */
  baseUrl?: string;
  /** Request timeout in ms. Default: 15000 */
  timeoutMs?: number;
}

/**
 * Result from the reranker. Contains reranked candidates with adjusted scores.
 */
export interface RerankResult {
  candidates: RecommendationCandidate[];
  /** Whether the reranker was actually used (false if skipped/failed) */
  reranked: boolean;
  /** If reranking failed, the reason */
  fallbackReason?: string;
}

const DEFAULT_MODEL = "openrouter/hunter-alpha";
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Build the system prompt for reranking.
 */
function buildSystemPrompt(): string {
  return `You are a skill recommendation reranker for coding agents. 
You will receive a list of candidate skills, the user's goal, and optionally project context.
Your job is to rerank them by relevance. Return ONLY a valid JSON array of skill IDs in order from most to least relevant.
Example: ["skill-a", "skill-b", "skill-c"]
Do not include explanations, only the JSON array.`;
}

/**
 * Build the user prompt with candidates, goal, and context.
 */
function buildUserPrompt(
  candidates: RecommendationCandidate[],
  goal: string,
  analysis: ProjectAnalysis | null,
): string {
  const candidateList = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    reasons: c.reasons,
    rulesScore: c.rawScore,
  }));

  let prompt = `Goal: "${goal}"\n\nCandidates:\n${JSON.stringify(candidateList, null, 2)}`;

  if (analysis) {
    prompt += `\n\nProject context:\n- Languages: ${analysis.languages.join(", ")}`;
    prompt += `\n- Frameworks: ${analysis.frameworks.join(", ")}`;
    prompt += `\n- Signals: ${analysis.signals.join(", ")}`;
    prompt += `\n- Project kinds: ${analysis.projectKinds.join(", ")}`;
  }

  prompt += "\n\nRerank the candidates. Return only the JSON array of IDs, most relevant first.";

  return prompt;
}

/**
 * Parse the LLM response to extract an ordered list of skill IDs.
 */
function parseRerankResponse(responseText: string): string[] | null {
  // Try to extract JSON array from the response
  const trimmed = responseText.trim();

  // Direct JSON array
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {
    // Not direct JSON
  }

  // Try to find JSON array in markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return parsed;
      }
    } catch {
      // Invalid JSON in code block
    }
  }

  // Try to find any JSON array in the text
  const arrayMatch = trimmed.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return parsed;
      }
    } catch {
      // Failed to parse
    }
  }

  return null;
}

/**
 * Call OpenRouter chat completion API.
 */
async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  config: Required<Pick<OpenRouterRerankerConfig, "apiKey" | "model" | "baseUrl" | "timeoutMs">>,
): Promise<string> {
  const url = `${config.baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "HTTP-Referer": "https://github.com/skill-installer-mcp",
        "X-Title": "skill-installer-mcp",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenRouter API");
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Rerank recommendation candidates using OpenRouter LLM API.
 *
 * This is a best-effort enhancement:
 * - If no API key is available, returns candidates unchanged
 * - If the API call fails, falls back to original order
 * - If the response can't be parsed, falls back to original order
 *
 * The reranker adjusts rawScore values based on LLM-assigned ordering
 * while preserving the original rules-based scores as a tiebreaker.
 */
export async function rerankWithOpenRouter(
  candidates: RecommendationCandidate[],
  goal: string,
  analysis: ProjectAnalysis | null,
  config?: OpenRouterRerankerConfig,
): Promise<RerankResult> {
  // Guard: no candidates to rerank
  if (candidates.length <= 1) {
    return { candidates, reranked: false, fallbackReason: "too_few_candidates" };
  }

  // Resolve config
  const apiKey = config?.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    return { candidates, reranked: false, fallbackReason: "no_api_key" };
  }

  const model = config?.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(candidates, goal, analysis);

    const responseText = await callOpenRouter(systemPrompt, userPrompt, {
      apiKey,
      model,
      baseUrl,
      timeoutMs,
    });

    const rankedIds = parseRerankResponse(responseText);
    if (!rankedIds || rankedIds.length === 0) {
      return { candidates, reranked: false, fallbackReason: "unparseable_response" };
    }

    // Build reranked list: LLM-ordered candidates first, then any missing ones
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const reranked: RecommendationCandidate[] = [];
    const seen = new Set<string>();

    // Assign descending scores based on LLM rank position
    const maxBoost = candidates.length;

    for (let i = 0; i < rankedIds.length; i++) {
      const id = rankedIds[i];
      const candidate = candidateMap.get(id);
      if (candidate && !seen.has(id)) {
        seen.add(id);
        reranked.push({
          ...candidate,
          rawScore: maxBoost - i + candidate.rawScore * 0.01, // LLM rank dominant, rules as tiebreaker
        });
      }
    }

    // Append any candidates the LLM didn't mention (preserve original order)
    for (const candidate of candidates) {
      if (!seen.has(candidate.id)) {
        seen.add(candidate.id);
        reranked.push({
          ...candidate,
          rawScore: candidate.rawScore * 0.01, // Demote unmapped candidates
        });
      }
    }

    // Sort by adjusted score descending
    reranked.sort((a, b) => b.rawScore - a.rawScore);

    return { candidates: reranked, reranked: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { candidates, reranked: false, fallbackReason: `api_error: ${message}` };
  }
}

// Exported for testing
export { parseRerankResponse as _parseRerankResponse };

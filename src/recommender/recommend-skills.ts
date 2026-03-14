import type { AgentId, ExecutionContext, SkillSelector, SkillSourceRef, WarningItem } from "../domain/types.js";
import { analyzeProject, type ProjectAnalysis } from "../project-analyzer/analyze-project.js";
import { evaluateRules, type RecommendationCandidate } from "./rules-engine.js";
import { rerankWithOpenRouter } from "./openrouter-reranker.js";

/**
 * A single recommendation item in the output.
 */
export interface RecommendationItem {
  rank: number;
  score: number;
  confidence: number;
  id: string;
  name: string;
  source: SkillSourceRef;
  reasons: string[];
  supportedAgents: AgentId[];
  warnings: WarningItem[];
  installRef: SkillSelector;
}

/**
 * Full recommendation result.
 */
export interface RecommendationResult {
  goal: string;
  analyzedContext?: {
    projectKinds: string[];
    frameworks: string[];
    signals: string[];
  };
  recommendations: RecommendationItem[];
}

export interface RecommendSkillsOptions {
  goal: string;
  workspacePath?: string;
  agents?: AgentId[];
  topK?: number;
  includeInstalled?: boolean;
  sources?: Array<"skills.sh" | "git" | "local">;
  useRerank?: boolean;
}

/**
 * Recommend skills based on goal and optionally project analysis.
 *
 * Flow:
 * 1. If workspacePath provided, analyze the project
 * 2. Run rules engine against the context
 * 3. Normalize scores to 0-1 range
 * 4. Return top-K results
 */
export async function recommendSkills(
  options: RecommendSkillsOptions,
  ctx: ExecutionContext,
): Promise<RecommendationResult> {
  const {
    goal,
    workspacePath,
    agents,
    topK = 5,
  } = options;

  // Step 1: Optionally analyze project
  let analysis: ProjectAnalysis | null = null;
  if (workspacePath) {
    try {
      analysis = await analyzeProject(
        {
          workspacePath,
          includeAgents: false,
        },
        ctx,
      );
    } catch {
      // If analysis fails, proceed without it — goal-based matching still works
    }
  }

  // Step 2: Run rules engine
  let candidates = evaluateRules(analysis, goal, agents);

  // Step 2.5: Optionally rerank with OpenRouter LLM
  if (options.useRerank && candidates.length > 1) {
    const rerankResult = await rerankWithOpenRouter(candidates, goal, analysis);
    if (rerankResult.reranked) {
      candidates = rerankResult.candidates;
    }
  }

  // Step 3: Normalize scores and build result
  const maxScore = candidates.length > 0 ? candidates[0].rawScore : 1;

  const recommendations: RecommendationItem[] = candidates
    .slice(0, topK)
    .map((candidate, index) => ({
      rank: index + 1,
      score: maxScore > 0 ? candidate.rawScore / maxScore : 0,
      confidence: computeConfidence(candidate, analysis),
      id: candidate.id,
      name: candidate.name,
      source: candidate.source,
      reasons: candidate.reasons,
      supportedAgents: candidate.supportedAgents,
      warnings: candidate.warnings,
      installRef: candidate.installRef,
    }));

  const result: RecommendationResult = {
    goal,
    recommendations,
  };

  if (analysis) {
    result.analyzedContext = {
      projectKinds: analysis.projectKinds,
      frameworks: analysis.frameworks,
      signals: analysis.signals,
    };
  }

  return result;
}

/**
 * Compute confidence for a recommendation.
 *
 * Higher confidence when:
 * - Multiple reasons matched
 * - Project analysis was available and matched
 * - Score is significantly higher than threshold
 */
function computeConfidence(
  candidate: RecommendationCandidate,
  analysis: ProjectAnalysis | null,
): number {
  let confidence = 0.3; // base confidence for any match

  // More reasons = more confidence
  if (candidate.reasons.length >= 3) confidence += 0.3;
  else if (candidate.reasons.length >= 2) confidence += 0.2;
  else if (candidate.reasons.length >= 1) confidence += 0.1;

  // Higher raw score = more confidence
  if (candidate.rawScore >= 6) confidence += 0.2;
  else if (candidate.rawScore >= 4) confidence += 0.1;

  // Project analysis available adds confidence
  if (analysis && analysis.confidence > 0.5) confidence += 0.1;

  return Math.min(confidence, 1);
}

import type { AgentId, SkillSelector, SkillSourceRef, WarningItem } from "../domain/types.js";
import type { ProjectAnalysis } from "../project-analyzer/analyze-project.js";

/**
 * A recommendation candidate produced by the rules engine.
 */
export interface RecommendationCandidate {
  id: string;
  name: string;
  source: SkillSourceRef;
  reasons: string[];
  supportedAgents: AgentId[];
  warnings: WarningItem[];
  installRef: SkillSelector;
  /** Raw score from rules matching (not normalized yet) */
  rawScore: number;
}

/**
 * A skill rule in the rules engine.
 * Describes when a particular skill should be recommended.
 */
export interface SkillRule {
  /** Unique identifier for the rule */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Source reference for installation */
  source: SkillSourceRef;
  /** Which agents this skill supports */
  supportedAgents: AgentId[];
  /** Conditions: each matched condition adds to the score */
  conditions: RuleCondition[];
  /** Base score weight (higher = more important match) */
  weight: number;
}

export interface RuleCondition {
  /** What to match */
  type: "framework" | "language" | "signal" | "project-kind" | "package-manager" | "goal-keyword";
  /** Values to match against */
  values: string[];
  /** Score added when this condition matches */
  score: number;
}

/**
 * The built-in rules database for MVP.
 * In future, this could be loaded from a registry or remote config.
 */
const BUILTIN_RULES: SkillRule[] = [
  // TypeScript / Node.js skills
  {
    id: "typescript-best-practices",
    name: "TypeScript Best Practices",
    source: { type: "local", locator: "typescript-best-practices" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 1.0,
    conditions: [
      { type: "language", values: ["typescript"], score: 3 },
      { type: "framework", values: ["nextjs", "nestjs", "vite"], score: 1 },
      { type: "goal-keyword", values: ["typescript", "type", "typing", "ts"], score: 2 },
    ],
  },
  {
    id: "react-patterns",
    name: "React Patterns",
    source: { type: "local", locator: "react-patterns" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["react", "nextjs", "remix"], score: 3 },
      { type: "goal-keyword", values: ["react", "component", "hooks", "jsx", "tsx"], score: 2 },
    ],
  },
  {
    id: "nextjs-fullstack",
    name: "Next.js Fullstack",
    source: { type: "local", locator: "nextjs-fullstack" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["nextjs"], score: 4 },
      { type: "goal-keyword", values: ["nextjs", "next", "ssr", "server-component", "app-router"], score: 2 },
    ],
  },
  {
    id: "testing-skill",
    name: "Testing Best Practices",
    source: { type: "local", locator: "testing-best-practices" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 0.8,
    conditions: [
      { type: "signal", values: ["has-tests", "has-e2e-tests"], score: 2 },
      { type: "goal-keyword", values: ["test", "testing", "jest", "vitest", "cypress", "playwright"], score: 3 },
    ],
  },
  {
    id: "api-development",
    name: "API Development",
    source: { type: "local", locator: "api-development" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 0.9,
    conditions: [
      { type: "project-kind", values: ["api"], score: 3 },
      { type: "signal", values: ["has-api-spec"], score: 2 },
      { type: "framework", values: ["nestjs", "fastify", "fastapi", "flask"], score: 2 },
      { type: "goal-keyword", values: ["api", "rest", "graphql", "endpoint"], score: 2 },
    ],
  },
  {
    id: "python-development",
    name: "Python Development",
    source: { type: "local", locator: "python-development" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 1.0,
    conditions: [
      { type: "language", values: ["python"], score: 3 },
      { type: "framework", values: ["django", "fastapi", "flask"], score: 2 },
      { type: "goal-keyword", values: ["python", "py", "django", "fastapi"], score: 2 },
    ],
  },
  {
    id: "database-skill",
    name: "Database & ORM",
    source: { type: "local", locator: "database-orm" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 0.8,
    conditions: [
      { type: "signal", values: ["has-database"], score: 3 },
      { type: "goal-keyword", values: ["database", "db", "prisma", "drizzle", "sql", "orm", "migration"], score: 2 },
    ],
  },
  {
    id: "devops-deployment",
    name: "DevOps & Deployment",
    source: { type: "local", locator: "devops-deployment" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 0.7,
    conditions: [
      { type: "project-kind", values: ["containerized", "infrastructure"], score: 3 },
      { type: "signal", values: ["deploys-vercel", "deploys-netlify", "deploys-fly", "deploys-render", "deploys-railway", "deploys-heroku", "has-ci"], score: 2 },
      { type: "goal-keyword", values: ["deploy", "devops", "docker", "ci", "cd", "pipeline"], score: 2 },
    ],
  },
  {
    id: "code-quality",
    name: "Code Quality & Linting",
    source: { type: "local", locator: "code-quality" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 0.6,
    conditions: [
      { type: "signal", values: ["has-linting", "has-formatter"], score: 2 },
      { type: "goal-keyword", values: ["lint", "format", "quality", "clean", "refactor", "eslint", "prettier", "biome"], score: 2 },
    ],
  },
  {
    id: "monorepo-management",
    name: "Monorepo Management",
    source: { type: "local", locator: "monorepo-management" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 0.8,
    conditions: [
      { type: "project-kind", values: ["monorepo"], score: 4 },
      { type: "framework", values: ["nx", "turborepo"], score: 2 },
      { type: "signal", values: ["has-packages-dir", "has-apps-dir"], score: 1 },
      { type: "goal-keyword", values: ["monorepo", "workspace", "packages", "nx", "turbo"], score: 2 },
    ],
  },
  {
    id: "vue-development",
    name: "Vue.js Development",
    source: { type: "local", locator: "vue-development" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["vue", "nuxt"], score: 4 },
      { type: "goal-keyword", values: ["vue", "nuxt", "composition-api"], score: 2 },
    ],
  },
  {
    id: "go-development",
    name: "Go Development",
    source: { type: "local", locator: "go-development" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 1.0,
    conditions: [
      { type: "language", values: ["go"], score: 3 },
      { type: "goal-keyword", values: ["go", "golang", "goroutine"], score: 2 },
    ],
  },
  {
    id: "rust-development",
    name: "Rust Development",
    source: { type: "local", locator: "rust-development" },
    supportedAgents: ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"],
    weight: 1.0,
    conditions: [
      { type: "language", values: ["rust"], score: 3 },
      { type: "goal-keyword", values: ["rust", "cargo", "crate"], score: 2 },
    ],
  },
];

/**
 * Evaluate all rules against the given context and return scored candidates.
 */
export function evaluateRules(
  projectAnalysis: ProjectAnalysis | null,
  goal: string,
  filterAgents?: AgentId[],
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];
  const goalTokens = tokenizeGoal(goal);

  for (const rule of BUILTIN_RULES) {
    // Filter by agent if specified
    if (filterAgents && filterAgents.length > 0) {
      const hasMatch = rule.supportedAgents.some((a) => filterAgents.includes(a));
      if (!hasMatch) continue;
    }

    let totalScore = 0;
    const matchedReasons: string[] = [];

    for (const condition of rule.conditions) {
      const matched = matchCondition(condition, projectAnalysis, goalTokens);
      if (matched) {
        totalScore += condition.score;
        matchedReasons.push(describeConditionMatch(condition));
      }
    }

    if (totalScore <= 0) continue;

    const finalScore = totalScore * rule.weight;

    candidates.push({
      id: rule.id,
      name: rule.name,
      source: rule.source,
      reasons: matchedReasons,
      supportedAgents: filterAgents
        ? rule.supportedAgents.filter((a) => filterAgents.includes(a))
        : rule.supportedAgents,
      warnings: [],
      installRef: { name: rule.id, source: rule.source },
      rawScore: finalScore,
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.rawScore - a.rawScore);

  return candidates;
}

/**
 * Get all available built-in rules. Useful for testing and debugging.
 */
export function getBuiltinRules(): readonly SkillRule[] {
  return BUILTIN_RULES;
}

function matchCondition(
  condition: RuleCondition,
  analysis: ProjectAnalysis | null,
  goalTokens: string[],
): boolean {
  if (condition.type === "goal-keyword") {
    return condition.values.some((v) => goalTokens.includes(v.toLowerCase()));
  }

  if (!analysis) return false;

  switch (condition.type) {
    case "framework":
      return condition.values.some((v) => analysis.frameworks.includes(v));
    case "language":
      return condition.values.some((v) => analysis.languages.includes(v));
    case "signal":
      return condition.values.some((v) => analysis.signals.includes(v));
    case "project-kind":
      return condition.values.some((v) => analysis.projectKinds.includes(v));
    case "package-manager":
      return condition.values.some((v) => analysis.packageManagers.includes(v));
    default:
      return false;
  }
}

function describeConditionMatch(condition: RuleCondition): string {
  switch (condition.type) {
    case "framework":
      return `Matches detected framework: ${condition.values.join(", ")}`;
    case "language":
      return `Matches detected language: ${condition.values.join(", ")}`;
    case "signal":
      return `Matches project signal: ${condition.values.join(", ")}`;
    case "project-kind":
      return `Matches project kind: ${condition.values.join(", ")}`;
    case "package-manager":
      return `Matches package manager: ${condition.values.join(", ")}`;
    case "goal-keyword":
      return `Matches goal keyword: ${condition.values.join(", ")}`;
    default:
      return `Matches condition`;
  }
}

function tokenizeGoal(goal: string): string[] {
  return goal
    .toLowerCase()
    .replace(/[^a-z0-9\-_/. ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

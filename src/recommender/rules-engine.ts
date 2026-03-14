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
/** All 6 supported agents shorthand */
const ALL_AGENTS: AgentId[] = ["cursor", "opencode", "codex", "claude-code", "windsurf", "amp"];

const BUILTIN_RULES: SkillRule[] = [
  // ─── Language / Runtime Skills ────────────────────────────────

  {
    id: "typescript-best-practices",
    name: "TypeScript Best Practices",
    source: { type: "local", locator: "typescript-best-practices" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["typescript"], score: 3 },
      { type: "framework", values: ["nextjs", "nestjs", "vite"], score: 1 },
      { type: "goal-keyword", values: ["typescript", "type", "typing", "ts"], score: 2 },
    ],
  },
  {
    id: "python-development",
    name: "Python Development",
    source: { type: "local", locator: "python-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["python"], score: 3 },
      { type: "framework", values: ["django", "fastapi", "flask"], score: 2 },
      { type: "goal-keyword", values: ["python", "py", "django", "fastapi", "flask"], score: 2 },
    ],
  },
  {
    id: "go-development",
    name: "Go Development",
    source: { type: "local", locator: "go-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["go"], score: 3 },
      { type: "goal-keyword", values: ["go", "golang", "goroutine", "gin", "echo"], score: 2 },
    ],
  },
  {
    id: "rust-development",
    name: "Rust Development",
    source: { type: "local", locator: "rust-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["rust"], score: 3 },
      { type: "goal-keyword", values: ["rust", "cargo", "crate", "tokio", "async-rust"], score: 2 },
    ],
  },
  {
    id: "java-development",
    name: "Java / Kotlin Development",
    source: { type: "local", locator: "java-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["java", "kotlin"], score: 3 },
      { type: "project-kind", values: ["jvm"], score: 2 },
      { type: "framework", values: ["spring-boot"], score: 2 },
      { type: "goal-keyword", values: ["java", "kotlin", "spring", "jvm", "gradle", "maven"], score: 2 },
    ],
  },
  {
    id: "ruby-development",
    name: "Ruby / Rails Development",
    source: { type: "local", locator: "ruby-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["ruby"], score: 3 },
      { type: "framework", values: ["rails"], score: 3 },
      { type: "goal-keyword", values: ["ruby", "rails", "gem", "bundler", "rspec"], score: 2 },
    ],
  },
  {
    id: "php-laravel",
    name: "PHP / Laravel Development",
    source: { type: "local", locator: "php-laravel" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["php"], score: 3 },
      { type: "framework", values: ["laravel"], score: 3 },
      { type: "goal-keyword", values: ["php", "laravel", "composer", "blade", "eloquent"], score: 2 },
    ],
  },
  {
    id: "csharp-dotnet",
    name: "C# / .NET Development",
    source: { type: "local", locator: "csharp-dotnet" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["csharp", "fsharp"], score: 3 },
      { type: "project-kind", values: ["dotnet"], score: 2 },
      { type: "goal-keyword", values: ["csharp", "dotnet", ".net", "aspnet", "blazor", "nuget"], score: 2 },
    ],
  },
  {
    id: "elixir-development",
    name: "Elixir / Phoenix Development",
    source: { type: "local", locator: "elixir-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "language", values: ["elixir"], score: 3 },
      { type: "goal-keyword", values: ["elixir", "phoenix", "otp", "ecto", "liveview"], score: 2 },
    ],
  },

  // ─── Frontend Framework Skills ────────────────────────────────

  {
    id: "react-patterns",
    name: "React Patterns",
    source: { type: "local", locator: "react-patterns" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["react", "nextjs", "remix"], score: 3 },
      { type: "goal-keyword", values: ["react", "component", "hooks", "jsx", "tsx", "state-management"], score: 2 },
    ],
  },
  {
    id: "nextjs-fullstack",
    name: "Next.js Fullstack",
    source: { type: "local", locator: "nextjs-fullstack" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["nextjs"], score: 4 },
      { type: "goal-keyword", values: ["nextjs", "next", "ssr", "server-component", "app-router", "rsc"], score: 2 },
    ],
  },
  {
    id: "vue-development",
    name: "Vue.js Development",
    source: { type: "local", locator: "vue-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["vue", "nuxt"], score: 4 },
      { type: "goal-keyword", values: ["vue", "nuxt", "composition-api", "pinia", "vuex"], score: 2 },
    ],
  },
  {
    id: "svelte-development",
    name: "Svelte / SvelteKit Development",
    source: { type: "local", locator: "svelte-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["svelte"], score: 4 },
      { type: "goal-keyword", values: ["svelte", "sveltekit", "svelte-kit"], score: 2 },
    ],
  },
  {
    id: "angular-development",
    name: "Angular Development",
    source: { type: "local", locator: "angular-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["angular"], score: 4 },
      { type: "goal-keyword", values: ["angular", "ng", "rxjs", "ngrx"], score: 2 },
    ],
  },
  {
    id: "astro-development",
    name: "Astro Development",
    source: { type: "local", locator: "astro-development" },
    supportedAgents: ALL_AGENTS,
    weight: 1.0,
    conditions: [
      { type: "framework", values: ["astro"], score: 4 },
      { type: "goal-keyword", values: ["astro", "static-site", "content-site", "islands"], score: 2 },
    ],
  },

  // ─── Backend / API Skills ─────────────────────────────────────

  {
    id: "api-development",
    name: "API Development",
    source: { type: "local", locator: "api-development" },
    supportedAgents: ALL_AGENTS,
    weight: 0.9,
    conditions: [
      { type: "project-kind", values: ["api"], score: 3 },
      { type: "signal", values: ["has-api-spec"], score: 2 },
      { type: "framework", values: ["nestjs", "fastify", "fastapi", "flask", "express", "hono"], score: 2 },
      { type: "goal-keyword", values: ["api", "rest", "graphql", "endpoint", "openapi", "swagger"], score: 2 },
    ],
  },
  {
    id: "graphql-development",
    name: "GraphQL Development",
    source: { type: "local", locator: "graphql-development" },
    supportedAgents: ALL_AGENTS,
    weight: 0.9,
    conditions: [
      { type: "signal", values: ["has-graphql"], score: 3 },
      { type: "goal-keyword", values: ["graphql", "gql", "apollo", "relay", "schema-first", "code-first"], score: 3 },
    ],
  },

  // ─── Database / ORM Skills ────────────────────────────────────

  {
    id: "database-skill",
    name: "Database & ORM",
    source: { type: "local", locator: "database-orm" },
    supportedAgents: ALL_AGENTS,
    weight: 0.8,
    conditions: [
      { type: "signal", values: ["has-database"], score: 3 },
      { type: "goal-keyword", values: ["database", "db", "prisma", "drizzle", "sql", "orm", "migration", "postgres", "mysql", "sqlite", "mongodb"], score: 2 },
    ],
  },

  // ─── Testing Skills ───────────────────────────────────────────

  {
    id: "testing-skill",
    name: "Testing Best Practices",
    source: { type: "local", locator: "testing-best-practices" },
    supportedAgents: ALL_AGENTS,
    weight: 0.8,
    conditions: [
      { type: "signal", values: ["has-tests", "has-e2e-tests"], score: 2 },
      { type: "goal-keyword", values: ["test", "testing", "jest", "vitest", "cypress", "playwright", "tdd", "bdd"], score: 3 },
    ],
  },
  {
    id: "e2e-testing",
    name: "End-to-End Testing",
    source: { type: "local", locator: "e2e-testing" },
    supportedAgents: ALL_AGENTS,
    weight: 0.8,
    conditions: [
      { type: "signal", values: ["has-e2e-tests"], score: 3 },
      { type: "framework", values: ["react", "nextjs", "vue", "nuxt", "svelte", "angular"], score: 1 },
      { type: "goal-keyword", values: ["e2e", "end-to-end", "cypress", "playwright", "selenium", "integration-test"], score: 3 },
    ],
  },

  // ─── DevOps / Infrastructure Skills ───────────────────────────

  {
    id: "devops-deployment",
    name: "DevOps & Deployment",
    source: { type: "local", locator: "devops-deployment" },
    supportedAgents: ALL_AGENTS,
    weight: 0.7,
    conditions: [
      { type: "project-kind", values: ["containerized", "infrastructure"], score: 3 },
      { type: "signal", values: ["deploys-vercel", "deploys-netlify", "deploys-fly", "deploys-render", "deploys-railway", "deploys-heroku", "has-ci"], score: 2 },
      { type: "goal-keyword", values: ["deploy", "devops", "docker", "ci", "cd", "pipeline", "kubernetes", "k8s"], score: 2 },
    ],
  },
  {
    id: "docker-containerization",
    name: "Docker & Containerization",
    source: { type: "local", locator: "docker-containerization" },
    supportedAgents: ALL_AGENTS,
    weight: 0.7,
    conditions: [
      { type: "project-kind", values: ["containerized"], score: 4 },
      { type: "goal-keyword", values: ["docker", "container", "dockerfile", "compose", "kubernetes", "k8s", "helm"], score: 3 },
    ],
  },
  {
    id: "ci-cd-pipelines",
    name: "CI/CD Pipelines",
    source: { type: "local", locator: "ci-cd-pipelines" },
    supportedAgents: ALL_AGENTS,
    weight: 0.7,
    conditions: [
      { type: "signal", values: ["has-ci"], score: 3 },
      { type: "goal-keyword", values: ["ci", "cd", "github-actions", "pipeline", "workflow", "continuous-integration", "continuous-deployment"], score: 3 },
    ],
  },

  // ─── Code Quality / DX Skills ─────────────────────────────────

  {
    id: "code-quality",
    name: "Code Quality & Linting",
    source: { type: "local", locator: "code-quality" },
    supportedAgents: ALL_AGENTS,
    weight: 0.6,
    conditions: [
      { type: "signal", values: ["has-linting", "has-formatter"], score: 2 },
      { type: "goal-keyword", values: ["lint", "format", "quality", "clean", "refactor", "eslint", "prettier", "biome"], score: 2 },
    ],
  },
  {
    id: "performance-optimization",
    name: "Performance Optimization",
    source: { type: "local", locator: "performance-optimization" },
    supportedAgents: ALL_AGENTS,
    weight: 0.7,
    conditions: [
      { type: "goal-keyword", values: ["performance", "optimize", "speed", "bundle-size", "lazy-loading", "caching", "profiling"], score: 3 },
      { type: "framework", values: ["react", "nextjs", "vue", "nuxt"], score: 1 },
    ],
  },
  {
    id: "accessibility",
    name: "Accessibility (a11y)",
    source: { type: "local", locator: "accessibility" },
    supportedAgents: ALL_AGENTS,
    weight: 0.6,
    conditions: [
      { type: "project-kind", values: ["web"], score: 2 },
      { type: "goal-keyword", values: ["accessibility", "a11y", "aria", "screen-reader", "wcag"], score: 3 },
    ],
  },

  // ─── Architecture / Pattern Skills ────────────────────────────

  {
    id: "monorepo-management",
    name: "Monorepo Management",
    source: { type: "local", locator: "monorepo-management" },
    supportedAgents: ALL_AGENTS,
    weight: 0.8,
    conditions: [
      { type: "project-kind", values: ["monorepo"], score: 4 },
      { type: "framework", values: ["nx", "turborepo"], score: 2 },
      { type: "signal", values: ["has-packages-dir", "has-apps-dir"], score: 1 },
      { type: "goal-keyword", values: ["monorepo", "workspace", "packages", "nx", "turbo", "lerna"], score: 2 },
    ],
  },
  {
    id: "security-best-practices",
    name: "Security Best Practices",
    source: { type: "local", locator: "security-best-practices" },
    supportedAgents: ALL_AGENTS,
    weight: 0.7,
    conditions: [
      { type: "signal", values: ["has-env-config"], score: 1 },
      { type: "goal-keyword", values: ["security", "auth", "authentication", "authorization", "oauth", "jwt", "csrf", "xss", "injection"], score: 3 },
    ],
  },
  {
    id: "ai-ml-development",
    name: "AI / ML Development",
    source: { type: "local", locator: "ai-ml-development" },
    supportedAgents: ALL_AGENTS,
    weight: 0.9,
    conditions: [
      { type: "language", values: ["python"], score: 1 },
      { type: "signal", values: ["has-ai-ml"], score: 3 },
      { type: "goal-keyword", values: ["ai", "ml", "machine-learning", "llm", "langchain", "openai", "embedding", "rag", "fine-tuning", "model"], score: 3 },
    ],
  },
  {
    id: "mcp-development",
    name: "MCP Server Development",
    source: { type: "local", locator: "mcp-development" },
    supportedAgents: ALL_AGENTS,
    weight: 0.9,
    conditions: [
      { type: "project-kind", values: ["mcp"], score: 4 },
      { type: "signal", values: ["uses-mcp"], score: 2 },
      { type: "goal-keyword", values: ["mcp", "model-context-protocol", "tool-server"], score: 3 },
    ],
  },
  {
    id: "tailwind-styling",
    name: "Tailwind CSS & Styling",
    source: { type: "local", locator: "tailwind-styling" },
    supportedAgents: ALL_AGENTS,
    weight: 0.7,
    conditions: [
      { type: "signal", values: ["has-tailwind"], score: 3 },
      { type: "project-kind", values: ["web"], score: 1 },
      { type: "goal-keyword", values: ["tailwind", "css", "styling", "design-system", "ui", "shadcn"], score: 2 },
    ],
  },
  {
    id: "documentation-writing",
    name: "Documentation Writing",
    source: { type: "local", locator: "documentation-writing" },
    supportedAgents: ALL_AGENTS,
    weight: 0.5,
    conditions: [
      { type: "signal", values: ["has-docs", "has-readme", "has-changelog"], score: 2 },
      { type: "goal-keyword", values: ["docs", "documentation", "readme", "changelog", "jsdoc", "typedoc"], score: 3 },
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

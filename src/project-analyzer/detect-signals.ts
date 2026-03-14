import path from "node:path";
import { pathExists, readText } from "../utils/fs.js";

/**
 * Signal detection result.
 * Signals represent meaningful project characteristics beyond framework/language.
 */
export interface SignalDetection {
  signals: string[];
  manifestFiles: string[];
}

interface SignalRule {
  file: string;
  signal: string;
  /** If true, also add to manifestFiles */
  isManifest?: boolean;
  contentPattern?: RegExp;
}

const SIGNAL_RULES: SignalRule[] = [
  // ─── Testing ──────────────────────────────────────────────────
  { file: "jest.config.js", signal: "has-tests" },
  { file: "jest.config.ts", signal: "has-tests" },
  { file: "vitest.config.ts", signal: "has-tests" },
  { file: "vitest.config.js", signal: "has-tests" },
  { file: "cypress.config.ts", signal: "has-e2e-tests" },
  { file: "cypress.config.js", signal: "has-e2e-tests" },
  { file: "playwright.config.ts", signal: "has-e2e-tests" },
  { file: "playwright.config.js", signal: "has-e2e-tests" },
  { file: ".mocharc.yml", signal: "has-tests" },
  { file: ".mocharc.json", signal: "has-tests" },
  { file: "pytest.ini", signal: "has-tests" },
  { file: "pyproject.toml", signal: "has-tests", contentPattern: /\[tool\.pytest/ },
  { file: "karma.conf.js", signal: "has-tests" },
  { file: ".nycrc", signal: "has-tests" },
  { file: "codecov.yml", signal: "has-tests" },
  { file: ".coveragerc", signal: "has-tests" },

  // ─── CI/CD ────────────────────────────────────────────────────
  { file: ".github/workflows", signal: "has-ci" },
  { file: ".gitlab-ci.yml", signal: "has-ci" },
  { file: ".circleci/config.yml", signal: "has-ci" },
  { file: "Jenkinsfile", signal: "has-ci" },
  { file: "bitbucket-pipelines.yml", signal: "has-ci" },
  { file: ".travis.yml", signal: "has-ci" },
  { file: "azure-pipelines.yml", signal: "has-ci" },

  // ─── Code quality ─────────────────────────────────────────────
  { file: ".eslintrc.json", signal: "has-linting" },
  { file: ".eslintrc.js", signal: "has-linting" },
  { file: "eslint.config.js", signal: "has-linting" },
  { file: "eslint.config.mjs", signal: "has-linting" },
  { file: "eslint.config.ts", signal: "has-linting" },
  { file: ".prettierrc", signal: "has-formatter" },
  { file: ".prettierrc.json", signal: "has-formatter" },
  { file: "prettier.config.js", signal: "has-formatter" },
  { file: "biome.json", signal: "has-linting" },
  { file: "biome.jsonc", signal: "has-linting" },
  { file: "ruff.toml", signal: "has-linting" },
  { file: ".ruff.toml", signal: "has-linting" },
  { file: ".editorconfig", signal: "has-formatter" },
  { file: ".stylelintrc.json", signal: "has-linting" },
  { file: "commitlint.config.js", signal: "has-linting" },
  { file: ".commitlintrc.json", signal: "has-linting" },
  { file: ".husky/", signal: "has-git-hooks" },
  { file: ".lintstagedrc", signal: "has-git-hooks" },
  { file: ".lintstagedrc.json", signal: "has-git-hooks" },
  { file: "lint-staged.config.js", signal: "has-git-hooks" },

  // ─── Documentation ────────────────────────────────────────────
  { file: "README.md", signal: "has-readme", isManifest: true },
  { file: "docs/", signal: "has-docs" },
  { file: "CONTRIBUTING.md", signal: "has-contributing" },
  { file: "CHANGELOG.md", signal: "has-changelog" },
  { file: "LICENSE", signal: "has-license" },
  { file: "LICENSE.md", signal: "has-license" },
  { file: "typedoc.json", signal: "has-docs" },
  { file: "storybook/", signal: "has-storybook" },
  { file: ".storybook/", signal: "has-storybook" },

  // ─── Config / environment ─────────────────────────────────────
  { file: ".env", signal: "has-env-config" },
  { file: ".env.example", signal: "has-env-config" },
  { file: ".env.local", signal: "has-env-config" },

  // ─── Database ─────────────────────────────────────────────────
  { file: "prisma/schema.prisma", signal: "has-database" },
  { file: "drizzle.config.ts", signal: "has-database" },
  { file: "drizzle.config.js", signal: "has-database" },
  { file: "migrations/", signal: "has-database" },
  { file: "alembic.ini", signal: "has-database" },
  { file: "knexfile.js", signal: "has-database" },
  { file: "knexfile.ts", signal: "has-database" },
  { file: "ormconfig.json", signal: "has-database" },
  { file: "typeorm.config.ts", signal: "has-database" },

  // ─── API ──────────────────────────────────────────────────────
  { file: "openapi.yaml", signal: "has-api-spec", isManifest: true },
  { file: "openapi.json", signal: "has-api-spec", isManifest: true },
  { file: "swagger.yaml", signal: "has-api-spec", isManifest: true },
  { file: "swagger.json", signal: "has-api-spec", isManifest: true },
  { file: "graphql/", signal: "has-graphql" },
  { file: "schema.graphql", signal: "has-graphql" },
  { file: ".graphqlrc.yml", signal: "has-graphql" },
  { file: "codegen.ts", signal: "has-graphql" },
  { file: "codegen.yml", signal: "has-graphql" },

  // ─── Deployment / infra ───────────────────────────────────────
  { file: "vercel.json", signal: "deploys-vercel" },
  { file: "netlify.toml", signal: "deploys-netlify" },
  { file: "fly.toml", signal: "deploys-fly" },
  { file: "render.yaml", signal: "deploys-render" },
  { file: "railway.json", signal: "deploys-railway" },
  { file: "Procfile", signal: "deploys-heroku" },
  { file: "app.yaml", signal: "deploys-gcp" },
  { file: "firebase.json", signal: "deploys-firebase" },
  { file: "amplify.yml", signal: "deploys-aws" },

  // ─── Security ─────────────────────────────────────────────────
  { file: ".npmrc", signal: "has-npm-config" },
  { file: ".nvmrc", signal: "has-node-version-pinned" },
  { file: ".node-version", signal: "has-node-version-pinned" },
  { file: ".python-version", signal: "has-python-version-pinned" },
  { file: ".tool-versions", signal: "has-tool-versions" },
  { file: "renovate.json", signal: "has-dependency-bot" },
  { file: ".github/dependabot.yml", signal: "has-dependency-bot" },

  // ─── Styling ──────────────────────────────────────────────────
  { file: "tailwind.config.js", signal: "has-tailwind" },
  { file: "tailwind.config.ts", signal: "has-tailwind" },
  { file: "tailwind.config.mjs", signal: "has-tailwind" },
  { file: "postcss.config.js", signal: "has-postcss" },
  { file: "postcss.config.mjs", signal: "has-postcss" },

  // ─── AI / ML ──────────────────────────────────────────────────
  { file: "requirements.txt", signal: "has-ai-ml", contentPattern: /(?:torch|tensorflow|transformers|langchain|openai|anthropic)/ },
  { file: "pyproject.toml", signal: "has-ai-ml", contentPattern: /(?:torch|tensorflow|transformers|langchain|openai|anthropic)/ },
  { file: "package.json", signal: "has-ai-ml", contentPattern: /(?:"openai"|"@anthropic-ai\/sdk"|"langchain"|"@langchain")/ },

  // ─── Agent / AI tools ─────────────────────────────────────────
  { file: ".cursorrules", signal: "uses-cursor" },
  { file: ".cursor/rules", signal: "uses-cursor" },
  { file: "AGENTS.md", signal: "uses-agents", isManifest: true },
  { file: ".agents/", signal: "uses-agents" },
  { file: "CLAUDE.md", signal: "uses-claude-code", isManifest: true },
  { file: ".claude/settings.json", signal: "uses-claude-code" },
  { file: "codex.md", signal: "uses-codex", isManifest: true },
  { file: ".opencode/", signal: "uses-opencode" },
  { file: ".ampcode/", signal: "uses-amp" },
  { file: ".windsurfrules", signal: "uses-windsurf" },
  { file: "mcp.json", signal: "uses-mcp", isManifest: true },
  { file: ".mcp.json", signal: "uses-mcp", isManifest: true },

  // ─── Monorepo structure ───────────────────────────────────────
  { file: "packages/", signal: "has-packages-dir" },
  { file: "apps/", signal: "has-apps-dir" },
  { file: "libs/", signal: "has-libs-dir" },
];

/**
 * Detect project signals from a workspace directory.
 */
export async function detectSignals(
  workspacePath: string,
): Promise<SignalDetection> {
  const signals = new Set<string>();
  const manifestFiles: string[] = [];

  const fileContentCache = new Map<string, string | null>();

  async function getFileContent(filePath: string): Promise<string | null> {
    if (fileContentCache.has(filePath)) {
      return fileContentCache.get(filePath) ?? null;
    }
    try {
      const content = await readText(filePath);
      fileContentCache.set(filePath, content);
      return content;
    } catch {
      fileContentCache.set(filePath, null);
      return null;
    }
  }

  for (const rule of SIGNAL_RULES) {
    const filePath = path.join(workspacePath, rule.file);
    const exists = await pathExists(filePath);
    if (!exists) continue;

    if (rule.contentPattern) {
      const content = await getFileContent(filePath);
      if (!content || !rule.contentPattern.test(content)) continue;
    }

    signals.add(rule.signal);
    if (rule.isManifest) {
      manifestFiles.push(rule.file);
    }
  }

  return {
    signals: [...signals],
    manifestFiles,
  };
}

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
  // Testing
  { file: "jest.config.js", signal: "has-tests" },
  { file: "jest.config.ts", signal: "has-tests" },
  { file: "vitest.config.ts", signal: "has-tests" },
  { file: "vitest.config.js", signal: "has-tests" },
  { file: "cypress.config.ts", signal: "has-e2e-tests" },
  { file: "cypress.config.js", signal: "has-e2e-tests" },
  { file: "playwright.config.ts", signal: "has-e2e-tests" },
  { file: ".mocharc.yml", signal: "has-tests" },
  { file: "pytest.ini", signal: "has-tests" },
  { file: "pyproject.toml", signal: "has-tests", contentPattern: /\[tool\.pytest/ },

  // CI/CD
  { file: ".github/workflows", signal: "has-ci" },
  { file: ".gitlab-ci.yml", signal: "has-ci" },
  { file: ".circleci/config.yml", signal: "has-ci" },
  { file: "Jenkinsfile", signal: "has-ci" },

  // Code quality
  { file: ".eslintrc.json", signal: "has-linting" },
  { file: ".eslintrc.js", signal: "has-linting" },
  { file: "eslint.config.js", signal: "has-linting" },
  { file: "eslint.config.mjs", signal: "has-linting" },
  { file: ".prettierrc", signal: "has-formatter" },
  { file: ".prettierrc.json", signal: "has-formatter" },
  { file: "biome.json", signal: "has-linting" },
  { file: "ruff.toml", signal: "has-linting" },
  { file: ".ruff.toml", signal: "has-linting" },

  // Documentation
  { file: "README.md", signal: "has-readme", isManifest: true },
  { file: "docs/", signal: "has-docs" },
  { file: "CONTRIBUTING.md", signal: "has-contributing" },
  { file: "CHANGELOG.md", signal: "has-changelog" },

  // Config / environment
  { file: ".env", signal: "has-env-config" },
  { file: ".env.example", signal: "has-env-config" },
  { file: ".env.local", signal: "has-env-config" },

  // Database
  { file: "prisma/schema.prisma", signal: "has-database" },
  { file: "drizzle.config.ts", signal: "has-database" },
  { file: "migrations/", signal: "has-database" },
  { file: "alembic.ini", signal: "has-database" },

  // API
  { file: "openapi.yaml", signal: "has-api-spec", isManifest: true },
  { file: "openapi.json", signal: "has-api-spec", isManifest: true },
  { file: "swagger.yaml", signal: "has-api-spec", isManifest: true },
  { file: "swagger.json", signal: "has-api-spec", isManifest: true },

  // Deployment / infra
  { file: "vercel.json", signal: "deploys-vercel" },
  { file: "netlify.toml", signal: "deploys-netlify" },
  { file: "fly.toml", signal: "deploys-fly" },
  { file: "render.yaml", signal: "deploys-render" },
  { file: "railway.json", signal: "deploys-railway" },
  { file: "Procfile", signal: "deploys-heroku" },

  // Security
  { file: ".npmrc", signal: "has-npm-config" },
  { file: ".nvmrc", signal: "has-node-version-pinned" },
  { file: ".node-version", signal: "has-node-version-pinned" },
  { file: ".python-version", signal: "has-python-version-pinned" },
  { file: ".tool-versions", signal: "has-tool-versions" },

  // Agent / AI
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

  // Monorepo structure
  { file: "packages/", signal: "has-packages-dir" },
  { file: "apps/", signal: "has-apps-dir" },
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

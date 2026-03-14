import path from "node:path";
import { pathExists, readText } from "../utils/fs.js";

/**
 * Framework detection result.
 */
export interface FrameworkDetection {
  frameworks: string[];
  languages: string[];
  packageManagers: string[];
  projectKinds: string[];
}

/**
 * File-based detection rules.
 * Each rule maps a file or glob to frameworks/languages/project kinds.
 */
interface DetectionRule {
  file: string;
  framework?: string;
  language?: string;
  packageManager?: string;
  projectKind?: string;
  /** Optional content check — only match if file contains this pattern */
  contentPattern?: RegExp;
}

const DETECTION_RULES: DetectionRule[] = [
  // JavaScript / TypeScript ecosystem
  { file: "package.json", language: "typescript", packageManager: "npm", projectKind: "node" },
  { file: "pnpm-lock.yaml", packageManager: "pnpm" },
  { file: "pnpm-workspace.yaml", packageManager: "pnpm", projectKind: "monorepo" },
  { file: "yarn.lock", packageManager: "yarn" },
  { file: "bun.lockb", packageManager: "bun" },
  { file: "tsconfig.json", language: "typescript" },
  { file: "jsconfig.json", language: "javascript" },

  // Frontend frameworks
  { file: "next.config.js", framework: "nextjs", projectKind: "web" },
  { file: "next.config.mjs", framework: "nextjs", projectKind: "web" },
  { file: "next.config.ts", framework: "nextjs", projectKind: "web" },
  { file: "nuxt.config.ts", framework: "nuxt", projectKind: "web" },
  { file: "nuxt.config.js", framework: "nuxt", projectKind: "web" },
  { file: "svelte.config.js", framework: "svelte", projectKind: "web" },
  { file: "astro.config.mjs", framework: "astro", projectKind: "web" },
  { file: "astro.config.ts", framework: "astro", projectKind: "web" },
  { file: "remix.config.js", framework: "remix", projectKind: "web" },
  { file: "angular.json", framework: "angular", projectKind: "web" },
  { file: "vite.config.ts", framework: "vite", projectKind: "web" },
  { file: "vite.config.js", framework: "vite", projectKind: "web" },
  { file: "webpack.config.js", framework: "webpack", projectKind: "web" },

  // React detection via package.json
  { file: "package.json", framework: "react", contentPattern: /"react"\s*:/ },
  { file: "package.json", framework: "vue", contentPattern: /"vue"\s*:/ },

  // Backend frameworks
  { file: "nest-cli.json", framework: "nestjs", projectKind: "api" },
  { file: "fastify.config.js", framework: "fastify", projectKind: "api" },

  // Python ecosystem
  { file: "pyproject.toml", language: "python", packageManager: "pip" },
  { file: "setup.py", language: "python", packageManager: "pip" },
  { file: "requirements.txt", language: "python", packageManager: "pip" },
  { file: "Pipfile", language: "python", packageManager: "pipenv" },
  { file: "poetry.lock", language: "python", packageManager: "poetry" },
  { file: "uv.lock", language: "python", packageManager: "uv" },

  // Python frameworks
  { file: "manage.py", framework: "django", projectKind: "web" },
  { file: "pyproject.toml", framework: "fastapi", contentPattern: /fastapi/ },
  { file: "pyproject.toml", framework: "flask", contentPattern: /flask/ },

  // Go
  { file: "go.mod", language: "go", packageManager: "go-modules" },
  { file: "go.sum", language: "go" },

  // Rust
  { file: "Cargo.toml", language: "rust", packageManager: "cargo" },
  { file: "Cargo.lock", language: "rust" },

  // Java/Kotlin
  { file: "pom.xml", language: "java", packageManager: "maven", projectKind: "jvm" },
  { file: "build.gradle", language: "java", packageManager: "gradle", projectKind: "jvm" },
  { file: "build.gradle.kts", language: "kotlin", packageManager: "gradle", projectKind: "jvm" },

  // Ruby
  { file: "Gemfile", language: "ruby", packageManager: "bundler" },
  { file: "Gemfile.lock", language: "ruby" },
  { file: "config/routes.rb", framework: "rails", projectKind: "web" },

  // PHP
  { file: "composer.json", language: "php", packageManager: "composer" },
  { file: "artisan", framework: "laravel", projectKind: "web" },

  // Elixir
  { file: "mix.exs", language: "elixir", packageManager: "mix" },

  // .NET
  { file: "*.csproj", language: "csharp", packageManager: "nuget", projectKind: "dotnet" },
  { file: "*.fsproj", language: "fsharp", packageManager: "nuget", projectKind: "dotnet" },

  // Docker / Infrastructure
  { file: "Dockerfile", projectKind: "containerized" },
  { file: "docker-compose.yml", projectKind: "containerized" },
  { file: "docker-compose.yaml", projectKind: "containerized" },
  { file: "terraform.tf", projectKind: "infrastructure" },
  { file: "pulumi.yaml", projectKind: "infrastructure" },

  // MCP / AI
  { file: "mcp.json", projectKind: "mcp" },
  { file: ".agents/", projectKind: "agent-enhanced" },
  { file: "AGENTS.md", projectKind: "agent-enhanced" },

  // Monorepo
  { file: "lerna.json", projectKind: "monorepo" },
  { file: "nx.json", projectKind: "monorepo", framework: "nx" },
  { file: "turbo.json", projectKind: "monorepo", framework: "turborepo" },
];

/**
 * Detect frameworks, languages, and project kinds from a workspace directory.
 */
export async function detectFrameworks(
  workspacePath: string,
): Promise<FrameworkDetection> {
  const frameworks = new Set<string>();
  const languages = new Set<string>();
  const packageManagers = new Set<string>();
  const projectKinds = new Set<string>();

  // Cache file existence and content to avoid redundant reads
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

  for (const rule of DETECTION_RULES) {
    // Handle glob-like patterns (just check file extension patterns for simplicity)
    if (rule.file.startsWith("*")) {
      // Skip glob patterns — we'd need a directory listing for these
      // For MVP, rely on direct file detection
      continue;
    }

    const filePath = path.join(workspacePath, rule.file);
    const exists = await pathExists(filePath);
    if (!exists) continue;

    // If rule has content pattern, check the content
    if (rule.contentPattern) {
      const content = await getFileContent(filePath);
      if (!content || !rule.contentPattern.test(content)) continue;
    }

    if (rule.framework) frameworks.add(rule.framework);
    if (rule.language) languages.add(rule.language);
    if (rule.packageManager) packageManagers.add(rule.packageManager);
    if (rule.projectKind) projectKinds.add(rule.projectKind);
  }

  return {
    frameworks: [...frameworks],
    languages: [...languages],
    packageManagers: [...packageManagers],
    projectKinds: [...projectKinds],
  };
}

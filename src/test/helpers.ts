import path from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import type { ExecutionContext, SkillRecord, Scope } from "../domain/types.js";
import { ensureDir, readText, removePathIfExists, writeText } from "../utils/fs.js";

export async function createTempWorkspace(prefix: string): Promise<string> {
  const workspace = path.join(tmpdir(), `${prefix}-${randomUUID()}`);
  await ensureDir(workspace);
  return workspace;
}

export function createExecutionContext(workspaceRoot: string): ExecutionContext {
  return {
    workspaceRoot,
    homeDir: path.join(workspaceRoot, ".test-home"),
    platform: process.platform,
    nowIso: "2026-03-15T00:00:00.000Z",
  };
}

export async function disposeTempPath(targetPath: string): Promise<void> {
  await removePathIfExists(targetPath);
}

export async function seedCanonicalSkill(
  workspaceRoot: string,
  scope: Scope,
  name = "hello-smoke-skill",
): Promise<SkillRecord> {
  const root = scope === "project"
    ? path.join(workspaceRoot, ".agents", "skills")
    : path.join(workspaceRoot, ".test-home", ".agents", "skills");
  const canonicalDir = path.join(root, name);
  const canonicalSkillFile = path.join(canonicalDir, "SKILL.md");

  await ensureDir(canonicalDir);
  await writeText(
    canonicalSkillFile,
    [
      "---",
      `name: ${name}`,
      "description: Seeded canonical skill for tests.",
      "compatibility: universal",
      "---",
      "",
      "# Test Skill",
    ].join("\n"),
  );

  return {
    name,
    manifest: {
      name,
      description: "Seeded canonical skill for tests.",
      compatibility: "universal",
    },
    source: {
      type: "local",
      locator: canonicalDir,
    },
    canonicalDir,
    canonicalSkillFile,
    contentHash: "sha256:test",
    features: {
      hasScripts: false,
      hasReferences: false,
      hasAssets: false,
      hasMcpConfig: false,
      nonPortableFields: [],
    },
  };
}

export async function createLocalSourceSkill(input: {
  rootDir: string;
  name?: string;
  description?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  extraFiles?: Record<string, string>;
}): Promise<string> {
  const name = input.name ?? "hello-source-skill";
  const description = input.description ?? "Temporary local source skill for tests.";
  const compatibility = input.compatibility ?? "universal";
  const metadata = input.metadata ?? { owner: "tests" };
  const skillDir = path.join(input.rootDir, "sources", name);

  await ensureDir(skillDir);
  await writeText(
    path.join(skillDir, "SKILL.md"),
    renderSkillFile({ name, description, compatibility, metadata }),
  );

  for (const [relativePath, content] of Object.entries(input.extraFiles ?? {})) {
    await writeText(path.join(skillDir, relativePath), content);
  }

  return skillDir;
}

export async function updateLocalSourceSkill(
  skillDir: string,
  input: {
    name?: string;
    description?: string;
    compatibility?: string;
    metadata?: Record<string, string>;
    extraFiles?: Record<string, string>;
  },
): Promise<void> {
  const existing = await readText(path.join(skillDir, "SKILL.md"));
  const currentName = input.name ?? extractFrontmatterValue(existing, "name") ?? path.basename(skillDir);
  const currentDescription = input.description ?? extractFrontmatterValue(existing, "description") ?? "Updated test skill.";
  const currentCompatibility = input.compatibility ?? extractFrontmatterValue(existing, "compatibility") ?? "universal";

  await writeText(
    path.join(skillDir, "SKILL.md"),
    renderSkillFile({
      name: currentName,
      description: currentDescription,
      compatibility: currentCompatibility,
      metadata: input.metadata ?? { owner: "tests", updated: "true" },
    }),
  );

  for (const [relativePath, content] of Object.entries(input.extraFiles ?? {})) {
    await writeText(path.join(skillDir, relativePath), content);
  }
}

function renderSkillFile(input: {
  name: string;
  description: string;
  compatibility: string;
  metadata: Record<string, string>;
}): string {
  const metadataLines = Object.entries(input.metadata)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join("\n");

  return [
    "---",
    `name: ${input.name}`,
    `description: ${input.description}`,
    `compatibility: ${input.compatibility}`,
    "metadata:",
    metadataLines,
    "---",
    "",
    `# ${input.name}`,
  ].join("\n");
}

function extractFrontmatterValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

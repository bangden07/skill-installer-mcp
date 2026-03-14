import path from "node:path";
import { InstallerError } from "../domain/errors.js";
import type { FetchedSkill, SkillSourceRef } from "../domain/types.js";

export function createLocalSkillSource(locator: string): SkillSourceRef {
  return {
    type: "local",
    locator: path.resolve(locator),
  };
}

export function normalizeFetchedSkill(
  source: SkillSourceRef,
  files: Array<{ relativePath: string; content: string; executable?: boolean }>,
): FetchedSkill {
  const normalizedFiles = files.map((file) => ({
    relativePath: normalizeRelativePath(file.relativePath),
    content: file.content,
    executable: file.executable,
  }));

  const hasSkillFile = normalizedFiles.some((file) => file.relativePath === "SKILL.md");
  if (!hasSkillFile) {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      "Fetched skill does not contain SKILL.md.",
      { details: { source } },
    );
  }

  return {
    source,
    revision: source.revision,
    files: normalizedFiles,
  };
}

export function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/").replace(/^\.\//, "");
  return normalized.replace(/^\//, "");
}

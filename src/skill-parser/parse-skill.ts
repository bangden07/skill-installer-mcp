import { InstallerError } from "../domain/errors.js";
import type { SkillManifest } from "../domain/types.js";

export interface ParsedSkillFile extends SkillManifest {
  body: string;
  rawFrontmatter: Record<string, unknown>;
}

export async function parseSkillFileContent(
  content: string,
): Promise<ParsedSkillFile> {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith("---")) {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      "SKILL.md must start with YAML frontmatter.",
    );
  }

  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      "Failed to parse YAML frontmatter from SKILL.md.",
    );
  }

  const [, frontmatterRaw, bodyRaw] = match;
  const rawFrontmatter = parseSimpleFrontmatter(frontmatterRaw);
  const name = getRequiredString(rawFrontmatter, "name");
  const description = getRequiredString(rawFrontmatter, "description");

  const compatibility = getOptionalString(rawFrontmatter, "compatibility");
  const metadata = getOptionalStringMap(rawFrontmatter, "metadata");

  return {
    name,
    description,
    compatibility,
    metadata,
    body: bodyRaw.trim(),
    rawFrontmatter,
  };
}

function parseSimpleFrontmatter(input: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = input.split(/\r?\n/);

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const metadataMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!metadataMatch) {
      throw new InstallerError(
        "INVALID_SKILL_FILE",
        `Invalid frontmatter line: ${line}`,
      );
    }

    const [, key, rawValue] = metadataMatch;

    if (rawValue === "") {
      const objectLines: string[] = [];
      let childIndex = index + 1;

      while (childIndex < lines.length) {
        const childLine = lines[childIndex] ?? "";
        if (!childLine.trim()) {
          childIndex += 1;
          continue;
        }

        if (!childLine.startsWith("  ")) {
          break;
        }

        objectLines.push(childLine);
        childIndex += 1;
      }

      if (objectLines.length === 0) {
        result[key] = "";
        index = childIndex;
        continue;
      }

      result[key] = parseIndentedStringMap(objectLines);
      index = childIndex;
      continue;
    }

    result[key] = stripOptionalQuotes(rawValue.trim());
    index += 1;
  }

  return result;
}

function parseIndentedStringMap(lines: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of lines) {
    const match = line.match(/^\s{2}([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match) {
      throw new InstallerError(
        "INVALID_SKILL_FILE",
        `Invalid nested frontmatter line: ${line}`,
      );
    }

    const [, key, rawValue] = match;
    result[key] = stripOptionalQuotes(rawValue.trim());
  }

  return result;
}

function getRequiredString(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      `Frontmatter field '${key}' must be a non-empty string.`,
    );
  }
  return value.trim();
}

function getOptionalString(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      `Frontmatter field '${key}' must be a string if provided.`,
    );
  }

  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

function getOptionalStringMap(
  input: Record<string, unknown>,
  key: string,
): Record<string, string> | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      `Frontmatter field '${key}' must be a string map if provided.`,
    );
  }

  const output: Record<string, string> = {};

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      throw new InstallerError(
        "INVALID_SKILL_FILE",
        `Frontmatter field '${key}.${entryKey}' must be a string.`,
      );
    }
    output[entryKey] = entryValue;
  }

  return output;
}

function stripOptionalQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

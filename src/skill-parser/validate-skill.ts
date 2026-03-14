import { InstallerError } from "../domain/errors.js";
import type { SkillManifest } from "../domain/types.js";
import type { ParsedSkillFile } from "./parse-skill.js";

export const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SKILL_NAME_LENGTH = 64;
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024;

export interface ValidateSkillOptions {
  expectedDirectoryName?: string;
}

export function validateParsedSkillFile(
  parsed: ParsedSkillFile,
  options?: ValidateSkillOptions,
): ParsedSkillFile {
  validateSkillManifest(parsed, options);
  return parsed;
}

export function validateSkillManifest(
  manifest: SkillManifest,
  options?: ValidateSkillOptions,
): SkillManifest {
  validateSkillName(manifest.name, options?.expectedDirectoryName);
  validateSkillDescription(manifest.description);
  validateOptionalCompatibility(manifest.compatibility);
  validateOptionalMetadata(manifest.metadata);

  return manifest;
}

export function validateSkillName(
  name: string,
  expectedDirectoryName?: string,
): void {
  const normalized = name.trim();

  if (normalized.length === 0) {
    throw new InstallerError(
      "INVALID_SKILL_NAME",
      "Skill name must not be empty.",
    );
  }

  if (normalized.length > MAX_SKILL_NAME_LENGTH) {
    throw new InstallerError(
      "INVALID_SKILL_NAME",
      `Skill name must be ${MAX_SKILL_NAME_LENGTH} characters or fewer.`,
    );
  }

  if (!SKILL_NAME_REGEX.test(normalized)) {
    throw new InstallerError(
      "INVALID_SKILL_NAME",
      "Skill name must use lowercase alphanumeric characters with single hyphen separators.",
      {
        details: {
          name: normalized,
          expectedPattern: SKILL_NAME_REGEX.source,
        },
      },
    );
  }

  if (expectedDirectoryName && normalized !== expectedDirectoryName) {
    throw new InstallerError(
      "INVALID_SKILL_NAME",
      "Skill name must match the directory name.",
      {
        details: {
          name: normalized,
          expectedDirectoryName,
        },
      },
    );
  }
}

export function validateSkillDescription(description: string): void {
  const normalized = description.trim();

  if (normalized.length === 0) {
    throw new InstallerError(
      "INVALID_SKILL_DESCRIPTION",
      "Skill description must not be empty.",
    );
  }

  if (normalized.length > MAX_SKILL_DESCRIPTION_LENGTH) {
    throw new InstallerError(
      "INVALID_SKILL_DESCRIPTION",
      `Skill description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or fewer.`,
    );
  }
}

export function validateOptionalCompatibility(
  compatibility: string | undefined,
): void {
  if (compatibility === undefined) {
    return;
  }

  if (compatibility.trim().length === 0) {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      "Compatibility must not be an empty string if provided.",
    );
  }
}

export function validateOptionalMetadata(
  metadata: Record<string, string> | undefined,
): void {
  if (metadata === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (key.trim().length === 0) {
      throw new InstallerError(
        "INVALID_SKILL_FILE",
        "Metadata keys must not be empty.",
      );
    }

    if (value.trim().length === 0) {
      throw new InstallerError(
        "INVALID_SKILL_FILE",
        `Metadata value for '${key}' must not be empty.`,
      );
    }
  }
}

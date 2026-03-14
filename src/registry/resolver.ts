import path from "node:path";
import { InstallerError } from "../domain/errors.js";
import type { ExecutionContext, SkillSelector, SkillSourceRef } from "../domain/types.js";
import { createLocalSkillSource } from "./local-source.js";
import { createGitSkillSourceInstance } from "./git-source.js";
import { createSkillsShSourceInstance, createSkillsShSource } from "./skills-sh.js";
import { createLocalSkillSource as createLocalSourceRef } from "./normalize.js";

export interface RegistryResolver {
  resolve(selector: SkillSelector, ctx: ExecutionContext): Promise<SkillSourceRef>;
}

export class RegistryResolverImpl implements RegistryResolver {
  async resolve(selector: SkillSelector, _ctx: ExecutionContext): Promise<SkillSourceRef> {
    if (selector.source) {
      return selector.source;
    }

    const nameOrId = selector.name ?? selector.id;
    if (!nameOrId) {
      throw new InstallerError(
        "SOURCE_RESOLUTION_FAILED",
        "Skill selector must include name, id, or source.",
        { details: { selector } },
      );
    }

    // Local path detection
    if (looksLikeLocalPath(nameOrId)) {
      return createLocalSourceRef(nameOrId);
    }

    // Git URL detection
    if (looksLikeGitUrl(nameOrId)) {
      return resolveGitUrl(nameOrId);
    }

    // skills.sh shorthand: "skills.sh:owner/name" or "owner/name" pattern
    if (nameOrId.startsWith("skills.sh:")) {
      return createSkillsShSource(nameOrId.replace(/^skills\.sh:/, ""));
    }

    // Plain "owner/name" — try as skills.sh source
    if (looksLikeSlashSelector(nameOrId)) {
      return createSkillsShSource(nameOrId);
    }

    throw new InstallerError(
      "SOURCE_RESOLUTION_FAILED",
      `Cannot resolve skill selector: "${nameOrId}". Use a local path, git URL, or skills.sh selector (owner/repo or owner/repo/skill).`,
      { details: { selector } },
    );
  }
}

export function createRegistryResolver(): RegistryResolver {
  return new RegistryResolverImpl();
}

export interface SkillFetcher {
  fetchMetadataOnly(source: SkillSourceRef, ctx: ExecutionContext): Promise<import("../domain/types.js").FetchedSkill>;
  fetchFullSkill(source: SkillSourceRef, ctx: ExecutionContext): Promise<import("../domain/types.js").FetchedSkill>;
}

/**
 * Creates a universal fetcher that delegates to local, git, or skills.sh sources.
 */
export function createSkillFetcher(): SkillFetcher {
  const local = createLocalSkillSource();
  const git = createGitSkillSourceInstance();
  const skillsSh = createSkillsShSourceInstance();

  function getSource(source: SkillSourceRef) {
    if (local.canHandle(source)) return local;
    if (git.canHandle(source)) return git;
    if (skillsSh.canHandle(source)) return skillsSh;
    return null;
  }

  return {
    async fetchMetadataOnly(source: SkillSourceRef, ctx: ExecutionContext) {
      const handler = getSource(source);
      if (!handler) {
        throw new InstallerError(
          "FETCH_FAILED",
          `Unsupported source type for metadata fetch: ${source.type}`,
        );
      }
      return handler.fetchMetadataOnly(source, ctx);
    },

    async fetchFullSkill(source: SkillSourceRef, ctx: ExecutionContext) {
      const handler = getSource(source);
      if (!handler) {
        throw new InstallerError(
          "FETCH_FAILED",
          `Unsupported source type for full fetch: ${source.type}`,
        );
      }
      return handler.fetchFullSkill(source, ctx);
    },
  };
}

/**
 * Creates a local-only fetcher (backward compatible).
 */
export function createLocalOnlyFetcher(): SkillFetcher {
  const local = createLocalSkillSource();

  return {
    async fetchMetadataOnly(source: SkillSourceRef, ctx: ExecutionContext) {
      if (!local.canHandle(source)) {
        throw new InstallerError(
          "FETCH_FAILED",
          `Unsupported source type for metadata fetch: ${source.type}`,
        );
      }

      return local.fetchMetadataOnly(source, ctx);
    },

    async fetchFullSkill(source: SkillSourceRef, ctx: ExecutionContext) {
      if (!local.canHandle(source)) {
        throw new InstallerError(
          "FETCH_FAILED",
          `Unsupported source type for full fetch: ${source.type}`,
        );
      }

      return local.fetchFullSkill(source, ctx);
    },
  };
}

function looksLikeLocalPath(value: string): boolean {
  return (
    value.startsWith(".") ||
    value.startsWith("/") ||
    value.startsWith("~") ||
    value.includes("\\") ||
    path.isAbsolute(value)
  );
}

function looksLikeGitUrl(value: string): boolean {
  return (
    value.startsWith("git+") ||
    value.startsWith("https://github.com/") ||
    value.startsWith("https://gitlab.com/") ||
    value.startsWith("https://bitbucket.org/") ||
    value.endsWith(".git")
  );
}

function looksLikeSlashSelector(value: string): boolean {
  // "owner/repo" (2-segment) or "owner/repo/skill" (3-segment) pattern
  // No protocols, no dots in first segment
  const parts = value.split("/");
  if (parts.length < 2 || parts.length > 3) return false;
  if (parts[0].includes(".") || parts[0].includes(":")) return false;
  return parts.every((p) => p.length > 0);
}

function resolveGitUrl(value: string): SkillSourceRef {
  let url = value;
  let revision: string | undefined;

  // Handle fragment as revision: url#branch
  const hashIndex = url.indexOf("#");
  if (hashIndex !== -1) {
    revision = url.slice(hashIndex + 1);
    url = url.slice(0, hashIndex);
  }

  // Strip git+ prefix for the locator
  const locator = url.startsWith("git+") ? url.slice(4) : url;

  return {
    type: "git",
    locator,
    revision,
  };
}

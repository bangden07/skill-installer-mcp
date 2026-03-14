import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { InstallerError } from "../domain/errors.js";
import type {
  ExecutionContext,
  FetchedSkill,
  SkillSourceRef,
} from "../domain/types.js";
import { listRelativeFiles, makeTempDirNear, pathExists, readText, removePathIfExists } from "../utils/fs.js";
import { normalizeFetchedSkill } from "./normalize.js";

const execFileAsync = promisify(execFile);

/**
 * Git-based skill source.
 *
 * Supports selectors like:
 *   - git+https://github.com/org/repo.git
 *   - git+https://github.com/org/repo.git#branch
 *   - git+https://github.com/org/repo.git?path=skills/my-skill
 *   - git+https://github.com/org/repo.git?path=skills/my-skill#v1.0
 *
 * The locator format is: <git-url>[?path=<subdir>]
 * Revision (branch/tag/commit) is stored separately in source.revision.
 */

export interface GitSkillSource {
  canHandle(source: SkillSourceRef): boolean;
  fetchMetadataOnly(
    source: SkillSourceRef,
    ctx: ExecutionContext,
  ): Promise<FetchedSkill>;
  fetchFullSkill(
    source: SkillSourceRef,
    ctx: ExecutionContext,
  ): Promise<FetchedSkill>;
}

export class GitSkillSourceImpl implements GitSkillSource {
  canHandle(source: SkillSourceRef): boolean {
    return source.type === "git";
  }

  async fetchMetadataOnly(
    source: SkillSourceRef,
    ctx: ExecutionContext,
  ): Promise<FetchedSkill> {
    const { repoUrl, subPath } = parseGitLocator(source.locator);
    const cloneDir = await shallowClone(repoUrl, source.revision, ctx);

    try {
      const skillDir = subPath
        ? path.join(cloneDir, subPath)
        : cloneDir;

      const skillFilePath = path.join(skillDir, "SKILL.md");
      if (!(await pathExists(skillFilePath))) {
        throw new InstallerError(
          "INVALID_SKILL_FILE",
          `Git source does not contain SKILL.md at ${subPath ?? "root"}: ${repoUrl}`,
        );
      }

      const content = await readText(skillFilePath);
      return normalizeFetchedSkill(source, [
        { relativePath: "SKILL.md", content },
      ]);
    } finally {
      await removePathIfExists(cloneDir);
    }
  }

  async fetchFullSkill(
    source: SkillSourceRef,
    ctx: ExecutionContext,
  ): Promise<FetchedSkill> {
    const { repoUrl, subPath } = parseGitLocator(source.locator);
    const cloneDir = await shallowClone(repoUrl, source.revision, ctx);

    try {
      const skillDir = subPath
        ? path.join(cloneDir, subPath)
        : cloneDir;

      if (!(await pathExists(skillDir))) {
        throw new InstallerError(
          "SOURCE_RESOLUTION_FAILED",
          `Git source subpath does not exist: ${subPath} in ${repoUrl}`,
        );
      }

      const skillFilePath = path.join(skillDir, "SKILL.md");
      if (!(await pathExists(skillFilePath))) {
        throw new InstallerError(
          "INVALID_SKILL_FILE",
          `Git source does not contain SKILL.md at ${subPath ?? "root"}: ${repoUrl}`,
        );
      }

      const relativeFiles = await listRelativeFiles(skillDir);
      // Filter out .git directory entries (shouldn't appear if we're in subpath, but safety)
      const filteredFiles = relativeFiles.filter(
        (f) => !f.startsWith(".git/") && f !== ".git",
      );

      const files = await Promise.all(
        filteredFiles.map(async (relativePath) => ({
          relativePath,
          content: await readText(path.join(skillDir, relativePath)),
        })),
      );

      return normalizeFetchedSkill(source, files);
    } finally {
      await removePathIfExists(cloneDir);
    }
  }
}

/**
 * Parse a git locator string.
 * Format: <url>[?path=<subdir>]
 * The URL may start with git+ prefix which we strip.
 */
export function parseGitLocator(locator: string): {
  repoUrl: string;
  subPath?: string;
} {
  let cleanLocator = locator;

  // Strip git+ prefix if present
  if (cleanLocator.startsWith("git+")) {
    cleanLocator = cleanLocator.slice(4);
  }

  // Extract ?path=... query param
  const queryIndex = cleanLocator.indexOf("?");
  let repoUrl = cleanLocator;
  let subPath: string | undefined;

  if (queryIndex !== -1) {
    repoUrl = cleanLocator.slice(0, queryIndex);
    const queryString = cleanLocator.slice(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    subPath = params.get("path") ?? undefined;
  }

  return { repoUrl, subPath };
}

/**
 * Create a git source reference from a URL.
 */
export function createGitSkillSource(
  repoUrl: string,
  options?: { path?: string; revision?: string },
): SkillSourceRef {
  let locator = repoUrl;
  if (options?.path) {
    locator += `?path=${encodeURIComponent(options.path)}`;
  }

  return {
    type: "git",
    locator,
    revision: options?.revision,
  };
}

/**
 * Shallow-clone a git repo into a temp directory.
 * Uses --depth=1 for speed and minimal disk usage.
 */
async function shallowClone(
  repoUrl: string,
  revision: string | undefined,
  ctx: ExecutionContext,
): Promise<string> {
  await assertGitAvailable();

  const tmpRoot = path.join(ctx.homeDir, ".skill-installer", "tmp");
  const cloneDir = await makeTempDirNear(tmpRoot, "git-skill-");

  try {
    const args = ["clone", "--depth", "1"];

    if (revision) {
      args.push("--branch", revision);
    }

    args.push("--", repoUrl, cloneDir);

    await execFileAsync("git", args, {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return cloneDir;
  } catch (error) {
    await removePathIfExists(cloneDir);

    const msg =
      error instanceof Error ? error.message : "Unknown git clone error";
    throw new InstallerError("FETCH_FAILED", `Git clone failed: ${msg}`, {
      retryable: true,
      details: { repoUrl, revision },
      cause: error,
    });
  }
}

let gitAvailable: boolean | null = null;

async function assertGitAvailable(): Promise<void> {
  if (gitAvailable === true) return;

  try {
    await execFileAsync("git", ["--version"], { timeout: 10_000 });
    gitAvailable = true;
  } catch {
    gitAvailable = false;
    throw new InstallerError(
      "FETCH_FAILED",
      "Git is not installed or not available in PATH. Git source requires git CLI.",
    );
  }
}

export function createGitSkillSourceInstance(): GitSkillSource {
  return new GitSkillSourceImpl();
}

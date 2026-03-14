import { InstallerError } from "../domain/errors.js";
import type {
  ExecutionContext,
  FetchedSkill,
  SkillSourceRef,
} from "../domain/types.js";
import { normalizeFetchedSkill } from "./normalize.js";

/**
 * skills.sh source resolver.
 *
 * Resolves skills from the skills.sh ecosystem by fetching from
 * the skills.sh API / raw GitHub content.
 *
 * Selector formats:
 *   - 2-segment: "owner/repo"       → SKILL.md lives at repo root
 *   - 3-segment: "owner/repo/skill" → SKILL.md lives in a subdirectory
 *   - Prefixed:  "skills.sh:owner/repo[/skill]"
 *
 * The skills.sh leaderboard commonly uses 3-segment selectors for
 * multi-skill repos like "anthropics/skills/frontend-design" where
 * owner=anthropics, repo=skills, skillPath=frontend-design.
 *
 * In these repos, skills typically live under a "skills/" subdirectory
 * (e.g., skills/frontend-design/SKILL.md). The resolver tries multiple
 * candidate paths to locate the skill automatically.
 *
 * Resolution strategy:
 * 1. Try https://raw.githubusercontent.com/<owner>/<repo>/<branch>/[resolved_prefix/]SKILL.md
 * 2. For 3-segment selectors, try multiple candidate prefixes:
 *    - {skillPath}/             (direct subdirectory)
 *    - skills/{skillPath}/      (most common: anthropics/skills, obra/superpowers, etc.)
 *    - .agents/skills/{skillPath}/
 *    - .claude/skills/{skillPath}/
 * 3. Fall back to repo tree search for exact directory name match
 */

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com";

export interface SkillsShSource {
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

export class SkillsShSourceImpl implements SkillsShSource {
  canHandle(source: SkillSourceRef): boolean {
    return source.type === "skills.sh";
  }

  async fetchMetadataOnly(
    source: SkillSourceRef,
    _ctx: ExecutionContext,
  ): Promise<FetchedSkill> {
    const parsed = parseSkillsShLocator(source.locator);
    // First detect branch, then resolve the actual skill prefix
    const branch =
      source.revision ?? (await detectDefaultBranchForSkill(parsed));

    const resolvedPrefix = await resolveSkillPrefix(
      parsed.owner,
      parsed.repo,
      branch,
      parsed.skillPath,
    );

    if (resolvedPrefix === null) {
      throw new InstallerError(
        "FETCH_FAILED",
        `Could not find SKILL.md in skills.sh source: ${source.locator} (tried branch: ${branch}, skill: ${parsed.skillPath ?? "root"})`,
        {
          retryable: true,
          details: {
            owner: parsed.owner,
            repo: parsed.repo,
            skillPath: parsed.skillPath,
            branch,
          },
        },
      );
    }

    const prefix = resolvedPrefix ? `${resolvedPrefix}/` : "";
    const skillMdUrl = `${GITHUB_RAW_BASE}/${parsed.owner}/${parsed.repo}/${branch}/${prefix}SKILL.md`;
    const content = await fetchText(skillMdUrl);

    if (content === null) {
      throw new InstallerError(
        "FETCH_FAILED",
        `Could not fetch SKILL.md from skills.sh source: ${source.locator} (tried branch: ${branch})`,
        {
          retryable: true,
          details: {
            owner: parsed.owner,
            repo: parsed.repo,
            skillPath: parsed.skillPath,
            resolvedPrefix,
            branch,
          },
        },
      );
    }

    return normalizeFetchedSkill(source, [
      { relativePath: "SKILL.md", content },
    ]);
  }

  async fetchFullSkill(
    source: SkillSourceRef,
    _ctx: ExecutionContext,
  ): Promise<FetchedSkill> {
    const parsed = parseSkillsShLocator(source.locator);
    const branch =
      source.revision ?? (await detectDefaultBranchForSkill(parsed));

    const resolvedPrefix = await resolveSkillPrefix(
      parsed.owner,
      parsed.repo,
      branch,
      parsed.skillPath,
    );

    if (resolvedPrefix === null) {
      throw new InstallerError(
        "FETCH_FAILED",
        `Could not find SKILL.md in skills.sh source: ${source.locator}`,
        {
          retryable: true,
          details: {
            owner: parsed.owner,
            repo: parsed.repo,
            skillPath: parsed.skillPath,
            branch,
          },
        },
      );
    }

    const prefix = resolvedPrefix ? `${resolvedPrefix}/` : "";

    // Fetch SKILL.md (required)
    const skillMdUrl = `${GITHUB_RAW_BASE}/${parsed.owner}/${parsed.repo}/${branch}/${prefix}SKILL.md`;
    const skillMdContent = await fetchText(skillMdUrl);

    if (skillMdContent === null) {
      throw new InstallerError(
        "FETCH_FAILED",
        `Could not fetch SKILL.md from skills.sh source: ${source.locator}`,
        {
          retryable: true,
          details: {
            owner: parsed.owner,
            repo: parsed.repo,
            skillPath: parsed.skillPath,
            resolvedPrefix,
            branch,
          },
        },
      );
    }

    const files: Array<{ relativePath: string; content: string }> = [
      { relativePath: "SKILL.md", content: skillMdContent },
    ];

    // Try fetching mcp.json (optional)
    const mcpJsonUrl = `${GITHUB_RAW_BASE}/${parsed.owner}/${parsed.repo}/${branch}/${prefix}mcp.json`;
    const mcpJsonContent = await fetchText(mcpJsonUrl);
    if (mcpJsonContent !== null) {
      files.push({ relativePath: "mcp.json", content: mcpJsonContent });
    }

    // Use GitHub API to list repo contents and fetch all files
    // For multi-skill repos, scope to the resolved skill directory
    const treeFiles = await fetchRepoTree(
      parsed.owner,
      parsed.repo,
      branch,
      resolvedPrefix || undefined,
    );
    if (treeFiles.length > 0) {
      // We got the file list — fetch each file (excluding SKILL.md and mcp.json already fetched)
      const alreadyFetched = new Set(files.map((f) => f.relativePath));

      for (const filePath of treeFiles) {
        if (alreadyFetched.has(filePath)) continue;
        // Only fetch skill-relevant files (skip .git metadata, CI configs, etc.)
        if (!isSkillRelevantFile(filePath)) continue;

        // Build the raw URL: prefix + relativePath
        const fileUrl = `${GITHUB_RAW_BASE}/${parsed.owner}/${parsed.repo}/${branch}/${prefix}${filePath}`;
        const content = await fetchText(fileUrl);
        if (content !== null) {
          files.push({ relativePath: filePath, content });
        }
      }
    }

    return normalizeFetchedSkill(source, files);
  }
}

/**
 * Parsed skills.sh locator with optional subdirectory path.
 *
 * - 2-segment "owner/repo"       → { owner, repo, skillPath: undefined }
 * - 3-segment "owner/repo/skill" → { owner, repo, skillPath: "skill" }
 * - 1-segment "name"             → { owner: "anthropics", repo: name, skillPath: undefined }
 */
export interface ParsedSkillsShLocator {
  owner: string;
  repo: string;
  skillPath?: string;
}

/**
 * Parse a skills.sh locator.
 *
 * Supports:
 *   - "owner/repo"       → 2-segment, skill at repo root
 *   - "owner/repo/skill" → 3-segment, skill in subdirectory
 *   - "skills.sh:owner/repo[/skill]" → prefixed variant
 *   - "name"             → 1-segment, assumes anthropics org
 */
export function parseSkillsShLocator(locator: string): ParsedSkillsShLocator {
  const cleaned = locator.replace(/^skills\.sh:/, "");
  const parts = cleaned.split("/");

  if (parts.length >= 3) {
    // 3+ segment: owner/repo/skillPath (skillPath may contain deeper nesting)
    return {
      owner: parts[0],
      repo: parts[1],
      skillPath: parts.slice(2).join("/"),
    };
  }

  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }

  // If no owner specified, assume the skills.sh community namespace
  return { owner: "anthropics", repo: parts[0] };
}

/**
 * Create a skills.sh source reference.
 */
export function createSkillsShSource(
  ownerAndName: string,
  revision?: string,
): SkillSourceRef {
  return {
    type: "skills.sh",
    locator: ownerAndName,
    revision,
  };
}

/**
 * Try to detect default branch (main vs master).
 * When resolvedPrefix is provided, probes inside that directory.
 */
async function detectDefaultBranch(
  owner: string,
  repo: string,
  resolvedPrefix?: string,
): Promise<string> {
  const prefix = resolvedPrefix ? `${resolvedPrefix}/` : "";

  // Try "main" first since it's the modern default
  const mainUrl = `${GITHUB_RAW_BASE}/${owner}/${repo}/main/${prefix}SKILL.md`;
  const mainContent = await fetchText(mainUrl);
  if (mainContent !== null) return "main";

  // Fall back to "master"
  const masterUrl = `${GITHUB_RAW_BASE}/${owner}/${repo}/master/${prefix}SKILL.md`;
  const masterContent = await fetchText(masterUrl);
  if (masterContent !== null) return "master";

  // Default to "main" and let the actual fetch produce the error
  return "main";
}

/**
 * Detect default branch for a skill, handling the case where
 * the skill's exact in-repo prefix is not yet known.
 *
 * For 3-segment selectors, we can't efficiently probe all candidate
 * directories on both branches. Instead, we use the GitHub API to
 * check which branch exists, or fall back to probing the most common
 * candidate locations on each branch.
 */
async function detectDefaultBranchForSkill(
  parsed: ParsedSkillsShLocator,
): Promise<string> {
  if (!parsed.skillPath) {
    return detectDefaultBranch(parsed.owner, parsed.repo);
  }

  // Try "main" branch with the two most common patterns
  for (const candidate of [
    `skills/${parsed.skillPath}`,
    parsed.skillPath,
  ]) {
    const mainUrl = `${GITHUB_RAW_BASE}/${parsed.owner}/${parsed.repo}/main/${candidate}/SKILL.md`;
    const content = await fetchText(mainUrl);
    if (content !== null) return "main";
  }

  // Try "master" with the same patterns
  for (const candidate of [
    `skills/${parsed.skillPath}`,
    parsed.skillPath,
  ]) {
    const masterUrl = `${GITHUB_RAW_BASE}/${parsed.owner}/${parsed.repo}/master/${candidate}/SKILL.md`;
    const content = await fetchText(masterUrl);
    if (content !== null) return "master";
  }

  return "main";
}

/**
 * Fetch a text resource, returning null on 404 / network error.
 */
async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "skill-installer-mcp/0.1",
        Accept: "text/plain, application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Common skill directory patterns found in skills.sh repos.
 * Given a skill name "foo", these are the candidate in-repo paths
 * where SKILL.md might live (in priority order).
 */
const SKILL_DIR_CANDIDATES = [
  // Direct subdirectory (e.g., foo/SKILL.md)
  (name: string) => name,
  // Most common: skills/<name> (anthropics/skills, obra/superpowers, vercel-labs/*, etc.)
  (name: string) => `skills/${name}`,
  // Curated / experimental / system subfolders
  (name: string) => `skills/.curated/${name}`,
  (name: string) => `skills/.experimental/${name}`,
  (name: string) => `skills/.system/${name}`,
  // Agent-specific directories
  (name: string) => `.agents/skills/${name}`,
  (name: string) => `.agent/skills/${name}`,
  (name: string) => `.claude/skills/${name}`,
];

/**
 * Resolve the actual in-repo directory prefix for a skill.
 *
 * When a user provides "anthropics/skills/frontend-design", the skillPath
 * is "frontend-design" but the actual SKILL.md may be at:
 *   - skills/frontend-design/SKILL.md  (most common)
 *   - frontend-design/SKILL.md         (direct subdirectory)
 *   - .agents/skills/frontend-design/  (alternative layout)
 *
 * This function probes candidate locations and returns the resolved prefix
 * (e.g., "skills/frontend-design") or null if not found.
 *
 * For 2-segment selectors (no skillPath), returns "" (repo root).
 */
async function resolveSkillPrefix(
  owner: string,
  repo: string,
  branch: string,
  skillPath?: string,
): Promise<string | null> {
  // No skillPath means the skill is at the repo root
  if (!skillPath) {
    const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/SKILL.md`;
    const content = await fetchText(url);
    return content !== null ? "" : null;
  }

  // Try each candidate pattern
  for (const candidateFn of SKILL_DIR_CANDIDATES) {
    const candidate = candidateFn(skillPath);
    const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${candidate}/SKILL.md`;
    const content = await fetchText(url);
    if (content !== null) {
      return candidate;
    }
  }

  // Last resort: scan the repo tree for a SKILL.md in a directory matching the skill name
  const tree = await fetchRawRepoTree(owner, repo, branch);
  if (tree.length > 0) {
    const skillDirName = skillPath.includes("/")
      ? skillPath.split("/").pop()!
      : skillPath;
    const suffix = `/${skillDirName}/SKILL.md`;
    const match = tree.find((entry) => entry.endsWith(suffix) || entry === `${skillDirName}/SKILL.md`);
    if (match) {
      // Return the directory portion (strip /SKILL.md)
      return match.slice(0, -"/SKILL.md".length);
    }
  }

  return null;
}

/**
 * Fetch the raw repo tree (all blob paths). Used as a fallback for skill discovery.
 */
async function fetchRawRepoTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<string[]> {
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "skill-installer-mcp/0.1",
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as {
      tree?: Array<{ path: string; type: string }>;
    };

    if (!data.tree) return [];

    return data.tree
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path);
  } catch {
    return [];
  }
}

/**
 * Try to get the repo file tree via GitHub API.
 * When skillPath is provided, only returns files within that subdirectory,
 * with paths relative to the subdirectory (not the repo root).
 * Returns relative file paths or empty array on failure.
 */
async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  skillPath?: string,
): Promise<string[]> {
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "skill-installer-mcp/0.1",
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as {
      tree?: Array<{ path: string; type: string }>;
    };

    if (!data.tree) return [];

    let blobs = data.tree.filter((entry) => entry.type === "blob");

    if (skillPath) {
      // Scope to the skill's subdirectory and make paths relative
      const prefix = skillPath + "/";
      blobs = blobs.filter((entry) => entry.path.startsWith(prefix));
      return blobs.map((entry) => entry.path.slice(prefix.length));
    }

    return blobs.map((entry) => entry.path);
  } catch {
    return [];
  }
}

/**
 * Determine if a file path is relevant to the skill bundle.
 * Excludes CI configs, license boilerplate at root, etc.
 */
function isSkillRelevantFile(filePath: string): boolean {
  // Include skill-standard directories
  if (
    filePath.startsWith("scripts/") ||
    filePath.startsWith("references/") ||
    filePath.startsWith("assets/")
  ) {
    return true;
  }

  // Include root-level important files
  const rootFiles = ["SKILL.md", "mcp.json", "README.md"];
  if (rootFiles.includes(filePath)) return true;

  // Exclude hidden files and common non-skill files
  if (filePath.startsWith(".")) return false;
  if (filePath.includes("/.")) return false;
  if (
    filePath === "LICENSE" ||
    filePath === "LICENSE.md" ||
    filePath === "CHANGELOG.md"
  )
    return false;
  if (filePath.startsWith("test/") || filePath.startsWith("tests/"))
    return false;
  if (filePath.startsWith("node_modules/")) return false;

  // Include everything else that might be part of the skill
  return true;
}

export function createSkillsShSourceInstance(): SkillsShSource {
  return new SkillsShSourceImpl();
}

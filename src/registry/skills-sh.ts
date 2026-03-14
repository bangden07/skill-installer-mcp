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
 * Selector format: skills.sh:<owner>/<name>
 * Locator stored as: <owner>/<name>
 *
 * The skills.sh ecosystem stores skills as GitHub repos or
 * GitHub directories following the Agent Skills / SKILL.md convention.
 *
 * Resolution strategy:
 * 1. Try https://raw.githubusercontent.com/<owner>/<name>/main/SKILL.md
 * 2. Fall back to https://raw.githubusercontent.com/<owner>/<name>/master/SKILL.md
 * 3. If revision specified, use that branch directly
 */

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com";

/** Standard skill directories to try fetching */
const KNOWN_SKILL_FILES = [
  "SKILL.md",
  "scripts/",
  "references/",
  "assets/",
  "mcp.json",
];

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
    const { owner, name } = parseSkillsShLocator(source.locator);
    const branch = source.revision ?? (await detectDefaultBranch(owner, name));

    const skillMdUrl = `${GITHUB_RAW_BASE}/${owner}/${name}/${branch}/SKILL.md`;
    const content = await fetchText(skillMdUrl);

    if (content === null) {
      throw new InstallerError(
        "FETCH_FAILED",
        `Could not fetch SKILL.md from skills.sh source: ${source.locator} (tried branch: ${branch})`,
        { retryable: true, details: { owner, name, branch } },
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
    const { owner, name } = parseSkillsShLocator(source.locator);
    const branch = source.revision ?? (await detectDefaultBranch(owner, name));

    // Fetch SKILL.md (required)
    const skillMdUrl = `${GITHUB_RAW_BASE}/${owner}/${name}/${branch}/SKILL.md`;
    const skillMdContent = await fetchText(skillMdUrl);

    if (skillMdContent === null) {
      throw new InstallerError(
        "FETCH_FAILED",
        `Could not fetch SKILL.md from skills.sh source: ${source.locator}`,
        { retryable: true, details: { owner, name, branch } },
      );
    }

    const files: Array<{ relativePath: string; content: string }> = [
      { relativePath: "SKILL.md", content: skillMdContent },
    ];

    // Try fetching mcp.json (optional)
    const mcpJsonUrl = `${GITHUB_RAW_BASE}/${owner}/${name}/${branch}/mcp.json`;
    const mcpJsonContent = await fetchText(mcpJsonUrl);
    if (mcpJsonContent !== null) {
      files.push({ relativePath: "mcp.json", content: mcpJsonContent });
    }

    // Use GitHub API to list repo contents and fetch all files
    // For MVP, we use a pragmatic approach: fetch known skill file patterns
    // and attempt to list via the GitHub Trees API
    const treeFiles = await fetchRepoTree(owner, name, branch);
    if (treeFiles.length > 0) {
      // We got the full tree — fetch each file (excluding SKILL.md and mcp.json already fetched)
      const alreadyFetched = new Set(files.map((f) => f.relativePath));

      for (const filePath of treeFiles) {
        if (alreadyFetched.has(filePath)) continue;
        // Only fetch skill-relevant files (skip .git metadata, CI configs, etc.)
        if (!isSkillRelevantFile(filePath)) continue;

        const fileUrl = `${GITHUB_RAW_BASE}/${owner}/${name}/${branch}/${filePath}`;
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
 * Parse a skills.sh locator: "owner/name" or just "name" (assumes skills-sh org).
 */
export function parseSkillsShLocator(locator: string): {
  owner: string;
  name: string;
} {
  const cleaned = locator.replace(/^skills\.sh:/, "");
  const parts = cleaned.split("/");

  if (parts.length >= 2) {
    return { owner: parts[0], name: parts.slice(1).join("/") };
  }

  // If no owner specified, assume the skills.sh community namespace
  return { owner: "anthropics", name: parts[0] };
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
 */
async function detectDefaultBranch(
  owner: string,
  name: string,
): Promise<string> {
  // Try "main" first since it's the modern default
  const mainUrl = `${GITHUB_RAW_BASE}/${owner}/${name}/main/SKILL.md`;
  const mainContent = await fetchText(mainUrl);
  if (mainContent !== null) return "main";

  // Fall back to "master"
  const masterUrl = `${GITHUB_RAW_BASE}/${owner}/${name}/master/SKILL.md`;
  const masterContent = await fetchText(masterUrl);
  if (masterContent !== null) return "master";

  // Default to "main" and let the actual fetch produce the error
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
 * Try to get the repo file tree via GitHub API.
 * Returns relative file paths or empty array on failure.
 */
async function fetchRepoTree(
  owner: string,
  name: string,
  branch: string,
): Promise<string[]> {
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`;
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

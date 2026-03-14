import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { toPosixRelativePath } from "./fs.js";

export const DEFAULT_IGNORED_BASENAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
]);

export interface ComputeDirectoryHashOptions {
  ignore?: (relativePath: string) => boolean;
}

export async function computeTextHash(content: string): Promise<string> {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

export async function computeFileHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

export async function computeDirectoryHash(
  rootDir: string,
  options?: ComputeDirectoryHashOptions,
): Promise<string> {
  const entries: HashEntry[] = [];
  await walkDirectory(rootDir, rootDir, entries, options?.ignore);

  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const hash = createHash("sha256");

  for (const entry of entries) {
    if (entry.type === "file") {
      hash.update(`file:${entry.relativePath}\n`, "utf8");
      hash.update(entry.content);
      hash.update("\n", "utf8");
      continue;
    }

    hash.update(
      `symlink:${entry.relativePath}->${entry.linkTarget ?? ""}\n`,
      "utf8",
    );
  }

  return `sha256:${hash.digest("hex")}`;
}

export async function safeComputeDirectoryHash(
  rootDir: string,
  options?: ComputeDirectoryHashOptions,
): Promise<string | null> {
  try {
    return await computeDirectoryHash(rootDir, options);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export function shouldIgnoreRelativePath(relativePath: string): boolean {
  const basename = path.posix.basename(relativePath);
  return DEFAULT_IGNORED_BASENAMES.has(basename);
}

type HashEntry =
  | {
      type: "file";
      relativePath: string;
      content: Buffer;
    }
  | {
      type: "symlink";
      relativePath: string;
      linkTarget: string;
    };

async function walkDirectory(
  rootDir: string,
  currentDir: string,
  output: HashEntry[],
  ignore?: (relativePath: string) => boolean,
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = toPosixRelativePath(rootDir, absolutePath);

    if ((ignore && ignore(relativePath)) || shouldIgnoreRelativePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkDirectory(rootDir, absolutePath, output, ignore);
      continue;
    }

    if (entry.isSymbolicLink()) {
      const linkTarget = await fs.readlink(absolutePath);
      output.push({
        type: "symlink",
        relativePath,
        linkTarget,
      });
      continue;
    }

    if (entry.isFile()) {
      const content = await fs.readFile(absolutePath);
      output.push({
        type: "file",
        relativePath,
        content,
      });
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ENOENT"
  );
}

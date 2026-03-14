import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureParentDir(targetPath: string): Promise<void> {
  await ensureDir(path.dirname(targetPath));
}

export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function isSymlink(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(targetPath);
    return stat.isSymbolicLink();
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function realpathSafe(targetPath: string): Promise<string | null> {
  try {
    return await fs.realpath(targetPath);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, content, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readText(filePath);
  return JSON.parse(raw) as T;
}

export async function writeTextAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  await ensureParentDir(filePath);

  const tempPath = `${filePath}.tmp-${randomUUID()}`;
  try {
    await fs.writeFile(tempPath, content, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await removePathIfExists(tempPath);
    throw error;
  }
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeTextAtomic(filePath, content);
}

export async function renamePath(
  fromPath: string,
  toPath: string,
): Promise<void> {
  await ensureParentDir(toPath);
  await fs.rename(fromPath, toPath);
}

export async function removePathIfExists(targetPath: string): Promise<void> {
  await fs.rm(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 50,
  });
}

export async function removeDir(dirPath: string): Promise<void> {
  await removePathIfExists(dirPath);
}

export async function copyDirectory(
  sourceDir: string,
  targetDir: string,
): Promise<void> {
  await ensureParentDir(targetDir);
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    preserveTimestamps: true,
  });
}

export async function createSymlink(
  sourceDir: string,
  targetDir: string,
): Promise<void> {
  await ensureParentDir(targetDir);

  const linkType = process.platform === "win32" ? "junction" : "dir";
  const sourceForLink =
    process.platform === "win32" ? path.resolve(sourceDir) : sourceDir;

  await fs.symlink(sourceForLink, targetDir, linkType);
}

export async function makeTempDirNear(
  parentDir: string,
  prefix: string,
): Promise<string> {
  await ensureDir(parentDir);
  return fs.mkdtemp(path.join(parentDir, prefix));
}

export async function listRelativeFiles(rootDir: string): Promise<string[]> {
  const output: string[] = [];
  await walkFiles(rootDir, rootDir, output);
  output.sort();
  return output;
}

async function walkFiles(
  rootDir: string,
  currentDir: string,
  output: string[],
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkFiles(rootDir, absolutePath, output);
      continue;
    }

    if (entry.isFile() || entry.isSymbolicLink()) {
      output.push(toPosixRelativePath(rootDir, absolutePath));
    }
  }
}

export function toPosixRelativePath(
  rootDir: string,
  targetPath: string,
): string {
  return path.relative(rootDir, targetPath).split(path.sep).join("/");
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ENOENT"
  );
}

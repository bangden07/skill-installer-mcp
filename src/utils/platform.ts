import os from "node:os";
import path from "node:path";
import { createSymlink, ensureDir, makeTempDirNear, removePathIfExists } from "./fs.js";

export interface SymlinkSupportResult {
  supported: boolean;
  reason?: string;
}

export function getPlatform(): NodeJS.Platform {
  return process.platform;
}

export function getHomeDir(): string {
  return os.homedir();
}

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function isPosix(): boolean {
  return !isWindows();
}

export async function checkSymlinkSupport(
  baseDir?: string,
): Promise<SymlinkSupportResult> {
  if (!isWindows()) {
    return { supported: true };
  }

  const probeRoot = baseDir ?? path.join(getHomeDir(), ".skill-installer", "tmp");
  await ensureDir(probeRoot);

  const tempDir = await makeTempDirNear(probeRoot, "symlink-probe-");
  const sourceDir = path.join(tempDir, "source");
  const targetDir = path.join(tempDir, "target");

  try {
    await ensureDir(sourceDir);
    await createSymlink(sourceDir, targetDir);

    return { supported: true };
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "Unknown symlink support failure";

    return {
      supported: false,
      reason,
    };
  } finally {
    await removePathIfExists(tempDir);
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import type { ExecutionContext, Scope } from "../domain/types.js";
import { InstallerError } from "../domain/errors.js";
import { ensureDir, pathExists, removePathIfExists } from "../utils/fs.js";

export interface LockHandle {
  name: string;
  scope: Scope;
  lockPath: string;
  acquiredAt: string;
}

export interface LockMetadata {
  name: string;
  scope: Scope;
  acquiredAt: string;
  pid: number;
  workspaceRoot?: string;
}

export interface LockStore {
  getLocksDir(ctx: ExecutionContext, scope: Scope): string;
  getLockPath(ctx: ExecutionContext, scope: Scope, name: string): string;
  acquire(ctx: ExecutionContext, scope: Scope, name: string): Promise<LockHandle>;
  release(handle: LockHandle): Promise<void>;
  isLocked(ctx: ExecutionContext, scope: Scope, name: string): Promise<boolean>;
  readMetadata(
    ctx: ExecutionContext,
    scope: Scope,
    name: string,
  ): Promise<LockMetadata | null>;
}

export class LockStoreImpl implements LockStore {
  getLocksDir(ctx: ExecutionContext, scope: Scope): string {
    if (scope === "project") {
      if (!ctx.workspaceRoot) {
        throw new Error("workspaceRoot is required for project lock store.");
      }

      return path.join(ctx.workspaceRoot, ".skill-installer", "locks");
    }

    return path.join(ctx.homeDir, ".config", "skill-installer", "locks");
  }

  getLockPath(ctx: ExecutionContext, scope: Scope, name: string): string {
    return path.join(this.getLocksDir(ctx, scope), `${name}.lock`);
  }

  async acquire(
    ctx: ExecutionContext,
    scope: Scope,
    name: string,
  ): Promise<LockHandle> {
    const locksDir = this.getLocksDir(ctx, scope);
    const lockPath = this.getLockPath(ctx, scope, name);

    await ensureDir(locksDir);

    const metadata: LockMetadata = {
      name,
      scope,
      acquiredAt: ctx.nowIso,
      pid: process.pid,
      workspaceRoot: scope === "project" ? ctx.workspaceRoot : undefined,
    };

    try {
      const fileHandle = await fs.open(lockPath, "wx");

      try {
        await fileHandle.writeFile(`${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      } finally {
        await fileHandle.close();
      }
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        const existing = await this.readMetadata(ctx, scope, name);
        throw new InstallerError(
          "LOCK_ACQUISITION_FAILED",
          `Lock '${name}' is already held.`,
          {
            retryable: true,
            details: existing ? { existing } : undefined,
            cause: error,
          },
        );
      }

      throw error;
    }

    return {
      name,
      scope,
      lockPath,
      acquiredAt: ctx.nowIso,
    };
  }

  async release(handle: LockHandle): Promise<void> {
    await removePathIfExists(handle.lockPath);
  }

  async isLocked(
    ctx: ExecutionContext,
    scope: Scope,
    name: string,
  ): Promise<boolean> {
    return pathExists(this.getLockPath(ctx, scope, name));
  }

  async readMetadata(
    ctx: ExecutionContext,
    scope: Scope,
    name: string,
  ): Promise<LockMetadata | null> {
    const lockPath = this.getLockPath(ctx, scope, name);

    if (!(await pathExists(lockPath))) {
      return null;
    }

    try {
      return await readLockMetadata(lockPath);
    } catch {
      return null;
    }
  }
}

async function readLockMetadata(lockPath: string): Promise<LockMetadata> {
  const raw = await fs.readFile(lockPath, "utf8");
  return JSON.parse(raw) as LockMetadata;
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "EEXIST"
  );
}

export function createLockStore(): LockStore {
  return new LockStoreImpl();
}

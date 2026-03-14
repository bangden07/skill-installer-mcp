import path from "node:path";
import type { AdapterContext } from "../../domain/types.js";
import { InstallerError } from "../../domain/errors.js";

export function requireWorkspaceRoot(ctx: AdapterContext): string {
  if (!ctx.workspaceRoot) {
    throw new InstallerError(
      "WORKSPACE_ROOT_REQUIRED",
      "workspaceRoot is required for project-scope operations.",
    );
  }

  return ctx.workspaceRoot;
}

export function homePath(ctx: AdapterContext, ...parts: string[]): string {
  return path.join(ctx.homeDir, ...parts);
}

export function workspacePath(ctx: AdapterContext, ...parts: string[]): string {
  return path.join(requireWorkspaceRoot(ctx), ...parts);
}

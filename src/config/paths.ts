import path from "node:path";
import type { ExecutionContext, Scope } from "../domain/types.js";

export function requireWorkspaceRoot(ctx: ExecutionContext): string {
  if (!ctx.workspaceRoot) {
    throw new Error("workspaceRoot is required for project scope operations.");
  }

  return ctx.workspaceRoot;
}

export function getCanonicalRoot(ctx: ExecutionContext, scope: Scope): string {
  if (scope === "project") {
    return path.join(requireWorkspaceRoot(ctx), ".agents", "skills");
  }

  return path.join(ctx.homeDir, ".agents", "skills");
}

export function getStateRoot(ctx: ExecutionContext, scope: Scope): string {
  if (scope === "project") {
    return path.join(requireWorkspaceRoot(ctx), ".skill-installer", "state");
  }

  return path.join(ctx.homeDir, ".config", "skill-installer", "state");
}

export function getPlansRoot(ctx: ExecutionContext, scope: Scope): string {
  return path.join(getStateRoot(ctx, scope), "plans");
}

export function getLocksRoot(ctx: ExecutionContext, scope: Scope): string {
  if (scope === "project") {
    return path.join(requireWorkspaceRoot(ctx), ".skill-installer", "locks");
  }

  return path.join(ctx.homeDir, ".config", "skill-installer", "locks");
}

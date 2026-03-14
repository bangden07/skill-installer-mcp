import path from "node:path";
import type { ExecutionContext, Scope } from "../domain/types.js";
import { ensureDir, pathExists, readJson, removePathIfExists, writeJsonAtomic } from "../utils/fs.js";

export interface StoredInstallPlan {
  planFingerprint: string;
  createdAt: string;
  workspaceRoot?: string;
  scope: Scope;
  requestedSkills: string[];
  agents: string[];
  modeRequested: string;
  modeResolved: string;
  payload: Record<string, unknown>;
}

export interface PlanStore {
  getPlansDir(ctx: ExecutionContext, scope: Scope): string;
  getPlanPath(ctx: ExecutionContext, scope: Scope, fingerprint: string): string;
  put(ctx: ExecutionContext, plan: StoredInstallPlan): Promise<void>;
  get(
    ctx: ExecutionContext,
    scope: Scope,
    fingerprint: string,
  ): Promise<StoredInstallPlan | null>;
  remove(ctx: ExecutionContext, scope: Scope, fingerprint: string): Promise<void>;
}

export class PlanStoreImpl implements PlanStore {
  getPlansDir(ctx: ExecutionContext, scope: Scope): string {
    if (scope === "project") {
      if (!ctx.workspaceRoot) {
        throw new Error("workspaceRoot is required for project plan store.");
      }

      return path.join(ctx.workspaceRoot, ".skill-installer", "state", "plans");
    }

    return path.join(ctx.homeDir, ".config", "skill-installer", "state", "plans");
  }

  getPlanPath(ctx: ExecutionContext, scope: Scope, fingerprint: string): string {
    return path.join(this.getPlansDir(ctx, scope), `${fingerprint}.json`);
  }

  async put(ctx: ExecutionContext, plan: StoredInstallPlan): Promise<void> {
    const plansDir = this.getPlansDir(ctx, plan.scope);
    const planPath = this.getPlanPath(ctx, plan.scope, plan.planFingerprint);

    await ensureDir(plansDir);
    await writeJsonAtomic(planPath, plan);
  }

  async get(
    ctx: ExecutionContext,
    scope: Scope,
    fingerprint: string,
  ): Promise<StoredInstallPlan | null> {
    const planPath = this.getPlanPath(ctx, scope, fingerprint);

    if (!(await pathExists(planPath))) {
      return null;
    }

    return readJson<StoredInstallPlan>(planPath);
  }

  async remove(ctx: ExecutionContext, scope: Scope, fingerprint: string): Promise<void> {
    const planPath = this.getPlanPath(ctx, scope, fingerprint);
    await removePathIfExists(planPath);
  }
}

export function createPlanStore(): PlanStore {
  return new PlanStoreImpl();
}

import { z } from "zod";
import type { AgentId, Scope } from "../../domain/types.js";
import {
  PlanSkillInstallInputSchema,
  PlanSkillInstallOutputDataSchema,
  type PlanSkillInstallInput,
} from "../../schema/tools.js";
import {
  assertPlanStillMatchesInput,
  autoDetectCompatibleAgents,
  buildExecutionContext,
  buildPlanSummary,
  computePlanFingerprint,
  formatPathForDisplay,
  getAdapterOrThrow,
  normalizeSkillSelector,
  normalizeSkillSelection,
  summarizeResolvedModes,
  type InstallerDeps,
} from "./helpers.js";

export type PlanSkillInstallOutputData = z.infer<typeof PlanSkillInstallOutputDataSchema>;

export async function planSkillInstall(
  rawInput: PlanSkillInstallInput,
  deps: InstallerDeps,
): Promise<PlanSkillInstallOutputData> {
  const input = PlanSkillInstallInputSchema.parse(rawInput);
  const ctx = buildExecutionContext({ workspacePath: input.workspacePath });
  const scope: Scope = input.scope ?? "project";
  const requestedAgents = input.agents ?? await autoDetectCompatibleAgents(ctx, deps.adapterRegistry, scope);

  const normalizedSkills = await Promise.all(
    input.skills.map((selector) => normalizeSkillSelection(ctx, deps, selector, scope, "metadata")),
  );

  const canonicalActions: PlanSkillInstallOutputData["canonicalActions"] = [];
  const targetActions: PlanSkillInstallOutputData["targetActions"] = [];
  const resolvedModes: Array<"direct" | "symlink" | "copy"> = [];

  for (const item of normalizedSkills) {
    const existing = await deps.manifestStore.getSkill(ctx, item.skill.name, scope);

    canonicalActions.push({
      skillName: item.skill.name,
      action: existing ? "update" : "install",
      canonicalPath: formatPathForDisplay(ctx, scope, item.skill.canonicalDir),
      source: item.source,
    });

    for (const agentId of requestedAgents) {
      const adapter = getAdapterOrThrow(deps.adapterRegistry, agentId);
      const capabilities = await adapter.getCapabilities(ctx);

      if ((scope === "project" && !capabilities.supportsProjectScope) || (scope === "global" && !capabilities.supportsGlobalScope)) {
        targetActions.push({
          skillName: item.skill.name,
          agentId,
          action: "skip",
          targetPath: "",
          status: "manual_required",
          notes: [`Agent '${agentId}' does not support ${scope} scope.`],
        });
        continue;
      }

      const plan = await adapter.planInstall(ctx, {
        skill: item.skill,
        scope,
        requestedMode: input.mode ?? "auto",
      });

      resolvedModes.push(plan.mode);
      targetActions.push({
        skillName: plan.skillName,
        agentId: plan.agentId,
        action: plan.action,
        targetPath: formatPathForDisplay(ctx, scope, plan.targetDir),
        status: plan.status,
        notes: plan.notes,
      });
    }
  }

  const modeResolved = summarizeResolvedModes(resolvedModes);
  const result: PlanSkillInstallOutputData = {
    planFingerprint: computePlanFingerprint({
      workspaceRoot: ctx.workspaceRoot,
      scope,
      mode: input.mode ?? "auto",
      skills: normalizedSkills.map((item) => item.skill.name),
      agents: requestedAgents,
      canonicalActions,
      targetActions,
    }),
    scope,
    modeResolved,
    canonicalActions,
    targetActions,
    summary: buildPlanSummary({
      skillsCount: normalizedSkills.length,
      targetActions,
    }),
  };

  await deps.planStore.put(ctx, {
    planFingerprint: result.planFingerprint,
    createdAt: ctx.nowIso,
    workspaceRoot: ctx.workspaceRoot,
    scope,
    requestedSkills: normalizedSkills.map((item) => normalizeSkillSelector(item.selector)),
    agents: requestedAgents,
    modeRequested: input.mode ?? "auto",
    modeResolved,
    payload: result as unknown as Record<string, unknown>,
  });

  return result;
}

export { assertPlanStillMatchesInput };

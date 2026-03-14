import { z } from "zod";
import type { AgentId, Scope } from "../../domain/types.js";
import {
  SyncSkillsInputSchema,
  SyncSkillsOutputDataSchema,
  type SyncSkillsInput,
} from "../../schema/tools.js";
import {
  buildExecutionContext,
  getAdapterOrThrow,
  normalizeScopeSelection,
  normalizeTargetError,
  resolveStoredPath,
  type InstallerDeps,
} from "./helpers.js";

export type SyncSkillsOutputData = z.infer<typeof SyncSkillsOutputDataSchema>;

export async function syncSkills(
  rawInput: SyncSkillsInput,
  deps: InstallerDeps,
): Promise<SyncSkillsOutputData> {
  const input = SyncSkillsInputSchema.parse(rawInput);
  const ctx = buildExecutionContext({ workspacePath: input.workspacePath });
  const scopes = normalizeScopeSelection(input.scope);

  const repaired: SyncSkillsOutputData["repaired"] = [];
  const unchanged: SyncSkillsOutputData["unchanged"] = [];
  const failed: SyncSkillsOutputData["failed"] = [];
  let checked = 0;

  for (const scope of scopes) {
    const tracked = await deps.manifestStore.listSkills(ctx, scope, input.skills);

    for (const trackedSkill of tracked) {
      const skill = await deps.canonicalStore.loadInstalledSkillRecord(ctx, trackedSkill.name, scope);

      for (const target of trackedSkill.targets) {
        if (target.scope !== scope) {
          continue;
        }

        if (input.agents && !input.agents.includes(target.agentId)) {
          continue;
        }

        checked += 1;

        const adapter = getAdapterOrThrow(deps.adapterRegistry, target.agentId);
        const targetPath = resolveStoredPath(ctx, scope, target.targetPath);

        try {
          const verify = await adapter.verifyInstall(ctx, {
            skill,
            scope,
            targetDir: targetPath,
            expectedMode: target.mode,
          });

          if (verify.ok) {
            unchanged.push({
              skillName: trackedSkill.name,
              agentId: target.agentId,
            });

            await deps.manifestStore.updateTargetStatus(ctx, {
              scope,
              skillName: trackedSkill.name,
              agentId: target.agentId,
              status: verify.status,
              targetPath,
              lastVerifiedAt: verify.checkedAt,
            });
            continue;
          }

          if (input.repairBroken === false) {
            failed.push({
              skillName: trackedSkill.name,
              agentId: target.agentId,
              code: verify.issues[0]?.code ?? "VERIFY_FAILED",
              message: verify.issues[0]?.message ?? "Skill target verification failed.",
            });
            continue;
          }

          const sync = await adapter.syncInstall(ctx, {
            skill,
            scope,
          });

          if (sync.action === "unchanged") {
            unchanged.push({
              skillName: trackedSkill.name,
              agentId: target.agentId,
            });
          } else if (sync.action === "manual_required") {
            failed.push({
              skillName: trackedSkill.name,
              agentId: target.agentId,
              code: "MANUAL_RUNTIME_VALIDATION_RECOMMENDED",
              message: "Target requires manual validation and could not be auto-repaired.",
            });
          } else {
            repaired.push({
              skillName: trackedSkill.name,
              agentId: target.agentId,
              action: sync.action === "relinked" ? "relinked" : "recopied",
              path: sync.targetDir,
            });
          }

          await deps.manifestStore.updateTargetStatus(ctx, {
            scope,
            skillName: trackedSkill.name,
            agentId: target.agentId,
            status: sync.status,
            targetPath: sync.targetDir,
            lastSyncAt: ctx.nowIso,
          });
        } catch (error) {
          failed.push(normalizeTargetError(trackedSkill.name, target.agentId as AgentId, error));
        }
      }
    }
  }

  return {
    checked,
    repaired,
    unchanged,
    failed,
  };
}

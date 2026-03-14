import { z } from "zod";
import {
  RemoveSkillsInputSchema,
  RemoveSkillsOutputDataSchema,
  type RemoveSkillsInput,
} from "../../schema/tools.js";
import {
  buildExecutionContext,
  getAdapterOrThrow,
  normalizeScopeSelection,
  normalizeTargetError,
  resolveStoredPath,
  type InstallerDeps,
} from "./helpers.js";

export type RemoveSkillsOutputData = z.infer<typeof RemoveSkillsOutputDataSchema>;

export async function removeSkills(
  rawInput: RemoveSkillsInput,
  deps: InstallerDeps,
): Promise<RemoveSkillsOutputData> {
  const input = RemoveSkillsInputSchema.parse(rawInput);
  const ctx = buildExecutionContext({ workspacePath: input.workspacePath });
  const scopes = normalizeScopeSelection(input.scope);

  const removedTargets: RemoveSkillsOutputData["removedTargets"] = [];
  const purgedCanonical: RemoveSkillsOutputData["purgedCanonical"] = [];
  const failed: RemoveSkillsOutputData["failed"] = [];

  for (const scope of scopes) {
    for (const skillName of input.skills) {
      const tracked = await deps.manifestStore.getSkill(ctx, skillName, scope);
      if (!tracked) {
        continue;
      }

      for (const target of tracked.targets) {
        if (target.scope !== scope) {
          continue;
        }

        if (input.agents && !input.agents.includes(target.agentId)) {
          continue;
        }

        const adapter = getAdapterOrThrow(deps.adapterRegistry, target.agentId);
        const targetPath = resolveStoredPath(ctx, scope, target.targetPath);

        try {
          const removed = await adapter.removeInstall(ctx, {
            skillName,
            scope,
            targetDir: targetPath,
          });

          if (removed.removed) {
            removedTargets.push({
              skillName,
              agentId: target.agentId,
              path: removed.targetDir,
            });
          }

          await deps.manifestStore.removeTarget(ctx, {
            skillName,
            agentId: target.agentId,
            scope,
          });
        } catch (error) {
          failed.push(normalizeTargetError(skillName, target.agentId, error));
        }
      }

      if (input.purgeCanonical) {
        try {
          await deps.canonicalStore.removeSkill(ctx, skillName, scope);
          await deps.manifestStore.removeSkill(ctx, skillName, scope);
          purgedCanonical.push(skillName);
        } catch (error) {
          const normalized = normalizeTargetError(skillName, tracked.targets[0]?.agentId ?? "cursor", error);
          failed.push({
            skillName,
            code: normalized.code,
            message: normalized.message,
          });
        }
      }
    }
  }

  return {
    removedTargets,
    purgedCanonical,
    failed,
  };
}

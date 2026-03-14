import { z } from "zod";
import type { AgentId, ManifestTargetEntry, Scope } from "../../domain/types.js";
import {
  InstallSkillsInputSchema,
  InstallSkillsOutputDataSchema,
  type InstallSkillsInput,
} from "../../schema/tools.js";
import {
  assertPlanStillMatchesInput,
  autoDetectCompatibleAgents,
  buildExecutionContext,
  formatPathForDisplay,
  getAdapterOrThrow,
  normalizeSkillError,
  normalizeSkillSelection,
  normalizeTargetError,
  summarizeInstallResult,
  summarizeResolvedModes,
  type InstallerDeps,
} from "./helpers.js";

export type InstallSkillsOutputData = z.infer<typeof InstallSkillsOutputDataSchema>;

export async function installSkills(
  rawInput: InstallSkillsInput,
  deps: InstallerDeps,
): Promise<InstallSkillsOutputData> {
  const input = InstallSkillsInputSchema.parse(rawInput);
  const ctx = buildExecutionContext({ workspacePath: input.workspacePath });
  const scope: Scope = input.scope ?? "project";
  const requestedAgents = input.agents ?? await autoDetectCompatibleAgents(ctx, deps.adapterRegistry, scope);
  const lock = await deps.lockStore.acquire(ctx, scope, "install");

  try {
    if (input.expectedPlanFingerprint) {
      const storedPlan = await deps.planStore.get(ctx, scope, input.expectedPlanFingerprint);
      if (!storedPlan) {
        throw new Error(`Plan '${input.expectedPlanFingerprint}' not found.`);
      }

      assertPlanStillMatchesInput(storedPlan, {
        skills: input.skills,
        agents: input.agents,
        scope,
        mode: input.mode,
      });
    }

    const installed: InstallSkillsOutputData["installed"] = [];
    const skipped: InstallSkillsOutputData["skipped"] = [];
    const failed: InstallSkillsOutputData["failed"] = [];
    const manifestMutations: Array<{
      skill: Awaited<ReturnType<typeof normalizeSkillSelection>>["skill"];
      scope: Scope;
      canonical: { path: string; contentHash: string };
      targets: ManifestTargetEntry[];
      lastPlanFingerprint?: string;
    }> = [];
    const resolvedModes: Array<"direct" | "symlink" | "copy"> = [];

    for (const selector of input.skills) {
      try {
        const normalized = await normalizeSkillSelection(ctx, deps, selector, scope, "full");
        const canonicalResult = await deps.canonicalStore.installSkill(ctx, {
          skill: normalized.skill,
          fetched: normalized.fetched,
          scope,
        });

        const installedSkill = {
          ...normalized.skill,
          canonicalDir: canonicalResult.canonicalDir,
          canonicalSkillFile: canonicalResult.canonicalSkillFile,
          contentHash: canonicalResult.contentHash,
          features: canonicalResult.features,
        };

        installed.push({
          skillName: installedSkill.name,
          agentId: "canonical",
          path: formatPathForDisplay(ctx, scope, canonicalResult.canonicalDir),
          action: canonicalResult.updated ? "updated" : "installed",
          status: "installed",
        });

        const targetEntries: ManifestTargetEntry[] = [];

        for (const agentId of requestedAgents) {
          const adapter = getAdapterOrThrow(deps.adapterRegistry, agentId);
          const capabilities = await adapter.getCapabilities(ctx);

          if ((scope === "project" && !capabilities.supportsProjectScope) || (scope === "global" && !capabilities.supportsGlobalScope)) {
            skipped.push({
              skillName: installedSkill.name,
              reason: `Agent '${agentId}' does not support ${scope} scope.`,
            });
            continue;
          }

          try {
            const resolved = await adapter.resolveTarget(ctx, {
              skill: installedSkill,
              scope,
              requestedMode: input.mode ?? "auto",
            });

            const applied = await adapter.applyInstall(ctx, {
              skill: installedSkill,
              resolved,
            });

            const verified = await adapter.verifyInstall(ctx, {
              skill: installedSkill,
              scope,
              expectedMode: applied.mode,
              targetDir: applied.targetDir,
            });

            if (!verified.ok) {
              failed.push({
                skillName: installedSkill.name,
                agentId,
                code: "VERIFY_FAILED",
                message: `Install applied but verification failed for ${agentId}.`,
              });
              continue;
            }

            resolvedModes.push(applied.mode);

            installed.push({
              skillName: installedSkill.name,
              agentId,
              path: formatPathForDisplay(ctx, scope, applied.targetDir),
              action: applied.action,
              status: applied.status,
            });

            targetEntries.push({
              agentId: agentId as AgentId,
              scope,
              mode: applied.mode,
              targetPath: applied.targetDir,
              status: verified.status,
              lastVerifiedAt: verified.checkedAt,
              lastSyncAt: verified.checkedAt,
            });
          } catch (error) {
            failed.push(normalizeTargetError(installedSkill.name, agentId, error));
          }
        }

        manifestMutations.push({
          skill: installedSkill,
          scope,
          canonical: {
            path: installedSkill.canonicalDir,
            contentHash: installedSkill.contentHash,
          },
          targets: targetEntries,
          lastPlanFingerprint: input.expectedPlanFingerprint,
        });
      } catch (error) {
        failed.push(normalizeSkillError(selector, error));
      }
    }

    await deps.manifestStore.upsertMany(ctx, manifestMutations);

    return {
      scope,
      modeResolved: summarizeResolvedModes(resolvedModes) as InstallSkillsOutputData["modeResolved"],
      installed,
      skipped,
      failed,
      manifestUpdated: manifestMutations.length > 0,
    };
  } finally {
    await deps.lockStore.release(lock);
  }
}

export function getInstallResultStatus(output: InstallSkillsOutputData) {
  return summarizeInstallResult(output.failed.length, output.installed.length);
}

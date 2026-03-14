import { z } from "zod";
import { ensureInstallerError } from "../../domain/errors.js";
import type { ManifestTargetEntry, RequestedInstallMode, Scope } from "../../domain/types.js";
import {
  UpdateSkillsInputSchema,
  UpdateSkillsOutputDataSchema,
  type UpdateSkillsInput,
} from "../../schema/tools.js";
import {
  buildExecutionContext,
  createSkillRecordFromFetched,
  getAdapterOrThrow,
  normalizeScopeSelection,
  normalizeTargetError,
  resolveStoredPath,
  type InstallerDeps,
} from "./helpers.js";

export type UpdateSkillsOutputData = z.infer<typeof UpdateSkillsOutputDataSchema>;

export async function updateSkills(
  rawInput: UpdateSkillsInput,
  deps: InstallerDeps,
): Promise<UpdateSkillsOutputData> {
  const input = UpdateSkillsInputSchema.parse(rawInput);
  const ctx = buildExecutionContext({ workspacePath: input.workspacePath });
  const scopes = normalizeScopeSelection(input.scope);

  const updated: UpdateSkillsOutputData["updated"] = [];
  const unchanged: UpdateSkillsOutputData["unchanged"] = [];
  const failed: UpdateSkillsOutputData["failed"] = [];

  for (const scope of scopes) {
    const lock = await deps.lockStore.acquire(ctx, scope, "update");

    try {
      const trackedSkills = await deps.manifestStore.listSkills(ctx, scope, input.skills);

      for (const trackedSkill of trackedSkills) {
        try {
          const fetched = await deps.skillFetcher.fetchFullSkill(trackedSkill.source, ctx);
          const resolvedSkill = await createSkillRecordFromFetched(
            ctx,
            deps.canonicalStore,
            trackedSkill.source,
            fetched,
            scope,
          );

          const contentChanged = resolvedSkill.contentHash !== trackedSkill.canonical.contentHash;
          const revisionChanged = fetched.revision !== undefined && fetched.revision !== trackedSkill.source.revision;

          if (!contentChanged && !revisionChanged) {
            unchanged.push(trackedSkill.name);
            continue;
          }

          let effectiveSkill = resolvedSkill;
          let canonicalPath = resolveStoredPath(ctx, scope, trackedSkill.canonical.path);
          let canonicalHash = trackedSkill.canonical.contentHash;

          if (contentChanged) {
            const canonicalResult = await deps.canonicalStore.installSkill(ctx, {
              skill: resolvedSkill,
              fetched,
              scope,
            });

            effectiveSkill = {
              ...resolvedSkill,
              canonicalDir: canonicalResult.canonicalDir,
              canonicalSkillFile: canonicalResult.canonicalSkillFile,
              contentHash: canonicalResult.contentHash,
              features: canonicalResult.features,
            };
            canonicalPath = canonicalResult.canonicalDir;
            canonicalHash = canonicalResult.contentHash;
          }

          let targetsReapplied = 0;
          const nextTargets: ManifestTargetEntry[] = [];

          if (!contentChanged || input.reapplyTargets === false) {
            for (const target of trackedSkill.targets) {
              nextTargets.push(toAbsoluteTargetEntry(ctx, scope, target, {
                markCopyOutOfSync: Boolean(contentChanged && input.reapplyTargets === false),
              }));
            }
          } else {
            for (const target of trackedSkill.targets) {
              if (target.scope !== scope) {
                nextTargets.push(toAbsoluteTargetEntry(ctx, scope, target));
                continue;
              }

              if (input.agents && !input.agents.includes(target.agentId)) {
                nextTargets.push(toAbsoluteTargetEntry(ctx, scope, target, {
                  markCopyOutOfSync: true,
                }));
                continue;
              }

              const adapter = getAdapterOrThrow(deps.adapterRegistry, target.agentId);

              try {
                const resolved = await adapter.resolveTarget(ctx, {
                  skill: effectiveSkill,
                  scope,
                  requestedMode: resolvedModeToRequestedMode(target.mode),
                });

                const applied = await adapter.applyInstall(ctx, {
                  skill: effectiveSkill,
                  resolved,
                });

                const verified = await adapter.verifyInstall(ctx, {
                  skill: effectiveSkill,
                  scope,
                  expectedMode: applied.mode,
                  targetDir: applied.targetDir,
                });

                nextTargets.push({
                  agentId: target.agentId,
                  scope,
                  mode: applied.mode,
                  targetPath: applied.targetDir,
                  status: verified.status,
                  lastVerifiedAt: verified.checkedAt,
                  lastSyncAt: verified.checkedAt,
                });

                if (verified.ok) {
                  targetsReapplied += 1;
                } else {
                  failed.push({
                    skillName: trackedSkill.name,
                    code: verified.issues[0]?.code ?? "VERIFY_FAILED",
                    message: verified.issues[0]?.message ?? `Verification failed for ${target.agentId}.`,
                  });
                }
              } catch (error) {
                failed.push(normalizeTargetError(trackedSkill.name, target.agentId, error));
                nextTargets.push(toAbsoluteTargetEntry(ctx, scope, target, {
                  markCopyOutOfSync: target.mode === "copy",
                }));
              }
            }
          }

          await deps.manifestStore.upsertMany(ctx, [
            {
              skill: effectiveSkill,
              scope,
              canonical: {
                path: canonicalPath,
                contentHash: canonicalHash,
              },
              targets: nextTargets,
              lastPlanFingerprint: trackedSkill.lastPlanFingerprint,
            },
          ]);

          updated.push({
            skillName: trackedSkill.name,
            fromRevision: trackedSkill.source.revision,
            toRevision: fetched.revision,
            targetsReapplied,
          });
        } catch (error) {
          const normalized = ensureInstallerError(error);
          failed.push({
            skillName: trackedSkill.name,
            code: normalized.code,
            message: normalized.message,
          });
        }
      }
    } finally {
      await deps.lockStore.release(lock);
    }
  }

  return {
    updated,
    unchanged: Array.from(new Set(unchanged)),
    failed,
  };
}

function resolvedModeToRequestedMode(mode: ManifestTargetEntry["mode"]): RequestedInstallMode {
  return mode === "direct" ? "auto" : mode;
}

function toAbsoluteTargetEntry(
  ctx: ReturnType<typeof buildExecutionContext>,
  scope: Scope,
  target: ManifestTargetEntry,
  options?: { markCopyOutOfSync?: boolean },
): ManifestTargetEntry {
  return {
    ...target,
    targetPath: resolveStoredPath(ctx, scope, target.targetPath),
    status: options?.markCopyOutOfSync && target.mode === "copy"
      ? "out_of_sync"
      : target.status,
  };
}

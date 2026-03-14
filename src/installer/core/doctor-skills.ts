import { z } from "zod";
import {
  DoctorSkillsInputSchema,
  DoctorSkillsOutputDataSchema,
  type DoctorSkillsInput,
} from "../../schema/tools.js";
import {
  buildExecutionContext,
  getAdapterOrThrow,
  normalizeScopeSelection,
  resolveStoredPath,
  type InstallerDeps,
} from "./helpers.js";

export type DoctorSkillsOutputData = z.infer<typeof DoctorSkillsOutputDataSchema>;

export async function doctorSkills(
  rawInput: DoctorSkillsInput,
  deps: InstallerDeps,
): Promise<DoctorSkillsOutputData> {
  const input = DoctorSkillsInputSchema.parse(rawInput);
  const ctx = buildExecutionContext({ workspacePath: input.workspacePath });
  const scopes = normalizeScopeSelection(input.scope);

  const issues: DoctorSkillsOutputData["issues"] = [];
  let skillsChecked = 0;

  for (const scope of scopes) {
    const tracked = await deps.manifestStore.listSkills(ctx, scope);

    for (const trackedSkill of tracked) {
      skillsChecked += 1;
      const canonicalExists = await deps.canonicalStore.exists(ctx, trackedSkill.name, scope);

      if (!canonicalExists) {
        issues.push({
          code: "CANONICAL_MISSING",
          severity: "error",
          skillName: trackedSkill.name,
          message: "Canonical skill directory is missing.",
          suggestedAction: "remove_skills",
        });
        continue;
      }

      const skill = await deps.canonicalStore.loadInstalledSkillRecord(ctx, trackedSkill.name, scope);

      for (const target of trackedSkill.targets) {
        if (target.scope !== scope) {
          continue;
        }

        if (input.agents && !input.agents.includes(target.agentId)) {
          continue;
        }

        const adapter = getAdapterOrThrow(deps.adapterRegistry, target.agentId);
        const targetPath = resolveStoredPath(ctx, scope, target.targetPath);
        const verify = await adapter.verifyInstall(ctx, {
          skill,
          scope,
          targetDir: targetPath,
          expectedMode: target.mode,
        });

        for (const issue of verify.issues) {
          issues.push({
            code: issue.code,
            severity: issue.severity,
            skillName: trackedSkill.name,
            agentId: target.agentId,
            message: issue.message,
            suggestedAction:
              issue.code === "BROKEN_SYMLINK" || issue.code === "OUT_OF_SYNC_COPY"
                ? "sync_skills"
                : issue.code === "TARGET_MISSING"
                  ? "sync_skills"
                  : "remove_skills",
          });
        }
      }
    }
  }

  return {
    summary: {
      ok: issues.every((issue) => issue.severity !== "error"),
      skillsChecked,
      issuesFound: issues.length,
    },
    issues,
  };
}

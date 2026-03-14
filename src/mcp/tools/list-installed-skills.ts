import type { InstallerDeps } from "../../installer/core/helpers.js";
import { buildExecutionContext, formatPathForDisplay, normalizeScopeSelection } from "../../installer/core/helpers.js";
import { ListInstalledSkillsInputSchema } from "../../schema/tools.js";

export async function handleListInstalledSkills(
  rawInput: unknown,
  deps: InstallerDeps,
) {
  const input = ListInstalledSkillsInputSchema.parse(rawInput);
  const ctx = buildExecutionContext({ workspacePath: input.workspacePath });
  const scopes = normalizeScopeSelection(input.scope);
  const skills: Array<{
    name: string;
    source: { type: "skills.sh" | "git" | "local"; locator: string; revision?: string };
    canonicalPath: string;
    targets: Array<{
      agentId: string;
      scope: "project" | "global";
      targetPath: string;
      mode: "direct" | "symlink" | "copy";
      status: "installed" | "installed_with_warnings" | "out_of_sync" | "broken" | "manual_required";
      lastVerifiedAt?: string;
    }>;
  }> = [];

  for (const scope of scopes) {
    const tracked = await deps.manifestStore.listSkills(ctx, scope);

    for (const skill of tracked) {
      if (input.agents && !skill.targets.some((target) => input.agents?.includes(target.agentId))) {
        continue;
      }

      if (input.includeBroken === false && skill.targets.some((target) => target.status === "broken")) {
        continue;
      }

      skills.push({
        name: skill.name,
        source: skill.source,
        canonicalPath: skill.canonical.path,
        targets: skill.targets
          .filter((target) => !input.agents || input.agents.includes(target.agentId))
          .map((target) => ({
            agentId: target.agentId,
            scope: target.scope,
            targetPath: target.targetPath,
            mode: target.mode,
            status: target.status,
            lastVerifiedAt: target.lastVerifiedAt,
          })),
      });
    }
  }

  return {
    status: "success" as const,
    data: {
      skills,
    },
  };
}

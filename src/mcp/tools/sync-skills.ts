import type { InstallerDeps } from "../../installer/core/helpers.js";
import { syncSkills } from "../../installer/core/sync-skills.js";
import {
  SyncSkillsInputSchema,
  type SyncSkillsInput,
} from "../../schema/tools.js";

export async function handleSyncSkills(
  rawInput: unknown,
  deps: InstallerDeps,
) {
  const input = SyncSkillsInputSchema.parse(rawInput) as SyncSkillsInput;
  const data = await syncSkills(input, deps);

  return {
    status: data.failed.length > 0 ? "partial" as const : "success" as const,
    data,
  };
}

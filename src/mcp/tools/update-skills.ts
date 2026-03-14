import type { InstallerDeps } from "../../installer/core/helpers.js";
import { updateSkills } from "../../installer/core/update-skills.js";
import {
  UpdateSkillsInputSchema,
  type UpdateSkillsInput,
} from "../../schema/tools.js";

export async function handleUpdateSkills(
  rawInput: unknown,
  deps: InstallerDeps,
) {
  const input = UpdateSkillsInputSchema.parse(rawInput) as UpdateSkillsInput;
  const data = await updateSkills(input, deps);

  return {
    status: data.failed.length === 0 ? "success" as const : data.updated.length > 0 ? "partial" as const : "error" as const,
    data,
  };
}

import type { InstallerDeps } from "../../installer/core/helpers.js";
import { removeSkills } from "../../installer/core/remove-skills.js";
import {
  RemoveSkillsInputSchema,
  type RemoveSkillsInput,
} from "../../schema/tools.js";

export async function handleRemoveSkills(
  rawInput: unknown,
  deps: InstallerDeps,
) {
  const input = RemoveSkillsInputSchema.parse(rawInput) as RemoveSkillsInput;
  const data = await removeSkills(input, deps);

  return {
    status: data.failed.length > 0 ? "partial" as const : "success" as const,
    data,
  };
}

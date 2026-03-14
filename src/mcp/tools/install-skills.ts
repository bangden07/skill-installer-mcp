import type { InstallerDeps } from "../../installer/core/helpers.js";
import { getInstallResultStatus, installSkills } from "../../installer/core/install-skills.js";
import {
  InstallSkillsInputSchema,
  type InstallSkillsInput,
} from "../../schema/tools.js";

export async function handleInstallSkills(
  rawInput: unknown,
  deps: InstallerDeps,
) {
  const input = InstallSkillsInputSchema.parse(rawInput) as InstallSkillsInput;
  const data = await installSkills(input, deps);

  return {
    status: getInstallResultStatus(data),
    data,
  };
}

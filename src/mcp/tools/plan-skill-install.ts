import type { InstallerDeps } from "../../installer/core/helpers.js";
import { planSkillInstall } from "../../installer/core/plan-skill-install.js";
import {
  PlanSkillInstallInputSchema,
  type PlanSkillInstallInput,
} from "../../schema/tools.js";

export async function handlePlanSkillInstall(
  rawInput: unknown,
  deps: InstallerDeps,
) {
  const input = PlanSkillInstallInputSchema.parse(rawInput) as PlanSkillInstallInput;
  const data = await planSkillInstall(input, deps);

  return {
    status: "success" as const,
    data,
  };
}

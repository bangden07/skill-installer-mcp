import type { InstallerDeps } from "../../installer/core/helpers.js";
import { doctorSkills } from "../../installer/core/doctor-skills.js";
import {
  DoctorSkillsInputSchema,
  type DoctorSkillsInput,
} from "../../schema/tools.js";

export async function handleDoctorSkills(
  rawInput: unknown,
  deps: InstallerDeps,
) {
  const input = DoctorSkillsInputSchema.parse(rawInput) as DoctorSkillsInput;
  const data = await doctorSkills(input, deps);

  return {
    status: data.summary.ok ? "success" as const : "partial" as const,
    data,
  };
}

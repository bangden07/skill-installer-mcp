import {
  AnalyzeProjectInputSchema,
  AnalyzeProjectOutputSchema,
  DoctorSkillsInputSchema,
  DoctorSkillsOutputSchema,
  InstallSkillsInputSchema,
  InstallSkillsOutputSchema,
  ListInstalledSkillsInputSchema,
  ListInstalledSkillsOutputSchema,
  ListSupportedAgentsInputSchema,
  ListSupportedAgentsOutputSchema,
  PlanSkillInstallInputSchema,
  PlanSkillInstallOutputSchema,
  RecommendSkillsInputSchema,
  RecommendSkillsOutputSchema,
  RemoveSkillsInputSchema,
  RemoveSkillsOutputSchema,
  SyncSkillsInputSchema,
  SyncSkillsOutputSchema,
  UpdateSkillsInputSchema,
  UpdateSkillsOutputSchema,
} from "./tools.js";

export const ToolSchemaRegistry = {
  analyze_project: {
    input: AnalyzeProjectInputSchema,
    output: AnalyzeProjectOutputSchema,
  },
  recommend_skills: {
    input: RecommendSkillsInputSchema,
    output: RecommendSkillsOutputSchema,
  },
  plan_skill_install: {
    input: PlanSkillInstallInputSchema,
    output: PlanSkillInstallOutputSchema,
  },
  install_skills: {
    input: InstallSkillsInputSchema,
    output: InstallSkillsOutputSchema,
  },
  list_installed_skills: {
    input: ListInstalledSkillsInputSchema,
    output: ListInstalledSkillsOutputSchema,
  },
  sync_skills: {
    input: SyncSkillsInputSchema,
    output: SyncSkillsOutputSchema,
  },
  update_skills: {
    input: UpdateSkillsInputSchema,
    output: UpdateSkillsOutputSchema,
  },
  remove_skills: {
    input: RemoveSkillsInputSchema,
    output: RemoveSkillsOutputSchema,
  },
  doctor_skills: {
    input: DoctorSkillsInputSchema,
    output: DoctorSkillsOutputSchema,
  },
  list_supported_agents: {
    input: ListSupportedAgentsInputSchema,
    output: ListSupportedAgentsOutputSchema,
  },
} as const;

export function getToolSchemaRegistry() {
  return ToolSchemaRegistry;
}

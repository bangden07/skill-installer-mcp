import { createAdapterRegistry } from "../adapters/agents/registry.js";
import { createCanonicalStore } from "../state/canonical-store.js";
import { createLockStore } from "../state/lock-store.js";
import { createManifestStore } from "../state/manifest-store.js";
import { createPlanStore } from "../state/plan-store.js";
import { ToolSchemaRegistry } from "../schema/json-schema.js";
import { createSkillFetcher, createRegistryResolver } from "../registry/resolver.js";
import type { InstallerDeps } from "../installer/core/helpers.js";
import { handleAnalyzeProject } from "./tools/analyze-project.js";
import { handleDoctorSkills } from "./tools/doctor-skills.js";
import { handleInstallSkills } from "./tools/install-skills.js";
import { handleListInstalledSkills } from "./tools/list-installed-skills.js";
import { handleListSupportedAgents } from "./tools/list-supported-agents.js";
import { handlePlanSkillInstall } from "./tools/plan-skill-install.js";
import { handleRecommendSkills } from "./tools/recommend-skills.js";
import { handleRemoveSkills } from "./tools/remove-skills.js";
import { handleSyncSkills } from "./tools/sync-skills.js";
import { handleUpdateSkills } from "./tools/update-skills.js";

export interface ToolRegistration {
  name: keyof typeof ToolSchemaRegistry;
  title: string;
  handler: (rawInput: unknown) => Promise<unknown>;
}

export function createDefaultInstallerDeps(): InstallerDeps {
  return {
    registryResolver: createRegistryResolver(),
    skillFetcher: createSkillFetcher(),
    canonicalStore: createCanonicalStore(),
    adapterRegistry: createAdapterRegistry(),
    manifestStore: createManifestStore(),
    planStore: createPlanStore(),
    lockStore: createLockStore(),
  };
}

export function getToolRegistrations(deps: InstallerDeps = createDefaultInstallerDeps()): ToolRegistration[] {
  return [
    {
      name: "analyze_project",
      title: "Analyze project context",
      handler: (rawInput) => handleAnalyzeProject(rawInput),
    },
    {
      name: "recommend_skills",
      title: "Recommend project skills",
      handler: (rawInput) => handleRecommendSkills(rawInput),
    },
    {
      name: "plan_skill_install",
      title: "Plan skill installation",
      handler: (rawInput) => handlePlanSkillInstall(rawInput, deps),
    },
    {
      name: "install_skills",
      title: "Install selected skills",
      handler: (rawInput) => handleInstallSkills(rawInput, deps),
    },
    {
      name: "list_installed_skills",
      title: "List installed skills",
      handler: (rawInput) => handleListInstalledSkills(rawInput, deps),
    },
    {
      name: "sync_skills",
      title: "Repair installed skills",
      handler: (rawInput) => handleSyncSkills(rawInput, deps),
    },
    {
      name: "update_skills",
      title: "Update tracked skills",
      handler: (rawInput) => handleUpdateSkills(rawInput, deps),
    },
    {
      name: "remove_skills",
      title: "Remove installed skills",
      handler: (rawInput) => handleRemoveSkills(rawInput, deps),
    },
    {
      name: "doctor_skills",
      title: "Diagnose skill issues",
      handler: (rawInput) => handleDoctorSkills(rawInput, deps),
    },
    {
      name: "list_supported_agents",
      title: "List supported agents",
      handler: (rawInput) => handleListSupportedAgents(rawInput, deps),
    },
  ];
}

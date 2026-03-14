import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  AnalyzeProjectInputSchema,
  RecommendSkillsInputSchema,
  PlanSkillInstallInputSchema,
  InstallSkillsInputSchema,
  ListInstalledSkillsInputSchema,
  SyncSkillsInputSchema,
  UpdateSkillsInputSchema,
  RemoveSkillsInputSchema,
  DoctorSkillsInputSchema,
  ListSupportedAgentsInputSchema,
} from "../schema/tools.js";
import { createDefaultInstallerDeps } from "./register-tools.js";
import { handleAnalyzeProject } from "./tools/analyze-project.js";
import { handleRecommendSkills } from "./tools/recommend-skills.js";
import { handlePlanSkillInstall } from "./tools/plan-skill-install.js";
import { handleInstallSkills } from "./tools/install-skills.js";
import { handleListInstalledSkills } from "./tools/list-installed-skills.js";
import { handleSyncSkills } from "./tools/sync-skills.js";
import { handleUpdateSkills } from "./tools/update-skills.js";
import { handleRemoveSkills } from "./tools/remove-skills.js";
import { handleDoctorSkills } from "./tools/doctor-skills.js";
import { handleListSupportedAgents } from "./tools/list-supported-agents.js";

export interface BootstrapMcpServer {
  start(): Promise<void>;
}

function wrapResult(result: unknown): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  const json = JSON.stringify(result, null, 2);
  const obj = result as Record<string, unknown> | null;
  const isError = obj?.status === "error";
  return {
    content: [{ type: "text" as const, text: json }],
    ...(isError ? { isError: true } : {}),
  };
}

class RealMcpServer implements BootstrapMcpServer {
  async start(): Promise<void> {
    const server = new McpServer({
      name: "skill-installer-mcp",
      version: "0.1.0",
      description: "MCP server for cross-agent skill installation, management, and recommendation.",
    });

    const deps = createDefaultInstallerDeps();

    server.tool(
      "analyze_project",
      "Analyze project context to detect frameworks, languages, package managers, signals, and active agents. Use this before recommend_skills for better recommendations.",
      AnalyzeProjectInputSchema.shape,
      async (args) => wrapResult(await handleAnalyzeProject(args)),
    );

    server.tool(
      "recommend_skills",
      "Recommend agent skills based on a goal and optional project analysis. Returns ranked skill suggestions with install references.",
      RecommendSkillsInputSchema.shape,
      async (args) => wrapResult(await handleRecommendSkills(args)),
    );

    server.tool(
      "plan_skill_install",
      "Create a dry-run installation plan showing what canonical and target actions would be taken. Always call this before install_skills to preview changes.",
      PlanSkillInstallInputSchema.shape,
      async (args) => wrapResult(await handlePlanSkillInstall(args, deps)),
    );

    server.tool(
      "install_skills",
      "Install skills into the canonical store and deploy to target agents. Optionally pass expectedPlanFingerprint from a prior plan to validate consistency.",
      InstallSkillsInputSchema.shape,
      async (args) => wrapResult(await handleInstallSkills(args, deps)),
    );

    server.tool(
      "list_installed_skills",
      "List all installed skills with their canonical paths, sources, target deployments, and status.",
      ListInstalledSkillsInputSchema.shape,
      async (args) => wrapResult(await handleListInstalledSkills(args, deps)),
    );

    server.tool(
      "sync_skills",
      "Verify and repair installed skill targets. Fixes broken symlinks, missing copies, and manifest inconsistencies.",
      SyncSkillsInputSchema.shape,
      async (args) => wrapResult(await handleSyncSkills(args, deps)),
    );

    server.tool(
      "update_skills",
      "Update installed skills from their tracked local sources. Refreshes canonical content and optionally re-applies target deployments.",
      UpdateSkillsInputSchema.shape,
      async (args) => wrapResult(await handleUpdateSkills(args, deps)),
    );

    server.tool(
      "remove_skills",
      "Remove skill target deployments from agents. Optionally purge the canonical copy as well.",
      RemoveSkillsInputSchema.shape,
      async (args) => wrapResult(await handleRemoveSkills(args, deps)),
    );

    server.tool(
      "doctor_skills",
      "Diagnose skill installation health. Checks for orphaned targets, missing canonicals, manifest drift, and other issues.",
      DoctorSkillsInputSchema.shape,
      async (args) => wrapResult(await handleDoctorSkills(args, deps)),
    );

    server.tool(
      "list_supported_agents",
      "List all supported coding agents with their capabilities, install modes, scope support, and detection status.",
      ListSupportedAgentsInputSchema.shape,
      async (args) => wrapResult(await handleListSupportedAgents(args, deps)),
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

export function createMcpServer(): BootstrapMcpServer {
  return new RealMcpServer();
}

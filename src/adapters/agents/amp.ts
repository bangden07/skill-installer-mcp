import type {
  AdapterContext,
  AgentCapabilities,
  AgentDetection,
  ResolveTargetInput,
  ResolvedTarget,
  SkillRecord,
  WarningItem,
} from "../../domain/types.js";
import { BaseAgentAdapter } from "./base.js";
import { homePath } from "./_shared.js";

export class AmpAdapter extends BaseAgentAdapter {
  readonly agentId = "amp";
  readonly displayName = "Amp";

  async detect(ctx: AdapterContext): Promise<AgentDetection> {
    return this.detectByBinaryOrDir(ctx, {
      binaries: ["amp"],
      dirs: [homePath(ctx, ".config", "amp")],
      installableWithoutDetection: true,
    });
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return {
      agentId: this.agentId,
      supportTier: "tier-a",
      supportsProjectScope: true,
      supportsGlobalScope: true,
      supportsDirect: true,
      supportsSymlink: true,
      supportsCopy: true,
      supportsAllowedTools: false,
      requiresExtraConfig: false,
      supportsBundledMcpConfig: true,
      notes: ["Global native path is ~/.config/agents/skills."],
    };
  }

  protected getCompatibilityWarnings(skill: SkillRecord): WarningItem[] {
    if (!skill.features.hasMcpConfig) {
      return [];
    }

    return [
      {
        code: "BUNDLED_MCP_PRESENT",
        message: "Skill contains mcp.json; preserve it, but do not register MCP hosts in phase 1.",
        severity: "info",
        agentId: this.agentId,
        skillName: skill.name,
      },
    ];
  }

  protected async resolveNativeTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget> {
    if (input.scope === "project") {
      return this.resolveDirectTarget(ctx, input, {
        notes: ["Amp reads project .agents/skills directly."],
      });
    }

    return this.resolveNativeExportTarget(ctx, input, {
      nativeDir: homePath(ctx, ".config", "agents", "skills", input.skill.name),
      preferredAutoMode: "symlink",
      notes: ["Global install exported to Amp-compatible agents path."],
    });
  }
}

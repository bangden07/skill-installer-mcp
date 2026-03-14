import type {
  AdapterContext,
  AgentCapabilities,
  AgentDetection,
  ResolveTargetInput,
  ResolvedTarget,
} from "../../domain/types.js";
import { BaseAgentAdapter } from "./base.js";
import { homePath } from "./_shared.js";

export class OpenCodeAdapter extends BaseAgentAdapter {
  readonly agentId = "opencode";
  readonly displayName = "OpenCode";

  async detect(ctx: AdapterContext): Promise<AgentDetection> {
    return this.detectByBinaryOrDir(ctx, {
      binaries: ["opencode"],
      dirs: [homePath(ctx, ".config", "opencode")],
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
      supportsBundledMcpConfig: false,
      notes: ["Reads .agents/skills and Claude-compatible paths."],
    };
  }

  protected async resolveNativeTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget> {
    if (input.scope === "project") {
      return this.resolveDirectTarget(ctx, input, {
        notes: ["OpenCode scans project .agents/skills directly."],
      });
    }

    return this.resolveNativeExportTarget(ctx, input, {
      nativeDir: homePath(ctx, ".config", "opencode", "skills", input.skill.name),
      preferredAutoMode: "symlink",
      notes: ["Global install exported to OpenCode native config path."],
    });
  }
}

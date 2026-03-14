import type {
  AdapterContext,
  AgentCapabilities,
  AgentDetection,
  ResolveTargetInput,
  ResolvedTarget,
} from "../../domain/types.js";
import { BaseAgentAdapter } from "./base.js";
import { homePath, workspacePath } from "./_shared.js";

export class ClaudeCodeAdapter extends BaseAgentAdapter {
  readonly agentId = "claude-code";
  readonly displayName = "Claude Code";

  async detect(ctx: AdapterContext): Promise<AgentDetection> {
    return this.detectByBinaryOrDir(ctx, {
      binaries: ["claude"],
      dirs: [homePath(ctx, ".claude")],
      installableWithoutDetection: true,
    });
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return {
      agentId: this.agentId,
      supportTier: "tier-a",
      supportsProjectScope: true,
      supportsGlobalScope: true,
      supportsDirect: false,
      supportsSymlink: true,
      supportsCopy: true,
      supportsAllowedTools: true,
      requiresExtraConfig: false,
      supportsBundledMcpConfig: false,
      notes: ["Prefer native .claude/skills export for reliability."],
    };
  }

  protected async resolveNativeTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget> {
    const nativeDir = input.scope === "project"
      ? workspacePath(ctx, ".claude", "skills", input.skill.name)
      : homePath(ctx, ".claude", "skills", input.skill.name);

    return this.resolveNativeExportTarget(ctx, input, {
      nativeDir,
      preferredAutoMode: "symlink",
      notes: ["Claude Code uses native .claude/skills target."],
    });
  }
}

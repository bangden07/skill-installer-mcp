import type {
  AdapterContext,
  AgentCapabilities,
  AgentDetection,
  ResolveTargetInput,
  ResolvedTarget,
} from "../../domain/types.js";
import { BaseAgentAdapter } from "./base.js";
import { homePath } from "./_shared.js";

export class CodexAdapter extends BaseAgentAdapter {
  readonly agentId = "codex";
  readonly displayName = "Codex";

  async detect(ctx: AdapterContext): Promise<AgentDetection> {
    return this.detectByBinaryOrDir(ctx, {
      binaries: ["codex"],
      dirs: [homePath(ctx, ".codex")],
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
      notes: ["Repo discovery uses .agents/skills from cwd up to repo root."],
    };
  }

  protected async resolveNativeTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget> {
    if (input.scope === "project") {
      return this.resolveDirectTarget(ctx, input, {
        notes: ["Codex reads project .agents/skills directly."],
      });
    }

    return this.resolveNativeExportTarget(ctx, input, {
      nativeDir: homePath(ctx, ".codex", "skills", input.skill.name),
      preferredAutoMode: "symlink",
      notes: ["Global install exported to Codex native global path."],
    });
  }
}

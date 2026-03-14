import type {
  AdapterContext,
  AgentCapabilities,
  AgentDetection,
  ResolveTargetInput,
  ResolvedTarget,
} from "../../domain/types.js";
import { BaseAgentAdapter } from "./base.js";
import { homePath } from "./_shared.js";

export class WindsurfAdapter extends BaseAgentAdapter {
  readonly agentId = "windsurf";
  readonly displayName = "Windsurf";

  async detect(ctx: AdapterContext): Promise<AgentDetection> {
    return this.detectByBinaryOrDir(ctx, {
      binaries: ["windsurf"],
      dirs: [homePath(ctx, ".codeium", "windsurf")],
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
      notes: [
        "Project scope can use .agents/skills directly; global prefers Windsurf native path.",
      ],
    };
  }

  protected async resolveNativeTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget> {
    if (input.scope === "project") {
      return this.resolveDirectTarget(ctx, input, {
        notes: ["Windsurf supports project .agents/skills directly."],
      });
    }

    return this.resolveNativeExportTarget(ctx, input, {
      nativeDir: homePath(ctx, ".codeium", "windsurf", "skills", input.skill.name),
      preferredAutoMode: "symlink",
      notes: ["Global install exported to Windsurf native global path."],
    });
  }
}

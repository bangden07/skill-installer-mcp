import type {
  AdapterContext,
  AgentCapabilities,
  AgentDetection,
  ResolveTargetInput,
  ResolvedTarget,
} from "../../domain/types.js";
import { BaseAgentAdapter } from "./base.js";
import { homePath } from "./_shared.js";

export class CursorAdapter extends BaseAgentAdapter {
  readonly agentId = "cursor";
  readonly displayName = "Cursor";

  async detect(ctx: AdapterContext): Promise<AgentDetection> {
    return this.detectByBinaryOrDir(ctx, {
      binaries: ["cursor"],
      dirs: [homePath(ctx, ".cursor")],
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
      supportsAllowedTools: true,
      requiresExtraConfig: false,
      supportsBundledMcpConfig: false,
      notes: ["Project scope uses canonical .agents/skills directly."],
    };
  }

  protected async resolveNativeTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget> {
    if (input.scope === "project") {
      return this.resolveDirectTarget(ctx, input, {
        notes: ["Cursor reads project .agents/skills directly."],
      });
    }

    return this.resolveNativeExportTarget(ctx, input, {
      nativeDir: homePath(ctx, ".cursor", "skills", input.skill.name),
      preferredAutoMode: "symlink",
      notes: ["Global install exported to Cursor native skills directory."],
    });
  }
}

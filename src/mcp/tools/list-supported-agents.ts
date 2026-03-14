import type { AgentCapabilities } from "../../domain/types.js";
import type { InstallerDeps } from "../../installer/core/helpers.js";
import { buildExecutionContext } from "../../installer/core/helpers.js";
import { ListSupportedAgentsInputSchema } from "../../schema/tools.js";

export async function handleListSupportedAgents(
  rawInput: unknown,
  deps: InstallerDeps,
) {
  const input = ListSupportedAgentsInputSchema.parse(rawInput);
  const ctx = buildExecutionContext({});

  const agents: AgentCapabilities[] = [];

  for (const agentId of Object.keys(deps.adapterRegistry)) {
    const adapter = deps.adapterRegistry[agentId as keyof typeof deps.adapterRegistry];
    const capabilities = await adapter.getCapabilities(ctx);
    const detection = input.includeDetection === false ? null : await adapter.detect(ctx);

    agents.push({
      ...capabilities,
      notes: detection
        ? [...capabilities.notes, ...detection.notes]
        : capabilities.notes,
    });
  }

  return {
    status: "success" as const,
    data: {
      agents,
    },
  };
}

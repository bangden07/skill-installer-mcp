import type { AgentCapabilities, AgentId, ExecutionContext } from "../domain/types.js";
import { createAdapterRegistry, type AgentAdapterRegistry } from "../adapters/agents/registry.js";

/**
 * Agent detection result.
 */
export interface AgentDetectionResult {
  detectedAgents: AgentCapabilities[];
  detectedAgentIds: AgentId[];
}

/**
 * Detect which coding agents are available in the workspace and/or globally.
 * Uses each adapter's detect() method to check for agent presence.
 */
export async function detectAgents(
  ctx: ExecutionContext,
  registry?: AgentAdapterRegistry,
): Promise<AgentDetectionResult> {
  const adapterRegistry = registry ?? createAdapterRegistry();
  const detectedAgents: AgentCapabilities[] = [];
  const detectedAgentIds: AgentId[] = [];

  const entries = Object.entries(adapterRegistry) as Array<
    [AgentId, (typeof adapterRegistry)[AgentId]]
  >;

  const results = await Promise.allSettled(
    entries.map(async ([agentId, adapter]) => {
      const detection = await adapter.detect(ctx);
      const capabilities = await adapter.getCapabilities(ctx);

      return {
        agentId,
        detection,
        capabilities,
      };
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") continue;

    const { detection, capabilities } = result.value;

    // Include agent if detected or if installable without detection
    if (detection.detected || detection.installableWithoutDetection) {
      detectedAgents.push(capabilities);
      detectedAgentIds.push(capabilities.agentId);
    }
  }

  return { detectedAgents, detectedAgentIds };
}

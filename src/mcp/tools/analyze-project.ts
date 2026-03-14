import { toErrorItem } from "../../domain/errors.js";
import { AnalyzeProjectInputSchema } from "../../schema/tools.js";
import { buildExecutionContext } from "../../installer/core/helpers.js";
import { analyzeProject } from "../../project-analyzer/analyze-project.js";
import { createAdapterRegistry } from "../../adapters/agents/registry.js";

export async function handleAnalyzeProject(rawInput?: unknown) {
  try {
    const input = AnalyzeProjectInputSchema.parse(rawInput ?? {});
    const workspacePath = input.workspacePath ?? process.cwd();
    const ctx = buildExecutionContext({ workspacePath });

    const analysis = await analyzeProject(
      {
        workspacePath,
        includeAgents: input.includeAgents,
        includeFiles: input.includeFiles,
        adapterRegistry: input.includeAgents ? createAdapterRegistry() : undefined,
      },
      ctx,
    );

    return {
      status: "success" as const,
      data: {
        workspacePath: analysis.workspacePath,
        projectKinds: analysis.projectKinds,
        languages: analysis.languages,
        frameworks: analysis.frameworks,
        packageManagers: analysis.packageManagers,
        signals: analysis.signals,
        manifestFiles: analysis.manifestFiles,
        detectedAgents: analysis.detectedAgents,
        confidence: analysis.confidence,
      },
    };
  } catch (error) {
    return {
      status: "error" as const,
      error: toErrorItem(error, "UNKNOWN_ERROR", "Failed to analyze project."),
    };
  }
}

import path from "node:path";
import type { AgentCapabilities, ExecutionContext } from "../domain/types.js";
import { type AgentAdapterRegistry } from "../adapters/agents/registry.js";
import { detectFrameworks, type FrameworkDetection } from "./detect-frameworks.js";
import { detectSignals, type SignalDetection } from "./detect-signals.js";
import { detectAgents, type AgentDetectionResult } from "./detect-agents.js";

/**
 * Full project analysis result.
 */
export interface ProjectAnalysis {
  workspacePath: string;
  projectKinds: string[];
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  signals: string[];
  manifestFiles: string[];
  detectedAgents?: AgentCapabilities[];
  confidence: number;
}

export interface AnalyzeProjectOptions {
  workspacePath: string;
  includeAgents?: boolean;
  includeFiles?: boolean;
  adapterRegistry?: AgentAdapterRegistry;
}

/**
 * Analyze a project workspace to determine its characteristics.
 *
 * Combines framework detection, signal detection, and optional agent detection
 * into a unified project analysis result.
 */
export async function analyzeProject(
  options: AnalyzeProjectOptions,
  ctx: ExecutionContext,
): Promise<ProjectAnalysis> {
  const { workspacePath, includeAgents, adapterRegistry } = options;
  const resolvedPath = path.resolve(workspacePath);

  // Run framework and signal detection in parallel
  const [frameworkResult, signalResult] = await Promise.all([
    detectFrameworks(resolvedPath),
    detectSignals(resolvedPath),
  ]);

  // Optionally detect agents
  let agentResult: AgentDetectionResult | undefined;
  if (includeAgents) {
    agentResult = await detectAgents(ctx, adapterRegistry);
  }

  // Calculate confidence based on how much we detected
  const confidence = calculateConfidence(frameworkResult, signalResult);

  const result: ProjectAnalysis = {
    workspacePath: resolvedPath,
    projectKinds: frameworkResult.projectKinds,
    languages: frameworkResult.languages,
    frameworks: frameworkResult.frameworks,
    packageManagers: frameworkResult.packageManagers,
    signals: signalResult.signals,
    manifestFiles: signalResult.manifestFiles,
    confidence,
  };

  if (agentResult) {
    result.detectedAgents = agentResult.detectedAgents;
  }

  return result;
}

/**
 * Calculate a confidence score (0-1) based on detection richness.
 *
 * Higher confidence when:
 * - Multiple languages/frameworks detected (consistent signals)
 * - Package manager detected (strong project structure signal)
 * - Project kind identified
 *
 * Lower confidence when:
 * - Nothing detected (empty workspace or unrecognized project type)
 */
function calculateConfidence(
  fw: FrameworkDetection,
  sig: SignalDetection,
): number {
  let score = 0;
  const maxScore = 10;

  // Language detected
  if (fw.languages.length > 0) score += 3;

  // Framework detected
  if (fw.frameworks.length > 0) score += 2;

  // Package manager detected
  if (fw.packageManagers.length > 0) score += 2;

  // Project kind identified
  if (fw.projectKinds.length > 0) score += 1;

  // Has meaningful signals
  if (sig.signals.length >= 3) score += 1;
  else if (sig.signals.length >= 1) score += 0.5;

  // Has manifest files
  if (sig.manifestFiles.length > 0) score += 1;

  return Math.min(score / maxScore, 1);
}

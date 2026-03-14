import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { ensureInstallerError, InstallerError } from "../../domain/errors.js";
import type {
  AgentId,
  ExecutionContext,
  FetchedSkill,
  RequestedInstallMode,
  ResolvedInstallMode,
  ResultStatus,
  Scope,
  ScopeOrAll,
  SkillRecord,
  SkillSelector,
  SkillSourceRef,
} from "../../domain/types.js";
import { detectSkillFeatures } from "../../skill-parser/feature-detect.js";
import { parseSkillFileContent } from "../../skill-parser/parse-skill.js";
import { validateParsedSkillFile } from "../../skill-parser/validate-skill.js";
import type { CanonicalStore } from "../../state/canonical-store.js";
import type { LockStore } from "../../state/lock-store.js";
import type { ManifestStore } from "../../state/manifest-store.js";
import type { PlanStore } from "../../state/plan-store.js";
import type { AgentAdapter } from "../../adapters/agents/base.js";
import type { AgentAdapterRegistry } from "../../adapters/agents/registry.js";

export interface RegistryResolver {
  resolve(selector: SkillSelector, ctx: ExecutionContext): Promise<SkillSourceRef>;
}

export interface SkillFetcher {
  fetchMetadataOnly(source: SkillSourceRef, ctx: ExecutionContext): Promise<FetchedSkill>;
  fetchFullSkill(source: SkillSourceRef, ctx: ExecutionContext): Promise<FetchedSkill>;
}

export interface InstallerDeps {
  registryResolver: RegistryResolver;
  skillFetcher: SkillFetcher;
  canonicalStore: CanonicalStore;
  adapterRegistry: AgentAdapterRegistry;
  manifestStore: ManifestStore;
  planStore: PlanStore;
  lockStore: LockStore;
}

export interface NormalizedSkillSelection {
  selector: SkillSelector;
  source: SkillSourceRef;
  fetched: FetchedSkill;
  skill: SkillRecord;
}

export function buildExecutionContext(input: {
  workspacePath?: string;
}): ExecutionContext {
  return {
    workspaceRoot: input.workspacePath ? path.resolve(input.workspacePath) : undefined,
    homeDir: os.homedir(),
    platform: process.platform,
    nowIso: new Date().toISOString(),
  };
}

export async function autoDetectCompatibleAgents(
  ctx: ExecutionContext,
  registry: AgentAdapterRegistry,
  scope: Scope,
): Promise<AgentId[]> {
  const result: AgentId[] = [];

  for (const agentId of Object.keys(registry) as AgentId[]) {
    const adapter = registry[agentId];
    const capabilities = await adapter.getCapabilities(ctx);

    if (scope === "project" && !capabilities.supportsProjectScope) {
      continue;
    }

    if (scope === "global" && !capabilities.supportsGlobalScope) {
      continue;
    }

    const detection = await adapter.detect(ctx);
    if (detection.detected || detection.installableWithoutDetection) {
      result.push(agentId);
    }
  }

  return result;
}

export async function normalizeSkillSelection(
  ctx: ExecutionContext,
  deps: InstallerDeps,
  selector: SkillSelector,
  scope: Scope,
  mode: "metadata" | "full",
): Promise<NormalizedSkillSelection> {
  const source = await deps.registryResolver.resolve(selector, ctx);
  const fetched = mode === "metadata"
    ? await deps.skillFetcher.fetchMetadataOnly(source, ctx)
    : await deps.skillFetcher.fetchFullSkill(source, ctx);

  const skill = await createSkillRecordFromFetched(ctx, deps.canonicalStore, source, fetched, scope);

  return {
    selector,
    source,
    fetched,
    skill,
  };
}

export async function createSkillRecordFromFetched(
  ctx: ExecutionContext,
  canonicalStore: CanonicalStore,
  source: SkillSourceRef,
  fetched: FetchedSkill,
  scope: Scope,
): Promise<SkillRecord> {
  const skillFile = fetched.files.find((file) => normalizeRelativePath(file.relativePath) === "SKILL.md");

  if (!skillFile) {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      "Fetched skill does not contain SKILL.md.",
      { details: { source } },
    );
  }

  const parsed = validateParsedSkillFile(await parseSkillFileContent(skillFile.content));
  const contentHash = computeFetchedSkillHash(fetched);
  const features = detectSkillFeaturesFromFetched(fetched);

  return {
    name: parsed.name,
    manifest: {
      name: parsed.name,
      description: parsed.description,
      compatibility: parsed.compatibility,
      metadata: parsed.metadata,
    },
    source,
    canonicalDir: canonicalStore.getCanonicalSkillDir(ctx, parsed.name, scope),
    canonicalSkillFile: canonicalStore.getCanonicalSkillFile(ctx, parsed.name, scope),
    contentHash,
    features,
  };
}

export function computePlanFingerprint(payload: unknown): string {
  const json = JSON.stringify(payload);
  return `plan_${createHash("sha256").update(json, "utf8").digest("hex").slice(0, 16)}`;
}

export function summarizeResolvedModes(
  modes: Array<ResolvedInstallMode | RequestedInstallMode | "direct">,
): RequestedInstallMode | ResolvedInstallMode | "mixed" | "direct" {
  const uniqueModes = Array.from(new Set(modes));

  if (uniqueModes.length === 0) {
    return "mixed";
  }

  if (uniqueModes.length === 1) {
    return uniqueModes[0];
  }

  return "mixed";
}

export function summarizeInstallResult(
  failedCount: number,
  installedCount: number,
): ResultStatus {
  if (failedCount === 0) {
    return "success";
  }

  if (installedCount > 0) {
    return "partial";
  }

  return "error";
}

export function buildPlanSummary(input: {
  skillsCount: number;
  targetActions: Array<{ action: string; status: string }>;
}) {
  return {
    skillsCount: input.skillsCount,
    targetCount: input.targetActions.length,
    plannedInstalls: input.targetActions.filter((item) => item.action !== "skip").length,
    plannedSkips: input.targetActions.filter((item) => item.action === "skip").length,
    manualSteps: input.targetActions.filter((item) => item.status === "manual_required").length,
  };
}

export function formatPathForDisplay(
  ctx: ExecutionContext,
  scope: Scope,
  absolutePath: string,
): string {
  if (scope === "project" && ctx.workspaceRoot) {
    return path.relative(ctx.workspaceRoot, absolutePath).split(path.sep).join("/");
  }

  if (absolutePath.startsWith(ctx.homeDir)) {
    return `~/${path.relative(ctx.homeDir, absolutePath).split(path.sep).join("/")}`;
  }

  return absolutePath;
}

export function resolveStoredPath(
  ctx: ExecutionContext,
  scope: Scope,
  storedPath: string,
): string {
  if (storedPath.startsWith("~/")) {
    return path.join(ctx.homeDir, ...storedPath.slice(2).split("/"));
  }

  if (path.isAbsolute(storedPath)) {
    return storedPath;
  }

  if (scope === "project" && ctx.workspaceRoot) {
    return path.join(ctx.workspaceRoot, ...storedPath.split("/"));
  }

  return storedPath;
}

export function normalizeScopeSelection(scope: ScopeOrAll | undefined): Scope[] {
  if (!scope || scope === "all") {
    return ["project", "global"];
  }

  return [scope];
}

export function getAdapterOrThrow(
  registry: AgentAdapterRegistry,
  agentId: AgentId,
): AgentAdapter {
  const adapter = registry[agentId];
  if (!adapter) {
    throw new InstallerError(
      "AGENT_NOT_SUPPORTED",
      `Agent '${agentId}' is not registered.`,
    );
  }

  return adapter;
}

export function normalizeTargetError(
  skillName: string,
  agentId: AgentId,
  error: unknown,
): { skillName: string; agentId: AgentId; code: string; message: string } {
  const normalized = ensureInstallerError(error);
  return {
    skillName,
    agentId,
    code: normalized.code,
    message: normalized.message,
  };
}

export function normalizeSkillError(
  selector: SkillSelector,
  error: unknown,
): { skillName: string; code: string; message: string } {
  const normalized = ensureInstallerError(error);
  return {
    skillName: selector.name ?? selector.id ?? selector.source?.locator ?? "unknown-skill",
    code: normalized.code,
    message: normalized.message,
  };
}

export function assertPlanStillMatchesInput(
  storedPlan: { requestedSkills: string[]; agents: string[]; scope: Scope; modeRequested: string },
  input: {
    skills: SkillSelector[];
    agents?: AgentId[];
    scope?: Scope;
    mode?: RequestedInstallMode;
  },
): void {
  const expectedScope = input.scope ?? "project";
  const expectedMode = input.mode ?? "auto";
  const expectedSkills = input.skills.map(normalizeSkillSelector);
  const expectedAgents = [...(input.agents ?? [])].sort();

  if (storedPlan.scope !== expectedScope) {
    throw new InstallerError("PLAN_MISMATCH", "Stored plan scope no longer matches install input.");
  }

  if (storedPlan.modeRequested !== expectedMode) {
    throw new InstallerError("PLAN_MISMATCH", "Stored plan mode no longer matches install input.");
  }

  if (JSON.stringify([...storedPlan.requestedSkills].sort()) !== JSON.stringify([...expectedSkills].sort())) {
    throw new InstallerError("PLAN_MISMATCH", "Stored plan skills no longer match install input.");
  }

  if (input.agents && JSON.stringify([...storedPlan.agents].sort()) !== JSON.stringify(expectedAgents)) {
    throw new InstallerError("PLAN_MISMATCH", "Stored plan agents no longer match install input.");
  }
}

export function normalizeSkillSelector(selector: SkillSelector): string {
  return selector.name ?? selector.id ?? selector.source?.locator ?? "unknown-selector";
}

function computeFetchedSkillHash(fetched: FetchedSkill): string {
  const hash = createHash("sha256");
  const files = [...fetched.files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  for (const file of files) {
    hash.update(`file:${normalizeRelativePath(file.relativePath)}\n`, "utf8");
    hash.update(file.content, "utf8");
    hash.update("\n", "utf8");
  }

  return `sha256:${hash.digest("hex")}`;
}

function detectSkillFeaturesFromFetched(fetched: FetchedSkill) {
  const paths = fetched.files.map((file) => normalizeRelativePath(file.relativePath));

  return {
    hasScripts: paths.some((file) => file === "scripts" || file.startsWith("scripts/")),
    hasReferences: paths.some((file) => file === "references" || file.startsWith("references/")),
    hasAssets: paths.some((file) => file === "assets" || file.startsWith("assets/")),
    hasMcpConfig: paths.includes("mcp.json"),
    nonPortableFields: [] as string[],
  } satisfies Awaited<ReturnType<typeof detectSkillFeatures>>;
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export type InstallerLockStore = LockStore;
export type InstallerManifestStore = ManifestStore;
export type InstallerPlanStore = PlanStore;

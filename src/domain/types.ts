export const AgentIdValues = [
  "claude-code",
  "cursor",
  "opencode",
  "codex",
  "windsurf",
  "amp",
] as const;

export const ScopeValues = ["project", "global"] as const;
export const ScopeOrAllValues = ["project", "global", "all"] as const;

export const RequestedInstallModeValues = ["auto", "symlink", "copy"] as const;
export const ResolvedInstallModeValues = ["direct", "symlink", "copy"] as const;

export const SupportTierValues = ["tier-a", "tier-b", "tier-c"] as const;
export const TargetStatusValues = [
  "installed",
  "installed_with_warnings",
  "out_of_sync",
  "broken",
  "manual_required",
] as const;

export const SeverityValues = ["info", "warning", "error"] as const;
export const SourceTypeValues = ["skills.sh", "git", "local"] as const;
export const ResultStatusValues = ["success", "partial", "error"] as const;

export type AgentId = (typeof AgentIdValues)[number];
export type Scope = (typeof ScopeValues)[number];
export type ScopeOrAll = (typeof ScopeOrAllValues)[number];

export type RequestedInstallMode = (typeof RequestedInstallModeValues)[number];
export type ResolvedInstallMode = (typeof ResolvedInstallModeValues)[number];

export type SupportTier = (typeof SupportTierValues)[number];
export type TargetStatus = (typeof TargetStatusValues)[number];
export type Severity = (typeof SeverityValues)[number];
export type SourceType = (typeof SourceTypeValues)[number];
export type ResultStatus = (typeof ResultStatusValues)[number];

export type DetectionMethod = "binary" | "config-dir" | "path-only" | "unknown";

export interface SkillSourceRef {
  type: SourceType;
  locator: string;
  revision?: string;
}

export interface SkillSelector {
  id?: string;
  name?: string;
  source?: SkillSourceRef;
}

export interface SkillManifest {
  name: string;
  description: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

export interface SkillFeatures {
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  hasMcpConfig: boolean;
  nonPortableFields: string[];
}

export interface SkillRecord {
  name: string;
  manifest: SkillManifest;
  source: SkillSourceRef;
  canonicalDir: string;
  canonicalSkillFile: string;
  contentHash: string;
  features: SkillFeatures;
}

export interface FetchedSkillFile {
  relativePath: string;
  content: string;
  executable?: boolean;
}

export interface FetchedSkill {
  source: SkillSourceRef;
  revision?: string;
  files: FetchedSkillFile[];
}

export interface WarningItem {
  code: string;
  message: string;
  severity: Severity;
  agentId?: AgentId;
  skillName?: string;
}

export interface ErrorItem {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ToolResult<T> {
  status: ResultStatus;
  data?: T;
  warnings?: WarningItem[];
  error?: ErrorItem;
}

export interface AgentDetection {
  detected: boolean;
  detectionMethod: DetectionMethod;
  installableWithoutDetection: boolean;
  notes: string[];
}

export interface AgentCapabilities {
  agentId: AgentId;
  supportTier: SupportTier;
  supportsProjectScope: boolean;
  supportsGlobalScope: boolean;
  supportsDirect: boolean;
  supportsSymlink: boolean;
  supportsCopy: boolean;
  supportsAllowedTools: boolean;
  requiresExtraConfig: boolean;
  supportsBundledMcpConfig: boolean;
  notes: string[];
}

export interface ExecutionContext {
  workspaceRoot?: string;
  homeDir: string;
  platform: NodeJS.Platform;
  nowIso: string;
}

export type AdapterContext = ExecutionContext;

export interface ResolveTargetInput {
  skill: SkillRecord;
  scope: Scope;
  requestedMode: RequestedInstallMode;
}

export interface ResolvedTarget {
  agentId: AgentId;
  scope: Scope;
  mode: ResolvedInstallMode;
  canonicalDir: string;
  canonicalSkillFile: string;
  targetDir: string;
  targetSkillFile: string;
  requiresManualStep: boolean;
  notes: string[];
  warnings: WarningItem[];
}

export interface PlannedTargetAction {
  agentId: AgentId;
  skillName: string;
  scope: Scope;
  action: "direct" | "link" | "copy" | "skip";
  mode: ResolvedInstallMode;
  canonicalDir: string;
  targetDir: string;
  targetSkillFile: string;
  status: "planned" | "manual_required";
  notes: string[];
  warnings: WarningItem[];
}

export interface ApplyTargetInput {
  skill: SkillRecord;
  resolved: ResolvedTarget;
}

export interface ApplyTargetResult {
  agentId: AgentId;
  skillName: string;
  scope: Scope;
  mode: ResolvedInstallMode;
  targetDir: string;
  action: "installed" | "updated" | "linked" | "copied" | "skipped";
  status: "installed" | "installed_with_warnings";
  warnings: WarningItem[];
}

export interface VerifyIssue {
  code: string;
  message: string;
  severity: Severity;
}

export interface VerifyTargetInput {
  skill: SkillRecord;
  scope: Scope;
  expectedMode?: ResolvedInstallMode;
  targetDir?: string;
}

export interface VerifyTargetResult {
  agentId: AgentId;
  skillName: string;
  scope: Scope;
  ok: boolean;
  status: TargetStatus;
  mode?: ResolvedInstallMode;
  targetDir: string;
  issues: VerifyIssue[];
  warnings: WarningItem[];
  checkedAt: string;
}

export interface SyncTargetInput {
  skill: SkillRecord;
  scope: Scope;
}

export interface SyncTargetResult {
  agentId: AgentId;
  skillName: string;
  scope: Scope;
  action: "relinked" | "recopied" | "unchanged" | "manual_required";
  status: TargetStatus;
  targetDir: string;
  warnings: WarningItem[];
}

export interface RemoveTargetInput {
  skillName: string;
  scope: Scope;
  targetDir?: string;
}

export interface RemoveTargetResult {
  agentId: AgentId;
  skillName: string;
  scope: Scope;
  removed: boolean;
  targetDir: string;
  warnings: WarningItem[];
}

export interface ManifestTargetEntry {
  agentId: AgentId;
  scope: Scope;
  mode: ResolvedInstallMode;
  targetPath: string;
  status: TargetStatus;
  lastVerifiedAt?: string;
  lastSyncAt?: string;
}

export interface ManifestSkillEntry {
  name: string;
  scope: Scope;
  source: SkillSourceRef;
  canonical: {
    path: string;
    contentHash: string;
    installedAt: string;
    updatedAt: string;
  };
  features: SkillFeatures;
  targets: ManifestTargetEntry[];
  warnings: WarningItem[];
  lastPlanFingerprint?: string;
}

export interface ManifestDocument {
  manifestVersion: 1;
  scope: Scope;
  workspaceRoot?: string;
  updatedAt: string;
  skills: Record<string, ManifestSkillEntry>;
}

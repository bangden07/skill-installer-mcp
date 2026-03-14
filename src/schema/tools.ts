import { z } from "zod";
import {
  AgentCapabilitiesSchema,
  AgentIdSchema,
  RequestedInstallModeSchema,
  ResolvedInstallModeSchema,
  ScopeOrAllSchema,
  ScopeSchema,
  SeveritySchema,
  SkillSelectorSchema,
  SkillSourceRefSchema,
  TargetStatusSchema,
  ToolResultSchema,
  WarningItemSchema,
  SourceTypeSchema,
} from "./common.js";

export const AnalyzeProjectInputSchema = z
  .object({
    workspacePath: z.string().min(1).optional(),
    includeAgents: z.boolean().optional(),
    includeFiles: z.boolean().optional(),
  })
  .strict();

export const AnalyzeProjectOutputDataSchema = z
  .object({
    workspacePath: z.string().min(1),
    projectKinds: z.array(z.string()),
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    packageManagers: z.array(z.string()),
    signals: z.array(z.string()),
    manifestFiles: z.array(z.string()).optional(),
    detectedAgents: z.array(AgentCapabilitiesSchema).optional(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const AnalyzeProjectOutputSchema = ToolResultSchema(
  AnalyzeProjectOutputDataSchema,
);

export const RecommendSkillsInputSchema = z
  .object({
    goal: z.string().min(1),
    workspacePath: z.string().min(1).optional(),
    agents: z.array(AgentIdSchema).min(1).optional(),
    topK: z.number().int().min(1).max(20).optional(),
    includeInstalled: z.boolean().optional(),
    sources: z.array(SourceTypeSchema).min(1).optional(),
    useRerank: z.boolean().optional(),
  })
  .strict();

export const RecommendationItemSchema = z
  .object({
    rank: z.number().int().min(1),
    score: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    id: z.string().min(1),
    name: z.string().min(1),
    source: SkillSourceRefSchema,
    reasons: z.array(z.string().min(1)).min(1),
    supportedAgents: z.array(AgentIdSchema),
    warnings: z.array(WarningItemSchema),
    installRef: SkillSelectorSchema,
  })
  .strict();

export const RecommendSkillsOutputDataSchema = z
  .object({
    goal: z.string().min(1),
    analyzedContext: z
      .object({
        projectKinds: z.array(z.string()),
        frameworks: z.array(z.string()),
        signals: z.array(z.string()),
      })
      .strict()
      .optional(),
    recommendations: z.array(RecommendationItemSchema),
  })
  .strict();

export const RecommendSkillsOutputSchema = ToolResultSchema(
  RecommendSkillsOutputDataSchema,
);

export const PlanSkillInstallInputSchema = z
  .object({
    skills: z.array(SkillSelectorSchema).min(1),
    workspacePath: z.string().min(1).optional(),
    agents: z.array(AgentIdSchema).min(1).optional(),
    scope: ScopeSchema.optional(),
    mode: RequestedInstallModeSchema.optional(),
    allowCopyFallback: z.boolean().optional(),
  })
  .strict();

export const PlanCanonicalActionSchema = z
  .object({
    skillName: z.string().min(1),
    action: z.enum(["install", "update", "skip"]),
    canonicalPath: z.string().min(1),
    source: SkillSourceRefSchema,
  })
  .strict();

export const PlanTargetActionSchema = z
  .object({
    skillName: z.string().min(1),
    agentId: AgentIdSchema,
    action: z.enum(["link", "copy", "direct", "skip"]),
    targetPath: z.string().min(1),
    status: z.enum(["planned", "manual_required"]),
    notes: z.array(z.string()),
  })
  .strict();

export const PlanSkillInstallOutputDataSchema = z
  .object({
    planFingerprint: z.string().min(1),
    scope: ScopeSchema,
    modeResolved: z.union([
      RequestedInstallModeSchema,
      z.literal("mixed"),
      z.literal("direct"),
    ]),
    canonicalActions: z.array(PlanCanonicalActionSchema),
    targetActions: z.array(PlanTargetActionSchema),
    summary: z
      .object({
        skillsCount: z.number().int().min(0),
        targetCount: z.number().int().min(0),
        plannedInstalls: z.number().int().min(0),
        plannedSkips: z.number().int().min(0),
        manualSteps: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export const PlanSkillInstallOutputSchema = ToolResultSchema(
  PlanSkillInstallOutputDataSchema,
);

export const InstallSkillsInputSchema = z
  .object({
    skills: z.array(SkillSelectorSchema).min(1),
    workspacePath: z.string().min(1).optional(),
    agents: z.array(AgentIdSchema).min(1).optional(),
    scope: ScopeSchema.optional(),
    mode: RequestedInstallModeSchema.optional(),
    allowCopyFallback: z.boolean().optional(),
    expectedPlanFingerprint: z.string().min(1).optional(),
  })
  .strict();

export const InstallResultItemSchema = z
  .object({
    skillName: z.string().min(1),
    agentId: z.union([AgentIdSchema, z.literal("canonical")]),
    path: z.string().min(1),
    action: z.enum(["installed", "updated", "linked", "copied", "skipped"]),
    status: z.enum(["installed", "installed_with_warnings"]),
  })
  .strict();

export const InstallSkippedItemSchema = z
  .object({
    skillName: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

export const InstallFailedItemSchema = z
  .object({
    skillName: z.string().min(1),
    agentId: AgentIdSchema.optional(),
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const InstallSkillsOutputDataSchema = z
  .object({
    scope: ScopeSchema,
    modeResolved: z.union([ResolvedInstallModeSchema, z.literal("mixed")]),
    installed: z.array(InstallResultItemSchema),
    skipped: z.array(InstallSkippedItemSchema),
    failed: z.array(InstallFailedItemSchema),
    manifestUpdated: z.boolean(),
  })
  .strict();

export const InstallSkillsOutputSchema = ToolResultSchema(
  InstallSkillsOutputDataSchema,
);

export const ListInstalledSkillsInputSchema = z
  .object({
    workspacePath: z.string().min(1).optional(),
    scope: ScopeOrAllSchema.optional(),
    agents: z.array(AgentIdSchema).min(1).optional(),
    includeBroken: z.boolean().optional(),
  })
  .strict();

export const InstalledTargetSchema = z
  .object({
    agentId: AgentIdSchema,
    scope: ScopeSchema,
    targetPath: z.string().min(1),
    mode: ResolvedInstallModeSchema,
    status: TargetStatusSchema,
    lastVerifiedAt: z.string().datetime().optional(),
  })
  .strict();

export const InstalledSkillSchema = z
  .object({
    name: z.string().min(1),
    source: SkillSourceRefSchema,
    canonicalPath: z.string().min(1),
    targets: z.array(InstalledTargetSchema),
  })
  .strict();

export const ListInstalledSkillsOutputDataSchema = z
  .object({
    skills: z.array(InstalledSkillSchema),
  })
  .strict();

export const ListInstalledSkillsOutputSchema = ToolResultSchema(
  ListInstalledSkillsOutputDataSchema,
);

export const SyncSkillsInputSchema = z
  .object({
    skills: z.array(z.string().min(1)).optional(),
    workspacePath: z.string().min(1).optional(),
    scope: ScopeOrAllSchema.optional(),
    agents: z.array(AgentIdSchema).min(1).optional(),
    repairBroken: z.boolean().optional(),
  })
  .strict();

export const SyncRepairedItemSchema = z
  .object({
    skillName: z.string().min(1),
    agentId: AgentIdSchema,
    action: z.enum(["relinked", "recopied", "manifest-fixed"]),
    path: z.string().min(1),
  })
  .strict();

export const SyncUnchangedItemSchema = z
  .object({
    skillName: z.string().min(1),
    agentId: AgentIdSchema,
  })
  .strict();

export const SyncFailedItemSchema = z
  .object({
    skillName: z.string().min(1),
    agentId: AgentIdSchema.optional(),
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const SyncSkillsOutputDataSchema = z
  .object({
    checked: z.number().int().min(0),
    repaired: z.array(SyncRepairedItemSchema),
    unchanged: z.array(SyncUnchangedItemSchema),
    failed: z.array(SyncFailedItemSchema),
  })
  .strict();

export const SyncSkillsOutputSchema = ToolResultSchema(
  SyncSkillsOutputDataSchema,
);

export const UpdateSkillsInputSchema = z
  .object({
    skills: z.array(z.string().min(1)).optional(),
    workspacePath: z.string().min(1).optional(),
    scope: ScopeOrAllSchema.optional(),
    agents: z.array(AgentIdSchema).min(1).optional(),
    reapplyTargets: z.boolean().optional(),
  })
  .strict();

export const UpdatedSkillItemSchema = z
  .object({
    skillName: z.string().min(1),
    fromRevision: z.string().min(1).optional(),
    toRevision: z.string().min(1).optional(),
    targetsReapplied: z.number().int().min(0),
  })
  .strict();

export const UpdateFailedItemSchema = z
  .object({
    skillName: z.string().min(1),
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const UpdateSkillsOutputDataSchema = z
  .object({
    updated: z.array(UpdatedSkillItemSchema),
    unchanged: z.array(z.string().min(1)),
    failed: z.array(UpdateFailedItemSchema),
  })
  .strict();

export const UpdateSkillsOutputSchema = ToolResultSchema(
  UpdateSkillsOutputDataSchema,
);

export const RemoveSkillsInputSchema = z
  .object({
    skills: z.array(z.string().min(1)).min(1),
    workspacePath: z.string().min(1).optional(),
    scope: ScopeOrAllSchema.optional(),
    agents: z.array(AgentIdSchema).min(1).optional(),
    purgeCanonical: z.boolean().optional(),
  })
  .strict();

export const RemovedTargetItemSchema = z
  .object({
    skillName: z.string().min(1),
    agentId: AgentIdSchema,
    path: z.string().min(1),
  })
  .strict();

export const RemoveFailedItemSchema = z
  .object({
    skillName: z.string().min(1),
    agentId: AgentIdSchema.optional(),
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const RemoveSkillsOutputDataSchema = z
  .object({
    removedTargets: z.array(RemovedTargetItemSchema),
    purgedCanonical: z.array(z.string().min(1)),
    failed: z.array(RemoveFailedItemSchema),
  })
  .strict();

export const RemoveSkillsOutputSchema = ToolResultSchema(
  RemoveSkillsOutputDataSchema,
);

export const DoctorSkillsInputSchema = z
  .object({
    workspacePath: z.string().min(1).optional(),
    scope: ScopeOrAllSchema.optional(),
    agents: z.array(AgentIdSchema).min(1).optional(),
    deep: z.boolean().optional(),
  })
  .strict();

export const DoctorIssueSchema = z
  .object({
    code: z.string().min(1),
    severity: SeveritySchema,
    skillName: z.string().min(1).optional(),
    agentId: AgentIdSchema.optional(),
    message: z.string().min(1),
    suggestedAction: z
      .enum(["sync_skills", "remove_skills", "update_skills"])
      .optional(),
  })
  .strict();

export const DoctorSkillsOutputDataSchema = z
  .object({
    summary: z
      .object({
        ok: z.boolean(),
        skillsChecked: z.number().int().min(0),
        issuesFound: z.number().int().min(0),
      })
      .strict(),
    issues: z.array(DoctorIssueSchema),
  })
  .strict();

export const DoctorSkillsOutputSchema = ToolResultSchema(
  DoctorSkillsOutputDataSchema,
);

export const ListSupportedAgentsInputSchema = z
  .object({
    includeDetection: z.boolean().optional(),
  })
  .strict();

export const ListSupportedAgentsOutputDataSchema = z
  .object({
    agents: z.array(AgentCapabilitiesSchema),
  })
  .strict();

export const ListSupportedAgentsOutputSchema = ToolResultSchema(
  ListSupportedAgentsOutputDataSchema,
);

export type AnalyzeProjectInput = z.infer<typeof AnalyzeProjectInputSchema>;
export type AnalyzeProjectOutput = z.infer<typeof AnalyzeProjectOutputSchema>;

export type RecommendSkillsInput = z.infer<typeof RecommendSkillsInputSchema>;
export type RecommendSkillsOutput = z.infer<typeof RecommendSkillsOutputSchema>;

export type PlanSkillInstallInput = z.infer<typeof PlanSkillInstallInputSchema>;
export type PlanSkillInstallOutput = z.infer<typeof PlanSkillInstallOutputSchema>;

export type InstallSkillsInput = z.infer<typeof InstallSkillsInputSchema>;
export type InstallSkillsOutput = z.infer<typeof InstallSkillsOutputSchema>;

export type ListInstalledSkillsInput = z.infer<
  typeof ListInstalledSkillsInputSchema
>;
export type ListInstalledSkillsOutput = z.infer<
  typeof ListInstalledSkillsOutputSchema
>;

export type SyncSkillsInput = z.infer<typeof SyncSkillsInputSchema>;
export type SyncSkillsOutput = z.infer<typeof SyncSkillsOutputSchema>;

export type UpdateSkillsInput = z.infer<typeof UpdateSkillsInputSchema>;
export type UpdateSkillsOutput = z.infer<typeof UpdateSkillsOutputSchema>;

export type RemoveSkillsInput = z.infer<typeof RemoveSkillsInputSchema>;
export type RemoveSkillsOutput = z.infer<typeof RemoveSkillsOutputSchema>;

export type DoctorSkillsInput = z.infer<typeof DoctorSkillsInputSchema>;
export type DoctorSkillsOutput = z.infer<typeof DoctorSkillsOutputSchema>;

export type ListSupportedAgentsInput = z.infer<
  typeof ListSupportedAgentsInputSchema
>;
export type ListSupportedAgentsOutput = z.infer<
  typeof ListSupportedAgentsOutputSchema
>;

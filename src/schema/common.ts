import { z } from "zod";
import {
  AgentIdValues,
  RequestedInstallModeValues,
  ResolvedInstallModeValues,
  ResultStatusValues,
  ScopeOrAllValues,
  ScopeValues,
  SeverityValues,
  SourceTypeValues,
  SupportTierValues,
  TargetStatusValues,
} from "../domain/types.js";

export const AgentIdSchema = z.enum(AgentIdValues);
export const ScopeSchema = z.enum(ScopeValues);
export const ScopeOrAllSchema = z.enum(ScopeOrAllValues);

export const RequestedInstallModeSchema = z.enum(RequestedInstallModeValues);
export const ResolvedInstallModeSchema = z.enum(ResolvedInstallModeValues);

export const SupportTierSchema = z.enum(SupportTierValues);
export const TargetStatusSchema = z.enum(TargetStatusValues);
export const SeveritySchema = z.enum(SeverityValues);
export const SourceTypeSchema = z.enum(SourceTypeValues);
export const ResultStatusSchema = z.enum(ResultStatusValues);

export const WarningItemSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    severity: SeveritySchema,
    agentId: AgentIdSchema.optional(),
    skillName: z.string().min(1).optional(),
  })
  .strict();

export const ErrorItemSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const SkillSourceRefSchema = z
  .object({
    type: SourceTypeSchema,
    locator: z.string().min(1),
    revision: z.string().min(1).optional(),
  })
  .strict();

export const SkillSelectorSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    source: SkillSourceRefSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.id || value.name || value.source),
    { message: "At least one of id, name, or source is required." },
  );

export const SkillManifestSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    compatibility: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const SkillFeaturesSchema = z
  .object({
    hasScripts: z.boolean(),
    hasReferences: z.boolean(),
    hasAssets: z.boolean(),
    hasMcpConfig: z.boolean(),
    nonPortableFields: z.array(z.string()),
  })
  .strict();

export const AgentDetectionSchema = z
  .object({
    detected: z.boolean(),
    detectionMethod: z.enum(["binary", "config-dir", "path-only", "unknown"]),
    installableWithoutDetection: z.boolean(),
    notes: z.array(z.string()),
  })
  .strict();

export const AgentCapabilitiesSchema = z
  .object({
    agentId: AgentIdSchema,
    supportTier: SupportTierSchema,
    supportsProjectScope: z.boolean(),
    supportsGlobalScope: z.boolean(),
    supportsDirect: z.boolean(),
    supportsSymlink: z.boolean(),
    supportsCopy: z.boolean(),
    supportsAllowedTools: z.boolean(),
    requiresExtraConfig: z.boolean(),
    supportsBundledMcpConfig: z.boolean(),
    notes: z.array(z.string()),
  })
  .strict();

export const ManifestTargetEntrySchema = z
  .object({
    agentId: AgentIdSchema,
    scope: ScopeSchema,
    mode: ResolvedInstallModeSchema,
    targetPath: z.string().min(1),
    status: TargetStatusSchema,
    lastVerifiedAt: z.string().datetime().optional(),
    lastSyncAt: z.string().datetime().optional(),
  })
  .strict();

export const ManifestSkillEntrySchema = z
  .object({
    name: z.string().min(1),
    scope: ScopeSchema,
    source: SkillSourceRefSchema,
    canonical: z
      .object({
        path: z.string().min(1),
        contentHash: z.string().min(1),
        installedAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .strict(),
    features: SkillFeaturesSchema,
    targets: z.array(ManifestTargetEntrySchema),
    warnings: z.array(WarningItemSchema),
    lastPlanFingerprint: z.string().min(1).optional(),
  })
  .strict();

export const ManifestDocumentSchema = z
  .object({
    manifestVersion: z.literal(1),
    scope: ScopeSchema,
    workspaceRoot: z.string().min(1).optional(),
    updatedAt: z.string().datetime(),
    skills: z.record(z.string(), ManifestSkillEntrySchema),
  })
  .strict();

export const ToolResultSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z
    .object({
      status: ResultStatusSchema,
      data: dataSchema.optional(),
      warnings: z.array(WarningItemSchema).optional(),
      error: ErrorItemSchema.optional(),
    })
    .strict();

export type AgentIdInput = z.infer<typeof AgentIdSchema>;
export type ScopeInput = z.infer<typeof ScopeSchema>;
export type ScopeOrAllInput = z.infer<typeof ScopeOrAllSchema>;
export type RequestedInstallModeInput = z.infer<typeof RequestedInstallModeSchema>;
export type ResolvedInstallModeInput = z.infer<typeof ResolvedInstallModeSchema>;
export type WarningItemInput = z.infer<typeof WarningItemSchema>;
export type ErrorItemInput = z.infer<typeof ErrorItemSchema>;
export type SkillSourceRefInput = z.infer<typeof SkillSourceRefSchema>;
export type SkillSelectorInput = z.infer<typeof SkillSelectorSchema>;
export type SkillManifestInput = z.infer<typeof SkillManifestSchema>;
export type SkillFeaturesInput = z.infer<typeof SkillFeaturesSchema>;
export type AgentDetectionInput = z.infer<typeof AgentDetectionSchema>;
export type AgentCapabilitiesInput = z.infer<typeof AgentCapabilitiesSchema>;
export type ManifestTargetEntryInput = z.infer<typeof ManifestTargetEntrySchema>;
export type ManifestSkillEntryInput = z.infer<typeof ManifestSkillEntrySchema>;
export type ManifestDocumentInput = z.infer<typeof ManifestDocumentSchema>;

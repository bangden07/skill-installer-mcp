import fs from "node:fs/promises";
import path from "node:path";
import { InstallerError } from "../../domain/errors.js";
import type {
  AdapterContext,
  AgentCapabilities,
  AgentDetection,
  AgentId,
  ApplyTargetInput,
  ApplyTargetResult,
  PlannedTargetAction,
  RemoveTargetInput,
  RemoveTargetResult,
  RequestedInstallMode,
  ResolveTargetInput,
  ResolvedInstallMode,
  ResolvedTarget,
  Scope,
  SkillRecord,
  SyncTargetInput,
  SyncTargetResult,
  TargetStatus,
  VerifyIssue,
  VerifyTargetInput,
  VerifyTargetResult,
  WarningItem,
} from "../../domain/types.js";
import { parseSkillFileContent } from "../../skill-parser/parse-skill.js";
import { validateParsedSkillFile } from "../../skill-parser/validate-skill.js";
import {
  copyDirectory,
  createSymlink,
  ensureParentDir,
  isSymlink,
  pathExists,
  readText,
  realpathSafe,
  removePathIfExists,
} from "../../utils/fs.js";
import { computeDirectoryHash } from "../../utils/hash.js";
import { checkSymlinkSupport } from "../../utils/platform.js";

export interface AgentAdapter {
  readonly agentId: AgentId;
  readonly displayName: string;

  detect(ctx: AdapterContext): Promise<AgentDetection>;
  getCapabilities(ctx: AdapterContext): Promise<AgentCapabilities>;

  resolveTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget>;

  planInstall(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<PlannedTargetAction>;

  applyInstall(
    ctx: AdapterContext,
    input: ApplyTargetInput,
  ): Promise<ApplyTargetResult>;

  verifyInstall(
    ctx: AdapterContext,
    input: VerifyTargetInput,
  ): Promise<VerifyTargetResult>;

  syncInstall(
    ctx: AdapterContext,
    input: SyncTargetInput,
  ): Promise<SyncTargetResult>;

  removeInstall(
    ctx: AdapterContext,
    input: RemoveTargetInput,
  ): Promise<RemoveTargetResult>;
}

export abstract class BaseAgentAdapter implements AgentAdapter {
  abstract readonly agentId: AgentId;
  abstract readonly displayName: string;

  abstract detect(ctx: AdapterContext): Promise<AgentDetection>;
  abstract getCapabilities(ctx: AdapterContext): Promise<AgentCapabilities>;

  protected abstract resolveNativeTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget>;

  protected getCompatibilityWarnings(_skill: SkillRecord): WarningItem[] {
    return [];
  }

  protected async afterApply(
    _ctx: AdapterContext,
    _input: ApplyTargetInput,
    _result: ApplyTargetResult,
  ): Promise<void> {}

  protected async customVerify(
    _ctx: AdapterContext,
    _input: VerifyTargetInput,
    _resolved: ResolvedTarget,
  ): Promise<WarningItem[]> {
    return [];
  }

  async resolveTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<ResolvedTarget> {
    const resolved = await this.resolveNativeTarget(ctx, input);

    return {
      ...resolved,
      warnings: [
        ...resolved.warnings,
        ...this.getCompatibilityWarnings(input.skill),
      ],
    };
  }

  async planInstall(
    ctx: AdapterContext,
    input: ResolveTargetInput,
  ): Promise<PlannedTargetAction> {
    const resolved = await this.resolveTarget(ctx, input);

    return {
      agentId: this.agentId,
      skillName: input.skill.name,
      scope: input.scope,
      action: this.modeToPlanAction(resolved.mode),
      mode: resolved.mode,
      canonicalDir: resolved.canonicalDir,
      targetDir: resolved.targetDir,
      targetSkillFile: resolved.targetSkillFile,
      status: resolved.requiresManualStep ? "manual_required" : "planned",
      notes: resolved.notes,
      warnings: resolved.warnings,
    };
  }

  async applyInstall(
    ctx: AdapterContext,
    input: ApplyTargetInput,
  ): Promise<ApplyTargetResult> {
    const { skill, resolved } = input;
    await this.assertCanonicalSkillExists(skill);

    if (resolved.mode === "direct") {
      const result: ApplyTargetResult = {
        agentId: this.agentId,
        skillName: skill.name,
        scope: resolved.scope,
        mode: "direct",
        targetDir: resolved.targetDir,
        action: "installed",
        status: resolved.warnings.length > 0
          ? "installed_with_warnings"
          : "installed",
        warnings: resolved.warnings,
      };

      await this.afterApply(ctx, input, result);
      return result;
    }

    await ensureParentDir(resolved.targetDir);
    await this.removeTargetIfConflicting(resolved.targetDir);

    let effectiveMode = resolved.mode;
    const warnings = [...resolved.warnings];

    if (resolved.mode === "symlink") {
      const symlinkSupport = await checkSymlinkSupport(path.dirname(resolved.targetDir));

      if (!symlinkSupport.supported) {
        effectiveMode = "copy";
        warnings.push({
          code: "COPY_FALLBACK_USED",
          message: symlinkSupport.reason
            ? `Symlink unavailable; used copy fallback. ${symlinkSupport.reason}`
            : "Symlink unavailable; used copy fallback.",
          severity: "warning",
          agentId: this.agentId,
          skillName: skill.name,
        });
      }
    }

    if (effectiveMode === "symlink") {
      try {
        await createSymlink(resolved.canonicalDir, resolved.targetDir);
      } catch (error) {
        effectiveMode = "copy";
        warnings.push({
          code: "COPY_FALLBACK_USED",
          message: error instanceof Error
            ? `Symlink failed; used copy fallback. ${error.message}`
            : "Symlink failed; used copy fallback.",
          severity: "warning",
          agentId: this.agentId,
          skillName: skill.name,
        });
      }
    }

    if (effectiveMode === "copy") {
      await copyDirectory(resolved.canonicalDir, resolved.targetDir);
    }

    const result: ApplyTargetResult = {
      agentId: this.agentId,
      skillName: skill.name,
      scope: resolved.scope,
      mode: effectiveMode,
      targetDir: resolved.targetDir,
      action: effectiveMode === "symlink" ? "linked" : "copied",
      status: warnings.length > 0 ? "installed_with_warnings" : "installed",
      warnings,
    };

    await this.afterApply(ctx, input, result);
    return result;
  }

  async verifyInstall(
    ctx: AdapterContext,
    input: VerifyTargetInput,
  ): Promise<VerifyTargetResult> {
    const resolved = await this.resolveTarget(ctx, {
      skill: input.skill,
      scope: input.scope,
      requestedMode: this.expectedModeToRequestedMode(input.expectedMode),
    });

    const targetDir = input.targetDir ?? resolved.targetDir;
    const issues: VerifyIssue[] = [];
    const warnings = [...resolved.warnings];

    await this.assertCanonicalSkillExists(input.skill);

    if (resolved.mode === "direct") {
      const canonicalOk = await this.isValidSkillDir(input.skill.canonicalDir);
      if (!canonicalOk) {
        issues.push({
          code: "CANONICAL_MISSING",
          message: "Canonical skill directory is missing or invalid.",
          severity: "error",
        });
      }
    } else {
      const exists = await pathExists(targetDir);
      if (!exists) {
        issues.push({
          code: "TARGET_MISSING",
          message: "Target directory does not exist.",
          severity: "error",
        });
      } else if (resolved.mode === "symlink") {
        const linkOk = await this.verifySymlinkPointsTo(targetDir, input.skill.canonicalDir);
        if (!linkOk) {
          issues.push({
            code: "BROKEN_SYMLINK",
            message: "Symlink is broken or points to the wrong canonical directory.",
            severity: "error",
          });
        }
      } else {
        const copyOk = await this.verifyCopiedContent(input.skill.canonicalDir, targetDir);
        if (!copyOk) {
          issues.push({
            code: "OUT_OF_SYNC_COPY",
            message: "Copied target differs from canonical content.",
            severity: "warning",
          });
        }
      }

      const targetSkillFile = this.joinSkillFile(targetDir);
      const skillFileOk = await this.isValidSkillFile(targetSkillFile);
      if (!skillFileOk) {
        issues.push({
          code: "INVALID_SKILL_FILE",
          message: "Target SKILL.md is missing or invalid.",
          severity: "error",
        });
      }
    }

    const extraWarnings = await this.customVerify(ctx, input, resolved);
    warnings.push(...extraWarnings);

    const ok = !issues.some((issue) => issue.severity === "error");

    return {
      agentId: this.agentId,
      skillName: input.skill.name,
      scope: input.scope,
      ok,
      status: this.resolveVerifyStatus(ok, issues, warnings),
      mode: resolved.mode,
      targetDir,
      issues,
      warnings,
      checkedAt: ctx.nowIso,
    };
  }

  async syncInstall(
    ctx: AdapterContext,
    input: SyncTargetInput,
  ): Promise<SyncTargetResult> {
    const resolved = await this.resolveTarget(ctx, {
      skill: input.skill,
      scope: input.scope,
      requestedMode: "auto",
    });

    const verify = await this.verifyInstall(ctx, {
      skill: input.skill,
      scope: input.scope,
      expectedMode: resolved.mode,
      targetDir: resolved.targetDir,
    });

    if (verify.ok) {
      return {
        agentId: this.agentId,
        skillName: input.skill.name,
        scope: input.scope,
        action: "unchanged",
        status: verify.status,
        targetDir: resolved.targetDir,
        warnings: verify.warnings,
      };
    }

    if (resolved.requiresManualStep) {
      return {
        agentId: this.agentId,
        skillName: input.skill.name,
        scope: input.scope,
        action: "manual_required",
        status: "manual_required",
        targetDir: resolved.targetDir,
        warnings: verify.warnings,
      };
    }

    await this.assertCanonicalSkillExists(input.skill);

    if (resolved.mode === "symlink") {
      await removePathIfExists(resolved.targetDir);
      await ensureParentDir(resolved.targetDir);
      await createSymlink(resolved.canonicalDir, resolved.targetDir);

      return {
        agentId: this.agentId,
        skillName: input.skill.name,
        scope: input.scope,
        action: "relinked",
        status: "installed",
        targetDir: resolved.targetDir,
        warnings: verify.warnings,
      };
    }

    if (resolved.mode === "copy") {
      await removePathIfExists(resolved.targetDir);
      await ensureParentDir(resolved.targetDir);
      await copyDirectory(resolved.canonicalDir, resolved.targetDir);

      return {
        agentId: this.agentId,
        skillName: input.skill.name,
        scope: input.scope,
        action: "recopied",
        status: "installed",
        targetDir: resolved.targetDir,
        warnings: verify.warnings,
      };
    }

    return {
      agentId: this.agentId,
      skillName: input.skill.name,
      scope: input.scope,
      action: "unchanged",
      status: "installed",
      targetDir: resolved.targetDir,
      warnings: verify.warnings,
    };
  }

  async removeInstall(
    _ctx: AdapterContext,
    input: RemoveTargetInput,
  ): Promise<RemoveTargetResult> {
    if (!input.targetDir) {
      throw new InstallerError(
        "TARGET_PATH_UNAVAILABLE",
        `Target path is required to remove skill '${input.skillName}' for ${this.agentId}.`,
      );
    }

    if (await pathExists(input.targetDir)) {
      await removePathIfExists(input.targetDir);
      return {
        agentId: this.agentId,
        skillName: input.skillName,
        scope: input.scope,
        removed: true,
        targetDir: input.targetDir,
        warnings: [],
      };
    }

    return {
      agentId: this.agentId,
      skillName: input.skillName,
      scope: input.scope,
      removed: false,
      targetDir: input.targetDir,
      warnings: [
        {
          code: "TARGET_MISSING",
          message: "Target did not exist; nothing removed.",
          severity: "info",
          agentId: this.agentId,
          skillName: input.skillName,
        },
      ],
    };
  }

  protected async resolveDirectTarget(
    _ctx: AdapterContext,
    input: ResolveTargetInput,
    extra?: { notes?: string[]; warnings?: WarningItem[] },
  ): Promise<ResolvedTarget> {
    return {
      agentId: this.agentId,
      scope: input.scope,
      mode: "direct",
      canonicalDir: input.skill.canonicalDir,
      canonicalSkillFile: input.skill.canonicalSkillFile,
      targetDir: input.skill.canonicalDir,
      targetSkillFile: input.skill.canonicalSkillFile,
      requiresManualStep: false,
      notes: extra?.notes ?? [],
      warnings: extra?.warnings ?? [],
    };
  }

  protected async resolveNativeExportTarget(
    ctx: AdapterContext,
    input: ResolveTargetInput,
    extra: {
      nativeDir: string;
      preferredAutoMode: "symlink" | "copy";
      notes?: string[];
      warnings?: WarningItem[];
    },
  ): Promise<ResolvedTarget> {
    const capabilities = await this.getCapabilities(ctx);
    const mode = this.resolveRequestedMode({
      requestedMode: input.requestedMode,
      supportsSymlink: capabilities.supportsSymlink,
      supportsCopy: capabilities.supportsCopy,
      preferredAutoMode: extra.preferredAutoMode,
    });

    return {
      agentId: this.agentId,
      scope: input.scope,
      mode,
      canonicalDir: input.skill.canonicalDir,
      canonicalSkillFile: input.skill.canonicalSkillFile,
      targetDir: extra.nativeDir,
      targetSkillFile: this.joinSkillFile(extra.nativeDir),
      requiresManualStep: false,
      notes: extra.notes ?? [],
      warnings: extra.warnings ?? [],
    };
  }

  protected resolveRequestedMode(input: {
    requestedMode: RequestedInstallMode;
    supportsSymlink: boolean;
    supportsCopy: boolean;
    preferredAutoMode: "symlink" | "copy";
  }): ResolvedInstallMode {
    if (input.requestedMode === "copy") {
      if (!input.supportsCopy) {
        throw new InstallerError("COPY_NOT_SUPPORTED", "Copy mode is not supported.");
      }
      return "copy";
    }

    if (input.requestedMode === "symlink") {
      if (!input.supportsSymlink) {
        throw new InstallerError("SYMLINK_NOT_SUPPORTED", "Symlink mode is not supported.");
      }
      return "symlink";
    }

    if (input.preferredAutoMode === "symlink" && input.supportsSymlink) {
      return "symlink";
    }

    if (input.supportsCopy) {
      return "copy";
    }

    throw new InstallerError(
      "TARGET_PATH_UNAVAILABLE",
      "No supported install mode available for this target.",
    );
  }

  protected async detectByBinaryOrDir(
    _ctx: AdapterContext,
    input: {
      binaries: string[];
      dirs: string[];
      installableWithoutDetection: boolean;
    },
  ): Promise<AgentDetection> {
    const foundBinary = await this.firstAvailableBinary(input.binaries);
    if (foundBinary) {
      return {
        detected: true,
        detectionMethod: "binary",
        installableWithoutDetection: input.installableWithoutDetection,
        notes: [`Detected binary: ${foundBinary}`],
      };
    }

    const foundDir = await this.firstExistingDir(input.dirs);
    if (foundDir) {
      return {
        detected: true,
        detectionMethod: "config-dir",
        installableWithoutDetection: input.installableWithoutDetection,
        notes: [`Detected config dir: ${foundDir}`],
      };
    }

    return {
      detected: false,
      detectionMethod: "unknown",
      installableWithoutDetection: input.installableWithoutDetection,
      notes: ["No binary or config directory detected."],
    };
  }

  protected async assertCanonicalSkillExists(skill: SkillRecord): Promise<void> {
    if (!(await pathExists(skill.canonicalDir))) {
      throw new InstallerError(
        "CANONICAL_MISSING",
        `Canonical skill dir missing: ${skill.canonicalDir}`,
      );
    }

    if (!(await this.isValidSkillFile(skill.canonicalSkillFile))) {
      throw new InstallerError(
        "INVALID_SKILL_FILE",
        `Canonical SKILL.md invalid: ${skill.canonicalSkillFile}`,
      );
    }
  }

  protected async removeTargetIfConflicting(targetDir: string): Promise<void> {
    if (await pathExists(targetDir)) {
      await removePathIfExists(targetDir);
    }
  }

  protected modeToPlanAction(mode: ResolvedInstallMode): "direct" | "link" | "copy" {
    if (mode === "direct") {
      return "direct";
    }

    if (mode === "symlink") {
      return "link";
    }

    return "copy";
  }

  protected resolveVerifyStatus(
    ok: boolean,
    issues: VerifyIssue[],
    warnings: WarningItem[],
  ): TargetStatus {
    if (!ok) {
      const hasHardError = issues.some((item) => item.severity === "error");
      return hasHardError ? "broken" : "out_of_sync";
    }

    if (warnings.length > 0 || issues.some((item) => item.severity === "warning")) {
      return "installed_with_warnings";
    }

    return "installed";
  }

  protected joinSkillFile(dir: string): string {
    return path.join(dir, "SKILL.md");
  }

  private expectedModeToRequestedMode(
    mode?: ResolvedInstallMode,
  ): RequestedInstallMode {
    if (mode === "copy") {
      return "copy";
    }

    if (mode === "symlink") {
      return "symlink";
    }

    return "auto";
  }

  private async isValidSkillDir(dir: string): Promise<boolean> {
    if (!(await pathExists(dir))) {
      return false;
    }

    return this.isValidSkillFile(this.joinSkillFile(dir));
  }

  private async isValidSkillFile(filePath: string): Promise<boolean> {
    if (!(await pathExists(filePath))) {
      return false;
    }

    try {
      const raw = await readText(filePath);
      const parsed = await parseSkillFileContent(raw);
      validateParsedSkillFile(parsed);
      return true;
    } catch {
      return false;
    }
  }

  private async verifySymlinkPointsTo(
    targetDir: string,
    canonicalDir: string,
  ): Promise<boolean> {
    if (!(await isSymlink(targetDir))) {
      return false;
    }

    const targetRealpath = await realpathSafe(targetDir);
    const canonicalRealpath = await realpathSafe(canonicalDir);

    if (!targetRealpath || !canonicalRealpath) {
      return false;
    }

    return path.resolve(targetRealpath) === path.resolve(canonicalRealpath);
  }

  private async verifyCopiedContent(
    canonicalDir: string,
    targetDir: string,
  ): Promise<boolean> {
    const [canonicalHash, targetHash] = await Promise.all([
      computeDirectoryHash(canonicalDir),
      computeDirectoryHash(targetDir),
    ]);

    return canonicalHash === targetHash;
  }

  private async firstAvailableBinary(binaries: string[]): Promise<string | null> {
    const pathEnv = process.env.PATH;
    if (!pathEnv) {
      return null;
    }

    const dirs = pathEnv.split(path.delimiter).filter(Boolean);
    const extensions = process.platform === "win32"
      ? ["", ".exe", ".cmd", ".bat"]
      : [""];

    for (const binary of binaries) {
      for (const dir of dirs) {
        for (const extension of extensions) {
          const candidate = path.join(dir, `${binary}${extension}`);
          try {
            await fs.access(candidate);
            return candidate;
          } catch {
            // continue
          }
        }
      }
    }

    return null;
  }

  private async firstExistingDir(dirs: string[]): Promise<string | null> {
    for (const dir of dirs) {
      if (await pathExists(dir)) {
        return dir;
      }
    }

    return null;
  }
}

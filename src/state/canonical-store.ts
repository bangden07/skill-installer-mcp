import path from "node:path";
import type { ExecutionContext, FetchedSkill, Scope, SkillFeatures, SkillRecord } from "../domain/types.js";
import { detectSkillFeatures } from "../skill-parser/feature-detect.js";
import { parseSkillFileContent } from "../skill-parser/parse-skill.js";
import { validateParsedSkillFile } from "../skill-parser/validate-skill.js";
import {
  ensureDir,
  makeTempDirNear,
  pathExists,
  readText,
  removeDir,
  renamePath,
  writeText,
} from "../utils/fs.js";
import { computeDirectoryHash, safeComputeDirectoryHash } from "../utils/hash.js";

export interface InstallCanonicalSkillInput {
  skill: SkillRecord;
  fetched: FetchedSkill;
  scope: Scope;
}

export interface InstallCanonicalSkillResult {
  canonicalDir: string;
  canonicalSkillFile: string;
  contentHash: string;
  updated: boolean;
  features: SkillFeatures;
}

export interface CanonicalStore {
  getCanonicalRoot(ctx: ExecutionContext, scope: Scope): string;
  getCanonicalSkillDir(ctx: ExecutionContext, skillName: string, scope: Scope): string;
  getCanonicalSkillFile(ctx: ExecutionContext, skillName: string, scope: Scope): string;

  installSkill(
    ctx: ExecutionContext,
    input: InstallCanonicalSkillInput,
  ): Promise<InstallCanonicalSkillResult>;

  loadInstalledSkillRecord(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
  ): Promise<SkillRecord>;

  exists(ctx: ExecutionContext, skillName: string, scope: Scope): Promise<boolean>;
  removeSkill(ctx: ExecutionContext, skillName: string, scope: Scope): Promise<void>;
}

export class CanonicalStoreImpl implements CanonicalStore {
  getCanonicalRoot(ctx: ExecutionContext, scope: Scope): string {
    if (scope === "project") {
      if (!ctx.workspaceRoot) {
        throw new Error("workspaceRoot is required for project scope.");
      }
      return path.join(ctx.workspaceRoot, ".agents", "skills");
    }

    return path.join(ctx.homeDir, ".agents", "skills");
  }

  getCanonicalSkillDir(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
  ): string {
    return path.join(this.getCanonicalRoot(ctx, scope), skillName);
  }

  getCanonicalSkillFile(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
  ): string {
    return path.join(this.getCanonicalSkillDir(ctx, skillName, scope), "SKILL.md");
  }

  async installSkill(
    ctx: ExecutionContext,
    input: InstallCanonicalSkillInput,
  ): Promise<InstallCanonicalSkillResult> {
    const canonicalRoot = this.getCanonicalRoot(ctx, input.scope);
    const canonicalDir = this.getCanonicalSkillDir(ctx, input.skill.name, input.scope);
    const canonicalSkillFile = this.getCanonicalSkillFile(ctx, input.skill.name, input.scope);

    await ensureDir(canonicalRoot);

    const stagedDir = await makeTempDirNear(canonicalRoot, `${input.skill.name}.staging-`);

    try {
      await writeFetchedSkillToDir(input.fetched, stagedDir);
      await assertValidSkillDir(stagedDir, input.skill.name);

      const nextHash = await computeDirectoryHash(stagedDir);
      const features = await detectSkillFeatures(stagedDir);

      const existed = await pathExists(canonicalDir);
      let previousHash: string | null = null;

      if (existed) {
        previousHash = await safeComputeDirectoryHash(canonicalDir);
      }

      if (previousHash && previousHash === nextHash) {
        await removeDir(stagedDir);
        return {
          canonicalDir,
          canonicalSkillFile,
          contentHash: nextHash,
          updated: false,
          features,
        };
      }

      const backupDir = `${canonicalDir}.bak-${Date.now()}`;

      if (existed) {
        await renamePath(canonicalDir, backupDir);
      }

      await renamePath(stagedDir, canonicalDir);

      if (existed) {
        await removeDir(backupDir);
      }

      return {
        canonicalDir,
        canonicalSkillFile,
        contentHash: nextHash,
        updated: existed,
        features,
      };
    } catch (error) {
      await removeDir(stagedDir);
      throw error;
    }
  }

  async loadInstalledSkillRecord(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
  ): Promise<SkillRecord> {
    const canonicalDir = this.getCanonicalSkillDir(ctx, skillName, scope);
    const canonicalSkillFile = this.getCanonicalSkillFile(ctx, skillName, scope);

    await assertValidSkillDir(canonicalDir, skillName);

    const raw = await readText(canonicalSkillFile);
    const parsed = validateParsedSkillFile(
      await parseSkillFileContent(raw),
      { expectedDirectoryName: skillName },
    );

    const contentHash = await computeDirectoryHash(canonicalDir);
    const features = await detectSkillFeatures(canonicalDir);

    return {
      name: parsed.name,
      manifest: {
        name: parsed.name,
        description: parsed.description,
        compatibility: parsed.compatibility,
        metadata: parsed.metadata,
      },
      source: {
        type: "local",
        locator: canonicalDir,
      },
      canonicalDir,
      canonicalSkillFile,
      contentHash,
      features,
    };
  }

  async exists(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
  ): Promise<boolean> {
    const canonicalDir = this.getCanonicalSkillDir(ctx, skillName, scope);
    const canonicalSkillFile = this.getCanonicalSkillFile(ctx, skillName, scope);

    return (await pathExists(canonicalDir)) && (await pathExists(canonicalSkillFile));
  }

  async removeSkill(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
  ): Promise<void> {
    const canonicalDir = this.getCanonicalSkillDir(ctx, skillName, scope);
    await removeDir(canonicalDir);
  }
}

async function writeFetchedSkillToDir(
  fetched: FetchedSkill,
  targetDir: string,
): Promise<void> {
  await ensureDir(targetDir);

  for (const file of fetched.files) {
    const filePath = path.join(targetDir, file.relativePath);
    await ensureDir(path.dirname(filePath));
    await writeText(filePath, file.content);
  }
}

async function assertValidSkillDir(
  skillDir: string,
  expectedDirectoryName?: string,
): Promise<void> {
  const skillFile = path.join(skillDir, "SKILL.md");
  const raw = await readText(skillFile);
  const parsed = await parseSkillFileContent(raw);
  validateParsedSkillFile(parsed, { expectedDirectoryName });
}

export function createCanonicalStore(): CanonicalStore {
  return new CanonicalStoreImpl();
}

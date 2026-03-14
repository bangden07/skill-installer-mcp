import path from "node:path";
import { InstallerError } from "../domain/errors.js";
import type { ExecutionContext, FetchedSkill, SkillSourceRef } from "../domain/types.js";
import { listRelativeFiles, pathExists, readText } from "../utils/fs.js";
import { normalizeFetchedSkill } from "./normalize.js";

export interface LocalSkillSource {
  canHandle(source: SkillSourceRef): boolean;
  fetchMetadataOnly(source: SkillSourceRef, ctx: ExecutionContext): Promise<FetchedSkill>;
  fetchFullSkill(source: SkillSourceRef, ctx: ExecutionContext): Promise<FetchedSkill>;
}

export class LocalSkillSourceImpl implements LocalSkillSource {
  canHandle(source: SkillSourceRef): boolean {
    return source.type === "local";
  }

  async fetchMetadataOnly(source: SkillSourceRef, _ctx: ExecutionContext): Promise<FetchedSkill> {
    const skillDir = this.resolveLocalDirectory(source.locator);
    await assertValidLocalSkillDir(skillDir);

    const skillFilePath = path.join(skillDir, "SKILL.md");
    const skillContent = await readText(skillFilePath);

    return normalizeFetchedSkill(source, [
      {
        relativePath: "SKILL.md",
        content: skillContent,
      },
    ]);
  }

  async fetchFullSkill(source: SkillSourceRef, _ctx: ExecutionContext): Promise<FetchedSkill> {
    const skillDir = this.resolveLocalDirectory(source.locator);
    await assertValidLocalSkillDir(skillDir);

    const relativeFiles = await listRelativeFiles(skillDir);
    const files = await Promise.all(
      relativeFiles.map(async (relativePath) => ({
        relativePath,
        content: await readText(path.join(skillDir, relativePath)),
      })),
    );

    return normalizeFetchedSkill(source, files);
  }

  private resolveLocalDirectory(locator: string): string {
    return path.resolve(locator);
  }
}

async function assertValidLocalSkillDir(skillDir: string): Promise<void> {
  const exists = await pathExists(skillDir);
  if (!exists) {
    throw new InstallerError(
      "SOURCE_RESOLUTION_FAILED",
      `Local skill path does not exist: ${skillDir}`,
    );
  }

  const skillFilePath = path.join(skillDir, "SKILL.md");
  if (!(await pathExists(skillFilePath))) {
    throw new InstallerError(
      "INVALID_SKILL_FILE",
      `Local skill path does not contain SKILL.md: ${skillDir}`,
    );
  }
}

export function createLocalSkillSource(): LocalSkillSource {
  return new LocalSkillSourceImpl();
}

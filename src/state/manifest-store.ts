import path from "node:path";
import type {
  AgentId,
  ExecutionContext,
  ManifestDocument,
  ManifestSkillEntry,
  ManifestTargetEntry,
  Scope,
  ScopeOrAll,
  SkillRecord,
  TargetStatus,
} from "../domain/types.js";
import { ManifestDocumentSchema } from "../schema/common.js";
import { ensureDir, pathExists, readJson, writeJsonAtomic } from "../utils/fs.js";

export interface UpsertManifestSkillInput {
  skill: SkillRecord;
  scope: Scope;
  canonical: {
    path: string;
    contentHash: string;
  };
  targets: ManifestTargetEntry[];
  lastPlanFingerprint?: string;
}

export interface ManifestStore {
  getManifestPath(ctx: ExecutionContext, scope: Scope): string;
  load(ctx: ExecutionContext, scope: Scope): Promise<ManifestDocument>;
  save(ctx: ExecutionContext, scope: Scope, doc: ManifestDocument): Promise<void>;
  getSkill(
    ctx: ExecutionContext,
    skillName: string,
    scope: ScopeOrAll,
  ): Promise<ManifestSkillEntry | null>;
  listSkills(
    ctx: ExecutionContext,
    scope: ScopeOrAll,
    names?: string[],
  ): Promise<ManifestSkillEntry[]>;
  upsertMany(ctx: ExecutionContext, input: UpsertManifestSkillInput[]): Promise<void>;
  updateTargetStatus(
    ctx: ExecutionContext,
    input: {
      scope?: Scope;
      skillName: string;
      agentId: AgentId;
      status: TargetStatus;
      targetPath: string;
      lastVerifiedAt?: string;
      lastSyncAt?: string;
    },
  ): Promise<void>;
  updateCanonicalHash(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
    contentHash: string,
    revision?: string,
  ): Promise<void>;
  removeTarget(
    ctx: ExecutionContext,
    input: {
      skillName: string;
      agentId: AgentId;
      scope: Scope;
    },
  ): Promise<void>;
  removeSkill(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
  ): Promise<void>;
}

export class ManifestStoreImpl implements ManifestStore {
  getManifestPath(ctx: ExecutionContext, scope: Scope): string {
    if (scope === "project") {
      if (!ctx.workspaceRoot) {
        throw new Error("workspaceRoot is required for project manifest.");
      }

      return path.join(ctx.workspaceRoot, ".skill-installer", "state", "manifest.json");
    }

    return path.join(
      ctx.homeDir,
      ".config",
      "skill-installer",
      "state",
      "manifest.json",
    );
  }

  async load(ctx: ExecutionContext, scope: Scope): Promise<ManifestDocument> {
    const manifestPath = this.getManifestPath(ctx, scope);

    if (!(await pathExists(manifestPath))) {
      return this.createEmptyManifest(ctx, scope);
    }

    const raw = await readJson<unknown>(manifestPath);
    return this.migrateIfNeeded(raw, ctx, scope);
  }

  async save(
    ctx: ExecutionContext,
    scope: Scope,
    doc: ManifestDocument,
  ): Promise<void> {
    const manifestPath = this.getManifestPath(ctx, scope);
    await ensureDir(path.dirname(manifestPath));

    const normalized = this.normalizeDocument(ctx, scope, doc);
    await writeJsonAtomic(manifestPath, normalized);
  }

  async getSkill(
    ctx: ExecutionContext,
    skillName: string,
    scope: ScopeOrAll,
  ): Promise<ManifestSkillEntry | null> {
    const scopes = scope === "all" ? (["project", "global"] as const) : [scope];

    for (const itemScope of scopes) {
      const doc = await this.load(ctx, itemScope);
      const entry = doc.skills[skillName];
      if (entry) {
        return entry;
      }
    }

    return null;
  }

  async listSkills(
    ctx: ExecutionContext,
    scope: ScopeOrAll,
    names?: string[],
  ): Promise<ManifestSkillEntry[]> {
    const scopes = scope === "all" ? (["project", "global"] as const) : [scope];
    const result: ManifestSkillEntry[] = [];

    for (const itemScope of scopes) {
      const doc = await this.load(ctx, itemScope);

      for (const [name, entry] of Object.entries(doc.skills)) {
        if (names && !names.includes(name)) {
          continue;
        }
        result.push(entry);
      }
    }

    return result;
  }

  async upsertMany(
    ctx: ExecutionContext,
    input: UpsertManifestSkillInput[],
  ): Promise<void> {
    const grouped = groupByScope(input);

    for (const scope of Object.keys(grouped) as Scope[]) {
      const items = grouped[scope];
      const doc = await this.load(ctx, scope);

      for (const item of items) {
        const now = ctx.nowIso;
        const previous = doc.skills[item.skill.name];

        doc.skills[item.skill.name] = {
          name: item.skill.name,
          scope: item.scope,
          source: item.skill.source,
          canonical: {
            path: this.toStoredPath(ctx, item.scope, item.canonical.path),
            contentHash: item.canonical.contentHash,
            installedAt: previous?.canonical.installedAt ?? now,
            updatedAt: now,
          },
          features: item.skill.features,
          targets: item.targets.map((target) => ({
            ...target,
            targetPath: this.toStoredPath(ctx, item.scope, target.targetPath),
          })),
          warnings: previous?.warnings ?? [],
          lastPlanFingerprint: item.lastPlanFingerprint ?? previous?.lastPlanFingerprint,
        };
      }

      doc.updatedAt = ctx.nowIso;
      await this.save(ctx, scope, doc);
    }
  }

  async updateTargetStatus(
    ctx: ExecutionContext,
    input: {
      scope?: Scope;
      skillName: string;
      agentId: AgentId;
      status: TargetStatus;
      targetPath: string;
      lastVerifiedAt?: string;
      lastSyncAt?: string;
    },
  ): Promise<void> {
    const scope = input.scope ?? "project";
    const doc = await this.load(ctx, scope);
    const skill = doc.skills[input.skillName];

    if (!skill) {
      return;
    }

    const target = skill.targets.find((entry) => entry.agentId === input.agentId);
    if (!target) {
      return;
    }

    target.status = input.status;
    target.targetPath = this.toStoredPath(ctx, scope, input.targetPath);
    target.lastVerifiedAt = input.lastVerifiedAt ?? target.lastVerifiedAt;
    target.lastSyncAt = input.lastSyncAt ?? target.lastSyncAt;

    doc.updatedAt = ctx.nowIso;
    await this.save(ctx, scope, doc);
  }

  async updateCanonicalHash(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
    contentHash: string,
    revision?: string,
  ): Promise<void> {
    const doc = await this.load(ctx, scope);
    const skill = doc.skills[skillName];

    if (!skill) {
      return;
    }

    skill.canonical.contentHash = contentHash;
    skill.canonical.updatedAt = ctx.nowIso;

    if (revision) {
      skill.source.revision = revision;
    }

    doc.updatedAt = ctx.nowIso;
    await this.save(ctx, scope, doc);
  }

  async removeTarget(
    ctx: ExecutionContext,
    input: {
      skillName: string;
      agentId: AgentId;
      scope: Scope;
    },
  ): Promise<void> {
    const doc = await this.load(ctx, input.scope);
    const skill = doc.skills[input.skillName];

    if (!skill) {
      return;
    }

    skill.targets = skill.targets.filter((entry) => entry.agentId !== input.agentId);
    doc.updatedAt = ctx.nowIso;
    await this.save(ctx, input.scope, doc);
  }

  async removeSkill(
    ctx: ExecutionContext,
    skillName: string,
    scope: Scope,
  ): Promise<void> {
    const doc = await this.load(ctx, scope);
    delete doc.skills[skillName];
    doc.updatedAt = ctx.nowIso;
    await this.save(ctx, scope, doc);
  }

  private createEmptyManifest(
    ctx: ExecutionContext,
    scope: Scope,
  ): ManifestDocument {
    return {
      manifestVersion: 1,
      scope,
      workspaceRoot: scope === "project" ? ctx.workspaceRoot : undefined,
      updatedAt: ctx.nowIso,
      skills: {},
    };
  }

  private migrateIfNeeded(
    raw: unknown,
    ctx: ExecutionContext,
    scope: Scope,
  ): ManifestDocument {
    const parsed = ManifestDocumentSchema.parse(raw);
    return this.normalizeDocument(ctx, scope, parsed);
  }

  private normalizeDocument(
    ctx: ExecutionContext,
    scope: Scope,
    doc: ManifestDocument,
  ): ManifestDocument {
    return {
      manifestVersion: 1,
      scope,
      workspaceRoot: scope === "project" ? ctx.workspaceRoot : undefined,
      updatedAt: doc.updatedAt ?? ctx.nowIso,
      skills: doc.skills ?? {},
    };
  }

  private toStoredPath(
    ctx: ExecutionContext,
    scope: Scope,
    absolutePath: string,
  ): string {
    if (scope === "project") {
      if (!ctx.workspaceRoot) {
        return absolutePath;
      }

      return toPortableRelative(ctx.workspaceRoot, absolutePath);
    }

    if (absolutePath.startsWith(ctx.homeDir)) {
      return `~/${toPortableRelative(ctx.homeDir, absolutePath)}`;
    }

    return absolutePath;
  }
}

function groupByScope(
  items: UpsertManifestSkillInput[],
): Record<Scope, UpsertManifestSkillInput[]> {
  return {
    project: items.filter((item) => item.scope === "project"),
    global: items.filter((item) => item.scope === "global"),
  };
}

function toPortableRelative(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join("/");
}

export function createManifestStore(): ManifestStore {
  return new ManifestStoreImpl();
}

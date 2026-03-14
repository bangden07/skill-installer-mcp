import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { CanonicalStoreImpl } from "./canonical-store.js";
import {
  createTempWorkspace,
  createExecutionContext,
  disposeTempPath,
  createLocalSourceSkill,
} from "../test/helpers.js";
import { ensureDir, readText, writeText, pathExists } from "../utils/fs.js";
import type { FetchedSkill, SkillRecord } from "../domain/types.js";

function makeFetchedSkill(name: string, extraFiles?: Record<string, string>): FetchedSkill {
  const files = [
    {
      relativePath: "SKILL.md",
      content: [
        "---",
        `name: ${name}`,
        "description: Test canonical store skill.",
        "compatibility: universal",
        "---",
        "",
        `# ${name}`,
      ].join("\n"),
    },
  ];

  for (const [relPath, content] of Object.entries(extraFiles ?? {})) {
    files.push({ relativePath: relPath, content });
  }

  return {
    source: { type: "local", locator: "/tmp/fake" },
    files,
  };
}

function makeSkillRecord(store: CanonicalStoreImpl, ctx: any, name: string, scope: "project" | "global"): SkillRecord {
  return {
    name,
    manifest: { name, description: "Test." },
    source: { type: "local", locator: "/tmp/fake" },
    canonicalDir: store.getCanonicalSkillDir(ctx, name, scope),
    canonicalSkillFile: store.getCanonicalSkillFile(ctx, name, scope),
    contentHash: "sha256:placeholder",
    features: {
      hasScripts: false,
      hasReferences: false,
      hasAssets: false,
      hasMcpConfig: false,
      nonPortableFields: [],
    },
  };
}

// ── getCanonicalRoot ─────────────────────────────────────

test("getCanonicalRoot for project scope uses workspaceRoot", async () => {
  const ws = await createTempWorkspace("canon-root-proj");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const root = store.getCanonicalRoot(ctx, "project");
    assert.ok(root.includes(".agents"));
    assert.ok(root.includes("skills"));
    assert.ok(root.startsWith(ws));
  } finally {
    await disposeTempPath(ws);
  }
});

test("getCanonicalRoot for global scope uses homeDir", async () => {
  const ws = await createTempWorkspace("canon-root-global");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const root = store.getCanonicalRoot(ctx, "global");
    assert.ok(root.includes(ctx.homeDir));
    assert.ok(root.includes(".agents"));
  } finally {
    await disposeTempPath(ws);
  }
});

test("getCanonicalRoot throws for project scope without workspaceRoot", () => {
  const ctx = { homeDir: "/home/user", platform: "linux" as const, nowIso: "" };
  const store = new CanonicalStoreImpl();
  assert.throws(() => store.getCanonicalRoot(ctx as any, "project"), /workspaceRoot/);
});

// ── installSkill (fresh) ─────────────────────────────────

test("installSkill fresh install writes files and returns result", async () => {
  const ws = await createTempWorkspace("canon-install");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const name = "test-skill";
    const fetched = makeFetchedSkill(name);
    const skill = makeSkillRecord(store, ctx, name, "project");

    const result = await store.installSkill(ctx, {
      skill,
      fetched,
      scope: "project",
    });

    assert.ok(result.canonicalDir.includes(name));
    assert.ok(result.contentHash.startsWith("sha256:"));
    // First install — updated should be false (no previous version existed)
    assert.equal(result.updated, false);
    assert.equal(result.features.hasScripts, false);
    assert.equal(result.features.hasMcpConfig, false);

    // Verify file actually written
    const exists = await pathExists(result.canonicalSkillFile);
    assert.equal(exists, true);
  } finally {
    await disposeTempPath(ws);
  }
});

// ── installSkill (update with changes) ────────────────────

test("installSkill update returns updated=true when content changes", async () => {
  const ws = await createTempWorkspace("canon-update");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const name = "update-skill";
    const skill = makeSkillRecord(store, ctx, name, "project");

    // First install
    const fetched1 = makeFetchedSkill(name);
    await store.installSkill(ctx, { skill, fetched: fetched1, scope: "project" });

    // Second install with different content
    const fetched2 = makeFetchedSkill(name, { "extra.txt": "new content" });
    const result = await store.installSkill(ctx, { skill, fetched: fetched2, scope: "project" });

    assert.equal(result.updated, true);
  } finally {
    await disposeTempPath(ws);
  }
});

// ── installSkill (no-op when hash matches) ────────────────

test("installSkill no-op when content hash matches", async () => {
  const ws = await createTempWorkspace("canon-noop");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const name = "noop-skill";
    const skill = makeSkillRecord(store, ctx, name, "project");
    const fetched = makeFetchedSkill(name);

    // First install
    const r1 = await store.installSkill(ctx, { skill, fetched, scope: "project" });

    // Same content again
    const r2 = await store.installSkill(ctx, { skill, fetched, scope: "project" });

    assert.equal(r2.updated, false);
    assert.equal(r1.contentHash, r2.contentHash);
  } finally {
    await disposeTempPath(ws);
  }
});

// ── exists ────────────────────────────────────────────────

test("exists returns false for non-existent skill", async () => {
  const ws = await createTempWorkspace("canon-exists");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const result = await store.exists(ctx, "nonexistent", "project");
    assert.equal(result, false);
  } finally {
    await disposeTempPath(ws);
  }
});

test("exists returns true after install", async () => {
  const ws = await createTempWorkspace("canon-exists-after");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const name = "exists-skill";
    const skill = makeSkillRecord(store, ctx, name, "project");
    const fetched = makeFetchedSkill(name);

    await store.installSkill(ctx, { skill, fetched, scope: "project" });
    const result = await store.exists(ctx, name, "project");
    assert.equal(result, true);
  } finally {
    await disposeTempPath(ws);
  }
});

// ── removeSkill ───────────────────────────────────────────

test("removeSkill removes the canonical directory", async () => {
  const ws = await createTempWorkspace("canon-remove");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const name = "remove-skill";
    const skill = makeSkillRecord(store, ctx, name, "project");
    const fetched = makeFetchedSkill(name);

    await store.installSkill(ctx, { skill, fetched, scope: "project" });
    assert.equal(await store.exists(ctx, name, "project"), true);

    await store.removeSkill(ctx, name, "project");
    assert.equal(await store.exists(ctx, name, "project"), false);
  } finally {
    await disposeTempPath(ws);
  }
});

// ── loadInstalledSkillRecord ──────────────────────────────

test("loadInstalledSkillRecord returns complete record", async () => {
  const ws = await createTempWorkspace("canon-load");
  try {
    const ctx = createExecutionContext(ws);
    const store = new CanonicalStoreImpl();
    const name = "load-skill";
    const skill = makeSkillRecord(store, ctx, name, "project");
    const fetched = makeFetchedSkill(name, { "scripts/run.sh": "#!/bin/bash\necho ok" });

    await store.installSkill(ctx, { skill, fetched, scope: "project" });

    const record = await store.loadInstalledSkillRecord(ctx, name, "project");
    assert.equal(record.name, name);
    assert.equal(record.manifest.name, name);
    assert.ok(record.contentHash.startsWith("sha256:"));
    assert.equal(record.features.hasScripts, true);
    assert.equal(record.source.type, "local");
  } finally {
    await disposeTempPath(ws);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { createManifestStore } from "./manifest-store.js";
import { createExecutionContext, createTempWorkspace, disposeTempPath, seedCanonicalSkill } from "../test/helpers.js";

test("manifest store persists portable project paths", async () => {
  const workspace = await createTempWorkspace("manifest-store-test");

  try {
    const ctx = createExecutionContext(workspace);
    const store = createManifestStore();
    const skill = await seedCanonicalSkill(workspace, "project", "portable-skill");

    await store.upsertMany(ctx, [
      {
        skill,
        scope: "project",
        canonical: {
          path: skill.canonicalDir,
          contentHash: "sha256:portable",
        },
        targets: [
          {
            agentId: "claude-code",
            scope: "project",
            mode: "symlink",
            targetPath: `${workspace}\\.claude\\skills\\portable-skill`,
            status: "installed",
            lastVerifiedAt: ctx.nowIso,
          },
        ],
        lastPlanFingerprint: "plan_123",
      },
    ]);

    const saved = await store.getSkill(ctx, "portable-skill", "project");
    assert.ok(saved);
    assert.equal(saved.canonical.path, ".agents/skills/portable-skill");
    assert.equal(saved.targets[0]?.targetPath, ".claude/skills/portable-skill");
    assert.equal(saved.lastPlanFingerprint, "plan_123");
  } finally {
    await disposeTempPath(workspace);
  }
});

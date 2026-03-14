import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";
import { CodexAdapter } from "./codex.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { WindsurfAdapter } from "./windsurf.js";
import { AmpAdapter } from "./amp.js";
import { createAdapterRegistry } from "./registry.js";
import type { AgentAdapter } from "./base.js";
import type { AgentId, SkillRecord } from "../../domain/types.js";
import {
  createExecutionContext,
  createTempWorkspace,
  disposeTempPath,
  seedCanonicalSkill,
} from "../../test/helpers.js";
import { pathExists, readText } from "../../utils/fs.js";

/**
 * Adapter integration tests.
 *
 * Tests the full plan -> apply -> verify -> sync -> remove lifecycle
 * for each adapter in project scope.
 */

const ADAPTERS_TO_TEST: Array<{
  AdapterClass: new () => AgentAdapter;
  agentId: AgentId;
  displayName: string;
}> = [
  { AdapterClass: CursorAdapter, agentId: "cursor", displayName: "Cursor" },
  { AdapterClass: OpenCodeAdapter, agentId: "opencode", displayName: "OpenCode" },
  { AdapterClass: CodexAdapter, agentId: "codex", displayName: "Codex" },
  { AdapterClass: ClaudeCodeAdapter, agentId: "claude-code", displayName: "Claude Code" },
  { AdapterClass: WindsurfAdapter, agentId: "windsurf", displayName: "Windsurf" },
  { AdapterClass: AmpAdapter, agentId: "amp", displayName: "Amp" },
];

for (const { AdapterClass, agentId, displayName } of ADAPTERS_TO_TEST) {
  test(`${displayName} adapter: plan install verify and remove in project scope`, async () => {
    const workspace = await createTempWorkspace(`adapter-int-${agentId}`);

    try {
      const ctx = createExecutionContext(workspace);
      const skill = await seedCanonicalSkill(workspace, "project", `test-skill-${agentId}`);
      const adapter = new AdapterClass();

      // 1. Plan install
      const plan = await adapter.planInstall(ctx, {
        skill,
        scope: "project",
        requestedMode: "auto",
      });

      assert.equal(plan.agentId, agentId);
      assert.ok(["direct", "link", "copy", "skip"].includes(plan.action));
      assert.ok(["planned", "manual_required"].includes(plan.status));

      // 2. Apply install
      const resolved = await adapter.resolveTarget(ctx, {
        skill,
        scope: "project",
        requestedMode: "auto",
      });

      assert.equal(resolved.agentId, agentId);
      assert.ok(["direct", "symlink", "copy"].includes(resolved.mode));

      const applyResult = await adapter.applyInstall(ctx, {
        skill,
        resolved,
      });

      assert.equal(applyResult.agentId, agentId);
      assert.equal(applyResult.skillName, skill.name);
      assert.ok(["installed", "updated", "linked", "copied", "skipped"].includes(applyResult.action));

      // 3. Verify
      const verifyResult = await adapter.verifyInstall(ctx, {
        skill,
        scope: "project",
        expectedMode: resolved.mode,
        targetDir: applyResult.targetDir,
      });

      assert.equal(verifyResult.agentId, agentId);
      assert.equal(verifyResult.ok, true);

      // 4. Sync (should be unchanged since we just installed)
      const syncResult = await adapter.syncInstall(ctx, {
        skill,
        scope: "project",
      });

      assert.equal(syncResult.agentId, agentId);
      assert.ok(["relinked", "recopied", "unchanged", "manual_required"].includes(syncResult.action));

      // 5. Remove
      const removeResult = await adapter.removeInstall(ctx, {
        skillName: skill.name,
        scope: "project",
        targetDir: applyResult.targetDir,
      });

      assert.equal(removeResult.agentId, agentId);
      assert.equal(removeResult.skillName, skill.name);
    } finally {
      await disposeTempPath(workspace);
    }
  });
}

test("adapter registry contains all 6 adapters", () => {
  const registry = createAdapterRegistry();
  const agentIds = Object.keys(registry);

  assert.deepEqual(
    agentIds.sort(),
    ["amp", "claude-code", "codex", "cursor", "opencode", "windsurf"],
  );
});

test("all adapters report capabilities with correct agentId", async () => {
  const registry = createAdapterRegistry();
  const workspace = await createTempWorkspace("adapter-caps-test");

  try {
    const ctx = createExecutionContext(workspace);

    for (const [agentId, adapter] of Object.entries(registry)) {
      const capabilities = await adapter.getCapabilities(ctx);
      assert.equal(capabilities.agentId, agentId);
      assert.ok(capabilities.supportsProjectScope || capabilities.supportsGlobalScope);
    }
  } finally {
    await disposeTempPath(workspace);
  }
});

test("all adapters can detect without throwing", async () => {
  const registry = createAdapterRegistry();
  const workspace = await createTempWorkspace("adapter-detect-test");

  try {
    const ctx = createExecutionContext(workspace);

    for (const [agentId, adapter] of Object.entries(registry)) {
      const detection = await adapter.detect(ctx);
      assert.equal(typeof detection.detected, "boolean");
      assert.equal(typeof detection.installableWithoutDetection, "boolean");
    }
  } finally {
    await disposeTempPath(workspace);
  }
});

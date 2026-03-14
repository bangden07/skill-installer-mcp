import test from "node:test";
import assert from "node:assert/strict";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { createExecutionContext, createTempWorkspace, disposeTempPath, seedCanonicalSkill } from "../../test/helpers.js";

test("adapter planInstall works before native target exists", async () => {
  const workspace = await createTempWorkspace("adapter-plan-test");

  try {
    const ctx = createExecutionContext(workspace);
    const skill = await seedCanonicalSkill(workspace, "project", "adapter-plan-skill");
    const adapter = new ClaudeCodeAdapter();

    const plan = await adapter.planInstall(ctx, {
      skill,
      scope: "project",
      requestedMode: "auto",
    });

    assert.equal(plan.agentId, "claude-code");
    assert.equal(plan.action, "link");
    assert.equal(plan.targetDir.endsWith(".claude\\skills\\adapter-plan-skill") || plan.targetDir.endsWith(".claude/skills/adapter-plan-skill"), true);
    assert.equal(plan.status, "planned");
  } finally {
    await disposeTempPath(workspace);
  }
});

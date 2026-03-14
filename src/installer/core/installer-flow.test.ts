import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createDefaultInstallerDeps } from "../../mcp/register-tools.js";
import { readText } from "../../utils/fs.js";
import { installSkills } from "./install-skills.js";
import { planSkillInstall } from "./plan-skill-install.js";
import { removeSkills } from "./remove-skills.js";
import { syncSkills } from "./sync-skills.js";
import { updateSkills } from "./update-skills.js";
import {
  createLocalSourceSkill,
  createTempWorkspace,
  disposeTempPath,
  updateLocalSourceSkill,
} from "../../test/helpers.js";

test("installer flow supports plan install update sync and remove", async () => {
  const workspace = await createTempWorkspace("installer-flow-test");

  try {
    const deps = createDefaultInstallerDeps();
    const skillDir = await createLocalSourceSkill({
      rootDir: workspace,
      name: "installer-flow-skill",
      description: "Initial installer flow content.",
      extraFiles: {
        "assets/info.txt": "v1",
      },
    });
    const selector = {
      source: {
        type: "local" as const,
        locator: skillDir,
      },
    };

    const plan = await planSkillInstall(
      {
        skills: [selector],
        workspacePath: workspace,
        agents: ["claude-code", "cursor"],
        scope: "project",
      },
      deps,
    );

    assert.equal(plan.summary.skillsCount, 1);
    assert.equal(plan.targetActions.length, 2);

    const install = await installSkills(
      {
        skills: [selector],
        workspacePath: workspace,
        agents: ["claude-code", "cursor"],
        scope: "project",
        expectedPlanFingerprint: plan.planFingerprint,
      },
      deps,
    );

    assert.equal(install.failed.length, 0);
    assert.equal(install.installed.length, 3);

    const canonicalSkillFile = path.join(
      workspace,
      ".agents",
      "skills",
      "installer-flow-skill",
      "SKILL.md",
    );
    assert.match(await readText(canonicalSkillFile), /Initial installer flow content\./);

    await updateLocalSourceSkill(skillDir, {
      description: "Updated installer flow content.",
      metadata: {
        owner: "tests",
        revision: "2",
      },
      extraFiles: {
        "assets/info.txt": "v2",
      },
    });

    const updated = await updateSkills(
      {
        skills: ["installer-flow-skill"],
        workspacePath: workspace,
        scope: "project",
      },
      deps,
    );

    assert.equal(updated.failed.length, 0);
    assert.equal(updated.updated.length, 1);
    assert.equal(updated.updated[0]?.targetsReapplied, 2);
    assert.match(await readText(canonicalSkillFile), /Updated installer flow content\./);

    const synced = await syncSkills(
      {
        skills: ["installer-flow-skill"],
        workspacePath: workspace,
        scope: "project",
      },
      deps,
    );

    assert.equal(synced.failed.length, 0);
    assert.equal(synced.unchanged.length, 2);

    const removed = await removeSkills(
      {
        skills: ["installer-flow-skill"],
        workspacePath: workspace,
        scope: "project",
        agents: ["claude-code", "cursor"],
        purgeCanonical: true,
      },
      deps,
    );

    assert.equal(removed.failed.length, 0);
    assert.equal(removed.removedTargets.length, 2);
    assert.deepEqual(removed.purgedCanonical, ["installer-flow-skill"]);
  } finally {
    await disposeTempPath(workspace);
  }
});

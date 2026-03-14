import assert from "node:assert/strict";
import path from "node:path";
import { createDefaultInstallerDeps } from "../mcp/register-tools.js";
import { handleDoctorSkills } from "../mcp/tools/doctor-skills.js";
import { handleInstallSkills } from "../mcp/tools/install-skills.js";
import { handleListInstalledSkills } from "../mcp/tools/list-installed-skills.js";
import { handlePlanSkillInstall } from "../mcp/tools/plan-skill-install.js";
import { handleRemoveSkills } from "../mcp/tools/remove-skills.js";
import { ToolSchemaRegistry } from "../schema/json-schema.js";
import { ensureDir, pathExists, removePathIfExists } from "../utils/fs.js";

const skillName = "hello-smoke-skill";
const workspacePath = path.resolve("tmp", "smoke-local-workspace");
const skillSourcePath = path.resolve("fixtures", "skills", skillName);
const agents = ["claude-code", "cursor"] as const;

async function main(): Promise<void> {
  await removePathIfExists(workspacePath);
  await ensureDir(workspacePath);

  const deps = createDefaultInstallerDeps();
  const selector = {
    source: {
      type: "local" as const,
      locator: skillSourcePath,
    },
  };

  const canonicalDir = path.join(workspacePath, ".agents", "skills", skillName);
  const claudeTargetDir = path.join(workspacePath, ".claude", "skills", skillName);
  const manifestPath = path.join(workspacePath, ".skill-installer", "state", "manifest.json");

  try {
    console.log("[smoke] planning local install");
    const planResult = ToolSchemaRegistry.plan_skill_install.output.parse(
      await handlePlanSkillInstall(
        {
          skills: [selector],
          workspacePath,
          agents: [...agents],
          scope: "project",
        },
        deps,
      ),
    );

    assert.equal(planResult.status, "success");
    assert.ok(planResult.data);
    assert.equal(planResult.data.canonicalActions.length, 1);
    assert.equal(planResult.data.targetActions.length, agents.length);

    const planPath = path.join(
      workspacePath,
      ".skill-installer",
      "state",
      "plans",
      `${planResult.data.planFingerprint}.json`,
    );
    assert.equal(await pathExists(planPath), true);

    console.log("[smoke] installing local skill");
    const installResult = ToolSchemaRegistry.install_skills.output.parse(
      await handleInstallSkills(
        {
          skills: [selector],
          workspacePath,
          agents: [...agents],
          scope: "project",
          expectedPlanFingerprint: planResult.data.planFingerprint,
        },
        deps,
      ),
    );

    assert.equal(installResult.status, "success");
    assert.ok(installResult.data);
    assert.equal(installResult.data.installed.length, 1 + agents.length);
    assert.equal(await pathExists(canonicalDir), true);
    assert.equal(await pathExists(claudeTargetDir), true);
    assert.equal(await pathExists(manifestPath), true);

    console.log("[smoke] listing installed skills");
    const listResult = ToolSchemaRegistry.list_installed_skills.output.parse(
      await handleListInstalledSkills(
        {
          workspacePath,
          scope: "project",
        },
        deps,
      ),
    );

    assert.equal(listResult.status, "success");
    assert.ok(listResult.data);
    assert.equal(listResult.data.skills.length, 1);
    assert.equal(listResult.data.skills[0]?.name, skillName);
    assert.equal(listResult.data.skills[0]?.targets.length, agents.length);

    console.log("[smoke] running doctor");
    const doctorResult = ToolSchemaRegistry.doctor_skills.output.parse(
      await handleDoctorSkills(
        {
          workspacePath,
          scope: "project",
        },
        deps,
      ),
    );

    assert.ok(doctorResult.data);
    assert.equal(doctorResult.data.summary.ok, true);
    assert.equal(doctorResult.data.summary.issuesFound, 0);

    console.log("[smoke] removing installed skill");
    const removeResult = ToolSchemaRegistry.remove_skills.output.parse(
      await handleRemoveSkills(
        {
          skills: [skillName],
          workspacePath,
          scope: "project",
          agents: [...agents],
          purgeCanonical: true,
        },
        deps,
      ),
    );

    assert.ok(removeResult.data);
    assert.equal(removeResult.data.failed.length, 0);
    assert.equal(removeResult.data.removedTargets.length, agents.length);
    assert.deepEqual(removeResult.data.purgedCanonical, [skillName]);

    const postRemoveListResult = ToolSchemaRegistry.list_installed_skills.output.parse(
      await handleListInstalledSkills(
        {
          workspacePath,
          scope: "project",
        },
        deps,
      ),
    );

    assert.ok(postRemoveListResult.data);
    assert.equal(postRemoveListResult.data.skills.length, 0);
    assert.equal(await pathExists(canonicalDir), false);
    assert.equal(await pathExists(claudeTargetDir), false);

    console.log("[smoke] local installer flow passed");
  } finally {
    await removePathIfExists(workspacePath);
  }
}

main().catch((error: unknown) => {
  console.error("[smoke] local installer flow failed");
  console.error(error);
  process.exit(1);
});

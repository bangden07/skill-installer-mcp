import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultInstallerDeps } from "../register-tools.js";
import { ToolSchemaRegistry } from "../../schema/json-schema.js";
import { handleDoctorSkills } from "./doctor-skills.js";
import { handleInstallSkills } from "./install-skills.js";
import { handleListInstalledSkills } from "./list-installed-skills.js";
import { handleListSupportedAgents } from "./list-supported-agents.js";
import { handlePlanSkillInstall } from "./plan-skill-install.js";
import { handleRemoveSkills } from "./remove-skills.js";
import { handleUpdateSkills } from "./update-skills.js";
import {
  createLocalSourceSkill,
  createTempWorkspace,
  disposeTempPath,
  updateLocalSourceSkill,
} from "../../test/helpers.js";

test("list_supported_agents returns schema-valid data", async () => {
  const deps = createDefaultInstallerDeps();
  const output = ToolSchemaRegistry.list_supported_agents.output.parse(
    await handleListSupportedAgents({ includeDetection: false }, deps),
  );

  assert.equal(output.status, "success");
  assert.ok(output.data);
  assert.equal(output.data.agents.length, 6);
});

test("MCP handlers return schema-valid outputs across install update flow", async () => {
  const workspace = await createTempWorkspace("mcp-handler-test");

  try {
    const deps = createDefaultInstallerDeps();
    const skillDir = await createLocalSourceSkill({
      rootDir: workspace,
      name: "mcp-handler-skill",
      description: "Initial MCP handler content.",
      extraFiles: {
        "references/guide.md": "v1",
      },
    });

    const selector = {
      source: {
        type: "local" as const,
        locator: skillDir,
      },
    };

    const plan = ToolSchemaRegistry.plan_skill_install.output.parse(
      await handlePlanSkillInstall(
        {
          skills: [selector],
          workspacePath: workspace,
          agents: ["claude-code"],
          scope: "project",
        },
        deps,
      ),
    );

    assert.equal(plan.status, "success");
    assert.ok(plan.data);

    const install = ToolSchemaRegistry.install_skills.output.parse(
      await handleInstallSkills(
        {
          skills: [selector],
          workspacePath: workspace,
          agents: ["claude-code"],
          scope: "project",
          expectedPlanFingerprint: plan.data.planFingerprint,
        },
        deps,
      ),
    );

    assert.equal(install.status, "success");
    assert.ok(install.data);

    const listed = ToolSchemaRegistry.list_installed_skills.output.parse(
      await handleListInstalledSkills(
        {
          workspacePath: workspace,
          scope: "project",
        },
        deps,
      ),
    );

    assert.equal(listed.status, "success");
    assert.ok(listed.data);
    assert.equal(listed.data.skills.length, 1);

    await updateLocalSourceSkill(skillDir, {
      description: "Updated MCP handler content.",
      extraFiles: {
        "references/guide.md": "v2",
      },
    });

    const updated = ToolSchemaRegistry.update_skills.output.parse(
      await handleUpdateSkills(
        {
          skills: ["mcp-handler-skill"],
          workspacePath: workspace,
          scope: "project",
        },
        deps,
      ),
    );

    assert.equal(updated.status, "success");
    assert.ok(updated.data);
    assert.equal(updated.data.updated.length, 1);

    const doctor = ToolSchemaRegistry.doctor_skills.output.parse(
      await handleDoctorSkills(
        {
          workspacePath: workspace,
          scope: "project",
        },
        deps,
      ),
    );

    assert.ok(doctor.data);
    assert.equal(doctor.data.summary.ok, true);

    const removed = ToolSchemaRegistry.remove_skills.output.parse(
      await handleRemoveSkills(
        {
          skills: ["mcp-handler-skill"],
          workspacePath: workspace,
          scope: "project",
          agents: ["claude-code"],
          purgeCanonical: true,
        },
        deps,
      ),
    );

    assert.equal(removed.status, "success");
    assert.ok(removed.data);
    assert.equal(removed.data.failed.length, 0);
  } finally {
    await disposeTempPath(workspace);
  }
});

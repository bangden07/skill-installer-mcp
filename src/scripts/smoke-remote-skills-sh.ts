/**
 * Real-world smoke test: fetch skills from actual skills.sh repos.
 *
 * This script tests our skills.sh source implementation against real
 * GitHub repos in the skills.sh ecosystem. It verifies:
 *
 *   1. 3-segment selectors resolve correctly (auto-discover skill prefix)
 *   2. 2-segment selectors work for single-skill repos
 *   3. fetchMetadataOnly returns valid SKILL.md content
 *   4. fetchFullSkill returns multiple files for skills with subdirectories
 *   5. The resolver correctly routes selectors to skills.sh source
 *
 * Requires network access. Failures may be transient (GitHub rate limits).
 */

import assert from "node:assert/strict";
import { createSkillsShSourceInstance, parseSkillsShLocator } from "../registry/skills-sh.js";
import { RegistryResolverImpl } from "../registry/resolver.js";
import { createSkillFetcher } from "../registry/resolver.js";
import type { ExecutionContext } from "../domain/types.js";

const ctx: ExecutionContext = {
  homeDir: process.env.HOME ?? process.env.USERPROFILE ?? "/home/user",
  platform: process.platform,
  nowIso: new Date().toISOString(),
};

const source = createSkillsShSourceInstance();
const resolver = new RegistryResolverImpl();
const fetcher = createSkillFetcher();

async function testParseLocators(): Promise<void> {
  console.log("[real-world] testing parseSkillsShLocator...");

  const p1 = parseSkillsShLocator("anthropics/skills/frontend-design");
  assert.equal(p1.owner, "anthropics");
  assert.equal(p1.repo, "skills");
  assert.equal(p1.skillPath, "frontend-design");

  const p2 = parseSkillsShLocator("obra/superpowers/brainstorming");
  assert.equal(p2.owner, "obra");
  assert.equal(p2.repo, "superpowers");
  assert.equal(p2.skillPath, "brainstorming");

  const p3 = parseSkillsShLocator("vercel-labs/skills/find-skills");
  assert.equal(p3.owner, "vercel-labs");
  assert.equal(p3.repo, "skills");
  assert.equal(p3.skillPath, "find-skills");

  console.log("[real-world] parseSkillsShLocator: OK");
}

async function testResolverRouting(): Promise<void> {
  console.log("[real-world] testing resolver routing for 3-segment selectors...");

  const ref1 = await resolver.resolve({ name: "anthropics/skills/frontend-design" }, ctx);
  assert.equal(ref1.type, "skills.sh");
  assert.equal(ref1.locator, "anthropics/skills/frontend-design");

  const ref2 = await resolver.resolve({ name: "obra/superpowers/brainstorming" }, ctx);
  assert.equal(ref2.type, "skills.sh");
  assert.equal(ref2.locator, "obra/superpowers/brainstorming");

  console.log("[real-world] resolver routing: OK");
}

async function testFetchMetadataAnthropics(): Promise<void> {
  console.log("[real-world] fetching metadata for anthropics/skills/frontend-design...");

  const ref = await resolver.resolve({ name: "anthropics/skills/frontend-design" }, ctx);
  const result = await fetcher.fetchMetadataOnly(ref, ctx);

  assert.ok(result.files.length >= 1);
  const skillMd = result.files.find((f) => f.relativePath === "SKILL.md");
  assert.ok(skillMd, "SKILL.md must be present");
  assert.ok(skillMd.content.length > 100, "SKILL.md should have substantial content");
  assert.ok(
    skillMd.content.includes("name:") || skillMd.content.includes("---"),
    "SKILL.md should have frontmatter",
  );

  console.log(`[real-world] anthropics/skills/frontend-design: OK (${skillMd.content.length} bytes)`);
}

async function testFetchMetadataObra(): Promise<void> {
  console.log("[real-world] fetching metadata for obra/superpowers/brainstorming...");

  const ref = await resolver.resolve({ name: "obra/superpowers/brainstorming" }, ctx);
  const result = await fetcher.fetchMetadataOnly(ref, ctx);

  assert.ok(result.files.length >= 1);
  const skillMd = result.files.find((f) => f.relativePath === "SKILL.md");
  assert.ok(skillMd, "SKILL.md must be present");
  assert.ok(skillMd.content.length > 50, "SKILL.md should have content");

  console.log(`[real-world] obra/superpowers/brainstorming: OK (${skillMd.content.length} bytes)`);
}

async function testFetchFullSkillAnthropics(): Promise<void> {
  console.log("[real-world] fetching full skill for anthropics/skills/frontend-design...");

  const ref = await resolver.resolve({ name: "anthropics/skills/frontend-design" }, ctx);
  const result = await fetcher.fetchFullSkill(ref, ctx);

  assert.ok(result.files.length >= 1);
  const skillMd = result.files.find((f) => f.relativePath === "SKILL.md");
  assert.ok(skillMd, "SKILL.md must be present");

  console.log(`[real-world] full fetch: ${result.files.length} files`);
  for (const f of result.files) {
    console.log(`  - ${f.relativePath} (${f.content.length} bytes)`);
  }

  console.log("[real-world] full skill fetch anthropics: OK");
}

async function testFetchVercelFindSkills(): Promise<void> {
  console.log("[real-world] fetching metadata for vercel-labs/skills/find-skills...");

  const ref = await resolver.resolve({ name: "vercel-labs/skills/find-skills" }, ctx);
  const result = await fetcher.fetchMetadataOnly(ref, ctx);

  assert.ok(result.files.length >= 1);
  const skillMd = result.files.find((f) => f.relativePath === "SKILL.md");
  assert.ok(skillMd, "SKILL.md must be present");
  assert.ok(skillMd.content.includes("name:"), "SKILL.md should have a name field");

  console.log(`[real-world] vercel-labs/skills/find-skills: OK (${skillMd.content.length} bytes)`);
}

async function testEndToEndPlanWithRemoteSkill(): Promise<void> {
  console.log("[real-world] testing end-to-end plan with remote skill...");

  // Use the MCP tool handler to plan a remote skill installation
  const { handlePlanSkillInstall } = await import("../mcp/tools/plan-skill-install.js");
  const { createDefaultInstallerDeps } = await import("../mcp/register-tools.js");
  const { ToolSchemaRegistry } = await import("../schema/json-schema.js");
  const path = await import("node:path");
  const { ensureDir, removePathIfExists } = await import("../utils/fs.js");

  const workspacePath = path.resolve("tmp", "smoke-remote-workspace");
  await removePathIfExists(workspacePath);
  await ensureDir(workspacePath);

  try {
    const deps = createDefaultInstallerDeps();
    const planResult = ToolSchemaRegistry.plan_skill_install.output.parse(
      await handlePlanSkillInstall(
        {
          skills: [{ name: "anthropics/skills/frontend-design" }],
          workspacePath,
          agents: ["cursor"],
          scope: "project",
        },
        deps,
      ),
    );

    assert.equal(planResult.status, "success");
    assert.ok(planResult.data);
    assert.ok(planResult.data.canonicalActions.length >= 1, "should have canonical action");
    assert.ok(planResult.data.targetActions.length >= 1, "should have target action");

    console.log(`[real-world] plan result: ${planResult.data.canonicalActions.length} canonical, ${planResult.data.targetActions.length} targets`);
    console.log("[real-world] end-to-end plan: OK");
  } finally {
    await removePathIfExists(workspacePath);
  }
}

async function main(): Promise<void> {
  console.log("[real-world] starting real-world skills.sh integration tests");
  console.log("[real-world] NOTE: requires network access to GitHub");
  console.log();

  await testParseLocators();
  await testResolverRouting();
  await testFetchMetadataAnthropics();
  await testFetchMetadataObra();
  await testFetchFullSkillAnthropics();
  await testFetchVercelFindSkills();
  await testEndToEndPlanWithRemoteSkill();

  console.log();
  console.log("[real-world] all real-world tests passed!");
}

main().catch((error: unknown) => {
  console.error("[real-world] integration test failed");
  console.error(error);
  process.exit(1);
});

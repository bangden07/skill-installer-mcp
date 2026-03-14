import test from "node:test";
import assert from "node:assert/strict";
import { parseSkillFileContent } from "./parse-skill.js";

test("parseSkillFileContent parses frontmatter and metadata", async () => {
  const parsed = await parseSkillFileContent([
    "---",
    "name: hello-skill",
    "description: Test parser output.",
    "compatibility: universal",
    "metadata:",
    "  owner: test",
    "  stage: unit",
    "---",
    "",
    "# Hello",
  ].join("\n"));

  assert.equal(parsed.name, "hello-skill");
  assert.equal(parsed.description, "Test parser output.");
  assert.equal(parsed.compatibility, "universal");
  assert.deepEqual(parsed.metadata, {
    owner: "test",
    stage: "unit",
  });
  assert.equal(parsed.body, "# Hello");
});

test("parseSkillFileContent rejects missing frontmatter", async () => {
  await assert.rejects(
    () => parseSkillFileContent("# no frontmatter"),
    /must start with YAML frontmatter/i,
  );
});

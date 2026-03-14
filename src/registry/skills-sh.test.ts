import test from "node:test";
import assert from "node:assert/strict";
import { parseSkillsShLocator, createSkillsShSource } from "./skills-sh.js";

// ── parseSkillsShLocator ─────────────────────────────────

test("parseSkillsShLocator: 2-segment owner/repo", () => {
  const result = parseSkillsShLocator("owner/my-skill");
  assert.equal(result.owner, "owner");
  assert.equal(result.repo, "my-skill");
  assert.equal(result.skillPath, undefined);
});

test("parseSkillsShLocator: 3-segment owner/repo/skill", () => {
  const result = parseSkillsShLocator("anthropics/skills/frontend-design");
  assert.equal(result.owner, "anthropics");
  assert.equal(result.repo, "skills");
  assert.equal(result.skillPath, "frontend-design");
});

test("parseSkillsShLocator: 3-segment with skills.sh: prefix", () => {
  const result = parseSkillsShLocator("skills.sh:anthropics/skills/frontend-design");
  assert.equal(result.owner, "anthropics");
  assert.equal(result.repo, "skills");
  assert.equal(result.skillPath, "frontend-design");
});

test("parseSkillsShLocator: 2-segment with skills.sh: prefix", () => {
  const result = parseSkillsShLocator("skills.sh:owner/repo");
  assert.equal(result.owner, "owner");
  assert.equal(result.repo, "repo");
  assert.equal(result.skillPath, undefined);
});

test("parseSkillsShLocator: 1-segment defaults to anthropics org", () => {
  const result = parseSkillsShLocator("my-skill");
  assert.equal(result.owner, "anthropics");
  assert.equal(result.repo, "my-skill");
  assert.equal(result.skillPath, undefined);
});

test("parseSkillsShLocator: deep 4-segment path collapses to skillPath", () => {
  const result = parseSkillsShLocator("obra/superpowers/skills/brainstorming");
  assert.equal(result.owner, "obra");
  assert.equal(result.repo, "superpowers");
  assert.equal(result.skillPath, "skills/brainstorming");
});

// ── createSkillsShSource ─────────────────────────────────

test("createSkillsShSource creates correct source ref", () => {
  const source = createSkillsShSource("anthropics/skills/frontend-design");
  assert.equal(source.type, "skills.sh");
  assert.equal(source.locator, "anthropics/skills/frontend-design");
  assert.equal(source.revision, undefined);
});

test("createSkillsShSource with revision", () => {
  const source = createSkillsShSource("owner/repo", "v2.0");
  assert.equal(source.type, "skills.sh");
  assert.equal(source.locator, "owner/repo");
  assert.equal(source.revision, "v2.0");
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFetchedSkill, normalizeRelativePath, createLocalSkillSource } from "./normalize.js";
import { InstallerError } from "../domain/errors.js";
import path from "node:path";

// ── normalizeRelativePath ─────────────────────────────────

test("normalizeRelativePath strips leading ./", () => {
  assert.equal(normalizeRelativePath("./SKILL.md"), "SKILL.md");
});

test("normalizeRelativePath strips leading /", () => {
  assert.equal(normalizeRelativePath("/SKILL.md"), "SKILL.md");
});

test("normalizeRelativePath converts backslashes", () => {
  // Manually test the logic: split by path.sep and join with /
  // On any platform, explicit backslash replacement
  const input = "scripts\\bootstrap.sh";
  const result = normalizeRelativePath(input);
  // On Windows path.sep is \\, so it splits on backslash
  // On Linux path.sep is /, so backslash stays as part of name
  // The function uses path.sep for splitting
  if (path.sep === "\\") {
    assert.equal(result, "scripts/bootstrap.sh");
  } else {
    // On Linux, backslash is part of the filename, not a separator
    assert.equal(result, "scripts\\bootstrap.sh");
  }
});

test("normalizeRelativePath keeps already-normalized paths", () => {
  assert.equal(normalizeRelativePath("SKILL.md"), "SKILL.md");
  assert.equal(normalizeRelativePath("scripts/run.sh"), "scripts/run.sh");
});

// ── normalizeFetchedSkill ─────────────────────────────────

test("normalizeFetchedSkill returns valid FetchedSkill", () => {
  const source = { type: "local" as const, locator: "/path" };
  const result = normalizeFetchedSkill(source, [
    { relativePath: "./SKILL.md", content: "---\nname: test\n---" },
    { relativePath: "scripts/run.sh", content: "#!/bin/bash", executable: true },
  ]);

  assert.equal(result.source, source);
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0].relativePath, "SKILL.md"); // ./ stripped
  assert.equal(result.files[1].executable, true);
});

test("normalizeFetchedSkill throws when no SKILL.md", () => {
  const source = { type: "local" as const, locator: "/path" };
  assert.throws(
    () =>
      normalizeFetchedSkill(source, [
        { relativePath: "README.md", content: "hello" },
      ]),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_FILE",
  );
});

test("normalizeFetchedSkill recognizes SKILL.md with leading ./", () => {
  const source = { type: "local" as const, locator: "/path" };
  const result = normalizeFetchedSkill(source, [
    { relativePath: "./SKILL.md", content: "---\nname: a\n---" },
  ]);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].relativePath, "SKILL.md");
});

test("normalizeFetchedSkill preserves revision from source", () => {
  const source = { type: "git" as const, locator: "https://example.com/repo", revision: "v1.0" };
  const result = normalizeFetchedSkill(source, [
    { relativePath: "SKILL.md", content: "---\nname: a\n---" },
  ]);
  assert.equal(result.revision, "v1.0");
});

// ── createLocalSkillSource ────────────────────────────────

test("createLocalSkillSource returns resolved absolute path", () => {
  const ref = createLocalSkillSource("./relative/path");
  assert.equal(ref.type, "local");
  assert.ok(path.isAbsolute(ref.locator));
});

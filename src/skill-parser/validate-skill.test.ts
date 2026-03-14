import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSkillName,
  validateSkillDescription,
  validateOptionalCompatibility,
  validateOptionalMetadata,
  validateParsedSkillFile,
  validateSkillManifest,
  MAX_SKILL_NAME_LENGTH,
  MAX_SKILL_DESCRIPTION_LENGTH,
} from "./validate-skill.js";
import { InstallerError } from "../domain/errors.js";

// ── validateSkillName ──────────────────────────────────────

test("validateSkillName accepts valid kebab-case name", () => {
  assert.doesNotThrow(() => validateSkillName("hello-world"));
});

test("validateSkillName accepts single-word name", () => {
  assert.doesNotThrow(() => validateSkillName("skill"));
});

test("validateSkillName rejects empty string", () => {
  assert.throws(
    () => validateSkillName(""),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

test("validateSkillName rejects whitespace-only string", () => {
  assert.throws(
    () => validateSkillName("   "),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

test("validateSkillName rejects name exceeding max length", () => {
  const longName = "a".repeat(MAX_SKILL_NAME_LENGTH + 1);
  assert.throws(
    () => validateSkillName(longName),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

test("validateSkillName rejects uppercase characters", () => {
  assert.throws(
    () => validateSkillName("Hello"),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

test("validateSkillName rejects spaces in name", () => {
  assert.throws(
    () => validateSkillName("hello world"),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

test("validateSkillName rejects leading hyphen", () => {
  assert.throws(
    () => validateSkillName("-hello"),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

test("validateSkillName rejects trailing hyphen", () => {
  assert.throws(
    () => validateSkillName("hello-"),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

test("validateSkillName rejects double hyphens", () => {
  assert.throws(
    () => validateSkillName("hello--world"),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

test("validateSkillName rejects directory name mismatch", () => {
  assert.throws(
    () => validateSkillName("hello-skill", "different-dir"),
    (err: unknown) =>
      err instanceof InstallerError &&
      err.code === "INVALID_SKILL_NAME" &&
      err.message.includes("directory"),
  );
});

test("validateSkillName accepts matching directory name", () => {
  assert.doesNotThrow(() => validateSkillName("hello-skill", "hello-skill"));
});

// ── validateSkillDescription ───────────────────────────────

test("validateSkillDescription accepts valid description", () => {
  assert.doesNotThrow(() => validateSkillDescription("A useful skill."));
});

test("validateSkillDescription rejects empty description", () => {
  assert.throws(
    () => validateSkillDescription(""),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_DESCRIPTION",
  );
});

test("validateSkillDescription rejects description exceeding max length", () => {
  const longDesc = "x".repeat(MAX_SKILL_DESCRIPTION_LENGTH + 1);
  assert.throws(
    () => validateSkillDescription(longDesc),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_DESCRIPTION",
  );
});

// ── validateOptionalCompatibility ──────────────────────────

test("validateOptionalCompatibility accepts undefined", () => {
  assert.doesNotThrow(() => validateOptionalCompatibility(undefined));
});

test("validateOptionalCompatibility accepts non-empty string", () => {
  assert.doesNotThrow(() => validateOptionalCompatibility("universal"));
});

test("validateOptionalCompatibility rejects empty string", () => {
  assert.throws(
    () => validateOptionalCompatibility(""),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_FILE",
  );
});

test("validateOptionalCompatibility rejects whitespace-only string", () => {
  assert.throws(
    () => validateOptionalCompatibility("   "),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_FILE",
  );
});

// ── validateOptionalMetadata ───────────────────────────────

test("validateOptionalMetadata accepts undefined", () => {
  assert.doesNotThrow(() => validateOptionalMetadata(undefined));
});

test("validateOptionalMetadata accepts valid key-value pairs", () => {
  assert.doesNotThrow(() => validateOptionalMetadata({ owner: "tests", stage: "unit" }));
});

test("validateOptionalMetadata rejects empty key", () => {
  assert.throws(
    () => validateOptionalMetadata({ "": "value" }),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_FILE",
  );
});

test("validateOptionalMetadata rejects empty value", () => {
  assert.throws(
    () => validateOptionalMetadata({ owner: "" }),
    (err: unknown) =>
      err instanceof InstallerError &&
      err.code === "INVALID_SKILL_FILE" &&
      err.message.includes("owner"),
  );
});

// ── validateParsedSkillFile / validateSkillManifest ────────

test("validateParsedSkillFile returns the parsed object on success", () => {
  const parsed = {
    name: "test-skill",
    description: "A test skill.",
    compatibility: "universal",
    metadata: { owner: "tests" },
    body: "# Test",
    rawFrontmatter: { name: "test-skill", description: "A test skill." },
  };

  const result = validateParsedSkillFile(parsed);
  assert.equal(result, parsed);
});

test("validateSkillManifest returns the manifest on success", () => {
  const manifest = {
    name: "test-skill",
    description: "A test skill.",
  };

  const result = validateSkillManifest(manifest);
  assert.equal(result, manifest);
});

test("validateSkillManifest rejects invalid name in manifest", () => {
  assert.throws(
    () => validateSkillManifest({ name: "BAD NAME", description: "ok" }),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "INVALID_SKILL_NAME",
  );
});

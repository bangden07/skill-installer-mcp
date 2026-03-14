import test from "node:test";
import assert from "node:assert/strict";
import { RegistryResolverImpl } from "./resolver.js";
import { InstallerError } from "../domain/errors.js";
import type { ExecutionContext } from "../domain/types.js";

const ctx: ExecutionContext = {
  workspaceRoot: "/project",
  homeDir: "/home/user",
  platform: "linux",
  nowIso: "2026-03-15T00:00:00.000Z",
};

const resolver = new RegistryResolverImpl();

// ── Explicit source passthrough ──────────────────────────

test("resolver returns explicit source directly", async () => {
  const source = { type: "local" as const, locator: "/some/path" };
  const result = await resolver.resolve({ source }, ctx);
  assert.deepEqual(result, source);
});

// ── No name/id/source throws ─────────────────────────────

test("resolver throws when no name, id, or source", async () => {
  await assert.rejects(
    () => resolver.resolve({}, ctx),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "SOURCE_RESOLUTION_FAILED",
  );
});

// ── Local path detection ─────────────────────────────────

test("resolver detects relative path with dot", async () => {
  const result = await resolver.resolve({ name: "./skills/my-skill" }, ctx);
  assert.equal(result.type, "local");
});

test("resolver detects absolute unix path", async () => {
  const result = await resolver.resolve({ name: "/abs/skills/my-skill" }, ctx);
  assert.equal(result.type, "local");
});

test("resolver detects tilde path", async () => {
  const result = await resolver.resolve({ name: "~/skills/my-skill" }, ctx);
  assert.equal(result.type, "local");
});

test("resolver detects backslash as local path", async () => {
  const result = await resolver.resolve({ name: "skills\\my-skill" }, ctx);
  assert.equal(result.type, "local");
});

// ── Git URL detection ────────────────────────────────────

test("resolver detects git+ prefix", async () => {
  const result = await resolver.resolve(
    { name: "git+https://github.com/owner/repo" },
    ctx,
  );
  assert.equal(result.type, "git");
  assert.equal(result.locator, "https://github.com/owner/repo");
});

test("resolver detects github.com URL", async () => {
  const result = await resolver.resolve(
    { name: "https://github.com/owner/repo" },
    ctx,
  );
  assert.equal(result.type, "git");
  assert.equal(result.locator, "https://github.com/owner/repo");
});

test("resolver detects .git suffix", async () => {
  const result = await resolver.resolve(
    { name: "https://example.com/repo.git" },
    ctx,
  );
  assert.equal(result.type, "git");
});

test("resolver parses git URL fragment as revision", async () => {
  const result = await resolver.resolve(
    { name: "git+https://github.com/owner/repo#main" },
    ctx,
  );
  assert.equal(result.type, "git");
  assert.equal(result.locator, "https://github.com/owner/repo");
  assert.equal(result.revision, "main");
});

// ── skills.sh detection ──────────────────────────────────

test("resolver detects skills.sh: prefix", async () => {
  const result = await resolver.resolve({ name: "skills.sh:owner/my-skill" }, ctx);
  assert.equal(result.type, "skills.sh");
  assert.ok(result.locator.includes("owner/my-skill"));
});

test("resolver detects plain owner/name as skills.sh", async () => {
  const result = await resolver.resolve({ name: "owner/my-skill" }, ctx);
  assert.equal(result.type, "skills.sh");
});

test("resolver does NOT treat dotted domain as skills.sh", async () => {
  // "owner.com/name" has a dot in first segment — should NOT match slash selector
  await assert.rejects(
    () => resolver.resolve({ name: "owner.com/name" }, ctx),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "SOURCE_RESOLUTION_FAILED",
  );
});

test("resolver detects 3-segment owner/repo/skill as skills.sh", async () => {
  const result = await resolver.resolve({ name: "anthropics/skills/frontend-design" }, ctx);
  assert.equal(result.type, "skills.sh");
  assert.ok(result.locator.includes("anthropics/skills/frontend-design"));
});

test("resolver does NOT treat 4-segment as skills.sh", async () => {
  await assert.rejects(
    () => resolver.resolve({ name: "a/b/c/d" }, ctx),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "SOURCE_RESOLUTION_FAILED",
  );
});

// ── Unresolvable ─────────────────────────────────────────

test("resolver throws for plain name without any pattern", async () => {
  await assert.rejects(
    () => resolver.resolve({ name: "just-a-name" }, ctx),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "SOURCE_RESOLUTION_FAILED",
  );
});

// ── id fallback ──────────────────────────────────────────

test("resolver uses id when name is not provided", async () => {
  const result = await resolver.resolve({ id: "./local-skill" }, ctx);
  assert.equal(result.type, "local");
});

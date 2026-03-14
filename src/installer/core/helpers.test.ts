import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  buildExecutionContext,
  summarizeInstallResult,
  summarizeResolvedModes,
  buildPlanSummary,
  formatPathForDisplay,
  resolveStoredPath,
  normalizeScopeSelection,
  computePlanFingerprint,
  getAdapterOrThrow,
  normalizeTargetError,
  normalizeSkillError,
  assertPlanStillMatchesInput,
  normalizeSkillSelector,
} from "./helpers.js";
import { InstallerError } from "../../domain/errors.js";
import type { ExecutionContext, AgentId } from "../../domain/types.js";

// ── buildExecutionContext ─────────────────────────────────

test("buildExecutionContext sets workspaceRoot from workspacePath", () => {
  const ctx = buildExecutionContext({ workspacePath: "./my-project" });
  assert.ok(path.isAbsolute(ctx.workspaceRoot!));
  assert.ok(ctx.homeDir.length > 0);
  assert.ok(ctx.nowIso.length > 0);
});

test("buildExecutionContext leaves workspaceRoot undefined if no path", () => {
  const ctx = buildExecutionContext({});
  assert.equal(ctx.workspaceRoot, undefined);
});

// ── summarizeInstallResult ────────────────────────────────

test("summarizeInstallResult returns success when no failures", () => {
  assert.equal(summarizeInstallResult(0, 5), "success");
});

test("summarizeInstallResult returns partial when mixed", () => {
  assert.equal(summarizeInstallResult(2, 3), "partial");
});

test("summarizeInstallResult returns error when all failed", () => {
  assert.equal(summarizeInstallResult(3, 0), "error");
});

// ── summarizeResolvedModes ────────────────────────────────

test("summarizeResolvedModes returns mixed for empty array", () => {
  assert.equal(summarizeResolvedModes([]), "mixed");
});

test("summarizeResolvedModes returns single mode", () => {
  assert.equal(summarizeResolvedModes(["symlink", "symlink"]), "symlink");
});

test("summarizeResolvedModes returns mixed for different modes", () => {
  assert.equal(summarizeResolvedModes(["symlink", "copy"]), "mixed");
});

// ── buildPlanSummary ──────────────────────────────────────

test("buildPlanSummary counts correctly", () => {
  const summary = buildPlanSummary({
    skillsCount: 2,
    targetActions: [
      { action: "link", status: "planned" },
      { action: "skip", status: "planned" },
      { action: "copy", status: "manual_required" },
    ],
  });

  assert.equal(summary.skillsCount, 2);
  assert.equal(summary.targetCount, 3);
  assert.equal(summary.plannedInstalls, 2);
  assert.equal(summary.plannedSkips, 1);
  assert.equal(summary.manualSteps, 1);
});

// ── computePlanFingerprint ────────────────────────────────

test("computePlanFingerprint returns deterministic hash", () => {
  const payload = { skills: ["a"], scope: "project" };
  const fp1 = computePlanFingerprint(payload);
  const fp2 = computePlanFingerprint(payload);
  assert.equal(fp1, fp2);
  assert.match(fp1, /^plan_[0-9a-f]{16}$/);
});

test("computePlanFingerprint differs for different payloads", () => {
  const fp1 = computePlanFingerprint({ a: 1 });
  const fp2 = computePlanFingerprint({ a: 2 });
  assert.notEqual(fp1, fp2);
});

// ── formatPathForDisplay ──────────────────────────────────

test("formatPathForDisplay returns relative for project scope", () => {
  const ctx: ExecutionContext = {
    workspaceRoot: "/home/user/project",
    homeDir: "/home/user",
    platform: "linux",
    nowIso: "",
  };
  const result = formatPathForDisplay(ctx, "project", "/home/user/project/.agents/skills/foo");
  assert.equal(result, ".agents/skills/foo");
});

test("formatPathForDisplay returns tilde path for global scope", () => {
  const ctx: ExecutionContext = {
    workspaceRoot: "/home/user/project",
    homeDir: "/home/user",
    platform: "linux",
    nowIso: "",
  };
  const result = formatPathForDisplay(ctx, "global", "/home/user/.agents/skills/foo");
  assert.equal(result, "~/.agents/skills/foo");
});

// ── resolveStoredPath ─────────────────────────────────────

test("resolveStoredPath resolves tilde paths", () => {
  const ctx: ExecutionContext = {
    workspaceRoot: "/project",
    homeDir: "/home/user",
    platform: "linux",
    nowIso: "",
  };
  const result = resolveStoredPath(ctx, "global", "~/.agents/skills/foo");
  assert.equal(result, path.join("/home/user", ".agents", "skills", "foo"));
});

test("resolveStoredPath returns absolute paths unchanged", () => {
  const ctx: ExecutionContext = {
    workspaceRoot: "/project",
    homeDir: "/home/user",
    platform: "linux",
    nowIso: "",
  };
  const result = resolveStoredPath(ctx, "project", "/absolute/path");
  assert.equal(result, "/absolute/path");
});

test("resolveStoredPath resolves relative paths in project scope", () => {
  const ctx: ExecutionContext = {
    workspaceRoot: "/project",
    homeDir: "/home/user",
    platform: "linux",
    nowIso: "",
  };
  const result = resolveStoredPath(ctx, "project", ".agents/skills/foo");
  assert.equal(result, path.join("/project", ".agents", "skills", "foo"));
});

// ── normalizeScopeSelection ───────────────────────────────

test("normalizeScopeSelection returns both for undefined", () => {
  assert.deepEqual(normalizeScopeSelection(undefined), ["project", "global"]);
});

test("normalizeScopeSelection returns both for all", () => {
  assert.deepEqual(normalizeScopeSelection("all"), ["project", "global"]);
});

test("normalizeScopeSelection returns single for project", () => {
  assert.deepEqual(normalizeScopeSelection("project"), ["project"]);
});

test("normalizeScopeSelection returns single for global", () => {
  assert.deepEqual(normalizeScopeSelection("global"), ["global"]);
});

// ── getAdapterOrThrow ─────────────────────────────────────

test("getAdapterOrThrow throws for unknown agent", () => {
  assert.throws(
    () => getAdapterOrThrow({} as any, "cursor" as AgentId),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "AGENT_NOT_SUPPORTED",
  );
});

test("getAdapterOrThrow returns adapter if present", () => {
  const fakeAdapter = { detect: () => {} };
  const registry = { cursor: fakeAdapter } as any;
  assert.equal(getAdapterOrThrow(registry, "cursor"), fakeAdapter);
});

// ── normalizeTargetError ──────────────────────────────────

test("normalizeTargetError wraps InstallerError", () => {
  const err = new InstallerError("TARGET_MISSING", "gone");
  const result = normalizeTargetError("skill-a", "cursor", err);
  assert.equal(result.skillName, "skill-a");
  assert.equal(result.agentId, "cursor");
  assert.equal(result.code, "TARGET_MISSING");
  assert.equal(result.message, "gone");
});

test("normalizeTargetError wraps plain Error", () => {
  const result = normalizeTargetError("skill-a", "cursor", new Error("oops"));
  assert.equal(result.code, "UNKNOWN_ERROR");
  assert.equal(result.message, "oops");
});

// ── normalizeSkillError ───────────────────────────────────

test("normalizeSkillError uses selector name", () => {
  const result = normalizeSkillError({ name: "my-skill" }, new Error("fail"));
  assert.equal(result.skillName, "my-skill");
});

test("normalizeSkillError uses selector id if no name", () => {
  const result = normalizeSkillError({ id: "my-id" }, new Error("fail"));
  assert.equal(result.skillName, "my-id");
});

test("normalizeSkillError uses source locator as fallback", () => {
  const result = normalizeSkillError(
    { source: { type: "local", locator: "/path/to/skill" } },
    new Error("fail"),
  );
  assert.equal(result.skillName, "/path/to/skill");
});

// ── assertPlanStillMatchesInput ───────────────────────────

test("assertPlanStillMatchesInput passes on matching input", () => {
  const storedPlan = {
    requestedSkills: ["my-skill"],
    agents: ["cursor"],
    scope: "project" as const,
    modeRequested: "auto",
  };
  assert.doesNotThrow(() =>
    assertPlanStillMatchesInput(storedPlan, {
      skills: [{ name: "my-skill" }],
      agents: ["cursor"],
      scope: "project",
      mode: "auto",
    }),
  );
});

test("assertPlanStillMatchesInput throws on scope mismatch", () => {
  const storedPlan = {
    requestedSkills: ["my-skill"],
    agents: ["cursor"],
    scope: "project" as const,
    modeRequested: "auto",
  };
  assert.throws(
    () =>
      assertPlanStillMatchesInput(storedPlan, {
        skills: [{ name: "my-skill" }],
        scope: "global",
      }),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "PLAN_MISMATCH",
  );
});

test("assertPlanStillMatchesInput throws on mode mismatch", () => {
  const storedPlan = {
    requestedSkills: ["my-skill"],
    agents: ["cursor"],
    scope: "project" as const,
    modeRequested: "auto",
  };
  assert.throws(
    () =>
      assertPlanStillMatchesInput(storedPlan, {
        skills: [{ name: "my-skill" }],
        scope: "project",
        mode: "symlink",
      }),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "PLAN_MISMATCH",
  );
});

test("assertPlanStillMatchesInput throws on skills mismatch", () => {
  const storedPlan = {
    requestedSkills: ["skill-a"],
    agents: ["cursor"],
    scope: "project" as const,
    modeRequested: "auto",
  };
  assert.throws(
    () =>
      assertPlanStillMatchesInput(storedPlan, {
        skills: [{ name: "skill-b" }],
        scope: "project",
        mode: "auto",
      }),
    (err: unknown) =>
      err instanceof InstallerError && err.code === "PLAN_MISMATCH",
  );
});

test("assertPlanStillMatchesInput skips agent check when agents not provided", () => {
  const storedPlan = {
    requestedSkills: ["my-skill"],
    agents: ["cursor", "codex"],
    scope: "project" as const,
    modeRequested: "auto",
  };
  // No agents in input — should NOT throw on agent mismatch
  assert.doesNotThrow(() =>
    assertPlanStillMatchesInput(storedPlan, {
      skills: [{ name: "my-skill" }],
      scope: "project",
      mode: "auto",
    }),
  );
});

// ── normalizeSkillSelector ────────────────────────────────

test("normalizeSkillSelector prefers name", () => {
  assert.equal(normalizeSkillSelector({ name: "a", id: "b" }), "a");
});

test("normalizeSkillSelector falls back to id", () => {
  assert.equal(normalizeSkillSelector({ id: "b" }), "b");
});

test("normalizeSkillSelector falls back to source locator", () => {
  assert.equal(
    normalizeSkillSelector({ source: { type: "local", locator: "/x" } }),
    "/x",
  );
});

test("normalizeSkillSelector returns unknown for empty selector", () => {
  assert.equal(normalizeSkillSelector({}), "unknown-selector");
});

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRules, getBuiltinRules } from "./rules-engine.js";
import { recommendSkills } from "./recommend-skills.js";
import { rerankWithOpenRouter, _parseRerankResponse } from "./openrouter-reranker.js";
import {
  createTempWorkspace,
  createExecutionContext,
  disposeTempPath,
} from "../test/helpers.js";
import { writeText } from "../utils/fs.js";
import path from "node:path";

test("rules engine returns candidates for TypeScript goal", () => {
  const candidates = evaluateRules(null, "Help me write better TypeScript code");

  assert.ok(candidates.length > 0);

  const tsCandidate = candidates.find((c) => c.id === "typescript-best-practices");
  assert.ok(tsCandidate);
  assert.ok(tsCandidate.rawScore > 0);
  assert.ok(tsCandidate.reasons.length > 0);
});

test("rules engine scores higher with matching project analysis", () => {
  const withoutAnalysis = evaluateRules(null, "Help with TypeScript");
  const withAnalysis = evaluateRules(
    {
      workspacePath: "/test",
      projectKinds: ["node", "web"],
      languages: ["typescript"],
      frameworks: ["nextjs", "react"],
      packageManagers: ["pnpm"],
      signals: ["has-tests"],
      manifestFiles: [],
      confidence: 0.8,
    },
    "Help with TypeScript",
  );

  // The TypeScript skill should score higher when we have matching analysis
  const tsWithout = withoutAnalysis.find((c) => c.id === "typescript-best-practices");
  const tsWith = withAnalysis.find((c) => c.id === "typescript-best-practices");

  assert.ok(tsWithout);
  assert.ok(tsWith);
  assert.ok(tsWith.rawScore >= tsWithout.rawScore);
});

test("rules engine filters by agent", () => {
  const all = evaluateRules(null, "testing code");
  const filtered = evaluateRules(null, "testing code", ["cursor"]);

  // All candidates in filtered should include cursor
  for (const candidate of filtered) {
    assert.ok(candidate.supportedAgents.includes("cursor"));
  }
});

test("rules engine returns empty for unrelated goal", () => {
  const candidates = evaluateRules(null, "xyzzy foobar qux");

  assert.equal(candidates.length, 0);
});

test("getBuiltinRules returns non-empty rule set", () => {
  const rules = getBuiltinRules();
  assert.ok(rules.length > 0);
});

test("recommendSkills returns recommendations with goal only", async () => {
  const workspace = await createTempWorkspace("recommend-test");

  try {
    const ctx = createExecutionContext(workspace);

    const result = await recommendSkills(
      { goal: "I need help with React components and testing" },
      ctx,
    );

    assert.equal(result.goal, "I need help with React components and testing");
    assert.ok(result.recommendations.length > 0);

    // All recommendations should have required fields
    for (const rec of result.recommendations) {
      assert.ok(rec.rank >= 1);
      assert.ok(rec.score >= 0 && rec.score <= 1);
      assert.ok(rec.confidence >= 0 && rec.confidence <= 1);
      assert.ok(rec.id.length > 0);
      assert.ok(rec.name.length > 0);
      assert.ok(rec.reasons.length > 0);
      assert.ok(rec.supportedAgents.length > 0);
    }

    // First recommendation should have score = 1 (normalized)
    assert.equal(result.recommendations[0].score, 1);
  } finally {
    await disposeTempPath(workspace);
  }
});

test("recommendSkills includes analysis context when workspace provided", async () => {
  const workspace = await createTempWorkspace("recommend-ctx-test");

  try {
    const ctx = createExecutionContext(workspace);

    // Seed a TypeScript + React workspace
    await writeText(
      path.join(workspace, "package.json"),
      JSON.stringify({ dependencies: { react: "^18" } }),
    );
    await writeText(path.join(workspace, "tsconfig.json"), "{}");

    const result = await recommendSkills(
      {
        goal: "Help me with TypeScript",
        workspacePath: workspace,
      },
      ctx,
    );

    assert.ok(result.analyzedContext);
    assert.ok(result.analyzedContext.frameworks.includes("react"));
    assert.ok(result.recommendations.length > 0);
  } finally {
    await disposeTempPath(workspace);
  }
});

test("recommendSkills respects topK limit", async () => {
  const workspace = await createTempWorkspace("recommend-topk-test");

  try {
    const ctx = createExecutionContext(workspace);

    const result = await recommendSkills(
      {
        goal: "testing typescript react",
        topK: 2,
      },
      ctx,
    );

    assert.ok(result.recommendations.length <= 2);
  } finally {
    await disposeTempPath(workspace);
  }
});

// --- OpenRouter reranker tests ---

test("parseRerankResponse parses plain JSON array", () => {
  const result = _parseRerankResponse('["skill-a", "skill-b", "skill-c"]');
  assert.deepEqual(result, ["skill-a", "skill-b", "skill-c"]);
});

test("parseRerankResponse parses JSON array in code block", () => {
  const input = '```json\n["skill-a", "skill-b"]\n```';
  const result = _parseRerankResponse(input);
  assert.deepEqual(result, ["skill-a", "skill-b"]);
});

test("parseRerankResponse extracts JSON array from mixed text", () => {
  const input = 'Here are the results:\n["skill-a", "skill-b"]\nDone.';
  const result = _parseRerankResponse(input);
  assert.deepEqual(result, ["skill-a", "skill-b"]);
});

test("parseRerankResponse returns null for invalid input", () => {
  assert.equal(_parseRerankResponse("no json here"), null);
  assert.equal(_parseRerankResponse(""), null);
  assert.equal(_parseRerankResponse('{"not": "array"}'), null);
});

test("rerankWithOpenRouter falls back gracefully without API key", async () => {
  const candidates = evaluateRules(null, "typescript testing react code");
  assert.ok(candidates.length > 1, `Expected >1 candidates, got ${candidates.length}`);

  // Clear any env key to ensure fallback
  const original = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  try {
    const result = await rerankWithOpenRouter(candidates, "typescript testing react", null);

    assert.equal(result.reranked, false);
    assert.equal(result.fallbackReason, "no_api_key");
    assert.equal(result.candidates.length, candidates.length);
  } finally {
    if (original !== undefined) process.env.OPENROUTER_API_KEY = original;
  }
});

test("rerankWithOpenRouter skips for single candidate", async () => {
  const candidates = evaluateRules(null, "Help me write better TypeScript code").slice(0, 1);
  assert.equal(candidates.length, 1);

  const result = await rerankWithOpenRouter(candidates, "TypeScript", null, { apiKey: "test" });

  assert.equal(result.reranked, false);
  assert.equal(result.fallbackReason, "too_few_candidates");
});

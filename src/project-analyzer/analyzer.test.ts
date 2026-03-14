import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  createTempWorkspace,
  createExecutionContext,
  disposeTempPath,
} from "../test/helpers.js";
import { writeText, ensureDir } from "../utils/fs.js";
import { analyzeProject } from "./analyze-project.js";
import { detectFrameworks } from "./detect-frameworks.js";
import { detectSignals } from "./detect-signals.js";

test("detectFrameworks identifies TypeScript + Next.js project", async () => {
  const workspace = await createTempWorkspace("fw-detect-test");

  try {
    await writeText(
      path.join(workspace, "package.json"),
      JSON.stringify({ dependencies: { react: "^18", next: "^14" } }),
    );
    await writeText(
      path.join(workspace, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { target: "ES2022" } }),
    );
    await writeText(path.join(workspace, "next.config.mjs"), "export default {}");

    const result = await detectFrameworks(workspace);

    assert.ok(result.languages.includes("typescript"));
    assert.ok(result.frameworks.includes("nextjs"));
    assert.ok(result.frameworks.includes("react"));
    assert.ok(result.projectKinds.includes("web"));
    assert.ok(result.projectKinds.includes("node"));
  } finally {
    await disposeTempPath(workspace);
  }
});

test("detectFrameworks identifies Python + Django project", async () => {
  const workspace = await createTempWorkspace("py-detect-test");

  try {
    await writeText(
      path.join(workspace, "pyproject.toml"),
      "[tool.pytest]\n",
    );
    await writeText(
      path.join(workspace, "requirements.txt"),
      "django>=4.0\n",
    );
    await writeText(path.join(workspace, "manage.py"), "#!/usr/bin/env python\nimport os\n");

    const result = await detectFrameworks(workspace);

    assert.ok(result.languages.includes("python"));
    assert.ok(result.frameworks.includes("django"));
    assert.ok(result.projectKinds.includes("web"));
  } finally {
    await disposeTempPath(workspace);
  }
});

test("detectSignals detects CI, linting and agent signals", async () => {
  const workspace = await createTempWorkspace("signal-detect-test");

  try {
    await ensureDir(path.join(workspace, ".github", "workflows"));
    await writeText(path.join(workspace, "eslint.config.js"), "export default []");
    await writeText(path.join(workspace, "AGENTS.md"), "# Agent");
    await writeText(path.join(workspace, "README.md"), "# README");

    const result = await detectSignals(workspace);

    assert.ok(result.signals.includes("has-ci"));
    assert.ok(result.signals.includes("has-linting"));
    assert.ok(result.signals.includes("uses-agents"));
    assert.ok(result.signals.includes("has-readme"));
    assert.ok(result.manifestFiles.includes("AGENTS.md"));
    assert.ok(result.manifestFiles.includes("README.md"));
  } finally {
    await disposeTempPath(workspace);
  }
});

test("analyzeProject returns full analysis with confidence", async () => {
  const workspace = await createTempWorkspace("analyze-project-test");

  try {
    const ctx = createExecutionContext(workspace);

    await writeText(
      path.join(workspace, "package.json"),
      JSON.stringify({ dependencies: { react: "^18" } }),
    );
    await writeText(path.join(workspace, "tsconfig.json"), "{}");
    await writeText(path.join(workspace, "vitest.config.ts"), "export default {}");
    await writeText(path.join(workspace, "README.md"), "# Hello");

    const analysis = await analyzeProject({ workspacePath: workspace }, ctx);

    assert.ok(analysis.languages.includes("typescript"));
    assert.ok(analysis.frameworks.includes("react"));
    assert.ok(analysis.signals.includes("has-tests"));
    assert.ok(analysis.confidence > 0);
    assert.ok(analysis.confidence <= 1);
  } finally {
    await disposeTempPath(workspace);
  }
});

test("analyzeProject returns low confidence for empty workspace", async () => {
  const workspace = await createTempWorkspace("analyze-empty-test");

  try {
    const ctx = createExecutionContext(workspace);
    const analysis = await analyzeProject({ workspacePath: workspace }, ctx);

    assert.equal(analysis.confidence, 0);
    assert.equal(analysis.languages.length, 0);
    assert.equal(analysis.frameworks.length, 0);
  } finally {
    await disposeTempPath(workspace);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { createLockStore } from "./lock-store.js";
import { createTempWorkspace, createExecutionContext, disposeTempPath } from "../test/helpers.js";
import { InstallerError } from "../domain/errors.js";

test("lock acquire and release lifecycle", async () => {
  const ws = await createTempWorkspace("lock-lifecycle");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const handle = await store.acquire(ctx, "project", "install");
    assert.equal(handle.name, "install");
    assert.equal(handle.scope, "project");

    const locked = await store.isLocked(ctx, "project", "install");
    assert.equal(locked, true);

    await store.release(handle);

    const lockedAfter = await store.isLocked(ctx, "project", "install");
    assert.equal(lockedAfter, false);
  } finally {
    await disposeTempPath(ws);
  }
});

test("lock acquire twice throws LOCK_ACQUISITION_FAILED", async () => {
  const ws = await createTempWorkspace("lock-double");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const handle = await store.acquire(ctx, "project", "install");

    await assert.rejects(
      () => store.acquire(ctx, "project", "install"),
      (err: unknown) =>
        err instanceof InstallerError &&
        err.code === "LOCK_ACQUISITION_FAILED" &&
        err.retryable === true,
    );

    await store.release(handle);
  } finally {
    await disposeTempPath(ws);
  }
});

test("lock re-acquire after release succeeds", async () => {
  const ws = await createTempWorkspace("lock-reacquire");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const handle1 = await store.acquire(ctx, "project", "install");
    await store.release(handle1);

    const handle2 = await store.acquire(ctx, "project", "install");
    assert.ok(handle2.lockPath);
    await store.release(handle2);
  } finally {
    await disposeTempPath(ws);
  }
});

test("isLocked returns false when no lock exists", async () => {
  const ws = await createTempWorkspace("lock-noexist");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const locked = await store.isLocked(ctx, "project", "nonexistent");
    assert.equal(locked, false);
  } finally {
    await disposeTempPath(ws);
  }
});

test("readMetadata returns null when no lock", async () => {
  const ws = await createTempWorkspace("lock-nometa");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const meta = await store.readMetadata(ctx, "project", "nonexistent");
    assert.equal(meta, null);
  } finally {
    await disposeTempPath(ws);
  }
});

test("readMetadata returns valid metadata after acquire", async () => {
  const ws = await createTempWorkspace("lock-meta");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const handle = await store.acquire(ctx, "project", "install");

    const meta = await store.readMetadata(ctx, "project", "install");
    assert.ok(meta);
    assert.equal(meta!.name, "install");
    assert.equal(meta!.scope, "project");
    assert.equal(typeof meta!.pid, "number");
    assert.equal(meta!.acquiredAt, ctx.nowIso);

    await store.release(handle);
  } finally {
    await disposeTempPath(ws);
  }
});

test("getLocksDir for project scope uses workspaceRoot", async () => {
  const ws = await createTempWorkspace("lock-dir-proj");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const dir = store.getLocksDir(ctx, "project");
    assert.ok(dir.includes(".skill-installer"));
    assert.ok(dir.includes("locks"));
  } finally {
    await disposeTempPath(ws);
  }
});

test("getLocksDir for global scope uses homeDir", async () => {
  const ws = await createTempWorkspace("lock-dir-global");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const dir = store.getLocksDir(ctx, "global");
    assert.ok(dir.includes(".config"));
    assert.ok(dir.includes("skill-installer"));
    assert.ok(dir.includes("locks"));
  } finally {
    await disposeTempPath(ws);
  }
});

test("getLockPath includes lock name", async () => {
  const ws = await createTempWorkspace("lock-path");
  try {
    const ctx = createExecutionContext(ws);
    const store = createLockStore();

    const lockPath = store.getLockPath(ctx, "project", "my-lock");
    assert.ok(lockPath.endsWith("my-lock.lock"));
  } finally {
    await disposeTempPath(ws);
  }
});

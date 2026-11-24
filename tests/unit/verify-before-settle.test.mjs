import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");

async function loadExtension() {
  const dir = mkdtempSync(join(tmpdir(), "principal-verify-"));
  const mjs = join(dir, "verify-before-settle.mjs");
  writeFileSync(mjs, readFileSync(resolve(root, "extensions/verify-before-settle.ts"), "utf8"));
  const mod = await import(pathToFileURL(mjs).href);
  return { fn: mod.default, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function createHarness(verifyBeforeSettle) {
  const handlers = new Map();
  const pi = {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
  };
  verifyBeforeSettle(pi);
  const fire = async (event, payload) => {
    let last;
    for (const fn of handlers.get(event) ?? []) last = await fn(payload);
    return last;
  };
  // Mirrors Pi 1.6 contract: args arrive ONLY on tool_execution_start, never tool_execution_end.
  const runTool = async (id, toolName, args, isError = false) => {
    await fire("tool_execution_start", { toolCallId: id, toolName, args });
    await fire("tool_execution_end", { toolCallId: id, toolName, isError });
  };
  return { fire, runTool };
}

test("nudges once when files are edited without subsequent passing verification", async () => {
  const { fn, cleanup } = await loadExtension();
  try {
    const { fire, runTool } = createHarness(fn);
    await fire("before_agent_start", {});
    await runTool("c1", "edit", { path: "src/limiter.mjs" }, false);

    const first = await fire("agent_before_settle", { entries: [] });
    assert.equal(first?.continue, true);
    assert.equal(first.entries.length, 1);
    assert.match(first.entries[0].content, /src\/limiter\.mjs/);

    const second = await fire("agent_before_settle", { entries: [] });
    assert.equal(second, undefined);
  } finally {
    cleanup();
  }
});

test("does not treat ls/cat/echo mentioning 'test' as passing verification", async () => {
  const { fn, cleanup } = await loadExtension();
  try {
    const { fire, runTool } = createHarness(fn);
    await fire("before_agent_start", {});
    await runTool("c1", "edit", { path: "src/limiter.mjs" }, false);
    await new Promise((r) => setTimeout(r, 5));
    await runTool("c2", "bash", { command: "ls test/" }, false);
    await runTool("c3", "bash", { command: "cat test/limiter.test.mjs" }, false);
    await runTool("c4", "bash", { command: "echo check passed" }, false);

    const res = await fire("agent_before_settle", { entries: [] });
    assert.equal(res?.continue, true);
  } finally {
    cleanup();
  }
});

test("treats node -e and python -c verification commands as passing checks", async () => {
  const { fn, cleanup } = await loadExtension();
  try {
    const { fire, runTool } = createHarness(fn);
    await fire("before_agent_start", {});
    await runTool("c1", "write", { path: "fib.js" }, false);
    await new Promise((r) => setTimeout(r, 5));
    await runTool("c2", "bash", { command: 'node -e "console.log(1)"' }, false);
    assert.equal(await fire("agent_before_settle", { entries: [] }), undefined);
  } finally {
    cleanup();
  }
});

test("skips settle nudge when pi-daddy-cold-review already requested continuation", async () => {
  const { fn, cleanup } = await loadExtension();
  try {
    const { fire, runTool } = createHarness(fn);
    await fire("before_agent_start", {});
    await runTool("c1", "edit", { path: "src/app.mjs" }, false);
    const res = await fire("agent_before_settle", {
      entries: [{ type: "custom_message", customType: "pi-daddy-cold-review", content: "Fix bug" }],
    });
    assert.equal(res, undefined);
  } finally {
    cleanup();
  }
});

test("blocks runaway whole-filesystem find / scans via tool_call", async () => {
  const { fn, cleanup } = await loadExtension();
  try {
    const { fire } = createHarness(fn);
    const blocked = await fire("tool_call", { toolName: "bash", input: { command: 'find / -name "*test*"' } });
    assert.equal(blocked?.block, true);
    const allowed = await fire("tool_call", { toolName: "bash", input: { command: 'find . -name "*test*"' } });
    assert.equal(allowed, undefined);
  } finally {
    cleanup();
  }
});

test("does not nudge when an actual test runner passes after the last edit", async () => {
  const { fn, cleanup } = await loadExtension();
  try {
    const { fire, runTool } = createHarness(fn);
    await fire("before_agent_start", {});
    await runTool("c1", "write", { path: "src/app.mjs" }, false);
    await new Promise((r) => setTimeout(r, 5));
    await runTool("c2", "bash", { command: "npm test" }, false);

    const res = await fire("agent_before_settle", { entries: [] });
    assert.equal(res, undefined);
  } finally {
    cleanup();
  }
});

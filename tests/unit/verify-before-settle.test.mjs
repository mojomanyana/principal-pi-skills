import test from "node:test";
import assert from "node:assert/strict";
import verifyBeforeSettle from "../../extensions/verify-before-settle.ts";

function createHarness() {
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
  const { fire, runTool } = createHarness();
  await fire("before_agent_start", {});
  await runTool("c1", "edit", { path: "src/limiter.mjs" }, false);

  const first = await fire("agent_before_settle", { entries: [] });
  assert.equal(first?.continue, true);
  assert.equal(first.entries.length, 1);
  assert.match(first.entries[0].content, /src\/limiter\.mjs/);

  const second = await fire("agent_before_settle", { entries: [] });
  assert.equal(second, undefined);
});

test("does not treat ls/cat/echo mentioning 'test' as passing verification", async () => {
  const { fire, runTool } = createHarness();
  await fire("before_agent_start", {});
  await runTool("c1", "edit", { path: "src/limiter.mjs" }, false);
  await new Promise((r) => setTimeout(r, 5));
  await runTool("c2", "bash", { command: "ls test/" }, false);
  await runTool("c3", "bash", { command: "cat test/limiter.test.mjs" }, false);
  await runTool("c4", "bash", { command: "echo check passed" }, false);

  const res = await fire("agent_before_settle", { entries: [] });
  assert.equal(res?.continue, true);
});

test("does not nudge when an actual test runner passes after the last edit", async () => {
  const { fire, runTool } = createHarness();
  await fire("before_agent_start", {});
  await runTool("c1", "write", { path: "src/app.mjs" }, false);
  await new Promise((r) => setTimeout(r, 5));
  await runTool("c2", "bash", { command: "npm test" }, false);

  const res = await fire("agent_before_settle", { entries: [] });
  assert.equal(res, undefined);
});

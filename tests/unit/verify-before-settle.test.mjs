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
  return { fire };
}

test("nudges once when files are edited without subsequent passing verification", async () => {
  const { fire } = createHarness();
  await fire("before_agent_start", {});
  await fire("tool_execution_end", { toolName: "edit", args: { path: "src/limiter.mjs" }, isError: false });

  const first = await fire("agent_before_settle", { entries: [] });
  assert.equal(first?.continue, true);
  assert.equal(first.entries.length, 1);
  assert.match(first.entries[0].content, /src\/limiter\.mjs/);

  // Guard against infinite loop: second settle without reset does not nudge again
  const second = await fire("agent_before_settle", { entries: [] });
  assert.equal(second, undefined);
});

test("does not nudge when tests pass after the last edit", async () => {
  const { fire } = createHarness();
  await fire("before_agent_start", {});
  await fire("tool_execution_end", { toolName: "write", args: { path: "src/app.mjs" }, isError: false });
  await new Promise((r) => setTimeout(r, 5));
  await fire("tool_execution_end", { toolName: "bash", args: { command: "npm test" }, isError: false });

  const res = await fire("agent_before_settle", { entries: [] });
  assert.equal(res, undefined);
});

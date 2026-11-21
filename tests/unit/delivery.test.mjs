import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DELIVERY_ENTRY, HANDOFF_MESSAGE, RECOVERY_MESSAGE, criterionEvidence, normalizeDeliveryCriteria, scopeRequest, userNamedArtifact } from "../../scripts/delivery-state.mjs";
import { runVerification } from "../../scripts/check-runner.mjs";

const source = new URL("../../extensions/delivery.ts", import.meta.url);
const code = readFileSync(source, "utf8").replace('import { Type } from "typebox";', "const Type = new Proxy({}, { get: () => () => ({}) });")
  .replace(/from "(\.\.\/scripts\/[^"]+)"/gu, (_match, spec) => `from ${JSON.stringify(new URL(spec, source).href)}`)
  .replaceAll("import.meta.url", JSON.stringify(source.href));
const { default: register } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const architect = fileURLToPath(new URL("../../architect/SKILL.md", import.meta.url));
const assistant = (text = "") => ({ role: "assistant", stopReason: "stop", content: text ? [{ type: "text", text }] : [] });
const completed = (final = assistant()) => ({ outcome: "completed", continue: false, entries: [], context: { canContinue: false, pendingMessages: [], contextMessages: [final] } });
const artifact = { id: "product", kind: "artifact", path: "src.txt", requirement: "Create src.txt" };
const summary = { id: "summary", kind: "handoff", path: "summary.md", requirement: "Write the final summary" };

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "principal-delivery-")), sessionDir = join(cwd, "sessions");
  mkdirSync(sessionDir);
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  function make({ sessionId = randomUUID(), selectedTask, peer } = {}) {
    const handlers = new Map(), messages = [], branch = [], sessionFile = join(sessionDir, `2026-11-21T00-00-00-000Z_${sessionId}.jsonl`);
    const header = { type: "session", id: sessionId, cwd };
    const flush = () => writeFileSync(sessionFile, [header, ...branch].map(item => JSON.stringify(item)).join("\n") + "\n");
    const append = item => { branch.push({ ...item, id: randomUUID(), parentId: branch.at(-1)?.id ?? null }); flush(); };
    flush();
    let tool;
    const pi = {
      on(event, listener) { handlers.set(event, listener); },
      registerTool(value) { tool = value; },
      appendEntry(customType, data) { append({ type: "custom", customType, data }); },
      sendMessage(message) { messages.push(message); },
      getCommands() { return [{ source: "skill", name: "skill:architect", sourceInfo: { path: architect } }]; },
      getActiveTools() { return ["read", "write", "principal_delivery"]; },
      events: { emit(channel, request) {
        if (channel === "pi-daddy:delivery-task:v1" && peer) request.reply({ ...request, taskId: selectedTask, assertMayContinue: peer });
      } },
    };
    const ctx = { cwd, sessionManager: { getSessionId: () => sessionId, getSessionFile: () => sessionFile, getSessionDir: () => sessionDir, getBranch: () => branch } };
    const fire = (event, value) => handlers.get(event)?.(value, ctx);
    const settle = async (event = completed()) => {
      fire("turn_end", { ...event, message: event.context.contextMessages.at(-1) });
      fire("agent_end", { messages: event.context.contextMessages });
      const boundary = await fire("agent_before_settle", event);
      for (const entry of boundary?.entries ?? []) append(entry);
      return boundary;
    };
    register(pi);
    return { fire, settle, branch, messages, sessionFile,
      start: prompt => fire("before_agent_start", { messageType: "user", prompt }),
      call: (action, fields = {}) => tool.execute("id", { action, ...fields }, new AbortController().signal, null, ctx).then(value => value.details) };
  }
  return { cwd, make, sessionDir };
}

test("ordinary work stays in the original delivery through setup, one narrow follow-up and a visible empty-final handoff", async t => {
  const { cwd, make } = fixture(t), h = make();
  h.start("Fix one spelling in src.txt.");
  assert.equal(await h.settle(completed(assistant("Fixed it."))), undefined);
  assert.equal(h.branch.length, 0);
  h.start("Create the product and write `summary.md`.");
  const starting = await h.call("set", { outcome: "Ship widget and summary", criteria: [artifact, summary] });
  h.fire("tool_result", { toolName: "principal_workflow", toolCallId: "setup", input: { action: "setup" }, isError: false });
  writeFileSync(join(cwd, artifact.path), "working\n");
  h.fire("tool_result", { toolName: "write", toolCallId: "product-write", input: { path: artifact.path }, isError: false });
  const stillOpen = await h.call("finish");
  assert.equal(stillOpen.deliveryId, starting.deliveryId);
  assert.equal(stillOpen.criteria.find(item => item.id === "product").direct[0].toolCallId, "product-write");
  const previousDraft = { type: "custom", customType: "other", data: { preserved: true } };
  const recovery = await h.settle({ ...completed(), entries: [previousDraft] });
  assert.equal(recovery.continue, true);
  assert.deepEqual(recovery.entries[0], previousDraft);
  assert.equal(recovery.entries.at(-1).customType, RECOVERY_MESSAGE);
  assert.equal((await h.fire("tool_call", { toolName: "bash", input: { command: "rerun" } })).block, true);
  assert.equal(await h.fire("tool_call", { toolName: "write", input: { path: "summary.md" } }), undefined);
  assert.equal((await h.fire("tool_call", { toolName: "write", input: { path: "summary.md" } })).block, true);
  writeFileSync(join(cwd, summary.path), "Product works with the stated limitation.\n");
  const final = await h.settle();
  assert.equal(final.entries.at(-1).customType, HANDOFF_MESSAGE);
  assert.equal(final.entries.at(-1).display, true);
  assert.match(final.entries.at(-1).content, /summary\.md \(nonempty file\)/u);
  assert.equal((await h.call("status")).state, "verified");
  assert.equal(await h.settle(), undefined);
});

test("empty, unverified and paused delivery stay visible without automatic work", async t => {
  const { cwd, make } = fixture(t);
  let paused = false;
  const h = make({ selectedTask: "task-a", peer: async () => { if (paused) throw Error("task paused"); } });
  h.start("Write `summary.md`.");
  await h.call("set", { outcome: "Summarize output", criteria: [summary] });
  writeFileSync(join(cwd, summary.path), "");
  const observed = await h.call("status");
  assert.equal(observed.criteria[0].state, "empty");
  rmSync(join(cwd, summary.path));
  paused = true;
  const final = await h.settle(completed(assistant("Complete.")));
  assert.equal(final.continue, undefined);
  assert.match(final.entries.at(-1).content, /summary \(missing\)/u);
  assert.equal((await h.call("status")).state, "partial");
  h.start("Please give me a read-only recap.");
  assert.equal((await h.call("finish")).state, "refused");
  assert.equal(await h.settle(), undefined);
  for (const prompt of ["Read-only recap", "Please only inspect, do not change anything", "Recall the sources", "What was tested?"]) assert.equal(scopeRequest(prompt), "recall");
  assert.equal(scopeRequest("Resume the unfinished handoff; do not rerun the build"), "resume");
  assert.equal(scopeRequest("Cancel the task"), "hold");
});

test("lookup finds a later clear handoff instruction in a long line and respects restrictions", () => {
  const first = "Create the export with headers and rejection diagnostics, including all approved information for the customers in the supplied example and retaining unchanged entries in order.";
  assert.equal(userNamedArtifact(`${first} Save summary.md.`, "summary.md"), true);
  assert.equal(userNamedArtifact(`${first} Save the handoff in \`summary.md\`.`, "summary.md"), true);
  assert.equal(userNamedArtifact(`${first} Keep summary.md missing.`, "summary.md"), false);
  assert.equal(userNamedArtifact(`${first} Save summary.md if I approve.`, "summary.md"), false);
  assert.equal(userNamedArtifact(`${first} Do not write summary.md. Save the other report.`, "summary.md"), false);
});

test("fresh recall is read-only and two current sessions cannot consume one earlier delivery", async t => {
  const { cwd, make } = fixture(t), prior = make();
  prior.start("Write `summary.md` after approval.");
  const { checkpoint } = await prior.call("set", { outcome: "Finish summary", criteria: [summary] });
  prior.fire("session_shutdown", {});
  const first = make(), second = make();
  first.start("Recall before doing any work.");
  assert.equal((await first.call("status", checkpoint)).criteria[0].state, "missing");
  assert.equal((await first.call("resume", checkpoint)).state, "refused");
  assert.equal(first.branch.length, 0);
  first.start("Resume only the missing report.");
  second.start("Resume only the missing report.");
  const results = await Promise.all([first.call("resume", checkpoint), second.call("resume", checkpoint)]);
  assert.equal(results.filter(item => item.deliveryId === checkpoint.deliveryId).length, 1);
  assert.equal(results.filter(item => item.state === "refused").length, 1);
  writeFileSync(join(cwd, summary.path), "Completed with original evidence.\n");
  const third = make();
  third.start("Resume the original delivery if unfinished.");
  assert.equal((await third.call("resume", checkpoint)).state, "verified");
  assert.equal(third.branch.length, 0);
});

test("an observed design recommends an invariant and revisits a changed assumption once", async t => {
  const { make } = fixture(t), h = make();
  h.start("Build shared editing.");
  await h.call("set", { outcome: "Keep newer work", criteria: [artifact] });
  const base = { id: "owner", uncertainty: "Which revision does Save submit?", startingState: "Two editors opened v1", constraint: "Preserve both users' changes" };
  await h.call("design", { decision: { ...base, status: "pending" } });
  assert.match((await h.call("status")).nextAction, /Ask the selected Architect/u);
  const answer = { ...base, status: "inline", toolCallId: "consult-1", invariant: "Save submits the starting revision", counterexample: "Save twice from v1" };
  assert.equal((await h.call("design", { decision: answer })).state, "refused");
  h.fire("tool_result", { toolName: "read", toolCallId: "consult-1", input: { path: architect }, isError: false });
  assert.equal((await h.call("design", { decision: answer })).decisions[0].status, "inline");
  assert.equal((await h.call("design", { decision: { ...answer, status: "consulted" } })).state, "refused");
  const changed = { ...base, startingState: "A writer reopened another editor's saved change", status: "pending", changedBy: "A second active writer was observed" };
  await h.call("design", { decision: changed });
  const after = h.branch.length;
  await h.call("design", { decision: changed });
  assert.equal(h.branch.length, after);
  h.fire("tool_result", { toolName: "read", toolCallId: "consult-2", input: { path: architect }, isError: false });
  const followUp = { ...answer, ...changed, status: "inline", toolCallId: "consult-2", invariant: "Preserve the editor's local document after conflict" };
  assert.equal((await h.call("design", { decision: followUp })).decisions[0].invariant, followUp.invariant);
  assert.equal((await h.call("design", { decision: { ...changed, changedBy: "Again" } })).state, "refused");
  assert.ok(h.branch.some(item => item.customType === DELIVERY_ENTRY && item.data.decisions.some(row => row.invariant === answer.invariant)));
});

test("endpoint evidence preserves other inputs, rejects process exits and checks the normal action plus adverse case", async t => {
  const { cwd } = fixture(t), task = "shared-edit", id = "save";
  // Standalone input-scoped verification makes the user path's exact declared files the authority.
  const git = args => execFileSync("git", ["-C", cwd, ...args], { stdio: "pipe" });
  git(["init"]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@invalid.example", "commit", "--allow-empty", "-m", "baseline"]);
  rmSync(join(cwd, "sessions"), { recursive: true });
  writeFileSync(join(cwd, "journey.mjs"), `import { writeFileSync } from 'node:fs';
const [mode, path] = process.argv.slice(2);
if (mode !== 'process') writeFileSync(path, JSON.stringify({ version: 1, observed: mode === 'missing' ? {} : { save: mode === 'correct' }, counterexamples: { save: false } }));`);
  const journey = { startingState: "Two editors opened v1", action: "Save via the user-facing editor", observation: "Newer data survives and stale edits stay local" };
  const counterexample = { scenario: "The API accepts a stale save", expected: false };
  const [criterion] = normalizeDeliveryCriteria([{ id, kind: "endpoint", requirement: "Preserve newer work", expected: true,
    ...journey, counterexample, scope: "declared-inputs", dependencies: ["journey.mjs"] }]);
  const check = async (mode, step, withCriteria = true) => {
    // The adapter reads its private output destination through the documented environment.
    const args = ["-e", "process.argv.splice(1,0,'journey.mjs'); process.argv.push(process.env.PRINCIPAL_CHECK_OBSERVATIONS); import('./journey.mjs')", mode];
    return runVerification({ repo: cwd, task, step, command: process.execPath, args, ...(withCriteria ? {
      criteria: [{ id, expected: true, journey, counterexample }], scope: "declared-inputs", inputPaths: ["journey.mjs"],
    } : {}) });
  };
  await check("process", "Process", false);
  assert.equal(criterionEvidence(cwd, criterion, { task, step: "Process", attempt: 1 }).state, "unobserved");
  await check("missing", "Missing");
  assert.equal(criterionEvidence(cwd, criterion, { task, step: "Missing", attempt: 1 }).state, "unobserved");
  await check("defect", "Stale save");
  assert.equal(criterionEvidence(cwd, criterion, { task, step: "Stale save", attempt: 1 }).state, "failed");
  await check("correct", "Repaired save");
  const selector = { task, step: "Repaired save", attempt: 1 };
  assert.equal(criterionEvidence(cwd, criterion, selector).state, "supported");
  writeFileSync(join(cwd, "summary.md"), "A separate deliverable.\n");
  assert.equal(criterionEvidence(cwd, criterion, selector).state, "supported");
  writeFileSync(join(cwd, "journey.mjs"), "// changed check");
  assert.equal(criterionEvidence(cwd, criterion, selector).state, "stale");
});

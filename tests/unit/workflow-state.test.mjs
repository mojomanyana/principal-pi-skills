import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { syncBuiltinESMExports } from "node:module";
import fs from "node:fs";
import { CandidateIdentityError, PrepareInputError, observeCandidate, observeSnapshot, prepareOperation, inspectOperation, completeOperation, retryOperation, observeOperationResult, registerCandidateObserver, inspectOwnedOperation, inspectHistoricalOperation, observeHistoricalOperation } from "../../scripts/workflow-state.mjs";
import { runVerification, inspectVerification } from "../../scripts/check-runner.mjs";
import { candidateSnapshot } from "../../scripts/resume-checkpoint.mjs";
import { reference } from "../../scripts/progress-artifacts.mjs";

// These extension factories use JavaScript syntax. Load each local .ts dependency as JavaScript too,
// so the fixture exercises the actual implementation without requiring Node's TypeScript loader.
function extensionFixtureUrl(url, typeboxUrl) {
  const source = readFileSync(url, "utf8")
    // Preserve the registered schema's string constraints; an all-empty stub hid missing rules.
    .replace('import { Type } from "typebox";', typeboxUrl ? `import { Type } from ${JSON.stringify(typeboxUrl)};` : `const Type = {
      Optional: schema => schema,
      Object: (properties, options = {}) => ({ type: "object", properties, ...options }),
      String: (options = {}) => ({ type: "string", ...options }),
      Integer: (options = {}) => ({ type: "integer", ...options }),
      Boolean: () => ({ type: "boolean" }),
      Literal: value => ({ const: value }),
      Union: anyOf => ({ anyOf }),
      Array: (items, options = {}) => ({ type: "array", items, ...options }),
    };`)
    .replace(/from "(\.\.?\/[^"]+)"/gu, (_match, path) => {
      const dependency = new URL(path, url);
      return "from " + JSON.stringify(dependency.pathname.endsWith(".ts") ? extensionFixtureUrl(dependency, typeboxUrl) : dependency.href);
    });
  return "data:text/javascript;base64," + Buffer.from(source).toString("base64");
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "principal-workflow-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q"); writeFileSync(join(root, "product.txt"), "before\n");
  git("add", "."); git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "base");
  mkdirSync(join(root, ".principal")); writeFileSync(join(root, ".principal/.gitignore"), "*\n");
  writeFileSync(join(root, ".principal/plan.md"), "Implement the requested behavior.\n");
  const request = { task: "fixture", step: "implementation", phase: "build", expectedCandidate: observeCandidate(root).id,
    inputs: [reference(join(root, ".principal/plan.md"))] };
  return { root, request };
}

const nameCases = {
  task: {
    valid: ["A", "0", "WorkshopDeskStage1", "workshop-desk-v1-stage1", "stage_1", "a".repeat(80)],
    invalid: [undefined, null, 1, "", " ", "workshop desk", "workshop/desk", "../desk", "-desk", "_desk", "d\u00e9sk", "desk\n", "desk\nmore", "a".repeat(80) + "\n", "a".repeat(81)],
  },
  step: {
    valid: ["build", "implementation:S1", "  build  ", "s".repeat(200)],
    invalid: [undefined, null, 1, "", " \t\n", "s".repeat(201)],
  },
};
function settled(operationId, cwd, text = "Done.\n") {
  const final = { state: "complete", sessionId: "child-session", messageId: "final-message", leafId: "final-leaf", sha256: createHash("sha256").update(text).digest("hex") };
  return { operationId, cwd, executionId: "exec:fixture", state: "settled", finalObservation: { ...final, text }, runtime: {
    work: "succeeded", final, cleanup: { state: "settled", executionId: "exec:fixture" },
  } };
}

function historical(operationId, owner, text = "Preserved native report.\n") {
  const runtime = settled(operationId, owner.cwd, text);
  return { ...runtime, historical: true, artifact: {
    version: 1, producer: "pi-daddy", owner, operationId, executionId: runtime.executionId,
    manifest: { path: join(owner.cwd, "producer-manifest.json"), sha256: "a".repeat(64), bytes: 1024 },
  } };
}

test("historical decoding survives implementation and input changes without accepting them as current", t => {
  const { root, request } = fixture(t), owner = { sessionId: "same-resumed-session", cwd: root };
  const prepared = prepareOperation(root, { ...request, owner });
  const store = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0]);
  const path = join(store, "request.json"), record = JSON.parse(readFileSync(path, "utf8"));
  record.implementation[0].sha256 = "b".repeat(64);
  writeFileSync(path, JSON.stringify(record));
  writeFileSync(join(root, "product.txt"), "later work\n");
  writeFileSync(join(root, ".principal/plan.md"), "changed authority\n");
  const before = readFileSync(path), selected = { operationId: prepared.operation_id };
  const result = observeHistoricalOperation(root, selected, historical(prepared.operation_id, owner), owner);
  assert.equal(result.final.text, "Preserved native report.\n");
  assert.equal(result.state, "historical"); assert.equal(result.resultRetained, true);
  assert.equal(result.implementationMatches, false); assert.equal(result.inputsMatch, false);
  assert.equal(result.candidateMatches, false); assert.equal(result.completionValid, false);
  assert.equal(result.approval, false); assert.equal(result.administrativeWrites, false);
  assert.equal(result.applicability, "not-established");
  assert.deepEqual(readFileSync(path), before);
  assert.deepEqual(readdirSync(store), ["request.json"]);
  assert.throws(() => completeOperation(root, selected, settled(prepared.operation_id, root)), /implementation changed/);
  assert.throws(() => prepareOperation(root, { ...request, owner, expectedCandidate: observeCandidate(root) }), /implementation changed|changed input/);
  record.version = 2; writeFileSync(path, JSON.stringify(record));
  assert.throws(() => inspectHistoricalOperation(root, request, owner), /unsupported workflow record version/);
});

test("historical candidates without additive diagnostics match only their unchanged stable identity", t => {
  const { root, request } = fixture(t), owner = { sessionId: "original", cwd: root };
  const prepared = prepareOperation(root, { ...request, owner });
  const store = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0]);
  const path = join(store, "request.json"), record = JSON.parse(readFileSync(path, "utf8"));
  delete record.input.sourceSha256;
  record.implementation[0].sha256 = "b".repeat(64);
  writeFileSync(path, JSON.stringify(record));
  const retained = readFileSync(path), selected = { operationId: prepared.operation_id };
  const unchanged = inspectHistoricalOperation(root, selected, owner);
  assert.equal(unchanged.candidateMatches, true);
  assert.equal(unchanged.implementationMatches, false);
  assert.equal(unchanged.completionValid, false);
  assert.equal(unchanged.approval, false);
  assert.equal(unchanged.administrativeWrites, false);
  const observed = observeHistoricalOperation(root, selected, historical(prepared.operation_id, owner), owner);
  assert.equal(observed.candidateMatches, true);
  assert.equal(observed.applicability, "not-established");
  assert.equal(observed.approval, false);
  assert.throws(() => completeOperation(root, selected, settled(prepared.operation_id, root)), /implementation changed/);
  writeFileSync(join(root, "product.txt"), "changed after the old observation\n");
  assert.equal(inspectHistoricalOperation(root, selected, owner).candidateMatches, false);
  writeFileSync(join(root, "product.txt"), "before\n");
  assert.equal(inspectHistoricalOperation(root, selected, owner).candidateMatches, true);
  assert.throws(() => inspectHistoricalOperation(root, selected, { ...owner, sessionId: "new" }), /another coordinator/);
  assert.deepEqual(readFileSync(path), retained);
  assert.deepEqual(readdirSync(store), ["request.json"]);
});

test("history requires the original owner and exact result identity, and cannot complete or retry", t => {
  const { root, request } = fixture(t), owner = { sessionId: "original", cwd: root };
  const prepared = prepareOperation(root, { ...request, owner }), selected = { operationId: prepared.operation_id };
  const runtime = historical(prepared.operation_id, owner);
  assert.throws(() => observeHistoricalOperation(root, selected, runtime, { ...owner, sessionId: "foreign" }), /another coordinator/);
  assert.throws(() => observeHistoricalOperation(root, selected, { ...runtime, cwd: "/foreign" }, owner), /identity mismatch/);
  const wrongOwner = structuredClone(runtime); wrongOwner.artifact.owner.sessionId = "foreign";
  assert.throws(() => observeHistoricalOperation(root, selected, wrongOwner, owner), /artifact identity mismatch/);
  const wrongText = structuredClone(runtime); wrongText.finalObservation.text += "forged";
  assert.throws(() => observeHistoricalOperation(root, selected, wrongText, owner), /content or identity mismatch/);
  assert.throws(() => observeHistoricalOperation(root, selected, { ...runtime, artifact: undefined }, owner), /requires its producer artifact/);
  assert.throws(() => completeOperation(root, { ...selected, disposition: "succeeded" }, runtime), /historical observation/);
  assert.throws(() => retryOperation(root, { ...selected, reason: "retry" }, runtime), /historical observation/);
  assert.equal(inspectOperation(root, selected).state, "prepared");
  completeOperation(root, { ...selected, disposition: "succeeded" }, settled(prepared.operation_id, root));
  const store = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0]);
  rmSync(join(store, "completion.json"));
  assert.throws(() => completeOperation(root, selected, runtime), /historical observation/);
  assert.equal(inspectOperation(root, selected).completionValid, false);
  completeOperation(root, selected);
  assert.throws(() => completeOperation(root, selected, runtime), /historical observation/);
});

test("interrupted historical dispatch remains uncertain without inventing settlement or a final", t => {
  const { root, request } = fixture(t), owner = { sessionId: "same", cwd: root };
  const prepared = prepareOperation(root, { ...request, owner });
  const result = observeHistoricalOperation(root, { operationId: prepared.operation_id }, {
    historical: true, operationId: prepared.operation_id, cwd: root, state: "uncertain",
  }, owner);
  assert.equal(result.runtime.state, "uncertain");
  assert.equal(result.resultRetained, false); assert.equal(result.final, undefined);
  assert.equal(result.completionValid, false); assert.equal(result.approval, false);
});

test("malformed preparation names are recoverable before any administrative writes", t => {
  const { root, request } = fixture(t);
  rmSync(join(root, ".principal"), { recursive: true });
  const before = observeCandidate(root);
  for (const [field, { invalid }] of Object.entries(nameCases)) for (const value of invalid) {
    assert.throws(() => prepareOperation(root, { ...request, inputs: [], [field]: value }), error => {
      assert.ok(error instanceof PrepareInputError);
      assert.equal(error.code, "PREPARE_INPUT_INVALID");
      assert.deepEqual(error.diagnostic, { kind: "prepare-input", field });
      assert.equal(error.administrativeWrites, false);
      assert.equal(error.operationAllocated, false);
      assert.equal(error.recovery.action, "prepare");
      assert.match(error.recovery.message, /same authorized work/);
      assert.equal(error.operation_id, undefined);
      return true;
    });
    assert.equal(existsSync(join(root, ".principal")), false);
  }
  assert.deepEqual(observeCandidate(root), before);
});

test("preparation accepts documented task and step name boundaries unchanged", t => {
  const { root, request } = fixture(t);
  for (const [field, { valid }] of Object.entries(nameCases)) for (const value of valid) {
    const prepared = prepareOperation(root, { ...request, [field]: value });
    assert.equal(prepared.state, "prepared");
    assert.equal(prepared[field], value, "identity is never normalized or truncated");
    assert.equal(prepared.attempt, 1);
  }
});

test("legacy task spelling remains readable by task or operation ID without normalization", t => {
  const { root, request } = fixture(t), task = "WorkshopDeskStage1", owner = { sessionId: "original-parent", cwd: root };
  const prepared = prepareOperation(root, { ...request, task, owner });
  const path = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0], "request.json");
  const record = JSON.parse(readFileSync(path, "utf8"));
  record.implementation[0].sha256 = "0".repeat(64);
  writeFileSync(path, JSON.stringify(record));
  const before = readFileSync(path);
  for (const selected of [{ operationId: prepared.operation_id }, { task, step: request.step }]) {
    const history = inspectHistoricalOperation(root, selected, owner);
    assert.equal(history.task, task);
    assert.equal(history.operation_id, prepared.operation_id);
    assert.equal(history.implementationMatches, false);
    assert.equal(history.completionValid, false);
    assert.equal(history.administrativeWrites, false);
  }
  assert.deepEqual(readFileSync(path), before);
});

test("registered workflow schema exposes name rules and correction prepares one original attempt", async t => {
  const { root } = fixture(t);
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  let tool;
  register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {},
    events: { on: () => () => {}, emit: () => { throw Error("Name correction must not dispatch or query native work"); } } });
  for (const [field, cases] of Object.entries(nameCases)) {
    const schema = tool.parameters.properties[field];
    assert.equal(schema.type, "string");
    assert.match(schema.description, /identity/);
    const accepts = value => typeof value === "string" && (schema.minLength === undefined || value.length >= schema.minLength) &&
      (schema.maxLength === undefined || value.length <= schema.maxLength) && new RegExp(schema.pattern).test(value);
    for (const value of cases.valid) assert.equal(accepts(value), true, `${field} schema rejects valid identity`);
    for (const value of cases.invalid) assert.equal(accepts(value), false, `${field} schema accepts malformed identity`);
  }
  let sessionId = "original-parent";
  const ctx = { cwd: root, isProjectTrusted: () => true, sessionManager: { getSessionId: () => sessionId } };
  const call = request => tool.execute("fixture", request, undefined, () => {}, ctx);
  const snapshot = (await call({ action: "snapshot" })).structuredContent;
  rmSync(join(root, ".principal"), { recursive: true });
  const request = { action: "prepare", task: "workshop-desk-v1-stage1", step: "build", phase: "build", expectedCandidate: snapshot.candidate, contextPaths: ["product.txt"] };
  const refused = await call({ ...request, task: "Workshop Desk / Stage 1" });
  assert.equal(refused.isError, true);
  assert.equal(refused.structuredContent.state, "refused");
  assert.equal(refused.structuredContent.code, "PREPARE_INPUT_INVALID");
  assert.equal(refused.structuredContent.administrativeWrites, false);
  assert.equal(refused.structuredContent.operationAllocated, false);
  assert.equal(refused.structuredContent.approval, false);
  assert.equal(refused.structuredContent.operation_id, undefined);
  assert.equal(refused.structuredContent.diagnostic.field, "task");
  assert.equal(refused.structuredContent.recovery.action, "prepare");
  assert.match(refused.structuredContent.recovery.message, /new task with no established internal identity, choose a short valid ID/);
  assert.match(refused.structuredContent.recovery.message, /without asking permission again/);
  assert.match(refused.structuredContent.recovery.message, /never rename an existing operation to evade a refusal/);
  assert.deepEqual(refused.details, refused.structuredContent);
  assert.deepEqual(JSON.parse(refused.content[0].text), refused.structuredContent);
  assert.equal(existsSync(join(root, ".principal")), false);
  const first = (await call(request)).structuredContent, second = (await call(request)).structuredContent;
  assert.equal(first.state, "prepared");
  assert.equal(first.task, "workshop-desk-v1-stage1");
  assert.equal(first.attempt, 1);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.operation_id, first.operation_id);
  assert.equal(second.reportPath, first.reportPath);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  assert.equal(readdirSync(join(root, ".principal/reports")).length, 1);

  const assertNotInputRecovery = async (changed, message) => {
    const result = await call(changed);
    assert.equal(result.isError, true);
    assert.match(result.structuredContent.error, message);
    assert.notEqual(result.structuredContent.code, "PREPARE_INPUT_INVALID");
    assert.equal(result.structuredContent.recovery, undefined);
    assert.equal(result.structuredContent.operationAllocated, undefined);
  };
  await assertNotInputRecovery({ ...request, phase: "review" }, /operation conflict/);
  await assertNotInputRecovery({ ...request, attempt: 2 }, /use retry/);
  sessionId = "different-parent";
  await assertNotInputRecovery(request, /another coordinator session/);
  sessionId = "original-parent";
  writeFileSync(join(root, "product.txt"), "changed candidate\n");
  await assertNotInputRecovery(request, /Candidate identity differs/);
  const changedOutput = await call({ ...request, expectedCandidate: observeCandidate(root) });
  assert.equal(changedOutput.isError, true);
  assert.equal(changedOutput.structuredContent.code, "PREPARED_OUTPUT_CHANGED");
  assert.equal(changedOutput.structuredContent.operationAllocated, undefined, "output recovery does not infer prior admission");
  assert.equal(changedOutput.structuredContent.recovery.action, "retain-existing-result");
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  assert.equal(readdirSync(join(root, ".principal/reports")).length, 1);
});

test("actual Pi argument validation rejects malformed prepare names before execution and permits correction", { skip: !process.env.PRINCIPAL_PI_SDK_ROOT }, async t => {
  const sdk = process.env.PRINCIPAL_PI_SDK_ROOT, require = createRequire(join(sdk, "package.json"));
  t.diagnostic(`Pi ${JSON.parse(readFileSync(join(sdk, "package.json"), "utf8")).version}: actual TypeBox and native argument validator; no model calls`);
  const aiRoot = require.resolve.paths("@earendil-works/pi-ai").map(path => join(path, "@earendil-works/pi-ai"))
    .find(path => existsSync(join(path, "package.json")));
  assert.ok(aiRoot, "selected Pi SDK must supply its native argument validator");
  const { validateToolArguments } = await import(pathToFileURL(join(aiRoot, "dist/utils/validation.js")).href);
  const typeboxUrl = pathToFileURL(require.resolve("typebox")).href;
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url), typeboxUrl));
  const { root } = fixture(t), snapshot = observeSnapshot(root);
  rmSync(join(root, ".principal"), { recursive: true });
  let tool, executions = 0;
  register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {},
    events: { on: () => () => {}, emit: () => { throw Error("Argument validation never dispatches native work"); } } });
  const ctx = { cwd: root, isProjectTrusted: () => true, sessionManager: { getSessionId: () => "original-parent" } };
  const call = async request => {
    const validated = validateToolArguments(tool, { name: tool.name, arguments: request });
    executions++;
    return tool.execute("fixture", validated, undefined, () => {}, ctx);
  };
  const request = { action: "prepare", task: "workshop-desk-v1-stage1", step: "build", phase: "build", expectedCandidate: snapshot.candidate, contextPaths: ["product.txt"] };
  for (const [field, value] of [["task", "Workshop Desk / Stage 1"], ["step", " \t"]]) {
    await assert.rejects(call({ ...request, [field]: value }), error => {
      assert.match(error.message, /Validation failed for tool "principal_workflow"/);
      assert.ok(error.message.includes(field));
      assert.equal(error.operationAllocated, undefined, "a host schema error is not a Principal receipt");
      return true;
    });
  }
  assert.equal(executions, 0);
  assert.equal(existsSync(join(root, ".principal")), false);
  const { task: _task, ...missing } = request;
  const missingResult = (await call(missing)).structuredContent;
  assert.equal(missingResult.code, "PREPARE_INPUT_INVALID");
  assert.equal(missingResult.operationAllocated, false);
  assert.equal(existsSync(join(root, ".principal")), false);
  const first = (await call(request)).structuredContent, again = (await call(request)).structuredContent;
  assert.equal(first.state, "prepared");
  assert.deepEqual(first.contextPaths, [join(root, "product.txt")], "the native host accepts optional editable context");
  assert.equal(first.attempt, 1);
  assert.equal(again.reused, true);
  assert.equal(again.operation_id, first.operation_id);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  assert.equal(readdirSync(join(root, ".principal/reports")).length, 1);
});

test("one handoff and report allocation are reused, with current code and exact inputs checked", t => {
  const { root, request } = fixture(t), first = prepareOperation(root, request), second = prepareOperation(root, request);
  assert.equal(second.operation_id, first.operation_id); assert.equal(second.reportPath, first.reportPath);
  assert.equal(second.reused, true); assert.equal(readdirSync(join(root, ".principal/reports")).length, 1);
  assert.throws(() => prepareOperation(root, { ...request, phase: "review" }), /conflict/);
  writeFileSync(join(root, ".principal/plan.md"), "changed authority");
  assert.throws(() => prepareOperation(root, request), /changed input/);
  assert.equal(readdirSync(join(root, ".principal/reports")).length, 1);
});

test("finished mutation is recognized from output snapshot without replay or approval", t => {
  const { root, request } = fixture(t), first = prepareOperation(root, request);
  writeFileSync(join(root, "product.txt"), "implemented\n"); writeFileSync(first.reportPath, "Implementation complete; review pending.\n");
  const done = completeOperation(root, { ...request, disposition: "succeeded" }, settled(first.operation_id, root, "Implementation complete; review pending.\n"));
  assert.equal(done.state, "complete"); assert.equal(done.approval, false);
  const reused = prepareOperation(root, { ...request, expectedCandidate: observeCandidate(root).id });
  assert.equal(reused.reused, true); assert.equal(reused.state, "complete");
  writeFileSync(join(root, "product.txt"), "subsequent edit\n");
  assert.equal(inspectOperation(root, request).state, "stale");
  assert.throws(() => prepareOperation(root, { ...request, expectedCandidate: observeCandidate(root).id }), /candidate changed/);
});

test("completion needs exact settled native result and unchanged read-only candidate and report", t => {
  const { root, request } = fixture(t), review = { ...request, phase: "review" }, first = prepareOperation(root, review);
  writeFileSync(first.reportPath, "Review Verdict: UNVERIFIED\nNext: evidence\n");
  assert.throws(() => completeOperation(root, { ...review, disposition: "unverified" }, {}), /settlement/);
  assert.throws(() => completeOperation(root, { ...review, disposition: "unverified" }, settled("different", root)), /settlement/);
  const bad = settled(first.operation_id, root); bad.runtime.final.state = "incomplete";
  assert.throws(() => completeOperation(root, { ...review, disposition: "unverified" }, bad), /incomplete/);
  completeOperation(root, { ...review, disposition: "unverified" }, settled(first.operation_id, root, "Review Verdict: UNVERIFIED\nNext: evidence\n"));
  writeFileSync(first.reportPath, "rewritten verdict\n");
  assert.throws(() => inspectOperation(root, review), /report changed/);
});

async function registeredWorkflow(root, { historyBridge = false } = {}) {
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  let tool, native, recovery, sessionId = "original-parent";
  const queries = [];
  register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {}, events: {
    on: () => () => {}, emit(name, query) {
      if (name === "pi-daddy:operation-recovery:v1" && recovery) {
        queries.push(`recover:${query.source.operationId}`);
        query.reply({ version: 1, requestId: query.requestId, sessionId: query.sessionId, cwd: query.cwd,
          source: query.source, qualified: true, observation: recovery });
        return;
      }
      const history = historyBridge && name === "pi-daddy:operation-history:v1";
      if (!history) assert.equal(name, "pi-daddy:operation-status:v1");
      queries.push(history ? `history:${query.operationId}` : query.operationId);
      const operation = history ? historical(query.operationId, { sessionId, cwd: root }) : native;
      query.reply({ version: 1, requestId: query.requestId, sessionId: query.sessionId, cwd: query.cwd,
        operationId: query.operationId, qualified: !history, operation, final: operation?.finalObservation,
        ...(history ? { history, artifact: operation.artifact } : {}) });
    },
  } });
  const ctx = { cwd: root, sessionManager: { getSessionId: () => sessionId } };
  return { tool, queries, ctx, setNative: value => { native = value; }, setRecovery: value => { recovery = value; }, setSession: value => { sessionId = value; },
    run: (args, signal) => tool.execute("fixture", args, signal, () => {}, ctx) };
}

function unstartedReview(prepared, root) {
  const operation = { operationId: prepared.operation_id, cwd: root, executionId: "unstarted-review",
    state: "not-started", runtime: { cleanup: { state: "not-started" } } };
  return { operation, observation: { admission: "present", result: "present", noStartProven: true,
    cleanup: { state: "not-started" }, operation,
    artifact: { version: 1, producer: "pi-daddy", owner: prepared.owner,
      operationId: prepared.operation_id, executionId: operation.executionId,
      manifest: { path: join(root, ".principal/no-start-artifact.json"), sha256: "a".repeat(64), bytes: 123 } } } };
}

test("registered no-start review completion and automatic retry inspect recovery without creating another attempt", async t => {
  for (const action of ["complete", "retry"]) await t.test(action, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request, phase: "review" })).structuredContent;
    const source = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0], "request.json");
    const original = readFileSync(source), noStart = unstartedReview(prepared, root);
    h.setNative({ ...noStart.operation, finalObservation: { state: "unavailable",
      reason: "exact native final was not retained, expired from the 4 MiB session buffer, or belongs to an earlier session" } });
    h.setRecovery(noStart.observation);
    const inspected = await h.run({ action, operationId: prepared.operation_id, disposition: "blocked",
      retryMode: "automatic", reason: "Correct the refused context argument", expectedCandidate: observeCandidate(root) });
    assert.equal(inspected.isError, undefined);
    assert.equal(inspected.structuredContent.state, "ready-to-continue");
    assert.equal(inspected.structuredContent.administrativeWrites, false);
    assert.equal(inspected.structuredContent.approval, false);
    assert.equal(inspected.structuredContent.delegationArguments, undefined);
    assert.equal(inspected.structuredContent.continueArguments.operationId, undefined, "use exact named continuation");
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
    assert.deepEqual(h.queries, [prepared.operation_id, `recover:${prepared.operation_id}`]);
    assert.deepEqual(readFileSync(source), original);
    const continued = (await h.run(inspected.structuredContent.continueArguments)).structuredContent;
    assert.equal(continued.state, "recovered");
    assert.equal(continued.successor.phase, "review");
    assert.equal(continued.successor.attempt, 2);
    assert.equal(continued.successor.automaticRetryBudget.used, 0, "correction inspection spends no execution retry");
    assert.notEqual(continued.successor.operation_id, prepared.operation_id);
    const again = (await h.run(inspected.structuredContent.continueArguments)).structuredContent;
    assert.equal(again.successor.operation_id, continued.successor.operation_id);
    assert.equal(again.reused, true);
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 2);
    assert.deepEqual(readFileSync(source), original);
  });
});

test("no-start status alone cannot grant continuation when the immutable recovery proof is missing or conflicting", async t => {
  const changes = {
    "absent record": proof => { proof.admission = "absent"; proof.result = "absent"; proof.noStartProven = false; },
    "unconfirmed cleanup": proof => { proof.cleanup.state = "unknown"; },
    "foreign artifact": proof => { proof.artifact.owner = { ...proof.artifact.owner, sessionId: "another-parent" }; },
    "conflicting final": proof => { proof.final = { state: "complete", text: "A prior answer exists" }; },
    "executed work": proof => { proof.operation.runtime.work = "failed"; },
  };
  for (const [label, change] of Object.entries(changes)) await t.test(label, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request, phase: "review" })).structuredContent;
    const noStart = unstartedReview(prepared, root);
    h.setNative(structuredClone(noStart.operation)); change(noStart.observation); h.setRecovery(noStart.observation);
    const result = (await h.run({ action: "complete", operationId: prepared.operation_id, disposition: "blocked" })).structuredContent;
    assert.equal(result.state, "uncertain");
    assert.equal(result.continueArguments, undefined); assert.equal(result.delegationArguments, undefined);
    assert.equal(result.administrativeWrites, false); assert.equal(result.approval, false);
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  });
});

test("no-start inspection does not replace authorized manual retries or an existing automatic retry proof", async t => {
  for (const retryMode of [undefined, "manual", "automatic"]) await t.test(retryMode ?? "legacy manual", async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request, phase: "review" })).structuredContent;
    const noStart = unstartedReview(prepared, root);
    if (retryMode === "automatic") noStart.operation.runtime.automaticRetryEligibility = {
      version: 1, eligible: true, operationId: prepared.operation_id,
      executionId: noStart.operation.executionId, definitionId: "c".repeat(64),
    };
    h.setNative(noStart.operation);
    const retry = await h.run({ action: "retry", operationId: prepared.operation_id, retryMode,
      reason: "Previously authorized retry", expectedCandidate: observeCandidate(root) });
    assert.equal(retry.isError, undefined);
    assert.equal(retry.structuredContent.state, "prepared");
    assert.equal(retry.structuredContent.attempt, 2);
    assert.equal(retry.structuredContent.automaticRetryBudget.used, retryMode === "automatic" ? 1 : 0);
    assert.deepEqual(h.queries, [prepared.operation_id], "existing retry policy does not inspect recovery");
  });
});

test("no-start correction keeps changed candidate and required input checks before any successor", async t => {
  for (const changed of ["candidate", "input"]) await t.test(changed, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request, phase: "review" })).structuredContent;
    const noStart = unstartedReview(prepared, root);
    h.setNative(noStart.operation); h.setRecovery(noStart.observation);
    writeFileSync(join(root, changed === "candidate" ? "product.txt" : ".principal/plan.md"), "changed\n");
    const result = (await h.run({ action: "retry", operationId: prepared.operation_id, retryMode: "automatic",
      reason: "argument correction", expectedCandidate: observeCandidate(root) })).structuredContent;
    assert.equal(result.state, "historical");
    assert.equal(result.continueArguments, undefined); assert.equal(result.delegationArguments, undefined);
    assert.equal(result.administrativeWrites, false);
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  });
});

test("settlement and replay-proof errors offer exact read-only inspection without replacing permission or retry rules", async t => {
  for (const action of ["complete", "retry"]) await t.test(action, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request, phase: "review" })).structuredContent;
    h.setNative(action === "complete"
      ? { operationId: prepared.operation_id, cwd: root, executionId: "active-review", state: "running", runtime: { cleanup: { state: "unknown" } } }
      : { operationId: prepared.operation_id, cwd: root, executionId: "failed-review", state: "settled",
        runtime: { work: "failed", cleanup: { state: "settled", executionId: "failed-review" } } });
    const refused = await h.run({ action, task: prepared.task, step: prepared.step, disposition: "blocked",
      retryMode: "automatic", reason: "inspect this operation", expectedCandidate: observeCandidate(root) });
    assert.equal(refused.isError, true);
    assert.deepEqual(refused.structuredContent.recoverArguments, { action: "recover", mode: "inspect", repo: root,
      task: prepared.task, step: prepared.step, attempt: 1 });
    assert.match(refused.structuredContent.nextAction, /read-only/);
    assert.equal(refused.structuredContent.continueArguments, undefined);
    assert.equal(refused.structuredContent.approval, false);
    assert.deepEqual(h.queries, [prepared.operation_id], "a failed action only offers inspection");
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  });
});

test("registered changed Build completion retains the original partial result with or without mistaken reprepare", async t => {
  for (const reprepare of [false, true]) await t.test(reprepare ? "correct repeated preparation" : "normal completion", async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
    const store = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0]);
    const original = readFileSync(join(store, "request.json"));
    mkdirSync(join(root, "src")); writeFileSync(join(root, "src/server.js"), "export const queue = [];\n");
    writeFileSync(join(root, "product.txt"), "API scaffolding added; workshop CRUD unfinished.\n");
    const text = "Partial delivery: API scaffolding added. Workshop CRUD remains unfinished. Reported API checks were not independently verified.\n";
    h.setNative(settled(prepared.operation_id, root, text));
    let completeArgs = { ...prepared.statusArguments, action: "complete" };
    if (reprepare) {
      const refused = await h.run({ action: "prepare", ...request, expectedCandidate: observeCandidate(root) });
      assert.equal(refused.isError, true);
      const correction = refused.structuredContent;
      assert.equal(correction.code, "PREPARED_OUTPUT_CHANGED");
      assert.equal(correction.operation_id, prepared.operation_id);
      assert.equal(correction.phase, "build"); assert.equal(correction.resultRetained, false);
      assert.equal(correction.approval, false); assert.equal(correction.delegationArguments, undefined);
      assert.equal(correction.operationAllocated, undefined, "does not infer whether prior native work started");
      assert.deepEqual(h.queries, [], "reprepare neither observes execution nor dispatches anything");
      assert.deepEqual(readdirSync(store), ["request.json"]);
      assert.deepEqual(readFileSync(join(store, "request.json")), original);
      const recovery = correction.recovery;
      assert.equal(recovery.action, "retain-existing-result");
      assert.deepEqual(recovery.statusArguments, prepared.statusArguments);
      assert.deepEqual(recovery.requiredCompletionFields, ["disposition"]);
      assert.equal(recovery.completionArguments.disposition, undefined, "never supplies success or any guessed outcome");
      const selected = { repo: root, task: request.task, step: request.step, attempt: 1 };
      assert.deepEqual(recovery.statusArguments, { action: "status", ...selected });
      assert.deepEqual(recovery.resultArguments, { action: "result", ...selected });
      assert.deepEqual(recovery.completionArguments, { action: "complete", ...selected });
      const inspected = (await h.run(recovery.resultArguments)).structuredContent;
      assert.equal(inspected.state, "observed"); assert.equal(inspected.final.text, text);
      assert.deepEqual(readdirSync(store), ["request.json"], "result inspection is read-only");
      completeArgs = recovery.completionArguments;
    }
    const complete = (await h.run({ ...completeArgs, disposition: "unverified" })).structuredContent;
    assert.equal(complete.state, "complete"); assert.equal(complete.operation_id, prepared.operation_id);
    assert.equal(complete.resultRetained, true); assert.equal(complete.completionValid, true);
    assert.equal(complete.disposition, "unverified"); assert.equal(complete.approval, false);
    assert.equal(complete.productChanged, true); assert.equal(readFileSync(complete.report.path, "utf8"), text);
    const queryCount = h.queries.length;
    const again = (await h.run({ ...completeArgs, disposition: "unverified" })).structuredContent;
    assert.equal(again.reused, true); assert.equal(h.queries.length, queryCount);
    h.setSession("new-parent");
    const recalled = (await h.run({ action: "recover", operationId: prepared.operation_id })).structuredContent;
    assert.equal(recalled.state, "reused"); assert.equal(recalled.historical, true);
    assert.equal(recalled.disposition, "unverified"); assert.equal(recalled.completionValid, false);
    assert.deepEqual(recalled.report, complete.report); assert.equal(h.queries.length, queryCount);
    assert.equal(readFileSync(join(root, "src/server.js"), "utf8"), "export const queue = [];\n");
    assert.deepEqual(readFileSync(join(store, "request.json")), original);
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
    assert.equal(readdirSync(join(root, ".principal/reports")).length, 1);
  });
});

test("output correction cannot retain active, uncertain, incomplete or misattributed native results", async t => {
  const cases = [
    ["active", native => { native.state = "running"; }],
    ["uncertain cleanup", native => { native.runtime.cleanup.state = "unknown"; }],
    ["missing final", native => { delete native.finalObservation; }],
    ["incomplete final", native => { native.runtime.final.state = "incomplete"; }],
    ["damaged final", native => { native.finalObservation.text = "tampered"; }],
    ["foreign workspace", native => { native.cwd = "/another/workspace"; }],
  ];
  for (const [name, alter] of cases) await t.test(name, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
    writeFileSync(join(root, "product.txt"), "some output\n");
    const correction = (await h.run({ action: "prepare", ...request, expectedCandidate: observeCandidate(root) })).structuredContent;
    assert.equal(correction.code, "PREPARED_OUTPUT_CHANGED");
    const native = settled(prepared.operation_id, root); alter(native); h.setNative(native);
    assert.equal((await h.run(correction.recovery.resultArguments)).isError, true);
    assert.equal((await h.run({ ...correction.recovery.completionArguments, disposition: "unverified" })).isError, true);
    const store = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0]);
    assert.deepEqual(readdirSync(store), ["request.json"]);
    assert.equal(existsSync(prepared.reportPath), false);
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  });
});

test("output correction retains input, ownership, implementation and read-only phase guards", async t => {
  for (const kind of ["inputs", "owner", "implementation", "read-only phase", "retained output"]) await t.test(kind, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    if (kind === "read-only phase") request.phase = "review";
    const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
    if (kind === "retained output") {
      h.setNative(settled(prepared.operation_id, root));
      assert.equal((await h.run({ action: "complete", operationId: prepared.operation_id, disposition: "unverified" })).isError, undefined);
    }
    writeFileSync(join(root, "product.txt"), "changed files\n");
    if (kind === "inputs") writeFileSync(join(root, ".principal/plan.md"), "changed authority\n");
    if (kind === "owner") h.setSession("different-parent");
    if (kind === "implementation") {
      const path = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0], "request.json");
      const record = JSON.parse(readFileSync(path, "utf8")); record.implementation[0].sha256 = "f".repeat(64);
      writeFileSync(path, JSON.stringify(record));
    }
    const refused = await h.run({ action: "prepare", ...request, expectedCandidate: observeCandidate(root) });
    assert.equal(refused.isError, true);
    assert.notEqual(refused.structuredContent.code, "PREPARED_OUTPUT_CHANGED");
    assert.equal(refused.structuredContent.recovery, undefined);
    if (["owner", "implementation"].includes(kind)) assert.equal(refused.structuredContent.recoverArguments.action, "recover");
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  });
});

test("retry requires a settled predecessor, keeps its artifacts, and allocates a distinct attempt", t => {
  const { root, request } = fixture(t), first = prepareOperation(root, request);
  const retry = { ...request, reason: "accepted new review finding" };
  assert.throws(() => retryOperation(root, retry, { operationId: first.operation_id, state: "running" }), /not settled/);
  assert.throws(() => prepareOperation(root, { ...request, attempt: 2 }), /use retry/);
  const next = retryOperation(root, retry, settled(first.operation_id, root));
  assert.equal(next.attempt, 2); assert.notEqual(next.operation_id, first.operation_id);
  assert.notEqual(next.reportPath, first.reportPath); assert.deepEqual(next.inputs, first.inputs);
  assert.equal(inspectOperation(root, request).state, "prepared");
});

test("cross-process race creates one operation and one report directory", async t => {
  const { root, request } = fixture(t);
  const module = new URL("../../scripts/workflow-state.mjs", import.meta.url).href;
  const code = `import {prepareOperation} from ${JSON.stringify(module)}; try {console.log(JSON.stringify(prepareOperation(process.argv[1],JSON.parse(process.argv[2]))));} catch(e) {console.log(JSON.stringify({error:e.message}));}`;
  const run = () => new Promise((accept, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", code, root, JSON.stringify(request)]);
    let out = "", err = ""; child.stdout.on("data", b => out += b); child.stderr.on("data", b => err += b);
    child.on("error", reject); child.on("exit", code => code === 0 ? accept(JSON.parse(out)) : reject(new Error(err)));
  });
  const results = await Promise.all([run(), run(), run()]);
  assert.equal(results.filter(r => r.reused === false).length, 1);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  assert.equal(readdirSync(join(root, ".principal/reports")).length, 1);
  assert.equal(prepareOperation(root, request).reused, true);
});

test("private store symlinks are refused without writing their targets", t => {
  const { root, request } = fixture(t), outside = mkdtempSync(join(tmpdir(), "principal-outside-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, join(root, ".principal/workflow"));
  assert.throws(() => prepareOperation(root, request), /ordinary directory/);
  assert.deepEqual(readdirSync(outside), []);
});


test("a reports-only ignore rule cannot leak private workflow records", t => {
  const { root, request } = fixture(t);
  writeFileSync(join(root, ".principal/.gitignore"), "reports/\n.gitignore\nplan.md\n");
  const current = observeCandidate(root);
  assert.throws(() => prepareOperation(root, { ...request, expectedCandidate: current.id }), /workflow destination must be Git-ignored/);
  assert.ok(!readdirSync(join(root, ".principal")).includes("workflow"));
  assert.equal(readFileSync(join(root, ".principal/.gitignore"), "utf8"), "reports/\n.gitignore\nplan.md\n");
});


test("settled work from a different checkout or with failed control cannot complete a handoff", t => {
  const { root, request } = fixture(t), first = prepareOperation(root, request);
  writeFileSync(first.reportPath, "Done.\n");
  const complete = { ...request, disposition: "succeeded" };
  assert.throws(() => completeOperation(root, complete, settled(first.operation_id, "/wrong/checkout")), /different workspace/);
  assert.throws(() => retryOperation(root, { ...request, reason: "repair" }, settled(first.operation_id, "/wrong/checkout")), /different workspace/);
  const failed = settled(first.operation_id, root); failed.runtime.control = "failed";
  assert.throws(() => completeOperation(root, complete, failed), /incomplete or failed/);
  assert.equal(inspectOperation(root, request).state, "prepared");
});


test("an explicitly retried permission refusal uses native no-child proof and retains the old attempt", t => {
  const { root, request } = fixture(t), first = prepareOperation(root, request);
  const runtime = { operationId: first.operation_id, cwd: "/owner/root", state: "not-started", runtime: { cleanup: { state: "not-started" } } };
  assert.throws(() => retryOperation(root, request, runtime), /retry reason required/);
  const next = retryOperation(root, { ...request, reason: "User granted the dismissed permission" }, runtime);
  assert.equal(next.attempt, 2); assert.notEqual(next.operation_id, first.operation_id);
  assert.equal(inspectOperation(root, request).state, "prepared");
  assert.throws(() => completeOperation(root, { ...request, disposition: "succeeded" }, runtime), /settlement is unavailable/);
});


test("changed ignore policy blocks a new completion record without overwriting policy", t => {
  const { root, request } = fixture(t), first = prepareOperation(root, request);
  writeFileSync(first.reportPath, "Done.\n");
  writeFileSync(join(root, ".principal/.gitignore"), "*\n!workflow/\n!workflow/**\nworkflow/*/request.json\n");
  assert.throws(() => completeOperation(root, { ...request, disposition: "succeeded" }, settled(first.operation_id, root)), /Git-ignored/);
  assert.equal(inspectOperation(root, request).state, "prepared");
});


test("a restarted coordinator cannot silently re-dispatch an old prepared operation", t => {
  const { root, request } = fixture(t);
  const first = prepareOperation(root, { ...request, owner: { sessionId: "original", cwd: root } });
  assert.throws(() => prepareOperation(root, { ...request, owner: { sessionId: "new", cwd: root } }), /another coordinator session/);
  const retained = inspectOperation(root, request);
  assert.equal(retained.operation_id, first.operation_id); assert.equal(retained.owner.sessionId, "original");
  assert.equal(retained.state, "prepared");
});


test("Investigate completion retains the verified final once without child report writes", t => {
  const { root, request } = fixture(t), investigate = { ...request, phase: "investigate" };
  const first = prepareOperation(root, investigate), text = "Investigation: observed behavior\nNo product files changed.\n";
  assert.equal(first.administrativeWrites, true);
  assert.deepEqual(readdirSync(first.handoff.artifactsPath), []);
  assert.equal(first.handoff.directoriesExist, true);
  assert.equal(first.handoff.candidateObserver, "coordinator");
  assert.equal(first.handoff.reportWriter, "coordinator");
  assert.ok(!readdirSync(join(first.reportPath, "..")).includes("investigate.md"));
  const done = completeOperation(root, { ...investigate, disposition: "succeeded" }, settled(first.operation_id, root, text));
  assert.equal(readFileSync(done.report.path, "utf8"), text);
  assert.equal(done.productChanged, false);
  assert.equal(done.administrativeWrites, true);
  assert.equal(done.runtime.finalObservation, undefined, "text is stored once in the report, not copied into metadata");
  assert.equal(done.report.sha256, done.runtime.runtime.final.sha256);
  const again = completeOperation(root, { ...investigate, disposition: "succeeded" }, {});
  assert.equal(again.reused, true);
  assert.equal(again.administrativeWrites, false);
  assert.equal(readFileSync(join(root, "product.txt"), "utf8"), "before\n");
});

test("missing or altered native final refuses before a report is created; an old report is never overwritten", t => {
  const { root, request } = fixture(t), first = prepareOperation(root, request);
  const complete = { ...request, disposition: "succeeded" }, runtime = settled(first.operation_id, root);
  delete runtime.finalObservation;
  assert.throws(() => completeOperation(root, complete, runtime), /exact native final unavailable/);
  runtime.finalObservation = { ...runtime.runtime.final, text: "invented report" };
  assert.throws(() => completeOperation(root, complete, runtime), /content or identity mismatch/);
  assert.ok(!readdirSync(join(first.reportPath, "..")).includes("build.md"));
  writeFileSync(first.reportPath, "Original report preserved.\n");
  const saved = completeOperation(root, complete, settled(first.operation_id, root));
  assert.equal(saved.state, "complete");
  assert.equal(readFileSync(saved.report.path, "utf8"), "Done.\n");
  assert.equal(saved.authoredReport.path, first.reportPath);
  assert.equal(readFileSync(first.reportPath, "utf8"), "Original report preserved.\n");
  assert.equal(inspectOperation(root, request).state, "complete");
});

test("registered completion preserves different authored reports and supports fresh Review without another Build", async t => {
  for (const authored of ["Full report with implementation details.\n", "Done."]) await t.test(JSON.stringify(authored), async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
    writeFileSync(join(root, "product.txt"), "implemented\n"); writeFileSync(prepared.reportPath, authored);
    const runtime = settled(prepared.operation_id, root); h.setNative(runtime);
    const args = { ...prepared.statusArguments, action: "complete", disposition: "succeeded" };
    const complete = (await h.run(args)).structuredContent;
    assert.equal(complete.state, "complete"); assert.equal(complete.completionValid, true); assert.equal(complete.approval, false);
    assert.equal(readFileSync(prepared.reportPath, "utf8"), authored);
    assert.equal(readFileSync(complete.report.path, "utf8"), "Done.\n");
    assert.equal(complete.report.path, join(prepared.reportPath, "..", "build.native-final.md"));
    assert.equal(complete.report.sha256, runtime.runtime.final.sha256);
    assert.deepEqual(complete.authoredReport, reference(prepared.reportPath));
    const again = (await h.run(args)).structuredContent;
    assert.equal(again.reused, true); assert.equal(h.queries.length, 1);
    h.setSession("after-new");
    const recovered = (await h.run({ action: "recover", ...request, attempt: 1 })).structuredContent;
    assert.deepEqual(recovered.report, complete.report); assert.equal(recovered.completionValid, false);
    assert.deepEqual(recovered.authoredReport, complete.authoredReport);
    const review = (await h.run({ action: "prepare", task: request.task, step: "fresh-review", phase: "review",
      expectedCandidate: observeCandidate(root), inputs: [complete.report, complete.authoredReport] })).structuredContent;
    assert.equal(review.state, "prepared"); assert.equal(review.phase, "review");
    assert.deepEqual(review.inputs, [complete.report, complete.authoredReport].sort((a, b) => a.path.localeCompare(b.path)));
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 2, "one Build and one Review, no replacement Build");
  });
});

test("a conflicting final destination, report symlink or changed authored evidence never gets overwritten", t => {
  for (const kind of ["occupied", "symlink", "authored-symlink", "changed-authored", "unignored"]) {
    const { root, request } = fixture(t), first = prepareOperation(root, request), finalPath = join(first.reportPath, "..", "build.native-final.md");
    writeFileSync(first.reportPath, "Authored detail.\n");
    const args = { ...request, disposition: "succeeded" };
    if (kind === "occupied") writeFileSync(finalPath, "Other evidence.\n");
    if (kind === "symlink") symlinkSync(join(root, "product.txt"), finalPath);
    if (kind === "authored-symlink") { rmSync(first.reportPath); symlinkSync(join(root, "product.txt"), first.reportPath); }
    if (kind === "changed-authored") {
      completeOperation(root, args, settled(first.operation_id, root));
      writeFileSync(first.reportPath, "Changed after retention.\n");
    }
    if (kind === "unignored") writeFileSync(join(root, ".principal/.gitignore"), "*\n!reports/\n!reports/**/\n!reports/**/build.native-final.md\n");
    assert.throws(() => completeOperation(root, args, settled(first.operation_id, root)), /identity mismatch|symlink|changed|ignored/);
    assert.equal(readFileSync(join(root, "product.txt"), "utf8"), "before\n");
    if (kind === "occupied") assert.equal(readFileSync(finalPath, "utf8"), "Other evidence.\n");
    if (kind !== "authored-symlink" && kind !== "changed-authored") assert.equal(readFileSync(first.reportPath, "utf8"), "Authored detail.\n");
  }
});

test("a settled read-only result is retained historically without validating a later candidate", t => {
  const { root, request } = fixture(t), review = { ...request, phase: "test-review" };
  const first = prepareOperation(root, review);
  writeFileSync(join(root, "product.txt"), "mutated\n");
  const done = completeOperation(root, { operationId: first.operation_id, disposition: "succeeded" }, settled(first.operation_id, root));
  assert.equal(done.state, "stale"); assert.equal(done.resultRetained, true);
  assert.equal(done.completionValid, false); assert.equal(done.approval, false);
  assert.equal(done.candidateMatches, false);
  assert.match(done.issues.join("; "), /read-only workflow phase changed/);
  assert.equal(readFileSync(first.reportPath, "utf8"), "Done.\n");
  const store = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0]);
  assert.ok(!readdirSync(store).includes("completion.json"));
  const preserved = readFileSync(join(store, "result.json"), "utf8");
  // Restoring bytes cannot erase a recorded failure of the read-only completion gate.
  writeFileSync(join(root, "product.txt"), "before\n");
  const again = completeOperation(root, { operationId: first.operation_id });
  assert.equal(again.state, "stale"); assert.equal(again.completionValid, false);
  assert.equal(again.reused, true); assert.equal(again.administrativeWrites, false);
  assert.equal(readFileSync(join(store, "result.json"), "utf8"), preserved);
});

test("result inspection verifies an exact native final without creating Principal files", t => {
  const { root } = fixture(t);
  rmSync(join(root, ".principal"), { recursive: true });
  const candidate = observeCandidate(root), before = readdirSync(root).sort();
  const request = { operationId: "investigate:no-files", expectedCandidate: candidate.id };
  const runtime = settled(request.operationId, root, "Read-only findings.\n");
  const result = observeOperationResult(root, request, runtime);
  assert.equal(result.state, "observed"); assert.equal(result.storage, "none");
  assert.equal(result.administrativeWrites, false); assert.equal(result.approval, false);
  assert.equal(result.final.text, "Read-only findings.\n");
  assert.deepEqual(readdirSync(root).sort(), before);
  assert.throws(() => observeOperationResult(root, { ...request, operationId: "wrong" }, runtime), /settlement/);
  assert.throws(() => observeOperationResult(root, { ...request, expectedCandidate: "wrong" }, runtime), { code: "CANDIDATE_EXPECTED_INVALID" });
});


test("candidate observation is session-bound, path-independent and read-only", t => {
  const { root } = fixture(t), handlers = new Map(), listeners = new Map();
  const pi = { on: (name, fn) => handlers.set(name, fn), events: { on(name, fn) {
    listeners.set(name, fn); return () => listeners.delete(name);
  } } };
  registerCandidateObserver(pi);
  let sessionId = "actual";
  const ctx = { cwd: root, sessionManager: { getSessionId: () => sessionId } };
  handlers.get("session_start")({}, ctx);
  const observe = (id = "actual", extra = {}) => {
    let response;
    listeners.get("principal:candidate-observe")?.({ requestId: "fresh-nonce", sessionId: id,
      ...extra, reply: value => { assert.equal(response, undefined); response = value; } });
    return response;
  };
  const before = readdirSync(join(root, ".principal")).sort();
  const result = observe("actual", { root: "/foreign", cwd: "/foreign" });
  assert.equal(result.requestId, "fresh-nonce"); assert.equal(result.sessionId, "actual");
  assert.deepEqual(result.candidate, observeCandidate(root));
  assert.deepEqual(readdirSync(join(root, ".principal")).sort(), before);
  assert.equal(observe("foreign").error, "candidate-observation-failed");
  sessionId = "next";
  assert.equal(observe().error, "candidate-observation-failed");
  handlers.get("session_switch")({}, ctx);
  assert.equal(observe("next").candidate.root, root);
  assert.equal(observe("next", { requestId: "" }), undefined);
  handlers.get("session_shutdown")();
  assert.equal(listeners.size, 0);
});


test("completed operation reuse keeps its coordinator owner and verifies allocated directories", t => {
  const { root, request } = fixture(t), owner = { sessionId: "actual", cwd: root };
  const first = prepareOperation(root, { ...request, owner });
  completeOperation(root, { ...request, disposition: "succeeded" }, settled(first.operation_id, root));
  assert.equal(inspectOwnedOperation(root, request, owner).state, "complete");
  assert.throws(() => inspectOwnedOperation(root, request, { ...owner, sessionId: "foreign" }), /another coordinator/);
  assert.throws(() => inspectOwnedOperation(root, request, { ...owner, cwd: "/foreign" }), /another coordinator/);
  assert.equal(inspectOperation(root, request).state, "complete", "read-only status remains inspectable");
  rmSync(first.handoff.artifactsPath, { recursive: true });
  assert.throws(() => prepareOperation(root, { ...request, owner }), /ENOENT/);
});


test("snapshot and prepare hash named input paths and accept a verified canonical candidate handle", t => {
  const { root, request } = fixture(t), before = readdirSync(join(root, ".principal")).sort();
  const snapshot = observeSnapshot(root, { inputPaths: [".principal/plan.md"] });
  assert.deepEqual(snapshot.inputs, request.inputs);
  assert.equal(snapshot.administrativeWrites, false);
  assert.deepEqual(readdirSync(join(root, ".principal")).sort(), before);
  const prepared = prepareOperation(root, { ...request, inputs: undefined,
    inputPaths: [".principal/plan.md"], expectedCandidate: snapshot.candidate });
  assert.deepEqual(prepared.inputs, snapshot.inputs);
  assert.equal(prepareOperation(root, { ...request, expectedCandidate: snapshot.candidate }).reused, true);
  assert.throws(() => observeSnapshot(root, { expectedCandidate: { ...snapshot.candidate, root: "/foreign" } }), { code: "CANDIDATE_WORKSPACE_MISMATCH" });
  writeFileSync(join(root, "product.txt"), "changed\n");
  assert.throws(() => prepareOperation(root, { ...request, expectedCandidate: snapshot.candidate }), { code: "CANDIDATE_IDENTITY_MISMATCH" });
});

test("candidate input refusals distinguish missing, malformed and foreign identity before handoff writes", t => {
  const { root, request } = fixture(t), snapshot = observeSnapshot(root);
  rmSync(join(root, ".principal"), { recursive: true });
  const cases = [
    [undefined, "CANDIDATE_EXPECTED_MISSING", "missing-expected"],
    [null, "CANDIDATE_EXPECTED_INVALID", "malformed-expected"],
    ["private-input-that-must-not-be-echoed", "CANDIDATE_EXPECTED_INVALID", "malformed-expected"],
    [snapshot, "CANDIDATE_EXPECTED_INVALID", "malformed-expected"],
    [{ ...snapshot.candidate, algorithm: "unsupported" }, "CANDIDATE_EXPECTED_INVALID", "malformed-expected"],
    [{ ...snapshot.candidate, root: "/unselected/private-project" }, "CANDIDATE_WORKSPACE_MISMATCH", "workspace-mismatch"],
  ];
  for (const [expectedCandidate, code, reason] of cases) {
    assert.throws(() => prepareOperation(root, { ...request, expectedCandidate }), error => {
      assert.ok(error instanceof CandidateIdentityError);
      assert.equal(error.code, code);
      assert.equal(error.administrativeWrites, false);
      assert.equal(error.diagnostic.reason, reason);
      assert.equal(error.message.includes("private-input"), false);
      assert.equal(error.message.includes("/unselected"), false);
      assert.equal(JSON.stringify(error.diagnostic).includes("/unselected"), false);
      return true;
    });
    assert.equal(existsSync(join(root, ".principal")), false);
  }
  assert.equal(observeSnapshot(root).candidate.id, snapshot.candidate.id, "snapshot needs no expected identity");
});

test("Git review evidence distinguishes a clean sample, untracked deliverables and staged or unstaged paths", t => {
  const { root, request } = fixture(t);
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
  const clean = observeSnapshot(root);
  assert.equal(clean.workingTree.state, "clean");
  assert.equal(clean.candidate.id, clean.candidate.head);
  assert.equal(clean.workingTree.untracked.count, 0);

  writeFileSync(join(root, "new product.txt"), "new delivery\n");
  assert.equal(git("diff", "HEAD", "--"), "");
  const untracked = observeSnapshot(root);
  assert.equal(untracked.workingTree.state, "changed");
  assert.equal(untracked.workingTree.staged.count, 0);
  assert.equal(untracked.workingTree.unstaged.count, 0);
  assert.deepEqual(untracked.workingTree.untracked, { count: 1, paths: ["new product.txt"] });
  const review = prepareOperation(root, { ...request, phase: "review", expectedCandidate: untracked.candidate });
  assert.deepEqual(review.handoff.inputWorkingTree, untracked.workingTree);

  writeFileSync(join(root, "product.txt"), "index\n");
  git("add", "product.txt");
  writeFileSync(join(root, "product.txt"), "worktree\n");
  const mixed = observeSnapshot(root);
  assert.deepEqual(mixed.workingTree.staged, { count: 1, paths: ["product.txt"] });
  assert.deepEqual(mixed.workingTree.unstaged, { count: 1, paths: ["product.txt"] });
  assert.deepEqual(mixed.workingTree.untracked, untracked.workingTree.untracked);
  const status = inspectOperation(root, { ...request, phase: "review" });
  assert.equal(status.candidateMatches, false);
  assert.deepEqual(status.handoff.inputWorkingTree, untracked.workingTree, "the handoff describes the original Review input");

  // The legacy resume digest hashes exactly these fields in this order. Presentation metadata must stay outside it.
  const full = candidateSnapshot(root);
  const legacy = Object.fromEntries(["root", "commonDir", "gitDir", "worktreeIdentity", "head", "branch", "indexSha256",
    "stagedSha256", "unstagedSha256", "tracked", "untracked", "changedPaths"].map(key => [key, full[key]]));
  assert.equal(mixed.candidate.id, "dirty:" + createHash("sha256").update(JSON.stringify(legacy)).digest("hex"));
  assert.deepEqual(full, { ...legacy, id: mixed.candidate.id });
});

test("Git review evidence bounds path samples and retains the full count", t => {
  const { root } = fixture(t);
  for (let i = 0; i < 24; i++) writeFileSync(join(root, `item-${i}.txt`), "");
  const { workingTree, candidate } = observeSnapshot(root);
  assert.equal(candidate.changedPathCount, 24);
  assert.equal(workingTree.untracked.count, 24);
  assert.ok(workingTree.untracked.paths.length > 0 && workingTree.untracked.paths.length < 24);
  assert.ok(workingTree.untracked.paths.every(path => candidate.changedPaths.includes(path)));
});

test("Git review evidence keeps normalized raw edits distinct from an unstaged Git diff", t => {
  const { root } = fixture(t);
  execFileSync("git", ["-C", root, "config", "core.autocrlf", "true"]);
  writeFileSync(join(root, "product.txt"), "before\r\n");
  const { workingTree } = observeSnapshot(root);
  assert.equal(workingTree.state, "changed");
  assert.equal(workingTree.unstaged.count, 0);
  assert.deepEqual(workingTree.rawDifferencesOutsideUnstagedDiff, { count: 1, paths: ["product.txt"] });
});

test("candidate diagnostics separate source, index and HEAD comparisons without changing identity", async t => {
  const scenarios = [
    { name: "tracked content", mutate: root => writeFileSync(join(root, "product.txt"), "after\n"), comparison: { head: "same", index: "same", source: "different" } },
    { name: "untracked content", setup: root => writeFileSync(join(root, "new.txt"), "before\n"),
      mutate: root => writeFileSync(join(root, "new.txt"), "after\n"), comparison: { head: "same", index: "same", source: "different" } },
    { name: "source mode", mutate: root => chmodSync(join(root, "product.txt"), 0o755), comparison: { head: "same", index: "same", source: "different" } },
    { name: "stage unchanged untracked file", setup: root => writeFileSync(join(root, "new.txt"), "same\n"),
      mutate: (root, git) => git("add", "new.txt"), comparison: { head: "same", index: "different", source: "same" } },
    { name: "stage existing deletion", setup: root => rmSync(join(root, "product.txt")),
      mutate: (root, git) => git("add", "-u"), comparison: { head: "same", index: "different", source: "same" } },
    { name: "HEAD only", mutate: (root, git) => git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "metadata only"),
      comparison: { head: "different", index: "same", source: "same" } },
  ];
  for (const scenario of scenarios) await t.test(scenario.name, child => {
    const { root, request } = fixture(child);
    const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
    scenario.setup?.(root);
    const before = observeSnapshot(root).candidate;
    assert.equal(before.id, candidateSnapshot(root).id, "diagnostic digest does not change the candidate algorithm");
    scenario.mutate(root, git);
    const after = observeSnapshot(root).candidate;
    assert.equal(after.id, candidateSnapshot(root).id);
    assert.notEqual(after.id, before.id);
    assert.throws(() => prepareOperation(root, { ...request, expectedCandidate: before }), error => {
      assert.equal(error.code, "CANDIDATE_IDENTITY_MISMATCH");
      assert.equal(error.diagnostic.comparisonBasis, "supplied-candidate");
      assert.deepEqual(error.diagnostic.comparison, scenario.comparison);
      assert.equal(error.administrativeWrites, false);
      return true;
    });
    assert.equal(existsSync(join(root, ".principal/workflow")), false);
    assert.throws(() => observeSnapshot(root, { expectedCandidate: before.id }), error => {
      assert.equal(error.code, "CANDIDATE_IDENTITY_MISMATCH");
      assert.deepEqual(error.diagnostic.comparison, { head: "unknown", index: "unknown", source: "unknown" });
      return true;
    });
    const legacy = { ...before }; delete legacy.sourceSha256;
    assert.throws(() => observeSnapshot(root, { expectedCandidate: legacy }), error => {
      assert.deepEqual(error.diagnostic.comparison, { ...scenario.comparison, source: "unknown" });
      return true;
    });
  });
});

test("empty baseline and ignored runtime writes preserve a dirty candidate through prepare and reuse", t => {
  const root = mkdtempSync(join(tmpdir(), "principal-empty-workflow-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "setup only");
  writeFileSync(join(root, ".git/info/exclude"), "/.pi/\n/.principal/\n");
  mkdirSync(join(root, "minute-card-14"));
  for (const name of ["index.html", "app.js", "style.css"]) writeFileSync(join(root, "minute-card-14", name), name + "\n");
  const snapshot = observeSnapshot(root), request = { task: "minute-card-14", step: "build", phase: "build", expectedCandidate: snapshot.candidate };
  assert.match(snapshot.candidate.id, /^dirty:/);
  assert.notEqual(snapshot.candidate.id, snapshot.candidate.head);
  assert.throws(() => prepareOperation(root, { ...request, expectedCandidate: snapshot.candidate.head }), error => {
    assert.equal(error.code, "CANDIDATE_IDENTITY_MISMATCH");
    assert.equal(error.diagnostic.hint, "head-does-not-identify-dirty-candidate");
    assert.deepEqual(error.diagnostic.comparison, { head: "unknown", index: "unknown", source: "unknown" });
    return true;
  });
  assert.equal(existsSync(join(root, ".principal")), false);
  for (const directory of [".pi", ".principal"]) {
    mkdirSync(join(root, directory));
    writeFileSync(join(root, directory, "runtime.json"), '{"observed":true}\n');
  }
  assert.deepEqual(observeSnapshot(root).candidate, snapshot.candidate);
  const first = prepareOperation(root, request);
  assert.equal(first.state, "prepared");
  assert.equal(first.approval, false);
  assert.equal(prepareOperation(root, { ...request, expectedCandidate: snapshot.candidate.id }).reused, true);
  assert.deepEqual(observeSnapshot(root).candidate, snapshot.candidate);
  assert.equal(git("ls-files").toString(), "", "no product is staged by observation or handoff allocation");
});

test("actual workflow tool exposes bounded candidate diagnostics without dispatch or writes", async t => {
  const { root } = fixture(t);
  writeFileSync(join(root, "untracked.txt"), "uncommitted\n");
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  let tool;
  const commands = new Map();
  const pi = { registerTool: value => { tool = value; }, registerCommand: (name, value) => commands.set(name, value),
    on: () => {}, events: { on: () => () => {}, emit: () => { throw Error("No runtime dispatch belongs in candidate rejection"); } } };
  register(pi);
  assert.ok(commands.has("principal-setup"));
  const ctx = { cwd: root, isProjectTrusted: () => true, sessionManager: { getSessionId: () => "same-parent" } };
  const call = request => tool.execute("fixture", request, undefined, () => {}, ctx);
  const snapshot = (await call({ action: "snapshot" })).structuredContent;
  const before = readdirSync(join(root, ".principal")).sort();
  const result = await call({ action: "prepare", task: "fixture", step: "build", phase: "build", expectedCandidate: snapshot.candidate.head });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.state, "refused");
  assert.equal(result.structuredContent.approval, false);
  assert.equal(result.structuredContent.administrativeWrites, false);
  assert.equal(result.structuredContent.code, "CANDIDATE_IDENTITY_MISMATCH");
  assert.deepEqual(result.details, result.structuredContent);
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  assert.deepEqual(readdirSync(join(root, ".principal")).sort(), before);
  assert.equal(existsSync(join(root, ".principal/workflow")), false);
});

test("actual snapshot and prepare explain missing baselines without initializing a project", async t => {
  const root = mkdtempSync(join(tmpdir(), "principal-workflow-readiness-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  let tool;
  register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {},
    events: { on: () => () => {}, emit: () => { throw Error("Readiness must not dispatch"); } } });
  const ctx = { cwd: root, isProjectTrusted: () => true, sessionManager: { getSessionId: () => "current-parent" },
    hasUI: true, ui: { confirm: () => { throw Error("Observation must not ask for or perform setup"); } } };
  const call = (action, extra = {}) => tool.execute("fixture", { action, task: "fixture", step: "build", phase: "build", ...extra }, undefined, () => {}, ctx);
  const preflight = await call("preflight");
  assert.equal(preflight.isError, undefined, "explicit preflight is informative");
  assert.equal(preflight.structuredContent.state, "setup-required");
  for (const action of ["snapshot", "prepare"]) {
    const result = await call(action);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.reasonCode, "GIT_REPOSITORY_MISSING");
    assert.equal(result.structuredContent.administrativeWrites, false);
    assert.equal(result.structuredContent.approval, false);
    assert.equal(result.structuredContent.setup.eligible, true);
    assert.deepEqual(readdirSync(root), []);
  }
  execFileSync("git", ["-C", root, "init", "-q"], { stdio: "pipe" });
  for (const action of ["snapshot", "prepare"]) {
    const result = await call(action);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.state, "setup-required");
    assert.equal(result.structuredContent.reasonCode, "COMMITTED_BASELINE_MISSING");
    assert.equal(result.structuredContent.administrativeWrites, false);
    assert.deepEqual(readdirSync(root), [".git"]);
  }
  assert.throws(() => execFileSync("git", ["-C", root, "rev-parse", "--verify", "HEAD"], { stdio: "pipe" }));
  execFileSync("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "explicit fixture baseline"], { stdio: "pipe" });
  const nested = join(root, "subdirectory"); mkdirSync(nested); ctx.cwd = nested;
  const snapshot = await call("snapshot");
  assert.equal(snapshot.isError, undefined, "committed parent worktree observation remains supported");
  assert.equal(snapshot.structuredContent.candidate.root, root);
  assert.equal(existsSync(join(root, ".principal")), false);
  const prepared = await call("prepare", { expectedCandidate: snapshot.structuredContent.candidate });
  assert.equal(prepared.isError, true);
  assert.equal(prepared.structuredContent.code, "NATIVE_WORKSPACE_MISMATCH");
  assert.deepEqual(prepared.structuredContent.diagnostic, { kind: "native-workspace", selectedFolder: nested, repositoryRoot: root });
  assert.equal(prepared.structuredContent.operationAllocated, false);
  assert.equal(prepared.structuredContent.administrativeWrites, false);
  assert.equal(existsSync(join(root, ".principal")), false);
  assert.equal(existsSync(join(nested, ".git")), false);
});

test("native preparation rejects parent and foreign session folders before allocation while observations stay read-only", async t => {
  const { root, request } = fixture(t), other = fixture(t).root;
  for (const selectedFolder of [dirname(root), other]) {
    const h = await registeredWorkflow(selectedFolder);
    const before = readdirSync(join(root, ".principal")).sort();
    const snapshot = await h.run({ action: "snapshot", repo: root });
    assert.equal(snapshot.isError, undefined);
    assert.equal(snapshot.structuredContent.candidate.root, root);
    const observed = await h.run({ action: "reference", path: join(root, "product.txt") });
    assert.equal(observed.isError, undefined);
    assert.deepEqual(observed.structuredContent.reference, reference(join(root, "product.txt")));
    const rejected = await h.run({ action: "prepare", repo: root, ...request, expectedCandidate: snapshot.structuredContent.candidate });
    assert.equal(rejected.isError, true);
    const result = rejected.structuredContent;
    assert.equal(result.code, "NATIVE_WORKSPACE_MISMATCH");
    assert.deepEqual(result.diagnostic, { kind: "native-workspace", selectedFolder, repositoryRoot: root });
    assert.equal(result.operationAllocated, false); assert.equal(result.administrativeWrites, false);
    assert.equal(result.approval, false); assert.equal(result.delegationArguments, undefined);
    assert.match(result.recovery.message, /bookkeeping, not the native child's working folder/);
    assert.match(result.recovery.message, /changing folders cannot repair/);
    assert.deepEqual(h.queries, []);
    assert.deepEqual(readdirSync(join(root, ".principal")).sort(), before);
    assert.equal(existsSync(join(root, ".principal/workflow")), false);
    assert.equal(existsSync(join(root, ".principal/reports")), false);
    assert.equal(existsSync(join(other, ".principal/workflow")), false);
  }
});

test("canonical same-workspace preparation reuses the operation and retains a changed Build result", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  mkdirSync(join(root, "nested"));
  h.ctx.cwd = root + "/nested/..";
  const args = { action: "prepare", repo: root + "/.", ...request, expectedCandidate: observeCandidate(root) };
  const first = await h.run(args), repeated = await h.run(args);
  assert.equal(first.isError, undefined); assert.equal(repeated.isError, undefined);
  assert.equal(first.structuredContent.owner.cwd, root);
  assert.equal(repeated.structuredContent.operation_id, first.structuredContent.operation_id);
  assert.equal(repeated.structuredContent.reused, true);
  writeFileSync(join(root, "product.txt"), "implemented\n");
  const prepared = first.structuredContent;
  h.setNative(settled(prepared.operation_id, root, "Implemented in the selected repository.\n"));
  const completed = await h.run({ action: "complete", repo: root, task: request.task, step: request.step, disposition: "succeeded" });
  assert.equal(completed.isError, undefined); assert.equal(completed.structuredContent.completionValid, true);
  assert.equal(readFileSync(completed.structuredContent.report.path, "utf8"), "Implemented in the selected repository.\n");
  assert.deepEqual(h.queries, [prepared.operation_id]);
});

test("older mismatched records remain inspectable and cannot allocate retry or recovery successors", async t => {
  const { root, request } = fixture(t), selectedFolder = dirname(root), h = await registeredWorkflow(selectedFolder);
  // The lower-level record writer models an already existing pre-guard record, not a new session API handoff.
  const prepared = prepareOperation(root, { ...request, owner: { sessionId: "original-parent", cwd: selectedFolder } });
  const store = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0]);
  const original = readFileSync(join(store, "request.json"));
  const observed = await h.run({ action: "status", repo: root, operationId: prepared.operation_id });
  assert.equal(observed.isError, undefined); assert.equal(observed.structuredContent.owner.cwd, selectedFolder);
  const neverStarted = { operationId: prepared.operation_id, cwd: selectedFolder, state: "not-started", runtime: { cleanup: { state: "not-started" } } };
  h.setNative(neverStarted);
  const retry = { repo: root, operationId: prepared.operation_id, reason: "authorized retry", retryMode: "manual", expectedCandidate: observeCandidate(root) };
  const rejected = await h.run({ action: "retry", ...retry });
  assert.equal(rejected.structuredContent.code, "NATIVE_WORKSPACE_MISMATCH");
  assert.equal(rejected.structuredContent.operationAllocated, false);
  assert.equal(rejected.structuredContent.administrativeWrites, false);
  assert.throws(() => retryOperation(root, retry, neverStarted), error => error.code === "NATIVE_WORKSPACE_MISMATCH" && error.operationAllocated === false);
  const parentRecovery = await h.run({ action: "recover", repo: root, operationId: prepared.operation_id });
  assert.equal(parentRecovery.structuredContent.code, "NATIVE_WORKSPACE_MISMATCH");
  h.ctx.cwd = root; h.setSession("after-new");
  for (const mode of ["inspect", "continue", "retain"]) {
    const recovered = await h.run({ action: "recover", repo: root, operationId: prepared.operation_id, mode });
    assert.equal(recovered.structuredContent.state, "uncertain");
    assert.equal(recovered.structuredContent.code, "NATIVE_WORKSPACE_MISMATCH");
    assert.deepEqual(recovered.structuredContent.diagnostic, { kind: "native-workspace", selectedFolder: root, repositoryRoot: root, originalOwnerFolder: selectedFolder });
    assert.equal(recovered.structuredContent.administrativeWrites, false);
    assert.equal(recovered.structuredContent.delegationArguments, undefined);
    assert.equal(recovered.structuredContent.continueArguments, undefined);
    assert.equal(recovered.structuredContent.retainArguments, undefined);
    assert.match(recovered.structuredContent.nextAction, /historical evidence/);
  }
  assert.deepEqual(h.queries, [], "the old execution is neither queried for a retry nor dispatched");
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  assert.deepEqual(readdirSync(store), ["request.json"]);
  assert.deepEqual(readFileSync(join(store, "request.json")), original);
});

test("operationId resolves exact completion and retry identity without bypassing coordinator ownership", t => {
  const { root, request } = fixture(t), owner = { sessionId: "original", cwd: root };
  const prepared = prepareOperation(root, { ...request, owner });
  const selected = { operationId: prepared.operation_id };
  assert.equal(inspectOwnedOperation(root, selected, owner).task, request.task);
  assert.throws(() => inspectOwnedOperation(root, selected, { ...owner, sessionId: "foreign" }), /another coordinator/);
  assert.throws(() => inspectOwnedOperation(root, selected, { ...owner, cwd: "/foreign" }), /another coordinator/);
  assert.throws(() => inspectOperation(root, { ...selected, task: "other" }), /conflicts/);
  assert.throws(() => inspectOperation(root, { ...selected, attempt: 2 }), /conflicts/);
  const complete = completeOperation(root, { ...selected, disposition: "succeeded" }, settled(prepared.operation_id, root));
  assert.equal(complete.state, "complete"); assert.equal(complete.completionValid, true);
  assert.equal(complete.approval, false);
  assert.equal(completeOperation(root, selected).reused, true);
  const next = retryOperation(root, { ...selected, reason: "new accepted finding", expectedCandidate: observeCandidate(root) }, settled(prepared.operation_id, root));
  assert.equal(next.task, prepared.task); assert.equal(next.step, prepared.step); assert.equal(next.attempt, 2);
  assert.deepEqual(next.owner, owner);
  assert.notEqual(next.operation_id, prepared.operation_id);
  const other = fixture(t);
  prepareOperation(other.root, other.request);
  assert.throws(() => inspectOperation(other.root, selected), /missing or ambiguous/);
});

// Selection by name: the store carries the operation ID, the caller names what it prepared.
const claimDirectory = (root, name, attempt) => join(root, ".principal/workflow",
  createHash("sha256").update(JSON.stringify({ attempt, step: name.step, task: name.task })).digest("hex"));
const laterActions = root => [["status", {}], ["complete", { disposition: "succeeded" }],
  ["retry", { reason: "accepted finding", expectedCandidate: observeCandidate(root) }], ["history", {}], ["result", {}]];
const recoverGuidance = "Inspect this original operation with recover. Resuming that original execution requires producer proof it never started. Preserve completed output and reconcile remaining authorized scope; this refusal authorizes no replacement or replay.";
// The stub Type keeps every constraint this suite relies on; unknown shapes are rejected, never assumed valid.
function schemaAccepts(schema, value) {
  if (schema.anyOf) return schema.anyOf.some(option => schemaAccepts(option, value));
  if ("const" in schema) return value === schema.const;
  if (schema.type === "string") return typeof value === "string" && (schema.minLength === undefined || value.length >= schema.minLength) &&
    (schema.maxLength === undefined || value.length <= schema.maxLength) && (schema.pattern === undefined || new RegExp(schema.pattern).test(value));
  if (schema.type === "integer") return Number.isSafeInteger(value) && (schema.minimum === undefined || value >= schema.minimum);
  if (schema.type === "boolean") return typeof value === "boolean";
  if (schema.type === "array") return Array.isArray(value) && (schema.maxItems === undefined || value.length <= schema.maxItems) && value.every(item => schemaAccepts(schema.items, item));
  if (schema.type === "object") return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.entries(value).every(([key, item]) => key in schema.properties ? schemaAccepts(schema.properties[key], item) : schema.additionalProperties !== false);
  return false;
}

test("task and step select the prepared operation for every later action without an operation ID", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root, { historyBridge: true });
  const name = { task: request.task, step: request.step };
  const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
  assert.deepEqual(prepared.statusArguments, { action: "status", repo: root, ...name, attempt: 1 });
  assert.deepEqual(prepared.delegationArguments, { agent: "build", operation_id: prepared.operation_id });
  const status = (await h.run({ action: "status", ...name })).structuredContent;
  assert.equal(status.state, "prepared"); assert.equal(status.operation_id, prepared.operation_id); assert.equal(status.attempt, 1);
  assert.deepEqual(status, (await h.run(prepared.statusArguments)).structuredContent, "returned arguments pass straight back");
  assert.deepEqual(status, (await h.run({ action: "status", operationId: prepared.operation_id })).structuredContent, "the ID path selects the same record");
  assert.deepEqual(h.queries, [], "status never asks the runtime");

  const text = "Named native final.\n";
  h.setNative(settled(prepared.operation_id, root, text));
  const observed = (await h.run({ action: "result", ...name })).structuredContent;
  assert.equal(observed.state, "observed"); assert.equal(observed.storage, "none");
  assert.equal(observed.runtime.operationId, prepared.operation_id); assert.equal(observed.final.text, text);
  assert.deepEqual(observed, (await h.run({ action: "result", operationId: prepared.operation_id })).structuredContent);
  const history = (await h.run({ action: "history", ...name })).structuredContent;
  assert.equal(history.state, "historical"); assert.equal(history.operation_id, prepared.operation_id); assert.equal(history.attempt, 1);
  assert.deepEqual(history, (await h.run({ action: "history", operationId: prepared.operation_id })).structuredContent);
  const store = join(root, ".principal/workflow");
  assert.deepEqual(readdirSync(join(store, readdirSync(store)[0])), ["request.json"], "status, result and history are read-only");

  const complete = (await h.run({ action: "complete", ...name, disposition: "succeeded" })).structuredContent;
  assert.equal(complete.state, "complete"); assert.equal(complete.completionValid, true);
  assert.equal(complete.operation_id, prepared.operation_id); assert.equal(complete.approval, false);
  assert.deepEqual(complete.statusArguments, prepared.statusArguments);
  assert.equal(readFileSync(complete.report.path, "utf8"), text);

  const retried = (await h.run({ action: "retry", ...name, reason: "accepted review finding", expectedCandidate: observeCandidate(root) })).structuredContent;
  assert.equal(retried.state, "prepared"); assert.equal(retried.attempt, 2); assert.equal(retried.reused, false);
  assert.notEqual(retried.operation_id, prepared.operation_id);
  assert.deepEqual(retried.statusArguments, { action: "status", repo: root, ...name, attempt: 2 });
  assert.deepEqual(retried.delegationArguments, { agent: "build", operation_id: retried.operation_id });

  const latest = (await h.run({ action: "status", ...name })).structuredContent;
  assert.equal(latest.attempt, 2, "an omitted attempt means the latest one"); assert.equal(latest.operation_id, retried.operation_id);
  const first = (await h.run({ action: "status", ...name, attempt: 1 })).structuredContent;
  assert.equal(first.operation_id, prepared.operation_id); assert.equal(first.state, "complete");
  h.setNative(settled(retried.operation_id, root, "Second native final.\n"));
  const second = (await h.run({ action: "complete", ...name, disposition: "unverified" })).structuredContent;
  assert.equal(second.attempt, 2); assert.equal(second.operation_id, retried.operation_id);
  assert.equal(second.state, "complete"); assert.equal(second.disposition, "unverified");
  assert.equal(readFileSync(second.report.path, "utf8"), "Second native final.\n");
  assert.deepEqual((await h.run({ action: "status", ...name, attempt: 1 })).structuredContent, first, "the earlier attempt is untouched");
  assert.deepEqual(h.queries, [prepared.operation_id, prepared.operation_id, `history:${prepared.operation_id}`, `history:${prepared.operation_id}`,
    prepared.operation_id, prepared.operation_id, retried.operation_id], "every runtime query used the stored ID of the named operation");
  assert.equal(readdirSync(store).length, 2);
});

test("a replayable native failure can be retried by task and step: settled-failed and never-started both qualify", async t => {
  // Owner decision 2026-11-17, "Principal retries once": pi-daddy does not retry under an operation; it marks a
  // failure it would otherwise have retried "replayable":true. That failure's operation is either settled with a
  // failed result or proven never started. complete refuses both; the retry action the coordinator rule names must
  // accept both, keep the failed attempt, and return arguments for the new delegation.
  for (const shape of ["settled", "not-started"]) await t.test(shape, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const name = { task: request.task, step: request.step };
    const prepared = (await h.run({ action: "prepare", ...request, phase: "investigate" })).structuredContent;
    h.setNative(shape === "settled"
      ? { operationId: prepared.operation_id, cwd: root, executionId: "exec:fixture", state: "settled",
        finalObservation: { state: "unavailable", reason: "no complete native final" },
        runtime: { work: "failed", final: { state: "unavailable" }, cleanup: { state: "settled", executionId: "exec:fixture" } } }
      : { operationId: prepared.operation_id, cwd: root, executionId: "exec:fixture", state: "not-started",
        runtime: { work: "failed", cleanup: { state: "not-started" } } });
    assert.equal((await h.run({ action: "complete", ...name, disposition: "blocked" })).isError, true);
    const retried = (await h.run({ action: "retry", ...name, reason: "replayable failure", expectedCandidate: observeCandidate(root) })).structuredContent;
    assert.equal(retried.state, "prepared"); assert.equal(retried.attempt, 2); assert.equal(retried.reused, false);
    assert.deepEqual(retried.delegationArguments, { agent: "investigate", operation_id: retried.operation_id });
    assert.notEqual(retried.operation_id, prepared.operation_id);
    const first = (await h.run({ action: "status", ...name, attempt: 1 })).structuredContent;
    assert.equal(first.operation_id, prepared.operation_id); assert.equal(first.state, "prepared", "the failed attempt is kept");
  });
});

function replayableNative(operationId, cwd) {
  return { operationId, cwd, executionId: `execution:${operationId}`, state: "settled", runtime: {
    work: "failed", final: { state: "unavailable" }, cleanup: { state: "settled", executionId: `execution:${operationId}` },
    automaticRetryEligibility: { version: 1, eligible: true, operationId, executionId: `execution:${operationId}`, definitionId: "c".repeat(64) },
  } };
}

test("automatic retry consumes one durable allowance, binds the original definition and survives new-session inspection", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  const names = { task: request.task, step: request.step };
  const first = (await h.run({ action: "prepare", ...request, phase: "investigate" })).structuredContent;
  h.setNative(replayableNative(first.operation_id, root));
  const retry = { action: "retry", ...names, attempt: 1, retryMode: "automatic", reason: "Unanswered read-only child", expectedCandidate: observeCandidate(root) };
  const second = (await h.run(retry)).structuredContent;
  assert.equal(second.attempt, 2); assert.equal(second.automaticRetryBudget.used, 1);
  assert.deepEqual(second.delegationArguments, { agent: "investigate", operation_id: second.operation_id, definitionId: "c".repeat(64) });
  const repeated = (await h.run(retry)).structuredContent;
  assert.equal(repeated.operation_id, second.operation_id); assert.equal(repeated.reused, true);
  h.setNative(replayableNative(second.operation_id, root));
  const refused = await h.run({ ...retry, attempt: 2, retryMode: undefined });
  assert.equal(refused.isError, true); assert.match(refused.structuredContent.error, /allowance is exhausted/);
  const store = join(root, ".principal/workflow"), before = readdirSync(store).sort();
  assert.equal(before.length, 2);
  h.setSession("after-new");
  h.setRecovery({ operation: replayableNative(second.operation_id, root), cleanup: { state: "settled" } });
  const restored = (await h.run({ action: "recover", ...names, attempt: 2 })).structuredContent;
  assert.equal(restored.state, "historical"); assert.equal(restored.automaticRetryBudget.remaining, 0);
  assert.equal(restored.automaticRetryBudget.sourceOperationId, first.operation_id);
  assert.deepEqual(readdirSync(store).sort(), before);
  assert.equal((await h.run({ ...retry, attempt: 2 })).isError, true, "a new session cannot adopt the prior owner");
  h.setSession("original-parent");
  const manual = (await h.run({ ...retry, attempt: 2, retryMode: "manual", reason: "User explicitly authorized another attempt" })).structuredContent;
  assert.equal(manual.attempt, 3); assert.equal(manual.automaticRetryBudget.remaining, 0);
  assert.equal(manual.delegationArguments.definitionId, undefined);
});

test("automatic retry requires qualified owner evidence and preserves completion, candidate and cancellation guards", async t => {
  const cases = {
    "missing proof on released Daddy": r => { delete r.runtime.automaticRetryEligibility; },
    "foreign operation proof": r => { r.runtime.automaticRetryEligibility.operationId = "principal:" + "d".repeat(64); },
    "foreign execution proof": r => { r.runtime.automaticRetryEligibility.executionId = "another-execution"; },
    "missing original binding": r => { delete r.runtime.automaticRetryEligibility.definitionId; },
    "complete answer despite failed work": r => { r.runtime.final = { state: "complete" }; },
    "control failure": r => { r.runtime.control = { state: "failed" }; },
    "uncertain cleanup": r => { r.runtime.cleanup.state = "uncertain"; },
  };
  for (const [label, alter] of Object.entries(cases)) await t.test(label, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const first = (await h.run({ action: "prepare", ...request, phase: "investigate" })).structuredContent;
    const runtime = replayableNative(first.operation_id, root); alter(runtime); h.setNative(runtime);
    const result = await h.run({ action: "retry", task: request.task, step: request.step, retryMode: "automatic", reason: label, expectedCandidate: observeCandidate(root) });
    assert.equal(result.isError, true);
    const status = (await h.run({ action: "status", task: request.task, step: request.step })).structuredContent;
    assert.equal(status.automaticRetryBudget.used, 0); assert.equal(status.attempt, 1);
  });
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  const first = (await h.run({ action: "prepare", ...request, phase: "investigate" })).structuredContent;
  h.setNative(replayableNative(first.operation_id, root));
  const args = { action: "retry", task: request.task, step: request.step, retryMode: "automatic", reason: "guard", expectedCandidate: observeCandidate(root) };
  assert.equal((await h.run(args, AbortSignal.abort())).isError, true);
  writeFileSync(join(root, "product.txt"), "changed\n");
  assert.equal((await h.run({ ...args, expectedCandidate: observeCandidate(root) })).isError, true);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
});

test("automatic retry claims converge across processes and cannot adopt a separately prepared manual successor", async t => {
  const { root, request } = fixture(t);
  const first = prepareOperation(root, { ...request, phase: "investigate" });
  const args = { task: request.task, step: request.step, retryMode: "automatic", reason: "Read-only retry", expectedCandidate: observeCandidate(root) };
  const runtime = replayableNative(first.operation_id, root);
  const moduleUrl = new URL("../../scripts/workflow-state.mjs", import.meta.url).href;
  const code = `import { retryOperation } from ${JSON.stringify(moduleUrl)}; try { console.log(JSON.stringify(retryOperation(process.argv[1], JSON.parse(process.argv[2]), JSON.parse(process.argv[3])))); } catch(error) { console.log(JSON.stringify({error:error.message})); }`;
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", code, root, JSON.stringify(args), JSON.stringify(runtime)]);
    let out = "", err = ""; child.stdout.on("data", part => { out += part; }); child.stderr.on("data", part => { err += part; });
    child.on("error", reject); child.on("close", status => status === 0 ? resolve(JSON.parse(out)) : reject(Error(err)));
  });
  const results = await Promise.all([run(), run(), run()]);
  const successes = results.filter(result => result.state === "prepared");
  assert.ok(successes.length >= 1); assert.equal(new Set(successes.map(result => result.operation_id)).size, 1);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 2);
  assert.equal(inspectOperation(root, { ...request, attempt: 2 }).automaticRetryBudget.remaining, 0);
  const other = fixture(t), source = prepareOperation(other.root, { ...other.request, phase: "investigate" });
  const sourceRuntime = replayableNative(source.operation_id, other.root);
  retryOperation(other.root, { ...other.request, retryMode: "manual", reason: "User choice" }, sourceRuntime);
  assert.throws(() => retryOperation(other.root, { task: other.request.task, step: other.request.step, expectedCandidate: other.request.expectedCandidate,
    retryMode: "automatic", reason: "No adoption" }, sourceRuntime), /existing successor/);
});

test("a missing consumed allowance never resets an automatic retry lineage", t => {
  const { root, request } = fixture(t);
  const first = prepareOperation(root, { ...request, phase: "investigate" });
  const args = { task: request.task, step: request.step, reason: "Read-only retry", expectedCandidate: observeCandidate(root) };
  const second = retryOperation(root, args, replayableNative(first.operation_id, root));
  assert.equal(second.attempt, 2, "owner proof chooses automatic mode even when omitted");
  const store = join(root, ".principal/workflow");
  const claimPath = readdirSync(store).map(name => join(store, name, "automatic-retry.json")).find(existsSync);
  assert.ok(claimPath);
  const originalClaim = JSON.parse(readFileSync(claimPath, "utf8"));
  // A syntactically valid reassignment to a later failure must not turn the consumed claim into
  // permission for another automatic successor under the same definition.
  const nextIdentity = "principal:" + createHash("sha256").update(JSON.stringify({ attempt: 3, root, step: request.step, task: request.task })).digest("hex");
  writeFileSync(claimPath, JSON.stringify({ ...originalClaim, sourceOperationId: second.operation_id, sourceAttempt: 2,
    successorOperationId: nextIdentity, executionId: `execution:${second.operation_id}` }));
  assert.equal(inspectOperation(root, { ...args, attempt: 2 }).automaticRetryBudget.state, "unknown");
  assert.throws(() => retryOperation(root, { ...args, attempt: 2 }, replayableNative(second.operation_id, root)), /differs from its recorded successor/);
  rmSync(claimPath);
  assert.equal(inspectOperation(root, { ...args, attempt: 2 }).automaticRetryBudget.state, "unknown");
  assert.throws(() => retryOperation(root, { ...args, attempt: 2 }, replayableNative(second.operation_id, root)), /allowance is missing/);
  assert.equal(readdirSync(store).length, 2);
});

test("an uncertain latest attempt is refused with its choices for every action, and a named attempt proceeds", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root, { historyBridge: true });
  const name = { task: request.task, step: request.step }, store = join(root, ".principal/workflow");
  const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
  h.setNative(settled(prepared.operation_id, root));
  await h.run({ action: "complete", ...name, disposition: "succeeded" });
  const retried = (await h.run({ action: "retry", ...name, reason: "accepted finding", expectedCandidate: observeCandidate(root) })).structuredContent;
  const queries = h.queries.length, claim = claimDirectory(root, name, 3);
  mkdirSync(claim);
  const listing = () => readdirSync(store).sort().map(entry => [entry, readdirSync(join(store, entry)).sort()]);
  const refusal = { version: 1, state: "refused", approval: false, administrativeWrites: false,
    error: "attempt 3 has incomplete or unreadable stored state, so the latest attempt is uncertain; name an attempt from choices",
    code: "OPERATION_NOT_SELECTED", diagnostic: { kind: "operation-selection", reason: "latest-attempt-uncertain" },
    choices: [{ ...name, attempt: 1, state: "complete", owned: true }, { ...name, attempt: 2, state: "prepared", owned: true }] };
  for (const damage of ["an interrupted claim without a record", "an unreadable record"]) {
    if (damage === "an unreadable record") writeFileSync(join(claim, "request.json"), "{");
    const before = listing();
    for (const [action, extra] of laterActions(root)) {
      const result = await h.run({ action, ...name, ...extra });
      assert.equal(result.isError, true, `${action} must not guess past ${damage}`);
      assert.deepEqual(result.structuredContent, refusal);
      assert.deepEqual(result.details, result.structuredContent);
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    }
    assert.deepEqual(listing(), before, "a refused selection writes nothing");
    assert.equal(h.queries.length, queries, "a refused selection never asks the runtime");
  }
  const { state: _state, owned: _owned, ...selection } = refusal.choices[1];
  const selected = (await h.run({ action: "status", ...selection })).structuredContent;
  assert.equal(selected.operation_id, retried.operation_id); assert.equal(selected.state, "prepared");
  h.setNative(settled(retried.operation_id, root, "Named attempt.\n"));
  const complete = (await h.run({ action: "complete", ...selection, disposition: "succeeded" })).structuredContent;
  assert.equal(complete.operation_id, retried.operation_id); assert.equal(complete.state, "complete");
});

test("a latest attempt owned by another coordinator is refused with choices and recovery arguments", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root, { historyBridge: true });
  const name = { task: request.task, step: request.step }, store = join(root, ".principal/workflow");
  const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
  h.setNative(settled(prepared.operation_id, root));
  const foreign = (attempt, choices) => ({ version: 1, state: "refused", approval: false, administrativeWrites: false,
    error: `operation belongs to another coordinator session or workspace: latest attempt ${attempt}; recover it, or name an owned attempt from choices`,
    recoverArguments: { action: "recover", ...name, attempt }, nextAction: recoverGuidance,
    code: "OPERATION_NOT_SELECTED", diagnostic: { kind: "operation-selection", reason: "latest-attempt-foreign" }, choices });
  h.setSession("new-parent");
  for (const [action, extra] of laterActions(root)) {
    const result = await h.run({ action, ...name, ...extra });
    assert.equal(result.isError, true, `${action} must not adopt another coordinator's operation`);
    assert.deepEqual(result.structuredContent, foreign(1, [{ ...name, attempt: 1, state: "prepared", owned: false }]));
  }
  // Naming the attempt applies exactly the ID path's checks: status stays inspectable, the rest stay owner-bound.
  const inspected = (await h.run({ action: "status", ...name, attempt: 1 })).structuredContent;
  assert.equal(inspected.operation_id, prepared.operation_id); assert.equal(inspected.owner.sessionId, "original-parent");
  assert.deepEqual(inspected, (await h.run({ action: "status", operationId: prepared.operation_id })).structuredContent);
  for (const [action, extra] of laterActions(root).filter(([action]) => action !== "status")) {
    const byName = await h.run({ action, ...name, attempt: 1, ...extra });
    assert.equal(byName.isError, true);
    assert.equal(byName.structuredContent.error, "operation belongs to another coordinator session or workspace");
    assert.deepEqual(byName.structuredContent.recoverArguments, { action: "recover", ...name, attempt: 1 });
    if (action === "result") continue; // A bare ID given to result is a generic native identity, as before.
    const byId = await h.run({ action, operationId: prepared.operation_id, ...extra });
    assert.equal(byId.structuredContent.error, byName.structuredContent.error);
    assert.deepEqual(byId.structuredContent.recoverArguments, { action: "recover", operationId: prepared.operation_id });
  }
  assert.deepEqual(h.queries, [], "no refused selection asked the runtime");
  assert.deepEqual(readdirSync(join(store, readdirSync(store)[0])), ["request.json"]);

  // The original coordinator keeps its own earlier attempt after another coordinator owns a later one.
  h.setSession("original-parent");
  await h.run({ action: "complete", ...name, disposition: "succeeded" });
  const retried = (await h.run({ action: "retry", ...name, reason: "accepted finding", expectedCandidate: observeCandidate(root) })).structuredContent;
  const path = join(claimDirectory(root, name, 2), "request.json"), record = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(record.operationId, retried.operation_id);
  record.owner.sessionId = "new-parent"; writeFileSync(path, JSON.stringify(record));
  const mixed = await h.run({ action: "complete", ...name, disposition: "succeeded" });
  assert.deepEqual(mixed.structuredContent, foreign(2, [{ ...name, attempt: 1, state: "complete", owned: true }, { ...name, attempt: 2, state: "prepared", owned: false }]));
  const own = (await h.run({ action: "complete", ...name, attempt: 1 })).structuredContent;
  assert.equal(own.operation_id, prepared.operation_id); assert.equal(own.reused, true);
  h.setSession("new-parent");
  const theirs = (await h.run({ action: "status", ...name })).structuredContent;
  assert.equal(theirs.attempt, 2); assert.equal(theirs.operation_id, retried.operation_id);
  for (const owner of [null, { sessionId: "new-parent", cwd: root, extra: true }, { sessionId: "new-parent", cwd: join(root, "elsewhere") }]) {
    record.owner = owner; writeFileSync(path, JSON.stringify(record));
    const refused = (await h.run({ action: "status", ...name })).structuredContent;
    assert.equal(refused.diagnostic?.reason, "latest-attempt-foreign", "only an exact session and workspace match is this coordinator's own");
    assert.deepEqual(refused.choices.map(choice => choice.owned), [false, false]);
  }
});

test("an operation ID that disagrees with the supplied task, step or attempt is refused for every action", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root, { historyBridge: true });
  const name = { task: request.task, step: request.step };
  const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
  const other = (await h.run({ action: "prepare", ...request, step: "second-step" })).structuredContent;
  h.setNative(settled(prepared.operation_id, root));
  for (const [action, extra] of laterActions(root)) {
    for (const mismatch of [{ step: "second-step" }, { task: "elsewhere" }, { attempt: 2 }, { operationId: other.operation_id }]) {
      const result = await h.run({ action, operationId: prepared.operation_id, ...name, ...mismatch, ...extra });
      assert.equal(result.isError, true, `${action} must refuse ${JSON.stringify(mismatch)}`);
      assert.equal(result.structuredContent.error, "operationId conflicts with supplied task/step/attempt");
      assert.equal(result.structuredContent.choices, undefined, "a disagreement is never resolved by choosing");
    }
  }
  const generic = await h.run({ action: "result", operationId: "investigate:no-files", ...name });
  assert.equal(generic.isError, true);
  assert.equal(generic.structuredContent.error, "invalid Principal operationId", "a generic native ID is not this named prepared operation");
  assert.deepEqual(h.queries, [], "no disagreement reached the runtime");
  const agreed = (await h.run({ action: "status", operationId: prepared.operation_id, ...name, attempt: 1 })).structuredContent;
  assert.deepEqual(agreed, (await h.run({ action: "status", operationId: prepared.operation_id })).structuredContent);
  const observed = (await h.run({ action: "result", operationId: prepared.operation_id, ...name })).structuredContent;
  assert.equal(observed.runtime.operationId, prepared.operation_id);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 2);
});

test("an unrecorded task or step is refused without guessing, listing or writing", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root, { historyBridge: true });
  const unrecorded = { version: 1, state: "refused", approval: false, administrativeWrites: false,
    error: "no prepared operation is recorded for this task and step in this workspace; name the task and step given to prepare. This does not show whether earlier work started and does not call for a replacement",
    code: "OPERATION_NOT_SELECTED", diagnostic: { kind: "operation-selection", reason: "not-recorded" }, choices: [] };
  const all = async selection => { for (const [action, extra] of laterActions(root)) {
    const result = await h.run({ action, ...selection, ...extra });
    assert.equal(result.isError, true); assert.deepEqual(result.structuredContent, unrecorded);
  } };
  await all({ task: request.task, step: request.step });
  assert.equal(existsSync(join(root, ".principal/workflow")), false);
  await h.run({ action: "prepare", ...request });
  await all({ task: request.task, step: "implementations" });
  await all({ task: "fixtures", step: request.step });
  for (const [action, extra] of laterActions(root)) {
    const missing = await h.run({ action, task: request.task, ...extra });
    assert.equal(missing.structuredContent.error, "step must be a stable nonempty name (at most 200 characters)");
    assert.equal(missing.structuredContent.code, undefined);
  }
  const neither = await h.run({ action: "result" });
  assert.equal(neither.structuredContent.error, "result requires task and step, or the actual native operationId");
  assert.deepEqual(h.queries, []);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
});

test("registered schema accepts task and step in place of an operation ID and every returned argument object", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root), { parameters, outputSchema } = h.tool;
  const name = { task: request.task, step: request.step };
  const valid = args => typeof args.action === "string" && schemaAccepts(parameters, args);
  assert.equal(parameters.additionalProperties, false);
  for (const [action, extra] of laterActions(root)) {
    assert.equal(valid({ action, ...name, ...extra }), true, `${action} by task and step`);
    assert.equal(valid({ action, ...name, attempt: 2, ...extra }), true, `${action} by task, step and attempt`);
    assert.equal(valid({ action, operationId: "principal:" + "a".repeat(64), ...extra }), true, `${action} by operation ID`);
  }
  for (const invalid of [{ ...name, attempt: 0 }, { ...name, attempt: "1" }, { ...name, task: "two words" }, { ...name, step: " " }, { ...name, state: "prepared" }])
    assert.equal(valid({ action: "status", ...invalid }), false, `schema must reject ${JSON.stringify(invalid)}`);
  assert.equal(parameters.properties.operationId.type, "string");
  assert.doesNotMatch(parameters.properties.operationId.description, /copy|unchanged|complete operation_id/);

  const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
  const status = outputSchema.properties.statusArguments;
  assert.deepEqual(Object.keys(status.properties).sort(), ["action", "attempt", "repo", "step", "task"]);
  assert.equal(status.additionalProperties, false);
  assert.equal(schemaAccepts(status, prepared.statusArguments), true);
  assert.equal(schemaAccepts(outputSchema.properties.delegationArguments, prepared.delegationArguments), true);
  writeFileSync(join(root, "product.txt"), "changed by the build\n");
  const changed = (await h.run({ action: "prepare", ...request, expectedCandidate: observeCandidate(root) })).structuredContent;
  assert.equal(changed.code, "PREPARED_OUTPUT_CHANGED"); assert.equal(changed.operation_id, prepared.operation_id);
  const malformed = (await h.run({ action: "complete", operationId: "fixture", ...name })).structuredContent;
  assert.deepEqual(malformed.recovery.statusArguments, { action: "status", ...name }, "an omitted attempt is not invented");
  h.setSession("new-parent");
  const foreign = (await h.run({ action: "status", ...name })).structuredContent;
  h.setSession("original-parent");
  const returned = [prepared.statusArguments, changed.recovery.statusArguments, changed.recovery.resultArguments,
    { ...changed.recovery.completionArguments, disposition: "unverified" }, malformed.recovery.statusArguments, foreign.recoverArguments,
    ...foreign.choices.map(({ task, step, attempt }) => ({ action: "status", task, step, attempt }))];
  for (const args of returned) {
    assert.equal(valid(args), true, `returned ${args.action} arguments are valid input`);
    assert.equal("operationId" in args, false, "a follow-up never needs the stored ID");
  }
  h.setNative(settled(prepared.operation_id, root));
  for (const args of returned.filter(args => args.action !== "recover")) {
    const result = await h.run(args);
    assert.equal(result.isError, undefined, `returned ${args.action} arguments execute`);
    assert.equal(result.structuredContent.operation_id ?? result.structuredContent.runtime.operationId, prepared.operation_id);
  }
});

test("actual Pi argument validation accepts task and step in place of an operation ID", { skip: !process.env.PRINCIPAL_PI_SDK_ROOT }, async t => {
  const sdk = process.env.PRINCIPAL_PI_SDK_ROOT, require = createRequire(join(sdk, "package.json"));
  t.diagnostic(`Pi ${JSON.parse(readFileSync(join(sdk, "package.json"), "utf8")).version}: actual TypeBox and native argument validator; no model calls`);
  const aiRoot = require.resolve.paths("@earendil-works/pi-ai").map(path => join(path, "@earendil-works/pi-ai"))
    .find(path => existsSync(join(path, "package.json")));
  assert.ok(aiRoot, "selected Pi SDK must supply its native argument validator");
  const { validateToolArguments } = await import(pathToFileURL(join(aiRoot, "dist/utils/validation.js")).href);
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url), pathToFileURL(require.resolve("typebox")).href));
  const { root, request } = fixture(t), name = { task: request.task, step: request.step };
  let tool;
  register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {},
    events: { on: () => () => {}, emit: () => { throw Error("Selection by name never dispatches native work"); } } });
  const ctx = { cwd: root, sessionManager: { getSessionId: () => "original-parent" } };
  const call = async args => (await tool.execute("fixture", validateToolArguments(tool, { name: tool.name, arguments: args }), undefined, () => {}, ctx)).structuredContent;
  const prepared = await call({ action: "prepare", ...request });
  for (const args of [{ action: "status", ...name }, { action: "status", ...name, attempt: 1 }, prepared.statusArguments]) {
    const status = await call(args);
    assert.equal(status.operation_id, prepared.operation_id); assert.equal(status.attempt, 1);
    assert.deepEqual(status.statusArguments, prepared.statusArguments);
  }
  for (const args of [{ action: "status", ...name, attempt: 0 }, { action: "status", ...name, state: "prepared" }, { action: "status", task: "two words", step: name.step }])
    assert.throws(() => validateToolArguments(tool, { name: tool.name, arguments: args }), /Validation failed for tool "principal_workflow"/);
  const retention = { action: "recover", mode: "retain", ...name, attempt: 1, sourceReference: reference(join(root, ".principal/plan.md")),
    producerReference: reference(join(root, ".principal/plan.md")), expectedCandidate: observeCandidate(root) };
  assert.deepEqual(validateToolArguments(tool, { name: tool.name, arguments: retention }), retention,
    "the native host accepts returned historical-retention arguments; validating them does not grant producer authority");
});

test("documented direct argument transfer dispatches the prepared phase once without recopying identities", async t => {
  const source = readFileSync(new URL("../../references/workflow-mechanics.md", import.meta.url), "utf8");
  const example = source.match(/```js\n([\s\S]*?function prepareAndDelegate[\s\S]*?)\n```/u)?.[1];
  assert.ok(example, "the published transfer example must be executable");
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  for (const describeAsText of [true, false]) {
    const { root, request } = fixture(t), calls = [], admitted = new Map();
    let tool;
    register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {},
      events: { on: () => () => {}, emit: () => { throw Error("Preparation must not query native execution"); } } });
    const ctx = { cwd: root, sessionManager: { getSessionId: () => "original-parent" } };
    const definition = { agent: request.phase, definitionId: "a".repeat(64), binding: { package: "principal-pi-skills", phase: request.phase } };
    const tools = {
      principal_workflow: async args => (await tool.execute("fixture", args, undefined, () => {}, ctx)).structuredContent,
      delegate_describe: async args => { calls.push({ name: "describe", args }); return describeAsText ? JSON.stringify(definition) : definition; },
      delegate: async args => {
        const observed = inspectOwnedOperation(root, { operationId: args.operation_id }, { sessionId: "original-parent", cwd: root });
        assert.equal(args.agent, observed.phase);
        assert.equal(args.definitionId, definition.definitionId);
        assert.equal(args.task, "Implement only the authorized fixture behavior.");
        calls.push({ name: "delegate", args });
        if (admitted.has(args.operation_id)) {
          assert.deepEqual(args, admitted.get(args.operation_id), "different request inputs cannot reuse the original claim");
          return { state: "existing-native-operation", operationId: args.operation_id };
        }
        admitted.set(args.operation_id, args);
        return { state: "synthetic-native-result", operationId: args.operation_id };
      },
    };
    const transfer = new Function("tools", `${example}\nreturn prepareAndDelegate;`)(tools);
    const args = { action: "prepare", ...request };
    const native = await transfer(args, "Implement only the authorized fixture behavior.");
    assert.equal(native.state, "synthetic-native-result");
    assert.match(native.operationId, /^principal:[a-f0-9]{64}$/u);
    assert.notEqual(native.operationId, request.task);
    assert.deepEqual(calls.map(call => call.name), ["describe", "delegate"]);
    const second = await transfer(args, "Implement only the authorized fixture behavior.");
    assert.equal(second.state, "existing-native-operation");
    assert.equal(second.operationId, native.operationId);
    assert.equal(calls.length, 4);
    assert.equal(admitted.size, 1, "reused preparation must preserve the exact native claim instead of creating another child");
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
    const current = await tools.principal_workflow({ action: "status", operationId: native.operationId });
    writeFileSync(join(root, "product.txt"), "a later candidate\n");
    const changed = await tools.principal_workflow(current.statusArguments);
    assert.equal(changed.candidateMatches, false);
    assert.equal(changed.delegationArguments, undefined, "stale preparation must not offer fresh dispatch arguments");
  }
});

test("malformed prepared IDs have exact read-only recovery without replacing work or asserting no prior start", async t => {
  const { root, request } = fixture(t), owner = { sessionId: "original-parent", cwd: root };
  const originalPrepared = prepareOperation(root, { ...request, owner });
  const store = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0]);
  const before = readFileSync(join(store, "request.json"));
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  let tool;
  register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {},
    events: { on: () => () => {}, emit: () => { throw Error("Malformed IDs must not query or dispatch native work"); } } });
  const ctx = { cwd: root, sessionManager: { getSessionId: () => owner.sessionId } };
  const call = args => tool.execute("fixture", args, undefined, () => {}, ctx);
  const prepared = (await call({ action: "status", operationId: originalPrepared.operation_id })).structuredContent;
  for (const action of ["status", "complete", "retry", "history"]) {
    for (const operationId of [request.task, prepared.operation_id.slice(0, -1), prepared.operation_id + "\n", "private-value-do-not-echo", "", null, 1]) {
      const result = await call({ action, operationId, task: request.task, step: request.step, attempt: 1 });
      assert.equal(result.isError, true);
      const refused = result.structuredContent;
      assert.equal(refused.code, "OPERATION_ID_INVALID");
      assert.equal(refused.administrativeWrites, false);
      assert.equal(refused.operationAllocated, undefined, "bad lookup says nothing about previous admission");
      assert.equal(refused.approval, false);
      assert.equal(refused.diagnostic.field, "operationId");
      assert.match(refused.recovery.message, /does not establish whether prior work started or settled/);
      assert.equal(JSON.stringify(result).includes("private-value-do-not-echo"), false);
      const recovered = (await call(refused.recovery.statusArguments)).structuredContent;
      assert.equal(recovered.operation_id, prepared.operation_id);
      assert.equal(recovered.attempt, 1);
      assert.deepEqual(recovered.statusArguments, prepared.statusArguments);
      assert.deepEqual(recovered.delegationArguments, prepared.delegationArguments);
    }
  }
  const unknown = (await call({ action: "status", operationId: "short" })).structuredContent;
  assert.equal(unknown.recovery.statusArguments, undefined, "do not guess missing task, step or attempt");
  const conflicting = await call({ action: "status", operationId: prepared.operation_id, task: "different" });
  assert.match(conflicting.structuredContent.error, /conflicts/);
  assert.equal(conflicting.structuredContent.recovery, undefined, "valid conflicting IDs must not be ignored");
  const missing = await call({ action: "status", operationId: "principal:" + "f".repeat(64) });
  assert.match(missing.structuredContent.error, /missing or ambiguous/);
  assert.equal(missing.structuredContent.recovery, undefined, "well-shaped missing IDs must not be fuzzy-matched");
  assert.deepEqual(readFileSync(join(store, "request.json")), before);
  assert.deepEqual(readdirSync(store), ["request.json"]);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  assert.equal(readFileSync(join(root, "product.txt"), "utf8"), "before\n");
  const invalidPrepare = await call({ action: "prepare", ...request, operationId: "short" });
  assert.equal(invalidPrepare.structuredContent.code, "OPERATION_ID_INVALID");
  assert.equal(invalidPrepare.structuredContent.administrativeWrites, false);
  assert.deepEqual(readFileSync(join(store, "request.json")), before);
});

test("additive tool arguments preserve an existing core-prepared record and its native completion", async t => {
  const { root, request } = fixture(t), owner = { sessionId: "original", cwd: root };
  const original = prepareOperation(root, { ...request, owner });
  assert.equal(original.delegationArguments, undefined, "the core operation format remains unchanged");
  const record = join(root, ".principal/workflow", readdirSync(join(root, ".principal/workflow"))[0], "request.json");
  const originalBytes = readFileSync(record), queries = [];
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  let tool;
  register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {}, events: {
    on: () => () => {}, emit(name, query) {
      queries.push({ name, id: query.operationId });
      const operation = settled(query.operationId, root);
      query.reply({ version: 1, requestId: query.requestId, sessionId: query.sessionId, cwd: query.cwd,
        operationId: query.operationId, qualified: true, operation, final: operation.finalObservation });
    },
  } });
  const ctx = { cwd: root, sessionManager: { getSessionId: () => owner.sessionId } };
  const call = async args => (await tool.execute("fixture", args, undefined, () => {}, ctx)).structuredContent;
  const current = await call({ action: "status", operationId: original.operation_id });
  assert.equal(current.state, "prepared");
  assert.deepEqual(current.delegationArguments, { agent: request.phase, operation_id: original.operation_id });
  assert.deepEqual(current.statusArguments, { action: "status", repo: root, task: request.task, step: request.step, attempt: 1 });
  assert.equal(current.operation_id, original.operation_id, "the stored ID stays in the output for consumers that record it");
  assert.deepEqual(readFileSync(record), originalBytes, "presenting argument objects does not rewrite the prior record");
  const complete = await call({ ...current.statusArguments, action: "complete", disposition: "succeeded" });
  assert.equal(complete.state, "complete");
  assert.equal(complete.completionValid, true);
  assert.equal(complete.operation_id, original.operation_id);
  assert.equal(complete.delegationArguments, undefined, "completed work does not offer new delegation arguments");
  assert.deepEqual(readFileSync(record), originalBytes);
  assert.deepEqual(queries, [{ name: "pi-daddy:operation-status:v1", id: original.operation_id }]);
  assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
});

test("registered result keeps generic native identities while history keeps its original owner checks", async t => {
  const { root, request } = fixture(t), owner = { sessionId: "original", cwd: root };
  const prepared = prepareOperation(root, { ...request, owner });
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  let tool, sessionId = owner.sessionId;
  const queries = [];
  register({ registerTool: value => { tool = value; }, registerCommand: () => {}, on: () => {}, events: {
    on: () => () => {}, emit(name, query) {
      queries.push({ name, id: query.operationId });
      const history = name === "pi-daddy:operation-history:v1";
      const operation = history ? historical(query.operationId, owner) : settled(query.operationId, root);
      query.reply({ version: 1, requestId: query.requestId, sessionId: query.sessionId, cwd: query.cwd,
        operationId: query.operationId, qualified: !history, history, operation,
        final: operation.finalObservation, ...(history ? { artifact: operation.artifact } : {}) });
    },
  } });
  const ctx = { cwd: root, sessionManager: { getSessionId: () => sessionId } };
  const call = args => tool.execute("fixture", args, undefined, () => {}, ctx);
  const result = await call({ action: "result", operationId: "investigate:no-files" });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.runtime.operationId, "investigate:no-files");
  const history = await call({ action: "history", operationId: prepared.operation_id });
  assert.equal(history.isError, undefined);
  assert.equal(history.structuredContent.state, "historical");
  sessionId = "other-parent";
  const denied = await call({ action: "history", operationId: prepared.operation_id });
  assert.equal(denied.isError, true);
  assert.match(denied.structuredContent.error, /another coordinator/);
  assert.equal(denied.structuredContent.recovery, undefined);
  assert.deepEqual(queries, [{ name: "pi-daddy:operation-status:v1", id: "investigate:no-files" }, { name: "pi-daddy:operation-history:v1", id: prepared.operation_id }]);
});

test("changed authority retains the exact settled review without marking the operation complete", t => {
  const { root, request } = fixture(t), review = { ...request, phase: "review" };
  const prepared = prepareOperation(root, review), text = "Review Verdict: APPROVE\nScope: integrated\nNext: git-ops\n";
  writeFileSync(join(root, ".principal/plan.md"), "different requirements\n");
  const done = completeOperation(root, { operationId: prepared.operation_id, disposition: "succeeded" }, settled(prepared.operation_id, root, text));
  assert.equal(done.state, "stale"); assert.equal(done.resultRetained, true);
  assert.equal(done.inputsMatch, false); assert.equal(done.candidateMatches, true);
  assert.equal(done.completionValid, false); assert.equal(done.approval, false);
  assert.match(done.issues.join("; "), /changed input/);
  assert.equal(readFileSync(done.report.path, "utf8"), text);
  assert.equal(done.report.sha256, done.runtime.runtime.final.sha256);
  const before = readFileSync(done.report.path, "utf8");
  assert.throws(() => completeOperation(root, { operationId: prepared.operation_id, disposition: "blocked" }), /immutable/);
  assert.equal(readFileSync(done.report.path, "utf8"), before);
  assert.equal(inspectOperation(root, { operationId: prepared.operation_id }).state, "stale");
});


test("editable context changes complete normally while immutable authority remains enforced", async t => {
  for (const changedAuthority of [false, true]) await t.test(changedAuthority ? "changed authority" : "product edit", async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root), names = { task: request.task, step: request.step };
    const args = { action: "prepare", ...request, contextPaths: ["product.txt"] };
    const before = readdirSync(join(root, ".principal"));
    const snapshot = (await h.run({ action: "snapshot", contextPaths: args.contextPaths, inputs: request.inputs })).structuredContent;
    assert.deepEqual(snapshot.contextPaths, [join(root, "product.txt")]);
    assert.deepEqual(snapshot.inputs, request.inputs);
    assert.deepEqual(readdirSync(join(root, ".principal")), before, "snapshot stays read-only");
    const prepared = (await h.run(args)).structuredContent;
    assert.deepEqual(prepared.contextPaths, snapshot.contextPaths);
    assert.deepEqual(prepared.inputs, request.inputs, "editable bytes are never prerequisite pins");
    assert.equal((await h.run(args)).structuredContent.reused, true);
    writeFileSync(join(root, "product.txt"), "implemented change\n");
    if (changedAuthority) writeFileSync(join(root, ".principal/plan.md"), "Changed required behavior.\n");
    const text = "Implemented the product change; independent review remains.\n";
    h.setNative(settled(prepared.operation_id, root, text));
    const done = (await h.run({ action: "complete", ...names, disposition: "succeeded" })).structuredContent;
    assert.equal(done.state, changedAuthority ? "stale" : "complete");
    assert.equal(done.completionValid, !changedAuthority); assert.equal(done.inputsMatch, !changedAuthority);
    assert.equal(done.candidateMatches, true); assert.equal(done.resultRetained, true); assert.equal(done.approval, false);
    assert.deepEqual(done.contextPaths, prepared.contextPaths);
    assert.equal(readFileSync(done.report.path, "utf8"), text);
    if (changedAuthority) assert.match(done.inputRecovery.message, /Immutable authority\/evidence changed/);
    h.setSession("after-new");
    const recalled = (await h.run({ action: "recover", ...names, attempt: 1 })).structuredContent;
    assert.equal(recalled.state, changedAuthority ? "historical" : "reused");
    assert.deepEqual(recalled.report, done.report); assert.equal(recalled.delegationArguments, undefined);
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  });
});

test("editable context checks readability without reading whole tracked assets again", t => {
  const { root } = fixture(t), product = join(root, "product.txt"), originalRead = fs.readFileSync;
  const candidate = observeCandidate(root);
  fs.readFileSync = function(path, ...args) {
    assert.notEqual(path, product, "context hints must not load/hash a tracked asset already covered by candidate observation");
    return originalRead.call(this, path, ...args);
  };
  syncBuiltinESMExports();
  try {
    const observed = observeSnapshot(root, { contextPaths: ["product.txt"] });
    assert.deepEqual(observed.candidate, candidate); assert.deepEqual(observed.contextPaths, [product]);
    assert.throws(() => reference(product), /must not load\/hash/, "the guard rejects the former full-file reference path");
  } finally { fs.readFileSync = originalRead; syncBuiltinESMExports(); }
});

test("context paths reject ambiguous or uncovered inputs before allocating an operation", async t => {
  for (const kind of ["overlap", "normalized overlap", "duplicate", "outside", "ignored", "metadata", "missing"]) await t.test(kind, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    let contextPaths = ["product.txt"], inputs = request.inputs;
    if (kind.includes("overlap")) {
      inputs = [...inputs, reference(join(root, "product.txt"))];
      if (kind === "normalized overlap") contextPaths = ["./product.txt"];
    }
    if (kind === "duplicate") contextPaths.push("./product.txt");
    if (kind === "outside") contextPaths = [join(root, "..", "outside.txt")];
    if (kind === "ignored") {
      writeFileSync(join(root, ".gitignore"), "private.txt\n"); writeFileSync(join(root, "private.txt"), "private\n"); contextPaths = ["private.txt"];
    }
    if (kind === "metadata") contextPaths = [".git/HEAD"];
    if (kind === "missing") contextPaths = ["not-present.txt"];
    const result = await h.run({ action: "prepare", ...request, inputs, contextPaths, expectedCandidate: observeCandidate(root) });
    assert.equal(result.isError, true, kind); assert.equal(result.structuredContent.approval, false);
    assert.equal(result.structuredContent.code, "CONTEXT_PATH_INVALID");
    assert.equal(result.structuredContent.operationAllocated, false); assert.equal(result.structuredContent.administrativeWrites, false);
    assert.equal(result.structuredContent.diagnostic.field, "contextPaths");
    assert.match(result.structuredContent.recovery.message, /same authorized scope/);
    if (kind.includes("overlap")) assert.match(result.structuredContent.error, /cannot also be immutable inputs/);
    assert.equal(existsSync(join(root, ".principal/workflow")), false);
    assert.equal(existsSync(join(root, ".principal/reports")), false);
    assert.deepEqual(h.queries, []);
  });
});

test("context declarations never reinterpret legacy pins or alter an existing operation", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root), names = { task: request.task, step: request.step };
  const prepared = (await h.run({ action: "prepare", ...request, inputPaths: ["product.txt"] })).structuredContent;
  assert.equal(prepared.contextPaths, undefined);
  const store = join(root, ".principal/workflow"), recordPath = join(store, readdirSync(store)[0], "request.json");
  const original = readFileSync(recordPath);
  const changed = await h.run({ action: "prepare", ...request, contextPaths: ["product.txt"] });
  assert.equal(changed.isError, true); assert.match(changed.structuredContent.error, /operation conflict/);
  assert.deepEqual(readFileSync(recordPath), original);
  writeFileSync(join(root, "product.txt"), "legitimate edit mistakenly pinned as authority\n");
  h.setNative(settled(prepared.operation_id, root));
  const done = (await h.run({ action: "complete", ...names, disposition: "unverified" })).structuredContent;
  assert.equal(done.inputsMatch, false); assert.equal(done.completionValid, false); assert.equal(done.resultRetained, true);
  assert.match(done.inputRecovery.message, /not proof of an edit after the child finished/);
  assert.match(done.inputRecovery.message, /preserve this record as history/);
  assert.equal(done.inputRecovery.grantsAuthority, false);
  h.setSession("after-new");
  const history = (await h.run({ action: "recover", ...names, attempt: 1 })).structuredContent;
  assert.equal(history.state, "historical"); assert.equal(history.inputsMatch, false);
  assert.deepEqual(readFileSync(recordPath), original); assert.equal(readdirSync(store).length, 1);
});

test("completed partial children get read-only continuation guidance before missing retry proof", async t => {
  for (const retained of [false, true]) await t.test(retained ? "retained and stale" : "unretained", async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root), names = { task: request.task, step: request.step };
    const prepared = (await h.run({ action: "prepare", ...request })).structuredContent;
    writeFileSync(join(root, "product.txt"), "partial delivery\n");
    h.setNative(settled(prepared.operation_id, root, "Settings placeholder implemented; collector still undone.\n"));
    if (retained) {
      writeFileSync(join(root, ".principal/plan.md"), "changed required authority\n");
      await h.run({ action: "complete", ...names, disposition: "unverified" });
    }
    const store = join(root, ".principal/workflow"), operation = join(store, readdirSync(store)[0]);
    const capture = () => Object.fromEntries(readdirSync(operation).sort().map(name => [name, readFileSync(join(operation, name), "utf8")]));
    const before = capture(), report = existsSync(prepared.reportPath) ? readFileSync(prepared.reportPath) : undefined;
    const response = await h.run({ action: "retry", ...names, retryMode: "automatic", reason: "finish product", expectedCandidate: observeCandidate(root) });
    const result = response.structuredContent;
    assert.equal(response.isError, true); assert.equal(result.code, "NATIVE_RESULT_ALREADY_COMPLETE");
    assert.equal(result.administrativeWrites, false); assert.equal(result.approval, false);
    assert.equal(result.diagnostic.resultRetained, retained); assert.equal(result.diagnostic.inputsMatch, !retained);
    assert.equal(result.recovery.action, "reconcile-remaining-work");
    assert.match(result.recovery.message, /standing authorization and current prerequisites/);
    assert.match(result.recovery.message, /Reuse already delivered work/);
    assert.doesNotMatch(result.error, /may not support|manual retry|separately authorized/);
    assert.deepEqual(result.recovery.statusArguments, prepared.statusArguments);
    assert.equal(!!result.recovery.completionArguments, !retained);
    assert.equal(result.delegationArguments, undefined); assert.deepEqual(capture(), before);
    if (report) assert.deepEqual(readFileSync(prepared.reportPath), report);
    assert.equal(readdirSync(store).length, 1);
    assert.equal((await h.run(prepared.statusArguments)).structuredContent.automaticRetryBudget.used, 0);
  });
});

test("completed-result guidance retains identity, settlement and explicit manual-retry boundaries", async t => {
  for (const kind of ["workspace", "execution", "final identity", "control", "running", "owner", "aborted"]) await t.test(kind, async t => {
    const { root, request } = fixture(t), h = await registeredWorkflow(root);
    const prepared = (await h.run({ action: "prepare", ...request })).structuredContent, runtime = settled(prepared.operation_id, root);
    if (kind === "workspace") runtime.cwd = "/different";
    if (kind === "execution") runtime.runtime.cleanup.executionId = "different";
    if (kind === "final identity") delete runtime.runtime.final.sessionId;
    if (kind === "control") runtime.runtime.control = { state: "failed" };
    if (kind === "running") runtime.state = "running";
    if (kind === "owner") h.setSession("other-parent");
    h.setNative(runtime);
    const response = await h.run({ action: "retry", task: request.task, step: request.step, retryMode: "automatic", reason: kind, expectedCandidate: observeCandidate(root) },
      kind === "aborted" ? AbortSignal.abort() : undefined);
    assert.equal(response.isError, true); assert.notEqual(response.structuredContent.code, "NATIVE_RESULT_ALREADY_COMPLETE");
    assert.equal(response.structuredContent.recovery?.action, undefined);
    assert.equal(readdirSync(join(root, ".principal/workflow")).length, 1);
  });
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  const prepared = (await h.run({ action: "prepare", ...request, contextPaths: ["product.txt"] })).structuredContent;
  h.setNative(settled(prepared.operation_id, root));
  const manual = (await h.run({ action: "retry", task: request.task, step: request.step, retryMode: "manual",
    reason: "Explicit authorized revision", expectedCandidate: observeCandidate(root) })).structuredContent;
  assert.equal(manual.attempt, 2); assert.deepEqual(manual.contextPaths, prepared.contextPaths);
  assert.equal(manual.automaticRetryBudget.used, 0);
});

test("operationId lookup isolates an interrupted sibling without accepting duplicate valid identities", t => {
  const { root, request } = fixture(t), prepared = prepareOperation(root, request);
  const store = join(root, ".principal/workflow"), original = readdirSync(store)[0];
  const damaged = join(store, "f".repeat(64));
  mkdirSync(damaged); writeFileSync(join(damaged, "request.json"), "{");
  const selected = { operationId: prepared.operation_id };
  assert.equal(inspectOperation(root, selected).state, "prepared");
  const completed = completeOperation(root, { ...selected, disposition: "succeeded" }, settled(prepared.operation_id, root));
  assert.equal(completed.state, "complete"); assert.equal(completed.approval, false);
  assert.equal(readFileSync(join(damaged, "request.json"), "utf8"), "{");
  const duplicate = join(store, "e".repeat(64));
  mkdirSync(duplicate); writeFileSync(join(duplicate, "request.json"), readFileSync(join(store, original, "request.json")));
  assert.throws(() => inspectOperation(root, selected), /ambiguous/);
});


test("bounded check records required observations independently of process exit", async t => {
  const { root } = fixture(t);
  const check = { repo: root, task: "handoff", step: "delivered object", command: process.execPath,
    criteria: [{ id: "editable", expected: true }], inputPaths: ["product.txt"] };
  const writeObserved = value => ["-e", `require("node:fs").writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS, ${JSON.stringify(JSON.stringify({ version: 1, observed: { editable: value } }))})`];
  const missing = await runVerification({ ...check, args: ["-e", ""] });
  assert.equal(missing.receipt.execution.reason, "exit-zero");
  assert.equal(missing.receipt.outcome, "incomplete");
  assert.equal(missing.receipt.observations[0].state, "unobserved");
  assert.equal(missing.nextAction.kind, "repair-check");
  assert.equal(missing.nextAction.attempt, 2);
  const failed = await runVerification({ ...check, attempt: 2, args: writeObserved(false) });
  assert.equal(failed.receipt.outcome, "failed");
  assert.equal(failed.nextAction.kind, "inspect-outcome");
  assert.match(failed.nextAction.message, /mismatched observation/);
  writeFileSync(join(root, "product.txt"), "candidate amended after the failed check\n");
  const staleFailure = inspectVerification(root, { ...check, attempt: 2 });
  assert.equal(staleFailure.nextAction.kind, "recheck-affected");
  assert.deepEqual(staleFailure.reference, failed.reference);
  const good = { ...check, attempt: 3, args: writeObserved(true) };
  const saved = await runVerification(good);
  assert.equal(saved.receipt.outcome, "passed");
  assert.equal(saved.receipt.scope, "declared-observations");
  assert.equal(saved.nextAction.kind, "reuse");
  assert.match(saved.nextAction.message, /permits historical evidence.*environment still matches.*fresh check/);
  assert.equal(saved.applicability.environment, "not-established");
  assert.equal(saved.approval, false);
  const original = readFileSync(saved.reference.path);
  writeFileSync(join(root, "product.txt"), "new content\n");
  const recalled = await runVerification(good);
  assert.equal(recalled.reused, true);
  assert.deepEqual(readFileSync(recalled.reference.path), original);
  assert.equal(recalled.applicability.source, "changed-or-unobserved");
  assert.equal(recalled.applicability.inputs, "changed-or-unobserved");
  assert.equal(recalled.nextAction.kind, "recheck-affected");
  await assert.rejects(runVerification({ ...good, criteria: [] }), /different inputs.*saved verification.*attempt 3/);
  const h = await registeredWorkflow(root);
  const view = (await h.run({ action: "verification", task: check.task, step: check.step, attempt: 3 })).structuredContent;
  assert.deepEqual(view.reference, saved.reference);
  assert.deepEqual(h.queries, []);
  const firstReceipt = inspectVerification(root, { task: check.task, step: check.step });
  assert.equal(firstReceipt.receipt.outcome, "incomplete");
  assert.equal(firstReceipt.nextAction.kind, "inspect-existing");
  assert.equal(firstReceipt.nextAction.attempt, 2);
  assert.deepEqual(firstReceipt.nextAction.inspectionArguments,
    { action: "verification", repo: root, task: check.task, step: check.step, attempt: 2 });
  assert.deepEqual(firstReceipt.reference, missing.reference);
});

test("a successful export can still fail the required content check; retries preserve earlier observations", async t => {
  const { root } = fixture(t);
  const exportPath = join(root, "delivery.json");
  const check = { repo: root, task: "noticeboard", step: "public export", command: process.execPath,
    inputPaths: ["delivery.json"], criteria: [{ id: "public-items-only", expected: true }],
    args: ["-e", `
      const fs = require("node:fs");
      const delivery = JSON.parse(fs.readFileSync("delivery.json", "utf8"));
      const actual = delivery.items.map(item => item.id).sort();
      const matches = JSON.stringify(actual) === JSON.stringify(["hours", "menu"]);
      const attempt = require("node:path").dirname(process.env.PRINCIPAL_CHECK_OBSERVATIONS);
      fs.writeFileSync(require("node:path").join(attempt, "sample.json"), JSON.stringify(actual));
      fs.writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS, JSON.stringify({
        version: 1, observed: { "public-items-only": matches },
      }));
    `] };
  // The exporter reports success even when it includes a private draft.
  const deliver = ids => writeFileSync(exportPath, JSON.stringify({
    status: "success", items: ids.map(id => ({ id })),
  }));
  deliver(["hours", "menu", "draft"]);
  const failed = await runVerification(check);
  assert.equal(failed.receipt.execution.reason, "exit-zero");
  assert.equal(failed.receipt.outcome, "failed");
  const original = readFileSync(failed.reference.path);
  // A late report sent to the first adapter's directory cannot satisfy a later check.
  writeFileSync(join(dirname(failed.reference.path), "observations.json"), JSON.stringify({
    version: 1, observed: { "public-items-only": true },
  }));
  const missing = await runVerification({ ...check, attempt: 2, args: ["-e", ""] });
  assert.equal(missing.receipt.outcome, "incomplete");
  deliver(["menu", "hours"]);
  const passed = await runVerification({ ...check, attempt: 3 });
  assert.equal(passed.receipt.outcome, "passed");
  assert.equal(passed.approval, false);
  assert.notEqual(passed.reference.path, failed.reference.path);
  assert.deepEqual(readFileSync(failed.reference.path), original);
  assert.equal(readFileSync(join(dirname(failed.reference.path), "sample.json"), "utf8"),
    JSON.stringify(["draft", "hours", "menu"]));
  assert.equal(readFileSync(join(dirname(passed.reference.path), "sample.json"), "utf8"),
    JSON.stringify(["hours", "menu"]));

  const reader = await registeredWorkflow(root);
  reader.setSession("after-new");
  const read = async attempt => (await reader.run({
    action: "verification", task: check.task, step: check.step, attempt,
  })).structuredContent;
  assert.deepEqual((await read()).reference, passed.reference);
  assert.deepEqual((await read(1)).reference, failed.reference);
  assert.deepEqual((await read(2)).reference, missing.reference);

  // A successor can be admitted before its request and result are durable.
  // Reopening it must never present the older pass as the current outcome.
  const base = dirname(dirname(passed.reference.path));
  const nextKey = createHash("sha256").update(JSON.stringify([check.task, check.step, 4])).digest("hex");
  const pending = join(base, nextKey);
  mkdirSync(pending);
  const current = await read();
  assert.equal(current.attempt, 4);
  assert.equal(current.state, "claim-unconfirmed");
  assert.equal(current.nextAction.kind, "hold");
  assert.deepEqual(readdirSync(pending), []);
  assert.equal((await read(3)).receipt.outcome, "passed");
  assert.deepEqual(reader.queries, []);
});

test("bounded check distinguishes terminal signals, oversized output and cancellation", async t => {
  const { root } = fixture(t);
  const run = (step, source, options = {}) => runVerification({ repo: root, task: "session", step,
    command: process.execPath, args: ["-e", source], ...options });
  const gui = await run("adapter failed", 'require("node:fs").writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS, JSON.stringify({version:1,terminal:"failed",diagnosticCode:"fixture-unavailable",observed:{}}));process.stderr.write("private test fixture");setInterval(()=>{},1000)',
    { timeoutMs: 10000 });
  assert.equal(gui.receipt.execution.reason, "adapter-failed");
  assert.equal(gui.receipt.execution.cleanup.state, "settled");
  assert.equal(gui.receipt.outcome, "failed");
  assert.equal(gui.receipt.diagnostic.adapterCode, "fixture-unavailable");
  assert.equal(gui.nextAction.kind, "prepare-prerequisite");
  assert.equal(gui.receipt.diagnostic.output, "raw-output-withheld");
  assert.equal(gui.receipt.execution.stderrBytes, 20);
  assert.equal(JSON.stringify(gui).includes("private test fixture"), false);
  const tooLarge = await run("flood", "process.stdout.write('x'.repeat(4096));setInterval(()=>{},1000)", { outputLimit: 512 });
  assert.equal(tooLarge.receipt.execution.reason, "output-limit");
  assert.equal(tooLarge.receipt.outcome, "incomplete");
  assert.equal(tooLarge.nextAction.kind, "repair-check");
  const cancelled = await run("cancel", "process.exit(41)", { signal: AbortSignal.abort() });
  assert.equal(cancelled.receipt.outcome, "cancelled");
  assert.equal(cancelled.receipt.execution.started, false);
  assert.equal(cancelled.nextAction.kind, "hold");
  assert.equal(cancelled.nextAction.attempt, undefined);
  const denied = await run("denied", 'require("node:fs").writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS,JSON.stringify({version:1,terminal:"failed",diagnosticCode:"access-denied",observed:{}}))');
  assert.equal(denied.nextAction.kind, "hold");
  assert.equal(denied.nextAction.attempt, undefined);
  const refused = await runVerification({ repo: root, task: "session", step: "executable permission denied",
    command: join(root, "product.txt") });
  assert.equal(refused.receipt.execution.launchError, "EACCES");
  assert.equal(refused.receipt.execution.started, false);
  assert.equal(refused.nextAction.kind, "hold");
  for (const diagnosticCode of ["access-denied", "unsupported-feature"]) {
    const args = 'const fs=require("node:fs");fs.writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS,JSON.stringify({version:1,terminal:"complete",diagnosticCode:process.argv[1],observed:{stored:fs.readFileSync("product.txt","utf8")==="before\\n"}}))';
    const ancillary = await runVerification({ repo: root, task: "session", step: `ancillary ${diagnosticCode}`,
      command: process.execPath, args: ["-e", args, diagnosticCode], inputPaths: ["product.txt"], criteria: [{ id: "stored", expected: true }] });
    assert.equal(ancillary.receipt.outcome, "passed");
    assert.equal(ancillary.receipt.diagnostic.adapterCode, diagnosticCode);
    assert.equal(ancillary.nextAction.kind, "reuse");
  }
  const timed = await run("timeout", "setInterval(()=>{},1000)", { timeoutMs: 100 });
  assert.equal(timed.receipt.execution.reason, "timeout");
  assert.equal(timed.receipt.outcome, "incomplete");
});

test("concurrent check admissions settle one existing claim and keep later attempts separate", async t => {
  const { root } = fixture(t);
  const request = { repo: root, task: "session", step: "one writer", command: process.execPath,
    args: ["-e", "setTimeout(()=>{},200)"] };
  const running = runVerification(request);
  await assert.rejects(runVerification({ ...request, attempt: 2 }), /previous attempt has no confirmed cleanup/);
  const [first, second] = await Promise.all([running, runVerification(request)]);
  assert.equal(first.reused, false); assert.equal(second.reused, true);
  assert.equal(second.state, "settlement-unconfirmed");
  assert.equal(second.nextAction.kind, "hold");
  assert.equal(second.nextAction.attempt, undefined);
  assert.equal(first.receipt.scope, "process-exit-only");
  assert.match(first.nextAction.message, /process-exit check/);
  const next = await runVerification({ ...request, attempt: 2 });
  assert.notEqual(next.reference.path, first.reference.path);
  assert.deepEqual(inspectVerification(root, request).reference, first.reference);
});

test("workflow observers bind to their originating context and publish only new owner records", async t => {
  const { root, request } = fixture(t);
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  const events = [], callbacks = [];
  let tool;
  register({ registerTool: value => { tool = value; }, registerCommand() {}, on() {}, events: {
    on: () => () => {}, emit(name, binding) {
      assert.equal(name, "pi.task-history.v1.bind");
      assert.equal(binding.owner, "principal"); assert.equal(binding.cwd, root);
      callbacks.push(binding.accept);
      binding.accept(event => { events.push(event); throw Error("projection offline"); });
    },
  } });
  const ctx = { cwd: root, isProjectTrusted: () => true, sessionManager: { getSessionId: () => "original" } };
  const call = async args => (await tool.execute("fixture", args, undefined, () => {}, ctx)).structuredContent;
  const prepared = await call({ ...request, action: "prepare" });
  assert.equal(prepared.state, "prepared");
  assert.deepEqual(events, [{ version: 1, owner: "principal", kind: "workflow", operationId: prepared.operation_id,
    state: "observed", label: "Workflow bookkeeping requested" },
    { version: 1, owner: "principal", kind: "workflow", operationId: prepared.operation_id,
    state: "prepared", label: "Workflow operation prepared", evidence: { type: "operation", id: prepared.operation_id } }]);
  callbacks[0](() => { throw Error("late registration"); });
  await call({ ...request, action: "prepare" });
  await call({ action: "status", operationId: prepared.operation_id });
  assert.equal(events.length, 2);
  assert.equal(callbacks.length, 2);
});

test("a task change after admission cannot move an in-flight prepared receipt to the newly selected task", async t => {
  const { root, request } = fixture(t);
  const { default: register } = await import(extensionFixtureUrl(new URL("../../extensions/workflow.ts", import.meta.url)));
  const original = [], other = [];
  let selected = original, tool, release, sawOpening;
  const opening = new Promise(resolve => { sawOpening = resolve; });
  const persisted = new Promise(resolve => { release = resolve; });
  register({ registerTool: value => { tool = value; }, registerCommand() {}, on() {}, events: {
    on: () => () => {}, emit(name, binding) {
      assert.equal(name, "pi.task-history.v1.bind");
      const target = selected;
      binding.accept(event => {
        target.push(event);
        if (event.state === "observed") { sawOpening(event.operationId); return persisted; }
      });
    },
  } });
  const ctx = { cwd: root, isProjectTrusted: () => true, sessionManager: { getSessionId: () => "session" } };
  const operation = tool.execute("attempt", { ...request, action: "prepare" }, undefined, () => {}, ctx);
  const id = await opening;
  try {
    assert.throws(() => inspectOperation(root, { operationId: id }));
    selected = other;
  } finally { release(); }
  const response = await operation;
  assert.equal(response.structuredContent.operation_id, id);
  assert.deepEqual(original.map(({ operationId, state }) => [operationId, state]), [[id, "observed"], [id, "prepared"]]);
  assert.deepEqual(other, []);
});

test("an output check must distinguish the requested file from a plausible wrong export when its criterion requires a counterexample", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  writeFileSync(join(root, "orders.json"), JSON.stringify({ status: "ok", rows: [{ id: 17, total: 35 }] }));
  const criterion = { id: "amount", expected: true, requirement: "The exported order 17 has the agreed total of 35",
    counterexample: { scenario: "The export reports success but retains the old total of 30", expected: false } };
  const prepare = async (step, item) => (await h.run({ action: "prepare", ...request,
    expectedCandidate: observeCandidate(root), step, criteria: [item] })).structuredContent;
  for (const counterexample of [
    { scenario: "A wrong order", expected: true },
    { scenario: "  ", expected: false },
  ]) {
    const refused = await prepare("invalid counterexample", { ...criterion, counterexample });
    assert.equal(refused.state, "refused");
    assert.match(refused.error, /counterexample/);
  }
  const initial = await prepare("review order export", criterion);
  const args = mode => ["-e", `
    const fs = require("node:fs");
    const actual = JSON.parse(fs.readFileSync("orders.json", "utf8"));
    const wrong = { ...actual, rows: [{ id: 17, total: 30 }] };
    const mode = process.argv[1];
    const inspect = value => mode === "status-only" ? value.status === "ok" :
      value.rows.some(row => row.id === 17 && row.total === 35);
    const sample = mode === "wrong-product" ? wrong : actual;
    const record = { version: 1, observed: { amount: inspect(sample) } };
    if (mode !== "missing") record.counterexamples = { amount: inspect(wrong) };
    fs.writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS, JSON.stringify(record));
  `, mode];
  const check = mode => runVerification({ repo: root, task: request.task, step: mode, forOperationId: initial.operation_id,
    criteria: [{ id: "amount", expected: true }], command: process.execPath, args: args(mode) });
  const finish = async (operation, reference) => {
    h.setNative(settled(operation.operation_id, root));
    const result = (await h.run({ action: "complete", operationId: operation.operation_id, disposition: "succeeded", evidence: [reference] })).structuredContent;
    return result.coverage.criteria[0];
  };

  const weak = await check("status-only");
  assert.deepEqual(weak.request.criteria[0].counterexample, criterion.counterexample);
  assert.equal(weak.receipt.outcome, "incomplete");
  assert.deepEqual(weak.receipt.observations[0], { id: "amount", state: "unobserved", observed: true,
    counterexample: { state: "failed", observed: true } });
  assert.equal(weak.nextAction.kind, "repair-check");
  assert.match(weak.nextAction.message, /counterexample/);
  const weakCoverage = await finish(initial, weak.reference);
  assert.equal(weakCoverage.state, "inconclusive");
  assert.deepEqual(weakCoverage.verificationReads, [{ action: "verification", repo: root, task: request.task, step: "status-only", attempt: 1 }]);

  const missing = await check("missing");
  assert.equal(missing.receipt.outcome, "incomplete");
  assert.equal(missing.receipt.observations[0].counterexample.state, "unobserved");
  assert.equal(missing.nextAction.kind, "repair-check");
  const broken = await check("wrong-product");
  assert.equal(broken.receipt.outcome, "failed");
  assert.equal(broken.receipt.observations[0].state, "failed");
  const strong = await check("contents");
  assert.equal(strong.receipt.outcome, "passed");
  assert.equal((await finish(await prepare("same material claim", criterion), strong.reference)).state, "supported");
  const changed = { ...criterion, counterexample: { ...criterion.counterexample, scenario: "Another order has a total of 35" } };
  const incompatible = await finish(await prepare("changed false positive", changed), strong.reference);
  assert.equal(incompatible.state, "inconclusive");
  assert.equal(incompatible.verificationReads, undefined);
});

test("reopen the saved record after a rejected edit, even when both editors report the expected error", async t => {
  const { root, request } = fixture(t);
  writeFileSync(join(root, "editor.cjs"), `
    const fs = require("node:fs");
    const [store, version, action, title] = process.argv.slice(2);
    if (action === "open") {
      process.stdout.write(JSON.parse(fs.readFileSync(store, "utf8")).title);
    } else if (!title.trim()) {
      if (version === "faulty") fs.writeFileSync(store, JSON.stringify({ title }));
      process.stderr.write("A title is required");
      process.exitCode = 2;
    } else {
      fs.writeFileSync(store, JSON.stringify({ title }));
      process.stdout.write("Saved");
    }
  `);
  const check = version => runVerification({ repo: root, task: request.task, step: `edit with ${version} editor`,
    inputPaths: ["editor.cjs"], command: process.execPath, criteria: [{ id: "retained", expected: true,
      counterexample: { scenario: "The editor writes the invalid edit before returning the validation error", expected: false } }],
    args: ["-e", `
      const { spawnSync } = require("node:child_process");
      const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
      const report = process.env.PRINCIPAL_CHECK_OBSERVATIONS;
      function exercise(sample, version) {
        const store = path.join(path.dirname(report), sample + ".json");
        fs.writeFileSync(store, JSON.stringify({ title: "Original" }));
        const run = (...args) => spawnSync(process.execPath, ["editor.cjs", store, version, ...args], { encoding: "utf8" });
        const accepted = run("edit", "New title");
        assert.equal(accepted.status, 0); assert.equal(accepted.stdout, "Saved");
        const rejected = run("edit", "");
        assert.equal(rejected.status, 2); assert.equal(rejected.stderr, "A title is required");
        const reopened = run("open");
        assert.equal(reopened.status, 0);
        return reopened.stdout === "New title";
      }
      fs.writeFileSync(report, JSON.stringify({ version: 1,
        observed: { retained: exercise("actual", process.argv[1]) },
        counterexamples: { retained: exercise("wrong", "faulty") } }));
    `, version] });
  const guarded = await check("guarded"), faulty = await check("faulty");
  assert.equal(guarded.receipt.outcome, "passed");
  assert.equal(faulty.receipt.execution.reason, "exit-zero");
  assert.equal(faulty.receipt.outcome, "failed");
  assert.equal(faulty.receipt.observations[0].observed, false);
  assert.equal(faulty.receipt.observations[0].counterexample.state, "satisfied");
});

test("a scoped assessment reuses supplied evidence and handles the opposite conclusion without research", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  writeFileSync(join(root, "trials.csv"), "before,after\n100,90\n200,180\n");
  const criterion = { id: "all-improved", requirement: "Every supplied pair improves by at least ten percent",
    expected: true, scope: "declared-inputs", dependencies: ["trials.csv"],
    counterexample: { scenario: "One supplied pair becomes slower", expected: false } };
  const prepared = (await h.run({ action: "prepare", ...request, expectedCandidate: observeCandidate(root), criteria: [criterion] })).structuredContent;
  const check = { repo: root, task: request.task, step: "assess supplied trials", forOperationId: prepared.operation_id,
    command: process.execPath, inputPaths: ["trials.csv"], scope: "declared-inputs", criteria: [{ id: criterion.id, expected: true }],
    args: ["-e", `
      const fs = require("node:fs");
      const rows = fs.readFileSync("trials.csv", "utf8").trim().split(/\\r?\\n/).slice(1)
        .map(line => line.split(",").map(Number));
      const improves = pairs => pairs.length > 0 && pairs.every(([before, after]) => (before - after) * 10 >= before);
      const wrong = [[100, 105], ...rows.slice(1)];
      fs.writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS, JSON.stringify({version:1,
        observed: {"all-improved": improves(rows)}, counterexamples: {"all-improved": improves(wrong)}}));
    `] };
  const receipt = await runVerification(check);
  assert.equal(receipt.receipt.outcome, "passed");
  h.setNative(settled(prepared.operation_id, root));
  const completed = (await h.run({ action: "complete", operationId: prepared.operation_id,
    disposition: "succeeded", evidence: [receipt.reference] })).structuredContent;
  assert.equal(completed.coverage.state, "supported");
  assert.equal(completed.coverage.approval, false);
  const recalled = await runVerification(check);
  assert.equal(recalled.reused, true);
  assert.deepEqual(recalled.reference, receipt.reference);
  writeFileSync(join(root, "trials.csv"), "before,after\n100,125\n");
  const now = (await h.run({ action: "status", operationId: prepared.operation_id })).structuredContent;
  assert.equal(now.coverage.criteria[0].state, "inconclusive");
  const [read] = now.coverage.criteria[0].verificationReads;
  assert.deepEqual(read, { action: "verification", repo: root, task: request.task, step: check.step, attempt: 1 });
  const stale = (await h.run(read)).structuredContent;
  assert.equal(stale.nextAction.kind, "recheck-affected");
});

test("native completion retains criteria, exact check references and unobserved judgments across recall", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  const criteria = [
    { id: "editable", requirement: "The produced item can be edited", expected: true, fresh: true },
    { id: "choice", requirement: "The user selected a presentation" },
    { id: "extra", requirement: "Optional secondary output", expected: "ready", required: false },
  ];
  const prepared = (await h.run({ ...request, action: "prepare", criteria })).structuredContent;
  assert.equal(prepared.coverage.state, "unverified");
  const changed = await h.run({ ...request, action: "prepare", criteria: [] });
  assert.equal(changed.isError, true);
  const checked = await runVerification({ repo: root, task: request.task, step: "editable output", forOperationId: prepared.operation_id,
    command: process.execPath, criteria: [{ id: "editable", expected: true }],
    args: ["-e", 'require("node:fs").writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS,JSON.stringify({version:1,observed:{editable:true}}))'] });
  h.setNative(settled(prepared.operation_id, root));
  const complete = (await h.run({ action: "complete", operationId: prepared.operation_id, disposition: "succeeded", evidence: [checked.reference] })).structuredContent;
  assert.equal(complete.completionValid, true);
  assert.equal(complete.coverage.state, "partial");
  assert.equal(complete.coverage.required, 2);
  assert.equal(complete.coverage.supported, 1);
  assert.equal(complete.coverage.criteria.find(c => c.id === "choice").state, "judgment-needed");
  assert.equal(complete.approval, false);
  const history = (await h.run({ action: "status", operationId: prepared.operation_id })).structuredContent;
  assert.deepEqual(history.coverage, complete.coverage);
  writeFileSync(join(root, "product.txt"), "updated\n");
  const stale = (await h.run({ action: "status", operationId: prepared.operation_id })).structuredContent;
  assert.equal(stale.coverage.supported, 0);
  assert.equal(stale.coverage.criteria.find(c => c.id === "editable").state, "inconclusive");
});

test("only bound exhaustive file scopes may support an independent later candidate", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  const criterion = { id: "stored", requirement: "The saved artifact contains the recorded value", expected: true,
    scope: "declared-inputs", dependencies: ["product.txt"] };
  const first = (await h.run({ ...request, action: "prepare", criteria: [criterion] })).structuredContent;
  const check = { repo: root, task: request.task, step: "read artifact", forOperationId: first.operation_id,
    scope: "declared-inputs", command: process.execPath, criteria: [{ id: "stored", expected: true }],
    args: ["-e", 'const fs=require("node:fs"); fs.writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS, JSON.stringify({version:1,observed:{stored:fs.readFileSync("product.txt","utf8")==="before\\n"}}))'] };
  await assert.rejects(runVerification({ ...check, inputPaths: ["other.txt"] }), /dependencies/);
  const saved = await runVerification({ ...check, inputPaths: ["product.txt"] });
  assert.equal(saved.receipt.outcome, "passed");
  writeFileSync(join(root, "unrelated.txt"), "An unrelated file changed.\n");
  const finish = async (step, item) => {
    const current = (await h.run({ action: "prepare", ...request, step, expectedCandidate: observeCandidate(root),
      criteria: [item] })).structuredContent;
    h.setNative(settled(current.operation_id, root));
    return (await h.run({ action: "complete", operationId: current.operation_id, disposition: "succeeded", evidence: [saved.reference] })).structuredContent;
  };
  assert.equal((await finish("current scoped criterion", criterion)).coverage.state, "supported");
  assert.equal((await finish("different requirement", { ...criterion, requirement: "The artifact survived restart" })).coverage.state, "unverified");
  writeFileSync(join(root, "product.txt"), "changed artifact\n");
  assert.equal((await finish("changed input", criterion)).coverage.state, "unverified");
});

test("whole-worktree evidence retains its original requirement when a short criterion ID is reused", async t => {
  const { root, request } = fixture(t), h = await registeredWorkflow(root);
  const criterion = { id: "stored", expected: true, requirement: "The current file contains the saved value" };
  const prepare = async (step, requirement, extra) => (await h.run({ ...request, action: "prepare", step,
    expectedCandidate: observeCandidate(root), criteria: [{ ...criterion, requirement, ...extra }] })).structuredContent;
  const initial = await prepare("read value", criterion.requirement);
  const command = { repo: root, task: request.task, command: process.execPath,
    criteria: [{ id: "stored", expected: true }],
    args: ["-e", 'const fs=require("node:fs"); fs.writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS,JSON.stringify({version:1,observed:{stored:fs.readFileSync("product.txt","utf8")==="before\\n"}}))'] };
  const bound = await runVerification({ ...command, step: "file observation", forOperationId: initial.operation_id });
  const unbound = await runVerification({ ...command, step: "ad hoc observation" });
  async function finish(step, requirement, check, extra) {
    const current = await prepare(step, requirement, extra);
    h.setNative(settled(current.operation_id, root));
    return (await h.run({ action: "complete", operationId: current.operation_id, disposition: "succeeded", evidence: [check.reference] })).structuredContent;
  }
  assert.equal((await finish("same meaning", criterion.requirement, bound)).coverage.state, "supported");
  assert.equal((await finish("stricter meaning", "The value survives a server restart", bound)).coverage.state, "unverified");
  assert.equal((await finish("unbound meaning", criterion.requirement, unbound)).coverage.state, "unverified");

  // Recreate the previous on-disk shape, which recorded the source operation
  // and its intact check receipt but omitted per-criterion meaning digests.
  const requestFile = join(dirname(bound.reference.path), "request.json");
  const legacy = JSON.parse(readFileSync(requestFile, "utf8"));
  delete legacy.contracts;
  const result = JSON.parse(readFileSync(bound.reference.path, "utf8"));
  result.requestDigest = createHash("sha256").update(JSON.stringify(legacy)).digest("hex");
  writeFileSync(requestFile, JSON.stringify(legacy) + "\n");
  writeFileSync(bound.reference.path, JSON.stringify(result) + "\n");
  const previous = { reference: reference(bound.reference.path) };
  assert.equal((await finish("same earlier record", criterion.requirement, previous)).coverage.state, "supported");
  assert.equal((await finish("changed earlier meaning", "The value survives a server restart", previous)).coverage.state, "unverified");
  const bytes = readFileSync(bound.reference.path);
  const stronger = await finish("new check needs a counterexample", criterion.requirement, previous,
    { counterexample: { scenario: "A stale file still contains the prior value", expected: false } });
  assert.equal(stronger.coverage.state, "unverified");
  assert.equal(stronger.coverage.criteria[0].verificationReads, undefined);
  assert.deepEqual(readFileSync(bound.reference.path), bytes);
});

test("standalone checks retain declared file evidence on the current platform", async t => {
  const root = mkdtempSync(join(tmpdir(), "principal-standalone-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["-C", root, "init", "-q"]);
  const path = join(root, "product.txt");
  writeFileSync(path, "value");
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "base"]);
  const check = { repo: root, task: "portable", step: "read value",
    command: process.execPath, inputPaths: ["product.txt"], criteria: [{ id: "stored", expected: true }],
    args: ["-e", 'const fs=require("node:fs");fs.writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS,JSON.stringify({version:1,observed:{stored:fs.readFileSync("product.txt","utf8")==="value"}}))'] };
  if (process.platform !== "linux") {
    await assert.rejects(runVerification({ ...check, forOperationId: "principal:" + "a".repeat(64) }), /requires Linux candidate identity/);
    assert.equal(existsSync(join(root, ".principal", "verification")), false);
  }
  const result = await runVerification(check);
  assert.equal(result.receipt.outcome, "passed");
  assert.equal(result.applicability.source, process.platform === "linux" ? "matching" : "unavailable-on-platform");
  assert.equal(result.request.inputs[0].sha256, createHash("sha256").update("value").digest("hex"));
  assert.equal(result.applicability.inputs, "matching");
  assert.equal(result.receipt.execution.cleanup.scope, process.platform === "win32" ? "direct-child" : "owned-process-group");
  writeFileSync(path, "changed");
  const recalled = await runVerification(check);
  assert.equal(recalled.reused, true);
  assert.equal(recalled.applicability.inputs, "changed-or-unobserved");
  assert.deepEqual(recalled.reference, result.reference);
});

test("declared evidence keeps checker failure separate from a successful observation", async t => {
  const criterion = { id: "public", requirement: "The notice was presented to the public", expected: true };
  const secondary = { id: "format", requirement: "The optional format matches", expected: true, required: false };
  const cases = [
    { label: "fast checker reports terminal failure", terminal: "failed", format: true, supported: 0 },
    { label: "missing sibling observation", supported: 1 },
    { label: "ordinary sibling mismatch", format: false, supported: 1 },
    { label: "older failed receipt with ambiguous termination", legacy: true, terminal: "failed", format: false, supported: 0 },
    { label: "older passing receipt", legacy: true, format: true, supported: 1 },
  ];
  for (const { label, terminal, format, legacy, supported } of cases) await t.test(label, async sub => {
    const { root, request } = fixture(sub);
    const host = await registeredWorkflow(root);
    const prepared = (await host.run({ ...request, action: "prepare", criteria: [criterion, secondary] })).structuredContent;
    const report = { version: 1, observed: { public: true, format }, terminal };
    const checked = await runVerification({
      repo: root, task: request.task, step: "inspect published notice", forOperationId: prepared.operation_id,
      command: process.execPath, criteria: [criterion, secondary],
      args: ["-e", 'require("node:fs").writeFileSync(process.env.PRINCIPAL_CHECK_OBSERVATIONS, process.argv[1])', JSON.stringify(report)],
    });
    const file = checked.reference.path;
    if (legacy) {
      // v1 receipts from quickly exiting adapters retained the native exit and outcome, but no failure marker.
      const record = JSON.parse(readFileSync(file, "utf8"));
      delete record.adapterReportedFailure;
      record.execution.reason = "exit-zero";
      writeFileSync(file, JSON.stringify(record) + "\n");
      if (record.outcome === "failed") {
        const legacyRead = inspectVerification(root, { task: request.task, step: "inspect published notice" });
        assert.equal(legacyRead.nextAction.kind, "inspect-result");
      }
    }
    const bytesBefore = readFileSync(file);
    host.setNative(settled(prepared.operation_id, root));
    const completion = (await host.run({ action: "complete", operationId: prepared.operation_id,
      disposition: "succeeded", evidence: [reference(file)] })).structuredContent;
    assert.equal(completion.coverage.supported, supported);
    assert.equal(completion.coverage.criteria.find(row => row.id === "public").state,
      supported ? "supported" : "inconclusive");
    if (format === false) assert.equal(completion.coverage.criteria.find(row => row.id === "format").state, "failed");
    const readBack = (await host.run({ action: "status", operationId: prepared.operation_id })).structuredContent;
    assert.deepEqual(readBack.coverage, completion.coverage);
    assert.deepEqual(readFileSync(file), bytesBefore);
  });
});

test("current independent review requires the matching retained native final and candidate", async t => {
  const { reviewEvidence } = await import("../../scripts/delivery-state.mjs");
  const { root, request } = fixture(t);
  const review = { ...request, phase: "review" };
  const op = prepareOperation(root, review);
  const text = "Verdict: APPROVE\nScope: source review.\n";
  const runtime = settled(op.operation_id, root, text);
  writeFileSync(op.reportPath, text);
  completeOperation(root, { ...review, disposition: "succeeded" }, runtime);
  const inspect = (hash = runtime.runtime.final.sha256) => reviewEvidence(root, op.operation_id, "APPROVE", hash);
  assert.equal(inspect().state, "supported");
  assert.equal(inspect("0".repeat(64)).state, "unverified");
  writeFileSync(join(root, "product.txt"), "new candidate");
  assert.equal(inspect().state, "unverified");
});

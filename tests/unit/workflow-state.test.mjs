import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { CandidateIdentityError, PrepareInputError, observeCandidate, observeSnapshot, prepareOperation, inspectOperation, completeOperation, retryOperation, observeOperationResult, registerCandidateObserver, inspectOwnedOperation, inspectHistoricalOperation, observeHistoricalOperation } from "../../scripts/workflow-state.mjs";
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
  const request = { action: "prepare", task: "workshop-desk-v1-stage1", step: "build", phase: "build", expectedCandidate: snapshot.candidate };
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
  await assertNotInputRecovery({ ...request, expectedCandidate: observeCandidate(root) }, /operation candidate changed/);
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
  const request = { action: "prepare", task: "workshop-desk-v1-stage1", step: "build", phase: "build", expectedCandidate: snapshot.candidate };
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
  assert.throws(() => completeOperation(root, complete, settled(first.operation_id, root)), /existing report differs/);
  assert.equal(readFileSync(first.reportPath, "utf8"), "Original report preserved.\n");
  assert.equal(inspectOperation(root, request).state, "prepared");
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
  assert.equal(prepared.isError, undefined);
  assert.equal(prepared.structuredContent.owner.cwd, nested);
  assert.equal(prepared.structuredContent.root, root);
  assert.equal(existsSync(join(nested, ".git")), false);
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

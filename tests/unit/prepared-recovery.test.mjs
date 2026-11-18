import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { observeCandidate, prepareOperation, completeOperation, inspectOperation, inspectRecoveryRecord, inspectRecoveryOperation } from "../../scripts/workflow-state.mjs";
import { recoverPreparedOperation } from "../../scripts/prepared-recovery.mjs";
import { reference } from "../../scripts/progress-artifacts.mjs";

function fixture(t, contextPaths) {
  const root = mkdtempSync(join(tmpdir(), "principal-recovery-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q"); writeFileSync(join(root, "product.txt"), "before\n"); git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "baseline");
  mkdirSync(join(root, ".principal")); writeFileSync(join(root, ".principal/.gitignore"), "*\n");
  const authority = join(root, ".principal/intent.md"); writeFileSync(authority, "Implement the selected task.\n");
  const owner = { sessionId: "old-parent", cwd: root };
  const prepared = prepareOperation(root, { task: "workshop-desk", step: "backend", phase: "build", owner, expectedCandidate: observeCandidate(root), inputPaths: [authority], contextPaths });
  const source = inspectRecoveryRecord(root, { operationId: prepared.operation_id });
  const legacy = () => { const record = JSON.parse(readFileSync(source.sourceReference.path, "utf8")); record.implementation[0].sha256 = "f".repeat(64); writeFileSync(source.sourceReference.path, JSON.stringify(record)); };
  let sessionId = "new-parent", queries = 0, observation;
  const ctx = { cwd: root, sessionManager: { getSessionId: () => sessionId } };
  const pi = { events: { emit(name, request) {
    assert.equal(name, "pi-daddy:operation-recovery:v1"); queries++;
    Promise.resolve().then(async () => {
      await request.authorize();
      const selected = typeof observation === "function" ? await observation(request) : observation;
      request.reply({ version: 1, requestId: request.requestId, sessionId: request.sessionId, cwd: request.cwd, source: request.source, qualified: true, observation: selected });
    }).catch(error => request.reply({ version: 1, requestId: request.requestId, sessionId: request.sessionId, cwd: request.cwd, source: request.source, qualified: false, reason: error.message }));
  } } };
  const noStart = () => ({ admission: "present", result: "present", noStartProven: true, cleanup: { state: "not-started" },
    operation: { operationId: prepared.operation_id, executionId: "exec-old", cwd: root, state: "not-started", runtime: { cleanup: { state: "not-started" } } },
    artifact: { version: 1, producer: "pi-daddy", owner, operationId: prepared.operation_id, executionId: "exec-old", manifest: { path: join(root, ".pi/old-operation.json"), sha256: "a".repeat(64), bytes: 123 } } });
  const call = (args = {}) => recoverPreparedOperation(pi, ctx, { action: "recover", operationId: prepared.operation_id, ...args });
  return { root, authority, owner, prepared, source, legacy, ctx, pi, noStart, call,
    setObservation: value => { observation = value; }, setSession: value => { sessionId = value; }, queries: () => queries };
}
function native(prepared, root, text = "Delivered backend.\n") {
  const final = { state: "complete", sessionId: "old-child", messageId: "final", leafId: "final", sha256: createHash("sha256").update(text).digest("hex") };
  return { operationId: prepared.operation_id, executionId: "exec-old", cwd: root, state: "settled", finalObservation: { ...final, text },
    runtime: { work: "succeeded", final, cleanup: { state: "settled", executionId: "exec-old" } } };
}

function deliveredHistory(f) {
  const runtime = native(f.prepared, f.root), manifest = join(f.root, ".principal/producer-result.json");
  writeFileSync(manifest, JSON.stringify(runtime));
  return { admission: "present", result: "present", noStartProven: false, cleanup: { state: "settled" },
    operation: { ...runtime, finalObservation: undefined }, final: runtime.finalObservation,
    artifact: { version: 1, producer: "pi-daddy", owner: f.owner, operationId: f.prepared.operation_id, executionId: runtime.executionId,
      manifest: { ...reference(manifest), bytes: readFileSync(manifest).length } } };
}

test("after /new a pre-retention report collision offers read-only inspection and explicit idempotent historical retention", async t => {
  const f = fixture(t); f.legacy();
  writeFileSync(join(f.root, "product.txt"), "delivered before previous completion failed\n");
  writeFileSync(f.prepared.reportPath, "A separately authored report.\n");
  const before = readFileSync(f.source.sourceReference.path), observation = deliveredHistory(f); f.setObservation(observation);
  const inspected = await f.call();
  assert.equal(inspected.state, "historical"); assert.equal(inspected.historical, true); assert.equal(inspected.completionValid, false);
  assert.equal(inspected.administrativeWrites, false); assert.equal(inspected.resultRetained, false);
  assert.equal(inspected.final.text, observation.final.text); assert.equal(inspected.retainArguments.mode, "retain");
  assert.deepEqual(readdirSync(f.source.path), ["request.json"], "default inspection writes no historical record");
  const [retained, repeated] = await Promise.all([f.call(inspected.retainArguments), f.call(inspected.retainArguments)]);
  assert.deepEqual(retained.report, repeated.report); assert.equal(repeated.reused, true);
  assert.equal(retained.resultRetained, true); assert.equal(retained.completionValid, false); assert.equal(retained.approval, false);
  assert.equal(retained.applicability, "not-established"); assert.equal(retained.sourceRecovery, undefined);
  assert.equal(retained.delegationArguments, undefined); assert.equal(retained.output, undefined);
  assert.deepEqual(retained.observedCandidate, inspected.currentCandidate);
  assert.equal(readFileSync(retained.report.path, "utf8"), observation.final.text);
  assert.equal(retained.report.sha256, observation.final.sha256);
  assert.equal(readFileSync(retained.authoredReport.path, "utf8"), "A separately authored report.\n");
  assert.deepEqual(readdirSync(f.source.path).sort(), ["historical-result.json", "request.json"]);
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 1);
  assert.deepEqual(readFileSync(f.source.sourceReference.path), before);
  f.setSession("third-parent");
  const recalled = await f.call(); assert.equal(recalled.reused, true); assert.deepEqual(recalled.report, retained.report);
  writeFileSync(join(f.root, "product.txt"), "later authorized edit\n");
  const later = await f.call(); assert.deepEqual(later.observedCandidate, retained.observedCandidate);
  assert.notEqual(later.currentCandidate.id, later.observedCandidate.id); assert.equal(later.completionValid, false);
  const review = prepareOperation(f.root, { task: "workshop-desk", step: "fresh-review", phase: "review", owner: { sessionId: "third-parent", cwd: f.root },
    expectedCandidate: later.currentCandidate, inputs: [later.report, later.authoredReport] });
  assert.equal(review.state, "prepared"); assert.equal(review.reviewBinding, undefined);
  assert.match(later.nextAction, /does not satisfy a bound work-map/);
});

test("historical retention binds the selected source, producer and current files and preserves genuine refusals", async t => {
  for (const kind of ["source", "producer", "candidate", "authority", "foreign-owner", "final", "cleanup", "runtime-cleanup", "unsafe-report", "occupied-final", "unignored"]) {
    const f = fixture(t); f.legacy(); writeFileSync(f.prepared.reportPath, "Authored details.\n");
    const observation = deliveredHistory(f); f.setObservation(observation);
    const inspected = await f.call(), args = structuredClone(inspected.retainArguments);
    if (kind === "source") args.sourceReference.sha256 = "a".repeat(64);
    if (kind === "producer") args.producerReference.sha256 = "a".repeat(64);
    if (kind === "candidate") writeFileSync(join(f.root, "product.txt"), "other current change\n");
    if (kind === "authority") writeFileSync(f.authority, "different required authority\n");
    if (kind === "foreign-owner") observation.artifact.owner = { ...f.owner, sessionId: "foreign" };
    if (kind === "final") observation.final.text = "invented replacement";
    if (kind === "cleanup") observation.cleanup.state = "unknown";
    if (kind === "runtime-cleanup") observation.operation.runtime.cleanup.executionId = "different-execution";
    if (kind === "unsafe-report") { rmSync(f.prepared.reportPath); symlinkSync(join(f.root, "product.txt"), f.prepared.reportPath); }
    if (kind === "occupied-final") writeFileSync(join(f.prepared.reportPath, "..", "build.native-final.md"), "Unrelated evidence.\n");
    if (kind === "unignored") writeFileSync(join(f.root, ".principal/.gitignore"), "*\n!workflow/\n!workflow/**/\n!workflow/**/historical-result.json\n");
    await assert.rejects(f.call(args), /changed|exact|identity|settled|symlink|ignored|candidate/i, kind);
    assert.equal(existsSync(join(f.source.path, "historical-result.json")), false, kind);
    assert.equal(existsSync(join(f.source.path, "result.json")), false, kind);
    assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 1);
  }
});

test("historical retention rechecks access, cancellation and context before writes, and corruption is never reused", async t => {
  for (const kind of ["revoked", "aborted", "session", "manifest", "retained-final", "retained-record"]) {
    const f = fixture(t); f.legacy(); const observation = deliveredHistory(f); f.setObservation(observation);
    const inspected = await f.call(), controller = new AbortController(); let allowed = true;
    if (["retained-final", "retained-record"].includes(kind)) {
      const result = await f.call(inspected.retainArguments);
      writeFileSync(kind === "retained-final" ? result.report.path : result.historicalRecord.path, "altered\n");
    } else f.setObservation(() => {
      if (kind === "revoked") allowed = false;
      if (kind === "aborted") controller.abort();
      if (kind === "session") f.setSession("changed-during-query");
      if (kind === "manifest") writeFileSync(observation.artifact.manifest.path, "changed producer record\n");
      return observation;
    });
    await assert.rejects(recoverPreparedOperation(f.pi, f.ctx, inspected.retainArguments, controller.signal,
      () => { if (!allowed) throw Error("Access revoked"); }), /changed|aborted|revoked|JSON|Unexpected/i);
    assert.equal(existsSync(join(f.source.path, "result.json")), false);
    assert.equal(existsSync(join(f.source.path, "completion.json")), false);
    if (!["retained-final", "retained-record"].includes(kind)) assert.equal(existsSync(join(f.source.path, "historical-result.json")), false);
  }
});

test("completed and retained old work is reused after update and new session without another execution", async t => {
  for (const retainedOnly of [false, true]) {
    const f = fixture(t); writeFileSync(join(f.root, "product.txt"), "delivered\n");
    const completed = completeOperation(f.root, { operationId: f.prepared.operation_id, disposition: "succeeded" }, native(f.prepared, f.root));
    if (retainedOnly) rmSync(join(f.source.path, "completion.json"));
    f.legacy(); const before = readFileSync(f.source.sourceReference.path);
    assert.throws(() => inspectOperation(f.root, { operationId: f.prepared.operation_id }), /implementation changed/);
    const result = await f.call();
    assert.equal(result.state, "reused"); assert.equal(result.historical, true); assert.equal(result.completionValid, false);
    assert.deepEqual(result.report, completed.report); assert.equal(result.sourceRecovery.operationId, f.prepared.operation_id);
    assert.equal(result.delegationArguments, undefined); assert.equal(f.queries(), 0);
    assert.equal((await f.call({ mode: "continue" })).state, "reused");
    assert.deepEqual(readFileSync(f.source.sourceReference.path), before);
    assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 1);
  }
});

test("positive no-start recovery creates one linked current-owner successor and repeats idempotently", async t => {
  const f = fixture(t); f.legacy(); f.setObservation(f.noStart());
  const before = readFileSync(f.source.sourceReference.path), inspected = await f.call();
  assert.equal(inspected.state, "ready-to-continue");
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 1);
  const recovered = await f.call(inspected.continueArguments);
  assert.equal(recovered.state, "recovered"); assert.equal(recovered.successor.attempt, 2);
  assert.equal(recovered.successor.owner.sessionId, "new-parent");
  assert.notEqual(recovered.successor.operation_id, f.prepared.operation_id);
  assert.equal(recovered.delegationArguments.operation_id, recovered.successor.operation_id);
  const again = await f.call(inspected.continueArguments);
  assert.equal(again.reused, true); assert.equal(again.successor.operation_id, recovered.successor.operation_id);
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 2);
  assert.deepEqual(readFileSync(f.source.sourceReference.path), before);
  f.setObservation({ admission: "absent", result: "absent", cleanup: { state: "unknown" }, noStartProven: false });
  const lost = await f.call(inspected.continueArguments);
  assert.equal(lost.delegationArguments, undefined, "lost original fence cannot authorize a prepared successor");
});

test("completed successor is reused before comparing the original baseline or demanding old proof", async t => {
  const f = fixture(t); f.legacy(); f.setObservation(f.noStart());
  const inspected = await f.call(), recovered = await f.call(inspected.continueArguments);
  writeFileSync(join(f.root, "product.txt"), "successor delivered\n");
  completeOperation(f.root, { operationId: recovered.successor.operation_id, disposition: "succeeded" }, native(recovered.successor, f.root));
  const count = f.queries(); f.setSession("third-parent");
  const done = await f.call();
  assert.equal(done.state, "reused"); assert.equal(done.successor.operation_id, recovered.successor.operation_id);
  assert.equal(done.delegationArguments, undefined); assert.equal(f.queries(), count);
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 2);
});

test("editable context survives old-generation no-start recovery without becoming a prerequisite", async t => {
  const f = fixture(t, ["product.txt"]); f.legacy(); f.setObservation(f.noStart());
  const before = readFileSync(f.source.sourceReference.path);
  const inspected = await f.call(), continued = await f.call(inspected.continueArguments);
  assert.equal(continued.state, "recovered");
  assert.deepEqual(continued.successor.contextPaths, [join(f.root, "product.txt")]);
  assert.deepEqual(continued.successor.inputs, f.prepared.inputs);
  writeFileSync(join(f.root, "product.txt"), "completed implementation\n");
  const done = completeOperation(f.root, { operationId: continued.successor.operation_id, disposition: "succeeded" }, native(continued.successor, f.root));
  assert.equal(done.state, "complete"); assert.equal(done.inputsMatch, true); assert.equal(done.completionValid, true);
  f.setSession("another-new-parent"); f.setObservation({ noStartProven: false, cleanup: { state: "uncertain" } });
  const reused = await f.call();
  assert.equal(reused.state, "reused"); assert.deepEqual(reused.report, done.report);
  assert.deepEqual(reused.successor.contextPaths, continued.successor.contextPaths);
  assert.equal(reused.delegationArguments, undefined);
  assert.deepEqual(readFileSync(f.source.sourceReference.path), before);
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 2);
});

test("absent, active, partial and contradictory execution evidence never allocates a replacement", async t => {
  const cases = [
    { observation: { admission: "absent", result: "absent", cleanup: { state: "unknown" }, noStartProven: false }, state: "uncertain" },
    { observation: { admission: "present", result: "absent", operation: { state: "running" }, cleanup: { state: "unknown" } }, state: "running" },
    { observation: { admission: "present", result: "present", operation: { state: "settled" }, partial: { text: "One file was written." }, cleanup: { state: "settled" } }, state: "historical" },
  ];
  for (const item of cases) {
    const f = fixture(t); f.legacy(); f.setObservation(item.observation);
    const result = await f.call({ mode: "continue" }); assert.equal(result.state, item.state);
    assert.equal(result.continueArguments, undefined); assert.equal(result.delegationArguments, undefined);
    assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 1);
  }
  const f = fixture(t); f.legacy();
  for (const change of [value => { value.result = "absent"; }, value => { value.artifact.owner.sessionId = "other"; },
    value => { value.operation.runtime.final = { state: "complete" }; }, value => { value.artifact.manifest.sha256 = "short"; }]) {
    const observation = f.noStart(); change(observation); f.setObservation(observation);
    assert.equal((await f.call()).state, "uncertain");
  }
});

test("source, candidate, authority and session changes during recovery preserve originals", async t => {
  for (const kind of ["candidate", "authority", "source", "session"]) {
    const f = fixture(t); f.legacy(); f.setObservation(f.noStart());
    const inspected = await f.call();
    if (kind === "candidate") writeFileSync(join(f.root, "product.txt"), "new change\n");
    if (kind === "authority") writeFileSync(f.authority, "different authority\n");
    if (kind === "source") {
      const data = JSON.parse(readFileSync(f.source.sourceReference.path, "utf8")); data.previous = { reason: "changed" }; writeFileSync(f.source.sourceReference.path, JSON.stringify(data));
    }
    if (kind === "session") f.setObservation(async () => { f.setSession("changed-mid-query"); return f.noStart(); });
    let result; try { result = await f.call(inspected.continueArguments); } catch (error) { assert.match(error.message, /changed/); }
    assert.equal(result?.delegationArguments, undefined);
    assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 1);
  }
});

test("concurrent recovery requests share one successor and do not adopt a foreign winner", async t => {
  const f = fixture(t); f.legacy(); f.setObservation(f.noStart());
  const inspected = await f.call();
  const results = await Promise.all([f.call(inspected.continueArguments), f.call(inspected.continueArguments)]);
  assert.equal(new Set(results.map(result => result.successor.operation_id)).size, 1);
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 2);
  f.setSession("other-parent");
  const foreign = await f.call(inspected.continueArguments);
  assert.equal(foreign.state, "existing-successor"); assert.equal(foreign.delegationArguments, undefined);
});

test("damaged or future records refuse and changed delivered files remain historical", async t => {
  const f = fixture(t); completeOperation(f.root, { operationId: f.prepared.operation_id, disposition: "succeeded" }, native(f.prepared, f.root));
  f.legacy(); writeFileSync(join(f.root, "product.txt"), "subsequent work\n");
  assert.equal((await f.call()).state, "historical");
  const record = JSON.parse(readFileSync(f.source.sourceReference.path, "utf8")); record.version = 2;
  writeFileSync(f.source.sourceReference.path, JSON.stringify(record));
  await assert.rejects(f.call(), /missing or ambiguous/);
  await assert.rejects(f.call({ operationId: undefined, task: "workshop-desk", step: "backend", attempt: 1 }), /unsupported workflow record/);
  record.version = 1; record.phase = "unknown"; writeFileSync(f.source.sourceReference.path, JSON.stringify(record));
  await assert.rejects(f.call(), /unsupported recovery record/);
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 1);
});

test("producer-proven unknown work with explicit terminal no-start is recoverable", async t => {
  const f = fixture(t); f.legacy(); const proof = f.noStart(); proof.operation.runtime.work = "unknown"; f.setObservation(proof);
  assert.equal((await f.call()).state, "ready-to-continue");
});

test("abort and authorization revocation never allocate a continuation", async t => {
  for (const kind of ["already-aborted", "abort-during-query", "deny-before", "deny-after-query"]) {
    const f = fixture(t); f.legacy(); f.setObservation(f.noStart());
    const inspected = await f.call(), controller = new AbortController(); let allowed = kind !== "deny-before";
    if (kind === "already-aborted") controller.abort();
    if (kind === "abort-during-query") f.setObservation(() => { controller.abort(); return f.noStart(); });
    if (kind === "deny-after-query") f.setObservation(() => { allowed = false; return f.noStart(); });
    let result;
    try { result = await recoverPreparedOperation(f.pi, f.ctx, inspected.continueArguments, controller.signal, () => { if (!allowed) throw Error("Recovery access revoked"); }); }
    catch (error) { assert.match(error.message, /aborted|revoked/); }
    assert.equal(result?.delegationArguments, undefined);
    assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 1);
  }
});

test("an interrupted successor claim remains inspectable uncertainty, never a new attempt", async t => {
  const f = fixture(t); f.legacy(); f.setObservation(f.noStart());
  const inspected = await f.call(), recovered = await f.call(inspected.continueArguments);
  const successor = inspectRecoveryRecord(f.root, { operationId: recovered.successor.operation_id });
  rmSync(successor.sourceReference.path);
  const result = await f.call(inspected.continueArguments);
  assert.equal(result.state, "uncertain"); assert.equal(result.delegationArguments, undefined);
  assert.match(result.nextAction, /incomplete or unreadable/); assert.ok(result.suggestedOptions.length > 0);
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 2);
});

test("an existing successor is rechecked after awaited proof without returning stale dispatch arguments", async t => {
  const f = fixture(t); f.legacy(); f.setObservation(f.noStart());
  const inspected = await f.call(); await f.call(inspected.continueArguments);
  f.setObservation(() => { writeFileSync(f.authority, "changed during original-proof query\n"); return f.noStart(); });
  const result = await f.call(inspected.continueArguments);
  assert.equal(result.delegationArguments, undefined);
  assert.ok(result.suggestedOptions.length > 0);
});

test("recovery follow-up arguments name the task, step and attempt and pass straight back without an operation ID", async t => {
  const f = fixture(t); f.legacy(); f.setObservation(f.noStart());
  const name = { task: "workshop-desk", step: "backend" }, recover = args => recoverPreparedOperation(f.pi, f.ctx, args);
  const inspected = await recover({ action: "recover", ...name, attempt: 1 });
  assert.equal(inspected.state, "ready-to-continue"); assert.equal(inspected.operation_id, f.prepared.operation_id);
  assert.deepEqual(inspected.continueArguments, { action: "recover", mode: "continue", ...name, attempt: 1,
    sourceReference: inspected.sourceReference, expectedCandidate: observeCandidate(f.root) });
  const recovered = await recover(inspected.continueArguments);
  assert.equal(recovered.state, "recovered"); assert.equal(recovered.successor.attempt, 2);
  assert.equal(recovered.operation_id, f.prepared.operation_id, "the original's stored ID stays in the output");
  assert.deepEqual(recovered.statusArguments, { action: "status", repo: f.root, ...name, attempt: 2 });
  assert.deepEqual(recovered.delegationArguments, { agent: "build", operation_id: recovered.successor.operation_id });
  assert.equal(inspectOperation(f.root, recovered.statusArguments).operation_id, recovered.successor.operation_id);
  const repeated = await recover(inspected.continueArguments);
  assert.equal(repeated.reused, true); assert.deepEqual(repeated.statusArguments, recovered.statusArguments);
  assert.deepEqual(repeated.recoverArguments, { action: "recover", ...name, attempt: 2 });
  f.setSession("other-parent");
  const foreign = await recover(inspected.continueArguments);
  assert.equal(foreign.state, "existing-successor"); assert.equal(foreign.delegationArguments, undefined);
  assert.deepEqual(foreign.recoverArguments, { action: "recover", ...name, attempt: 2 });
  const followed = await recover(foreign.recoverArguments);
  assert.equal(followed.operation_id, recovered.successor.operation_id); assert.equal(followed.delegationArguments, undefined);
  assert.equal(readdirSync(join(f.root, ".principal/workflow")).length, 2);
});

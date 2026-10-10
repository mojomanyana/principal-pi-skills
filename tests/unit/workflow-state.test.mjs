import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { observeCandidate, observeSnapshot, prepareOperation, inspectOperation, completeOperation, retryOperation, observeOperationResult, registerCandidateObserver, inspectOwnedOperation } from "../../scripts/workflow-state.mjs";
import { reference } from "../../scripts/progress-artifacts.mjs";

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
function settled(operationId, cwd, text = "Done.\n") {
  const final = { state: "complete", sessionId: "child-session", messageId: "final-message", leafId: "final-leaf", sha256: createHash("sha256").update(text).digest("hex") };
  return { operationId, cwd, executionId: "exec:fixture", state: "settled", finalObservation: { ...final, text }, runtime: {
    work: "succeeded", final, cleanup: { state: "settled", executionId: "exec:fixture" },
  } };
}

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
  assert.throws(() => observeOperationResult(root, { ...request, expectedCandidate: "wrong" }, runtime), /candidate changed/);
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
  assert.throws(() => observeSnapshot(root, { expectedCandidate: { ...snapshot.candidate, root: "/foreign" } }), /candidate changed/);
  writeFileSync(join(root, "product.txt"), "changed\n");
  assert.throws(() => prepareOperation(root, { ...request, expectedCandidate: snapshot.candidate }), /candidate changed/);
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

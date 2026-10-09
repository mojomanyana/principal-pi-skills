import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { observeCandidate, prepareOperation, inspectOperation, completeOperation, retryOperation } from "../../scripts/workflow-state.mjs";
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
function settled(operationId, cwd) {
  return { operationId, cwd, executionId: "exec:fixture", state: "settled", runtime: {
    work: "succeeded", final: { state: "complete" }, cleanup: { state: "settled", executionId: "exec:fixture" },
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
  const done = completeOperation(root, { ...request, disposition: "succeeded" }, settled(first.operation_id, root));
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
  writeFileSync(join(root, "product.txt"), "unexpected review edit\n");
  assert.throws(() => completeOperation(root, { ...review, disposition: "unverified" }, settled(first.operation_id, root)), /read-only/);
  writeFileSync(join(root, "product.txt"), "before\n");
  completeOperation(root, { ...review, disposition: "unverified" }, settled(first.operation_id, root));
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

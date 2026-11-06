import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, realpathSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { observeCandidate, prepareOperation, completeOperation, inspectOperation } from "../../scripts/workflow-state.mjs";
import { observeGitResource, resolveGitResource, observeIntegrationSubject, resolveIntegrationSubject, registerGitResourceObserver } from "../../scripts/continuity.mjs";
import { observeReviewReference, resolveReviewReference } from "../../scripts/review-observation.mjs";

const hash = text => createHash("sha256").update(text).digest("hex");
function native(operationId, cwd, sessionId, text) {
  const executionId = `exec:${sessionId}`;
  const final = { state: "complete", sessionId, messageId: "final-message", leafId: "final-leaf", sha256: hash(text) };
  return { operationId, cwd, executionId, state: "settled", finalObservation: { ...final, text },
    runtime: { work: "succeeded", final, cleanup: { state: "settled", executionId } } };
}
function fixture(t, { reviewScope = "task", additionalRepositories = [] } = {}) {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "principal-review-binding-")));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" });
  git("init", "-q"); writeFileSync(join(repo, "product.txt"), "Synthetic output.\n");
  git("add", "."); git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Synthetic baseline");
  mkdirSync(join(repo, ".principal")); writeFileSync(join(repo, ".principal/.gitignore"), "*\n");
  const authority = join(repo, ".principal/intent.txt"); writeFileSync(authority, "Original and current objective: synthetic output. No external side effects.\n");
  const owner = { sessionId: "coordinator", cwd: repo };
  const input = { task: "fixture", phase: "build", step: "build", expectedCandidate: observeCandidate(repo).id, inputPaths: [authority], owner };
  const build = prepareOperation(repo, input);
  completeOperation(repo, { operationId: build.operation_id, disposition: "succeeded" }, native(build.operation_id, repo, "build-child", "Synthetic build output.\n"));
  const outputReference = { owner: "principal", reference: observeGitResource(repo) };
  const reviewBinding = { initiativeId: "initiative", taskId: "task", taskRevision: "sha256:" + "a".repeat(64), outputId: "output", outputReference, sourceOperationId: build.operation_id, reviewScope, ...(additionalRepositories.length ? { integrationSubject: observeIntegrationSubject([repo, ...additionalRepositories]) } : {}) };
  const reviewRequest = { ...input, phase: "review", step: "review", reviewBinding };
  const prepared = prepareOperation(repo, reviewRequest);
  const dimension = { status: "pass", reason: "Synthetic evidence matches the exact scoped objective." };
  const receipt = { version: 1, bindingId: prepared.reviewBinding.id, scope: reviewScope, verdict: "APPROVE", quality: { ...dimension }, alignment: { ...dimension }, evidence: { ...dimension } };
  const finish = (change = {}, sessionId = "review-child", disposition = "succeeded", prefix = "") => {
    const selected = { ...receipt, ...change };
    const text = `${prefix}Verdict: ${selected.verdict}\nScope: task — synthetic output\n\n\`\`\`principal-review\n${JSON.stringify(selected)}\n\`\`\`\n`;
    const done = completeOperation(repo, { operationId: prepared.operation_id, disposition }, native(prepared.operation_id, repo, sessionId, text));
    return { done, text, ref: observeReviewReference(repo, prepared.operation_id) };
  };
  const purpose = { purpose: "judgment", reviewScope, initiativeId: reviewBinding.initiativeId, taskId: reviewBinding.taskId, taskRevision: reviewBinding.taskRevision, outputId: reviewBinding.outputId };
  const resolve = (ref, selectedPurpose = purpose) => resolveReviewReference(ref, selectedPurpose, { repositories: [repo, ...additionalRepositories], resolveOutput: resolveGitResource, resolveIntegration: resolveIntegrationSubject });
  return { repo, authority, prepared, receipt, finish, resolve, purpose, outputReference, reviewRequest };
}

test("existing native storage binds independent review to exact task/output; callback never infers approval from Git", async t => {
  const f = fixture(t), { done, text, ref } = f.finish();
  assert.equal(done.completionValid, true); assert.equal(done.approval, false); assert.deepEqual(done.reviewReference, ref);
  assert.equal(readFileSync(done.reportPath, "utf8"), text);
  const result = f.resolve(ref);
  assert.equal(result.status, "current"); assert.equal(result.judgment.verdict, "accepted");
  assert.deepEqual(result.judgment.outputReference, f.outputReference); assert.equal(result.judgment.subjectRevision, f.purpose.taskRevision);
  assert.deepEqual([result.observed.quality, result.observed.alignment, result.observed.evidence], ["pass", "pass", "pass"]);
  assert.equal(JSON.stringify(result).includes("Synthetic evidence"), false, "reason bodies are not projected");
  await result.assertCurrent();
  assert.equal(f.resolve(ref, { ...f.purpose, taskRevision: "different" }).status, "unverified");
  assert.equal(f.resolve(ref, { ...f.purpose, outputId: "different" }).status, "unverified");
  assert.equal(f.resolve(ref, { ...f.purpose, reviewScope: "integrated" }).status, "unverified");
  writeFileSync(join(f.repo, "product.txt"), "Changed after independent review.\n");
  assert.equal(f.resolve(ref).status, "unverified"); await assert.rejects(result.assertCurrent());
});
test("wrong scope, wrong binding, unknown result and same author/reviewer cannot become accepted", async t => {
  await t.test("wrong scope", t => { const f = fixture(t, { reviewScope: "integrated" }); const { ref } = f.finish({ scope: "task" }); assert.equal(f.resolve(ref).status, "unverified"); });
  await t.test("wrong binding", t => { const f = fixture(t); const { ref } = f.finish({ bindingId: "principal-review-binding:" + "b".repeat(64) }); assert.equal(f.resolve(ref).status, "unverified"); });
  await t.test("same native child", t => { const f = fixture(t); const { ref } = f.finish({}, "build-child"); assert.equal(f.resolve(ref).status, "unverified"); });
  await t.test("unknown result", t => { const f = fixture(t); const { ref } = f.finish(); assert.equal(f.resolve({ ...ref, operationId: "principal:" + "c".repeat(64) }).status, "unverified"); });
});
test("explicit failed and uncertain dimensions remain separate from bookkeeping completion", async t => {
  await t.test("rejected", t => {
    const f = fixture(t), { ref } = f.finish({ verdict: "CHANGES-REQUESTED", alignment: { status: "fail", reason: "The synthetic requested behavior is missing." } }, "review-child", "changes-requested");
    assert.equal(f.resolve(ref).judgment.verdict, "rejected");
  });
  await t.test("unverified", t => {
    const f = fixture(t), { ref } = f.finish({ verdict: "UNVERIFIED", evidence: { status: "unverified", reason: "A required fact is unconfirmed." } }, "review-child", "unverified");
    assert.equal(f.resolve(ref).judgment.verdict, "unverified");
  });
  await t.test("contradiction", t => {
    const f = fixture(t), { ref } = f.finish({ alignment: { status: "fail", reason: "Known missing requirement." } });
    assert.equal(f.resolve(ref).status, "unverified");
  });
  await t.test("ambiguous verdict", t => {
    const f = fixture(t), { ref } = f.finish({}, "review-child", "succeeded", "Verdict: CHANGES-REQUESTED\n");
    assert.equal(f.resolve(ref).status, "unverified");
  });
});
test("exact authority/report mutations and changed preparation binding refuse; legacy reports are preserved", t => {
  const f = fixture(t), { ref } = f.finish();
  assert.throws(() => prepareOperation(f.repo, { ...f.reviewRequest, reviewBinding: { ...f.reviewRequest.reviewBinding, outputId: "other" } }), /conflict/);
  writeFileSync(f.authority, "Amended intent.\n"); assert.equal(f.resolve(ref).status, "unverified");
  assert.equal(inspectOperation(f.repo, { operationId: f.prepared.operation_id }).completionValid, false);
  const g = fixture(t), finished = g.finish(); writeFileSync(finished.done.reportPath, finished.text + "tampered\n");
  assert.equal(g.resolve(finished.ref).status, "unverified");
  const h = fixture(t), request = { ...h.reviewRequest, step: "legacy", reviewBinding: undefined };
  const old = prepareOperation(h.repo, request);
  completeOperation(h.repo, { operationId: old.operation_id, disposition: "succeeded" }, native(old.operation_id, h.repo, "legacy-review", "Verdict: APPROVE\n"));
  assert.throws(() => observeReviewReference(h.repo, old.operation_id), /no bound/);
});
test("actual optional event returns bound judgment and rechecks selected owner before reuse", async t => {
  const f = fixture(t), { ref } = f.finish(), hooks = new Map(); let handler;
  const pi = { on: (name, fn) => hooks.set(name, fn), events: { on: (_name, fn) => { handler = fn; return () => {}; } } };
  registerGitResourceObserver(pi);
  const ctx = { cwd: f.repo, sessionManager: { getSessionId: () => "selected-session" } };
  hooks.get("session_start")({}, ctx);
  const response = await new Promise(resolve => handler({ version: 1, requestId: "fixture", sessionId: "selected-session", cwd: f.repo,
    reference: { owner: "principal", reference: ref }, purpose: f.purpose, reply: resolve }));
  assert.equal(response.result.status, "current"); assert.equal(response.result.judgment.verdict, "accepted");
  await response.result.assertCurrent(); hooks.get("session_tree")({}, ctx); await assert.rejects(response.result.assertCurrent());
  writeFileSync(join(f.repo, "product.txt"), "Changed primary candidate.\n");
  const stale = await new Promise(resolve => handler({ version: 1, requestId: "stale", sessionId: "selected-session", cwd: f.repo,
    reference: { owner: "principal", reference: ref }, purpose: f.purpose, reply: resolve }));
  assert.equal(stale.result.status, "unverified", "metadata root discovery must not replace the semantic stale verdict");
});

test("integrated native judgment binds every repository member and refuses unselected or changed secondary members", async t => {
  const other = fixture(t), third = fixture(t);
  const f = fixture(t, { reviewScope: "integrated", additionalRepositories: [other.repo, third.repo] }), { ref } = f.finish();
  const current = f.resolve(ref); assert.equal(current.judgment.verdict, "accepted");
  assert.equal(current.observed.integrationMembers, 3);
  assert.equal(resolveReviewReference(ref, f.purpose, { repositories: [f.repo], resolveOutput: resolveGitResource, resolveIntegration: resolveIntegrationSubject }).status, "unverified");
  writeFileSync(join(other.repo, "product.txt"), "Changed reviewed secondary member.\n");
  assert.equal(f.resolve(ref).status, "unverified"); await assert.rejects(current.assertCurrent());
  assert.equal(resolveGitResource(f.outputReference.reference, { repositories: [f.repo] }).status, "current");
  assert.throws(() => prepareOperation(f.repo, { ...f.reviewRequest, step: "stale-integration" }), /exact current member set/);
});


test("retained Review reuses exact source tickets without an intermediate resolution", async t => {
  const other = fixture(t);
  const f = fixture(t, { reviewScope: "integrated", additionalRepositories: [other.repo] }), { ref } = f.finish();
  const counts = { outputResolutions: 0, integrationResolutions: 0, outputChecks: 0, integrationChecks: 0 };
  const resolveOutput = (reference, options) => {
    counts.outputResolutions++;
    const value = resolveGitResource(reference, options);
    return { ...value, assertCurrent: async () => { counts.outputChecks++; await value.assertCurrent(); } };
  };
  const resolveIntegration = (reference, options) => {
    counts.integrationResolutions++;
    const value = resolveIntegrationSubject(reference, options);
    return { ...value, assertCurrent: async () => { counts.integrationChecks++; await value.assertCurrent(); } };
  };
  const current = resolveReviewReference(ref, f.purpose, { repositories: [f.repo, other.repo], resolveOutput, resolveIntegration });
  assert.equal(current.status, "current");
  await current.assertCurrent();
  assert.deepEqual(counts, { outputResolutions: 2, integrationResolutions: 2, outputChecks: 1, integrationChecks: 1 },
    "One initial resolution and one complete final revalidation; retained exact callbacks still run");
});

test("retained Review rechecks exact receipt, prepared inputs and members after awaited source checks", async t => {
  for (const changed of ["report", "input", "secondary-member"]) await t.test(changed, async t => {
    const other = fixture(t);
    const f = fixture(t, { reviewScope: "integrated", additionalRepositories: [other.repo] }), finished = f.finish();
    let enter, release;
    const entered = new Promise(resolve => { enter = resolve; }), gate = new Promise(resolve => { release = resolve; });
    const resolveIntegration = (reference, options) => {
      const value = resolveIntegrationSubject(reference, options);
      return { ...value, assertCurrent: async () => { await value.assertCurrent(); enter(); await gate; } };
    };
    const current = resolveReviewReference(finished.ref, f.purpose, {
      repositories: [f.repo, other.repo], resolveOutput: resolveGitResource, resolveIntegration,
    });
    assert.equal(current.status, "current");
    const pending = current.assertCurrent();
    await entered;
    if (changed === "report") writeFileSync(finished.done.reportPath, finished.text + "changed during revalidation\n");
    else if (changed === "input") writeFileSync(f.authority, "Changed prepared objective during revalidation.\n");
    else writeFileSync(join(other.repo, "product.txt"), "Changed secondary member after its earlier check.\n");
    const refused = assert.rejects(pending);
    release();
    await refused;
  });
});

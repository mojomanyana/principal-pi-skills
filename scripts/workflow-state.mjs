// Deterministic handoffs and exclusive operation records. Never executes work or grants approval.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { candidateSnapshot } from "./resume-checkpoint.mjs";
import { createRun, privateRoot, reference, saveReport } from "./progress-artifacts.mjs";

export const CANDIDATE_ALGORITHM = "principal-candidate-v1";
const phases = ["plan", "build", "review", "test-review", "debug", "investigate"];
const hash = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const same = (a, b) => canonical(a) === canonical(b);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function implementation() {
  return ["package.json", "scripts/workflow-state.mjs", "scripts/resume-checkpoint.mjs", "scripts/progress-artifacts.mjs"]
    .map(path => reference(join(packageRoot, path)));
}
function ordinary(path, directory = false) {
  const stat = lstatSync(path);
  assert(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()), `not an ordinary ${directory ? "directory" : "file"}: ${path}`);
  return stat;
}
function directory(path) {
  try { mkdirSync(path, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
  ordinary(path, true);
}
function writeNew(path, value) {
  const bytes = Buffer.from(canonical(value) + "\n");
  assert(bytes.length <= 8 * 1024 * 1024, "workflow record exceeds storage bound");
  const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { let n = 0; while (n < bytes.length) n += writeSync(fd, bytes, n); fsyncSync(fd); }
  finally { closeSync(fd); }
}
function readRecord(path) {
  ordinary(path);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(fd);
    assert(stat.isFile() && stat.size <= 8 * 1024 * 1024, "invalid workflow record");
    const value = JSON.parse(readFileSync(fd, "utf8"));
    assert(value.version === 1, "unsupported workflow record version");
    return value;
  } finally { closeSync(fd); }
}
function key(task, step, attempt) {
  assert(typeof task === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(task), "task must be a short stable name");
  assert(typeof step === "string" && step.trim() && step.length <= 200, "step must be a stable nonempty name (at most 200 characters)");
  assert(Number.isSafeInteger(attempt) && attempt > 0, "attempt must be a positive integer");
  return hash(canonical({ task, step, attempt }));
}
function assertIgnored(root, path) {
  try { execFileSync("git", ["--no-optional-locks", "-C", root, "check-ignore", "-q", "--", relative(root, path)], { stdio: "pipe" }); }
  catch { throw new Error("workflow destination must be Git-ignored; preserve the existing ignore policy"); }
}
function location(repo, task, step, attempt, create = false) {
  const root = create ? privateRoot(repo) : realpathSync(execFileSync("git", ["--no-optional-locks", "-C", repo, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  const principal = join(root, ".principal"), store = join(principal, "workflow");
  const id = key(task, step, attempt), path = join(store, id);
  if (create) {
    try { ordinary(store, true); } catch (error) { if (error.code !== "ENOENT") throw error; }
    for (const name of ["request.json", "result.json", "completion.json"]) assertIgnored(root, join(path, name));
    directory(store);
  }
  ordinary(principal, true); ordinary(store, true);
  return { root, path, operationId: `principal:${hash(canonical({ root, task, step, attempt }))}` };
}
function references(inputs) {
  assert(Array.isArray(inputs) && inputs.length <= 128, "inputs must be at most 128 exact file references");
  const refs = inputs.map(input => {
    assert(input && typeof input.path === "string" && isAbsolute(input.path) && /^[a-f0-9]{64}$/.test(input.sha256), "input requires absolute path and SHA-256");
    const current = reference(input.path);
    assert(current.sha256 === input.sha256, `changed input: ${input.path}`);
    return current;
  }).sort((a, b) => a.path.localeCompare(b.path));
  assert(new Set(refs.map(ref => ref.path)).size === refs.length, "duplicate input reference");
  return refs;
}
function requestedReferences(root, request) {
  const paths = request.inputPaths ?? [];
  assert(Array.isArray(paths) && paths.length <= 128 && paths.every(path => typeof path === "string" && path.trim()),
    "inputPaths must be at most 128 nonempty file paths, relative to the worktree or absolute");
  return references([...(request.inputs ?? []), ...paths.map(path => reference(resolve(root, path)))]);
}
function expectedMatches(current, expected) {
  return typeof expected === "string" ? current.id === expected
    : expected && expected.algorithm === current.algorithm && expected.root === current.root && expected.id === current.id;
}
function referenceIssues(refs) {
  try { references(refs); return []; } catch (error) { return [error.message]; }
}
/** Observe product identity and named authority/evidence bytes without caller-computed hashes. */
export function observeSnapshot(repo, request = {}) {
  const candidate = observeCandidate(repo);
  if (request.expectedCandidate !== undefined) assert(expectedMatches(candidate, request.expectedCandidate), "candidate changed since the caller's observation");
  const inputs = requestedReferences(candidate.root, request);
  assert(same(observeCandidate(repo), candidate), "candidate changed during snapshot; observe again");
  return { version: 1, state: "observed", approval: false, administrativeWrites: false, candidate, inputs };
}
export function observeCandidate(repo) {
  const c = candidateSnapshot(repo);
  return { algorithm: CANDIDATE_ALGORITHM, root: c.root, id: c.id, head: c.head,
    indexSha256: c.indexSha256, stagedSha256: c.stagedSha256, unstagedSha256: c.unstagedSha256,
    changedPaths: c.changedPaths.slice(0, 100), changedPathCount: c.changedPaths.length };
}
/** Optional in-process advisory observation. The caller cannot select another workspace. */
export function registerCandidateObserver(pi) {
  let bound;
  const bind = ctx => { bound = ctx; };
  pi.on("session_start", (_event, ctx) => bind(ctx));
  pi.on("session_switch", (_event, ctx) => bind(ctx));
  const unsubscribe = pi.events.on("principal:candidate-observe", request => {
    if (!request || typeof request.reply !== "function" || typeof request.requestId !== "string" ||
        !request.requestId || request.requestId.length > 512 || typeof request.sessionId !== "string") return;
    const envelope = { requestId: request.requestId, sessionId: request.sessionId };
    let response;
    try {
      assert(bound && bound.sessionManager.getSessionId() === request.sessionId, "session observation mismatch");
      const ctx = bound, cwd = realpathSync(ctx.cwd), candidate = observeCandidate(cwd);
      assert(bound === ctx && ctx.sessionManager.getSessionId() === request.sessionId && realpathSync(ctx.cwd) === cwd,
        "session changed during observation");
      response = { ...envelope, candidate };
    } catch { response = { ...envelope, error: "candidate-observation-failed" }; }
    request.reply(response);
  });
  pi.on("session_shutdown", () => { bound = undefined; unsubscribe(); });
  return bind;
}
function summary(record, state, extra = {}) {
  ordinary(dirname(record.reportPath), true);
  ordinary(record.artifactsPath, true);
  return { version: 1, state, operation_id: record.operationId, task: record.task, step: record.step, attempt: record.attempt,
    phase: record.phase, root: record.root, candidate: record.input, reportPath: record.reportPath,
    handoff: { cwd: record.root, reportPath: record.reportPath, artifactsPath: record.artifactsPath,
      directoriesExist: true, reportWriter: "coordinator", candidateObserver: "coordinator" },
    storage: "private-files", administrativeWrites: false,
    inputs: record.inputs, owner: record.owner ?? null, approval: false, ...extra };
}
function load(repo, request) {
  let selected = request;
  if (request.operationId !== undefined) {
    assert(typeof request.operationId === "string" && /^principal:[a-f0-9]{64}$/.test(request.operationId), "invalid Principal operationId");
    const root = realpathSync(execFileSync("git", ["--no-optional-locks", "-C", repo, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
    const store = join(root, ".principal", "workflow");
    ordinary(join(root, ".principal"), true); ordinary(store, true);
    const matches = [];
    for (const entry of readdirSync(store, { withFileTypes: true })) {
      if (!/^[a-f0-9]{64}$/.test(entry.name)) continue;
      const path = join(store, entry.name);
      let record;
      try {
        ordinary(path, true);
        record = optionalRecord(join(path, "request.json"));
      } catch {
        // An interrupted or unsafe sibling is not a valid operation identity. Preserve it;
        // a requested damaged record still refuses below instead of blocking unrelated work.
        continue;
      }
      if (record?.operationId === request.operationId) matches.push(record);
    }
    assert(matches.length === 1, "Principal operationId is missing or ambiguous in this workspace");
    const record = matches[0];
    for (const field of ["task", "step", "attempt"]) {
      assert(request[field] === undefined || request[field] === record[field], "operationId conflicts with supplied task/step/attempt");
    }
    selected = { ...request, task: record.task, step: record.step, attempt: record.attempt };
  }
  const where = location(repo, selected.task, selected.step, selected.attempt ?? 1);
  ordinary(where.path, true);
  const record = readRecord(join(where.path, "request.json"));
  assert(record.operationId === where.operationId && record.root === where.root && record.task === selected.task && record.step === selected.step && record.attempt === (selected.attempt ?? 1), "workflow operation identity mismatch");
  assert(same(record.implementation, implementation()), "workflow implementation changed; reconcile previous operation before a new attempt");
  return { ...where, record };
}
function optionalRecord(path) {
  try { return readRecord(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
function retainedResult(path, record) {
  const result = optionalRecord(join(path, "result.json"));
  if (!result) return null;
  assert(result.operationId === record.operationId && Array.isArray(result.issues) && result.issues.every(issue => typeof issue === "string"), "retained result identity mismatch");
  const identity = settledRuntime(result.runtime, record.operationId, record.root);
  assert(result.report.path === record.reportPath && result.report.sha256 === identity.runtime.final.sha256, "retained result report identity mismatch");
  assert(reference(record.reportPath).sha256 === result.report.sha256, "retained report changed");
  return result;
}
export function inspectOperation(repo, request) {
  const { path, record } = load(repo, request), current = observeCandidate(repo);
  const inputIssues = referenceIssues(record.inputs), retained = retainedResult(path, record);
  const completion = optionalRecord(join(path, "completion.json"));
  if (!completion && !retained) return summary(record, "prepared", {
    candidateMatches: same(current, record.input), inputsMatch: !inputIssues.length, issues: inputIssues,
    resultRetained: false, completionValid: false,
  });
  const result = completion ?? retained;
  assert(result.operationId === record.operationId, "completion operation mismatch");
  assert(reference(record.reportPath).sha256 === result.report.sha256, "completed report changed");
  if (completion && retained) {
    for (const field of ["output", "report", "runtime", "disposition"]) assert(same(completion[field], retained[field]), "completion differs from retained native result");
  }
  const readOnly = !["build", "debug"].includes(record.phase);
  const target = completion ? completion.output : readOnly ? record.input : retained.output;
  const matches = same(current, target);
  const issues = [...inputIssues, ...(retained?.issues ?? []), ...referenceIssues(completion?.evidence ?? [])];
  if (!matches) issues.push("candidate changed; retained result does not validate the current tree");
  const valid = !!completion && !issues.length;
  return summary(record, valid ? "complete" : issues.length ? "stale" : "retained", {
    candidateMatches: matches, inputsMatch: !inputIssues.length, output: result.output,
    report: result.report, evidence: completion?.evidence ?? [], runtime: result.runtime, disposition: result.disposition,
    productChanged: !same(result.output, record.input), resultRetained: true, completionValid: valid, issues: [...new Set(issues)],
  });
}
/** Mutating/reusing completion belongs to its original live coordinator; status remains inspectable. */
export function inspectOwnedOperation(repo, request, owner) {
  const current = inspectOperation(repo, request);
  assert(current.owner && same(current.owner, owner), "operation belongs to another coordinator session or workspace");
  return current;
}
function prepare(repo, request) {
  const { task, step, phase, expectedCandidate, attempt = 1 } = request;
  assert(phases.includes(phase), "unsupported workflow phase");
  const owner = request.owner ?? null;
  assert(owner === null || (typeof owner.sessionId === "string" && owner.sessionId && typeof owner.cwd === "string" && isAbsolute(owner.cwd)), "invalid coordinator identity");
  const current = observeCandidate(repo);
  assert(expectedMatches(current, expectedCandidate), "candidate changed; observe again before preparing a handoff");
  const checked = requestedReferences(current.root, request), where = location(current.root, task, step, attempt, true);
  try { mkdirSync(where.path, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = load(current.root, request).record;
    assert(same(existing.owner ?? null, owner), "operation belongs to another coordinator session; inspect and reconcile the original before a new attempt");
    assert(existing.phase === phase && same(existing.inputs, checked), "operation conflict: stable task/step already has different phase or inputs");
    const result = inspectOperation(current.root, request);
    assert(result.candidateMatches && !result.issues?.length, "operation candidate changed; reconcile its result or use an explicit settled retry");
    return { ...result, reused: true };
  }
  // A crash after the exclusive claim leaves an incomplete operation, never a silent retry.
  const run = createRun(current.root, task, current.id);
  const record = { version: 1, operationId: where.operationId, root: current.root, task, step, attempt, phase,
    input: current, inputs: checked, owner, previous: request.previous ?? null, reportPath: join(run, `${phase}.md`), artifactsPath: join(run, "artifacts"), implementation: implementation() };
  assert(same(observeCandidate(current.root), current), "candidate changed while preparing handoff; preserve incomplete claim");
  assertIgnored(current.root, record.reportPath);
  assertIgnored(current.root, join(record.artifactsPath, "unused-probe"));
  directory(record.artifactsPath);
  assertIgnored(current.root, join(where.path, "request.json"));
  writeNew(join(where.path, "request.json"), record);
  return summary(record, "prepared", { candidateMatches: true, inputsMatch: true, resultRetained: false, completionValid: false, issues: [], reused: false, administrativeWrites: true });
}
export function prepareOperation(repo, request) {
  assert((request.attempt ?? 1) === 1, "use retry to create a later attempt after settlement");
  return prepare(repo, request);
}

/** Runtime comes from the extension's session-bound Daddy query, never model-supplied prose. */
function settledRuntime(runtime, operationId, root) {
  assert(runtime?.operationId === operationId && runtime.state === "settled" && runtime.runtime?.cleanup?.state === "settled" && runtime.runtime.cleanup.executionId === runtime.executionId,
    "exact operation settlement is unavailable; preserve prepared operation");
  assert(typeof runtime.executionId === "string" && runtime.executionId, "native execution identity required");
  assert(runtime.cwd === root, "native execution used a different workspace");
  assert(!runtime.runtime.control && runtime.runtime.work === "succeeded" && runtime.runtime.final?.state === "complete", "native result is incomplete or failed");
  const final = runtime.runtime.final;
  assert(["sessionId", "messageId", "leafId"].every(key => typeof final[key] === "string" && final[key]) && /^[a-f0-9]{64}$/.test(final.sha256), "native final identity and SHA-256 required");
  const { finalObservation: _text, ...identity } = runtime;
  return identity;
}
function finalText(runtime) {
  const expected = runtime.runtime.final, final = runtime.finalObservation;
  assert(final?.state === "complete" && typeof final.text === "string" && final.text.trim() && Buffer.byteLength(final.text) <= 4 * 1024 * 1024,
    `exact native final unavailable; retain the original result and reconcile: ${final?.reason ?? "runtime does not expose it"}`);
  assert(["sessionId", "messageId", "leafId", "sha256"].every(key => final[key] === expected[key]) && hash(final.text) === expected.sha256,
    "native final content or identity mismatch");
  return final.text;
}

/** Observe an exact native result without creating Principal metadata or report files. */
export function observeOperationResult(repo, request, runtime) {
  const candidate = observeCandidate(repo), identity = settledRuntime(runtime, request.operationId, candidate.root);
  if (request.expectedCandidate !== undefined) assert(expectedMatches(candidate, request.expectedCandidate), "candidate changed since the caller's observation");
  const text = finalText(runtime);
  return { version: 1, state: "observed", approval: false, administrativeWrites: false, storage: "none",
    candidate, runtime: identity, final: { ...identity.runtime.final, text } };
}

export function completeOperation(repo, request, runtime) {
  const { path, record } = load(repo, request);
  if (optionalRecord(join(path, "completion.json"))) return { ...inspectOperation(repo, request), reused: true };
  let retained = retainedResult(path, record), wrote = false;
  if (!retained) {
    const identity = settledRuntime(runtime, record.operationId, record.root);
    assert(["succeeded", "changes-requested", "unverified", "blocked"].includes(request.disposition), "explicit result disposition required");
    const output = observeCandidate(repo), issues = referenceIssues(record.inputs);
    if (!["build", "debug"].includes(record.phase) && !same(output, record.input)) issues.push("read-only workflow phase changed candidate before native result retention");
    for (const destination of [record.reportPath, join(path, "result.json"), join(path, "completion.json")]) assertIgnored(record.root, destination);
    let report;
    try {
      report = reference(record.reportPath);
      assert(report.sha256 === identity.runtime.final.sha256, "existing report differs from the exact native final; preserve it and reconcile");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      report = saveReport(dirname(record.reportPath), `${record.phase}.md`, finalText(runtime));
    }
    assert(report.sha256 === identity.runtime.final.sha256, "retained native report failed integrity verification");
    if (!same(observeCandidate(repo), output)) issues.push("candidate changed while retaining native result");
    issues.push(...referenceIssues(record.inputs));
    retained = { version: 1, operationId: record.operationId, output, report,
      runtime: identity, disposition: request.disposition, issues: [...new Set(issues)] };
    // Preserve immutable producer evidence before deciding whether it applies to this tree.
    writeNew(join(path, "result.json"), retained);
    wrote = true;
  } else if (request.disposition !== undefined) {
    assert(request.disposition === retained.disposition, "retained result disposition is immutable");
  }
  const current = inspectOperation(repo, request);
  if (current.state === "stale") return { ...current, reused: !wrote, administrativeWrites: wrote };
  const evidence = references(request.evidence ?? []);
  assertIgnored(record.root, join(path, "completion.json"));
  // Recheck after evidence reads. Neither changed authority nor a late repair can promote an old result.
  const checked = inspectOperation(repo, request);
  if (checked.state === "stale") return { ...checked, reused: !wrote, administrativeWrites: wrote };
  writeNew(join(path, "completion.json"), { version: 1, operationId: record.operationId, output: retained.output,
    report: retained.report, evidence, runtime: retained.runtime, disposition: retained.disposition });
  return { ...inspectOperation(repo, request), reused: false, administrativeWrites: true };
}

/** Retry preserves the old attempt; uncertain executions never authorize another dispatch. */
export function retryOperation(repo, request, runtime) {
  const { record } = load(repo, request);
  assert(runtime?.operationId === record.operationId, "prior operation identity mismatch");
  const neverStarted = runtime.state === "not-started" && runtime.runtime?.cleanup?.state === "not-started";
  const settled = runtime.state === "settled" && runtime.runtime?.cleanup?.state === "settled" &&
    typeof runtime.executionId === "string" && runtime.runtime.cleanup.executionId === runtime.executionId;
  assert(neverStarted || settled, "prior operation is not settled or proven unstarted; retry refused");
  if (settled) assert(runtime.cwd === record.root, "native execution used a different workspace");
  assert(typeof request.reason === "string" && request.reason.trim(), "retry reason required");
  return prepare(repo, { ...request, operationId: undefined, task: record.task, step: record.step, owner: record.owner,
    inputs: request.inputs ?? (request.inputPaths ? [] : record.inputs), phase: record.phase, attempt: record.attempt + 1,
    previous: { operationId: record.operationId, reason: request.reason, runtime } });
}

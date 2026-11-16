// Deterministic handoffs and exclusive operation records. Never executes work or grants approval.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { candidateSnapshot } from "./resume-checkpoint.mjs";
import { resolveIntegrationSubject } from "./continuity.mjs";
import { createRun, privateRoot, reference, saveReport } from "./progress-artifacts.mjs";

export const CANDIDATE_ALGORITHM = "principal-candidate-v1";
export const WORKFLOW_TASK_NAME = Object.freeze({
  pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$",
  description: "Stable task identity: 1-80 ASCII letters, digits, underscores or hyphens; begin with a letter or digit (for example, workshop-desk-v1-stage1). Reuse an established identity unchanged.",
});
export const WORKFLOW_STEP_NAME = Object.freeze({
  minLength: 1, maxLength: 200, pattern: "\\S",
  description: "Stable nonblank step identity, at most 200 characters. Reuse an established step unchanged.",
});
const validName = (value, rule) => typeof value === "string" && (rule.maxLength === undefined || value.length <= rule.maxLength) && new RegExp(rule.pattern).test(value);
const nameErrors = {
  task: "task must be a short stable name: 1-80 ASCII letters, digits, underscores or hyphens, beginning with a letter or digit",
  step: "step must be a stable nonempty name (at most 200 characters)",
};
/** Correctable preparation metadata, checked before this call can allocate an operation. */
export class PrepareInputError extends Error {
  constructor(field) {
    super(nameErrors[field]);
    this.name = "PrepareInputError";
    this.code = "PREPARE_INPUT_INVALID";
    this.administrativeWrites = false;
    this.operationAllocated = false;
    this.diagnostic = Object.freeze({ kind: "prepare-input", field });
    this.recovery = Object.freeze({ action: "prepare", message: "Correct the named field and repeat prepare for the same authorized work. Reuse established task/step identities. For a new task with no established internal identity, choose a short valid ID such as workshop-desk-v1-stage1 without asking permission again. Keep attempt unchanged; never rename an existing operation to evade a refusal. This call allocated no operation and does not authorize execution retry." });
  }
}
const phases = ["plan", "build", "review", "test-review", "debug", "investigate"];
const hash = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const same = (a, b) => canonical(a) === canonical(b);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function implementation() {
  return ["package.json", "scripts/workflow-state.mjs", "scripts/runtime-operation-query.mjs", "scripts/prepared-recovery.mjs", "scripts/continuity.mjs", "scripts/review-observation.mjs", "scripts/resume-checkpoint.mjs", "scripts/progress-artifacts.mjs"]
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
  assert(validName(task, WORKFLOW_TASK_NAME), nameErrors.task);
  assert(validName(step, WORKFLOW_STEP_NAME), nameErrors.step);
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
const candidateId = value => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64}|dirty:[a-f0-9]{64})$/.test(value);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const commitId = value => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
/** Fixed, path-free diagnostics. A supplied baseline is informative, never additional authority. */
export class CandidateIdentityError extends Error {
  constructor(code, message, diagnostic) {
    super(message);
    this.name = "CandidateIdentityError";
    this.code = code;
    this.administrativeWrites = false;
    this.diagnostic = Object.freeze({ kind: "candidate-identity", ...diagnostic });
  }
}
function candidateComparison(current, expected) {
  const compare = (key, valid) => valid(expected?.[key]) ? current[key] === expected[key] ? "same" : "different" : "unknown";
  return Object.freeze({ head: compare("head", commitId), index: compare("indexSha256", digest), source: compare("sourceSha256", digest) });
}
function requireExpectedCandidate(current, expected) {
  const fail = (code, message, reason) => { throw new CandidateIdentityError(code, message, { reason }); };
  if (expected === undefined)
    fail("CANDIDATE_EXPECTED_MISSING", "expectedCandidate is required; pass the returned snapshot.candidate or snapshot.candidate.id unchanged.", "missing-expected");
  const object = expected !== null && typeof expected === "object" && !Array.isArray(expected);
  if (!(typeof expected === "string" ? candidateId(expected) : object && expected.algorithm === CANDIDATE_ALGORITHM &&
    typeof expected.root === "string" && isAbsolute(expected.root) && candidateId(expected.id)))
    fail("CANDIDATE_EXPECTED_INVALID", "expectedCandidate must be a returned candidate identity or its exact id, not the whole snapshot response or an arbitrary value.", "malformed-expected");
  if (object && expected.root !== current.root)
    fail("CANDIDATE_WORKSPACE_MISMATCH", "The supplied candidate belongs to a different workspace; reconcile the selected workspace before preparing work.", "workspace-mismatch");
  const expectedId = object ? expected.id : expected;
  if (current.id === expectedId) return;
  const headOnly = expectedId === current.head && current.id.startsWith("dirty:");
  throw new CandidateIdentityError("CANDIDATE_IDENTITY_MISMATCH",
    headOnly
      ? "Candidate identity differs: the supplied id identifies HEAD, while the current candidate includes uncommitted files. Use the exact snapshot.candidate after reconciling the intended work."
      : "Candidate identity differs from the supplied observation; reconcile the current workspace and inputs before preparing work.",
    { reason: "identity-mismatch", comparisonBasis: "supplied-candidate", comparison: candidateComparison(current, object ? expected : undefined),
      ...(headOnly ? { hint: "head-does-not-identify-dirty-candidate" } : {}) });
}
function referenceIssues(refs) {
  try { references(refs); return []; } catch (error) { return [error.message]; }
}
/** Observe product identity and named authority/evidence bytes without caller-computed hashes. */
export function observeSnapshot(repo, request = {}) {
  const candidate = observeCandidate(repo);
  if (request.expectedCandidate !== undefined) requireExpectedCandidate(candidate, request.expectedCandidate);
  const inputs = requestedReferences(candidate.root, request);
  const after = observeCandidate(repo);
  if (!same(after, candidate)) throw new CandidateIdentityError("CANDIDATE_OBSERVATION_CHANGED", "Candidate changed during snapshot; no handoff was prepared.",
    { reason: "observation-changed", comparisonBasis: "observed-candidate", comparison: candidateComparison(after, candidate) });
  return { version: 1, state: "observed", approval: false, administrativeWrites: false, candidate, inputs };
}
export function observeCandidate(repo) {
  const c = candidateSnapshot(repo);
  // Index membership is deliberately absent: staging unchanged bytes changes the index, not the source.
  const sources = [...c.tracked, ...c.untracked].filter(file => !file.missing)
    .map(({ path, sha256, mode }) => ({ path, sha256, mode }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { algorithm: CANDIDATE_ALGORITHM, root: c.root, id: c.id, head: c.head,
    indexSha256: c.indexSha256, stagedSha256: c.stagedSha256, unstagedSha256: c.unstagedSha256,
    sourceSha256: hash(canonical(sources)),
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
function reviewBinding(request, inputs, current) {
  if (request.reviewBinding === undefined) return null;
  const input = request.reviewBinding;
  assert(request.phase === "review" && input && typeof input === "object" && !Array.isArray(input), "review binding requires a Review operation");
  const keys = ["initiativeId", "taskId", "taskRevision", "outputId", "outputReference", "sourceOperationId", "sourceRecovery", "reviewScope", "integrationSubject"];
  assert(Object.keys(input).every(key => keys.includes(key)), "unknown review binding field");
  for (const key of ["initiativeId", "taskId", "taskRevision", "outputId"])
    assert(typeof input[key] === "string" && input[key].trim() && input[key].length <= 256 && !/[\x00-\x1f\x7f]/u.test(input[key]), "invalid review binding identity");
  assert(/^principal:[a-f0-9]{64}$/.test(input.sourceOperationId), "review binding requires its original Build operation");
  assert(["task", "integrated"].includes(input.reviewScope), "explicit required review scope is required");
  const output = input.outputReference;
  assert(output?.owner === "principal" && output.reference?.kind === "principal-git" && output.reference.repo === current.root && output.reference.candidateId === current.id,
    "review output must identify the exact current Principal Git resource");
  assert(Buffer.byteLength(canonical(output)) <= 4096 && inputs.length > 0, "review binding needs bounded output and exact authority/evidence inputs");
  if (input.integrationSubject !== undefined) {
    const subject = input.integrationSubject;
    assert(input.reviewScope === "integrated" && Buffer.byteLength(canonical(subject)) <= 32000 && Array.isArray(subject?.resources), "integration subject requires bounded integrated scope");
    const integration = resolveIntegrationSubject(subject, { repositories: subject.resources.map(resource => resource.repo) });
    assert(integration.status === "current" && subject.resources.some(resource => same(resource, output.reference)), "integrated review requires the exact current member set including its output");
  }
  const source = input.sourceRecovery === undefined ? inspectOperation(current.root, { operationId: input.sourceOperationId })
    : inspectRecoveryOperation(current.root, { operationId: input.sourceOperationId });
  if (input.sourceRecovery !== undefined) assert(same(input.sourceRecovery, source.sourceRecovery), "recovered review source changed; inspect its exact historical result again");
  assert(["build", "debug"].includes(source.phase) && (source.completionValid || input.sourceRecovery !== undefined && source.sourceRecovery !== undefined) && source.disposition === "succeeded" && source.runtime?.runtime?.final?.sessionId,
    "review binding requires a current completed native Build or Debug result");
  const body = { version: 1, ...structuredClone(input), inputs };
  return { ...body, id: `principal-review-binding:${hash(canonical(body))}` };
}
function summary(record, state, extra = {}) {
  ordinary(dirname(record.reportPath), true);
  ordinary(record.artifactsPath, true);
  return { version: 1, state, operation_id: record.operationId, task: record.task, step: record.step, attempt: record.attempt,
    phase: record.phase, root: record.root, candidate: record.input, reportPath: record.reportPath,
    handoff: { cwd: record.root, reportPath: record.reportPath, artifactsPath: record.artifactsPath,
      directoriesExist: true, reportWriter: "coordinator", candidateObserver: "coordinator" },
    storage: "private-files", administrativeWrites: false,
    ...(record.reviewBinding ? { reviewBinding: record.reviewBinding,
      reviewReceiptInstruction: "The independent reviewer must read the bound inputs and copy this binding id into exactly one principal-review JSON fence described in references/continuity.md; do not reconstruct any digest.",
      ...(extra.report ? { reviewReference: { kind: "principal-review", repo: record.root, operationId: record.operationId,
        bindingId: record.reviewBinding.id, reportSha256: extra.report.sha256 } } : {}) } : {}),
    inputs: record.inputs, owner: record.owner ?? null, approval: false, ...extra };
}
function load(repo, request, historical = false) {
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
  if (!historical) assert(same(record.implementation, implementation()), "workflow implementation changed; reconcile previous operation before a new attempt");
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
function inspectStoredOperation(repo, request, historical = false) {
  const { path, record } = load(repo, request, historical), current = observeCandidate(repo);
  const inputIssues = referenceIssues(record.inputs), retained = retainedResult(path, record);
  const completion = optionalRecord(join(path, "completion.json"));
  if (!completion && !retained) return summary(record, "prepared", {
    candidateMatches: historical ? current.algorithm === record.input?.algorithm && current.root === record.input?.root && current.id === record.input?.id : same(current, record.input), inputsMatch: !inputIssues.length, issues: inputIssues,
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
  const matches = historical ? current.algorithm === target?.algorithm && current.root === target?.root && current.id === target?.id : same(current, target);
  const issues = [...inputIssues, ...(retained?.issues ?? []), ...referenceIssues(completion?.evidence ?? [])];
  if (!matches) issues.push("candidate changed; retained result does not validate the current tree");
  const valid = !!completion && !issues.length;
  return summary(record, valid ? "complete" : issues.length ? "stale" : "retained", {
    candidateMatches: matches, inputsMatch: !inputIssues.length, output: result.output,
    report: result.report, evidence: completion?.evidence ?? [], runtime: result.runtime, disposition: result.disposition,
    productChanged: !same(result.output, record.input), resultRetained: true, completionValid: valid, issues: [...new Set(issues)],
  });
}
export function inspectOperation(repo, request) { return inspectStoredOperation(repo, request); }

/** Recovery reads supported immutable records; live mutation/ownership guards remain separate. */
export function inspectRecoveryRecord(repo, request) {
  const loaded = load(repo, request, true);
  const record = loaded.record;
  assert(phases.includes(record.phase) && Array.isArray(record.inputs) && record.inputs.length <= 128, "unsupported recovery record fields");
  assert(record.owner === null || record.owner === undefined || typeof record.owner.sessionId === "string" && record.owner.sessionId && typeof record.owner.cwd === "string" && isAbsolute(record.owner.cwd), "invalid historical coordinator identity");
  for (const path of [record.reportPath, record.artifactsPath]) {
    assert(typeof path === "string" && isAbsolute(path) && !relative(join(record.root, ".principal"), path).startsWith(".."), "historical artifact is outside its workspace");
  }
  return { ...loaded, sourceReference: reference(join(loaded.path, "request.json")) };
}
export function inspectRecoveryOperation(repo, request) {
  const { path, record, sourceReference } = inspectRecoveryRecord(repo, request);
  const result = inspectStoredOperation(repo, request, true);
  if (result.resultRetained) {
    const runtime = settledRuntime(result.runtime, record.operationId, record.root);
    assert(result.report?.sha256 === runtime.runtime.final.sha256, "recovered report does not match its native final");
  }
  const optionalReference = name => optionalRecord(join(path, name)) ? reference(join(path, name)) : null;
  return { ...result, ...(result.resultRetained && result.candidateMatches && result.inputsMatch && !result.issues?.length ? { sourceRecovery: {
    kind: "principal-completed-recovery", operationId: result.operation_id, request: sourceReference,
    result: optionalReference("result.json"), completion: optionalReference("completion.json"), report: result.report,
  } } : {}) };
}
export function inspectRecoverySuccessor(repo, source) {
  const next = location(repo, source.task, source.step, source.attempt + 1);
  try { ordinary(next.path, true); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  // An allocated directory without its record is uncertain, not an invitation to allocate again.
  return inspectRecoveryRecord(repo, { task: source.task, step: source.step, attempt: source.attempt + 1 });
}
export function prepareRecoverySuccessor(repo, source, sourceReference, owner, expectedCandidate, artifact) {
  const current = inspectRecoveryRecord(repo, { operationId: source.operationId });
  assert(same(current.sourceReference, sourceReference), "recovery source changed before successor preparation");
  let recoveredBinding = source.reviewBinding ?? undefined;
  if (recoveredBinding) {
    const build = inspectRecoveryOperation(repo, { operationId: recoveredBinding.sourceOperationId });
    assert(build.sourceRecovery, "the original review's Build output changed; reconcile it before recovering this Review");
    recoveredBinding = { ...recoveredBinding, sourceRecovery: build.sourceRecovery };
    delete recoveredBinding.id; delete recoveredBinding.version; delete recoveredBinding.inputs;
  }
  const result = prepare(repo, { task: source.task, step: source.step, attempt: source.attempt + 1, phase: source.phase, reviewBinding: recoveredBinding,
    owner, expectedCandidate, inputs: source.inputs, previous: { operationId: source.operationId, reason: "Recovered proven unstarted operation",
      recovery: { sourceReference, sourceOwner: source.owner, artifact } } });
  const successor = inspectRecoveryRecord(repo, { operationId: result.operation_id });
  assert(successor.record.previous?.operationId === source.operationId && same(successor.record.previous?.recovery?.sourceReference, sourceReference), "next attempt belongs to another continuation; inspect it without dispatching");
  return result;
}
/** Mutating/reusing completion belongs to its original live coordinator; status remains inspectable. */
export function inspectOwnedOperation(repo, request, owner) {
  const current = inspectOperation(repo, request);
  assert(current.owner && same(current.owner, owner), "operation belongs to another coordinator session or workspace");
  return current;
}

/** Decode supported historical records without granting present implementation compatibility. */
export function inspectHistoricalOperation(repo, request, owner) {
  const { record } = load(repo, request, true);
  assert(record.owner && same(record.owner, owner), "operation belongs to another coordinator session or workspace");
  const current = observeCandidate(repo), inputIssues = referenceIssues(record.inputs);
  return { version: 1, state: "historical", operation_id: record.operationId,
    task: record.task, step: record.step, attempt: record.attempt, phase: record.phase,
    root: record.root, owner: record.owner, candidate: record.input, currentCandidate: current,
    // Additive observation fields do not change the authoritative historical candidate identity.
    candidateMatches: current.algorithm === record.input?.algorithm && current.root === record.input?.root && current.id === record.input?.id,
    inputsMatch: !inputIssues.length,
    implementationMatches: same(record.implementation, implementation()), issues: inputIssues,
    approval: false, completionValid: false, administrativeWrites: false,
  };
}

/** Producer-verified history is evidence only; it never completes, retries or dispatches work. */
export function observeHistoricalOperation(repo, request, runtime, owner) {
  const current = inspectHistoricalOperation(repo, request, owner);
  assert(runtime?.historical === true && runtime.operationId === current.operation_id && runtime.cwd === current.root,
    "historical native operation identity mismatch");
  const artifact = runtime.artifact;
  if (artifact) {
    assert(artifact.version === 1 && artifact.producer === "pi-daddy" && same(artifact.owner, owner) &&
      artifact.operationId === current.operation_id && artifact.executionId === runtime.executionId &&
      isAbsolute(artifact.manifest?.path ?? "") && /^[a-f0-9]{64}$/.test(artifact.manifest?.sha256) &&
      Number.isSafeInteger(artifact.manifest?.bytes) && artifact.manifest.bytes > 0,
    "historical artifact identity mismatch");
  }
  let final;
  if (runtime.finalObservation?.state === "complete") {
    assert(artifact, "historical final requires its producer artifact");
    final = { ...runtime.runtime?.final, text: finalText(runtime) };
  }
  const { finalObservation: _text, ...identity } = runtime;
  return { ...current, runtime: identity, ...(final ? { final } : {}),
    resultRetained: !!artifact, applicability: "not-established",
    issues: [...current.issues, "Historical evidence does not establish current completion, approval or permission to retry."],
  };
}
function prepare(repo, request) {
  const { task, step, phase, expectedCandidate, attempt = 1 } = request;
  assert(phases.includes(phase), "unsupported workflow phase");
  const owner = request.owner ?? null;
  assert(owner === null || (typeof owner.sessionId === "string" && owner.sessionId && typeof owner.cwd === "string" && isAbsolute(owner.cwd)), "invalid coordinator identity");
  const current = observeCandidate(repo);
  requireExpectedCandidate(current, expectedCandidate);
  const checked = requestedReferences(current.root, request), binding = reviewBinding(request, checked, current), where = location(current.root, task, step, attempt, true);
  try { mkdirSync(where.path, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = load(current.root, request).record;
    assert(same(existing.owner ?? null, owner), "operation belongs to another coordinator session; inspect and reconcile the original before a new attempt");
    assert(existing.phase === phase && same(existing.inputs, checked) && same(existing.reviewBinding ?? null, binding), "operation conflict: stable task/step already has different phase or inputs");
    const result = inspectOperation(current.root, request);
    assert(result.candidateMatches && !result.issues?.length, "operation candidate changed; reconcile its result or use an explicit settled retry");
    return { ...result, reused: true };
  }
  // A crash after the exclusive claim leaves an incomplete operation, never a silent retry.
  const run = createRun(current.root, task, current.id);
  const record = { version: 1, operationId: where.operationId, root: current.root, task, step, attempt, phase,
    input: current, inputs: checked, ...(binding ? { reviewBinding: binding } : {}), owner, previous: request.previous ?? null, reportPath: join(run, `${phase}.md`), artifactsPath: join(run, "artifacts"), implementation: implementation() };
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
  for (const [field, rule] of [["task", WORKFLOW_TASK_NAME], ["step", WORKFLOW_STEP_NAME]]) {
    if (!validName(request[field], rule)) throw new PrepareInputError(field);
  }
  return prepare(repo, request);
}

/** Runtime comes from the extension's session-bound Daddy query, never model-supplied prose. */
function settledRuntime(runtime, operationId, root) {
  assert(runtime?.historical !== true, "historical observation cannot establish live completion");
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
  assert(expected?.state === "complete" && ["sessionId", "messageId", "leafId", "sha256"].every(key => typeof expected[key] === "string" && expected[key] && final[key] === expected[key]) && hash(final.text) === expected.sha256,
    "native final content or identity mismatch");
  return final.text;
}

/** Observe an exact native result without creating Principal metadata or report files. */
export function observeOperationResult(repo, request, runtime) {
  const candidate = observeCandidate(repo), identity = settledRuntime(runtime, request.operationId, candidate.root);
  if (request.expectedCandidate !== undefined) requireExpectedCandidate(candidate, request.expectedCandidate);
  const text = finalText(runtime);
  return { version: 1, state: "observed", approval: false, administrativeWrites: false, storage: "none",
    candidate, runtime: identity, final: { ...identity.runtime.final, text } };
}

export function completeOperation(repo, request, runtime) {
  assert(runtime?.historical !== true, "historical observation cannot establish live completion");
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
  assert(runtime?.historical !== true, "historical observation cannot authorize a retry");
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

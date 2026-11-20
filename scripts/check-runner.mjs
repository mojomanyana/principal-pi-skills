#!/usr/bin/env node
// Run a caller-authorized local check. The receipt describes only this process,
// its declared criteria and the evidence supplied by its adapter.
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fsyncSync, fstatSync, linkSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { privateRoot } from "./progress-artifacts.mjs";
import { inspectRecoveryRecord, observeCandidate } from "./workflow-state.mjs";

const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const token = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const samePaths = (a, b) => Array.isArray(a) && a.length === b.length && a.every((path, i) => path === b[i]);
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const smallScalar = value => value === null || typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value)) ||
  (typeof value === "string" && Buffer.byteLength(value) <= 256 && !/[\x00-\x1f\x7f]/u.test(value));

function criteriaOf(entries) {
  requireValue(Array.isArray(entries) && entries.length <= 32, "provide at most 32 required observations");
  const ids = new Set();
  return entries.map(({ id, expected }) => {
    requireValue(typeof id === "string" && token.test(id) && !ids.has(id) && smallScalar(expected), "criteria require unique stable IDs and bounded JSON scalar expectations");
    ids.add(id);
    return { id, expected };
  }).sort((a, b) => a.id < b.id ? -1 : 1);
}

function readFileRecord(path, limit = 65536) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const before = fstatSync(fd);
    requireValue(before.isFile() && before.size <= limit, "invalid or oversized check record");
    const bytes = Buffer.alloc(before.size);
    const count = readSyncFully(fd, bytes);
    const after = fstatSync(fd);
    requireValue(count === before.size && after.size === before.size && after.mtimeMs === before.mtimeMs, "check record changed during observation");
    return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") };
  } finally { closeSync(fd); }
}

const readRecord = path => readFileRecord(path).value;

function readSyncFully(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = readSync(fd, bytes, offset, bytes.length - offset, null);
    if (!count) break;
    offset += count;
  }
  return offset;
}

function syncDirectory(dir) {
  if (process.platform === "win32") return;
  const fd = openSync(dir, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function recordOnce(dir, name, value) {
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  requireValue(bytes.length <= 65536, "check record exceeds 64 KiB");
  const tmp = join(dir, ".receipt-" + randomUUID());
  const fd = openSync(tmp, "wx", 0o600);
  try {
    try { writeFileSync(fd, bytes); fsyncSync(fd); }
    finally { closeSync(fd); }
    linkSync(tmp, join(dir, name));
    syncDirectory(dir);
  } finally { unlinkSync(tmp); }
}

function exactDir(path, create) {
  if (create) {
    try { mkdirSync(path, { mode: 0o700 }); syncDirectory(resolve(path, "..")); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  }
  requireValue(lstatSync(path).isDirectory() && realpathSync(path) === path, "redirected check directory");
}

function where(repo, { task, step, attempt }, create) {
  requireValue(typeof task === "string" && token.test(task) && typeof step === "string" &&
    step.trim() && step.length <= 200 && Number.isSafeInteger(attempt) && attempt >= 1, "name an existing task, check step and positive attempt");
  const root = create ? privateRoot(repo) : realpathSync(execFileSync("git", ["--no-optional-locks", "-C", repo, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  const key = digest([task, step, attempt]);
  const base = join(root, ".principal", "verification"), dir = join(base, key);
  exactDir(join(root, ".principal"), false);
  exactDir(base, create);
  if (create) {
    for (const file of ["request.json", "result.json", "observations.json", ".receipt-probe"]) {
      execFileSync("git", ["--no-optional-locks", "-C", root, "check-ignore", "-q", "--", relative(root, join(dir, file))], { stdio: "pipe" });
    }
  }
  return { root, dir, operationId: "principal-check:" + digest([root, task, step, attempt]) };
}

function inputReference(root, path) {
  const name = relative(root, path);
  requireValue(name && !isAbsolute(name) && !["..", ".git", ".principal", ".pi"].includes(name.split(sep)[0]) &&
    realpathSync(path) === path, "check inputs must be ordinary files in the current worktree");
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const before = fstatSync(fd);
    requireValue(before.isFile() && before.size <= 16 * 1024 * 1024, "each declared check dependency must be a regular file of at most 16 MiB");
    const bytes = Buffer.alloc(before.size);
    const count = readSyncFully(fd, bytes), after = fstatSync(fd), named = lstatSync(path);
    requireValue(count === before.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs &&
      before.mode === after.mode && before.size === after.size && before.dev === named.dev && before.ino === named.ino &&
      realpathSync(path) === path, "check dependency changed during observation");
    return { path, sha256: createHash("sha256").update(bytes).digest("hex"), mode: before.mode & 0o7777 };
  } finally { closeSync(fd); }
}

function checkedInput(root, ref) {
  try {
    const current = inputReference(root, ref.path);
    return current.sha256 === ref.sha256 && current.mode === ref.mode;
  }
  catch { return false; }
}

function snapshot(root) {
  // Native candidate identity is Linux-only. A standalone check can still
  // bind exact declared files and record the direct process outcome elsewhere.
  if (process.platform !== "linux") return null;
  const { id, algorithm, sourceSha256 } = observeCandidate(root);
  return { id, algorithm, sourceSha256 };
}

function adapterReport(path) {
  try {
    const report = readRecord(path);
    if (report?.version === 1 && report.observed && typeof report.observed === "object" && !Array.isArray(report.observed)) return report;
  } catch { /* Missing, partial or invalid adapter evidence remains unobserved. */ }
}

function compareObservations(report, criteria) {
  const values = report?.observed;
  return criteria.map(({ id, expected }) => {
    const value = values && Object.hasOwn(values, id) ? values[id] : undefined;
    if (!smallScalar(value)) return { id, state: "unobserved" };
    const matches = Object.is(value, expected);
    // Unexpected adapter strings may contain credentials or private text.
    return { id, state: matches ? "satisfied" : "failed",
      ...(typeof value === "string" && !matches ? { observedWithheld: true } : { observed: value }) };
  });
}

export function inspectVerification(repo, { task, step, attempt = 1 }) {
  const { root, dir, operationId } = where(repo, { task, step, attempt }, false);
  exactDir(dir, false);
  const common = { version: 1, operationId, task, step, attempt, approval: false, administrativeWrites: false };
  let request;
  try { request = readRecord(join(dir, "request.json")); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { ...common, state: "claim-unconfirmed", replaySafe: false };
  }
  requireValue(request.version === 1 && request.operationId === operationId &&
    request.task === task && request.step === step && request.attempt === attempt, "verification request identity differs");
  let record;
  try { record = readFileRecord(join(dir, "result.json")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!record) return { ...common, request, state: "settlement-unconfirmed", replaySafe: false };
  const receipt = record.value;
  requireValue(receipt.version === 1 && receipt.operationId === operationId && receipt.requestDigest === digest(request), "verification result identity differs");
  let current;
  try { current = snapshot(root); } catch { /* Historical receipts remain readable. */ }
  const sameSource = current && [request.source, receipt.endSource].every(source => source?.algorithm === current.algorithm && source.id === current.id && source.sourceSha256 === current.sourceSha256);
  return { ...common, state: "recorded", request, receipt,
    applicability: { scope: request.scope ?? "worktree", source: sameSource ? "matching" :
      request.source === null && request.platform !== "linux" ? "unavailable-on-platform" : "changed-or-unobserved",
      inputs: !request.inputs.length && request.source === null ? "not-declared" : receipt.inputsMatchAtEnd && request.inputs.every(ref => checkedInput(root, ref)) ? "matching" : "changed-or-unobserved",
      environment: "not-established", requirements: "as-recorded" },
    reference: { path: join(dir, "result.json"), sha256: record.sha256 } };
}

// Inspect exact retained check references only. Other evidence types can
// support human/domain review, but cannot become machine-observed criteria.
function linkedChecks(operation) {
  const root = operation.root, base = join(root, ".principal", "verification");
  const checks = [];
  for (const ref of operation.evidence ?? []) {
    const parts = relative(base, ref.path).split(sep);
    if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[0]) || parts[1] !== "result.json") continue;
    try {
      exactDir(base, false);
      const dir = join(base, parts[0]);
      exactDir(dir, false);
      const request = readRecord(join(dir, "request.json")), raw = readFileRecord(ref.path);
      const receipt = raw.value;
      if (request.version !== 1 || receipt.version !== 1 || request.task !== operation.task ||
          request.operationId !== "principal-check:" + digest([root, request.task, request.step, request.attempt]) ||
          digest([request.task, request.step, request.attempt]) !== parts[0] || raw.sha256 !== ref.sha256 ||
          receipt.requestDigest !== digest(request) || request.operationId !== receipt.operationId ||
          !Array.isArray(request.criteria) || !Array.isArray(receipt.observations) || !Array.isArray(request.inputs)) continue;
      const target = operation.output ?? operation.candidate;
      const inputsMatch = operation.candidateMatches && operation.inputsMatch && (operation.completionValid || operation.sourceRecovery) &&
        receipt.inputsMatchAtEnd && request.inputs.every(ref => checkedInput(root, ref));
      const sourceMatches = [request.source, receipt.endSource].every(version => version && version.algorithm === target?.algorithm &&
        version.id === target.id && version.sourceSha256 === target.sourceSha256);
      // Older worktree receipts identify the prepared operation but did not copy
      // its criterion digests. Recover their meaning only from that exact record.
      let contracts = request.contracts;
      if (!contracts && request.forOperationId) {
        const original = request.forOperationId === operation.operation_id ? operation :
          inspectRecoveryRecord(root, { operationId: request.forOperationId }).record;
        if (original.task !== operation.task) continue;
        contracts = original.criteria?.map(item => ({ id: item.id, sha256: digest(item) }));
      }
      checks.push({ request, receipt, inputsMatch, sourceMatches, contracts });
    } catch { /* A missing or unreadable receipt cannot contribute positive evidence. */ }
  }
  return checks;
}

export function criterionCoverage(operation) {
  const checks = linkedChecks(operation);
  const criteria = operation.criteria.map(criterion => {
    const statuses = new Set(), sources = [];
    const criterionDigest = digest(criterion);
    for (const { request, receipt, inputsMatch, sourceMatches, contracts } of checks) {
      if (!Object.hasOwn(criterion, "expected") || criterion.fresh && request.forOperationId !== operation.operation_id ||
          !request.criteria.some(item => item.id === criterion.id && Object.is(item.expected, criterion.expected))) continue;
      sources.push(receipt.operationId);
      if (!request.forOperationId || !contracts?.some(contract => contract.id === criterion.id && contract.sha256 === criterionDigest)) continue;
      const inputScoped = criterion.scope === "declared-inputs" && request.scope === "declared-inputs" &&
        samePaths(criterion.dependencies, request.inputs.map(ref => relative(operation.root, ref.path).split(sep).join("/")).sort());
      const requiresInputScope = request.scope === "declared-inputs" || criterion.scope === "declared-inputs";
      if (!inputsMatch || (requiresInputScope ? !inputScoped : !sourceMatches)) continue;
      const item = receipt.observations.find(item => item.id === criterion.id);
      if (item?.state === "failed") statuses.add("failed");
      // A short-lived checker can report terminal failure and still exit zero.
      // Older failed receipts cannot distinguish that case from a sibling mismatch.
      const usableObservation = receipt.outcome === "passed" || receipt.outcome === "incomplete" ||
        (receipt.outcome === "failed" && receipt.adapterReportedFailure === false);
      if (usableObservation && ["exit-zero", "adapter-complete"].includes(receipt.execution?.reason) && receipt.execution?.cleanup?.state === "settled" &&
          item?.state === "satisfied" && Object.is(item.observed, criterion.expected)) statuses.add("supported");
    }
    const state = statuses.size > 1 ? "conflicting" : statuses.values().next().value ??
      (!Object.hasOwn(criterion, "expected") ? "judgment-needed" : sources.length ? "inconclusive" : "unobserved");
    return { id: criterion.id, state, sources };
  });
  const required = criteria.filter((item, i) => operation.criteria[i].required);
  const covered = required.filter(item => item.state === "supported").length;
  const conflicting = required.filter(item => item.state === "conflicting").length;
  const failed = required.filter(item => item.state === "failed").length;
  return { scope: "declared-check-observations", environment: "not-established", approval: false, criteria,
    required: required.length, supported: covered, conflicting, failed,
    state: !required.length ? "no-required-criteria" : conflicting ? "conflicting" : failed ? "failed" :
      covered === required.length ? "supported" : covered ? "partial" : "unverified" };
}

// No arbitrary diagnostic string is retained. A closed vocabulary gives an
// actionable cause even when subprocess output or returned values are private.
const adapterCodes = new Set(["missing-dependency", "access-denied", "invalid-input",
  "fixture-unavailable", "service-unavailable", "unsupported-feature", "assertion-failed",
  "unreadable-artifact", "invalid-output", "unexpected-state"]);
const launchCodes = new Set(["ENOENT", "EACCES", "EPERM", "ENOEXEC", "EAGAIN", "ENOMEM", "EMFILE", "ENFILE", "E2BIG"]);

function supervise(command, args, { cwd, reportPath, timeoutMs, outputLimit, signal }) {
  return new Promise(resolveResult => {
    if (signal?.aborted) {
      resolveResult({ reason: "cancelled", started: false, cleanup: { state: "not-started" }, outputBytes: 0, stdoutBytes: 0, stderrBytes: 0 });
      return;
    }
    const group = process.platform !== "win32";
    const child = spawn(command, args, { cwd, shell: false, detached: group, windowsHide: true,
      env: { ...process.env, PRINCIPAL_CHECK_OBSERVATIONS: reportPath }, stdio: ["ignore", "pipe", "pipe"] });
    const cleanupScope = group ? "owned-process-group" : "direct-child";
    let outputBytes = 0, stdoutBytes = 0, stderrBytes = 0, launchError, reason, escalation, deadline, drain, ended = false, finished = false, started = false;
    const groupExists = () => {
      if (!child.pid || !group) return false;
      try { process.kill(-child.pid, 0); return true; }
      catch (error) { return error.code !== "ESRCH"; }
    };
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer); clearInterval(observationTimer); clearTimeout(escalation); clearTimeout(deadline); clearTimeout(drain);
      signal?.removeEventListener("abort", cancel);
      child.stdout.destroy(); child.stderr.destroy(); child.unref();
      const state = !started ? "not-started" : ended && !groupExists() ? "settled" : "unconfirmed";
      resolveResult({ started, reason: reason ?? (child.exitCode === 0 ? "exit-zero" : "exit-failure"),
        exitCode: child.exitCode, signal: child.signalCode, outputBytes, stdoutBytes, stderrBytes,
        ...(launchError ? { launchError } : {}), cleanup: { scope: cleanupScope, state } });
    }
    function terminate(kind) {
      if (ended || !child.pid) return;
      try { if (group) process.kill(-child.pid, kind); else child.kill(kind); }
      catch { /* A request for termination cannot establish actual cleanup. */ }
    }
    function stop(cause) {
      if (finished || reason) return;
      reason = cause;
      terminate("SIGTERM");
      escalation = setTimeout(() => terminate("SIGKILL"), 500);
      deadline = setTimeout(finish, 1500);
    }
    const cancel = () => stop("cancelled");
    const timer = setTimeout(() => stop("timeout"), timeoutMs);
    // Adapter writes its terminal marker atomically when a GUI reports failure
    // or finishes its checks while its event loop is still running.
    const observationTimer = setInterval(() => {
      if (ended || reason) return;
      const report = adapterReport(reportPath);
      if (!report) return;
      if (report.terminal === "failed") stop("adapter-failed");
      else if (report.terminal === "complete" && Object.keys(report.observed).length) stop("adapter-complete");
    }, 250);
    signal?.addEventListener("abort", cancel, { once: true });
    child.once("spawn", () => { started = true; if (reason) terminate("SIGTERM"); });
    child.once("error", error => {
      launchError = launchCodes.has(error.code) ? error.code : "other";
      reason ??= "spawn-error";
      finish();
    });
    const consume = chunk => { outputBytes += chunk.length; if (outputBytes > outputLimit) stop("output-limit"); };
    child.stdout.on("data", chunk => { stdoutBytes += chunk.length; consume(chunk); });
    child.stderr.on("data", chunk => { stderrBytes += chunk.length; consume(chunk); });
    child.once("exit", () => {
      ended = true;
      if (finished) return;
      // An orphan can inherit a pipe. Bound the wait for close and report
      // incomplete cleanup rather than signalling a potentially recycled PID.
      drain = setTimeout(finish, 500);
    });
    child.once("close", finish);
  });
}

export async function runVerification({ repo = process.cwd(), task, step, attempt = 1, command, args = [],
  criteria = [], inputPaths = [], scope = "worktree", forOperationId, timeoutMs = 60000, outputLimit = 1048576, signal }) {
  requireValue(typeof command === "string" && command.length && !command.includes("\0") && Array.isArray(args) &&
    args.length <= 8192 && args.every(arg => typeof arg === "string" && !arg.includes("\0")) &&
    Buffer.byteLength(command) + args.reduce((total, arg) => total + Buffer.byteLength(arg) + 1, 0) <= 262144,
    "supply an executable and bounded string arguments");
  requireValue(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 2147483647 &&
    Number.isSafeInteger(outputLimit) && outputLimit > 0, "time and output limits must be positive and supported");
  if (forOperationId !== undefined && process.platform !== "linux")
    throw new Error("A prepared-operation check requires Linux candidate identity. A standalone check can record process observations and declared file hashes.");
  const expected = criteriaOf(criteria);
  const cwd = realpathSync(repo);
  const { root, dir, operationId } = where(cwd, { task, step, attempt }, true);
  requireValue(Array.isArray(inputPaths) && inputPaths.length <= 32 &&
    inputPaths.every(path => typeof path === "string" && path.trim() && path.length <= 1024), "provide at most 32 bounded input paths");
  const paths = [...new Set(inputPaths.map(path => resolve(cwd, path)))].sort();
  requireValue(scope === "worktree" || scope === "declared-inputs" && paths.length && expected.length,
    "input-scoped checks require named criteria and explicit dependency files");
  let contracts;
  if (forOperationId !== undefined) {
    requireValue(typeof forOperationId === "string" && /^principal:[a-f0-9]{64}$/.test(forOperationId), "use an exact prepared Principal operation ID");
    const { record } = inspectRecoveryRecord(root, { operationId: forOperationId });
    requireValue(record.task === task, "the check belongs to a different logical task");
    if (scope === "declared-inputs") {
      const declared = paths.map(path => relative(root, path).split(sep).join("/")).sort();
      contracts = expected.map(({ id, expected }) => {
        const criterion = record.criteria?.find(item => item.id === id);
        requireValue(criterion?.scope === scope && Object.is(criterion.expected, expected) &&
          samePaths(criterion.dependencies, declared), "declared check dependencies or expected outcome differ from the prepared criterion");
        return { id, sha256: digest(criterion) };
      });
    } else {
      contracts = (record.criteria ?? []).filter(item => expected.some(check =>
        item.id === check.id && Object.is(item.expected, check.expected)))
        .map(item => ({ id: item.id, sha256: digest(item) }));
    }
  } else requireValue(scope === "worktree", "input-scoped checks require the exact prepared operation");
  const intent = { task, step, attempt, ...(scope === "declared-inputs" ? { scope, contracts } : {}), ...(forOperationId ? { forOperationId } : {}), cwd, inputPaths: paths, commandDigest: digest([command, ...args]), criteria: expected, timeoutMs, outputLimit };
  const intentDigest = digest(intent);
  function existing() {
    exactDir(dir, false);
    const prior = inspectVerification(root, { task, step, attempt });
    if (prior.request) requireValue(prior.request.intentDigest === intentDigest, "attempt already claimed with different inputs");
    return { ...prior, reused: true };
  }
  try { return existing(); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  let previous;
  if (attempt > 1) {
    const prior = inspectVerification(root, { task, step, attempt: attempt - 1 });
    requireValue(prior.state === "recorded" && ["settled", "not-started"].includes(prior.receipt.execution?.cleanup?.state),
      "the previous attempt has no confirmed cleanup; preserve its claim and reconcile it before another check");
    previous = { operationId: prior.operationId, reference: prior.reference };
  }
  const request = { version: 1, operationId, ...intent, ...(contracts ? { contracts } : {}), intentDigest, ...(previous ? { previous } : {}), source: snapshot(root), inputs: paths.map(path => inputReference(root, path)),
    platform: process.platform, arch: process.arch, node: process.version, startedAt: new Date().toISOString() };
  requireValue(Buffer.byteLength(JSON.stringify(request)) < 65536, "check request exceeds 64 KiB");
  try { mkdirSync(dir, { mode: 0o700 }); syncDirectory(resolve(dir, "..")); }
  catch (error) { if (error.code === "EEXIST") return existing(); throw error; }
  recordOnce(dir, "request.json", request);
  const execution = await supervise(command, args, { cwd, reportPath: join(dir, "observations.json"), timeoutMs, outputLimit, signal });
  const reportPath = join(dir, "observations.json");
  const report = adapterReport(reportPath);
  // A still-running or uncertain adapter retains its own privately scoped file.
  // Remove only a disposable file in a settled attempt after saving its result.
  const observations = compareObservations(report, expected);
  let endSource;
  try { endSource = snapshot(root); } catch { /* Preserve even an interrupted/changed project. */ }
  let outcome = "incomplete";
  if (execution.reason === "cancelled") outcome = "cancelled";
  else if (["exit-failure", "adapter-failed"].includes(execution.reason) || report?.terminal === "failed" || observations.some(item => item.state === "failed")) outcome = "failed";
  else if ((execution.reason === "exit-zero" || execution.reason === "adapter-complete" && expected.length > 0) &&
      execution.cleanup.state === "settled" &&
      observations.every(item => item.state === "satisfied")) outcome = "passed";
  const receipt = { version: 1, operationId, requestDigest: digest(request), observedAt: new Date().toISOString(),
    scope: expected.length ? "declared-observations" : "process-exit-only", outcome, execution, observations, endSource,
    ...(outcome === "failed" ? { adapterReportedFailure: report?.terminal === "failed" || execution.reason === "adapter-failed" } : {}),
    diagnostic: { output: execution.outputBytes ? "raw-output-withheld" : "no-output",
      ...(adapterCodes.has(report?.diagnosticCode) ? { adapterCode: report.diagnosticCode } : {}),
      missing: observations.filter(item => item.state === "unobserved").map(item => item.id),
      mismatched: observations.filter(item => item.state === "failed").map(item => item.id) },
    inputsMatchAtEnd: request.inputs.every(ref => checkedInput(root, ref)) };
  recordOnce(dir, "result.json", receipt);
  if (execution.cleanup.state === "settled") {
    try { unlinkSync(reportPath); } catch { /* The immutable result has already been published. */ }
  }
  return { ...inspectVerification(root, { task, step, attempt }), administrativeWrites: true, reused: false };
}

let invokedDirectly = false;
try { invokedDirectly = import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { /* Imported outside a file-based entry point. */ }

if (invokedDirectly) {
  try {
    const [action, ...raw] = process.argv.slice(2);
    const split = raw.indexOf("--");
    const { values } = parseArgs({ args: split < 0 ? raw : raw.slice(0, split), options: {
      repo: { type: "string" }, task: { type: "string" }, step: { type: "string" }, attempt: { type: "string" },
      operation: { type: "string" }, scope: { type: "string" }, input: { type: "string", multiple: true }, criterion: { type: "string", multiple: true }, "timeout-ms": { type: "string" }, "max-output-bytes": { type: "string" },
    } });
    const selector = { repo: values.repo ?? process.cwd(), task: values.task, step: values.step, attempt: Number(values.attempt ?? 1) };
    let result;
    if (action === "show" && split < 0) result = inspectVerification(selector.repo, selector);
    else if (action === "run" && split >= 0 && raw[split + 1]) {
      const controller = new AbortController(), cancel = () => controller.abort();
      process.on("SIGINT", cancel); process.on("SIGTERM", cancel);
      try {
        const criteria = (values.criterion ?? []).map(arg => {
          const idx = arg.indexOf("=");
          requireValue(idx > 0, "criterion syntax is id=JSON-scalar");
          return { id: arg.slice(0, idx), expected: JSON.parse(arg.slice(idx + 1)) };
        });
        result = await runVerification({ ...selector, command: raw[split + 1], args: raw.slice(split + 2), criteria, inputPaths: values.input, scope: values.scope, forOperationId: values.operation,
          timeoutMs: Number(values["timeout-ms"] ?? 60000), outputLimit: Number(values["max-output-bytes"] ?? 1048576),
          signal: controller.signal });
      } finally { process.off("SIGINT", cancel); process.off("SIGTERM", cancel); }
    } else throw Error("use run --task T --step S [--criterion id=true] -- command args, or show --task T --step S");
    console.log(JSON.stringify(result));
    if (action === "run" && (result.receipt?.outcome !== "passed" ||
        result.applicability?.inputs !== "matching" ||
        result.applicability?.scope !== "declared-inputs" && result.applicability?.source !== "matching")) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

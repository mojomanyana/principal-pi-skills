#!/usr/bin/env node
// Coordinator-owned evidence files, not a scheduler, approval record or candidate-equivalence engine.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, unlinkSync, writeSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const phases = ["planned", "implemented", "reviewed", "integrated", "verified"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (repo, args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const fail = message => { throw new Error(message); };
function text(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be nonempty text`);
}
function object(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`unknown ${label} field: ${key}`);
}
function plain(path, type) {
  const info = lstatSync(path);
  if (info.isSymbolicLink()) fail(`symlink refused: ${path}`);
  if (!(type === "directory" ? info.isDirectory() : info.isFile())) fail(`not a regular ${type}: ${path}`);
}
function directory(path) {
  try { mkdirSync(path, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
  plain(path, "directory");
}
function ignored(repo, path) {
  try { git(repo, ["check-ignore", "--quiet", "--", path]); }
  catch { fail(`artifact path is not ignored by existing policy: ${path}`); }
}
function durableWrite(path, bytes, flag = constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY) {
  const fd = openSync(path, flag | (constants.O_NOFOLLOW ?? 0), 0o600);
  try {
    const buffer = Buffer.from(bytes);
    let offset = 0;
    while (offset < buffer.length) offset += writeSync(fd, buffer, offset, buffer.length - offset);
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

/** Allocate an unused private candidate directory without changing an existing ignore policy. */
export function createRun(repo, task, candidate) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(task)) fail("task must be a short safe name");
  text(candidate, "candidate");
  const root = realpathSync(git(repo, ["rev-parse", "--show-toplevel"]));
  const principal = join(root, ".principal");
  directory(principal);
  const ignore = join(principal, ".gitignore");
  try { durableWrite(ignore, "*\n"); } catch (error) { if (error.code !== "EEXIST") throw error; }
  plain(ignore, "file");
  ignored(root, join(principal, "reports", "unused-probe"));
  const reports = join(principal, "reports");
  directory(reports);
  const run = mkdtempSync(join(reports, `${task}-`));
  const path = join(run, hash(candidate).slice(0, 16));
  directory(path);
  ignored(root, join(path, "run.json"));
  durableWrite(join(path, "run.json"), `${JSON.stringify({ version: 1, root, candidate })}\n`);
  return path;
}

function runInfo(run) {
  const path = resolve(run);
  // Validate every artifact ancestor; no caller-controlled symlink redirects writes elsewhere.
  const root = realpathSync(git(path, ["rev-parse", "--show-toplevel"]));
  const parts = relative(root, path).split(sep);
  if (parts.length !== 4 || parts[0] !== ".principal" || parts[1] !== "reports" || parts.includes("..")) fail("not a Principal candidate directory");
  let current = root;
  for (const part of parts) { current = join(current, part); plain(current, "directory"); }
  plain(join(path, "run.json"), "file");
  const info = JSON.parse(readFileSync(join(path, "run.json"), "utf8"));
  object(info, ["version", "root", "candidate"], "run manifest");
  text(info.candidate, "run candidate");
  if (info.version !== 1 || info.root !== root || typeof info.candidate !== "string" || hash(info.candidate).slice(0, 16) !== parts[3]) fail("invalid run identity");
  ignored(root, join(path, "unused-probe"));
  return { path, version: 1, root, candidate: info.candidate };
}

/** References identify exact file bytes, not the truth of their contents or a filesystem snapshot. */
export function reference(path) {
  plain(path, "file");
  const canonical = realpathSync(path);
  return { path: canonical, sha256: hash(readFileSync(canonical)) };
}
export function saveReport(run, name, contents) {
  const { path, root } = runInfo(run);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$/.test(name)) fail("report name must be a simple .md filename");
  if (typeof contents !== "string" || !contents.trim()) fail("report contents must be complete nonempty text");
  const destination = join(path, name);
  ignored(root, destination);
  durableWrite(destination, contents);
  return reference(destination);
}

/** Preserve original producer bytes. Matching bytes establish integrity, never approval or settlement. */
export function copyArtifact(run, name, source, expectedSha256) {
  const { path, root } = runInfo(run);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) || ["run.json", "progress.jsonl"].includes(name)) fail("artifact name must be a simple non-reserved filename");
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedSha256)) fail("expected SHA-256 is required");
  const original = resolve(source);
  plain(original, "file");
  const canonical = realpathSync(original);
  const identity = stat => [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
  const fd = openSync(original, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  let bytes;
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) fail("source must be a regular file");
    bytes = readFileSync(fd);
    const after = fstatSync(fd, { bigint: true }), named = lstatSync(original, { bigint: true });
    if (BigInt(bytes.length) !== before.size || identity(before) !== identity(after) || identity(before) !== identity(named) || realpathSync(original) !== canonical) fail("source changed while copying");
  } finally { closeSync(fd); }
  if (hash(bytes) !== expectedSha256) fail("source does not match expected SHA-256");
  const destination = join(path, name);
  ignored(root, destination);
  durableWrite(destination, bytes);
  const copy = reference(destination);
  if (copy.sha256 !== expectedSha256) fail("copied artifact failed integrity check; preserve it for diagnosis");
  return { source: { path: canonical, sha256: expectedSha256 }, copy };
}

function refSchema(ref) {
  object(ref, ["path", "sha256"], "reference");
  if (typeof ref.path !== "string" || !isAbsolute(ref.path) || !/^[a-f0-9]{64}$/.test(ref.sha256)) fail("reference requires absolute path and SHA-256");
}
function refIssue(ref) {
  try { return reference(ref.path).sha256 === ref.sha256 ? null : `changed evidence: ${ref.path}`; }
  catch (error) { return `unavailable evidence: ${ref.path} (${error.message})`; }
}
function validate(record) {
  object(record, ["version", "plan", "step", "candidate", "facts", "findings", "nextAction"], "record");
  if (record.version !== 1) fail("unsupported progress version");
  text(record.step, "step"); text(record.candidate, "candidate"); text(record.nextAction, "nextAction");
  if (record.plan !== null) refSchema(record.plan);
  object(record.facts, phases, "facts");
  for (const phase of phases) {
    const fact = record.facts[phase];
    object(fact, ["state", "evidence", "note"], `${phase} fact`);
    if (!["unknown", "incomplete", "complete"].includes(fact.state)) fail(`invalid ${phase} state`);
    text(fact.note, `${phase} note`);
    if (!Array.isArray(fact.evidence)) fail(`${phase} evidence must be an array`);
    fact.evidence.forEach(refSchema);
    if (fact.state === "complete" && !fact.evidence.length) fail(`${phase} complete requires evidence`);
  }
  if (!Array.isArray(record.findings)) fail("findings must be an array");
  const ids = new Set();
  for (const finding of record.findings) {
    object(finding, ["id", "source", "status", "duplicateOf"], "finding");
    text(finding.id, "finding id"); refSchema(finding.source);
    if (ids.has(finding.id)) fail(`duplicate finding id: ${finding.id}`);
    ids.add(finding.id);
    if (!["open", "accepted", "addressed", "verified", "disputed", "duplicate", "stale"].includes(finding.status)) fail("invalid finding status");
    if (finding.status === "duplicate") {
      text(finding.duplicateOf, "duplicateOf");
      if (finding.duplicateOf === finding.id) fail("finding cannot duplicate itself");
    } else if (finding.duplicateOf !== undefined) fail("duplicateOf requires duplicate status");
  }
}
function parseIndex(path) {
  try { plain(path, "file"); }
  catch (error) { if (error.code === "ENOENT") return { records: [], issues: [] }; throw error; }
  const content = readFileSync(path, "utf8"), lines = content.split("\n"), issues = [], records = [];
  if (lines.pop() !== "") issues.push("incomplete final record ignored; preserve index and start a new run before appending");
  for (const [index, line] of lines.entries()) {
    try { const record = JSON.parse(line); validate(record); records.push(record); }
    catch (error) { issues.push(`invalid record ${index + 1}: ${error.message}`); }
  }
  return { records, issues };
}

/** Append a snapshot of independently established facts. Failure never deletes a report. */
export function appendProgress(run, record) {
  const info = runInfo(run);
  validate(record);
  if (record.candidate !== info.candidate) fail("candidate differs from run; allocate a new candidate run");
  const refs = [...Object.values(record.facts).flatMap(fact => fact.evidence), ...record.findings.map(finding => finding.source), ...(record.plan ? [record.plan] : [])];
  for (const ref of refs) { const issue = refIssue(ref); if (issue) fail(issue); }
  const lock = join(info.path, ".progress.lock");
  ignored(info.root, lock);
  ignored(info.root, join(info.path, "progress.jsonl"));
  try { durableWrite(lock, `coordinator pid ${process.pid}\n`); }
  catch (error) { fail(`progress writer lock unavailable; inspect owner, never force-clear: ${error.message}`); }
  try {
    const index = join(info.path, "progress.jsonl"), prior = parseIndex(index);
    if (prior.issues.length) fail(prior.issues.join("; "));
    durableWrite(index, `${JSON.stringify(record)}\n`, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY);
  } finally { unlinkSync(lock); }
}

// Reuse exact evidence bytes only inside this reconciliation. Every expected hash is
// still checked, and final path/identity observations invalidate all affected claims.
function reconcileReferences(records) {
  const paths = new Map(), files = new Map();
  const observe = path => {
    const info = lstatSync(path, { bigint: true });
    if (info.isSymbolicLink()) fail(`symlink refused: ${path}`);
    if (!info.isFile()) fail(`not a regular file: ${path}`);
    return { canonical: realpathSync(path), identity: [info.dev, info.ino, info.mode, info.size, info.mtimeNs, info.ctimeNs].map(String).join(":") };
  };
  const same = (left, right) => left.canonical === right.canonical && left.identity === right.identity;
  const unavailable = (path, error) => `unavailable evidence: ${path} (${error.message})`;
  for (const record of records) {
    const refs = [...Object.values(record.facts).flatMap(fact => fact.evidence), ...record.findings.map(finding => finding.source), ...(record.plan ? [record.plan] : [])];
    for (const ref of refs) {
      if (paths.has(ref.path)) continue;
      try {
        const observed = observe(ref.path);
        let file = files.get(observed.canonical);
        if (!file) {
          const digest = hash(readFileSync(observed.canonical));
          if (!same(observed, observe(ref.path))) fail("evidence changed while reading");
          file = { observed, digest };
          files.set(observed.canonical, file);
        } else if (!same(file.observed, observed)) fail("evidence changed during reconciliation");
        paths.set(ref.path, { observed, file });
      } catch (error) { paths.set(ref.path, { issue: unavailable(ref.path, error) }); }
    }
  }
  for (const [path, value] of paths) {
    if (value.issue) continue;
    try { if (!same(value.observed, observe(path))) fail("evidence changed during reconciliation"); }
    catch (error) { value.issue = unavailable(path, error); }
  }
  return ref => {
    const value = paths.get(ref.path);
    return value.issue ?? (value.file.digest === ref.sha256 ? null : `changed evidence: ${ref.path}`);
  };
}

/** Reconcile evidence only. A supplied candidate is an assertion by the caller, not approval. */
export function readProgress(run, expectedCandidate = null) {
  const info = runInfo(run), parsed = parseIndex(join(info.path, "progress.jsonl"));
  const evidenceIssue = reconcileReferences(parsed.records);
  return {
    issues: [...parsed.issues, ...(parsed.records.length ? [] : ["no complete progress record; progress incomplete"])],
    records: parsed.records.map(record => {
      const issues = [], facts = {};
      const planIssue = record.plan ? evidenceIssue(record.plan) : null;
      if (planIssue) issues.push(planIssue);
      for (const phase of phases) {
        const fact = record.facts[phase], failures = fact.evidence.map(evidenceIssue).filter(Boolean);
        if (planIssue) failures.push("plan evidence changed or unavailable");
        if (phase !== "planned" && (record.candidate !== expectedCandidate || record.candidate !== info.candidate)) failures.push("candidate unconfirmed or changed");
        facts[phase] = { ...fact, state: failures.length ? "unknown" : fact.state };
        issues.push(...failures.map(issue => `${phase}: ${issue}`));
      }
      for (const finding of record.findings) { const issue = evidenceIssue(finding.source); if (issue) issues.push(`finding ${finding.id}: ${issue}`); }
      return { record, facts, issues };
    }),
  };
}

/** Check index integrity, not completion, approval, evidence meaning or candidate equivalence. */
export function checkProgress(run, expectedCandidate) {
  text(expectedCandidate, "expected candidate");
  const result = readProgress(run, expectedCandidate);
  return { integrityValid: result.issues.length === 0 && result.records.every(record => record.issues.length === 0), ...result };
}


/** Read-only full-workflow checks. Recorded claims never establish semantic approval or acceptance. */
export function checkCompletion(run, expectedCommit, requiredSteps) {
  if (typeof expectedCommit !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expectedCommit)) fail("expected commit must be a full lowercase Git object ID");
  if (!Array.isArray(requiredSteps) || !requiredSteps.length) fail("required steps must be a nonempty explicit array");
  for (const step of requiredSteps) text(step, "required step");
  if (new Set(requiredSteps).size !== requiredSteps.length) fail("required steps must not contain duplicates");
  const info = runInfo(run);
  const repositoryState = () => ({
    head: git(info.root, ["rev-parse", "--verify", "HEAD"]),
    status: git(info.root, ["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"]),
    maskedIndex: git(info.root, ["ls-files", "-v", "-z"]).split("\0").filter(entry => /^[a-zS] /.test(entry)),
    gitlinks: git(info.root, ["ls-files", "--stage", "-z"]).split("\0").filter(entry => /^160000 /.test(entry)),
  });
  // Compare observations around the evidence read. This is not a lock or atomic filesystem snapshot.
  const before = repositoryState();
  const checked = checkProgress(run, expectedCommit), latest = new Map(), findings = new Map();
  checked.records.forEach((entry, index) => {
    latest.set(entry.record.step, { entry, recordNumber: index + 1 });
    for (const finding of entry.record.findings) {
      // An omitted unresolved finding stays unresolved; reusing its ID with another report cannot erase it.
      const identity = JSON.stringify([entry.record.step, finding.source.path, finding.source.sha256, finding.id]);
      findings.set(identity, { step: entry.record.step, ...finding });
    }
  });
  const after = repositoryState();
  const repositoryStateUnchanged = before.head === after.head && before.status === after.status && JSON.stringify(before.maskedIndex) === JSON.stringify(after.maskedIndex) && JSON.stringify(before.gitlinks) === JSON.stringify(after.gitlinks);
  const exactHead = expectedCommit === before.head && expectedCommit === after.head;
  const indexVisibilitySupported = before.maskedIndex.length === 0 && after.maskedIndex.length === 0;
  const submodulesSupported = before.gitlinks.length === 0 && after.gitlinks.length === 0;
  const workingTreeClean = before.status === "" && after.status === "" && indexVisibilitySupported && submodulesSupported;
  const missingSteps = requiredSteps.filter(step => !latest.has(step));
  const unexpectedSteps = [...latest.keys()].filter(step => !requiredSteps.includes(step));
  const steps = requiredSteps.filter(step => latest.has(step)).map(step => {
    const { entry, recordNumber } = latest.get(step);
    return { step, recordNumber, phases: Object.fromEntries(phases.map(phase => [phase, entry.facts[phase].state])) };
  });
  const phaseClaimsComplete = missingSteps.length === 0 && steps.every(step => phases.every(phase => step.phases[phase] === "complete"));
  // v1 carries no machine-readable acceptance/duplicate disposition. Only explicit verification closes this check.
  const unresolvedFindings = [...findings.values()].filter(finding => finding.status !== "verified");
  const issues = [
    ...checked.issues,
    ...checked.records.flatMap((entry, index) => entry.issues.map(issue => `record ${index + 1}: ${issue}`)),
    ...(info.candidate === expectedCommit ? [] : ["run candidate differs from expected full commit"]),
    ...(exactHead ? [] : ["expected commit differs from current HEAD"]),
    ...(indexVisibilitySupported ? [] : ["tracked paths use assume-unchanged or skip-worktree flags; clean candidate cannot be established"]),
    ...(submodulesSupported ? [] : ["indexed gitlinks/submodules are unsupported by completion checking; nested clean state cannot be established"]),
    ...(before.status === "" && after.status === "" ? [] : ["working tree or index has tracked, untracked or submodule changes"]),
    ...(repositoryStateUnchanged ? [] : ["repository state changed during completion check"]),
    ...missingSteps.map(step => `missing required step: ${step}`),
    ...unexpectedSteps.map(step => `unexpected step: ${step}`),
    ...steps.flatMap(step => phases.filter(phase => step.phases[phase] !== "complete").map(phase => `${step.step}: ${phase} is ${step.phases[phase]}`)),
    ...unresolvedFindings.map(finding => `${finding.step}: finding ${finding.id} is ${finding.status}; explicit verified disposition required`),
  ];
  return {
    completionChecksPassed: checked.integrityValid && issues.length === 0,
    integrityValid: checked.integrityValid,
    candidate: { expected: expectedCommit, head: after.head, exactHead, workingTreeClean, indexVisibilitySupported, submodulesSupported, repositoryStateUnchanged },
    requiredSteps: [...requiredSteps], missingSteps, unexpectedSteps, steps, phaseClaimsComplete,
    unresolvedFindings, issues, approval: "not-assessed", taskAcceptance: "not-assessed",
  };
}

function main(args) {
  const [command, ...rest] = args;
  if (command === "create" && rest.length === 3) return createRun(...rest);
  if (command === "report" && rest.length === 2) return saveReport(...rest, readFileSync(0, "utf8"));
  if (command === "copy" && rest.length === 4) return copyArtifact(...rest);
  if (command === "reference" && rest.length === 1) return reference(rest[0]);
  if (command === "append" && rest.length === 1) { appendProgress(rest[0], JSON.parse(readFileSync(0, "utf8"))); return { appended: true }; }
  if (command === "read" && rest.length >= 1 && rest.length <= 2) return readProgress(...rest);
  if (command === "check-completion" && rest.length >= 3) {
    const result = checkCompletion(rest[0], rest[1], rest.slice(2));
    if (!result.completionChecksPassed) process.exitCode = 1;
    return result;
  }
  if (command === "check" && rest.length === 2) {
    const result = checkProgress(...rest);
    if (!result.integrityValid) process.exitCode = 1;
    return result;
  }
  fail("usage: principal-pi-progress create <repo> <task> <candidate> | report <run> <name.md> < full-report | copy <run> <name> <source> <expected-sha256> | reference <file> | append <run> < record.json | read <run> [candidate] | check <run> <candidate> | check-completion <run> <full-commit> <required-step>...");
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(`principal-pi-progress: ${error.message}`); process.exitCode = 1; }
}
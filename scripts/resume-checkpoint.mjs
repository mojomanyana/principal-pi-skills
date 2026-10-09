#!/usr/bin/env node
// Quiescent checkpoint evidence and one-shot state. Only the interactive extension can authorize/queue.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants, openSync, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, readFileSync, readSync, readdirSync, realpathSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { checkProgress } from "./progress-artifacts.mjs";

const HASH = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PHASES = ["build", "review", "git-ops"];
const MAX_FILE = 16 * 1024 * 1024;
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = message => { throw new Error(message); };
const json = value => JSON.stringify(value);
const equal = (a, b) => json(a) === json(b);
const git = (root, args) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(execFileSync("git", ["--no-optional-locks", ...args], { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
const gitPath = value => {
  if (!value.endsWith("\n") || value.slice(0, -1).includes("\n")) fail("newline-containing Git paths are unsupported");
  return value.slice(0, -1); // Preserve legitimate leading/trailing path whitespace.
};
function text(value, name, max = 4096) { if (typeof value !== "string" || !value.trim() || value.length > max || value.includes("\0")) fail(`invalid ${name}`); }
function exact(value, keys, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) fail(`invalid ${name} fields`);
}
function plain(path, directory = false) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) fail(`nonregular path refused: ${path}`);
  return stat;
}
function ancestors(path) {
  const absolute = resolve(path);
  for (let parent = dirname(absolute); ; parent = dirname(parent)) {
    plain(parent, true);
    if (parent === dirname(parent)) break;
  }
  return absolute;
}
function bytes(path) {
  const absolute = ancestors(path), fd = openSync(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > MAX_FILE) fail("artifact must be an ordinary file within the 16 MiB limit");
    const buffer = Buffer.alloc(before.size + 1); let size = 0;
    while (size < buffer.length) { const count = readSync(fd, buffer, size, buffer.length - size, size); if (!count) break; size += count; }
    const data = buffer.subarray(0, size), after = fstatSync(fd), named = plain(absolute);
    const identity = s => [s.dev, s.ino, s.mode, s.size, s.mtimeMs, s.ctimeMs].join(":");
    if (data.length !== before.size || identity(before) !== identity(after) || identity(before) !== identity(named)) fail("artifact changed while reading");
    return data;
  } finally { closeSync(fd); }
}
function parsed(path) { return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes(path))); }
function reference(path) { const absolute = resolve(path); return { path: absolute, sha256: hash(bytes(absolute)) }; }
function verifyRef(ref) { exact(ref, ["path", "sha256"], "reference"); if (!isAbsolute(ref.path) || !HASH.test(ref.sha256) || hash(bytes(ref.path)) !== ref.sha256) fail(`changed evidence: ${ref.path}`); }
function syncDirectory(path) { const fd = openSync(path, constants.O_RDONLY); try { fsyncSync(fd); } finally { closeSync(fd); } }
function writeNew(path, value, raw = false) {
  ancestors(path);
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { const data = Buffer.from(raw ? value : json(value) + "\n"); let offset = 0; while (offset < data.length) offset += writeSync(fd, data, offset, data.length - offset); fsyncSync(fd); }
  finally { closeSync(fd); }
  syncDirectory(dirname(path));
}
function present(path) { try { plain(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
function directory(path) { try { mkdirSync(path, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; } ancestors(path); plain(path, true); }
function insideScope(path, scopes) { return scopes.some(scope => path === scope || scope.endsWith("/") && path.startsWith(scope)); }
function safeScope(scope) {
  text(scope, "scope");
  if (isAbsolute(scope) || scope.includes("\\") || scope.split("/").some(p => p === ".." || p === "." || p === ".git" || p === ".principal") || scope.startsWith("/") || scope.includes("//")) fail("scope must be a relative source path or directory ending in /; Git and Principal metadata are excluded");
}

/** Observational fingerprint, not a worktree lock. Ignored material is deliberately excluded. */
export function candidateSnapshot(repo) {
  if (process.platform !== "linux") fail("automatic resume currently requires Linux");
  const root = realpathSync(gitPath(git(repo, ["rev-parse", "--show-toplevel"])));
  const commonDir = realpathSync(resolve(root, gitPath(git(root, ["rev-parse", "--git-common-dir"]))));
  const gitDir = realpathSync(gitPath(git(root, ["rev-parse", "--absolute-git-dir"])));
  const rootStat = plain(root, true), gitStat = plain(gitDir, true);
  const read = () => {
    const head = git(root, ["rev-parse", "--verify", "HEAD"]).trim();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) fail("full committed HEAD required");
    const flags = git(root, ["ls-files", "-v", "-z"]).split("\0").filter(Boolean);
    if (flags.some(row => /^[a-zS] /.test(row))) fail("masked index entries cannot be resumed");
    const index = git(root, ["ls-files", "--stage", "-z"]);
    if (index.split("\0").some(row => /^160000 /.test(row) || /^\d+ [a-f0-9]+ [123]\t/.test(row))) fail("submodules or unmerged index cannot be resumed");
    const indexRows = index.split("\0").filter(Boolean).map(row => {
      const match = /^(100644|100755) ([a-f0-9]+) 0\t([\s\S]+)$/.exec(row);
      if (!match) fail("tracked symlinks or unsupported index modes cannot be resumed");
      return { mode: match[1], blob: match[2], path: match[3] };
    });
    if (indexRows.length > 16384) fail("too many tracked files for a resume checkpoint");
    const objectFormat = git(root, ["rev-parse", "--show-object-format"]).trim();
    if (!["sha1", "sha256"].includes(objectFormat)) fail("unsupported Git object format");
    let trackedTotal = 0;
    const rawChanged = [];
    const tracked = indexRows.map(row => {
      const full = join(root, row.path);
      let data;
      try { data = bytes(full); } catch (error) {
        if (error.code !== "ENOENT") throw error;
        rawChanged.push(row.path); return { path: row.path, missing: true };
      }
      trackedTotal += data.length;
      if (trackedTotal > 256 * 1024 * 1024) fail("tracked byte limit exceeded");
      const mode = plain(full).mode & 0o777;
      const blob = createHash(objectFormat).update(`blob ${data.length}\0`).update(data).digest("hex");
      if (blob !== row.blob || Boolean(mode & 0o111) !== (row.mode === "100755")) rawChanged.push(row.path);
      return { path: row.path, sha256: hash(data), mode };
    });
    const staged = git(root, ["diff", "--cached", "--binary", "--no-ext-diff", "--no-textconv", "--no-renames", "HEAD", "--"]);
    const unstaged = git(root, ["diff", "--binary", "--no-ext-diff", "--no-textconv", "--no-renames", "--"]);
    const changed = [...git(root, ["diff", "--name-only", "--no-ext-diff", "--no-textconv", "--no-renames", "-z", "--"]).split("\0"), ...git(root, ["diff", "--cached", "--name-only", "--no-ext-diff", "--no-textconv", "--no-renames", "-z", "HEAD", "--"]).split("\0")].filter(Boolean);
    const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort();
    if (untracked.length > 256) fail("too many untracked files for a resume checkpoint");
    let total = 0;
    const files = untracked.map(path => { const full = join(root, path), data = bytes(full); total += data.length; if (total > 64 * 1024 * 1024) fail("untracked byte limit exceeded"); return { path, sha256: hash(data), mode: plain(full).mode & 0o777 }; });
    return { head, branch: git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(), indexSha256: hash(index), stagedSha256: hash(staged), unstagedSha256: hash(unstaged), tracked, untracked: files, changedPaths: [...new Set([...changed, ...rawChanged, ...untracked])].sort() };
  };
  const before = read(), after = read();
  if (!equal(before, after)) fail("candidate changed during observation");
  const state = { root, commonDir, gitDir, worktreeIdentity: [rootStat.dev, rootStat.ino, gitStat.dev, gitStat.ino].join(":"), ...after };
  return { ...state, id: after.changedPaths.length === 0 && after.stagedSha256 === hash("") && after.unstagedSha256 === hash("") ? after.head : `dirty:${hash(json(state))}` };
}
function resumeRoot(root, create = false) {
  const principal = join(root, ".principal"), path = join(principal, "resume");
  if (create) {
    directory(principal);
    try { writeNew(join(principal, ".gitignore"), "*\n", true); } catch (error) { if (error.code !== "EEXIST") throw error; }
    directory(path);
  } else { ancestors(path); plain(path, true); }
  git(root, ["check-ignore", "--quiet", "--", join(path, "checkpoint-probe.json")]);
  return path;
}
export function packageIdentity(root) {
  const names = ["package.json", "AGENTS.md", "principal-agents.json", "bootstrap/BOOTSTRAP.md", "extensions/bootstrap.ts", "extensions/resume.ts", "scripts/resume-checkpoint.mjs", "scripts/progress-artifacts.mjs", "scripts/snapshot-workspace.mjs", "scripts/install-agents.mjs"];
  for (const phase of ["decide", "architect", "plan", "build", "review", "test-review", "debug", "investigate", "git-ops"]) names.push(`${phase}/SKILL.md`);
  for (const phase of ["plan", "build", "review", "test-review", "debug", "investigate"]) names.push(`agents/principal-${phase}.md`);
  for (const name of ["feature", "bugfix", "refactor", "review-branch"]) names.push(`prompts/principal-${name}.md`);
  return { root: realpathSync(root), sha256: hash(json(names.map(name => [name, hash(bytes(join(root, name)))]))) };
}
function requestSchema(request) {
  exact(request, ["version", "task", "plan", "scope", "phase", "step", "repairsRemaining", "reports", "progressRun"], "resume request");
  if (request.version !== 1 || !PHASES.includes(request.phase)) fail("unsupported resume version or phase");
  text(request.task, "task", 500); text(request.plan, "plan"); text(request.step, "step", 160);
  if (!isAbsolute(request.plan) || !Array.isArray(request.scope) || request.scope.length < 1 || request.scope.length > 128 || new Set(request.scope).size !== request.scope.length) fail("explicit unique source scope required");
  request.scope.forEach(safeScope);
  if (!Number.isInteger(request.repairsRemaining) || request.repairsRemaining < 0 || request.repairsRemaining > 2) fail("repair budget must be 0..2");
  if (!Array.isArray(request.reports) || request.reports.length > 64 || request.reports.some(p => typeof p !== "string" || !isAbsolute(p))) fail("reports must be explicit absolute paths");
  if (request.phase !== "build" && request.reports.length === 0) fail("review/finish checkpoint needs original full report references");
  if (request.progressRun !== null && (typeof request.progressRun !== "string" || !isAbsolute(request.progressRun))) fail("progressRun must be an absolute path or null");
}
export function prepareCheckpoint(repo, request, packageRoot) {
  requestSchema(request);
  const candidate = candidateSnapshot(repo);
  if (candidate.changedPaths.some(path => !insideScope(path, request.scope))) fail("existing candidate changes exceed authorized source scope");
  const plan = reference(request.plan), reports = request.reports.map(reference), sources = packageIdentity(packageRoot);
  let progress = null;
  if (request.progressRun !== null) {
    if (!checkProgress(request.progressRun, candidate.id).integrityValid) fail("progress does not reconcile to this exact candidate");
    progress = { run: resolve(request.progressRun), files: [reference(join(request.progressRun, "run.json")), reference(join(request.progressRun, "progress.jsonl"))] };
  }
  const parent = resumeRoot(candidate.root, true), id = randomUUID(), path = join(parent, id);
  directory(path);
  const checkpoint = { schema: "principal-resume-v1", version: 1, id, task: request.task, plan, scope: [...request.scope], phase: request.phase, step: request.step, repairsRemaining: request.repairsRemaining, reports, progress, candidate, package: sources };
  writeNew(join(path, "checkpoint.json"), checkpoint);
  return { path, checkpoint, checkpointSha256: hash(bytes(join(path, "checkpoint.json"))) };
}
function checkpointInfo(path) {
  const absolute = resolve(path), root = realpathSync(gitPath(git(absolute, ["rev-parse", "--show-toplevel"])));
  if (dirname(absolute) !== resumeRoot(root) || !UUID.test(absolute.split(sep).at(-1))) fail("not a Principal resume checkpoint");
  ancestors(absolute); plain(absolute, true);
  const checkpointBytes = bytes(join(absolute, "checkpoint.json"));
  const checkpoint = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(checkpointBytes));
  exact(checkpoint, ["schema", "version", "id", "task", "plan", "scope", "phase", "step", "repairsRemaining", "reports", "progress", "candidate", "package"], "checkpoint");
  if (checkpoint.schema !== "principal-resume-v1" || checkpoint.id !== absolute.split(sep).at(-1) || checkpoint.candidate.root !== root) fail("checkpoint identity mismatch");
  requestSchema({ version: checkpoint.version, task: checkpoint.task, plan: checkpoint.plan.path, scope: checkpoint.scope, phase: checkpoint.phase, step: checkpoint.step, repairsRemaining: checkpoint.repairsRemaining, reports: checkpoint.reports.map(ref => ref.path), progressRun: checkpoint.progress?.run ?? null });
  return { path: absolute, checkpoint, checkpointSha256: hash(checkpointBytes) };
}
// State inventory verifies bounded checkpoint-bound control files without inspecting historical worktrees.
function checkpointState(info) {
  const records = {};
  for (const name of ["authorization", "consumed", "enqueued", "disarmed"]) {
    const path = join(info.path, name + ".json");
    if (!present(path)) continue;
    const value = parsed(path);
    exact(value, name === "authorization" ? ["schema", "checkpointSha256", "source", "session", "runtime"] : ["schema", "checkpointSha256"], `${name} record`);
    if (value.schema !== `principal-resume-${name}-v1` || value.checkpointSha256 !== info.checkpointSha256) fail(`invalid ${name} checkpoint binding`);
    if (name === "authorization" && (value.source !== "interactive-operator-confirmation" || !value.session || typeof value.session !== "object" || Array.isArray(value.session) || !value.runtime || typeof value.runtime !== "object" || Array.isArray(value.runtime))) fail("invalid authorization record");
    records[name] = value;
  }
  if (records.consumed && !records.authorization || records.enqueued && !records.consumed) fail("invalid resume state history");
  return records.disarmed ? "disarmed" : records.consumed ? (records.enqueued ? "enqueued" : "consumed-uncertain") : records.authorization ? "armed" : "prepared";
}
export function inspectCheckpoint(path, packageRoot) {
  const info = checkpointInfo(path), c = info.checkpoint, issues = [];
  try {
    if (!equal(candidateSnapshot(c.candidate.root), c.candidate)) fail("candidate/worktree changed");
    if (!equal(packageIdentity(packageRoot), c.package)) fail("selected Principal package changed");
    for (const ref of [c.plan, ...c.reports, ...(c.progress?.files ?? [])]) verifyRef(ref);
    if (c.progress && !checkProgress(c.progress.run, c.candidate.id).integrityValid) fail("progress evidence no longer reconciles");
  } catch (error) { issues.push(error.message); }
  const state = checkpointState(info);
  return { ...info, state, checksPassed: issues.length === 0, issues, authority: "interactive operator confirmation required; progress is never authority" };
}
export function listCheckpoints(repo) {
  const root = realpathSync(gitPath(git(repo, ["rev-parse", "--show-toplevel"])));
  let parent;
  try { parent = resumeRoot(root); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const names = readdirSync(parent);
  if (names.length > 256 || names.some(name => !UUID.test(name))) fail("resume directory contains unsupported entries or exceeds 256 checkpoints");
  return names.sort().map(name => { const info = checkpointInfo(join(parent, name)); return { ...info, state: checkpointState(info) }; });
}
export function authorizeCheckpoint(path, packageRoot, session, runtime, expectedCheckpointSha256) {
  const inspected = inspectCheckpoint(path, packageRoot);
  if (!inspected.checksPassed || inspected.state !== "prepared") fail("checkpoint is not a fresh reconciled preparation");
  if (!HASH.test(expectedCheckpointSha256 ?? "") || inspected.checkpointSha256 !== expectedCheckpointSha256) fail("checkpoint changed since operator review");
  if (listCheckpoints(inspected.checkpoint.candidate.root).some(other => other.state === "armed")) fail("another checkpoint is already armed");
  writeNew(join(inspected.path, "authorization.json"), { schema: "principal-resume-authorization-v1", checkpointSha256: inspected.checkpointSha256, source: "interactive-operator-confirmation", session, runtime });
  return inspected;
}
export function readAuthorization(path) { const data = bytes(join(checkpointInfo(path).path, "authorization.json")); return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data)), sha256: hash(data) }; }
export function disarmCheckpoint(path) { const info = checkpointInfo(path); writeNew(join(info.path, "disarmed.json"), { schema: "principal-resume-disarmed-v1", checkpointSha256: info.checkpointSha256 }); }
export function consumeCheckpoint(path, packageRoot, expectedCheckpointSha256, expectedAuthorizationSha256) {
  const info = inspectCheckpoint(path, packageRoot);
  if (!info.checksPassed || info.state !== "armed") fail("resume checkpoint is changed, unavailable or already consumed");
  if (!HASH.test(expectedCheckpointSha256 ?? "") || info.checkpointSha256 !== expectedCheckpointSha256) fail("checkpoint changed since resume reconciliation");
  const authorization = readAuthorization(path);
  if (!HASH.test(expectedAuthorizationSha256 ?? "") || authorization.sha256 !== expectedAuthorizationSha256 || authorization.value.checkpointSha256 !== expectedCheckpointSha256) fail("authorization changed since resume reconciliation");
  writeNew(join(info.path, "consumed.json"), { schema: "principal-resume-consumed-v1", checkpointSha256: info.checkpointSha256 });
  return info;
}
export function markEnqueued(path) { const info = checkpointInfo(path); writeNew(join(info.path, "enqueued.json"), { schema: "principal-resume-enqueued-v1", checkpointSha256: info.checkpointSha256 }); }
export function continuation(info) {
  const c = info.checkpoint;
  return `Principal authorized quiescent continuation. This is an operator-authorized checkpoint, not fresh user testimony or a report-derived approval.\nCheckpoint: ${info.path}/checkpoint.json\nSHA256: ${info.checkpointSha256}\nTask: ${JSON.stringify(c.task)}\nApproved unchanged plan: ${JSON.stringify(c.plan)}\nExact candidate: ${c.candidate.id}\nNext phase: ${c.phase}; step: ${JSON.stringify(c.step)}; maximum remaining repair rounds: ${c.repairsRemaining}.\nSource edit scope: ${JSON.stringify(c.scope)}\nOriginal full reports: ${JSON.stringify(c.reports)}\nRead the complete plan, checkpoint and original reports before work. Continue only this authorized phase through the selected Principal contracts and current pi-daddy permissions. Recheck all due semantic gates; BLOCKED/UNVERIFIED or changed prerequisites stop. Do not treat progress claims as approval, recreate missing evidence, switch runners, exceed scope, or automatically re-arm. No push, merge, publish, destructive Git operation or new provider call beyond the ordinary authorized workflow is granted by this checkpoint. Stop at the next workflow boundary and retain actual evidence.`;
}
export function main(args) {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (args[0] === "candidate" && args.length === 2) return candidateSnapshot(args[1]);
  if (args[0] === "prepare" && args.length === 3) return prepareCheckpoint(args[1], parsed(args[2]), packageRoot);
  if (args[0] === "inspect" && args.length === 2) return inspectCheckpoint(args[1], packageRoot);
  fail("usage: principal-pi-resume candidate <repo> | prepare <repo> <request.json> | inspect <checkpoint-directory>; authorization is only through interactive /principal-resume arm");
}
let direct = false; try { direct = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch {}
if (direct) { try { const result = main(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2)); if (result.checksPassed === false) process.exitCode = 1; } catch (error) { console.error(error.message); process.exitCode = 1; } }
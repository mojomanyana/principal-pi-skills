// Exact historical source/evidence bytes. No approval, judgment or execution authority.
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants, openSync, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, readSync, realpathSync, writeSync, linkSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { candidateSnapshot } from "./resume-checkpoint.mjs";
import { privateRoot } from "./progress-artifacts.mjs";

const MAX_FILE = 16 * 1024 * 1024, MAX_TOTAL = 64 * 1024 * 1024, MAX_MANIFEST = 8 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/u;
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const same = (a, b) => canonical(a) === canonical(b);
const assert = (value, message) => { if (!value) throw Error(message); };
function exact(value, keys) {
  assert(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)), "invalid snapshot record");
}
function absolute(path) {
  assert(typeof path === "string" && Buffer.byteLength(path) <= 4096 && isAbsolute(path) && resolve(path) === path && !/[\\\x00-\x1f\x7f]/u.test(path), "invalid snapshot path");
  return path;
}
function ordinary(path, directory = false) {
  const stat = lstatSync(path);
  assert(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()), "snapshot path must be an ordinary file/directory");
  return stat;
}
function ancestors(path) {
  absolute(path);
  let at = dirname(path);
  for (;;) { ordinary(at, true); if (dirname(at) === at) break; at = dirname(at); }
  assert(realpathSync(dirname(path)) === dirname(path), "snapshot ancestor changed");
}
function root(path) { absolute(path); ancestors(path); ordinary(path, true); assert(realpathSync(path) === path, "canonical snapshot root required"); return path; }
function selected(repositories) {
  assert(Array.isArray(repositories) && repositories.length > 0 && repositories.length <= 16, "select 1 to 16 trusted snapshot roots");
  const roots = repositories.map(root).sort();
  assert(new Set(roots).size === roots.length, "duplicate snapshot root");
  return roots;
}
function inside(path, roots) { return roots.some(repo => path.startsWith(repo + sep)); }
function sourcePath(path) {
  assert(typeof path === "string" && Buffer.byteLength(path) <= 4096 && !isAbsolute(path) && !/[\\\x00-\x1f\x7f]/u.test(path) &&
    path.split("/").every(part => part && ![".", "..", ".git", ".principal"].includes(part)), "invalid snapshot source path");
  return path;
}
const identity = stat => [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
function read(path, max = MAX_FILE) {
  ancestors(path); ordinary(path);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const before = fstatSync(fd, { bigint: true });
    assert(before.isFile() && before.size <= BigInt(max), "snapshot file exceeds bound");
    const bytes = Buffer.alloc(Number(before.size)); let offset = 0;
    while (offset < bytes.length) { const count = readSync(fd, bytes, offset, bytes.length - offset, offset); assert(count > 0, "snapshot file shortened"); offset += count; }
    assert(readSync(fd, Buffer.alloc(1), 0, 1, bytes.length) === 0, "snapshot file grew");
    const after = fstatSync(fd, { bigint: true }), named = lstatSync(path, { bigint: true });
    assert(BigInt(bytes.length) === before.size && identity(before) === identity(after) && identity(after) === identity(named) && realpathSync(path) === path, "snapshot file changed during read");
    return bytes;
  } finally { closeSync(fd); }
}
function directory(path) {
  ancestors(path);
  try { mkdirSync(path, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
  ordinary(path, true);
}
function writeNew(path, bytes) {
  ancestors(path);
  const pending = join(dirname(path), `.pending-${randomUUID()}`);
  const fd = openSync(pending, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { let offset = 0; while (offset < bytes.length) offset += writeSync(fd, bytes, offset); fsyncSync(fd); }
  finally { closeSync(fd); }
  // Linux same-directory link is atomic and refuses an existing target. A crash may
  // leave an unreferenced pending file, never a partially published final record.
  ancestors(path);
  try { linkSync(pending, path); } catch (error) {
    if (error.code === "EEXIST") unlinkSync(pending);
    throw error;
  }
  const parent = openSync(dirname(path), constants.O_RDONLY);
  try { fsyncSync(parent); unlinkSync(pending); fsyncSync(parent); } finally { closeSync(parent); }
}
function subject(candidates) {
  const resources = candidates.map(value => ({ kind: "principal-git", algorithm: "principal-candidate-v1", repo: value.root,
    gitDir: value.gitDir, commonDir: value.commonDir, worktreeIdentity: value.worktreeIdentity, candidateId: value.id })).sort((a, b) => a.repo.localeCompare(b.repo));
  const body = { version: 1, kind: "principal-integration", resources };
  return { ...body, id: `principal-integration:${hash(canonical(body))}` };
}
function sourceRows(candidates) {
  const rows = [];
  for (const candidate of candidates) {
    assert(Array.isArray(candidate.tracked) && Array.isArray(candidate.untracked), "invalid snapshot candidate files");
    for (const file of [...candidate.tracked, ...candidate.untracked]) {
      sourcePath(file.path);
      if (file.missing === true) { exact(file, ["path", "missing"]); continue; }
      assert(HASH.test(file.sha256) && Number.isInteger(file.mode) && file.mode >= 0 && file.mode <= 0o777, "invalid snapshot source metadata");
      rows.push({ repo: candidate.root, path: file.path, mode: file.mode, sha256: file.sha256 });
    }
  }
  assert(candidates.reduce((n, c) => n + c.tracked.length + c.untracked.length, 0) <= 16384, "snapshot file count exceeds bound");
  rows.sort((a, b) => a.repo.localeCompare(b.repo) || a.path.localeCompare(b.path));
  assert(new Set(rows.map(row => row.repo + "\0" + row.path)).size === rows.length, "duplicate snapshot source");
  return rows;
}
function location(reference) {
  exact(reference, ["kind", "repo", "sha256"]);
  assert(reference.kind === "principal-snapshot" && HASH.test(reference.sha256), "invalid snapshot reference");
  root(reference.repo);
  const path = join(reference.repo, ".principal", "snapshots", reference.sha256);
  ancestors(join(path, "manifest.json"));
  return path;
}
function load(reference) {
  const path = location(reference), bytes = read(join(path, "manifest.json"), MAX_MANIFEST);
  assert(hash(bytes) === reference.sha256, "snapshot manifest changed");
  const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  exact(manifest, ["schema", "version", "primaryRepo", "subject", "candidates", "files", "evidence", "approval"]);
  assert(manifest.schema === "principal-snapshot-v1" && manifest.version === 1 && manifest.primaryRepo === reference.repo && manifest.approval === false &&
    Buffer.from(canonical(manifest) + "\n").equals(bytes), "invalid snapshot manifest");
  assert(Array.isArray(manifest.candidates) && manifest.candidates.length > 0 && manifest.candidates.length <= 16, "invalid snapshot member count");
  const roots = manifest.candidates.map(value => absolute(value.root));
  assert(new Set(roots).size === roots.length && roots.includes(reference.repo) && same(subject(manifest.candidates), manifest.subject), "invalid snapshot subject");
  assert(Array.isArray(manifest.files) && same(sourceRows(manifest.candidates), manifest.files.map(({ bytes: _bytes, blob: _blob, ...row }) => row)), "snapshot file membership changed");
  assert(Array.isArray(manifest.evidence) && manifest.evidence.length <= 128, "snapshot evidence count exceeds bound");
  const evidencePaths = new Set();
  for (const row of manifest.evidence) {
    exact(row, ["path", "sha256", "bytes", "blob"]); absolute(row.path);
    assert(inside(row.path, roots) && !row.path.split(sep).includes(".git") && !evidencePaths.has(row.path), "invalid snapshot evidence selection");
    evidencePaths.add(row.path);
  }
  let total = 0;
  for (const row of [...manifest.files, ...manifest.evidence]) {
    assert(HASH.test(row.sha256) && row.blob === row.sha256 && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= MAX_FILE, "invalid snapshot blob metadata");
    total += row.bytes;
  }
  assert(total <= MAX_TOTAL, "snapshot aggregate bytes exceed bound");
  return { path, manifest, roots, total };
}
/** Primary root must be selected before producer metadata reveals additional required roots. */
export function snapshotReferenceRepositories(reference, { repositories } = {}) {
  assert(selected(repositories).includes(reference?.repo), "snapshot repository is not selected");
  return load(reference).roots;
}
/** Trusted selected-root interface. Historical bytes never become a current Git candidate or judgment. */
export function resolveFrozenSnapshot(reference, { repositories } = {}) {
  try {
    const exactReference = structuredClone(reference), allowed = selected(repositories);
    assert(allowed.includes(exactReference.repo), "snapshot repository is not selected");
    const check = () => {
      const value = load(exactReference);
      assert(value.roots.every(repo => allowed.includes(root(repo))), "snapshot member is not selected");
      for (const row of [...value.manifest.files, ...value.manifest.evidence]) {
        const bytes = read(join(value.path, "blobs", row.blob));
        assert(bytes.length === row.bytes && hash(bytes) === row.sha256, "snapshot blob changed");
      }
      return value;
    };
    const value = check();
    return { status: "current", reference: structuredClone(exactReference), observed: { kind: "historical-source-snapshot", files: value.manifest.files.length,
      evidenceFiles: value.manifest.evidence.length, bytes: value.total, approval: false }, assertCurrent: async () => { check(); } };
  } catch { return { status: "unavailable", reference }; }
}
/** Administrative publication; callers supply trusted scope/current authority, never model-granted roots. */
export async function freezeSnapshot(repo, request, { repositories, assertAuthority } = {}) {
  assert(typeof assertAuthority === "function", "snapshot publication needs current trusted authority");
  const expectedSubject = structuredClone(request.expectedSubject);
  const requested = selected(request.repositories), allowed = selected(repositories), primary = root(repo);
  assert(requested.includes(primary) && requested.every(path => allowed.includes(path)), "snapshot roots are not selected");
  assert(Array.isArray(request.evidence ?? []) && (request.evidence ?? []).length <= 128, "snapshot evidence count exceeds bound");
  const evidence = structuredClone(request.evidence ?? []).sort((a, b) => a.path.localeCompare(b.path));
  assert(new Set(evidence.map(row => row.path)).size === evidence.length, "duplicate snapshot evidence");
  for (const row of evidence) {
    exact(row, ["path", "sha256"]); absolute(row.path);
    assert(HASH.test(row.sha256) && inside(row.path, requested) && !row.path.split(sep).includes(".git"), "snapshot evidence must be inside selected roots");
  }
  await assertAuthority();
  const candidates = requested.map(candidateSnapshot);
  assert(same(subject(candidates), expectedSubject), "snapshot expected subject changed");
  const blobs = new Map(); let total = 0;
  const collect = (path, sha256) => {
    const bytes = read(path); total += bytes.length;
    assert(total <= MAX_TOTAL && hash(bytes) === sha256, "snapshot input changed or aggregate bytes exceeded");
    blobs.set(sha256, bytes); return { bytes: bytes.length, blob: sha256 };
  };
  const files = sourceRows(candidates).map(row => ({ ...row, ...collect(join(row.repo, row.path), row.sha256) }));
  const evidenceFiles = evidence.map(row => ({ ...row, ...collect(row.path, row.sha256) }));
  const manifest = { schema: "principal-snapshot-v1", version: 1, primaryRepo: primary, subject: subject(candidates), candidates, files, evidence: evidenceFiles, approval: false };
  const manifestBytes = Buffer.from(canonical(manifest) + "\n");
  assert(manifestBytes.length <= MAX_MANIFEST, "snapshot manifest exceeds bound");
  const reference = { kind: "principal-snapshot", repo: primary, sha256: hash(manifestBytes) };
  const current = () => {
    assert(same(requested.map(candidateSnapshot), candidates), "snapshot source changed during capture");
    for (const row of evidence) assert(hash(read(row.path)) === row.sha256, "snapshot evidence changed during capture");
  };
  await assertAuthority(); current();
  privateRoot(primary);
  const store = join(primary, ".principal", "snapshots"), destination = join(store, reference.sha256);
  execFileSync("git", ["--no-optional-locks", "-C", primary, "check-ignore", "-q", "--", join(destination, "manifest.json")], { stdio: "pipe" });
  directory(store); directory(destination); directory(join(destination, "blobs"));
  for (const [digest, bytes] of blobs) {
    const path = join(destination, "blobs", digest);
    try { writeNew(path, bytes); } catch (error) {
      if (error.code !== "EEXIST") throw error;
      assert(read(path).equals(bytes), "existing snapshot blob conflicts");
    }
  }
  await assertAuthority(); current();
  let reused = false;
  try { writeNew(join(destination, "manifest.json"), manifestBytes); } catch (error) {
    if (error.code !== "EEXIST") throw error;
    assert(read(join(destination, "manifest.json"), MAX_MANIFEST).equals(manifestBytes), "existing snapshot manifest conflicts"); reused = true;
  }
  const verified = resolveFrozenSnapshot(reference, { repositories: requested });
  assert(verified.status === "current", "published snapshot integrity failed");
  await assertAuthority(); await verified.assertCurrent(); await assertAuthority();
  return { version: 1, state: "frozen", administrativeWrites: true, approval: false, reference: { owner: "principal", reference }, reused,
    manifest: { path: join(destination, "manifest.json"), sha256: reference.sha256 }, ...verified.observed };
}

import test from "node:test";
import filesystem from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, realpathSync, readFileSync, mkdirSync, renameSync, symlinkSync, existsSync, truncateSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { observeCandidate } from "../../scripts/workflow-state.mjs";
import { observeGitResource, resolveGitResource, observeIntegrationSubject, resolveIntegrationSubject, registerGitResourceObserver, observePackageRelease, resolvePackageRelease } from "../../scripts/continuity.mjs";

import { freezeSnapshot, resolveFrozenSnapshot } from "../../scripts/frozen-snapshot.mjs";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

const git = (repo, ...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: "pipe",
  env: { ...process.env, GIT_AUTHOR_NAME: "Synthetic Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Synthetic Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" } }).trim();
function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "principal-continuity-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = name => {
    const path = join(root, name); mkdirSync(path); git(path, "init", "-q");
    writeFileSync(join(path, "product.txt"), "Synthetic baseline\n");
    git(path, "add", "product.txt"); git(path, "commit", "-qm", "Synthetic baseline");
    return path;
  };
  return { root, repo };
}
test("resource reuses canonical candidate/worktree identity, with no inferred acceptance", async t => {
  const f = fixture(t), repo = f.repo("one"), ref = observeGitResource(repo);
  assert.equal(ref.candidateId, observeCandidate(repo).id);
  assert.equal(ref.repo, repo); assert.match(ref.worktreeIdentity, /^\d+:\d+:\d+:\d+$/u);
  const current = resolveGitResource(ref, { repositories: [repo] });
  assert.equal(current.status, "current"); assert.equal(current.observed.approval, false); assert.equal(current.judgment, undefined);
  writeFileSync(join(repo, "product.txt"), "Changed synthetic product\n");
  assert.equal(resolveGitResource(ref, { repositories: [repo] }).status, "stale");
  await assert.rejects(current.assertCurrent(), /stale/);
  assert.equal(resolveGitResource(ref, { repositories: [] }).status, "unavailable");
});
test("linked worktrees and recreated clean repositories are distinct even with the same HEAD", t => {
  const f = fixture(t), repo = f.repo("one"), ref = observeGitResource(repo), linked = join(f.root, "linked");
  git(repo, "worktree", "add", "--detach", linked, "HEAD");
  const other = observeGitResource(linked);
  assert.equal(other.candidateId, ref.candidateId); assert.equal(other.commonDir, ref.commonDir);
  assert.notEqual(other.gitDir, ref.gitDir); assert.notEqual(other.worktreeIdentity, ref.worktreeIdentity);
  assert.equal(resolveGitResource(ref, { repositories: [linked] }).status, "unavailable");
  const moved = join(f.root, "old-root"); renameSync(repo, moved);
  git(f.root, "clone", "-q", moved, repo);
  assert.equal(observeGitResource(repo).candidateId, ref.candidateId);
  assert.equal(resolveGitResource(ref, { repositories: [repo] }).status, "stale");
});
test("integration observes each exact repository; one change leaves unrelated observations current", async t => {
  const f = fixture(t), one = f.repo("one"), two = f.repo("two"), allowed = [one, two];
  const subject = observeIntegrationSubject(allowed), reversed = observeIntegrationSubject([two, one]);
  assert.deepEqual(subject, reversed);
  const current = resolveIntegrationSubject(subject, { repositories: allowed });
  assert.equal(current.status, "current"); assert.equal(current.atomic, false); assert.equal(current.approval, false);
  const beforeTwo = readFileSync(join(two, "product.txt"), "utf8");
  writeFileSync(join(one, "product.txt"), "Repo one changed\n");
  const changed = resolveIntegrationSubject(subject, { repositories: allowed });
  assert.equal(changed.status, "stale");
  assert.deepEqual(changed.resources.map(row => row.status), ["stale", "current"]);
  assert.equal(readFileSync(join(two, "product.txt"), "utf8"), beforeTwo);
  await assert.rejects(current.assertCurrent(), /stale/);
  assert.equal(resolveIntegrationSubject({ ...subject, id: "invented" }, { repositories: allowed }).status, "unavailable");
  assert.throws(() => observeIntegrationSubject([one, one]), /duplicate/);
});
test("resource refs cannot assert a published target or semantic approval", t => {
  const f = fixture(t), repo = f.repo("one"), ref = observeGitResource(repo);
  for (const addition of [{ accepted: true }, { registryConfirmed: true }, { publishedVersion: "1.2.3" }])
    assert.equal(resolveGitResource({ ...ref, ...addition }, { repositories: [repo] }).status, "unavailable");
});

test("optional event binds the actual owner and trusted selected roots, never map text or judgment claims", async t => {
  const f = fixture(t), repo = f.repo("one"), other = f.repo("two"), hooks = new Map();
  let handler, roots = [repo];
  const pi = { on: (name, fn) => hooks.set(name, fn), events: { on: (_name, fn) => { handler = fn; return () => {}; } } };
  registerGitResourceObserver(pi, { repositories: () => roots });
  const ctx = { cwd: repo, sessionManager: { getSessionId: () => "current-session" } };
  hooks.get("session_start")({}, ctx);
  const ref = { owner: "principal", reference: observeGitResource(other) };
  const request = (reference = ref, purpose = "resource", authorizeRepository) => new Promise(resolve => handler({ version: 1, requestId: "fixture", sessionId: "current-session", cwd: repo,
    reference, purpose: { purpose, initiativeId: "work", taskId: "task", taskRevision: "exact-task-revision" }, authorizeRepository, reply: resolve }));
  assert.equal((await request()).result.status, "unavailable");
  let granted = true;
  const selected = await request(ref, "resource", async root => granted && root === other);
  assert.equal(selected.result.status, "current");
  selected.result.reference.reference.candidateId = "a".repeat(40);
  await selected.result.assertCurrent(); // Returned metadata cannot rewrite the private expected reference.
  granted = false; await assert.rejects(selected.result.assertCurrent(), /selected/);
  let checks = 0;
  assert.equal((await request(ref, "resource", async () => ++checks === 1)).result.status, "unavailable");
  roots = [repo, other];
  const current = await request(); assert.equal(current.result.status, "current"); assert.deepEqual(current.result.reference, ref);
  assert.equal(current.result.judgment, undefined);
  roots = [repo]; await assert.rejects(current.result.assertCurrent(), /selected/);
  roots = [repo, other]; const prior = await request();
  hooks.get("session_tree")({}, ctx); await assert.rejects(prior.result.assertCurrent(), /owner changed/);
  assert.equal((await request(ref, "judgment")).result.status, "unverified");
});

test("package target binds bounded exact manifest/current repository, without registry or approval claims", async t => {
  const f = fixture(t), repo = f.repo("package"), manifest = join(repo, "package.json");
  writeFileSync(manifest, JSON.stringify({ name: "@fixture/example", version: "1.2.3" }));
  const ref = observePackageRelease(repo, { packagePath: "package.json", registry: "https://registry.example.invalid" });
  const current = resolvePackageRelease(ref, { repositories: [repo] });
  assert.equal(current.status, "current"); assert.equal(current.observed.publication, "unverified"); assert.equal(current.observed.approval, false);
  assert.equal(ref.registry, "https://registry.example.invalid/");
  assert.equal(resolvePackageRelease(ref, { repositories: [] }).status, "unavailable");
  assert.equal(resolvePackageRelease({ ...ref, published: true }, { repositories: [repo] }).status, "unavailable");
  writeFileSync(manifest, JSON.stringify({ name: "@fixture/example", version: "1.2.4" }));
  assert.equal(resolvePackageRelease(ref, { repositories: [repo] }).status, "stale"); await assert.rejects(current.assertCurrent());
  for (const packagePath of ["../package.json", "/package.json", "a/../package.json", "a\\package.json"])
    assert.throws(() => observePackageRelease(repo, { packagePath, registry: "https://registry.example.invalid" }));
  for (const registry of ["https://name:secret@registry.example.invalid", "https://registry.example.invalid/?token=x", "http://registry.example.invalid"])
    assert.throws(() => observePackageRelease(repo, { packagePath: "package.json", registry }));
  mkdirSync(join(repo, "actual")); writeFileSync(join(repo, "actual/package.json"), JSON.stringify({ name: "example", version: "1.0.0" }));
  writeFileSync(join(repo, ".git/info/exclude"), "linked\n");
  symlinkSync(join(repo, "actual"), join(repo, "linked"), "dir");
  assert.throws(() => observePackageRelease(repo, { packagePath: "linked/package.json", registry: ref.registry }), /links/);
  rmSync(join(repo, "linked"));
  writeFileSync(join(repo, ".git/info/exclude"), "package.json\n");
  const ignored = observePackageRelease(repo, { packagePath: "package.json", registry: ref.registry });
  writeFileSync(manifest, JSON.stringify({ name: "@fixture/example", version: "2.0.0" }));
  assert.deepEqual(observeGitResource(repo), ignored.resource, "Git intentionally ignores this manifest");
  assert.equal(resolvePackageRelease(ignored, { repositories: [repo] }).status, "stale", "Exact source hash still invalidates an ignored manifest");
  writeFileSync(manifest, " ".repeat(65537));
  assert.throws(() => observePackageRelease(repo, { packagePath: "package.json", registry: ref.registry }), /64 KiB/);
});
test("package target owner event requires selected roots and revokes after destination lifecycle", async t => {
  const f = fixture(t), repo = f.repo("one"), other = f.repo("two"), hooks = new Map(); let handler;
  writeFileSync(join(other, "package.json"), JSON.stringify({ name: "example", version: "1.0.0" }));
  const ref = { owner: "principal", reference: observePackageRelease(other, { packagePath: "package.json", registry: "https://registry.example.invalid" }) };
  registerGitResourceObserver({ on: (name, fn) => hooks.set(name, fn), events: { on: (_name, fn) => { handler = fn; return () => {}; } } });
  const ctx = { cwd: repo, sessionManager: { getSessionId: () => "session" } }; hooks.get("session_start")({}, ctx);
  const request = authorizeRepository => new Promise(resolve => handler({ version: 1, requestId: "release-target", sessionId: "session", cwd: repo,
    reference: ref, purpose: { purpose: "resource" }, authorizeRepository, reply: resolve }));
  assert.equal((await request()).result.status, "unavailable");
  let selected = true; const current = (await request(async root => selected && root === other)).result;
  assert.equal(current.status, "current"); assert.equal(current.observed.publication, "unverified");
  selected = false; await assert.rejects(current.assertCurrent()); selected = true;
  const prior = (await request(async root => root === other)).result; hooks.get("model_select")({}, ctx); await assert.rejects(prior.assertCurrent());
});

test("retained observer ticket refreshes root authority after exact content validation", async t => {
  const f = fixture(t), repo = f.repo("one"), other = f.repo("two"), hooks = new Map();
  let handler, roots = [repo, other], authorityReads = 0, revokeAfterRead = false;
  registerGitResourceObserver({ on: (name, fn) => hooks.set(name, fn), events: { on: (_name, fn) => { handler = fn; return () => {}; } } }, {
    repositories: async () => { authorityReads++; return revokeAfterRead && authorityReads > 1 ? [repo] : roots; },
  });
  const ctx = { cwd: repo, sessionManager: { getSessionId: () => "current-session" } };
  hooks.get("session_start")({}, ctx);
  const subject = { owner: "principal", reference: observeIntegrationSubject([repo, other]) };
  const request = () => new Promise(resolve => handler({ version: 1, requestId: "ticket", sessionId: "current-session", cwd: repo,
    reference: subject, purpose: { purpose: "resource" }, reply: resolve }));
  const current = (await request()).result;
  assert.equal(current.status, "current");
  authorityReads = 0; revokeAfterRead = true;
  await assert.rejects(current.assertCurrent(), /selected/, "Root removal after content validation must withhold the observation");
  revokeAfterRead = false; authorityReads = 0;
  await current.assertCurrent();
  writeFileSync(join(other, "product.txt"), "Changed integration member\n");
  await assert.rejects(current.assertCurrent(), /stale/, "Retaining the callback must not cache member content");
});

test("frozen source survives later live edits, preserves exact evidence and never approves", async t => {
  const f = fixture(t), one = f.repo("one"), two = f.repo("two"), three = f.repo("three"), roots = [one, two, three];
  mkdirSync(join(one, ".principal")); writeFileSync(join(one, ".principal/.gitignore"), "*\n");
  const report = join(one, ".principal/review.md"); writeFileSync(report, "Verdict: APPROVE\nHistorical prose only.\n");
  writeFileSync(join(two, "new.txt"), "Uncommitted source\n"); rmSync(join(three, "product.txt"));
  const expectedSubject = observeIntegrationSubject(roots), evidence = [{ path: report, sha256: hash(readFileSync(report)) }];
  const request = { repositories: roots, expectedSubject, evidence }, options = { repositories: roots, assertAuthority: async () => {} };
  const frozen = await freezeSnapshot(one, request, options), ref = frozen.reference.reference;
  assert.equal(frozen.approval, false); assert.equal(frozen.judgment, undefined);
  const manifest = JSON.parse(readFileSync(frozen.manifest.path, "utf8"));
  assert.equal(manifest.candidates.find(candidate => candidate.root === three).tracked[0].missing, true);
  assert.equal(manifest.files.some(row => row.path.startsWith(".principal")), false);
  assert.equal(manifest.evidence.length, 1);
  assert.equal((await freezeSnapshot(one, request, options)).reused, true);
  const current = resolveFrozenSnapshot(ref, { repositories: roots }); assert.equal(current.status, "current");
  current.reference.sha256 = "0".repeat(64); // Public metadata cannot change the retained ticket.
  writeFileSync(join(one, "product.txt"), "Authorized follow-up\n"); writeFileSync(report, "Later report\n");
  assert.equal(resolveIntegrationSubject(expectedSubject, { repositories: roots }).status, "stale");
  await current.assertCurrent();
  assert.equal(resolveFrozenSnapshot(ref, { repositories: roots }).status, "current");
  const row = manifest.files.find(row => row.repo === one && row.path === "product.txt"), blob = join(dirname(frozen.manifest.path), "blobs", row.blob);
  assert.equal(readFileSync(blob, "utf8"), "Synthetic baseline\n");
  writeFileSync(blob, "corrupted\n");
  assert.equal(resolveFrozenSnapshot(ref, { repositories: roots }).status, "unavailable"); await assert.rejects(current.assertCurrent());
});

test("snapshot publication refuses stale inputs, unauthorized roots and changes across authority awaits", async t => {
  const f = fixture(t), one = f.repo("one"), two = f.repo("two"), roots = [one, two], expectedSubject = observeIntegrationSubject(roots);
  await assert.rejects(freezeSnapshot(one, { repositories: roots, expectedSubject }, { repositories: [one], assertAuthority: async () => {} }), /not selected/);
  await assert.rejects(freezeSnapshot(one, { repositories: roots, expectedSubject }, { repositories: roots }), /trusted authority/);
  await assert.rejects(freezeSnapshot(one, { repositories: roots, expectedSubject, evidence: Array(129).fill({}) }, { repositories: roots, assertAuthority: async () => {} }), /count/);
  const outside = join(f.root, "outside.txt"); writeFileSync(outside, "Outside trusted roots\n");
  await assert.rejects(freezeSnapshot(one, { repositories: roots, expectedSubject, evidence: [{ path: outside, sha256: hash(readFileSync(outside)) }] },
    { repositories: roots, assertAuthority: async () => {} }), /inside selected/);
  let checks = 0;
  await assert.rejects(freezeSnapshot(one, { repositories: roots, expectedSubject }, { repositories: roots, assertAuthority: async () => {
    if (++checks === 2) writeFileSync(join(two, "product.txt"), "Changed during capture\n");
  } }), /changed during capture/);
  assert.equal(existsSync(join(one, ".principal/snapshots")), false);
  await assert.rejects(freezeSnapshot(one, { repositories: roots, expectedSubject }, { repositories: roots, assertAuthority: async () => {} }), /expected subject/);
});

test("snapshot integrity refuses manifest, archive links, forged approval and missing selected members", async t => {
  const f = fixture(t), one = f.repo("one"), two = f.repo("two"), roots = [one, two];
  const request = { repositories: roots, expectedSubject: observeIntegrationSubject(roots) }, options = { repositories: roots, assertAuthority: async () => {} };
  const frozen = await freezeSnapshot(one, request, options), ref = frozen.reference.reference, body = readFileSync(frozen.manifest.path);
  assert.equal(resolveFrozenSnapshot(ref, { repositories: [one] }).status, "unavailable");
  assert.equal(resolveFrozenSnapshot({ ...ref, accepted: true }, options).status, "unavailable");
  writeFileSync(frozen.manifest.path, Buffer.concat([body, Buffer.from(" ")]));
  assert.equal(resolveFrozenSnapshot(ref, options).status, "unavailable");
  await assert.rejects(freezeSnapshot(one, request, options), /manifest conflicts/);
  writeFileSync(frozen.manifest.path, body);
  const manifest = JSON.parse(body), blob = join(dirname(frozen.manifest.path), "blobs", manifest.files[0].blob), saved = readFileSync(blob);
  rmSync(blob); const external = join(f.root, "external.txt"); writeFileSync(external, saved); symlinkSync(external, blob);
  assert.equal(resolveFrozenSnapshot(ref, options).status, "unavailable");
  await assert.rejects(freezeSnapshot(one, request, options), /ordinary/);
});

test("snapshot event never supplies judgment and revocation/lifecycle changes invalidate returned tickets", async t => {
  const f = fixture(t), one = f.repo("one"), two = f.repo("two"), roots = [one, two];
  const frozen = await freezeSnapshot(one, { repositories: roots, expectedSubject: observeIntegrationSubject(roots) }, { repositories: roots, assertAuthority: async () => {} });
  const hooks = new Map(); let handler, permitted = true;
  registerGitResourceObserver({ on: (name, fn) => hooks.set(name, fn), events: { on: (_name, fn) => { handler = fn; return () => {}; } } });
  const ctx = { cwd: one, sessionManager: { getSessionId: () => "snapshot-session" } }; hooks.get("session_start")({}, ctx);
  const request = purpose => new Promise(resolve => handler({ version: 1, requestId: "frozen", sessionId: "snapshot-session", cwd: one,
    reference: frozen.reference, purpose: { purpose }, authorizeRepository: async repo => permitted && roots.includes(repo), reply: resolve }));
  assert.equal((await request("judgment")).result.status, "unverified");
  const first = (await request("resource")).result; assert.equal(first.status, "current"); assert.equal(first.judgment, undefined); assert.equal(first.observed.approval, false);
  writeFileSync(join(two, "product.txt"), "Follow-up changes\n"); await first.assertCurrent();
  permitted = false; await assert.rejects(first.assertCurrent(), /selected/);
  assert.equal((await request("resource")).result.status, "unavailable");
  permitted = true; const second = (await request("output")).result; assert.equal(second.status, "current"); assert.equal(second.judgment, undefined);
  hooks.get("session_tree")({}, ctx); await assert.rejects(second.assertCurrent(), /owner changed/);
});

test("snapshot rejects oversized regular files and explicit symlink evidence without truncating", async t => {
  const f = fixture(t), repo = f.repo("large");
  const large = join(repo, "large.bin"); writeFileSync(large, ""); truncateSync(large, 16 * 1024 * 1024 + 1); git(repo, "add", "large.bin");
  await assert.rejects(freezeSnapshot(repo, { repositories: [repo], expectedSubject: observeIntegrationSubject([repo]) },
    { repositories: [repo], assertAuthority: async () => {} }), /bound/);
  rmSync(large); git(repo, "reset", "-q", "HEAD", "--", "large.bin");
  mkdirSync(join(repo, ".principal")); writeFileSync(join(repo, ".principal/.gitignore"), "*\n");
  const linked = join(repo, ".principal/link"); symlinkSync(join(repo, "product.txt"), linked);
  await assert.rejects(freezeSnapshot(repo, { repositories: [repo], expectedSubject: observeIntegrationSubject([repo]), evidence: [{ path: linked, sha256: hash(readFileSync(linked)) }] },
    { repositories: [repo], assertAuthority: async () => {} }), /ordinary/);
});

test("freeze authority revoked after publication withholds the return without erasing retained bytes", async t => {
  const f = fixture(t), repo = f.repo("one"), roots = [repo]; let checks = 0;
  const request = { repositories: roots, expectedSubject: observeIntegrationSubject(roots) };
  await assert.rejects(freezeSnapshot(repo, request, { repositories: roots, assertAuthority: async () => {
    if (++checks === 4) throw Error("authority revoked");
  } }), /authority revoked/);
  const retained = readdirSync(join(repo, ".principal/snapshots"));
  assert.equal(retained.length, 1);
  const ref = { kind: "principal-snapshot", repo, sha256: retained[0] };
  assert.equal(resolveFrozenSnapshot(ref, { repositories: [] }).status, "unavailable");
  assert.equal(resolveFrozenSnapshot(ref, { repositories: roots }).status, "current");
  assert.equal((await freezeSnapshot(repo, request, { repositories: roots, assertAuthority: async () => {} })).reused, true);
});

test("workflow freeze defaults to its current root and checks trusted scope/owner after awaits", async t => {
  const f = fixture(t), one = f.repo("one"), two = f.repo("two"), roots = [one, two];
  // Execute the actual extension; only unused schema constructors are stubbed. Pi loading is separately qualified.
  const extension = new URL("../../extensions/workflow.ts", import.meta.url);
  const source = readFileSync(extension, "utf8").replace('import { Type } from "typebox";', 'const Type = new Proxy({}, { get: () => (..._args) => ({}) });')
    .replace(/from "(\.\.\/scripts\/[^"]+)"/gu, (_match, path) => `from ${JSON.stringify(new URL(path, extension).href)}`);
  const { default: register } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  function host(options) {
    let tool, sessionId = "native-parent";
    const hooks = new Map();
    const pi = { registerTool: value => { tool = value; }, on: (event, fn) => hooks.set(event, [...(hooks.get(event) ?? []), fn]), events: { on: () => () => {} } };
    register(pi, options);
    const ctx = { cwd: one, sessionManager: { getSessionId: () => sessionId } };
    return { ctx, changeOwner: () => { sessionId = "other-owner"; }, call: request => tool.execute("fixture", request, undefined, () => {}, ctx) };
  }
  const request = { action: "freeze", repositories: roots, expectedSubject: observeIntegrationSubject(roots) };
  const ordinary = host();
  assert.equal((await ordinary.call(request)).isError, true);
  assert.equal(existsSync(join(one, ".principal/snapshots")), false);
  const single = await ordinary.call({ action: "freeze", expectedSubject: observeIntegrationSubject([one]) });
  assert.equal(single.isError, undefined); assert.equal(single.structuredContent.approval, false);
  let checks = 0;
  const revoked = host({ repositories: async () => ++checks === 1 ? roots : [one] });
  assert.equal((await revoked.call(request)).isError, true);
  let ownerChecks = 0, changed;
  changed = host({ repositories: async () => { if (++ownerChecks === 2) changed.changeOwner(); return roots; } });
  assert.match((await changed.call(request)).structuredContent.error, /owner changed/);
  const wider = host({ repositories: async () => roots });
  const accepted = await wider.call(request); assert.equal(accepted.isError, undefined);
  assert.equal(accepted.structuredContent.judgment, undefined);
});

test("snapshot publication interruption leaves no partial final manifest and same intent can retry", async t => {
  const f = fixture(t), repo = f.repo("one"), request = { repositories: [repo], expectedSubject: observeIntegrationSubject([repo]) };
  const options = { repositories: [repo], assertAuthority: async () => {} }, original = filesystem.linkSync;
  filesystem.linkSync = (source, destination) => {
    if (destination.endsWith("/manifest.json")) throw Object.assign(Error("injected pre-publication failure"), { code: "EIO" });
    return original(source, destination);
  };
  syncBuiltinESMExports();
  try { await assert.rejects(freezeSnapshot(repo, request, options), /pre-publication/); }
  finally { filesystem.linkSync = original; syncBuiltinESMExports(); }
  const id = readdirSync(join(repo, ".principal/snapshots"))[0], directory = join(repo, ".principal/snapshots", id);
  assert.equal(existsSync(join(directory, "manifest.json")), false);
  assert.equal(readdirSync(directory).some(name => name.startsWith(".pending-")), true);
  assert.equal(resolveFrozenSnapshot({ kind: "principal-snapshot", repo, sha256: id }, options).status, "unavailable");
  const retried = await freezeSnapshot(repo, request, options);
  assert.equal(retried.reused, false); assert.equal(retried.reference.reference.sha256, id);
  const concurrent = await Promise.all([freezeSnapshot(repo, request, options), freezeSnapshot(repo, request, options)]);
  assert.ok(concurrent.every(result => result.reused && result.reference.reference.sha256 === id));
});

test("snapshot evidence enforces aggregate logical bytes even for ignored inputs", async t => {
  const f = fixture(t), repo = f.repo("one");
  mkdirSync(join(repo, ".principal")); writeFileSync(join(repo, ".principal/.gitignore"), "*\n");
  const bytes = Buffer.alloc(14 * 1024 * 1024), digest = hash(bytes), evidence = [];
  for (let i = 0; i < 5; i++) { const path = join(repo, ".principal", `evidence-${i}.bin`); writeFileSync(path, bytes); evidence.push({ path, sha256: digest }); }
  await assert.rejects(freezeSnapshot(repo, { repositories: [repo], expectedSubject: observeIntegrationSubject([repo]), evidence },
    { repositories: [repo], assertAuthority: async () => {} }), /aggregate bytes/);
  assert.equal(existsSync(join(repo, ".principal/snapshots")), false);
});

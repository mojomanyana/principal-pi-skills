import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, symlinkSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { candidateSnapshot, prepareCheckpoint, inspectCheckpoint, consumeCheckpoint, authorizeCheckpoint, readAuthorization, disarmCheckpoint, listCheckpoints, main } from "../../scripts/resume-checkpoint.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const run = (repo, ...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), "principal-resume-")), repo = join(home, "repo"), pkg = join(home, "package");
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(repo); mkdirSync(pkg);
  for (const name of ["package.json", "AGENTS.md", "principal-agents.json", "bootstrap", "extensions", "scripts", "agents", "prompts", "decide", "architect", "plan", "build", "review", "debug", "investigate", "git-ops"]) cpSync(join(ROOT, name), join(pkg, name), { recursive: true });
  run(repo, "init", "-q"); run(repo, "config", "user.name", "Fixture"); run(repo, "config", "user.email", "fixture@example.invalid");
  mkdirSync(join(repo, "src")); writeFileSync(join(repo, "src/x.js"), "export const x = 1;\n");
  run(repo, "add", "."); run(repo, "commit", "-qm", "seed");
  mkdirSync(join(repo, ".principal")); writeFileSync(join(repo, ".principal/.gitignore"), "*\n");
  const plan = join(repo, ".principal/plan.md"); writeFileSync(plan, "# Approved plan\nimpl:S1: edit src/x.js, test, review.\n");
  const request = { version: 1, task: "Fixture implementation", plan, scope: ["src/"], phase: "build", step: "impl:S1", repairsRemaining: 2, reports: [], progressRun: null };
  return { home, repo, pkg, plan, request, prepare: () => prepareCheckpoint(repo, request, pkg) };
}

const supported = process.platform === "linux";
test("resume package ships its npm binary and extension", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.bin["principal-pi-resume"], "./scripts/resume-checkpoint.mjs");
  assert.ok(pkg.pi.extensions.includes("./extensions/resume.ts"));
  assert.ok(pkg.files.includes("scripts/resume-checkpoint.mjs"));
  assert.ok(pkg.files.includes("extensions/resume.ts"));
});
test("preparation and inspection are offline evidence, never approval or queueing", { skip: !supported }, t => {
  const f = fixture(t), item = f.prepare(), result = inspectCheckpoint(item.path, f.pkg);
  assert.equal(result.state, "prepared"); assert.equal(result.checksPassed, true);
  assert.equal(item.checkpoint.candidate.id, run(f.repo, "rev-parse", "HEAD"));
  assert.equal(listCheckpoints(f.repo).length, 1);
  assert.throws(() => consumeCheckpoint(item.path, f.pkg), /already consumed|unavailable/);
  assert.throws(() => main(["arm", item.path]), /interactive/);
});
test("candidate fingerprint binds staged, unstaged and untracked state independently", { skip: !supported }, t => {
  const f = fixture(t), clean = candidateSnapshot(f.repo);
  writeFileSync(join(f.repo, "src/x.js"), "export const x = 2;\n");
  run(f.repo, "add", "src/x.js");
  writeFileSync(join(f.repo, "src/x.js"), "export const x = 1;\n");
  const dirty = candidateSnapshot(f.repo);
  assert.notEqual(dirty.id, clean.id); assert.deepEqual(dirty.changedPaths, ["src/x.js"]);
  writeFileSync(join(f.repo, "src/new.js"), "new\n");
  const item = f.prepare(); assert.match(item.checkpoint.candidate.id, /^dirty:/);
  assert.equal(inspectCheckpoint(item.path, f.pkg).checksPassed, true);
  writeFileSync(join(f.repo, "src/new.js"), "changed\n");
  assert.match(inspectCheckpoint(item.path, f.pkg).issues.join(" "), /candidate/);
});
test("changes outside explicit source scope refuse even when staged and unstaged cancel", { skip: !supported }, t => {
  const f = fixture(t); f.request.scope = ["other/"];
  writeFileSync(join(f.repo, "src/x.js"), "two\n"); run(f.repo, "add", "src/x.js"); writeFileSync(join(f.repo, "src/x.js"), "export const x = 1;\n");
  assert.throws(f.prepare, /exceed/);
});
test("plan, reports and package changes make a checkpoint stale", { skip: !supported }, t => {
  const f = fixture(t); f.request.phase = "review";
  assert.throws(f.prepare, /full report/);
  const report = join(f.repo, ".principal/build.md"); writeFileSync(report, "Full build report\n"); f.request.reports = [report];
  const item = f.prepare(); writeFileSync(report, "Changed report\n");
  assert.match(inspectCheckpoint(item.path, f.pkg).issues.join(" "), /changed evidence/);
  writeFileSync(report, "Full build report\n"); writeFileSync(f.plan, "Changed plan\n");
  assert.match(inspectCheckpoint(item.path, f.pkg).issues.join(" "), /changed evidence/);
});
test("masked index, submodules and untracked symlinks fail closed", { skip: !supported }, t => {
  const f = fixture(t);
  run(f.repo, "update-index", "--assume-unchanged", "src/x.js"); assert.throws(f.prepare, /masked/);
  run(f.repo, "update-index", "--no-assume-unchanged", "src/x.js");
  run(f.repo, "update-index", "--add", "--cacheinfo", `160000,${run(f.repo, "rev-parse", "HEAD")},module`); assert.throws(f.prepare, /submodules/);
  run(f.repo, "update-index", "--force-remove", "module");
  symlinkSync(f.plan, join(f.repo, "src/link")); assert.throws(f.prepare, /nonregular|artifact|ELOOP/);
});
test("artifact symlinks and unsupported request fields refuse without rewriting files", { skip: !supported }, t => {
  const f = fixture(t); const alias = join(f.repo, ".principal/alias.md"); symlinkSync(f.plan, alias); f.request.plan = alias;
  assert.throws(f.prepare); f.request.plan = f.plan; f.request.authorized = true;
  assert.throws(f.prepare, /fields/); assert.equal(readFileSync(f.plan, "utf8").startsWith("# Approved"), true);
});
test("quiescent helper retains consumption and never rearms or reconsumes", { skip: !supported }, t => {
  const f = fixture(t), item = f.prepare();
  authorizeCheckpoint(item.path, f.pkg, { operator: "fixture" }, { runtime: "fixture" }, item.checkpointSha256);
  assert.ok(readAuthorization(item.path).sha256);
  consumeCheckpoint(item.path, f.pkg, item.checkpointSha256, readAuthorization(item.path).sha256);
  assert.equal(inspectCheckpoint(item.path, f.pkg).state, "consumed-uncertain");
  assert.throws(() => consumeCheckpoint(item.path, f.pkg));
  assert.throws(() => authorizeCheckpoint(item.path, f.pkg, {}, {}));
  disarmCheckpoint(item.path); assert.equal(inspectCheckpoint(item.path, f.pkg).state, "disarmed");
});

async function extensionFixture(t) {
  const f = fixture(t), handlers = new Map(), commands = new Map(), notifications = [], queued = [];
  const sessionFile = join(f.home, "session.jsonl"); writeFileSync(sessionFile, "fixture metadata only\n");
  let leaf = { id: "before", parentId: null, type: "message" }, confirm = true, state = "idle", digest = "a".repeat(64), ownerId = "first", currentSession = "session-1", idle = true, ui = true, enqueueError = false;
  const ctx = { cwd: f.repo, model: { provider: "openai-codex", id: "fixture-model", api: "fixture-api" },
    get hasUI() { return ui; }, isIdle: () => idle,
    sessionManager: { getSessionId: () => currentSession, getSessionFile: () => sessionFile, getLeafId: () => leaf.id, getLeafEntry: () => leaf },
    ui: { notify: (message, level) => notifications.push({ message, level }), confirm: async () => confirm } };
  const pi = { on: (name, fn) => handlers.set(name, fn), registerCommand: (name, fn) => commands.set(name, fn),
    getCommands: () => [{ name: "skill:build", source: "skill", sourceInfo: { path: join(f.pkg, "build/SKILL.md") } }], getThinkingLevel: () => "medium",
    appendEntry: (customType, data) => { leaf = { id: randomUUID(), parentId: leaf.id, type: "custom", customType, data }; },
    sendUserMessage: (text, options) => { if (enqueueError) throw Error("fixture enqueue failure"); queued.push({ text, options }); },
    events: { emit: (channel, request) => {
      assert.equal(channel, "pi-daddy:runtime-snapshot:v1");
      queueMicrotask(() => request.reply({ version: 1, requestId: request.requestId, sessionId: request.sessionId, cwd: request.cwd, ownerScope: "scope-1", ownerId, backend: "process", qualified: true, state, evidenceDigest: digest, settledExecutionIds: ["exec:1"], outstandingExecutionIds: state === "busy" ? ["exec:2"] : [] }));
    } } };
  const modulePath = join(f.pkg, "extensions/resume.mjs"); writeFileSync(modulePath, readFileSync(join(f.pkg, "extensions/resume.ts")));
  const mod = await import(pathToFileURL(modulePath).href); mod.default(pi);
  const item = f.prepare();
  const command = (args = `arm ${item.path}`) => commands.get("principal-resume").handler(args, ctx);
  const start = async (reason = "resume") => { await handlers.get("session_start")({ reason }, ctx); await handlers.get("resources_discover")({}, ctx); await new Promise(resolve => setTimeout(resolve, 30)); };
  return { ...f, item, ctx, pi, mod, queued, notifications, handlers, command, start,
    change: changes => { if ("confirm" in changes) confirm = changes.confirm; if (changes.state) state = changes.state; if (changes.digest) digest = changes.digest; if (changes.ownerId) ownerId = changes.ownerId; if (changes.session) currentSession = changes.session; if ("idle" in changes) idle = changes.idle; if ("ui" in changes) ui = changes.ui; if ("enqueueError" in changes) enqueueError = changes.enqueueError; if (changes.interveningTurn) leaf = { id: randomUUID(), parentId: leaf.id, type: "message" }; } };
}
test("interactive arm then same-session restart queues exactly one fixed continuation", { skip: !supported }, async t => {
  const h = await extensionFixture(t); await h.command();
  assert.equal(h.queued.length, 0); assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "armed");
  h.change({ ownerId: "new-registration" }); await h.start("startup");
  assert.equal(h.queued.length, 1); assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "enqueued");
  assert.match(h.queued[0].text, /maximum remaining repair rounds: 2/);
  assert.match(h.queued[0].text, /not fresh user testimony/);
  assert.deepEqual(h.queued[0].options, { deliverAs: "followUp", expandPromptTemplates: false });
  await h.start("reload"); assert.equal(h.queued.length, 1);
});
test("headless or declined operator confirmation cannot authorize", { skip: !supported }, async t => {
  const h = await extensionFixture(t); h.change({ ui: false }); await h.command();
  assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "prepared");
  h.change({ ui: true, confirm: false }); await h.command(); await h.start(); assert.equal(h.queued.length, 0);
});
test("copied JSON authorization without session-owned attestation is refused", { skip: !supported }, async t => {
  const h = await extensionFixture(t); authorizeCheckpoint(h.item.path, h.pkg, { sessionId: "session-1" }, {}, h.item.checkpointSha256);
  await h.start(); assert.equal(h.queued.length, 0); assert.match(h.notifications.at(-1).message, /authorization|leaf/);
});
for (const alteration of ["interveningTurn", "session", "digest", "state"]) test(`resume refuses changed ${alteration}`, { skip: !supported }, async t => {
  const h = await extensionFixture(t); await h.command();
  h.change({ [alteration]: ({ interveningTurn: true, session: "other-session", digest: "b".repeat(64), state: "unknown" })[alteration] });
  await h.start(); assert.equal(h.queued.length, 0); assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "armed");
});
test("new and fork starts do not automatically continue a prior checkpoint", { skip: !supported }, async t => {
  const h = await extensionFixture(t); await h.command(); await h.start("new"); await h.start("fork"); assert.equal(h.queued.length, 0);
});
test("busy runtime blocks authorization and missing bridge times out", { skip: !supported }, async t => {
  const h = await extensionFixture(t); h.change({ state: "busy" }); await h.command();
  assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "prepared");
  await assert.rejects(h.mod.requestRuntime({ events: { emit() {} } }, h.ctx, 5), /timed out/);
});
test("enqueue failure preserves consumed uncertainty and never retries", { skip: !supported }, async t => {
  const h = await extensionFixture(t); await h.command(); h.change({ enqueueError: true }); await h.start();
  assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "consumed-uncertain");
  h.change({ enqueueError: false }); await h.start(); assert.equal(h.queued.length, 0);
});
test("changed candidate or explicit disarm blocks automatic queue", { skip: !supported }, async t => {
  const h = await extensionFixture(t); await h.command(); writeFileSync(join(h.repo, "src/x.js"), "changed\n"); await h.start();
  assert.equal(h.queued.length, 0); await h.command(`disarm ${h.item.path}`); assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "disarmed");
});
test("unconfigured startup outside a repository stays quiet and makes no runtime query", { skip: !supported }, async t => {
  const h = await extensionFixture(t); h.ctx.cwd = h.home;
  h.pi.events.emit = () => { throw Error("unexpected runtime query"); };
  await h.start("startup"); assert.equal(h.queued.length, 0); assert.equal(h.notifications.length, 0);
});
test("operator confirmation rechecks modified plan and source package before arming", { skip: !supported }, async t => {
  const h = await extensionFixture(t);
  h.ctx.ui.confirm = async () => { writeFileSync(h.plan, "changed after display\n"); return true; };
  await h.command(); assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "prepared"); assert.equal(h.queued.length, 0);
});
test("altered model and disabled phase refuse the resumed authorization", { skip: !supported }, async t => {
  const h = await extensionFixture(t); await h.command(); h.ctx.model.id = "different-model";
  await h.start(); assert.equal(h.queued.length, 0);
  h.ctx.model.id = "fixture-model"; h.pi.getCommands = () => [];
  await h.start(); assert.equal(h.queued.length, 0);
});

test("raw tracked bytes bind candidates even when Git normalizes CRLF away", { skip: !supported }, t => {
  const f = fixture(t); run(f.repo, "config", "core.autocrlf", "true");
  const clean = candidateSnapshot(f.repo);
  writeFileSync(join(f.repo, "src/x.js"), "export const x = 1;\r\n");
  assert.equal(run(f.repo, "diff", "--", "src/x.js"), "");
  const normalized = candidateSnapshot(f.repo);
  assert.notEqual(normalized.id, clean.id); assert.deepEqual(normalized.changedPaths, ["src/x.js"]);
  const checkpoint = f.prepare();
  writeFileSync(join(f.repo, "src/x.js"), "export const x = 1;\n");
  assert.equal(run(f.repo, "diff", "--", "src/x.js"), "");
  assert.equal(inspectCheckpoint(checkpoint.path, f.pkg).checksPassed, false);
});
test("tracked symlinks fail closed and raw changes cannot evade the approved scope", { skip: !supported }, t => {
  const f = fixture(t); run(f.repo, "config", "core.autocrlf", "true");
  writeFileSync(join(f.repo, "src/x.js"), "export const x = 1;\r\n"); f.request.scope = ["other/"];
  assert.throws(f.prepare, /exceed/);
  writeFileSync(join(f.repo, "src/x.js"), "export const x = 1;\n");
  symlinkSync("x.js", join(f.repo, "src/link")); run(f.repo, "add", "src/link");
  assert.throws(() => candidateSnapshot(f.repo), /tracked symlinks/);
});
test("all shipped helper behavior is bound by the selected package digest", { skip: !supported }, t => {
  for (const name of ["snapshot-workspace.mjs", "install-agents.mjs"]) {
    const f = fixture(t), item = f.prepare();
    writeFileSync(join(f.pkg, "scripts", name), "// changed runtime helper\n");
    assert.match(inspectCheckpoint(item.path, f.pkg).issues.join(" "), /package changed/);
  }
});

test("UI confirmation cannot authorize a replaced but otherwise valid checkpoint", { skip: !supported }, async t => {
  const h = await extensionFixture(t);
  h.ctx.ui.confirm = async () => {
    const path = join(h.item.path, "checkpoint.json"), c = JSON.parse(readFileSync(path, "utf8"));
    c.task = "DIFFERENT TASK"; c.scope.push("other/"); writeFileSync(path, JSON.stringify(c) + "\n");
    return true;
  };
  await h.command(); assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "prepared");
  assert.match(h.notifications.at(-1).message, /checkpoint changed since operator review/);
  await h.start(); assert.equal(h.queued.length, 0);
});
for (const target of ["checkpoint.json", "authorization.json"]) test(`runtime await cannot consume replaced ${target}`, { skip: !supported }, async t => {
  const h = await extensionFixture(t); await h.command();
  const original = h.pi.events.emit;
  h.pi.events.emit = (channel, request) => {
    const path = join(h.item.path, target), value = JSON.parse(readFileSync(path, "utf8"));
    if (target === "checkpoint.json") { value.task = "DIFFERENT TASK"; value.scope.push("other/"); }
    else value.source = "changed after session-owned verification";
    writeFileSync(path, JSON.stringify(value) + "\n"); original(channel, request);
  };
  await h.start(); assert.equal(h.queued.length, 0); assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "armed");
  assert.match(h.notifications.at(-1).message, /changed since resume reconciliation/);
});

test("unsupported non-UTF8 Git filenames fail closed instead of losing tracked byte coverage", { skip: !supported }, t => {
  const f = fixture(t), path = Buffer.concat([Buffer.from(join(f.repo, "src/")), Buffer.from([255])]);
  writeFileSync(path, "opaque filename\n"); run(f.repo, "add", ".");
  assert.throws(() => candidateSnapshot(f.repo), /encoded data|encoding/);
});
test("candidate observation preserves trailing spaces in the canonical repository path", { skip: !supported }, t => {
  const f = fixture(t), moved = f.repo + " "; renameSync(f.repo, moved);
  assert.equal(candidateSnapshot(moved).root, moved);
});

test("the displayed checkpoint and its digest come from one bounded read", { skip: !supported }, async t => {
  const h = await extensionFixture(t), path = join(h.item.path, "checkpoint.json");
  const changed = JSON.parse(readFileSync(path, "utf8")); changed.task = "REPLACED BETWEEN READS";
  const inode = fs.lstatSync(path).ino, close = fs.closeSync;
  let replaced = false, displayed = "";
  h.ctx.ui.confirm = async (_title, body) => { displayed = body; return true; };
  fs.closeSync = fd => {
    let matches = false; try { matches = fs.fstatSync(fd).ino === inode; } catch {}
    close(fd);
    if (matches && !replaced) { replaced = true; writeFileSync(path, JSON.stringify(changed) + "\n"); }
  };
  syncBuiltinESMExports();
  try { await h.command(); } finally { fs.closeSync = close; syncBuiltinESMExports(); }
  assert.equal(replaced, true); assert.match(displayed, /Fixture implementation/);
  assert.equal(inspectCheckpoint(h.item.path, h.pkg).state, "prepared");
  assert.match(h.notifications.at(-1).message, /checkpoint changed since operator review/);
  assert.equal(h.queued.length, 0);
});

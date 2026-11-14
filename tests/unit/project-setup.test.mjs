import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectProject, initializeProject, ProjectSetupError } from "../../scripts/project-setup.mjs";

const moduleSource = readFileSync(new URL("../../extensions/project-setup.ts", import.meta.url), "utf8")
  .replace('"../scripts/project-setup.mjs"', JSON.stringify(new URL("../../scripts/project-setup.mjs", import.meta.url).href));
const { createProjectSetup } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "principal-project-"));
  t.after(() => rmSync(root, { recursive: true, force: true })); return root;
}
const git = (root, ...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgSign=false", "-C", root, ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
function ui(root, confirm = async () => true) {
  const handlers = new Map(), commands = new Map(); let session = "session-1";
  const pi = { on(name, handler) { handlers.set(name, handler); }, registerCommand(name, command) { commands.set(name, command); } };
  const ctx = { cwd: root, hasUI: true, isProjectTrusted: () => true, ui: { confirm, notify() {} }, sessionManager: { getSessionId: () => session } };
  return { request: createProjectSetup(pi), ctx, handlers, commands, changeSession: () => { session = "session-2"; } };
}

test("new project setup is read-only until accepted, creates one empty baseline and preserves user files", async t => {
  const root = fixture(t), text = "user-owned: naïve\n";
  writeFileSync(join(root, "draft.txt"), text);
  mkdirSync(join(root, ".pi")); writeFileSync(join(root, ".pi", "private.json"), "{}\n");
  const before = inspectProject(root);
  assert.equal(before.reasonCode, "GIT_REPOSITORY_MISSING"); assert.equal(before.administrativeWrites, false);
  assert.equal(existsSync(join(root, ".git")), false);
  let questions = 0; const app = ui(root, async () => { questions++; return true; });
  const result = await app.request(app.ctx);
  assert.equal(result.state, "initialized"); assert.equal(result.approval, false); assert.equal(questions, 1);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "1");
  assert.equal(git(root, "ls-tree", "-r", "HEAD"), "");
  assert.equal(git(root, "ls-files", "--stage"), ""); assert.equal(git(root, "remote"), "");
  assert.equal(readFileSync(join(root, "draft.txt"), "utf8"), text);
  assert.equal(git(root, "status", "--porcelain"), "?? draft.txt");
  assert.equal(git(root, "check-ignore", ".pi/private.json", ".principal/probe"), ".pi/private.json\n.principal/probe");
  assert.equal(git(root, "config", "--local", "--get-regexp", ".*").includes("user.name"), false);
  assert.equal((await app.request(app.ctx)).state, "ready"); assert.equal(questions, 1);
  assert.equal(git(root, "rev-list", "--count", "HEAD"), "1");
});

test("cancel, headless calls and a changed session preserve a fresh folder", async t => {
  for (const kind of ["cancel", "headless", "session", "generation", "abort"]) {
    const root = fixture(t), controller = new AbortController();
    let app; app = ui(root, async () => {
      if (kind === "session") app.changeSession();
      if (kind === "generation") app.handlers.get("session_switch")();
      if (kind === "abort") controller.abort();
      return kind !== "cancel";
    });
    if (kind === "headless") app.ctx.hasUI = false;
    if (kind === "cancel") assert.equal((await app.request(app.ctx)).state, "cancelled");
    else await assert.rejects(app.request(app.ctx, undefined, controller.signal), ProjectSetupError);
    assert.deepEqual(readdirSync(root), []);
  }
});

test("setup needs current project trust, including after confirmation, while inspection stays read-only", async t => {
  for (const kind of ["absent", "untrusted", "revoked"]) {
    const root = fixture(t); let questions = 0;
    const app = ui(root, async () => { questions++; app.ctx.isProjectTrusted = () => false; return true; });
    if (kind === "absent") delete app.ctx.isProjectTrusted;
    if (kind === "untrusted") app.ctx.isProjectTrusted = () => false;
    assert.equal(inspectProject(root).state, "setup-required");
    await assert.rejects(app.request(app.ctx), error => error.code === "SETUP_TRUST_REQUIRED" && error.administrativeWrites === false);
    assert.equal(questions, kind === "revoked" ? 1 : 0);
    assert.deepEqual(readdirSync(root), []);
  }
  const ready = fixture(t); initializeProject(ready, inspectProject(ready).observationToken);
  const app = ui(ready, async () => { throw Error("No setup needed"); }); delete app.ctx.isProjectTrusted;
  assert.equal((await app.request(app.ctx)).state, "ready");
});

test("changed repository during the setup question cannot inherit the earlier confirmation", async t => {
  const root = fixture(t); const app = ui(root, async () => { git(root, "init", "--template="); return true; });
  await assert.rejects(app.request(app.ctx), error => error.code === "PROJECT_CHANGED" && error.administrativeWrites === false);
  assert.equal(inspectProject(root).reasonCode, "COMMITTED_BASELINE_MISSING");
  assert.equal(existsSync(join(root, ".git", "info", "exclude")), false);
});

test("existing projects are reused and parent repositories are not implicitly initialized", t => {
  const root = fixture(t); initializeProject(root, inspectProject(root).observationToken);
  writeFileSync(join(root, "product.txt"), "staged"); git(root, "add", "product.txt");
  git(root, "remote", "add", "origin", "https://invalid.example/repo.git");
  const index = readFileSync(join(root, ".git", "index"));
  assert.equal(inspectProject(root).state, "ready");
  assert.equal(initializeProject(root, inspectProject(root).observationToken).state, "ready");
  assert.deepEqual(readFileSync(join(root, ".git", "index")), index);
  const child = join(root, "nested"); mkdirSync(child);
  assert.equal(inspectProject(child).reasonCode, "PARENT_REPOSITORY");
  assert.throws(() => initializeProject(child, inspectProject(child).observationToken), ProjectSetupError);
  assert.equal(existsSync(join(child, ".git")), false);
});

test("unborn repositories preserve existing index, remotes and other history", t => {
  const staged = fixture(t); git(staged, "init", "--template=");
  writeFileSync(join(staged, "product.txt"), "keep staged"); git(staged, "add", "product.txt");
  const index = readFileSync(join(staged, ".git", "index"));
  assert.equal(inspectProject(staged).reasonCode, "STAGED_FILES_PRESENT");
  assert.throws(() => initializeProject(staged, inspectProject(staged).observationToken), ProjectSetupError);
  assert.deepEqual(readFileSync(join(staged, ".git", "index")), index);
  const remote = fixture(t); git(remote, "init", "--template="); git(remote, "remote", "add", "origin", "https://invalid.example/a.git");
  assert.equal(inspectProject(remote).reasonCode, "REMOTE_ALREADY_CONFIGURED");
  const orphan = fixture(t); initializeProject(orphan, inspectProject(orphan).observationToken); git(orphan, "checkout", "--orphan", "fresh");
  assert.equal(inspectProject(orphan).reasonCode, "EXISTING_REPOSITORY_HISTORY");
});

test("initialization preserves exclusions and does not execute hooks or use configured signing", t => {
  const root = fixture(t); git(root, "init", "--template=");
  mkdirSync(join(root, ".git", "info"), { recursive: true }); writeFileSync(join(root, ".git", "info", "exclude"), "keep-me\n");
  mkdirSync(join(root, ".git", "hooks"), { recursive: true });
  const hook = join(root, ".git", "hooks", "reference-transaction");
  writeFileSync(hook, "#!/bin/sh\ntouch hook-ran\n"); chmodSync(hook, 0o700);
  git(root, "config", "commit.gpgSign", "true"); git(root, "config", "gpg.program", "must-not-run-for-setup");
  initializeProject(root, inspectProject(root).observationToken);
  assert.equal(existsSync(join(root, "hook-ran")), false);
  assert.equal(readFileSync(join(root, ".git", "info", "exclude"), "utf8"), "keep-me\n/.pi/\n/.principal/\n");
});

test("linked metadata is refused and inherited Git redirects do not change the selected project", t => {
  const root = fixture(t), other = fixture(t); git(root, "init", "--template=");
  const outside = join(other, "outside"); writeFileSync(outside, "unchanged");
  mkdirSync(join(root, ".git", "info"), { recursive: true }); symlinkSync(outside, join(root, ".git", "info", "exclude"));
  assert.throws(() => inspectProject(root), error => error.code === "UNSAFE_PROJECT_METADATA");
  assert.equal(readFileSync(outside, "utf8"), "unchanged");
  const selected = fixture(t), before = process.env.GIT_DIR;
  try {
    process.env.GIT_DIR = join(root, ".git");
    assert.equal(inspectProject(selected).reasonCode, "GIT_REPOSITORY_MISSING");
    initializeProject(selected, inspectProject(selected).observationToken);
  } finally { if (before === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = before; }
  assert.equal(readFileSync(outside, "utf8"), "unchanged");
  assert.equal(inspectProject(selected).state, "ready");
});

test("malformed parent metadata does not allow a nested repository", t => {
  const root = fixture(t), child = join(root, "child"); mkdirSync(child);
  writeFileSync(join(root, ".git"), "not a valid gitdir link\n");
  assert.equal(inspectProject(child).reasonCode, "PARENT_REPOSITORY_UNAVAILABLE");
  assert.throws(() => initializeProject(child, inspectProject(child).observationToken), ProjectSetupError);
  assert.deepEqual(readdirSync(child), []);
});

test("partial initialization preserves the folder and reports confirmed steps without retry", t => {
  const root = fixture(t), bin = fixture(t), beforePath = process.env.PATH;
  const wrapper = join(bin, "git");
  writeFileSync(wrapper, '#!/bin/sh\nfor arg in "$@"; do if [ "$arg" = "hash-object" ]; then exit 2; fi; done\nexec /usr/bin/git "$@"\n');
  chmodSync(wrapper, 0o700); writeFileSync(join(root, "draft.txt"), "unchanged");
  try {
    process.env.PATH = `${bin}:${beforePath}`;
    assert.throws(() => initializeProject(root, inspectProject(root).observationToken), error => {
      assert.equal(error.administrativeWrites, "possible");
      assert.deepEqual(error.steps, { repositoryCreated: true, exclusionsWritten: true, baselineInstalled: false });
      assert.match(error.message, /confirmed completion only/); return true;
    });
  } finally { process.env.PATH = beforePath; }
  assert.equal(readFileSync(join(root, "draft.txt"), "utf8"), "unchanged");
  assert.equal(inspectProject(root).reasonCode, "COMMITTED_BASELINE_MISSING");
  assert.equal(existsSync(join(root, ".git", "info", "exclude")), true);
});

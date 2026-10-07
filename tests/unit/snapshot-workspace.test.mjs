/**
 * Fixture tests for the workspace snapshot.
 *
 * The fixture carries one of every state a real checkout has, because each fails
 * differently: a staged change, an unstaged change, a deletion, an untracked file, a
 * symlink, an ignored `.env`, and an ignored dependency directory. A snapshot that silently
 * drops the deletion makes a test pass that should fail; one that silently *includes* the
 * `.env` copies the user's credentials into a temp directory that outlives the run.
 *
 * The three assertions that matter, in the plan's words: the caller's status is unchanged,
 * the temporary worktree is removed, and ignored files never appear in the snapshot.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, lstatSync, readlinkSync, unlinkSync, cpSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createSnapshot, SnapshotError } from "../../scripts/snapshot-workspace.mjs";
import { execFileSync as run } from "node:child_process";
const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "snapshot-workspace.mjs");

const created = [];
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" });

/** A repo carrying every state the plan enumerates. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "ppfix-"));
  created.push(dir);
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "t@local"], dir);
  git(["config", "user.name", "test"], dir);

  writeFileSync(join(dir, ".gitignore"), ".env\nnode_modules/\n");
  writeFileSync(join(dir, "kept.txt"), "committed\n");
  writeFileSync(join(dir, "staged.txt"), "before\n");
  writeFileSync(join(dir, "unstaged.txt"), "before\n");
  writeFileSync(join(dir, "doomed.txt"), "delete me\n");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "app.js"), "export const v = 1;\n");
  symlinkSync(join("src", "app.js"), join(dir, "tracked-link"));
  git(["add", "-A"], dir);
  git(["commit", "-qm", "baseline"], dir);

  // ...then dirty it in every way that matters.
  writeFileSync(join(dir, "staged.txt"), "STAGED CHANGE\n");
  git(["add", "staged.txt"], dir);
  writeFileSync(join(dir, "unstaged.txt"), "UNSTAGED CHANGE\n");
  unlinkSync(join(dir, "doomed.txt"));
  writeFileSync(join(dir, "untracked.txt"), "new file\n");
  symlinkSync(join("src", "app.js"), join(dir, "untracked-link"));

  // Secrets and caches — ignored, and they must stay behind.
  writeFileSync(join(dir, ".env"), "AWS_SECRET_ACCESS_KEY=fixture-canary-do-not-copy\n");
  mkdirSync(join(dir, "node_modules", "left-pad"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");

  return dir;
}

const status = (dir) => git(["status", "--porcelain=v1", "-z"], dir);
const candidateTree = (dir) => {
  const holder = mkdtempSync(join(tmpdir(), "ppindex-"));
  created.push(holder);
  const env = { ...process.env, GIT_INDEX_FILE: join(holder, "candidate.index") };
  execFileSync("git", ["read-tree", "HEAD"], { cwd: dir, env });
  execFileSync("git", ["add", "-A"], { cwd: dir, env });
  return execFileSync("git", ["write-tree"], { cwd: dir, env, encoding: "utf8" }).trim();
};

test("the snapshot reproduces committed, staged, unstaged and deleted state", () => {
  const repo = fixture();
  const { path, cleanup } = createSnapshot(repo);

  assert.equal(readFileSync(join(path, "kept.txt"), "utf8"), "committed\n", "committed content");
  assert.equal(readFileSync(join(path, "staged.txt"), "utf8"), "STAGED CHANGE\n", "staged change");
  assert.equal(readFileSync(join(path, "unstaged.txt"), "utf8"), "UNSTAGED CHANGE\n", "unstaged change");
  assert.ok(!existsSync(join(path, "doomed.txt")), "a deleted file must be deleted in the snapshot too");

  cleanup();
});

test("a writer-root snapshot has the exact same candidate tree without changing the real index", () => {
  const repo = fixture();
  const before = status(repo);
  const writerTree = candidateTree(repo);
  const { path, cleanup } = createSnapshot(repo);
  assert.equal(candidateTree(path), writerTree);
  assert.equal(status(repo), before, "temporary-index tree computation must not alter the writer index");
  cleanup();
});

test("untracked files and symlinks come across, as themselves", () => {
  const repo = fixture();
  const { path, cleanup } = createSnapshot(repo);

  assert.equal(readFileSync(join(path, "untracked.txt"), "utf8"), "new file\n");
  for (const link of ["tracked-link", "untracked-link"]) {
    assert.ok(lstatSync(join(path, link)).isSymbolicLink(), `${link} must remain a symlink, not become a copy`);
    assert.equal(readlinkSync(join(path, link)), join("src", "app.js"));
  }

  cleanup();
});

test("ignored files never reach the snapshot — secrets and caches stay behind", () => {
  const repo = fixture();
  const { path, cleanup } = createSnapshot(repo);

  assert.ok(!existsSync(join(path, ".env")), ".env must not be copied");
  assert.ok(!existsSync(join(path, "node_modules")), "ignored dependency directories must not be copied");

  // Belt and braces: grep the whole snapshot for the fixture's canary. A future change that
  // reintroduces ignored files by another path fails here even if the two checks above are
  // satisfied by a different mechanism.
  // grep exits 1 when nothing matches, which is the outcome this test wants.
  let found = "";
  try {
    found = execFileSync("grep", ["-rl", "fixture-canary-do-not-copy", path], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (e) {
    if (e.status !== 1) throw e;
  }
  assert.equal(found, "", "no file in the snapshot may contain the secret");

  cleanup();
});

test("the caller's working tree is untouched, before and after cleanup", () => {
  const repo = fixture();
  const before = status(repo);
  const head = git(["rev-parse", "HEAD"], repo);

  const { path, cleanup } = createSnapshot(repo);
  assert.equal(status(repo), before, "creating a snapshot must not change the caller's status");

  // Simulate what Debug and Review actually do in there: mutate, and even commit.
  writeFileSync(join(path, "unstaged.txt"), "experiment\n");
  writeFileSync(join(path, "brand-new.txt"), "candidate fix\n");
  git(["add", "-A"], path);
  git(["-c", "user.email=t@l", "-c", "user.name=t", "commit", "-qm", "candidate"], path);

  assert.equal(status(repo), before, "experiments in the snapshot must not reach the caller");
  assert.equal(git(["rev-parse", "HEAD"], repo), head, "the caller's HEAD must not move");
  assert.equal(readFileSync(join(repo, "unstaged.txt"), "utf8"), "UNSTAGED CHANGE\n");

  cleanup();
  assert.equal(status(repo), before, "cleanup must not change the caller either");
});

test("cleanup removes the worktree and leaves no registration behind", () => {
  const repo = fixture();
  const { path, cleanup } = createSnapshot(repo);
  assert.ok(existsSync(path));
  // Match the snapshot's own path, not a shared prefix — `worktree list` also names the
  // fixture repo itself, and a loose regex would match that and pass for the wrong reason.
  assert.ok(git(["worktree", "list"], repo).includes(path), "the worktree should be registered while it lives");

  cleanup();

  assert.ok(!existsSync(path), "the directory must be gone");
  assert.ok(!git(["worktree", "list"], repo).includes(path), "and git must not still list it");
});

test("cleanup is idempotent, so a crashed caller can always call it again", () => {
  const repo = fixture();
  const { path, cleanup } = createSnapshot(repo);
  rmSync(path, { recursive: true, force: true }); // something else got there first
  cleanup();
  cleanup();
  assert.ok(!git(["worktree", "list"], repo).includes(path));
});

test("exported cleanup preserves a locked worktree after Git refuses removal", () => {
  const repo = fixture();
  const { path, cleanup } = createSnapshot(repo);
  const marker = join(path, "uncommitted-experiment.txt");
  writeFileSync(marker, "PRESERVE ME\n");
  git(["worktree", "lock", path], repo);

  assert.throws(() => cleanup(), /nothing was deleted/i);
  assert.equal(readFileSync(marker, "utf8"), "PRESERVE ME\n");
  git(["worktree", "unlock", path], repo);
  cleanup();
  assert.ok(!existsSync(path));
});

test("setup plus cleanup failure reports the preserved worktree path", () => {
  const repo = fixture();
  let preserved;
  assert.throws(
    () => createSnapshot(repo, {
      _afterAttach: ({ path }) => {
        preserved = path;
        writeFileSync(join(path, "setup-failure-marker.txt"), "PRESERVED\n");
        git(["worktree", "lock", path], repo);
        throw new Error("forced setup failure");
      },
    }),
    (error) => /forced setup failure/.test(error.message) && /cleanup also failed/.test(error.message) &&
      error.message.includes(preserved),
  );
  assert.equal(readFileSync(join(preserved, "setup-failure-marker.txt"), "utf8"), "PRESERVED\n");
  git(["worktree", "unlock", preserved], repo);
  git(["worktree", "remove", "--force", preserved], repo);
});

test("a snapshot is a real repo — history and tooling work inside it", () => {
  // Debug runs bisect and log in here; a plain directory copy would not support that.
  const repo = fixture();
  const { path, cleanup } = createSnapshot(repo);
  assert.match(git(["log", "--oneline"], path), /baseline/);
  cleanup();
});

test("an owned workspace may attach a new branch for durable Build work", () => {
  const repo = fixture();
  const branch = "principal/run-test-owned";
  const { path, cleanup } = createSnapshot(repo, { branch });
  assert.equal(git(["branch", "--show-current"], path).trim(), branch);
  writeFileSync(join(path, "owned.txt"), "durable build output\n");
  git(["add", "owned.txt"], path);
  git(["commit", "-qm", "owned work"], path);
  assert.match(git(["log", "-1", "--format=%s"], path), /owned work/);
  cleanup();
  assert.match(git(["branch", "--list", branch], repo), /principal\/run-test-owned/,
    "removing the worktree keeps the branch for merge, PR, or keep finish choices");
});

test("the CLI accepts --branch and prints a branch-attached owned workspace", () => {
  const repo = fixture();
  const branch = "principal/run-cli-owned";
  const path = run(process.execPath, [CLI, "create", "--repo", repo, "--branch", branch], { encoding: "utf8" }).trim();
  assert.equal(git(["branch", "--show-current"], path).trim(), branch);
  run(process.execPath, [CLI, "remove", path, "--repo", repo], { stdio: "pipe" });
});

test("refuses a non-repo and a repo with no commits, rather than half-working", () => {
  const empty = mkdtempSync(join(tmpdir(), "ppfix-"));
  created.push(empty);
  assert.throws(() => createSnapshot(empty), SnapshotError, "a plain directory is not a repo");

  git(["init", "-q", "-b", "main"], empty);
  assert.throws(() => createSnapshot(empty), /no commits/, "an empty repo has no HEAD to snapshot");
});

test("`remove` refuses a path it did not create, instead of deleting it", () => {
  // The original fell back to an unguarded recursive rmSync whenever `git worktree remove`
  // failed — which it does for ANY path that is not a linked worktree, including the user's
  // own checkout. Verified destroying uncommitted work and printing "removed".
  const repo = fixture();
  const victim = join(repo, "important");
  mkdirSync(victim, { recursive: true });
  writeFileSync(join(victim, "data.txt"), "PRECIOUS UNCOMMITTED WORK\n");

  let code = 0;
  try {
    run(process.execPath, [CLI, "remove", victim, "--repo", repo], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    code = e.status;
  }
  assert.equal(code, 1, "must refuse, not succeed");
  assert.equal(readFileSync(join(victim, "data.txt"), "utf8"), "PRECIOUS UNCOMMITTED WORK\n");
});

test("`remove` refuses the registered main checkout and preserves its files", () => {
  const repo = fixture();
  const marker = join(repo, "main-checkout-marker.txt");
  writeFileSync(marker, "DO NOT DELETE\n");

  let code = 0;
  try {
    run(process.execPath, [CLI, "remove", repo, "--repo", repo], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    code = e.status;
  }
  assert.equal(code, 1, "the main worktree must be refused even though Git registers it");
  assert.equal(readFileSync(marker, "utf8"), "DO NOT DELETE\n");
  assert.ok(existsSync(join(repo, ".git")), "the repository itself must remain intact");
});

test("`remove` preserves an owned path when Git refuses removal", () => {
  const repo = fixture();
  const path = run(process.execPath, [CLI, "create", "--repo", repo], { encoding: "utf8" }).trim();
  git(["worktree", "lock", path], repo);

  let code = 0;
  try {
    run(process.execPath, [CLI, "remove", path, "--repo", repo], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    code = e.status;
  }
  assert.equal(code, 1, "a Git refusal must remain a refusal");
  assert.ok(existsSync(path), "generic Git failure must never fall back to recursive deletion");
  git(["worktree", "unlock", path], repo);
  run(process.execPath, [CLI, "remove", path, "--repo", repo], { stdio: "pipe" });
});

test("`remove` refuses an unregistered ppw-* direct child of the temp directory", () => {
  const repo = fixture();
  const abandoned = mkdtempSync(join(tmpdir(), "ppw-"));
  created.push(abandoned);
  const marker = join(abandoned, "unregistered.txt");
  writeFileSync(marker, "NOT OWNED BY THIS REPOSITORY\n");

  assert.throws(
    () => run(process.execPath, [CLI, "remove", abandoned, "--repo", repo], { encoding: "utf8", stdio: "pipe" }),
    (error) => error.status === 1,
  );
  assert.equal(readFileSync(marker, "utf8"), "NOT OWNED BY THIS REPOSITORY\n");
});

test("`prune` drops gone registrations but does not discover abandoned ppw-* directories", () => {
  const repo = fixture();
  const registered = run(process.execPath, [CLI, "create", "--repo", repo], { encoding: "utf8" }).trim();
  rmSync(registered, { recursive: true, force: true });

  const abandoned = mkdtempSync(join(tmpdir(), "ppw-"));
  created.push(abandoned);
  const marker = join(abandoned, "abandoned.txt");
  writeFileSync(marker, "PRUNE DOES NOT DISCOVER THIS\n");

  run(process.execPath, [CLI, "prune", "--repo", repo], { stdio: "pipe" });

  assert.ok(!git(["worktree", "list", "--porcelain"], repo).includes(registered),
    "Git prune removes a registration after its directory is already gone");
  assert.equal(readFileSync(marker, "utf8"), "PRUNE DOES NOT DISCOVER THIS\n",
    "the CLI does not search the temp directory for abandoned snapshots");
});

test("`remove` still removes a real snapshot, and exits 0", () => {
  const repo = fixture();
  const path = run(process.execPath, [CLI, "create", "--repo", repo], { encoding: "utf8" }).trim();
  assert.ok(existsSync(path));
  run(process.execPath, [CLI, "remove", path, "--repo", repo], { stdio: "pipe" });
  assert.ok(!existsSync(path), "the snapshot it created must still be removable");
});

test.after(() => {
  for (const d of created) rmSync(d, { recursive: true, force: true });
});

test("Git recovery requires operation-specific preservation before destructive authorization", () => {
  const contract = readFileSync(join(dirname(CLI), "..", "git-ops", "SKILL.md"), "utf8");
  const recovery = contract.split("## Destructive recovery preservation")[1]?.split("## Release mode")[0] ?? "";
  assert.match(recovery, /tracked.*index.*untracked.*ignored/s);
  assert.match(recovery, /outside.*destructive scope/s);
  assert.match(recovery, /restor.*disposable/s);
  assert.match(recovery, /fresh.*state/s);
  assert.match(recovery, /explicit.*acceptance/s);
  assert.match(recovery, /snapshot.*index.*ignored/s);
  assert.match(recovery, /publication.*unknown.*published/s);
});

test("the workspace snapshot is not a backup of distinct index and working-tree states", () => {
  const repo = fixture();
  writeFileSync(join(repo, "staged.txt"), "UNSTAGED ON TOP OF STAGED\n");
  const stagedBefore = git(["diff", "--cached", "--binary"], repo);
  const { path, cleanup } = createSnapshot(repo);
  try {
    assert.equal(readFileSync(join(path, "staged.txt"), "utf8"), "UNSTAGED ON TOP OF STAGED\n");
    assert.notEqual(stagedBefore, "");
    assert.equal(git(["diff", "--cached", "--binary"], path), "", "helper deliberately flattens the index into working bytes");
    assert.equal(git(["diff", "--cached", "--binary"], repo), stagedBefore, "source index is untouched");
    assert.ok(!existsSync(join(path, ".env")), "ignored state is deliberately absent");
  } finally { cleanup(); }
});

test("an external private fixture backup restores index, working, untracked and ignored state", () => {
  // This is one fully inventoried standalone-repository case, not a universal backup
  // helper: linked worktrees, external object stores and submodules need their own proof.
  const repo = fixture();
  writeFileSync(join(repo, "staged.txt"), "UNSTAGED ON TOP OF STAGED\n");
  writeFileSync(join(repo, "binary.dat"), Buffer.from([0, 255, 1, 0]));
  git(["add", "binary.dat"], repo);
  writeFileSync(join(repo, "binary.dat"), Buffer.from([0, 254, 2, 0]));
  chmodSync(join(repo, "unstaged.txt"), 0o755);
  const external = mkdtempSync(join(tmpdir(), "pp-preservation-"));
  created.push(external);
  chmodSync(external, 0o700);
  const backup = join(external, "backup");
  const restored = join(external, "restored");
  const state = (path) => ({
    head: git(["rev-parse", "HEAD"], path),
    status: git(["status", "--porcelain=v1", "--ignored", "--untracked-files=all", "-z"], path),
    index: git(["ls-files", "--stage", "-z"], path),
    staged: git(["diff", "--cached", "--binary", "--no-ext-diff", "--no-textconv"], path),
    working: git(["diff", "--binary", "--no-ext-diff", "--no-textconv"], path),
    untracked: readFileSync(join(path, "untracked.txt")).toString("hex"),
    ignored: readFileSync(join(path, ".env")).toString("hex"),
    ignoredNested: readFileSync(join(path, "node_modules", "left-pad", "index.js")).toString("hex"),
    link: readlinkSync(join(path, "untracked-link")),
    mode: lstatSync(join(path, "unstaged.txt")).mode,
  });
  const before = state(repo);
  cpSync(repo, backup, { recursive: true, verbatimSymlinks: true });
  cpSync(backup, restored, { recursive: true, verbatimSymlinks: true });
  assert.deepEqual(state(restored), before, "restoration is proved BEFORE the disposable destructive operation");
  assert.deepEqual(state(repo), before, "fresh source state still matches the preserved state");
  assert.ok(!backup.startsWith(`${repo}/`), "backup stays outside the destructive scope");
  git(["reset", "--hard", "HEAD"], repo);
  git(["clean", "-fdx"], repo);
  assert.ok(!existsSync(join(repo, "untracked.txt")) && !existsSync(join(repo, ".env")), "fixture exercises real at-risk state");
  assert.deepEqual(state(restored), before, "verified restoration remains available after the original state is removed");
  assert.deepEqual(state(backup), before, "preserved copy remains intact");
});
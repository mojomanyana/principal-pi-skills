#!/usr/bin/env node
/**
 * Create a disposable copy of the caller's working state, so a phase that needs to run or
 * mutate code can do it without touching the checkout the user is sitting in.
 *
 * Debug proves candidate fixes; Review runs tests and sometimes reverts a fix to check a
 * regression test actually fails without it. Both are legitimate, and both are destructive
 * if they happen in the caller's tree — the user comes back to a working directory they did
 * not change, or worse, to a "verified" result produced against a tree that was quietly
 * modified. Build is the only phase that writes durably, and it writes where the user can
 * see it.
 *
 * What the snapshot contains, so a test run there means what it means:
 *
 *   - the committed HEAD
 *   - staged AND unstaged changes to tracked files, deletions included
 *   - untracked files that are not ignored
 *   - symlinks, as symlinks
 *
 * What it never contains, and why this is a security property rather than tidiness:
 *
 *   - anything git ignores — `.env`, credentials, caches, node_modules
 *
 * Ignored files are excluded structurally, not by pattern-matching a denylist here: the
 * snapshot is built from `git diff HEAD` and `git ls-files --others --exclude-standard`,
 * neither of which can see an ignored file. A denylist would need to anticipate every name
 * a secret might have; this cannot miss one, because it is never looking at them.
 *
 * A worktree, not a copy: it shares the object database, so it is cheap and it carries real
 * history — `git log`, `git bisect` and `git stash` work inside it. It is detached, so
 * nothing there can move a branch the caller cares about.
 *
 * Usage:
 *   node scripts/snapshot-workspace.mjs create [--repo <dir>] [--branch <name>] → prints the path
 *   node scripts/snapshot-workspace.mjs remove <path> [--repo <dir>]
 *   node scripts/snapshot-workspace.mjs prune [--repo <dir>]
 *
 * Detached is the default for disposable Debug/Review experiments. `--branch` creates an
 * owned workspace for durable Build work; removing that worktree keeps the branch available
 * for Git-Ops to merge, open a PR, or retain.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, symlinkSync, readlinkSync, lstatSync, existsSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const git = (args, cwd, opts = {}) =>
  execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });

export const SNAPSHOT_PREFIX = "ppw-";

export class SnapshotError extends Error {}

/**
 * Build the snapshot. Returns { path, cleanup }.
 *
 * `cleanup` is idempotent and safe to call after the process has already removed the
 * directory some other way — a caller that crashed mid-run should not be punished for
 * calling it twice.
 */
export function createSnapshot(repo = process.cwd(), { branch = null, _afterAttach = null } = {}) {
  let root;
  try {
    root = git(["rev-parse", "--show-toplevel"], repo).trim();
  } catch {
    throw new SnapshotError(`not a git repository: ${repo}`);
  }

  // A repo with no commits has no HEAD to branch a worktree from. Say so plainly — the
  // caller's contract turns this into BLOCKED or UNVERIFIED rather than guessing.
  try {
    git(["rev-parse", "--verify", "HEAD"], root, { stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new SnapshotError("repository has no commits yet — nothing to snapshot");
  }

  const path = mkdtempSync(join(tmpdir(), SNAPSHOT_PREFIX));
  rmSync(path, { recursive: true, force: true }); // git worktree add wants a non-existent path

  const cleanup = () => {
    // A missing path is already clean; prune any stale registration and remain idempotent.
    if (!existsSync(path)) {
      try {
        git(["worktree", "prune"], root, { stdio: "ignore" });
      } catch {
        /* best-effort metadata cleanup; there is no directory to delete */
      }
      return;
    }
    try {
      git(["worktree", "remove", "--force", path], root, { stdio: "ignore" });
    } catch {
      // Lock, permission, and repository failures are not permission to recurse. The path is
      // a real worktree and can contain uncommitted experiments; preserve it for inspection.
      throw new SnapshotError(`git refused to remove ${path}; nothing was deleted`);
    }
    try {
      git(["worktree", "prune"], root, { stdio: "ignore" });
    } catch {
      /* pruning is best-effort after Git has already removed the worktree */
    }
  };

  try {
    if (branch) {
      try {
        git(["check-ref-format", "--branch", branch], root, { stdio: ["ignore", "ignore", "pipe"] });
      } catch {
        throw new SnapshotError(`invalid workspace branch: ${branch}`);
      }
      git(["worktree", "add", "-b", branch, path, "HEAD"], root, { stdio: ["ignore", "ignore", "pipe"] });
    } else {
      git(["worktree", "add", "--detach", path, "HEAD"], root, { stdio: ["ignore", "ignore", "pipe"] });
    }
    if (_afterAttach !== null) {
      if (typeof _afterAttach !== "function") throw new SnapshotError("_afterAttach must be a function when supplied");
      _afterAttach({ path, root }); // deterministic failure injection for cleanup safety tests
    }

    // Tracked changes: staged and unstaged together, deletions and mode changes included.
    // `git diff HEAD` cannot see ignored files, which is exactly the property we want.
    const patch = git(["diff", "HEAD", "--binary", "--no-color"], root);
    if (patch.trim()) {
      const patchFile = join(path, ".ppw-snapshot.patch");
      writeFileSync(patchFile, patch);
      try {
        git(["apply", "--whitespace=nowarn", patchFile], path, { stdio: ["ignore", "ignore", "pipe"] });
      } finally {
        rmSync(patchFile, { force: true });
      }
    }

    // Untracked-but-not-ignored files. -z because filenames may contain newlines.
    const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"], root)
      .split("\0")
      .filter(Boolean);
    for (const rel of untracked) {
      const from = join(root, rel);
      const to = join(path, rel);
      mkdirSync(dirname(to), { recursive: true });
      const st = lstatSync(from);
      if (st.isSymbolicLink()) {
        symlinkSync(readlinkSync(from), to);
      } else if (st.isFile()) {
        copyFileSync(from, to);
      }
      // Anything else (fifo, socket, device) is deliberately skipped: it is not source, and
      // copying it could block.
    }

    return { path, cleanup, root };
  } catch (e) {
    const setupError = e instanceof SnapshotError ? e : new SnapshotError(`could not create snapshot: ${e.message}`);
    try {
      cleanup();
    } catch (cleanupError) {
      throw new SnapshotError(
        `${setupError.message}; cleanup also failed: ${cleanupError.message}; preserved worktree: ${path}`,
      );
    }
    throw setupError;
  }
}

function main(argv) {
  const valueOf = (name) => {
    const index = argv.indexOf(name);
    if (index === -1) return null;
    if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new SnapshotError(`${name} requires a value`);
    return argv[index + 1];
  };
  let repoValue;
  let branch;
  try {
    repoValue = valueOf("--repo");
    branch = valueOf("--branch");
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 2;
  }
  const repo = repoValue ? resolve(repoValue) : process.cwd();
  const consumed = new Set();
  for (const name of ["--repo", "--branch"]) {
    const index = argv.indexOf(name);
    if (index !== -1) {
      consumed.add(index);
      consumed.add(index + 1);
    }
  }
  const args = argv.filter((_, index) => !consumed.has(index));
  const [cmd, arg] = args;

  try {
    if (cmd === "create") {
      const { path } = createSnapshot(repo, { branch });
      console.log(path);
      return 0;
    }
    if (cmd === "remove") {
      if (!arg) {
        console.error("usage: snapshot-workspace remove <path>");
        return 2;
      }
      const root = git(["rev-parse", "--show-toplevel"], repo).trim();
      const canonicalRoot = realpathSync(root);
      const target = resolve(arg);
      const canonicalTemp = realpathSync(tmpdir());
      let canonicalTarget = target;
      if (existsSync(target)) canonicalTarget = realpathSync(target);

      // Registration alone is not ownership: the repository's main checkout is registered
      // too. Accept only the direct ppw-* children this tool creates under the canonical temp
      // root, and reject the main checkout explicitly even if someone gave it that shape.
      const isOurs =
        canonicalTarget !== canonicalRoot &&
        dirname(canonicalTarget) === canonicalTemp &&
        basename(canonicalTarget).startsWith(SNAPSHOT_PREFIX);
      let registered = false;
      try {
        registered = git(["worktree", "list", "--porcelain"], canonicalRoot)
          .split("\n")
          .filter((line) => line.startsWith("worktree "))
          .some((line) => {
            const listed = resolve(line.slice(9));
            return (existsSync(listed) ? realpathSync(listed) : listed) === canonicalTarget;
          });
      } catch {
        /* Query failure is a refusal, never permission to delete. */
      }
      if (!isOurs || !registered) {
        console.error(`✗ refusing to remove ${target}`);
        console.error(`  It is not a registered ${SNAPSHOT_PREFIX}* worktree directly under ${canonicalTemp}.`);
        return 1;
      }

      try {
        git(["worktree", "remove", "--force", canonicalTarget], canonicalRoot, { stdio: "ignore" });
      } catch {
        // A generic Git failure can mean a lock, permissions, or repository corruption. Never
        // turn it into recursive deletion; leave the path intact for an operator to inspect.
        console.error(`✗ git refused to remove ${canonicalTarget}; nothing was deleted`);
        return 1;
      }
      git(["worktree", "prune"], canonicalRoot, { stdio: "ignore" });
      console.log(`removed ${canonicalTarget}`);
      return 0;
    }
    if (cmd === "prune") {
      const root = git(["rev-parse", "--show-toplevel"], repo).trim();
      git(["worktree", "prune"], root, { stdio: "ignore" });
      console.log("pruned");
      return 0;
    }
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }

  console.error("usage: snapshot-workspace <create|remove <path>|prune> [--repo <dir>] [--branch <name>]");
  return 2;
}

// realpathSync, not a bare compare: npm installs bins as symlinks
// (node_modules/.bin/<name> -> ../<pkg>/scripts/<file>.mjs), so argv[1] is the .bin path
// while import.meta.url is already resolved. Comparing them unresolved makes this false for
// every installed user — the CLI silently does nothing and exits 0, which reads as success.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();
if (invokedDirectly) process.exit(main(process.argv.slice(2)));

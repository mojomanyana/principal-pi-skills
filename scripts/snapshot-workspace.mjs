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
 *   node scripts/snapshot-workspace.mjs create [--repo <dir>]   → prints the path
 *   node scripts/snapshot-workspace.mjs remove <path> [--repo <dir>]
 *   node scripts/snapshot-workspace.mjs prune [--repo <dir>]
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, symlinkSync, readlinkSync, lstatSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const git = (args, cwd, opts = {}) =>
  execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });

export class SnapshotError extends Error {}

/**
 * Build the snapshot. Returns { path, cleanup }.
 *
 * `cleanup` is idempotent and safe to call after the process has already removed the
 * directory some other way — a caller that crashed mid-run should not be punished for
 * calling it twice.
 */
export function createSnapshot(repo = process.cwd()) {
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

  const path = mkdtempSync(join(tmpdir(), "ppw-"));
  rmSync(path, { recursive: true, force: true }); // git worktree add wants a non-existent path

  const cleanup = () => {
    try {
      git(["worktree", "remove", "--force", path], root, { stdio: "ignore" });
    } catch {
      rmSync(path, { recursive: true, force: true });
    }
    try {
      git(["worktree", "prune"], root, { stdio: "ignore" });
    } catch {
      /* pruning is best-effort; the directory is already gone */
    }
  };

  try {
    git(["worktree", "add", "--detach", path, "HEAD"], root, { stdio: ["ignore", "ignore", "pipe"] });

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
    cleanup(); // never leak a worktree on a setup failure
    throw e instanceof SnapshotError ? e : new SnapshotError(`could not create snapshot: ${e.message}`);
  }
}

function main(argv) {
  const repoFlag = argv.indexOf("--repo");
  const repo = repoFlag === -1 ? process.cwd() : resolve(argv[repoFlag + 1] ?? ".");
  const args = argv.filter((a, i) => a !== "--repo" && i !== repoFlag + 1);
  const [cmd, arg] = args;

  try {
    if (cmd === "create") {
      const { path } = createSnapshot(repo);
      console.log(path);
      return 0;
    }
    if (cmd === "remove") {
      if (!arg) {
        console.error("usage: snapshot-workspace remove <path>");
        return 2;
      }
      const root = git(["rev-parse", "--show-toplevel"], repo).trim();
      try {
        git(["worktree", "remove", "--force", arg], root, { stdio: "ignore" });
      } catch {
        if (existsSync(arg)) rmSync(arg, { recursive: true, force: true });
      }
      git(["worktree", "prune"], root, { stdio: "ignore" });
      console.log(`removed ${arg}`);
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

  console.error("usage: snapshot-workspace <create|remove <path>|prune> [--repo <dir>]");
  return 2;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) process.exit(main(process.argv.slice(2)));

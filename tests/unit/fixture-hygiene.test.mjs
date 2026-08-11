/**
 * Fixtures must contain nothing a clean checkout would not have.
 *
 * The harness fingerprints a seeded fixture by hashing its DIRECTORY, ignored files
 * included. So a `vitest` run inside `debug/tests/fixtures/A6` left a
 * `node_modules/.vite/` cache there, the recorded run hashed it, and afterwards the cell
 * looked current on the machine that still had the cache and stale on every machine that
 * did not. `npm test` was green locally and red in CI for two commits, over a published
 * scorecard cell — and the greener answer was the wrong one.
 *
 * This is the third time build output inside a fixture has cost this project real work
 * (see the 2.3.1 changelog: two `.vite` caches tracked by a blanket `git add -A`, and two
 * fixtures a local test run had silently rewritten). Ignoring them stopped them reaching
 * git; it did not stop them churning the hash. This test does.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("no fixture directory contains ignored build output", () => {
  // --ignored surfaces exactly what a clean checkout would NOT have. Anything it reports
  // under a fixture path is invisible to git and visible to the harness's hash.
  //
  // Filter in JS, not with a `*/tests/fixtures` pathspec: execFileSync runs git without a
  // shell, so the glob reaches git literally and matches nothing — which made the first
  // version of this test pass with the cache sitting right there.
  const out = execFileSync("git", ["status", "--porcelain", "--ignored"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const polluted = out
    .split("\n")
    .filter((l) => l.startsWith("!!"))
    .map((l) => l.slice(3).trim())
    .filter((p) => /(^|\/)[^/]+\/tests\/fixtures\//.test(p));

  assert.deepEqual(
    polluted,
    [],
    "these paths exist locally, are invisible to git, and are hashed into the fixture " +
      "fingerprint — so this machine will disagree with CI about whether the cell is " +
      `stale:\n  ${polluted.join("\n  ")}\nDelete them and re-check `
      + "`npm run lint:skills`.",
  );
});

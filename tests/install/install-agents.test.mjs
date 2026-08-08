/**
 * Tests for the agent installer.
 *
 * Everything here runs against a temporary PI_CODING_AGENT_DIR. That is not merely tidiness:
 * this tool writes into the user's home directory, so a test that got the target wrong would
 * modify the developer's real agents while printing green. The last test asserts the real
 * home was never touched.
 *
 * Run with `node --test tests/install/*.test.mjs`.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync, rmSync, lstatSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

import { run, agentsDir, sources } from "../../scripts/install-agents.mjs";

// Track exactly what we create and delete exactly that. A prefix glob would be shorter and
// wrong: `node --test` runs test FILES concurrently, so a broad `rm /tmp/ppa-*` reaches into
// a sibling suite's working directory mid-run. It did, once.
const created = [];
const fresh = () => {
  const base = mkdtempSync(join(tmpdir(), "ppa-agents-"));
  created.push(base);
  return { env: { PI_CODING_AGENT_DIR: join(base, "agent") }, dir: join(base, "agent", "agents"), base };
};
const ls = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".md")).sort() : []);
const quiet = (fn) => {
  // The installer reports to the console by design; tests assert on exit codes and the
  // filesystem, so keep the output out of the test log.
  const [log, err] = [console.log, console.error];
  console.log = console.error = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
    console.error = err;
  }
};

test("agentsDir honours PI_CODING_AGENT_DIR, falling back to ~/.pi/agent", () => {
  assert.equal(agentsDir({ PI_CODING_AGENT_DIR: "/x/agent" }, "/home/u"), join("/x/agent", "agents"));
  assert.equal(agentsDir({}, "/home/u"), join("/home/u", ".pi", "agent", "agents"));
});

test("install writes only principal-* by default", () => {
  const { env, dir } = fresh();
  assert.equal(quiet(() => run(["install"], env)), 0);
  const files = ls(dir);
  assert.deepEqual(files, ["principal-debug.md", "principal-plan.md", "principal-review.md"]);
  assert.ok(!files.includes("plan.md"), "generic aliases must not install without the flag");
});

test("the generic aliases need an explicit compatibility flag", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install", "--with-generic-aliases"], env));
  assert.deepEqual(ls(dir), [
    "debug.md", "plan.md", "principal-debug.md", "principal-plan.md", "principal-review.md", "review.md",
  ]);
});

test("installed agents are real files, not symlinks into the checkout", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  const content = readFileSync(join(dir, "principal-plan.md"), "utf8");
  assert.match(content, /^name: principal-plan$/m);
  // A symlink would break silently if the checkout moved, and pi would report an unknown
  // agent rather than a broken link — the failure mode of the previously documented
  // `ln -sf "$(pwd)"/agents/*.md` install.
  assert.ok(!lstatSync(join(dir, "principal-plan.md")).isSymbolicLink());
});

test("install is idempotent", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  const before = readFileSync(join(dir, "principal-plan.md"), "utf8");
  assert.equal(quiet(() => run(["install"], env)), 0);
  assert.equal(readFileSync(join(dir, "principal-plan.md"), "utf8"), before);
});

test("refuses to overwrite a file it does not own, and writes nothing at all", () => {
  const { env, dir } = fresh();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "principal-plan.md"), "someone else's agent\n");

  assert.equal(quiet(() => run(["install"], env)), 1, "must exit non-zero on refusal");
  assert.equal(readFileSync(join(dir, "principal-plan.md"), "utf8"), "someone else's agent\n");
  // Refusal is all-or-nothing: a partial install would leave the user half-migrated with
  // no clear way back.
  assert.deepEqual(ls(dir), ["principal-plan.md"], "no other agent should have been written");
});

test("--force overwrites a foreign file, but only when asked", () => {
  const { env, dir } = fresh();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "principal-plan.md"), "someone else's agent\n");
  assert.equal(quiet(() => run(["install", "--force"], env)), 0);
  assert.match(readFileSync(join(dir, "principal-plan.md"), "utf8"), /^name: principal-plan$/m);
});

test("refuses to write through a symlink", () => {
  const { env, dir } = fresh();
  mkdirSync(dir, { recursive: true });
  const victim = join(dir, "..", "victim.md");
  writeFileSync(victim, "untouched\n");
  symlinkSync(victim, join(dir, "principal-plan.md"));

  assert.equal(quiet(() => run(["install"], env)), 1);
  assert.equal(readFileSync(victim, "utf8"), "untouched\n", "must not write through the link");
});

test("check reports missing, stale, and satisfied states distinctly", () => {
  const { env, dir } = fresh();
  assert.equal(quiet(() => run(["check"], env)), 1, "missing directory is not satisfied");

  quiet(() => run(["install"], env));
  assert.equal(quiet(() => run(["check"], env)), 0);

  writeFileSync(join(dir, "principal-plan.md"), "locally edited\n");
  assert.equal(quiet(() => run(["check"], env)), 1, "an edited agent is drift");
});

test("uninstall removes what it installed", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  assert.equal(quiet(() => run(["uninstall"], env)), 0);
  assert.deepEqual(ls(dir), []);
});

test("uninstall keeps files the user edited, and forgets the ones it removed", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  writeFileSync(join(dir, "principal-plan.md"), "my own edits\n");

  quiet(() => run(["uninstall"], env));
  assert.deepEqual(ls(dir), ["principal-plan.md"], "an edited agent belongs to the user now");
  assert.equal(readFileSync(join(dir, "principal-plan.md"), "utf8"), "my own edits\n");

  // A second uninstall must not resurrect claims on the files already removed.
  assert.equal(quiet(() => run(["uninstall"], env)), 0);
  assert.deepEqual(ls(dir), ["principal-plan.md"]);
});

test("uninstall never touches an unrelated agent", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  writeFileSync(join(dir, "someone-elses.md"), "not ours\n");
  quiet(() => run(["uninstall"], env));
  assert.deepEqual(ls(dir), ["someone-elses.md"]);
});

test("unknown flags and commands are usage errors, not silent no-ops", () => {
  const { env } = fresh();
  assert.equal(quiet(() => run(["install", "--yolo"], env)), 2);
  assert.equal(quiet(() => run(["frobnicate"], env)), 2);
  assert.equal(quiet(() => run([], env)), 2);
});

test("every source agent is namespaced or a known generic alias", () => {
  const { namespaced, generic } = sources();
  assert.deepEqual(namespaced, ["principal-debug.md", "principal-plan.md", "principal-review.md"]);
  assert.deepEqual(generic, ["debug.md", "plan.md", "review.md"]);
});

test("the developer's real agents directory was never touched", () => {
  // The whole suite ran against temp dirs. If any test resolved the default path instead,
  // this is where it shows up — and it must not depend on the real directory existing.
  const real = agentsDir({}, homedir());
  const stamp = existsSync(real) ? readdirSync(real).sort().join(",") : "<absent>";
  assert.equal(stamp, globalThis.__realAgentsBefore ?? stamp);
});

globalThis.__realAgentsBefore = (() => {
  const real = agentsDir({}, homedir());
  return existsSync(real) ? readdirSync(real).sort().join(",") : "<absent>";
})();

test.after(() => {
  for (const d of created) rmSync(d, { recursive: true, force: true });
});

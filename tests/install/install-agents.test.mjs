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

import test, { mock } from "node:test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync, rmSync, lstatSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { run, agentsDir, sources, plan } from "../../scripts/install-agents.mjs";

const ROOT_AGENTS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "agents");

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
  assert.deepEqual(files, ["principal-build.md", "principal-debug.md", "principal-investigate.md", "principal-plan.md", "principal-review.md"]);
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

test("--force cannot overwrite a foreign file", () => {
  const { env, dir } = fresh();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "principal-plan.md"), "someone else's agent\n");
  assert.equal(quiet(() => run(["install", "--force"], env)), 1);
  assert.equal(readFileSync(join(dir, "principal-plan.md"), "utf8"), "someone else's agent\n");
  assert.deepEqual(ls(dir), ["principal-plan.md"]);
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

test("--force cannot replace a symlink or dangling symlink", () => {
  for (const dangling of [false, true]) {
    const { env, dir, base } = fresh();
    mkdirSync(dir, { recursive: true });
    const victim = join(base, "important.txt");
    if (!dangling) writeFileSync(victim, "IMPORTANT USER FILE\n");
    symlinkSync(victim, join(dir, "principal-plan.md"));
    assert.equal(quiet(() => run(["install", "--force"], env)), 1);
    assert.ok(lstatSync(join(dir, "principal-plan.md")).isSymbolicLink());
    assert.deepEqual(ls(dir), ["principal-plan.md"]);
    if (!dangling) assert.equal(readFileSync(victim, "utf8"), "IMPORTANT USER FILE\n");
    else assert.ok(!existsSync(victim));
  }
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

test("identical unowned files are refused, never adopted or later uninstalled", () => {
  for (const force of [[], ["--force"]]) {
    const { env, dir } = fresh();
    mkdirSync(dir, { recursive: true });
    for (const f of sources()) writeFileSync(join(dir, f), readFileSync(join(ROOT_AGENTS, f)));
    assert.equal(quiet(() => run(["install", ...force], env)), 1);
    assert.ok(!existsSync(join(dir, ".principal-pi-skills.json")));
    assert.equal(quiet(() => run(["uninstall"], env)), 0);
    assert.deepEqual(ls(dir), sources());
  }
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

test("every source agent is namespaced", () => {
  assert.deepEqual(sources(), ["principal-build.md", "principal-debug.md", "principal-investigate.md", "principal-plan.md", "principal-review.md"]);
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

const MANIFEST = ".principal-pi-skills.json";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const ownedManifest = (files) => JSON.stringify({ package: "principal-pi-skills", files });
const image = (dir) => Object.fromEntries(readdirSync(dir).sort().map((name) => {
  const path = join(dir, name);
  const st = lstatSync(path);
  return [name, { type: st.mode, mtime: st.mtimeMs, bytes: st.isFile() ? readFileSync(path).toString("hex") : null }];
}));

// Ownership metadata is authority: every row must be valid before the first mutation.
test("invalid and duplicate manifest metadata refuses every command without writes", () => {
  const h = hash("owned\n");
  const invalid = [
    "{", "null", "[]", "{}",
    JSON.stringify({ package: "foreign", files: { "principal-plan.md": h } }),
    JSON.stringify({ package: "principal-pi-skills", files: [], extra: true }),
    JSON.stringify({ package: "principal-pi-skills", files: {}, extra: true }),
    ownedManifest({ "principal-plan.md": 1 }),
    ownedManifest({ "principal-plan.md": "not-a-sha256" }),
    ownedManifest({ "principal-plan.md": h, "../outside.md": h }),
    ownedManifest({ "principal-plan.md": h, "/absolute.md": h }),
    ownedManifest({ "principal-plan.md": h, "C:\\outside.md": h }),
    ownedManifest({ "principal-plan.md": h, "sub\\principal-plan.md": h }),
    ownedManifest({ "principal-plan.md": h, "foreign.md": h }),
    `{"package":"principal-pi-skills","package":"principal-pi-skills","files":{}}`,
    `{"package":"principal-pi-skills","files":{"principal-plan.md":"${h}","principal-pl\\u0061n.md":"${h}"}}`,
    `{"package":"principal-pi-skills","files":{}}${" ".repeat(65536)}`,
  ];
  for (const metadata of invalid) for (const command of [["install"], ["install", "--force"], ["check"], ["uninstall"]]) {
    const { env, dir, base } = fresh();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "principal-plan.md"), "owned\n");
    writeFileSync(join(base, "outside.md"), "owned\n");
    writeFileSync(join(dir, MANIFEST), metadata);
    const before = image(dir);
    assert.equal(quiet(() => run(command, env)), 1, `${command}: ${metadata.slice(0, 150)}`);
    assert.deepEqual(image(dir), before, "late invalid metadata must not follow earlier writes/removals");
    assert.equal(readFileSync(join(base, "outside.md"), "utf8"), "owned\n");
  }
});

test("ordinary owned files update, but edits remain protected even with --force", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  const file = "principal-plan.md";
  writeFileSync(join(dir, file), "old installed version\n");
  const manifest = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
  manifest.files[file] = hash("old installed version\n");
  writeFileSync(join(dir, MANIFEST), JSON.stringify(manifest));
  assert.equal(quiet(() => run(["install"], env)), 0);
  assert.equal(readFileSync(join(dir, file), "utf8"), readFileSync(join(ROOT_AGENTS, file), "utf8"));
  writeFileSync(join(dir, file), "user edits\n");
  const before = image(dir);
  assert.equal(quiet(() => run(["install", "--force"], env)), 1);
  assert.deepEqual(image(dir), before);
});

test("all owned target types and manifest type are validated before uninstall", () => {
  for (const location of ["principal-review.md", MANIFEST]) for (const kind of ["symlink", "directory", "fifo"]) {
    const { env, dir, base } = fresh();
    quiet(() => run(["install"], env));
    const target = join(dir, location);
    const saved = readFileSync(target);
    rmSync(target);
    if (kind === "symlink") {
      const outside = join(base, "outside");
      writeFileSync(outside, saved);
      symlinkSync(outside, target);
    } else if (kind === "directory") mkdirSync(target);
    else execFileSync("mkfifo", [target]);
    const before = image(dir);
    // Execute out-of-process: reading a FIFO must refuse, never hang the test runner.
    for (const cmd of ["install", "check", "uninstall"]) {
      const result = spawnSync(process.execPath, [join(ROOT_AGENTS, "..", "scripts", "install-agents.mjs"), cmd], {
        env: { ...process.env, ...env }, encoding: "utf8", timeout: 3000,
      });
      assert.equal(result.error, undefined, `${cmd} ${location} ${kind} must not block`);
      assert.equal(result.status, 1);
      assert.deepEqual(image(dir), before);
    }
  }
});

test("symlinked destination ancestors refuse before creating any agents directory", () => {
  const { env, base } = fresh();
  const outside = join(base, "outside");
  mkdirSync(outside);
  symlinkSync(outside, env.PI_CODING_AGENT_DIR);
  assert.equal(quiet(() => run(["install", "--force"], env)), 1);
  assert.deepEqual(readdirSync(outside), []);
});

test("source and requested-name validation precede target directory creation", () => {
  const { env, dir, base } = fresh();
  const root = join(base, "package");
  mkdirSync(join(root, "agents"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "principal-pi-skills" }));
  for (const file of sources()) writeFileSync(join(root, "agents", file), readFileSync(join(ROOT_AGENTS, file)));
  for (const wanted of [["principal-plan.md", "../outside.md"], ["principal-plan.md", "principal-plan.md"]]) {
    assert.throws(() => plan(dir, wanted, root));
    assert.ok(!existsSync(dir));
  }
  rmSync(join(root, "agents", "principal-review.md"));
  symlinkSync(join(ROOT_AGENTS, "principal-review.md"), join(root, "agents", "principal-review.md"));
  assert.equal(quiet(() => run(["install"], env, { root })), 1);
  assert.ok(!existsSync(env.PI_CODING_AGENT_DIR));
});

test("a filesystem write failure reports partial effects and does not claim rollback", () => {
  const { env, dir } = fresh();
  const original = fs.writeFileSync;
  const errors = [];
  const writeMock = mock.method(fs, "writeFileSync", (path, value, ...args) => {
    if (String(value).includes("name: principal-debug\n")) throw Object.assign(new Error("injected write failure"), { code: "EIO" });
    return original(path, value, ...args);
  });
  const errorMock = mock.method(console, "error", (...args) => errors.push(args.join(" ")));
  const logMock = mock.method(console, "log", () => {});
  try {
    assert.equal(run(["install"], env), 1);
    assert.ok(existsSync(join(dir, "principal-build.md")));
    assert.ok(!existsSync(join(dir, MANIFEST)));
    assert.match(errors.join("\n"), /partial/i);
    assert.match(errors.join("\n"), /principal-build\.md/);
    assert.doesNotMatch(errors.join("\n"), /nothing was written/i);
  } finally {
    writeMock.mock.restore(); errorMock.mock.restore(); logMock.mock.restore();
  }
});
test("legacy aliases with valid ownership remain readable and uninstallable", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  const manifest = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
  for (const name of ["debug.md", "plan.md", "review.md"]) {
    writeFileSync(join(dir, name), `legacy ${name}\n`);
    manifest.files[name] = hash(`legacy ${name}\n`);
  }
  writeFileSync(join(dir, MANIFEST), JSON.stringify(manifest));
  assert.equal(quiet(() => run(["install"], env)), 0, "upgrade preserves supported historical ownership");
  assert.equal(quiet(() => run(["check"], env)), 1, "retired aliases cannot produce a misleading current result");
  assert.equal(quiet(() => run(["uninstall"], env)), 0);
  assert.deepEqual(readdirSync(dir), []);
});

test("unreadable metadata is a refusal, not an absent installation", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  const before = image(dir);
  const open = fs.openSync;
  const stub = mock.method(fs, "openSync", (path, ...args) => {
    if (path === join(dir, MANIFEST)) throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    return open(path, ...args);
  });
  try {
    for (const cmd of ["install", "check", "uninstall"]) assert.equal(quiet(() => run([cmd], env)), 1);
  } finally { stub.mock.restore(); }
  assert.deepEqual(image(dir), before);
});

test("a partial uninstall reports completed removals and retains metadata for inspection", () => {
  const { env, dir } = fresh();
  quiet(() => run(["install"], env));
  const unlink = fs.unlinkSync;
  const errors = [];
  const stub = mock.method(fs, "unlinkSync", (path) => {
    if (path === join(dir, "principal-debug.md")) throw Object.assign(new Error("injected unlink failure"), { code: "EIO" });
    return unlink(path);
  });
  const errorStub = mock.method(console, "error", (...args) => errors.push(args.join(" ")));
  try {
    assert.equal(run(["uninstall"], env), 1);
    assert.ok(!existsSync(join(dir, "principal-build.md")));
    assert.ok(existsSync(join(dir, "principal-debug.md")));
    assert.ok(existsSync(join(dir, MANIFEST)));
    assert.match(errors.join("\n"), /Partial effects.*principal-build\.md/s);
    assert.doesNotMatch(errors.join("\n"), /nothing was written/i);
  } finally { stub.mock.restore(); errorStub.mock.restore(); }
  assert.equal(quiet(() => run(["uninstall"], env)), 0, "missing already-removed owned files permit a deliberate retry");
});
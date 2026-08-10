/**
 * Clean-home install test: pack the package, install the tarball into a throwaway HOME, and
 * assert a fresh user gets what the README promises.
 *
 * This exists because every other test in the suite runs against the checkout. A checkout
 * proves the files are correct; it does not prove they are *shipped*. A file excluded from
 * the tarball — by .npmignore, by the `files` field, by being untracked — is present in every
 * developer test and absent for every user, and nothing else here would notice.
 *
 * pi is not required. The packed-artifact assertions run everywhere; the command-discovery
 * assertions need `pi` on PATH and report as skipped when it is missing. Skipped is printed,
 * never silent — a test that quietly vanishes is worse than one that fails, because absence
 * reads as success.
 *
 * Run with `node --test tests/install/*.test.mjs`.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS = ["decide", "architect", "plan", "build", "review", "debug", "git-ops"];

// Track exactly what we create; see the note in install-agents.test.mjs — test FILES run
// concurrently, so cleaning by prefix glob reaches into a sibling suite's directories.
const created = [];
const scratch = (prefix) => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  created.push(d);
  return d;
};

const has = (bin) => {
  try {
    execFileSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/** Pack once; every test below reads the same tarball. */
let packed = null;
const pack = () => {
  if (packed) return packed;
  const out = scratch("ppa-pack-");
  const json = execFileSync("npm", ["pack", "--json", "--pack-destination", out], { cwd: ROOT, encoding: "utf8" });
  const [meta] = JSON.parse(json);
  packed = { dir: out, tarball: join(out, meta.filename), files: meta.files.map((f) => f.path) };
  return packed;
};

test("the tarball ships every runtime file a user needs", () => {
  const { files } = pack();
  const missing = [];

  for (const s of SKILLS) if (!files.includes(`${s}/SKILL.md`)) missing.push(`${s}/SKILL.md`);
  for (const p of ["principal-feature", "principal-bugfix", "feature", "bugfix"]) {
    if (!files.includes(`prompts/${p}.md`)) missing.push(`prompts/${p}.md`);
  }
  for (const a of ["principal-plan", "principal-review", "principal-debug"]) {
    if (!files.includes(`agents/${a}.md`)) missing.push(`agents/${a}.md`);
  }
  if (!files.includes("scripts/install-agents.mjs")) missing.push("scripts/install-agents.mjs");
  if (!files.includes("package.json")) missing.push("package.json");

  assert.deepEqual(missing, [], `not shipped: ${missing.join(", ")}`);
});

test("the packed manifest registers the skills and prompts pi will look for", () => {
  const { files } = pack();
  assert.ok(files.includes("package.json"));
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(pkg.pi.skills, SKILLS.map((s) => `./${s}`));
  assert.deepEqual(pkg.pi.prompts, ["./prompts"]);
  assert.ok(pkg.bin?.["principal-pi-agents"], "the installer must be exposed as a bin entry");
});

test("installing the tarball into a clean HOME sets up the namespaced agents", () => {
  const { tarball } = pack();
  const home = scratch("ppa-home-");
  const piDir = join(home, ".pi", "agent");
  const proj = join(home, "proj");
  mkdirSync(proj, { recursive: true });
  writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "consumer", private: true }) + "\n");

  const realBefore = existsSync(join(homedir(), ".pi", "agent", "agents"))
    ? readdirSync(join(homedir(), ".pi", "agent", "agents")).sort().join(",")
    : "<absent>";

  execFileSync("npm", ["install", "--no-audit", "--no-fund", tarball], {
    cwd: proj,
    env: { ...process.env, HOME: home, npm_config_cache: join(home, ".npm") },
    stdio: "pipe",
  });

  const installed = join(proj, "node_modules", "principal-pi-skills");
  assert.ok(existsSync(join(installed, "git-ops", "SKILL.md")), "skills must survive the install");
  assert.ok(existsSync(join(installed, "prompts", "principal-feature.md")));

  // Run the shipped installer exactly as a user would, against the throwaway home.
  execFileSync(process.execPath, [join(installed, "scripts", "install-agents.mjs"), "install"], {
    env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: piDir },
    stdio: "pipe",
  });

  const agents = readdirSync(join(piDir, "agents")).filter((f) => f.endsWith(".md")).sort();
  assert.deepEqual(agents, ["principal-debug.md", "principal-plan.md", "principal-review.md"]);

  const realAfter = existsSync(join(homedir(), ".pi", "agent", "agents"))
    ? readdirSync(join(homedir(), ".pi", "agent", "agents")).sort().join(",")
    : "<absent>";
  assert.equal(realAfter, realBefore, "the developer's real home must be untouched");

  rmSync(home, { recursive: true, force: true });
});

test("the installed bins actually run — not a silent exit 0", () => {
  // npm installs bins as symlinks into node_modules/.bin, so a main-module guard that
  // compares import.meta.url against an unresolved argv[1] is false for every real user:
  // the CLI does nothing and exits 0, which is indistinguishable from success. Both bins
  // shipped that way. Exercise them through .bin, the path a user takes.
  const { tarball } = pack();
  const home = scratch("ppa-home-");
  const proj = join(home, "proj");
  mkdirSync(proj, { recursive: true });
  writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "consumer", private: true }) + "\n");
  const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: join(home, ".pi", "agent"), npm_config_cache: join(home, ".npm") };
  execFileSync("npm", ["install", "--no-audit", "--no-fund", tarball], { cwd: proj, env, stdio: "pipe" });

  const agentsBin = join(proj, "node_modules", ".bin", "principal-pi-agents");
  const wsBin = join(proj, "node_modules", ".bin", "principal-pi-workspace");
  assert.ok(existsSync(agentsBin) && existsSync(wsBin), "both bins must be linked");

  const out = execFileSync(agentsBin, ["install"], { cwd: proj, env, encoding: "utf8" });
  assert.match(out, /installed|current/, "the installer must report what it did, not print nothing");
  assert.ok(
    existsSync(join(home, ".pi", "agent", "agents", "principal-plan.md")),
    "and it must actually write the agents"
  );

  // The workspace bin needs a repo; prove it parses its subcommand with no --repo flag,
  // which is the documented invocation and used to fall through to usage.
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: proj });
  execFileSync("git", ["-c", "user.email=t@l", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "base"], { cwd: proj });
  const path = execFileSync(wsBin, ["create"], { cwd: proj, env, encoding: "utf8" }).trim();
  assert.ok(path.length > 0 && existsSync(path), `create must print a real worktree path, got ${JSON.stringify(path)}`);
  execFileSync(wsBin, ["remove", path], { cwd: proj, env, stdio: "pipe" });
});

test("the bin invocations the docs print are resolvable", () => {
  // 2.3.0 shipped `npx principal-pi-agents install` and `npx principal-pi-workspace create`.
  // npx resolves a PACKAGE of that name; the bins belong to principal-pi-skills, so both
  // returned E404 and the features were inert for every installed user. The earlier test
  // exercised node_modules/.bin/<name>, a different resolution path — which is why it passed.
  // This asserts the docs only print invocations that can resolve.
  const docs = ["README.md", "AGENTS.md", "review/SKILL.md", "debug/SKILL.md",
                "prompts/principal-feature.md", "prompts/principal-bugfix.md"];
  const bare = /npx\s+(principal-pi-(?:agents|workspace))/;
  for (const d of docs) {
    const text = readFileSync(join(ROOT, d), "utf8");
    const m = text.match(bare);
    assert.equal(
      m, null,
      `${d} prints \`npx ${m?.[1]}\`, which npm resolves as a package name and 404s — ` +
        `use \`npx -p principal-pi-skills ${m?.[1]}\``
    );
  }
});

test("preseeded generic resources do not shadow the namespaced ones", () => {
  const { tarball } = pack();
  const home = scratch("ppa-home-");
  const piDir = join(home, ".pi", "agent");
  const agentsDir = join(piDir, "agents");
  mkdirSync(agentsDir, { recursive: true });

  // Someone else's `plan` and `review` agents are already there — the collision this
  // namespacing exists to survive.
  for (const f of ["plan.md", "review.md", "feature.md"]) writeFileSync(join(agentsDir, f), `foreign ${f}\n`);

  const proj = join(home, "proj");
  mkdirSync(proj, { recursive: true });
  writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "consumer", private: true }) + "\n");
  execFileSync("npm", ["install", "--no-audit", "--no-fund", tarball], {
    cwd: proj,
    env: { ...process.env, HOME: home, npm_config_cache: join(home, ".npm") },
    stdio: "pipe",
  });

  const installed = join(proj, "node_modules", "principal-pi-skills");
  execFileSync(process.execPath, [join(installed, "scripts", "install-agents.mjs"), "install"], {
    env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: piDir },
    stdio: "pipe",
  });

  for (const f of ["plan.md", "review.md", "feature.md"]) {
    assert.equal(readFileSync(join(agentsDir, f), "utf8"), `foreign ${f}\n`, `${f} must be left alone`);
  }
  assert.ok(existsSync(join(agentsDir, "principal-plan.md")), "the namespaced agent installs regardless");

  rmSync(home, { recursive: true, force: true });
});

test("pi resolves the package and materializes every resource it declares", { skip: has("pi") ? false : "pi is not on PATH" }, () => {
  // What this can and cannot prove, stated plainly: pi 0.83 exposes no scriptable listing
  // of discovered commands — `pi list` echoes the package source, and `pi config -l` is an
  // interactive TUI. So this asserts the *inputs* to discovery: pi accepted the tarball,
  // recorded it, and materialized a tree containing every path package.json's `pi` field
  // points at. A resource missing here could never be discovered; one present here still
  // depends on pi's loader, which only the live E2E cells exercise.
  const { tarball } = pack();
  const home = scratch("ppa-home-");
  const proj = join(home, "proj");
  mkdirSync(proj, { recursive: true });
  const piDir = join(home, ".pi", "agent");
  const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: piDir, npm_config_cache: join(home, ".npm") };

  try {
    execFileSync("pi", ["install", `npm:${tarball}`], { cwd: proj, env, stdio: "pipe" });
  } catch (e) {
    assert.fail(`pi is present but rejected the packed artifact — that is a packaging failure: ${e.message}`);
  }

  const settings = JSON.parse(readFileSync(join(piDir, "settings.json"), "utf8"));
  assert.ok(
    settings.packages?.some((p) => p.includes("principal-pi-skills")),
    "pi must record the package in settings.json"
  );

  const tree = join(piDir, "npm", "node_modules", "principal-pi-skills");
  assert.ok(existsSync(tree), "pi must materialize the package under its agent dir");

  const pkg = JSON.parse(readFileSync(join(tree, "package.json"), "utf8"));
  for (const rel of pkg.pi.skills) {
    assert.ok(existsSync(join(tree, rel, "SKILL.md")), `declared skill ${rel} is missing from the materialized tree`);
  }
  for (const p of ["principal-feature", "principal-bugfix", "feature", "bugfix"]) {
    assert.ok(existsSync(join(tree, "prompts", `${p}.md`)), `declared prompt ${p} is missing`);
  }
  assert.equal(pkg.pi.skills.length, SKILLS.length, "all seven skills must be declared");

  rmSync(home, { recursive: true, force: true });
});

test.after(() => {
  for (const d of created) rmSync(d, { recursive: true, force: true });
});

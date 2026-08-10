#!/usr/bin/env node
/**
 * principal-pi-agents — install this package's subagent definitions into the pi agents
 * directory.
 *
 * pi discovers agents as files in `${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents`. That is a
 * flat, shared, global namespace living in the user's home, which sets every rule here:
 *
 * - **Copies, never symlinks.** A symlink into the checkout breaks the moment the directory
 *   is moved, renamed, or removed, and it breaks *silently* — pi reports an unknown agent
 *   and the workflow quietly falls back to inline. The previous documented install did
 *   exactly this (`ln -sf "$(pwd)"/agents/*.md`), and it also encoded whatever `$(pwd)`
 *   happened to be at the time.
 * - **`principal-*` only, by default.** A bare `plan.md` is a name anyone can claim. The
 *   generic aliases install only under --with-generic-aliases, and even then never over a
 *   file this package does not own.
 * - **Never overwrite what we do not own.** Ownership is recorded in a manifest beside the
 *   agents, keyed by content hash. An unknown file with a name we want is a refusal, not a
 *   backup-and-replace: it is someone else's agent, in their home directory.
 * - **Uninstall removes only what install wrote**, and only if it is still unmodified.
 *   A file the user has since edited is theirs now; we report it and leave it.
 *
 * Commands:
 *   principal-pi-agents install [--with-generic-aliases] [--force]
 *   principal-pi-agents check
 *   principal-pi-agents uninstall
 *
 * Exit codes: 0 success / satisfied, 1 refusal or drift, 2 usage error.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, lstatSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = ".principal-pi-skills.json";
const PKG = "principal-pi-skills";

const sha = (s) => createHash("sha256").update(s).digest("hex");

export function agentsDir(env = process.env, home = homedir()) {
  return join(env.PI_CODING_AGENT_DIR || join(home, ".pi", "agent"), "agents");
}

/** Source agents, split by whether they are namespaced. Both are generated from contracts/. */
export function sources(root = ROOT) {
  const all = readdirSync(join(root, "agents")).filter((f) => f.endsWith(".md")).sort();
  return {
    namespaced: all.filter((f) => f.startsWith("principal-")),
    generic: all.filter((f) => !f.startsWith("principal-")),
  };
}

const readManifest = (dir) => {
  try {
    const m = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
    return m && typeof m === "object" && m.files && typeof m.files === "object" ? m : { package: PKG, files: {} };
  } catch {
    return { package: PKG, files: {} };
  }
};

export function plan(dir, wanted, root = ROOT) {
  const manifest = readManifest(dir);
  const actions = [];
  for (const file of wanted) {
    const content = readFileSync(join(root, "agents", file), "utf8");
    const target = join(dir, file);
    const owned = Object.hasOwn(manifest.files, file);

    if (!existsSync(target)) {
      actions.push({ file, content, kind: "install" });
      continue;
    }
    // lstat, not stat: a symlink we would otherwise "overwrite" writes through to whatever
    // it points at, which could be any file on the system.
    if (lstatSync(target).isSymbolicLink()) {
      actions.push({ file, content, kind: "refuse", why: "exists as a symlink — resolve it by hand; writing through it would edit its target" });
      continue;
    }
    const current = readFileSync(target, "utf8");
    if (current === content) {
      actions.push({ file, kind: "current" });
    } else if (owned && manifest.files[file] === sha(current)) {
      actions.push({ file, content, kind: "update" });
    } else if (owned) {
      actions.push({ file, content, kind: "refuse", why: "was installed by this package but has been edited since — your changes would be lost" });
    } else {
      actions.push({ file, content, kind: "refuse", why: `exists and was not installed by ${PKG} — it belongs to something else` });
    }
  }
  return { manifest, actions };
}

function install({ dir, wanted, force }) {
  mkdirSync(dir, { recursive: true });
  const { manifest, actions } = plan(dir, wanted);
  const refusals = actions.filter((a) => a.kind === "refuse");

  if (refusals.length && !force) {
    for (const r of refusals) console.error(`✗ ${r.file}: ${r.why}`);
    console.error(`\n${refusals.length} file(s) not installed. Re-run with --force to overwrite them,`);
    console.error(`or remove them yourself. Nothing was written.`);
    return 1;
  }

  let wrote = 0;
  for (const a of actions) {
    if (a.kind === "current") {
      // Record it anyway. Ownership is what `uninstall` removes by, and a file that was
      // already byte-identical (a re-install, or a user who copied it in by hand) would
      // otherwise never enter the manifest — making uninstall a permanent no-op for it.
      manifest.files[a.file] ??= sha(readFileSync(join(dir, a.file), "utf8"));
      continue;
    }
    if (a.kind === "refuse" && !force) continue;
    // Remove first. Writing to a path that is a symlink writes THROUGH it, editing whatever
    // it points at — which is why plan() refuses links at all. --force means "replace the
    // thing in my agents directory", never "overwrite an arbitrary file elsewhere".
    rmSync(join(dir, a.file), { force: true });
    writeFileSync(join(dir, a.file), a.content);
    manifest.files[a.file] = sha(a.content);
    wrote++;
  }
  manifest.package = PKG;
  writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`✓ ${wrote} installed/updated, ${actions.filter((a) => a.kind === "current").length} already current → ${dir}`);
  for (const a of actions) if (a.kind !== "current") console.log(`  ${a.kind === "refuse" ? "forced" : a.kind}: ${a.file}`);
  return 0;
}

function check({ dir, wanted }) {
  if (!existsSync(dir)) {
    console.error(`✗ ${dir} does not exist — run \`principal-pi-agents install\``);
    return 1;
  }
  // Check everything we own, not just what this invocation would install. Otherwise a
  // `check` without --with-generic-aliases reports green while previously-installed generic
  // aliases sit stale — the drift check missing exactly the files it is responsible for.
  const owned = Object.keys(readManifest(dir).files);
  const all = [...new Set([...wanted, ...owned])].filter((f) => existsSync(join(ROOT, "agents", f)));
  const { actions } = plan(dir, all);
  const bad = actions.filter((a) => a.kind !== "current");
  for (const a of bad) {
    console.error(`✗ ${a.file}: ${a.kind === "install" ? "not installed" : a.kind === "update" ? "out of date" : a.why}`);
  }
  if (bad.length) {
    console.error(`\n${bad.length} of ${actions.length} agent(s) need attention.`);
    return 1;
  }
  console.log(`✓ ${actions.length} agent(s) installed and current in ${dir}`);
  return 0;
}

function uninstall({ dir }) {
  const manifest = readManifest(dir);
  const entries = Object.entries(manifest.files);
  if (!entries.length) {
    console.log(`✓ nothing installed by ${PKG} in ${dir}`);
    return 0;
  }
  let removed = 0;
  const kept = {};
  for (const [file, hash] of entries) {
    const target = join(dir, file);
    if (!existsSync(target)) continue;
    const current = readFileSync(target, "utf8");
    if (sha(current) !== hash) {
      console.error(`• kept ${file}: edited since install — it is yours now, remove it by hand if you meant to`);
      kept[file] = hash;
      continue;
    }
    rmSync(target);
    removed++;
  }
  if (Object.keys(kept).length) {
    writeFileSync(join(dir, MANIFEST), `${JSON.stringify({ package: PKG, files: kept }, null, 2)}\n`);
  } else {
    rmSync(join(dir, MANIFEST), { force: true });
  }
  console.log(`✓ removed ${removed} agent(s) from ${dir}`);
  return 0;
}

export function run(argv, env = process.env) {
  const cmd = argv[0];
  const flags = new Set(argv.slice(1));
  const dir = agentsDir(env);
  const src = sources();
  const wanted = flags.has("--with-generic-aliases") ? [...src.namespaced, ...src.generic] : src.namespaced;
  const force = flags.has("--force");

  for (const f of flags) {
    if (!["--with-generic-aliases", "--force"].includes(f)) {
      console.error(`unknown flag: ${f}`);
      return 2;
    }
  }

  switch (cmd) {
    case "install":
      return install({ dir, wanted, force });
    case "check":
      return check({ dir, wanted });
    case "uninstall":
      return uninstall({ dir });
    default:
      console.error("usage: principal-pi-agents <install|check|uninstall> [--with-generic-aliases] [--force]");
      console.error(`\nagents directory: ${dir}`);
      console.error("  (override with PI_CODING_AGENT_DIR)");
      return cmd ? 2 : 2;
  }
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
if (invokedDirectly) process.exit(run(process.argv.slice(2)));

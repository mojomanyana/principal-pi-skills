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
 * - **Only `principal-*` agents exist.** A bare `plan.md` is a name anyone can claim, so
 *   this package never ships or installs one, and never writes over a file it does not own.
 * - **Never overwrite what we do not own.** Ownership is recorded in a manifest beside the
 *   agents, keyed by content hash. An unknown file with a name we want is a refusal, not a
 *   backup-and-replace: it is someone else's agent, in their home directory.
 * - **Uninstall removes only what install wrote**, and only if it is still unmodified.
 *   A file the user has since edited is theirs now; we report it and leave it.
 *
 * Commands:
 *   principal-pi-agents install [--force]
 *   principal-pi-agents adopt
 *   principal-pi-agents check
 *   principal-pi-agents uninstall
 *
 * Exit codes: 0 success / satisfied, 1 refusal or drift, 2 usage error.
 */

import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join, dirname, basename, resolve, parse } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = ".principal-pi-skills.json";
const PKG = "principal-pi-skills";
const SOURCE_NAMES = ["principal-build.md", "principal-debug.md", "principal-investigate.md", "principal-plan.md", "principal-review.md", "principal-test-review.md"];
// These three aliases shipped before 7e9eb43 removed generic aliases. Read ownership for
// check/uninstall only; never recreate them or accept arbitrary historical filenames.
const OWNED_NAMES = new Set([...SOURCE_NAMES, "debug.md", "plan.md", "review.md"]);
const METADATA_LIMIT = 64 * 1024;
const AGENT_LIMIT = 1024 * 1024;
const sha = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message) => { throw new Error(message); };
const ordinaryObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function agentsDir(env = process.env, home = homedir()) {
  return join(env.PI_CODING_AGENT_DIR || join(home, ".pi", "agent"), "agents");
}

function statOrAbsent(path) {
  try { return fs.lstatSync(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

// Resolve an existing directory anchor once, retaining any absent suffix. Symlinked
// homes/config roots (and macOS /tmp) work, while all subsequent reads and mutations
// use the canonical anchor, never a retargetable alias. Dangling links still refuse.
function canonicalDirectory(path) {
  let at = resolve(path);
  const suffix = [];
  while (!statOrAbsent(at)) {
    suffix.unshift(basename(at));
    at = dirname(at);
  }
  const anchor = fs.realpathSync(at);
  if (!fs.statSync(anchor).isDirectory()) fail(`${at}: expected a directory anchor`);
  return join(anchor, ...suffix);
}

// Inspect canonical ancestors before opening a file or creating a directory.
// This is a trusted-local-filesystem tool, not an adversarial
// dirfd sandbox; an observed concurrent replacement refuses instead of guessing ownership.
function directories(path) {
  const absolute = resolve(path);
  const paths = [];
  for (let at = absolute; ; at = dirname(at)) {
    paths.unshift(at);
    if (at === parse(at).root) break;
  }
  const found = new Map();
  for (const at of paths) {
    const st = statOrAbsent(at);
    if (!st) break;
    if (!st.isDirectory() || st.isSymbolicLink()) fail(`${at}: expected an ordinary directory, not a symlink or other file type`);
    found.set(at, st);
  }
  return found;
}

const sameInode = (a, b) => a && b && a.dev === b.dev && a.ino === b.ino;

function readOrdinary(path, limit, optional = false) {
  const before = statOrAbsent(path);
  if (!before) {
    if (optional) return null;
    fail(`${path}: required file is absent`);
  }
  if (!before.isFile() || before.isSymbolicLink()) fail(`${path}: expected an ordinary file, not a symlink or other file type`);
  if (before.size > limit) fail(`${path}: exceeds ${limit}-byte limit`);
  // Nonblocking + nofollow prevents a replaced leaf FIFO/link from being opened as a
  // normal blocking file. Read a bounded amount from the same validated descriptor.
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || !sameInode(st, before) || st.size > limit) fail(`${path}: file changed while opening`);
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    const after = fs.fstatSync(fd);
    if (length > limit || after.size !== st.size || after.mtimeMs !== st.mtimeMs || length !== st.size) fail(`${path}: file changed or exceeded its bound while reading`);
    const content = buffer.subarray(0, length);
    return { stat: after, content, hash: sha(content) };
  } finally { fs.closeSync(fd); }
}

function parseMetadata(content, path) {
  let value;
  try { value = JSON.parse(content.toString("utf8")); }
  catch { fail(`${path}: invalid JSON; restore known-good metadata before retrying`); }
  // JSON.parse accepts duplicate keys (including escaped equivalents). Once syntax is
  // valid, a token walk can reject ambiguity without implementing a second JSON parser.
  const stack = [];
  for (const [token] of content.toString("utf8").matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g)) {
    const top = stack.at(-1);
    if (token === "{") stack.push({ keys: new Set(), nextKey: true });
    else if (token === "[") stack.push(null);
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && top) top.nextKey = true;
    else if (token === ":" && top) top.nextKey = false;
    else if (token.startsWith('"') && top?.nextKey) {
      const key = JSON.parse(token);
      if (top.keys.has(key)) fail(`${path}: duplicate metadata key ${JSON.stringify(key)}`);
      top.keys.add(key);
      top.nextKey = false;
    }
  }
  return value;
}

function readManifest(dir) {
  const path = join(dir, MANIFEST);
  const snapshot = readOrdinary(path, METADATA_LIMIT, true);
  if (!snapshot) return { manifest: { package: PKG, files: {} }, snapshot: null };
  const m = parseMetadata(snapshot.content, path);
  if (!ordinaryObject(m) || Object.keys(m).length !== 2 || m.package !== PKG || !ordinaryObject(m.files)) {
    fail(`${path}: expected { package: "${PKG}", files: { basename: sha256 } }; damaged or foreign ownership metadata`);
  }
  for (const [name, hash] of Object.entries(m.files)) {
    if (!OWNED_NAMES.has(name) || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) {
      fail(`${path}: invalid ownership entry ${JSON.stringify(name)}; restore known-good metadata before retrying`);
    }
  }
  return { manifest: m, snapshot };
}

/** Exactly the shipped names; inventory, identity and source types are preflight inputs. */
export function sources(root = ROOT) {
  root = canonicalDirectory(root);
  directories(join(root, "agents"));
  const pkg = parseMetadata(readOrdinary(join(root, "package.json"), METADATA_LIMIT).content, join(root, "package.json"));
  if (!ordinaryObject(pkg) || pkg.name !== PKG) fail(`${root}: unexpected package identity`);
  const names = fs.readdirSync(join(root, "agents")).sort();
  if (JSON.stringify(names) !== JSON.stringify(SOURCE_NAMES)) fail(`${root}: agent inventory differs from the supported package names`);
  for (const name of names) readOrdinary(join(root, "agents", name), AGENT_LIMIT);
  return names;
}

function ownership(dir) {
  const ancestors = directories(dir);
  const { manifest, snapshot } = readManifest(dir);
  const targets = new Map();
  // Finish every manifest row before consumers may mutate even the first valid target.
  for (const name of Object.keys(manifest.files)) targets.set(name, readOrdinary(join(dir, name), AGENT_LIMIT, true));
  return { manifest, snapshot, targets, ancestors };
}

export function plan(dir, wanted, root = ROOT) {
  if (!Array.isArray(wanted) || new Set(wanted).size !== wanted.length || wanted.some((name) => !SOURCE_NAMES.includes(name))) {
    fail("requested agents must be unique supported package basenames");
  }
  root = canonicalDirectory(root);
  dir = canonicalDirectory(dir);
  sources(root);
  const state = ownership(dir);
  const actions = [];
  for (const file of wanted) {
    const content = readOrdinary(join(root, "agents", file), AGENT_LIMIT).content;
    const current = state.targets.has(file) ? state.targets.get(file) : readOrdinary(join(dir, file), AGENT_LIMIT, true);
    state.targets.set(file, current);
    const owned = Object.hasOwn(state.manifest.files, file);
    if (!current) actions.push({ file, content, kind: "install" });
    else if (!owned) actions.push({ file, kind: "refuse", why: `exists and was not installed by ${PKG}, even if byte-identical` });
    else if (state.manifest.files[file] !== current.hash) actions.push({ file, kind: "refuse", why: "edited since install; preserve your changes and restore known-good ownership explicitly" });
    else actions.push({ file, content, kind: current.content.equals(content) && (current.stat.mode & 0o777) === 0o644 ? "current" : "update" });
  }
  return { ...state, actions };
}

function guardDirectories(dir, ancestors) {
  const now = directories(dir);
  for (const [path, st] of ancestors) if (!sameInode(st, now.get(path))) fail(`${path}: directory changed since preflight`);
}

function guardFile(path, expected, limit) {
  const now = readOrdinary(path, limit, true);
  if (expected === null ? now !== null : !now || !sameInode(expected.stat, now.stat) || expected.hash !== now.hash) {
    fail(`${path}: changed since preflight; refusing mutation`);
  }
}

function writeAtomic(path, content, expected, limit, context, mode = 0o600) {
  guardDirectories(context.dir, context.ancestors);
  guardFile(path, expected, limit);
  const temporary = join(context.dir, `.principal-pi-skills-${randomUUID()}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(fd, content);
    fs.fchmodSync(fd, mode);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    guardDirectories(context.dir, context.ancestors);
    guardFile(path, expected, limit);
    // A new destination is linked exclusively, never renamed over a newly arrived file.
    // Updates replace only a rechecked owned leaf; neither operation follows leaf links.
    if (expected === null) fs.linkSync(temporary, path);
    else fs.renameSync(temporary, path);
    context.completed.push(path);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (statOrAbsent(temporary)) fs.unlinkSync(temporary);
  }
}

function removeOwned(path, expected, limit, context) {
  guardDirectories(context.dir, context.ancestors);
  guardFile(path, expected, limit);
  fs.unlinkSync(path);
  context.completed.push(path);
}

function mutate(dir, state, action) {
  const context = { dir, ancestors: state.ancestors, completed: [] };
  try { return action(context); }
  catch (error) {
    console.error(`✗ operation failed: ${error.message}`);
    console.error(`Partial effects may remain; completed writes/removals: ${context.completed.join(", ") || "none"}. Directory/temporary changes may also remain. Ownership metadata may be stale; inspect and restore known-good state before retrying. No rollback was performed.`);
    return 1;
  }
}

function install({ dir, wanted, root }) {
  const state = plan(dir, wanted, root);
  const refusals = state.actions.filter((a) => a.kind === "refuse");
  if (refusals.length) {
    for (const r of refusals) console.error(`✗ ${r.file}: ${r.why}`);
    console.error(`${refusals.length} file(s) refused. Nothing was written; --force cannot bypass validation or ownership.`);
    return 1;
  }
  return mutate(dir, state, (context) => {
    guardDirectories(dir, state.ancestors);
    fs.mkdirSync(dir, { recursive: true });
    guardDirectories(dir, state.ancestors);
    context.ancestors = directories(dir);
    let wrote = 0;
    for (const a of state.actions) {
      if (a.kind === "current") continue;
      writeAtomic(join(dir, a.file), a.content, state.targets.get(a.file), AGENT_LIMIT, context, 0o644);
      state.manifest.files[a.file] = sha(a.content);
      wrote++;
    }
    const metadata = Buffer.from(`${JSON.stringify(state.manifest, null, 2)}\n`);
    if (!state.snapshot || !state.snapshot.content.equals(metadata)) writeAtomic(join(dir, MANIFEST), metadata, state.snapshot, METADATA_LIMIT, context);
    console.log(`✓ ${wrote} installed/updated, ${state.actions.length - wrote} already current → ${dir}`);
    return 0;
  });
}

// Explicit recovery for a lost manifest, not an overwrite escape hatch. Require the
// entire current shipped set; old, partial, edited, linked or foreign bytes refuse.
function adopt({ dir, wanted, root }) {
  const state = ownership(dir);
  if (state.snapshot) fail("adopt requires an absent ownership manifest; use install/check for a recorded installation");
  for (const file of wanted) {
    const current = readOrdinary(join(dir, file), AGENT_LIMIT);
    const source = readOrdinary(join(root, "agents", file), AGENT_LIMIT);
    if (!current.content.equals(source.content)) fail(`${file}: adopt requires byte-identical current package content`);
    state.targets.set(file, current);
    state.manifest.files[file] = current.hash;
  }
  return mutate(dir, state, context => {
    for (const [file, current] of state.targets) guardFile(join(dir, file), current, AGENT_LIMIT);
    const metadata = Buffer.from(`${JSON.stringify(state.manifest, null, 2)}\n`);
    writeAtomic(join(dir, MANIFEST), metadata, null, METADATA_LIMIT, context);
    console.log(`✓ explicitly adopted ${wanted.length} identical agents in ${dir}; agent bytes and modes unchanged`);
    return 0;
  });
}

function check({ dir, wanted, root }) {
  const state = plan(dir, wanted, root);
  const bad = state.actions.filter((a) => a.kind !== "current");
  for (const a of bad) console.error(`✗ ${a.file}: ${a.kind === "install" ? "not installed" : a.kind === "update" ? "out of date" : a.why}`);
  const retired = Object.keys(state.manifest.files).filter((name) => !SOURCE_NAMES.includes(name) && state.targets.get(name));
  for (const name of retired) console.error(`✗ ${name}: retired owned alias; inspect it and use uninstall to remove unchanged owned files`);
  if (bad.length || retired.length) return 1;
  console.log(`✓ ${state.actions.length} agent(s) installed and current in ${dir}`);
  return 0;
}

function uninstall({ dir }) {
  const state = ownership(dir);
  if (!state.snapshot) {
    console.log(`✓ nothing installed by ${PKG} in ${dir}`);
    return 0;
  }
  const kept = {};
  const removals = [];
  for (const [file, hash] of Object.entries(state.manifest.files)) {
    const current = state.targets.get(file);
    if (!current) continue;
    if (current.hash !== hash) {
      kept[file] = hash;
      console.error(`• kept ${file}: edited since install; remove it by hand only if intended`);
    } else removals.push(file);
  }
  return mutate(dir, state, (context) => {
    for (const file of removals) removeOwned(join(dir, file), state.targets.get(file), AGENT_LIMIT, context);
    if (Object.keys(kept).length) {
      const metadata = Buffer.from(`${JSON.stringify({ package: PKG, files: kept }, null, 2)}\n`);
      if (!metadata.equals(state.snapshot.content)) writeAtomic(join(dir, MANIFEST), metadata, state.snapshot, METADATA_LIMIT, context);
    } else removeOwned(join(dir, MANIFEST), state.snapshot, METADATA_LIMIT, context);
    console.log(`✓ removed ${removals.length} agent(s) from ${dir}; kept ${Object.keys(kept).length} edited file(s)`);
    return 0;
  });
}

export function run(argv, env = process.env, { root = ROOT } = {}) {
  const [cmd, ...flags] = argv;
  if (!["install", "adopt", "check", "uninstall"].includes(cmd) || flags.some((flag) => flag !== "--force") || new Set(flags).size !== flags.length) {
    console.error("usage: principal-pi-agents <install|adopt|check|uninstall> [--force]");
    console.error("--force is accepted for compatibility only; validation and ownership always apply.");
    return 2;
  }
  if (flags.includes("--force")) console.error("--force is deprecated and cannot bypass ownership; use adopt only to recover an absent manifest for a complete byte-identical current installation.");
  try {
    const dir = canonicalDirectory(agentsDir(env));
    root = canonicalDirectory(root);
    const wanted = sources(root);
    if (cmd === "install") return install({ dir, wanted, root });
    if (cmd === "adopt") return adopt({ dir, wanted, root });
    if (cmd === "check") return check({ dir, wanted, root });
    return uninstall({ dir });
  } catch (error) {
    console.error(`✗ preflight refused: ${error.message}. Nothing was written.`);
    return 1;
  }
}
// realpathSync, not a bare compare: npm installs bins as symlinks
// (node_modules/.bin/<name> -> ../<pkg>/scripts/<file>.mjs), so argv[1] is the .bin path
// while import.meta.url is already resolved. Comparing them unresolved makes this false for
// every installed user — the CLI silently does nothing and exits 0, which reads as success.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();
if (invokedDirectly) process.exit(run(process.argv.slice(2)));

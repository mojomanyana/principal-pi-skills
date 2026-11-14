// Initial project preparation. This is not a product commit, migration or authority grant.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export class ProjectSetupError extends Error {
  constructor(code, message, administrativeWrites = false) {
    super(message); this.name = "ProjectSetupError"; this.code = code;
    this.administrativeWrites = administrativeWrites;
  }
}
const fail = (code, message, writes = false) => { throw new ProjectSetupError(code, message, writes); };
const hash = value => createHash("sha256").update(value).digest("hex");
const absent = path => { try { return lstatSync(path); } catch (e) { if (e.code === "ENOENT") return null; throw e; } };
function plain(path, directory = false) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (!directory && stat.nlink !== 1))
    fail("UNSAFE_PROJECT_METADATA", "Project setup found a linked or unsupported metadata path; existing files were preserved.");
  return stat;
}
function environment() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return { ...env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0" };
}
function git(root, args, { allowFailure = false, input, identity = false } = {}) {
  const env = environment();
  if (identity) Object.assign(env, {
    GIT_AUTHOR_NAME: "Principal project setup", GIT_AUTHOR_EMAIL: "project-setup@localhost",
    GIT_COMMITTER_NAME: "Principal project setup", GIT_COMMITTER_EMAIL: "project-setup@localhost",
  });
  const result = spawnSync("git", ["--no-optional-locks", "--no-replace-objects", "-c", "core.fsmonitor=false",
    "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgSign=false", "-C", root, ...args],
  { env, encoding: "utf8", input, timeout: 10000, maxBuffer: 512 * 1024 });
  if (result.error) fail("GIT_UNAVAILABLE", "Git could not complete the project check; no successful setup is claimed.");
  if (result.status !== 0 && !allowFailure) fail("PROJECT_SETUP_FAILED", "Git refused project preparation; inspect the current state before continuing.");
  return { ok: result.status === 0, text: result.stdout.trim() };
}
function indexIdentity(root) {
  const index = join(root, ".git", "index");
  if (!absent(index)) return "absent";
  plain(index); return hash(readFileSync(index));
}
function metadataIdentity(path) {
  let count = 0, bytes = 0;
  const walk = (directory, depth = 0) => {
    if (depth > 24) fail("UNSAFE_PROJECT_METADATA", "Git metadata exceeds the supported initial-setup scope.");
    plain(directory, true);
    return readdirSync(directory).sort().map(name => {
      if (++count > 2048) fail("UNSAFE_PROJECT_METADATA", "Git metadata exceeds the supported initial-setup scope.");
      const file = join(directory, name), stat = lstatSync(file);
      if (stat.isSymbolicLink()) fail("UNSAFE_PROJECT_METADATA", "Initial setup cannot follow linked Git metadata.");
      if (stat.isDirectory()) return [name, walk(file, depth + 1)];
      plain(file);
      if ((bytes += stat.size) > 8 * 1024 * 1024) fail("UNSAFE_PROJECT_METADATA", "Git metadata exceeds the supported initial-setup scope.");
      return [name, hash(readFileSync(file))];
    });
  };
  return hash(JSON.stringify(walk(path)));
}

export function inspectProject(path) {
  if (process.platform !== "linux") fail("UNSUPPORTED_SETUP_PLATFORM", "Principal project preparation currently requires Linux.");
  const selected = resolve(path); plain(selected, true);
  const projectRoot = realpathSync(selected), stat = plain(projectRoot, true);
  const base = { version: 1, approval: false, administrativeWrites: false, projectRoot };
  const result = (state, reasonCode, message, details = {}) => {
    const value = { ...base, state, reasonCode, message, ...details };
    return { ...value, observationToken: hash(JSON.stringify({ ...value, folderIdentity: [stat.dev, stat.ino, stat.birthtimeMs] })) };
  };
  const rootProbe = git(projectRoot, ["rev-parse", "--show-toplevel"], { allowFailure: true });
  const metadata = absent(join(projectRoot, ".git"));
  if (!rootProbe.ok) {
    if (metadata || git(projectRoot, ["rev-parse", "--git-dir"], { allowFailure: true }).ok)
      return result("setup-blocked", "UNSUPPORTED_REPOSITORY", "Existing Git metadata is not a normal working tree. It was left unchanged.");
    let parent = dirname(projectRoot);
    while (parent !== projectRoot) {
      if (absent(join(parent, ".git")))
        return result("setup-blocked", "PARENT_REPOSITORY_UNAVAILABLE", "A parent folder has Git metadata that could not be resolved. Setup will not create a nested repository.");
      const next = dirname(parent); if (next === parent) break; parent = next;
    }
    return result("setup-required", "GIT_REPOSITORY_MISSING", "This folder needs a Git baseline before native engineering handoffs. Saved-note recall and planning do not require it.",
      { setup: { eligible: true, emptyCommitRequired: true, productFilesStaged: false }, repositoryRoot: null });
  }
  const repositoryRoot = realpathSync(rootProbe.text);
  if (repositoryRoot !== projectRoot)
    return result("setup-blocked", "PARENT_REPOSITORY", "This folder belongs to a parent repository. Use that repository explicitly; setup will not create a nested repository.", { repositoryRoot });
  const head = git(projectRoot, ["rev-parse", "--verify", "HEAD"], { allowFailure: true });
  if (head.ok) return result("ready", "COMMITTED_BASELINE", "A committed baseline already exists; project setup makes no changes.", { repositoryRoot, head: head.text });
  if (!metadata?.isDirectory() || metadata.isSymbolicLink())
    return result("setup-blocked", "UNSAFE_PROJECT_METADATA", "An initial baseline cannot be created through linked or unsupported Git metadata.", { repositoryRoot });
  const gitDirectory = realpathSync(join(projectRoot, ".git"));
  const common = git(projectRoot, ["rev-parse", "--git-common-dir"]).text;
  if (realpathSync(resolve(projectRoot, common)) !== gitDirectory)
    return result("setup-blocked", "SHARED_GIT_METADATA", "Initial setup cannot modify shared repository metadata.", { repositoryRoot });
  const metadataSha256 = metadataIdentity(gitDirectory);
  for (const item of ["config", "HEAD", "index"]) if (absent(join(projectRoot, ".git", item))) plain(join(projectRoot, ".git", item));
  for (const item of ["objects", "refs", "info"]) if (absent(join(projectRoot, ".git", item))) plain(join(projectRoot, ".git", item), true);
  const staged = git(projectRoot, ["ls-files", "--stage", "-z"]);
  if (staged.text) return result("setup-blocked", "STAGED_FILES_PRESENT", "Files are already staged. Setup will not commit or unstage them; keep the existing index and choose the intended Git action.", { repositoryRoot });
  if (git(projectRoot, ["remote"]).text)
    return result("setup-blocked", "REMOTE_ALREADY_CONFIGURED", "This uncommitted repository already has a remote. Preserve it and choose its intended baseline explicitly.", { repositoryRoot });
  if (git(projectRoot, ["for-each-ref", "--format=%(refname)", "--count=1"]).text)
    return result("setup-blocked", "EXISTING_REPOSITORY_HISTORY", "Other Git references already exist. This is not a new repository; choose its intended baseline explicitly.", { repositoryRoot });
  const branch = git(projectRoot, ["symbolic-ref", "--quiet", "HEAD"], { allowFailure: true });
  if (!branch.ok || !branch.text.startsWith("refs/heads/"))
    return result("setup-blocked", "UNBORN_BRANCH_UNAVAILABLE", "The initial branch could not be identified; setup makes no changes.", { repositoryRoot });
  const exclude = join(projectRoot, ".git", "info", "exclude");
  if (absent(exclude)) plain(exclude);
  return result("setup-required", "COMMITTED_BASELINE_MISSING", "Git exists but has no committed baseline. Setup can create one empty commit while leaving all product files untracked.",
    { repositoryRoot, setup: { eligible: true, emptyCommitRequired: true, productFilesStaged: false },
      branch: branch.text, indexIdentity: indexIdentity(projectRoot), metadataSha256,
      excludeIdentity: absent(exclude) ? hash(readFileSync(exclude)) : "absent" });
}

function excludeRuntime(root) {
  const directory = join(root, ".git", "info");
  if (!absent(directory)) mkdirSync(directory, { mode: 0o700 });
  plain(directory, true);
  const path = join(directory, "exclude"), exists = absent(path);
  if (exists) plain(path);
  const fd = openSync(path, constants.O_RDWR | constants.O_NOFOLLOW | (exists ? 0 : constants.O_CREAT | constants.O_EXCL), 0o600);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1) fail("UNSAFE_PROJECT_METADATA", "Runtime exclusions are not an ordinary private file.");
    const original = readFileSync(fd, "utf8"), lines = new Set(original.split(/\r?\n/));
    const missing = ["/.pi/", "/.principal/"].filter(line => !lines.has(line));
    if (missing.length) writeFileSync(fd, `${original && !original.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`);
  } finally { closeSync(fd); }
}

// Called only after current-session operator confirmation by the Pi extension.
export function initializeProject(path, expectedObservation) {
  let writes = false;
  const steps = { repositoryCreated: false, exclusionsWritten: false, baselineInstalled: false };
  try {
    const before = inspectProject(path);
    if (before.observationToken !== expectedObservation) fail("PROJECT_CHANGED", "The folder changed while setup was being confirmed. Inspect it again before deciding.");
    if (before.state === "ready") return before;
    if (before.state !== "setup-required" || !before.setup?.eligible) fail("SETUP_NOT_AVAILABLE", before.message);
    const root = before.projectRoot;
    if (before.reasonCode === "GIT_REPOSITORY_MISSING") {
      // Exclusive creation prevents silently adopting somebody else's new repository.
      mkdirSync(join(root, ".git"), { mode: 0o700 }); writes = true; steps.repositoryCreated = true;
      git(root, ["init", "--template=", "--initial-branch=main"]);
    }
    const prepared = inspectProject(root);
    if (prepared.state !== "setup-required" || prepared.reasonCode !== "COMMITTED_BASELINE_MISSING")
      fail("PROJECT_CHANGED", "Repository state changed during preparation. Existing work is preserved; inspect it before continuing.");
    writes = true; excludeRuntime(root); steps.exclusionsWritten = true;
    // Build an empty tree directly: a concurrent staged file can never enter this commit.
    const tree = git(root, ["hash-object", "-t", "tree", "-w", "--stdin"], { input: "" }).text;
    const commit = git(root, ["commit-tree", tree, "-m", "Initialize project baseline (no product files)"], { identity: true }).text;
    if (git(root, ["symbolic-ref", "--quiet", "HEAD"]).text !== prepared.branch || indexIdentity(root) !== prepared.indexIdentity)
      fail("PROJECT_CHANGED", "The branch or index changed during preparation; no baseline reference was installed.");
    git(root, ["update-ref", prepared.branch, commit, "0".repeat(commit.length)]);
    steps.baselineInstalled = true;
    const after = inspectProject(root);
    if (after.state !== "ready" || after.head !== commit || indexIdentity(root) !== prepared.indexIdentity)
      fail("PROJECT_CHANGED", "Repository state changed during setup. A baseline may exist; inspect it before continuing.");
    return { ...after, state: "initialized", administrativeWrites: true, emptyCommit: commit,
      productFilesStaged: false, steps, message: "Created one empty Git baseline. Product files remain uncommitted; runtime files are locally excluded. Continue with a fresh snapshot." };
  } catch (error) {
    const refusal = error instanceof ProjectSetupError ? error : new ProjectSetupError("PROJECT_SETUP_FAILED", "Project preparation did not complete. Existing files were preserved; inspect the folder before retrying.");
    if (writes) {
      refusal.administrativeWrites = "possible";
      refusal.message += " Setup steps report confirmed completion only; an unconfirmed step may still have written metadata. No automatic rollback or retry was performed.";
    }
    refusal.steps = { ...steps }; throw refusal;
  }
}

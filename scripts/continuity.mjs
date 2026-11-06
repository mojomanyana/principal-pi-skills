// Git-specific observations for an optional role-neutral work map. No execution or approval.
import { createHash } from "node:crypto";
import { realpathSync, lstatSync, openSync, closeSync, fstatSync, readSync, constants } from "node:fs";
import { isAbsolute, join } from "node:path";
import { CANDIDATE_ALGORITHM } from "./workflow-state.mjs";
import { resolveReviewReference, reviewReferenceRepositories } from "./review-observation.mjs";
import { candidateSnapshot } from "./resume-checkpoint.mjs";
import { resolveFrozenSnapshot, snapshotReferenceRepositories } from "./frozen-snapshot.mjs";

const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash("sha256").update(canonical(value)).digest("hex");
const same = (a, b) => canonical(a) === canonical(b);
function path(value) {
  if (typeof value !== "string" || value.length > 4096 || !isAbsolute(value) || /[\x00-\x1f\x7f]/u.test(value)) throw Error("invalid repository path");
  return value;
}
function reference(value) {
  const keys = ["kind", "algorithm", "repo", "gitDir", "commonDir", "worktreeIdentity", "candidateId"];
  if (!value || Object.keys(value).some(key => !keys.includes(key)) || value.kind !== "principal-git" || value.algorithm !== CANDIDATE_ALGORITHM ||
      typeof value.candidateId !== "string" || !/^(?:dirty:[a-f0-9]{64}|[a-f0-9]{40,64})$/u.test(value.candidateId) ||
      typeof value.worktreeIdentity !== "string" || !/^[0-9]+:[0-9]+:[0-9]+:[0-9]+$/u.test(value.worktreeIdentity)) throw Error("invalid Git resource reference");
  for (const key of ["repo", "gitDir", "commonDir"]) path(value[key]);
  return value;
}
function observed(repo) {
  // candidateSnapshot already double-reads exact bytes and rejects concurrent mutation.
  // Reuse its complete identity instead of calling the wrapper that scans it a second time.
  const snapshot = candidateSnapshot(path(repo));
  const identity = { repo: snapshot.root, gitDir: snapshot.gitDir, commonDir: snapshot.commonDir, worktreeIdentity: snapshot.worktreeIdentity };
  return { reference: { kind: "principal-git", algorithm: CANDIDATE_ALGORITHM, ...identity, candidateId: snapshot.id },
    observed: { candidateId: snapshot.id, head: snapshot.head, root: snapshot.root, gitDir: identity.gitDir, commonDir: identity.commonDir, worktreeIdentity: identity.worktreeIdentity,
      changedPathCount: snapshot.changedPaths.length, atomic: false, approval: false } };
}
/** Explicit caller-selected repository; this read-only helper grants no access or writer claim. */
export function observeGitResource(repo) {
  return observed(repo).reference;
}
/** Trusted owner callback. A model reference cannot add a repository to the allowlist. */
export function resolveGitResource(input, { repositories } = {}) {
  try {
    reference(input);
    input = Object.freeze(structuredClone(input));
    if (!Array.isArray(repositories) || !repositories.length || repositories.length > 16) throw Error("select allowed repositories");
    const allowed = repositories.map(repo => realpathSync(path(repo)));
    if (!allowed.includes(input.repo) || realpathSync(input.repo) !== input.repo) return { status: "unavailable", reference: input };
    const current = observed(input.repo);
    if (!same(current.reference, input)) return { status: "stale", reference: input, observed: current.observed };
    return { status: "current", reference: input, observed: current.observed,
      assertCurrent: async () => { if (!same(observed(input.repo).reference, input)) throw Error("Git resource is stale"); } };
  } catch { return { status: "unavailable", reference: input }; }
}
function releaseOptions(packagePath, registry) {
  if (typeof packagePath !== "string" || packagePath.length > 1024 || packagePath.includes("\\") || /[\x00-\x1f\x7f]/u.test(packagePath) ||
      isAbsolute(packagePath) || packagePath.split("/").some(part => !part || part === "." || part === "..") || !packagePath.endsWith("package.json") || packagePath.split("/").at(-1) !== "package.json") throw Error("select a relative package.json path");
  if (typeof registry !== "string" || registry.length > 1024) throw Error("select an explicit registry identity");
  const url = new URL(registry);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || /[\x00-\x20\x7f]/u.test(registry)) throw Error("invalid registry identity");
  return { packagePath, registry: url.href };
}
function packageIdentity(repo, options) {
  const { packagePath, registry } = releaseOptions(options.packagePath, options.registry);
  let selected = repo;
  for (const [index, segment] of packagePath.split("/").entries()) {
    selected = join(selected, segment); const info = lstatSync(selected);
    if (info.isSymbolicLink() || (index < packagePath.split("/").length - 1 ? !info.isDirectory() : !info.isFile())) throw Error("package path must not traverse links");
  }
  if (realpathSync(selected) !== selected) throw Error("package path changed");
  const fd = openSync(selected, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let bytes;
  try {
    const start = fstatSync(fd);
    if (!start.isFile() || start.size > 65536) throw Error("package.json exceeds 64 KiB");
    const buffer = Buffer.alloc(65537); let count = 0, next;
    do { next = readSync(fd, buffer, count, buffer.length - count, null); count += next; } while (next && count < buffer.length);
    if (count > 65536) throw Error("package.json exceeds 64 KiB");
    const end = fstatSync(fd), current = lstatSync(selected);
    if (start.dev !== end.dev || start.ino !== end.ino || start.size !== end.size || start.mtimeMs !== end.mtimeMs ||
        current.isSymbolicLink() || current.dev !== end.dev || current.ino !== end.ino || realpathSync(selected) !== selected) throw Error("package.json changed during read");
    bytes = buffer.subarray(0, count);
  } finally { closeSync(fd); }
  const pkg = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!pkg || typeof pkg.name !== "string" || pkg.name.length > 214 || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(pkg.name) ||
      typeof pkg.version !== "string" || pkg.version.length > 128 || !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(pkg.version)) throw Error("package.json lacks a valid package name/version");
  return { packagePath, packageSourceSha256: createHash("sha256").update(bytes).digest("hex"), packageName: pkg.name, version: pkg.version, registry };
}
/** Exact intended package identity, not a registry lookup or publication observation. */
export function observePackageRelease(repo, options) {
  const resource = observeGitResource(repo), identity = packageIdentity(resource.repo, options);
  if (!same(observeGitResource(resource.repo), resource)) throw Error("package resource changed during observation");
  return { kind: "package-release", resource, ...identity };
}
export function packageReleaseEffectTarget(input) {
  if (input?.kind !== "package-release") throw Error("package release target required");
  const reference = canonical(input);
  if (Buffer.byteLength(reference) > 2048) throw Error("package release identity exceeds effect target bound");
  return { owner: "principal", kind: "package-release", reference };
}
export function resolvePackageRelease(input, options) {
  try {
    if (!input || Object.keys(input).some(key => !["kind", "resource", "packagePath", "packageSourceSha256", "packageName", "version", "registry"].includes(key)) || input.kind !== "package-release") throw Error("invalid package release reference");
    input = structuredClone(input); reference(input.resource);
    const resource = resolveGitResource(input.resource, options);
    if (resource.status !== "current") return { status: resource.status, reference: input };
    // The owner selected the exact repository before this source read.
    const check = () => {
      if (resolveGitResource(input.resource, options).status !== "current") throw Error("package resource is stale");
      const current = { kind: "package-release", resource: input.resource, ...packageIdentity(input.resource.repo, input) };
      if (!same(current, input) || resolveGitResource(input.resource, options).status !== "current") throw Error("package release target is stale");
    };
    try { check(); } catch { return { status: "stale", reference: input }; }
    return { status: "current", reference: input, observed: { packageName: input.packageName, version: input.version, registry: input.registry,
      repository: input.resource.repo, publication: "unverified", approval: false }, assertCurrent: async () => check() };
  } catch { return { status: "unavailable", reference: input }; }
}

function integration(resources) {
  if (!Array.isArray(resources) || !resources.length || resources.length > 16) throw Error("integration requires 1 to 16 exact resources");
  resources.forEach(reference);
  const selected = [...resources].sort((a, b) => a.repo.localeCompare(b.repo));
  if (new Set(selected.map(value => value.repo)).size !== selected.length) throw Error("duplicate integration repository");
  const body = { version: 1, kind: "principal-integration", resources: selected };
  return { ...body, id: `principal-integration:${hash(body)}` };
}
/** Binds existing candidate identities; this is not a cross-repository transaction. */
export function observeIntegrationSubject(repositories) {
  if (!Array.isArray(repositories) || repositories.length > 16) throw Error("select bounded repositories");
  const subject = integration(repositories.map(observeGitResource));
  const checked = resolveIntegrationSubject(subject, { repositories });
  if (checked.status !== "current") throw Error("integration inputs changed during observation");
  return subject;
}
/** Preserve per-resource statuses so unrelated outputs need not be invalidated by a caller. */
export function resolveIntegrationSubject(subject, options) {
  try {
    if (!subject || Object.keys(subject).some(key => !["version", "kind", "resources", "id"].includes(key)) ||
        !same(subject, integration(subject.resources))) throw Error("integration identity changed");
    subject = structuredClone(subject);
    const resources = subject.resources.map(ref => resolveGitResource(ref, options));
    const tickets = resources.map(row => row.assertCurrent);
    const status = resources.some(row => row.status === "unavailable") ? "unavailable" : resources.some(row => row.status === "stale") ? "stale" : "current";
    return { status, reference: subject, resources, atomic: false, approval: false,
      ...(status === "current" ? { assertCurrent: async () => { for (const ticket of tickets) await ticket(); } } : {}) };
  } catch { return { status: "unavailable", reference: subject, atomic: false, approval: false }; }
}

/** Optional information-only owner seam. Only trusted host code supplies wider roots. */
export function registerGitResourceObserver(pi, { repositories = ctx => [ctx.cwd] } = {}) {
  let bound, epoch = 0;
  const bind = (_event, ctx) => { bound = ctx; epoch++; };
  for (const name of ["session_start", "session_switch", "session_fork", "session_tree", "model_select"]) pi.on(name, bind);
  const unsubscribe = pi.events.on("bookie:work-reference:v1", request => {
    if (request?.version !== 1 || typeof request.requestId !== "string" || request.requestId.length > 256 ||
        typeof request.reply !== "function" || request.reference?.owner !== "principal" ||
        typeof request.sessionId !== "string" || request.sessionId.length > 512 || typeof request.cwd !== "string" || request.cwd.length > 4096) return;
    const ctx = bound, selectedEpoch = epoch, envelope = { version: 1, requestId: request.requestId, sessionId: request.sessionId, cwd: request.cwd };
    let exact, purpose;
    try { exact = structuredClone(request.reference); purpose = structuredClone(request.purpose); if (Buffer.byteLength(JSON.stringify(exact)) > 4096) return; } catch { return; }
    const reply = value => { try { request.reply(value); } catch {} };
    const checkOwner = () => {
      if (!ctx || bound !== ctx || epoch !== selectedEpoch || ctx.sessionManager.getSessionId() !== envelope.sessionId || realpathSync(ctx.cwd) !== envelope.cwd)
        throw Error("resource owner changed");
    };
    void (async () => {
      checkOwner();
      if (!["resource", "output", "judgment"].includes(purpose?.purpose) || (purpose.purpose === "judgment") !== (exact.reference?.kind === "principal-review")) {
        reply({ ...envelope, result: { status: "unverified", reference: structuredClone(exact) } }); return;
      }
      const inputs = exact.reference?.kind === "principal-integration" ? exact.reference.resources : exact.reference?.kind === "package-release" ? [exact.reference.resource] : [exact.reference];
      if (!Array.isArray(inputs) || inputs.length > 16) throw Error("invalid resource selection");
      for (const input of inputs) {
        if (["principal-review", "principal-snapshot"].includes(exact.reference?.kind)) path(input.repo); else reference(input);
      }
      let requiredRoots = [...new Set(inputs.map(input => input.repo))];
      // This is a fresh authority check, not a cache of selected roots or content.
      const authorize = async () => {
        checkOwner();
        const selected = await repositories(ctx);
        checkOwner();
        if (!Array.isArray(selected) || selected.length > 16) throw Error("invalid selected roots");
        const allowed = selected.map(repo => realpathSync(path(repo)));
        for (const repo of requiredRoots) {
          if (allowed.includes(repo)) continue;
          if (typeof request.authorizeRepository === "function" && realpathSync(repo) === repo && await request.authorizeRepository(repo) === true) allowed.push(repo);
          checkOwner();
        }
        return allowed;
      };
      let allowed = await authorize();
      checkOwner();
      if (exact.reference?.kind === "principal-review" && allowed.includes(exact.reference.repo)) {
        // Read producer metadata only after its repository is selected. The retained
        // exact Review ticket rechecks this immutable binding and every member later.
        requiredRoots = [...new Set([...requiredRoots, ...reviewReferenceRepositories(exact.reference, { repositories: allowed }).map(path)])];
        allowed = await authorize();
        checkOwner();
      }
      if (exact.reference?.kind === "principal-snapshot" && allowed.includes(exact.reference.repo)) {
        requiredRoots = snapshotReferenceRepositories(exact.reference, { repositories: allowed });
        allowed = await authorize();
        checkOwner();
      }
      const assertAuthorized = async (roots = requiredRoots) => {
        const fresh = await authorize();
        if (roots.some(repo => !fresh.includes(repo))) throw Error("Git resource is no longer selected");
        checkOwner();
      };
      const result = exact.reference?.kind === "principal-snapshot"
        ? resolveFrozenSnapshot(exact.reference, { repositories: allowed })
        : exact.reference?.kind === "principal-review"
        ? resolveReviewReference(exact.reference, purpose, { repositories: allowed, resolveOutput: resolveGitResource, resolveIntegration: resolveIntegrationSubject })
        : exact.reference?.kind === "package-release"
        ? resolvePackageRelease(exact.reference, { repositories: allowed })
        : exact.reference?.kind === "principal-integration"
        ? resolveIntegrationSubject(exact.reference, { repositories: allowed })
        : resolveGitResource(exact.reference, { repositories: allowed });
      await assertAuthorized(requiredRoots.filter(repo => allowed.includes(repo)));
      checkOwner();
      const observed = result.observed ?? (result.resources ? { resources: result.resources.map(row => ({ status: row.status, observed: row.observed })), atomic: false, approval: false } : undefined);
      if (observed && Buffer.byteLength(JSON.stringify(observed)) > 4096) throw Error("observation exceeds bound");
      reply({ ...envelope, result: { status: result.status, reference: structuredClone(exact), ...(result.judgment ? { judgment: structuredClone(result.judgment) } : {}), ...(observed ? { observed } : {}),
        ...(result.status === "current" ? { assertCurrent: async () => {
          await assertAuthorized();
          checkOwner();
          // Reuse only the exact content ticket; it performs fresh source validation.
          // Re-resolving first would repeat the same Git/Review/integration reads.
          await result.assertCurrent();
          await assertAuthorized();
        } } : {}) } });
    })().catch(() => reply({ ...envelope, result: { status: "unavailable", reference: structuredClone(exact) } }));
  });
  pi.on("session_shutdown", () => { bound = undefined; epoch++; unsubscribe?.(); });
}

// Exact required-input preparation; no execution, storage, semantic approval or permission.
import { createHash, randomUUID } from "node:crypto";
import { constants, openSync, closeSync, fstatSync, lstatSync, readSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const hash = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const object = (value, keys) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw Error("invalid handoff object");
};
const text = (value, max = 2000) => {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value) > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(value)) throw Error("invalid handoff text");
  return value;
};
const identifier = value => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/u.test(value)) throw Error("invalid handoff input id");
  return value;
};
function exactReference(value) {
  if (value?.kind === "file") {
    object(value, ["kind", "path", "sha256"]); text(value.path, 4096);
    if (!isAbsolute(value.path) || !/^[a-f0-9]{64}$/u.test(value.sha256)) throw Error("local input needs an absolute path and exact SHA-256");
  } else if (value?.kind === "context") {
    object(value, ["kind", "bundleId", "inputIds"]); text(value.bundleId, 256);
    if (value.inputIds !== undefined && (!Array.isArray(value.inputIds) || value.inputIds.length > 16 || value.inputIds.some(id => typeof id !== "string" || !id || id.length > 512))) throw Error("invalid context selection");
  } else if (value?.kind === "producer") {
    object(value, ["kind", "registrationId", "part"]); text(value.registrationId, 256);
    if (!["final", "partial", "manifest"].includes(value.part)) throw Error("invalid producer part");
  } else if (value?.kind === "research-brief") {
    object(value, ["version", "producer", "kind", "session", "sha256", "bytes"]);
    if (value.version !== 1 || value.producer !== "pi-scout-research" || !/^[a-f0-9]{64}$/u.test(value.session) ||
        !/^[a-f0-9]{64}$/u.test(value.sha256) || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > 96001) throw Error("invalid Scout brief reference");
  } else throw Error("unsupported handoff reference");
  return structuredClone(value);
}

export function prepareHandoff(request) {
  object(request, ["task", "scope", "profile", "intent", "required", "optional", "caveats"]);
  text(request.task); text(request.scope);
  if (!["task", "plan", "decision", "architecture", "custom"].includes(request.profile)) throw Error("select the relevant handoff profile");
  const list = value => {
    if (!Array.isArray(value) || value.length > 16) throw Error("handoff inputs exceed bounds");
    return value.map(input => { object(input, ["id", "reference"]); return { id: identifier(input.id), reference: exactReference(input.reference) }; });
  };
  const required = list(request.required), optional = list(request.optional ?? []);
  if (!required.length || required.length + optional.length > 16) throw Error("name at least one required input; at most 16 inputs total");
  const ids = [...required, ...optional].map(row => row.id);
  if (new Set(ids).size !== ids.length) throw Error("duplicate handoff input id");
  const caveats = request.caveats ?? [];
  if (!Array.isArray(caveats) || caveats.length > 8) throw Error("handoff caveats exceed bounds");
  caveats.forEach(value => text(value, 1000));
  let intent;
  if (request.intent !== undefined) {
    object(request.intent, ["original", "current", "amendments"]);
    const amendments = request.intent.amendments ?? [];
    if (!Array.isArray(amendments) || amendments.length > 8) throw Error("invalid amendment references");
    for (const id of [request.intent.original, request.intent.current, ...amendments]) {
      identifier(id);
      if (!required.some(row => row.id === id)) throw Error("intent and amendments must name required inputs");
    }
    intent = { original: request.intent.original, current: request.intent.current, amendments };
  } else if (request.profile !== "task") throw Error("review needs original and current intent references; do not invent intent");
  const body = { version: 1, task: request.task, scope: request.scope, profile: request.profile,
    ...(intent ? { intent } : {}), required, optional, caveats };
  if (Buffer.byteLength(canonical(body)) > 16 * 1024) throw Error("compact handoff exceeds bound");
  return { ...body, id: `handoff:${hash(canonical(body))}` };
}

function validateHandoff(value) {
  object(value, ["version", "id", "task", "scope", "profile", "intent", "required", "optional", "caveats"]);
  const { version, id, ...request } = value;
  const checked = prepareHandoff(request);
  if (version !== 1 || checked.id !== id) throw Error("handoff identity changed");
  return checked;
}

/** No partial result is called ready. Resolver callbacks are trusted host code, never model input. */
export async function resolveHandoff(handoff, { resolveReference, optionalIds = [], signal, assertCurrent = async () => {} } = {}) {
  const checked = validateHandoff(handoff);
  if (typeof resolveReference !== "function" || !Array.isArray(optionalIds) || new Set(optionalIds).size !== optionalIds.length || optionalIds.some(id => !checked.optional.some(row => row.id === id))) throw Error("invalid handoff resolution selection");
  const selected = [...checked.required, ...checked.optional.filter(row => optionalIds.includes(row.id))];
  const results = [], tickets = [];
  let bytes = 0;
  for (const input of selected) {
    if (signal?.aborted) throw Error("handoff resolution aborted");
    await assertCurrent();
    const required = checked.required.some(row => row.id === input.id);
    let result;
    try { result = await resolveReference(structuredClone(input.reference), signal); }
    catch { result = { status: "unavailable" }; }
    if (result?.status === "resolved" && result.complete === true && result.truncated === false && typeof result.excerpt === "string" &&
        Array.isArray(result.references) && result.references.length && typeof result.assertCurrent === "function") {
      const size = Buffer.byteLength(result.excerpt);
      if (size <= 48_000 && bytes + size <= 48_000 && Buffer.byteLength(JSON.stringify(result.references)) <= 16 * 1024) {
        bytes += size; tickets.push(result.assertCurrent);
        results.push({ id: input.id, required, status: "resolved", excerpt: result.excerpt, references: structuredClone(result.references), untrusted: true });
        continue;
      }
      result = { status: "incomplete" };
    }
    const status = ["missing", "stale", "suppressed", "denied", "incomplete", "unavailable"].includes(result?.status) ? result.status : "incomplete";
    results.push({ id: input.id, required, status });
  }
  let changed = false;
  try { for (const recheck of tickets) await recheck(); await assertCurrent(); if (signal?.aborted) throw Error("aborted"); }
  catch { changed = true; }
  const blocked = changed || results.some(row => row.required && row.status !== "resolved");
  return { version: 1, handoffId: checked.id, state: blocked ? "blocked" : "ready", approval: false,
    administrativeWrites: false, executionAuthorized: false, scope: "exact required-input availability only",
    ...(changed ? { reason: "inputs-or-authority-changed" } : {}),
    inputs: blocked ? results.map(({ excerpt: _excerpt, references: _references, ...row }) => ({ ...row, ...(changed && row.status === "resolved" ? { status: "stale" } : {}) })) : results,
    optionalNotRequested: checked.optional.filter(row => !optionalIds.includes(row.id)).map(row => row.id),
    caveats: checked.caveats, untrusted: true };
}

/** Explicit exact local text only; no directory scan, Git requirement, shell or external roots. */
export function readLocalHandoffReference(reference, cwd) {
  exactReference(reference);
  const root = realpathSync(cwd), path = reference.path;
  if (reference.kind !== "file") throw Error("not a local reference");
  const read = () => {
    const canonicalPath = realpathSync(path), rel = relative(root, canonicalPath);
    if (canonicalPath !== resolve(path) || rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw Error("local handoff input is outside the current workspace");
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const before = fstatSync(fd, { bigint: true });
      if (!before.isFile() || before.size > 262_144n) throw Error("local handoff input exceeds bound");
      const buffer = Buffer.alloc(Number(before.size) + 1);
      let length = 0;
      while (length < buffer.length) { const n = readSync(fd, buffer, length, buffer.length - length, null); if (!n) break; length += n; }
      const content = buffer.subarray(0, length), after = fstatSync(fd, { bigint: true }), named = lstatSync(path, { bigint: true });
      const identity = info => [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs].join(":");
      if (BigInt(length) !== before.size || identity(before) !== identity(after) || identity(after) !== identity(named) || realpathSync(path) !== canonicalPath || hash(content) !== reference.sha256) throw Error("local handoff input changed");
      return new TextDecoder("utf-8", { fatal: true }).decode(content);
    } finally { closeSync(fd); }
  };
  try {
    const excerpt = read();
    return { status: "resolved", excerpt, complete: true, truncated: false, references: [reference], assertCurrent: async () => { read(); } };
  } catch (error) {
    return { status: error.code === "ENOENT" ? "missing" : /changed/u.test(error.message) ? "stale" : "denied" };
  }
}

/** Observe the actual destination without returning keys, headers or endpoint credentials. */
export async function observeHandoffDestination(ctx) {
  const model = ctx.model;
  if (!model || typeof ctx.modelRegistry?.getApiKeyAndHeaders !== "function") return null;
  try {
    if (![model.provider, model.id, model.api].every(value => typeof value === "string" && value.length && value.length < 512)) return null;
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth?.ok) return null;
    const endpoint = new URL(auth.baseUrl ?? model.baseUrl);
    if (!["https:", "http:"].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
    return { provider: model.provider, model: model.id, api: model.api, endpoint: hash(endpoint.href) };
  } catch { return null; }
}

/** Optional owner-bound Bookie/Scout request. Absence never falls back to shell or a caller pathname. */
export function resolveOptionalReference(pi, ctx, reference, signal) {
  exactReference(reference);
  if (reference.kind === "file") throw Error("not an optional producer reference");
  const sessionId = ctx.sessionManager.getSessionId(), cwd = realpathSync(ctx.cwd), requestId = randomUUID();
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); resolve(value); };
    const abort = () => finish({ status: "unavailable" });
    const timer = setTimeout(() => finish({ status: "unavailable" }), 1500);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    try {
      pi.events.emit(reference.kind === "research-brief" ? "scout:resolve:v1" : "bookie:resolve:v1", { version: 1, requestId, sessionId, cwd, reference, maxBytes: 24_000, reply: reply => {
        try {
          if (reply?.version !== 1 || reply.requestId !== requestId || reply.sessionId !== sessionId || reply.cwd !== cwd ||
              ctx.sessionManager.getSessionId() !== sessionId || realpathSync(ctx.cwd) !== cwd) { finish({ status: "unavailable" }); return; }
          if (!reply.ok) { finish({ status: reply.status }); return; }
          finish({ ...reply.result, assertCurrent: reply.assertCurrent });
        } catch { finish({ status: "unavailable" }); }
      } });
    } catch { finish({ status: "unavailable" }); }
  });
}

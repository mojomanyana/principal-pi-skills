// Principal-owned explicit reference producer. No work acceptance, native gate or command execution.
import { constants, existsSync, openSync, closeSync, writeSync, fsyncSync, mkdirSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { AssuranceStore, readBoundedAssuranceText, canonicalJson, digest, buildCurrentApplicabilityProjection } from "./assurance-state.mjs";
const VERSION = "principal-native-reference-event-v1";
const MAX_BYTES = 1024 * 1024, MAX_RECORDS = 512;
const fail = message => { throw new Error(`REFERENCE_${message}`); };
const object = x => x !== null && typeof x === "object" && !Array.isArray(x);
const fields = (x, names) => object(x) && Object.keys(x).length === names.length && names.every(k => Object.hasOwn(x, k));
const id = x => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const sha = x => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
export const referenceOf = entry => ({ seq: entry.seq, digest: entry.digest });
export const validPrincipalReference = x => fields(x, ["seq", "digest"]) && Number.isSafeInteger(x.seq) && x.seq > 0 && sha(x.digest);
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
function nativeSnapshot(stateDir, runId) {
  if (typeof stateDir !== "string" || !stateDir || !id(runId)) fail("INPUT_INVALID");
  const store = new AssuranceStore({ baseDir: stateDir });
  const { state, events } = store.load(runId, { withEvents: true, maxBytes: 16 * MAX_BYTES, maxEvents: 10000 });
  const raw = readBoundedAssuranceText(store.paths(runId).log, 16 * MAX_BYTES).match(/[^\n]+(?:\n|$)/g) ?? [];
  if (raw.length !== events.length || raw.some((line, i) => !equal(JSON.parse(line), events[i]))) fail("NATIVE_SNAPSHOT_CHANGED");
  return { state, events, raw, path: join(store.paths(runId).dir, "principal-references-v1.jsonl") };
}
function recordShape(r) {
  if (!object(r) || !id(r.author)) fail("RECORD_INVALID");
  if (r.type === "check-result") {
    if (!fields(r, ["type", "check_id", "task", "context", "candidate", "evidence", "evidence_sha256", "corrects", "author"]) ||
        !id(r.check_id) || (r.task !== null && !validPrincipalReference(r.task)) || ![r.context, r.candidate, r.evidence].every(validPrincipalReference) || !sha(r.evidence_sha256) ||
        (r.corrects !== null && !validPrincipalReference(r.corrects))) fail("RECORD_INVALID");
  } else if (r.type === "check-retired") {
    if (!fields(r, ["type", "check_id", "previous", "reason", "author"]) || !id(r.check_id) || !validPrincipalReference(r.previous) ||
        typeof r.reason !== "string" || !r.reason.trim() || [...r.reason].length > 2048) fail("RECORD_INVALID");
  } else if (r.type === "finalization-linked") {
    if (!fields(r, ["type", "native_finalization", "checks", "author"]) || !validPrincipalReference(r.native_finalization) ||
        !Array.isArray(r.checks) || r.checks.length > 256 || !r.checks.every(validPrincipalReference) ||
        new Set(r.checks.map(canonicalJson)).size !== r.checks.length) fail("RECORD_INVALID");
  } else fail("RECORD_INVALID");
}
function decode(text) {
  if (!text) return [];
  if (!text.endsWith("\n") || Buffer.byteLength(text) > MAX_BYTES) fail("JOURNAL_INVALID");
  const lines = text.slice(0, -1).split("\n");
  if (lines.length > MAX_RECORDS) fail("JOURNAL_LIMIT");
  return lines.map(line => {
    let entry;
    try { entry = JSON.parse(line); if (canonicalJson(entry) !== line) fail("JOURNAL_NONCANONICAL"); }
    catch { fail("JOURNAL_INVALID"); }
    return entry;
  });
}
function fold(native, entries) {
  const checks = new Map(), sources = new Map(), finalizations = [];
  const applicability = buildCurrentApplicabilityProjection(native.state);
  const taskStates = new Map(applicability.tasks.map(t => [t.task_id, t]));
  const nativeRef = (ref, anchor, types) => {
    if (!validPrincipalReference(ref) || ref.seq > anchor.event_count) fail("NATIVE_REF_INVALID");
    const event = native.events[ref.seq - 1];
    if (!event || event.event_digest !== ref.digest || (types && !types.includes(event.type))) fail("NATIVE_REF_MISMATCH");
    sources.set(ref.seq, { reference: ref, event, raw: native.raw[ref.seq - 1], sha256: digest(native.raw[ref.seq - 1]) });
    return event;
  };
  const checkApplicability = check => {
    if (check.retirement) return "retired";
    const r = check.result.record, event = native.events[r.evidence.seq - 1], task = taskStates.get(check.task_id);
    const context = native.events[r.context.seq - 1];
    if ((check.task_id !== null && (!task || task.applicability !== "current")) || event.workspace_id !== native.state.active_workspace_id ||
        event.head_sha !== applicability.candidate.head_sha || event.tree_sha !== applicability.candidate.tree_sha ||
        event.seq <= applicability.authority.freshness_floor ||
        (context.type === "review_recorded" && context.seq <= applicability.authority.freshness_floor) ||
        (task && event.kind === "exact-target" && (task.status !== "completed" || event.seq <= (task.completed_seq ?? 0)))) return "stale";
    return "current";
  };
  let previous = null, priorNativeCount = 0;
  for (const [i, entry] of entries.entries()) {
    if (!fields(entry, ["version", "seq", "prev_digest", "native_ledger", "record", "digest"]) || entry.version !== VERSION ||
        entry.seq !== i + 1 || entry.prev_digest !== previous || !sha(entry.digest)) fail("JOURNAL_CHAIN_INVALID");
    const { digest: recordedDigest, ...body } = entry;
    if (digest(body) !== recordedDigest) fail("JOURNAL_DIGEST_MISMATCH");
    const anchor = entry.native_ledger;
    if (!fields(anchor, ["run_id", "event_count", "hash_chain_head"]) || anchor.run_id !== native.state.run_id ||
        !Number.isSafeInteger(anchor.event_count) || anchor.event_count < 1 || anchor.event_count < priorNativeCount ||
        native.events[anchor.event_count - 1]?.event_digest !== anchor.hash_chain_head) fail("NATIVE_ANCHOR_INVALID");
    recordShape(entry.record);
    const r = entry.record;
    if (r.type === "check-result") {
      if (finalizations.length) fail("FINALIZED_CHECK_SET");
      const task = r.task === null ? null : nativeRef(r.task, anchor, ["task_packet_recorded"]);
      const context = nativeRef(r.context, anchor, ["phase_started", "review_recorded"]);
      const candidate = nativeRef(r.candidate, anchor, ["code_changed", "repair_completed"]);
      const evidence = nativeRef(r.evidence, anchor, ["evidence_recorded"]);
      const taskId = task?.packet.task_id ?? null, workspaceId = task?.packet.workspace_id ?? evidence.workspace_id;
      const candidateWorkspace = native.events.slice(0, candidate.seq).findLast(e => e.type === "workspace_attached")?.workspace_id;
      if (!id(workspaceId) || candidateWorkspace !== workspaceId || (context.task_id ?? null) !== taskId || context.workspace_id !== workspaceId ||
          (evidence.task_id ?? null) !== taskId || evidence.workspace_id !== workspaceId || (candidate.task_id ?? null) !== taskId ||
          candidate.seq >= evidence.seq || candidate.head_sha !== evidence.head_sha || candidate.tree_sha !== evidence.tree_sha ||
          (context.type === "review_recorded" && (context.head_sha !== evidence.head_sha || context.tree_sha !== evidence.tree_sha)) ||
          (context.type === "phase_started" && (!context.definition_digest || context.seq >= evidence.seq)) ||
          digest(native.raw[evidence.seq - 1]) !== r.evidence_sha256) fail("CHECK_CONTEXT_MISMATCH");
      const old = checks.get(r.check_id);
      if (old ? old.retirement || !equal(r.corrects, referenceOf(old.result)) || !equal(r.task, old.result.record.task) ||
          evidence.seq <= old.result.record.evidence.seq : r.corrects !== null) fail("CORRECTION_MISMATCH");
      checks.set(r.check_id, { check_id: r.check_id, task_id: taskId, workspace_id: workspaceId, result: entry, retirement: null });
    } else if (r.type === "check-retired") {
      const check = checks.get(r.check_id);
      if (!check || check.retirement || !equal(r.previous, referenceOf(check.result))) fail("RETIREMENT_MISMATCH");
      check.retirement = entry;
    } else {
      if (finalizations.length) fail("FINALIZATION_DUPLICATE");
      const event = nativeRef(r.native_finalization, anchor, ["finalization_completed"]);
      const active = [...checks.values()].filter(c => !c.retirement);
      if (!equal(r.checks.map(canonicalJson).sort(), active.map(c => canonicalJson(referenceOf(c.result))).sort()) ||
          active.some(c => checkApplicability(c) !== "current" || c.result.record.evidence.seq >= event.seq)) fail("FINALIZATION_CHECK_MISMATCH");
      finalizations.push({ reference: referenceOf(entry), record: r, native_event: event });
    }
    previous = entry.digest; priorNativeCount = anchor.event_count;
  }
  return { version: "principal-native-references-v1", authority: "declared-not-authenticated", acceptance: "not-assessed",
    write_acknowledgement: "not-reconstructed-from-journal",
    native_ledger: { run_id: native.state.run_id, event_count: native.state.event_seq, hash_chain_head: native.state.event_digest },
    head: entries.length ? referenceOf(entries.at(-1)) : null, entries,
    checks: [...checks.values()].map(c => ({ check_id: c.check_id, task_id: c.task_id, workspace_id: c.workspace_id,
      current: referenceOf(c.result), retirement: c.retirement ? referenceOf(c.retirement) : null, applicability: checkApplicability(c) })),
    sources: [...sources.values()], finalizations };
}
export function readPrincipalNativeReferences({ stateDir, runId }) {
  const native = nativeSnapshot(stateDir, runId);
  const text = existsSync(native.path) ? readBoundedAssuranceText(native.path, MAX_BYTES) : "";
  return { state: native.state, catalog: fold(native, decode(text)) };
}
/** Explicit producer operation ONLY. Never called by a projection/read. CAS + readback, no acceptance effects. */
export function appendPrincipalNativeReference({ stateDir, runId, expectedHead, record }) {
  if (expectedHead !== null && !sha(expectedHead)) fail("CAS_REQUIRED");
  const detached = JSON.parse(canonicalJson(record));
  recordShape(detached);
  const native = nativeSnapshot(stateDir, runId), lock = native.path + ".lock";
  mkdirSync(lock, { mode: 0o700 });
  let writeAttempted = false;
  try {
    const text = existsSync(native.path) ? readBoundedAssuranceText(native.path, MAX_BYTES) : "";
    const entries = decode(text), before = fold(native, entries);
    if ((before.head?.digest ?? null) !== expectedHead) fail("CAS_MISMATCH");
    const body = { version: VERSION, seq: entries.length + 1, prev_digest: expectedHead, native_ledger: before.native_ledger, record: detached };
    const entry = { ...body, digest: digest(body) };
    const next = [...entries, entry], addition = canonicalJson(entry) + "\n";
    if (next.length > MAX_RECORDS || Buffer.byteLength(text + addition) > MAX_BYTES) fail("JOURNAL_LIMIT");
    fold(native, next); // Validate every reference before any append.
    let fd;
    try {
      writeAttempted = true;
      fd = openSync(native.path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
      const bytes = Buffer.from(addition); let written = 0;
      while (written < bytes.length) { const n = writeSync(fd, bytes, written, bytes.length - written); if (!n) fail("WRITE_UNKNOWN"); written += n; }
      fsyncSync(fd);
    } finally { if (fd !== undefined) closeSync(fd); }
    const directory = openSync(dirname(native.path), constants.O_RDONLY | constants.O_DIRECTORY);
    try { fsyncSync(directory); } finally { closeSync(directory); }
    const readback = readBoundedAssuranceText(native.path, MAX_BYTES);
    if (readback !== text + addition) fail("READBACK_UNKNOWN");
    fold(native, decode(readback));
    return { version: "principal-native-reference-write-v1", reference: referenceOf(entry), native_ledger: before.native_ledger,
      record: detached, readback_sha256: digest(readback), acceptance: "not-assessed" };
  } catch (error) {
    if (writeAttempted) throw new Error("REFERENCE_WRITE_UNACKNOWLEDGED", { cause: error });
    throw error;
  } finally {
    try { rmdirSync(lock); }
    catch (error) { throw new Error("REFERENCE_LOCK_RELEASE_UNACKNOWLEDGED", { cause: error }); }
  }
}

// Opt-in host assembly. One native reference journal, data-only lifecycle export, caller-owned archive port.
import { constants, openSync, closeSync, fstatSync, readSync } from "node:fs";
import { isAbsolute } from "node:path";
import { createHash } from "node:crypto";
const byteDigest = bytes => createHash("sha256").update(bytes).digest("hex");
import { canonicalJson, digest, readBoundedAssuranceText } from "./assurance-state.mjs";
import { appendPrincipalNativeReference, referenceOf, validPrincipalReference } from "./principal-native-references.mjs";
import { parseAssociationJson, projectPrincipalAssociations } from "./principal-association.mjs";
const VERSION = "principal-generic-check-lifecycle-v1", MAX_PAYLOAD = 1024 * 1024;
const fail = code => { throw new Error(`HOST_${code}`); };
const eq = (a, b) => canonicalJson(a) === canonicalJson(b);
const shape = (x, fields) => x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length === fields.length && fields.every(k => Object.hasOwn(x, k));
const text = x => typeof x === "string" && x.length > 0 && x.length <= 512 && !/[\x00-\x1f\x7f]/.test(x);
const sha = x => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const channels = ["stdout", "stderr", "output"];
const resultRef = (r, write) => r.source === "write" ? write?.reference ?? fail("WRITE_REFERENCE_MISSING") : r.reference;
function requestShape(r) {
  const result = v => shape(v, ["source"]) && v.source === "write" || shape(v, ["source", "reference"]) && v.source === "journal" && validPrincipalReference(v.reference);
  if (!shape(r, ["version", "expected_head", "operation", "selections", "payloads"]) || r.version !== "principal-host-assembly-request-v1" ||
      (r.expected_head !== null && !validPrincipalReference(r.expected_head)) || !Array.isArray(r.selections) || r.selections.length > 32 || !Array.isArray(r.payloads) || r.payloads.length > 32) fail("REQUEST_INVALID");
  for (const s of r.selections) if (!shape(s, ["binding_id", "check_id", "result", "generic_receipt_id", "generic_claim", "generic_artifact", "generic_artifact_digest", "generic_evidence"]) ||
    !text(s.binding_id) || !text(s.check_id) || !result(s.result)) fail("SELECTION_INVALID");
  for (const p of r.payloads) if (!shape(p, ["binding_id", "check_id", "result", "channel", "path", "sha256", "byte_length", "permission_id"]) ||
    !text(p.binding_id) || !text(p.check_id) || !result(p.result) || !channels.includes(p.channel) || !text(p.permission_id) || typeof p.path !== "string" || p.path.length > 4096 || !isAbsolute(p.path) ||
    !sha(p.sha256) || !Number.isSafeInteger(p.byte_length) || p.byte_length < 0 || p.byte_length > MAX_PAYLOAD) fail("PAYLOAD_INVALID");
  if (r.payloads.reduce((n, p) => n + p.byte_length, 0) > 4 * MAX_PAYLOAD) fail("PAYLOAD_LIMIT");
}
function sourceOf(p) {
  const n = p.native_references;
  return { native_ledger: n.native_ledger, journal_head: n.head, journal_sha256: digest(n.entries.map(e => canonicalJson(e) + "\n").join("")),
    association_sha256: digest(p), daily_view_sha256: p.generic.input_sha256, bindings_sha256: p.declarations_sha256, work_context_sha256: p.work_context_sha256 };
}
function emissionsOf(p) {
  const n = p.native_references;
  return p.associations.flatMap(a => a.reference_links.map(l => {
    const d = l.declaration, entry = n.entries.find(e => eq(referenceOf(e), d.native_check));
    if (!entry || entry.record.type !== "check-result" || entry.record.check_id !== d.check_id || !eq(entry.record.context, d.native_context)) fail("NATIVE_SELECTION_MISMATCH");
    const bound = ["current", "stale", "superseded", "retired"].includes(l.status);
    if (bound) {
      const source = r => { if (r === null) return null; const matches = n.sources.filter(s => eq(s.reference, r)); if (matches.length !== 1) fail("NATIVE_SOURCE_MISMATCH"); return matches[0]; };
      const r = entry.record, current = n.checks.find(c => c.check_id === d.check_id);
      const latest = n.entries.findLast(e => e.record.type === "check-result" && e.record.check_id === d.check_id);
      const retiredEntry = n.entries.find(e => e.record.type === "check-retired" && e.record.check_id === d.check_id);
      if (!current || !eq(current.current, referenceOf(latest)) || !eq(current.retirement, retiredEntry ? referenceOf(retiredEntry) : null) ||
          (retiredEntry ? current.applicability !== "retired" : !["current", "stale"].includes(current.applicability)) ||
          l.status !== (eq(current.current, d.native_check) ? current.applicability : "superseded") ||
          (eq(current.current, d.native_check) && current.retirement && d.retirement === null)) fail("CHECK_APPLICABILITY_MISMATCH");
      const retirement = d.retirement === null ? null : n.entries.find(e => eq(referenceOf(e), d.retirement));
      if (d.retirement !== null && (!retirement || retirement.record.type !== "check-retired" || retirement.record.check_id !== d.check_id || !eq(retirement.record.previous, d.native_check))) fail("RETIREMENT_MISMATCH");
      const final = d.finalization === null ? null : n.entries.find(e => eq(referenceOf(e), d.finalization));
      if (d.finalization !== null && (!final || final.record.type !== "finalization-linked" || !final.record.checks.some(c => eq(c, d.native_check)))) fail("FINALIZATION_MISMATCH");
      const native = { check: { reference: d.native_check, record: r }, task: source(r.task), context: source(r.context), candidate: source(r.candidate), evidence: source(r.evidence),
        retirement: retirement ? { reference: d.retirement, record: retirement.record } : null,
        finalization: final ? { reference: d.finalization, record: final.record, native_event: source(final.record.native_finalization).event } : null };
      if (!eq(native, l.native) || native.evidence.sha256 !== r.evidence_sha256 || current.task_id !== (native.task?.event.packet.task_id ?? null) ||
          (eq(current.current, d.native_check) && current.workspace_id !== native.evidence.event.workspace_id) ||
          a.native.task_id !== current.task_id || a.native.workspace_id !== current.workspace_id) fail("NATIVE_SOURCE_MISMATCH");
      const g = l.generic;
      if (!eq(g.selectedSnapshot, a.generic.selectedSnapshot) || g.binding_key !== a.generic.binding_key || g.receipt_id !== d.generic_receipt_id || !eq(g.claim, d.generic_claim) ||
          !eq(g.binding.artifact, d.generic_artifact) || g.binding.artifactDigest !== d.generic_artifact_digest || !eq(g.evidence, d.generic_evidence) || !g.binding.evidence.some(e => eq(e, g.evidence))) fail("WORK_REFERENCE_MISMATCH");
    }
    const retired = bound && l.native.retirement;
    return { binding_id: a.binding_id, run_id: n.native_ledger.run_id, check_id: d.check_id, revision: d.native_check,
      predecessor: entry?.record.corrects ?? null, state: bound ? "emitted" : l.status, applicability: l.status,
      relation: "explicit-reference-link-not-semantic-equivalence", acceptance: "not-assessed",
      work: bound ? l.generic : null, native: bound ? l.native : null,
      finalization: bound ? l.native.finalization : null,
      retirement: retired ? { state: "emitted", origin: retired.reference, previous: retired.record.previous, reason: retired.record.reason } : { state: bound ? "not-retired" : "unbound" },
      issues: bound ? [] : l.issues, payloads: Object.fromEntries(channels.map(c => [c, { state: "missing", reason: "bytes-not-supplied" }])) };
  }));
}
function payloadOrigin(row, channel) {
  return { run_id: row.run_id, check_id: row.check_id, revision: row.revision, context: row.native.context.reference,
    candidate: row.native.candidate.reference, evidence: row.native.evidence.reference, binding_id: row.binding_id,
    selectedSnapshot: row.work.selectedSnapshot, binding_key: row.work.binding_key, receipt_id: row.work.receipt_id,
    generic_evidence: row.work.evidence, channel };
}
function receiptShape(r) {
  return shape(r, ["version", "archive_id", "object_id", "sha256", "byte_length", "origin_sha256"]) && r.version === "principal-check-payload-receipt-v1" &&
    text(r.archive_id) && text(r.object_id) && sha(r.sha256) && sha(r.origin_sha256) && Number.isSafeInteger(r.byte_length) && r.byte_length >= 0 && r.byte_length <= MAX_PAYLOAD;
}
function validatePayload(p, row, channel) {
  if (p.state === "retained") {
    if (!shape(p, ["state", "permission_id", "sha256", "byte_length", "origin", "receipt", "readback_sha256"]) || row.state !== "emitted" || !text(p.permission_id) || !receiptShape(p.receipt) ||
        !eq(p.origin, payloadOrigin(row, channel)) || p.receipt.origin_sha256 !== digest(p.origin) || p.sha256 !== p.receipt.sha256 || p.byte_length !== p.receipt.byte_length || p.readback_sha256 !== p.sha256) fail("PAYLOAD_RECEIPT_MISMATCH");
  } else if (!shape(p, ["state", "reason"]) || !["missing", "unbound"].includes(p.state) || !["bytes-not-supplied", "source-unavailable", "source-permission-missing", "archive-port-missing", "work-link-unbound"].includes(p.reason)) fail("PAYLOAD_STATE_INVALID");
}
/** Data-only consumer. Expected receipt/source pins MUST come from the caller, not be extracted here. */
export function consumePrincipalLifecycle(envelopeText, expected) {
  if (!shape(expected, ["digest", "source"]) || !sha(expected.digest)) fail("EXPECTED_RECEIPT_REQUIRED");
  const e = parseAssociationJson(envelopeText);
  if (!shape(e, ["version", "authority", "acceptance", "source", "association", "emissions", "digest"]) || e.version !== VERSION ||
      e.authority !== "declared-not-authenticated" || e.acceptance !== "not-assessed") fail("ENVELOPE_INVALID");
  const { digest: recorded, ...body } = e;
  if (recorded !== expected.digest || digest(body) !== recorded || !eq(e.source, expected.source)) fail("ENVELOPE_PIN_MISMATCH");
  const p = e.association;
  if (p.version !== "principal-work-associations-v3" || p.readOnly !== true || p.acceptance !== "not-assessed" || !eq(sourceOf(p), e.source)) fail("SOURCE_MISMATCH");
  let previous = null;
  for (const [i, entry] of p.native_references.entries.entries()) {
    const { digest: d, ...b } = entry;
    if (entry.version !== "principal-native-reference-event-v1" || entry.seq !== i + 1 || entry.prev_digest !== previous || digest(b) !== d) fail("JOURNAL_MISMATCH");
    previous = d;
  }
  const entries = p.native_references.entries;
  if (!eq(entries.length ? referenceOf(entries.at(-1)) : null, p.native_references.head)) fail("JOURNAL_MISMATCH");
  for (const s of p.native_references.sources) {
    const { event_digest, ...b } = s.event;
    if (digest(b) !== event_digest || !eq({ seq: s.event.seq, digest: event_digest }, s.reference) || digest(s.raw) !== s.sha256 || !eq(JSON.parse(s.raw), s.event)) fail("NATIVE_SOURCE_MISMATCH");
  }
  const derived = emissionsOf(p);
  if (!Array.isArray(e.emissions) || e.emissions.length > 32 || e.emissions.length !== derived.length) fail("EMISSION_MISMATCH");
  for (const [i, row] of e.emissions.entries()) {
    if (!shape(row.payloads, channels)) fail("PAYLOAD_STATE_INVALID");
    for (const channel of channels) validatePayload(row.payloads[channel], derived[i], channel);
    derived[i].payloads = row.payloads;
    if (!eq(row, derived[i])) fail("EMISSION_MISMATCH");
  }
  return { version: "principal-generic-check-consumption-v1", source: e.source, digest: e.digest, authority: e.authority, acceptance: e.acceptance, emissions: e.emissions };
}
function readPayload(path, size) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd); if (!before.isFile() || before.size !== size || before.size > MAX_PAYLOAD) fail("SOURCE_SIZE_MISMATCH");
    const bytes = Buffer.alloc(size + 1); let at = 0, count;
    while (at < bytes.length && (count = readSync(fd, bytes, at, bytes.length - at, null))) at += count;
    const after = fstatSync(fd);
    if (at !== size || ["dev", "ino", "size", "mtimeMs", "ctimeMs"].some(k => before[k] !== after[k])) fail("SOURCE_CHANGED");
    return bytes.subarray(0, size);
  } finally { closeSync(fd); }
}
function permitted(p, row, permissions) {
  if (!Array.isArray(permissions) || permissions.length > 32) fail("PERMISSIONS_INVALID");
  const matches = permissions.filter(g => g?.id === p.permission_id);
  if (matches.length !== 1) return false;
  const g = matches[0];
  return shape(g, ["id", "path", "sha256", "max_bytes", "run_id", "check_id", "revision", "channel", "purpose"]) && g.path === p.path && g.sha256 === p.sha256 &&
    Number.isSafeInteger(g.max_bytes) && g.max_bytes >= p.byte_length && g.max_bytes <= MAX_PAYLOAD && g.run_id === row.run_id && g.check_id === row.check_id &&
    eq(g.revision, row.revision) && g.channel === p.channel && g.purpose === "retain-check-output";
}
/** Existing producer + actual v3 reader. No new authority/decision store or automatic source discovery. */
export async function assemblePrincipalHost({ stateDir, runId, dailyViewText, bindingsText, workContextText, request, archivePort, sourcePermissions = [] }) {
  const effects = { native_write: null, archives: [] };
  try {
    request = parseAssociationJson(canonicalJson(request)); requestShape(request);
    if (!Array.isArray(sourcePermissions) || sourcePermissions.length > 32) fail("PERMISSIONS_INVALID");
    const bindings = parseAssociationJson(bindingsText);
    if (bindings.version !== "principal-host-bindings-v3" || !Array.isArray(bindings.bindings) || bindings.bindings.some(b => b.reference_links?.length)) fail("EMPTY_V3_LINKS_REQUIRED");
    const options = { stateDir, runId, dailyViewText, workContextText };
    const before = projectPrincipalAssociations({ ...options, bindingsText });
    if (!eq(before.native_references.head, request.expected_head)) fail("CAS_MISMATCH");
    // Native write is explicit, independently acknowledged, and never rolled back if later assembly fails.
    if (request.operation !== null) {
      effects.native_write = { state: "unacknowledged" };
      effects.native_write = appendPrincipalNativeReference({ stateDir, runId, expectedHead: request.expected_head?.digest ?? null, record: request.operation });
    }
    const after = projectPrincipalAssociations({ ...options, bindingsText }), n = after.native_references;
    if (!eq(n.head, effects.native_write?.reference ?? request.expected_head)) fail("SOURCE_CHANGED");
    const seen = new Set();
    for (const s of request.selections) {
      const reference = resultRef(s.result, effects.native_write), key = canonicalJson([s.binding_id, s.check_id, reference]);
      if (seen.has(key)) fail("SELECTION_DUPLICATE"); seen.add(key);
      const entry = n.entries.find(e => eq(referenceOf(e), reference)), matches = bindings.bindings.filter(b => b.binding_id === s.binding_id);
      if (matches.length !== 1 || !entry || entry.record.type !== "check-result" || entry.record.check_id !== s.check_id) fail("NATIVE_SELECTION_MISMATCH");
      const retirement = n.entries.find(e => e.record.type === "check-retired" && e.record.check_id === s.check_id && eq(e.record.previous, reference));
      const finalization = n.finalizations.find(e => e.record.checks.some(r => eq(r, reference)));
      const { binding_id, result, ...genericSelection } = s;
      (matches[0].reference_links ??= []).push({ ...genericSelection, native_check: reference, native_context: entry.record.context,
        retirement: retirement ? referenceOf(retirement) : null, finalization: finalization?.reference ?? null });
    }
    const assembledBindingsText = canonicalJson(bindings);
    const projection = projectPrincipalAssociations({ ...options, bindingsText: assembledBindingsText });
    if (!eq(projection.native_references, n)) fail("SOURCE_CHANGED");
    const source = sourceOf(projection), emissions = emissionsOf(projection), payloadKeys = new Set();
    // Preflight the bounded export before any archive effect. Original v3 projection remains unchanged.
    parseAssociationJson(canonicalJson({ source, association: projection, emissions }));
    for (const p of request.payloads) {
      const revision = resultRef(p.result, effects.native_write), rows = emissions.filter(r => r.binding_id === p.binding_id && r.check_id === p.check_id && eq(r.revision, revision));
      const key = canonicalJson([p.binding_id, p.check_id, revision, p.channel]);
      if (rows.length !== 1 || payloadKeys.has(key)) fail("PAYLOAD_SELECTION_MISMATCH"); payloadKeys.add(key);
      const row = rows[0];
      if (row.state !== "emitted") { row.payloads[p.channel] = { state: "unbound", reason: "work-link-unbound" }; continue; }
      if (!permitted(p, row, sourcePermissions)) { row.payloads[p.channel] = { state: "unbound", reason: "source-permission-missing" }; continue; }
      if (!archivePort) { row.payloads[p.channel] = { state: "unbound", reason: "archive-port-missing" }; continue; }
      if (archivePort.version !== "principal-check-payload-port-v1" || typeof archivePort.retain !== "function" || typeof archivePort.read !== "function") fail("ARCHIVE_PORT_INVALID");
      let bytes;
      try { bytes = readPayload(p.path, p.byte_length); } catch (error) { if (error.code !== "ENOENT") throw error; row.payloads[p.channel] = { state: "missing", reason: "source-unavailable" }; continue; }
      if (byteDigest(bytes) !== p.sha256) fail("SOURCE_DIGEST_MISMATCH");
      const origin = payloadOrigin(row, p.channel), effect = { state: "unacknowledged", origin_sha256: digest(origin), receipt: null }; effects.archives.push(effect);
      const receipt = parseAssociationJson(canonicalJson(await archivePort.retain({ bytes: Buffer.from(bytes), sha256: p.sha256, origin: structuredClone(origin) })));
      if (receiptShape(receipt)) effect.receipt = structuredClone(receipt);
      if (!receiptShape(receipt) || receipt.sha256 !== p.sha256 || receipt.byte_length !== p.byte_length || receipt.origin_sha256 !== digest(origin)) fail("ARCHIVE_RECEIPT_MISMATCH");
      const readback = await archivePort.read(structuredClone(receipt), { max_bytes: p.byte_length });
      if (!readback || !eq(parseAssociationJson(canonicalJson(readback.receipt)), receipt) || !(readback.bytes instanceof Uint8Array)) fail("ARCHIVE_READBACK_MISMATCH");
      const observedBytes = Buffer.from(readback.bytes);
      if (observedBytes.length !== p.byte_length || !observedBytes.equals(bytes)) fail("ARCHIVE_READBACK_MISMATCH");
      effect.state = "readback-verified";
      row.payloads[p.channel] = { state: "retained", permission_id: p.permission_id, sha256: p.sha256, byte_length: p.byte_length, origin, receipt: effect.receipt, readback_sha256: byteDigest(observedBytes) };
    }
    if (!eq(sourceOf(projectPrincipalAssociations({ ...options, bindingsText: assembledBindingsText })), source)) fail("SOURCE_CHANGED");
    const body = { version: VERSION, authority: "declared-not-authenticated", acceptance: "not-assessed", source, association: projection, emissions };
    const envelope = { ...body, digest: digest(body) };
    consumePrincipalLifecycle(canonicalJson(envelope), { digest: envelope.digest, source });
    return { version: "principal-host-assembly-v1", acceptance: "not-assessed", request_sha256: digest(request), base_bindings_sha256: digest(bindingsText),
      native_write: effects.native_write, archives: effects.archives, assembled_bindings: bindings, envelope };
  } catch (error) {
    const failure = new Error(/^HOST_[A-Z_]+$/.test(error.message) ? error.message : "HOST_ASSEMBLY_FAILED", { cause: error });
    failure.effects = effects; throw failure;
  }
}
export async function runHostAssemblyCli(args, { out = console.log, err = console.error, archivePort, sourcePermissions } = {}) {
  try {
    const allowed = ["--state-dir", "--run-id", "--daily-view", "--bindings", "--work-context", "--request"], flags = new Map();
    for (let i = 0; i < args.length; i += 2) {
      if (!allowed.includes(args[i]) || flags.has(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) fail("CLI_INVALID"); flags.set(args[i], args[i + 1]);
    }
    if (!["--state-dir", "--run-id", "--daily-view", "--bindings", "--request"].every(k => flags.has(k))) fail("CLI_INVALID");
    const read = flag => readBoundedAssuranceText(flags.get(flag), 4 * MAX_PAYLOAD);
    out(JSON.stringify(await assemblePrincipalHost({ stateDir: flags.get("--state-dir"), runId: flags.get("--run-id"), dailyViewText: read("--daily-view"), bindingsText: read("--bindings"),
      workContextText: flags.has("--work-context") ? read("--work-context") : undefined, request: parseAssociationJson(read("--request")), archivePort, sourcePermissions }), null, 2));
    return 0;
  } catch (error) { err(JSON.stringify({ error: /^HOST_[A-Z_]+$/.test(error.message) ? error.message : "HOST_INPUT_UNREADABLE", effects: error.effects ?? null, acceptance: "not-assessed" })); return 1; }
}

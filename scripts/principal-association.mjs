#!/usr/bin/env node
/** Named Principal host adapter. Structural association only; never an authority or launch API. */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { appendPrincipalNativeReference, readPrincipalNativeReferences, validPrincipalReference, referenceOf } from "./principal-native-references.mjs";
export { appendPrincipalNativeReference } from "./principal-native-references.mjs";
import { runHostAssemblyCli } from "./principal-host-assembly.mjs";
export { assemblePrincipalHost, consumePrincipalLifecycle } from "./principal-host-assembly.mjs";
import { AssuranceStore, buildCurrentApplicabilityProjection, canonicalJson, digest, readBoundedAssuranceText } from "./assurance-state.mjs";

const INPUT_BYTES = 4 * 1024 * 1024;
const invalid = (code = "ASSOCIATION_INPUT_INVALID") => { throw new Error(code); };
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v, max = 512) => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const sha256 = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const gitId = (v) => typeof v === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const keys = (v, required, optional = []) => object(v) && required.every((key) => Object.hasOwn(v, key)) &&
  Object.keys(v).every((key) => [...required, ...optional].includes(key));
const list = (v, predicate = text, max = 4096) => Array.isArray(v) && v.length <= max && v.every((item) => predicate(item));
const unique = (v) => new Set(v.map((item) => canonicalJson(item))).size === v.length;

/** Bounded strict integer-token JSON subset. Reject duplicates before JSON.parse can erase them. */
export function parseAssociationJson(input) {
  if (typeof input !== "string" || Buffer.byteLength(input) > INPUT_BYTES) invalid();
  let at = 0, nodes = 0;
  const ws = () => { while (/[ \t\r\n]/.test(input[at] ?? "x")) at++; };
  const string = () => {
    const start = at++;
    while (at < input.length) {
      if (input[at] === "\\") { at += 2; continue; }
      if (input[at++] === '"') {
        let value;
        try { value = JSON.parse(input.slice(start, at)); } catch { invalid(); }
        if (value.length > 8192) invalid();
        return value;
      }
    }
    invalid();
  };
  const value = (depth) => {
    if (depth > 24 || ++nodes > 65536) invalid();
    ws();
    if (input[at] === '"') { string(); return; }
    if (input[at] === "{" || input[at] === "[") {
      const isObject = input[at++] === "{", end = isObject ? "}" : "]", seen = new Set();
      let count = 0;
      ws();
      if (input[at] === end) { at++; return; }
      while (at < input.length) {
        if (++count > (isObject ? 128 : 4096)) invalid();
        ws();
        if (isObject) {
          if (input[at] !== '"') invalid();
          const key = string();
          if (seen.has(key) || ["__proto__", "constructor", "prototype"].includes(key)) invalid();
          seen.add(key); ws();
          if (input[at++] !== ":") invalid();
        }
        value(depth + 1); ws();
        if (input[at] === end) { at++; return; }
        if (input[at++] !== ",") invalid();
      }
      invalid();
    }
    const token = /(?:true|false|null|-?(?:0|[1-9][0-9]*))/y;
    token.lastIndex = at;
    const match = token.exec(input);
    if (!match) invalid();
    at = token.lastIndex;
    if (/^-?[0-9]/.test(match[0]) && (!Number.isSafeInteger(Number(match[0])) || match[0] === "-0")) invalid();
  };
  value(0); ws();
  if (at !== input.length) invalid();
  try { return JSON.parse(input); } catch { invalid(); }
}

function revision(v, kind) {
  return keys(v, ["kind", "id", "revision", "digest"]) && text(v.id) && sha256(v.digest) &&
    Number.isSafeInteger(v.revision) && v.revision > 0 &&
    (kind ? v.kind === kind : ["scope", "goal", "node", "obligation", "artifact", "policy"].includes(v.kind));
}
function selection(v) {
  return keys(v, ["snapshot", "event"]) && keys(v.snapshot, ["id", "digest"]) && text(v.snapshot.id) && sha256(v.snapshot.digest) &&
    keys(v.event, ["eventId", "digest"]) && text(v.event.eventId) && sha256(v.event.digest);
}
function declarations(input) {
  if (!keys(input, ["version", "bindings"]) || !["principal-host-bindings-v1", "principal-host-bindings-v2", "principal-host-bindings-v3"].includes(input.version) || !list(input.bindings, object, 256)) invalid();
  const keyed = input.version !== "principal-host-bindings-v1", references = input.version === "principal-host-bindings-v3";
  for (const b of input.bindings) {
    if (!keys(b, ["binding_id", "native", "generic"], ["execution_ids", ...(references ? ["reference_links"] : [])]) || !text(b.binding_id, 128) ||
        !keys(b.native, ["run_id", "task_id", "workspace_id", "candidate"]) ||
        ![b.native.run_id, b.native.workspace_id].every((id) => text(id, 128)) ||
        (!(references && b.native.task_id === null) && !text(b.native.task_id, 128)) ||
        !keys(b.native.candidate, ["head_sha", "tree_sha"]) || !gitId(b.native.candidate.head_sha) || !gitId(b.native.candidate.tree_sha) ||
        !keys(b.generic, ["selectedSnapshot", "scope", "obligation", ...(keyed ? ["binding_key"] : [])]) ||
        (keyed && !text(b.generic.binding_key, 8192)) || !selection(b.generic.selectedSnapshot) ||
        !revision(b.generic.scope, "scope") || !revision(b.generic.obligation, "obligation") ||
        (b.execution_ids !== undefined && (!list(b.execution_ids, text, 256) || !unique(b.execution_ids)))) invalid();
    if (references && b.reference_links !== undefined && (!list(b.reference_links, referenceLinkShape, 256) || !unique(b.reference_links))) invalid();
  }
  return input.bindings;
}

/** Consumed reference fields only, pinned to P04 DailyView/RevisionRef; NOT full producer schema parity. */
function dailyReferences(v, keyed) {
  if (!object(v) || v.version !== "pi-daddy-daily-view-v1" || v.readOnly !== true || v.freshness !== "snapshot-unknown" ||
      v.coverage !== "partial" || (v.selectedSnapshot !== null && !selection(v.selectedSnapshot)) ||
      (v.scope !== null && !revision(v.scope, "scope")) || !text(v.scopeState) ||
      (v.authority !== undefined && !["supplied-host-context", "unavailable", "stale-for-selection"].includes(v.authority)) ||
      !list(v.obligations, object) || !list(v.attempts, object) || !object(v.sources) ||
      ![v.sources.work, v.sources.archive].every((s) => text(s)) ||
      ![v.sources.workSha256, v.sources.archiveSha256].every((s) => s === null || sha256(s))) invalid();
  const attempts = new Map(), obligations = new Map();
  for (const a of v.attempts) {
    if (!text(a.executionId) || a.activeBranch !== null) invalid();
    if (attempts.has(a.executionId)) invalid("GENERIC_REFERENCE_CONFLICT");
    if (a.archive !== null) {
      if (!object(a.archive) || a.archive.activeBranch !== null || a.archive.coverage !== "partial" ||
          a.archive.acceptance !== "not-assessed" || !list(a.archive.sourceReferences, sha256) || !unique(a.archive.sourceReferences)) invalid();
      if (a.archive.executionId !== a.executionId) invalid("GENERIC_REFERENCE_CONFLICT");
    }
    attempts.set(a.executionId, a);
  }
  for (const o of v.obligations) {
    if (!text(o.key, 8192) || !revision(o.obligation, "obligation") || !revision(o.intent) || !revision(o.policy, "policy") ||
        !list(o.attempts, text) || !unique(o.attempts) ||
        (keyed && (!list(o.receiptIds, text) || !list(o.claimReferences, text)))) invalid();
    // v1 keeps its original revision-only ambiguity rejection. v2 compares the
    // producer's opaque key exactly, without parsing, canonicalizing or hashing it.
    const key = keyed ? o.key : canonicalJson(o.obligation);
    if (obligations.has(key) || o.attempts.some((id) => !attempts.has(id))) invalid("GENERIC_REFERENCE_CONFLICT");
    obligations.set(key, o);
  }
  return { attempts, obligations };
}

function eventRef(v) { return keys(v, ["eventId", "digest"]) && text(v.eventId) && sha256(v.digest); }
function identity(v) { return keys(v, ["id", "digest"]) && text(v.id) && sha256(v.digest); }
function evidenceRef(v) { return keys(v, ["id", "digest", "event"]) && text(v.id) && sha256(v.digest) && (v.event === null || eventRef(v.event)); }
function referenceLinkShape(l) {
  return keys(l, ["check_id", "native_check", "native_context", "finalization", "retirement", "generic_receipt_id", "generic_claim", "generic_artifact", "generic_artifact_digest", "generic_evidence"]) &&
    text(l.check_id, 128) && validPrincipalReference(l.native_check) && validPrincipalReference(l.native_context) &&
    [l.finalization, l.retirement].every(r => r === null || validPrincipalReference(r)) && text(l.generic_receipt_id) &&
    eventRef(l.generic_claim) && revision(l.generic_artifact, "artifact") && sha256(l.generic_artifact_digest) && evidenceRef(l.generic_evidence);
}
// Consumed fields of pinned P01 WorkProjectionContext; structural declarations are NOT authentication.
function validateWorkContext(c) {
  if (!keys(c, ["selectedSnapshot", "authority"]) || (c.selectedSnapshot !== null && !selection(c.selectedSnapshot))) invalid();
  if (c.authority === null) return;
  const a = c.authority;
  if (!keys(a, ["snapshot", "decisions", "availability"]) || !identity(a.snapshot) || !list(a.decisions, object, 256) || !list(a.availability, object)) invalid();
  for (const d of a.decisions) {
    const b = d.binding;
    if (!keys(d, ["receiptId", "authorityId", "claim", "binding", "decision"]) || !text(d.receiptId) || !text(d.authorityId) || !eventRef(d.claim) ||
        !["accept", "reject"].includes(d.decision) || !keys(b, ["snapshot", "scope", "intent", "obligation", "artifact", "artifactDigest", "policy", "evidence"]) ||
        !identity(b.snapshot) || !revision(b.scope, "scope") || !revision(b.intent) || !revision(b.obligation, "obligation") ||
        !revision(b.artifact, "artifact") || !revision(b.policy, "policy") || !sha256(b.artifactDigest) ||
        !list(b.evidence, evidenceRef)) invalid();
  }
  for (const a of c.authority.availability) if (!keys(a, ["kind", "id", "digest", "available"]) || !["artifact", "evidence"].includes(a.kind) || !text(a.id) || !sha256(a.digest) || typeof a.available !== "boolean") invalid();
}
function resolveReferenceLink(l, binding, obligation, catalog, workContext, associationStatus) {
  const errors = [];
  const entry = catalog.entries.find(e => same(referenceOf(e), l.native_check));
  const check = catalog.checks.find(c => c.check_id === l.check_id);
  if (associationStatus !== "bound") errors.push("work-association-not-current");
  if (!entry || entry.record.type !== "check-result" || entry.record.check_id !== l.check_id || !check || check.task_id !== binding.native.task_id || check.workspace_id !== binding.native.workspace_id) errors.push("native-check-reference-mismatch");
  if (entry?.record.type === "check-result" && !same(entry.record.context, l.native_context)) errors.push("native-context-reference-mismatch");
  const retirement = l.retirement === null ? null : catalog.entries.find(e => same(referenceOf(e), l.retirement));
  if (l.retirement && (!retirement || retirement.record.type !== "check-retired" || retirement.record.check_id !== l.check_id || !same(retirement.record.previous, l.native_check))) errors.push("native-retirement-reference-mismatch");
  const finalization = l.finalization === null ? null : catalog.finalizations.find(e => same(e.reference, l.finalization));
  if (l.finalization && (!finalization || !finalization.record.checks.some(r => same(r, l.native_check)))) errors.push("native-finalization-reference-mismatch");
  const decisions = workContext?.authority?.decisions.filter(d => d.receiptId === l.generic_receipt_id) ?? [];
  const decision = decisions.length === 1 ? decisions[0] : null;
  if (workContext?.authority) {
    if (!same(workContext.selectedSnapshot, binding.generic.selectedSnapshot) || decisions.length !== 1) errors.push("generic-receipt-context-mismatch");
    if (decision) {
      const b = decision.binding;
      // P04 explicitly serializes this existing P01 tuple as key. No native Git/hash-domain equivalence.
      const bindingKey = canonicalJson({ artifact: b.artifact, intent: b.intent, obligation: b.obligation, policy: b.policy });
      if (!same(decision.claim, l.generic_claim) || !obligation?.receiptIds.includes(decision.receiptId) ||
          !obligation?.claimReferences.includes(`${decision.claim.eventId}:${decision.claim.digest}`) ||
          !same(b.snapshot, binding.generic.selectedSnapshot.snapshot) || !same(b.scope, binding.generic.scope) ||
          !same(b.obligation, binding.generic.obligation) || !same(b.intent, obligation.intent) || !same(b.policy, obligation.policy) || !same(b.artifact, l.generic_artifact) ||
          b.artifactDigest !== l.generic_artifact_digest || bindingKey !== binding.generic.binding_key ||
          b.evidence.filter(e => e.id === l.generic_evidence.id).length !== 1 || !b.evidence.some(e => same(e, l.generic_evidence))) errors.push("generic-receipt-binding-mismatch");
    }
  }
  if (errors.length) return { declaration: l, status: "error", issues: errors, acceptance: "not-assessed" };
  if (!decision) return { declaration: l, status: "unbound", issues: ["independent-work-context-missing"], acceptance: "not-assessed" };
  if (check.retirement && same(check.current, l.native_check) && l.retirement === null) return {
    declaration: l, status: "unbound", issues: ["explicit-retirement-reference-required"], acceptance: "not-assessed" };
  const source = r => r === null ? null : catalog.sources.find(s => same(s.reference, r));
  return { declaration: l, status: !same(check.current, l.native_check) ? "superseded" : check.applicability,
    acceptance: "not-assessed", relation: "explicit-reference-link-not-semantic-equivalence",
    native: { check: { reference: l.native_check, record: entry.record }, task: source(entry.record.task),
      context: source(entry.record.context), candidate: source(entry.record.candidate), evidence: source(entry.record.evidence),
      retirement: retirement ? { reference: l.retirement, record: retirement.record } : null, finalization },
    generic: { selectedSnapshot: binding.generic.selectedSnapshot, binding_key: binding.generic.binding_key,
      receipt_id: decision.receiptId, authority_id: decision.authorityId, authority_snapshot: workContext.authority.snapshot,
      claim: decision.claim, binding: decision.binding, evidence: l.generic_evidence, decision_claim: decision.decision },
    generic_retirement: "unbound", issues: ["generic-individual-check-retirement-contract-not-supplied"] };
}

/** Existing authoritative replay/current-v1 seam; no snapshot trust, gate command, append or dispatch. */
export function projectPrincipalAssociations({ stateDir, runId, dailyViewText, bindingsText, workContextText }) {
  if (!text(stateDir, 4096) || !text(runId, 128)) invalid();
  const daily = parseAssociationJson(dailyViewText);
  const declaration = bindingsText === undefined ? { version: "principal-host-bindings-v1", bindings: [] } : parseAssociationJson(bindingsText);
  const bindings = declarations(declaration), keyed = declaration.version !== "principal-host-bindings-v1";
  const references = declaration.version === "principal-host-bindings-v3";
  if (!references && workContextText !== undefined) invalid();
  const workContext = workContextText === undefined ? null : parseAssociationJson(workContextText);
  if (workContext !== null) validateWorkContext(workContext);
  const refs = dailyReferences(daily, keyed);
  const store = new AssuranceStore({ baseDir: stateDir });
  let state, nativeReferences = null;
  try {
    if (references) { const loaded = readPrincipalNativeReferences({ stateDir, runId }); state = loaded.state; nativeReferences = loaded.catalog; }
    else state = store.load(runId, { maxBytes: 16 * 1024 * 1024, maxEvents: 10000 });
  } catch (error) {
    if (/^REFERENCE_[A-Z_]+$/.test(error.message) && error.message !== "REFERENCE_NATIVE_SNAPSHOT_CHANGED") throw error;
    invalid("native-ledger-invalid");
  }
  const applicability = buildCurrentApplicabilityProjection(state);
  const taskById = new Map(applicability.tasks.map((task) => [task.task_id, task]));
  const ids = new Map();
  for (const b of bindings) ids.set(b.binding_id, (ids.get(b.binding_id) ?? 0) + 1);
  const associations = bindings.map((b) => {
    const issues = [], task = taskById.get(b.native.task_id);
    if (ids.get(b.binding_id) !== 1) issues.push("binding-id-conflict");
    if (b.native.run_id !== state.run_id) issues.push("native-run-mismatch");
    if (!task && !(references && b.native.task_id === null)) issues.push("native-task-unknown");
    if (task) {
      if (task.applicability === "superseded") issues.push("native-task-superseded");
      if (task.applicability === "stale") issues.push("native-task-stale");
      if (task.workspace_id !== b.native.workspace_id) issues.push("native-workspace-mismatch");
    }
    if (state.active_workspace_id !== b.native.workspace_id || !Object.hasOwn(state.workspaces, b.native.workspace_id)) issues.push("native-workspace-mismatch");
    if (!same(b.native.candidate, applicability.candidate)) issues.push("native-candidate-mismatch");
    if (!same(b.generic.selectedSnapshot, daily.selectedSnapshot)) issues.push("generic-snapshot-mismatch");
    if (!same(b.generic.scope, daily.scope)) issues.push("generic-scope-mismatch");
    if (daily.scopeState !== "valid" || daily.sources.work !== "read") issues.push("generic-scope-unavailable");
    const obligation = refs.obligations.get(keyed ? b.generic.binding_key : canonicalJson(b.generic.obligation));
    if (!obligation) issues.push(keyed ? "generic-binding-key-unknown" : "generic-obligation-unknown");
    else if (keyed && !same(obligation.obligation, b.generic.obligation)) issues.push("generic-binding-revision-mismatch");
    for (const id of b.execution_ids ?? []) {
      if (!refs.attempts.has(id)) issues.push("execution-unknown");
      else if (!obligation?.attempts.includes(id)) issues.push("execution-target-mismatch");
    }
    const conflict = issues.some((issue) => !["native-task-stale", "native-task-superseded"].includes(issue));
    const status = conflict ? "conflict" : issues.length ? "inapplicable" : "bound";
    return {
      binding_id: b.binding_id, native: b.native, generic: b.generic, execution_ids: b.execution_ids ?? [],
      status, issues: [...new Set(issues)].sort(),
      ...(keyed ? { reference_context: status === "bound" ? {
        // Co-locate existing references under the explicit task/work association;
        // neither input supplies an identity joining an individual check or retirement.
        native: { evidence_seqs: applicability.receipts.filter((r) => r.task_id === b.native.task_id).map((r) => r.seq) },
        generic: { receiptIds: obligation.receiptIds, claimReferences: obligation.claimReferences },
        check_equivalence: "unbound", retirement_equivalence: "unbound",
      } : null } : {}),
      ...(references ? { reference_links: (b.reference_links ?? []).map(l => resolveReferenceLink(l, b, obligation, nativeReferences, workContext, status)) } : {}),
    };
  });
  const bound = associations.filter((a) => a.status === "bound");
  return {
    version: references ? "principal-work-associations-v3" : keyed ? "principal-work-associations-v2" : "principal-work-associations-v1", readOnly: true,
    notice: "Structural Principal host declarations only; not authenticated approval, a fresh gate, accepted work, or execution authorization.",
    authority: "unauthenticated-host-declarations", acceptance: "not-assessed", coverage: "partial", freshness: "snapshot-unknown",
    native: { ledger: applicability.ledger, applicability },
    generic: {
      version: daily.version, selectedSnapshot: daily.selectedSnapshot, scope: daily.scope,
      authority_claim: daily.authority ?? null,
      sources: { work: daily.sources.work, archive: daily.sources.archive, workSha256: daily.sources.workSha256, archiveSha256: daily.sources.archiveSha256 },
      input_sha256: digest(dailyViewText), validation_scope: "pinned P04 consumed reference fields only; not producer schema parity or P01 authentication",
    },
    declarations_sha256: bindingsText === undefined ? null : digest(bindingsText),
    ...(references ? { native_references: nativeReferences, work_context_sha256: workContextText === undefined ? null : digest(workContextText) } : {}),
    associations,
    tasks: applicability.tasks.map((task) => {
      const associated = bound.filter((a) => a.native.task_id === task.task_id).map((a) => a.binding_id);
      return { task_id: task.task_id, status: associated.length ? "bound" : "unbound", association_ids: associated };
    }),
    // One row per existing generic execution, even when shared by multiple work associations.
    executions: [...refs.attempts.values()].map((attempt) => ({
      execution_id: attempt.executionId, active_branch: null,
      generic_source_references: attempt.archive?.sourceReferences ?? [],
      association_ids: bound.filter((a) => a.execution_ids.includes(attempt.executionId)).map((a) => a.binding_id),
    })),
  };
}

/** Local host-integration entry point; paths are supplied by the caller, never discovered from a view. */
export function runAssociationCli(args, { out = console.log, err = console.error, archivePort, sourcePermissions } = {}) {
  try {
    if (args[0] === "assemble-host") return runHostAssemblyCli(args.slice(1), { out, err, archivePort, sourcePermissions });
    const writing = args[0] === "record-native-reference";
    const options = writing ? args.slice(1) : args;
    const allowed = writing ? ["--state-dir", "--run-id", "--record", "--expected-head"] : ["--state-dir", "--run-id", "--daily-view", "--bindings", "--work-context"];
    const flags = new Map();
    for (let i = 0; i < options.length; i += 2) {
      if (!allowed.includes(options[i]) || flags.has(options[i]) || !options[i + 1] || options[i + 1].startsWith("--")) invalid();
      flags.set(options[i], options[i + 1]);
    }
    if (writing) {
      if (!allowed.every(key => flags.has(key))) invalid();
      out(JSON.stringify(appendPrincipalNativeReference({ stateDir: flags.get("--state-dir"), runId: flags.get("--run-id"),
        expectedHead: flags.get("--expected-head") === "none" ? null : flags.get("--expected-head"),
        record: parseAssociationJson(readBoundedAssuranceText(flags.get("--record"), INPUT_BYTES)) }), null, 2));
      return 0;
    }
    if (!["--state-dir", "--run-id", "--daily-view"].every((key) => flags.has(key))) invalid();
    const result = projectPrincipalAssociations({
      stateDir: flags.get("--state-dir"), runId: flags.get("--run-id"),
      dailyViewText: readBoundedAssuranceText(flags.get("--daily-view"), INPUT_BYTES),
      ...(flags.has("--bindings") ? { bindingsText: readBoundedAssuranceText(flags.get("--bindings"), INPUT_BYTES) } : {}),
      ...(flags.has("--work-context") ? { workContextText: readBoundedAssuranceText(flags.get("--work-context"), INPUT_BYTES) } : {}),
    });
    out(JSON.stringify(result, null, 2));
    return 0; // Conflict/inapplicability is data, not permission to execute.
  } catch (error) {
    err(["ASSOCIATION_INPUT_INVALID", "GENERIC_REFERENCE_CONFLICT", "native-ledger-invalid"].includes(error.message) || /^REFERENCE_[A-Z_]+$/.test(error.message) ? error.message : "association-input-unreadable");
    return 1;
  }
}
let direct = false;
try { direct = Boolean(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { /* imported */ }
if (direct) process.exitCode = await runAssociationCli(process.argv.slice(2));

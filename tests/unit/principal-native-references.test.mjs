import test from "node:test";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssuranceStore, canonicalJson, digest } from "../../scripts/assurance-state.mjs";
import * as adapter from "../../scripts/principal-association.mjs";
import { readPrincipalNativeReferences } from "../../scripts/principal-native-references.mjs";
import Ajv2020 from "ajv/dist/2020.js";
const root = fileURLToPath(new URL("../../", import.meta.url));
const fixtureRoot = join(root, "tests/fixtures/principal-association");
const daily = JSON.parse(readFileSync(join(fixtureRoot, "p04/view.json"), "utf8"));
const workEvents = readFileSync(join(fixtureRoot, "p04/work.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
// Reconstruct the published dailyAuthority test world, NOT production authority from incoming claims.
function workContext() {
  const claims = workEvents.filter(e => e.event === "work_acceptance");
  return { selectedSnapshot: structuredClone(daily.selectedSnapshot), authority: {
    snapshot: { id: "independent-authority-fixture", digest: "9".repeat(64) },
    decisions: claims.map((e, i) => ({ receiptId: `fixed-receipt-${i + 1}`, authorityId: e.payload.authorityId,
      claim: { eventId: e.eventId, digest: e.digest }, binding: structuredClone(e.payload.binding), decision: "accept" })),
    availability: [],
  } };
}
const ref = e => ({ seq: e.seq, digest: e.event_digest });
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "principal-spec006-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const runId = "association-fixture", store = new AssuranceStore({ baseDir: dir, now: () => "2026-09-08T12:00:00.000Z" });
  const head = "a".repeat(40), tree = "b".repeat(40), plan = "c".repeat(64), definition = "d".repeat(64);
  store.init({ runId, workflow: "feature", request: "Implement fixture", definitionDigests: { "skill:build": definition } });
  const append = (type, payload = {}) => { store.append(runId, { type, ...payload }); return store.load(runId, { withEvents: true }).events.at(-1); };
  append("workspace_attached", { workspace_id: "ws-1", path: "/fixture", mode: "caller", writer: "build" });
  append("risk_classified", { level: "tiny", reason: "ordinary fixture" });
  append("plan_recorded", { plan_digest: plan });
  const task = append("task_packet_recorded", { packet: {
    schema_version: "1.0", run_id: runId, task_id: "task-1", title: "Reference fixture", authority: ["test-world"],
    global_constraints: ["no acceptance"], out_of_scope: ["deployment"], critical_scope: { applies: false, matched_by: [] },
    files: ["scripts/assurance-state.mjs"], dependencies: [], done_command: "node check.mjs", review_risk: "identity",
    workspace_id: "ws-1", plan_digest: plan, definition_digests: { "skill:build": definition },
  } });
  const context = append("phase_started", { phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: definition });
  const candidate = append("code_changed", { task_id: "task-1", head_sha: head, tree_sha: tree, changed_paths: ["scripts/assurance-state.mjs"] });
  append("phase_completed", { phase: "build" });
  const evidence = (exit_code, command = "node check.mjs") => append("evidence_recorded", {
    kind: "exact-target", command, exit_code, head_sha: head, tree_sha: tree, task_id: "task-1", workspace_id: "ws-1",
  });
  const first = evidence(1);
  const raw = event => readFileSync(store.paths(runId).log, "utf8").match(/[^\n]+(?:\n|$)/g)[event.seq - 1];
  const proposal = (event = first, check_id = "required-A", corrects = null) => ({
    type: "check-result", check_id, task: ref(task), context: ref(context), candidate: ref(candidate),
    evidence: ref(event), evidence_sha256: digest(raw(event)), corrects, author: "fixture-reference-writer",
  });
  let expectedHead = null;
  const record = proposal => {
    assert.equal(typeof adapter.appendPrincipalNativeReference, "function", "native producer must be public and connected");
    const receipt = adapter.appendPrincipalNativeReference({ stateDir: dir, runId, expectedHead, record: proposal });
    expectedHead = receipt.reference.digest;
    return receipt;
  };
  const bindings = receipt => {
    const input = JSON.parse(readFileSync(join(fixtureRoot, "host-bindings.json"), "utf8"));
    input.version = "principal-host-bindings-v3";
    input.bindings[0].generic.binding_key = daily.obligations[0].key;
    input.bindings[0].reference_links = receipt ? [{
      check_id: "required-A", native_check: structuredClone(receipt.reference), native_context: ref(context), finalization: null, retirement: null,
      generic_receipt_id: "fixed-receipt-1", generic_claim: workContext().authority.decisions[0].claim,
      generic_artifact: workContext().authority.decisions[0].binding.artifact,
      generic_artifact_digest: workContext().authority.decisions[0].binding.artifactDigest,
      generic_evidence: workContext().authority.decisions[0].binding.evidence[0],
    }] : [];
    return input;
  };
  const project = (input, ctx = workContext()) => adapter.projectPrincipalAssociations({ stateDir: dir, runId,
    dailyViewText: JSON.stringify(daily), bindingsText: JSON.stringify(input), workContextText: ctx === null ? undefined : JSON.stringify(ctx) });
  return { dir, runId, store, append, task, context, candidate, first, evidence, raw, proposal, record, bindings, project,
    get expectedHead() { return expectedHead; } };
}

test("SPEC006 native record schema and pinned generic source bytes describe the consumed contracts", (t) => {
  const f = fixture(t), validate = new Ajv2020().compile(JSON.parse(readFileSync(join(root, "contracts/principal-native-references/v1/record.schema.json"), "utf8")));
  const record = f.proposal();
  assert.equal(validate(record), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...record, generic_check_id: "invented" }), false);
  assert.equal(digest(readFileSync(join(fixtureRoot, "p04/work.jsonl"), "utf8")), daily.sources.workSha256);
  const retirement = { type: "check-retired", check_id: "required-A", previous: { seq: 1, digest: "a".repeat(64) }, reason: "fixture", author: "fixture" };
  assert.equal(validate(retirement), true);
  assert.equal(validate({ type: "finalization-linked", native_finalization: retirement.previous, checks: [retirement.previous], author: "fixture" }), true);
});

test("SPEC006 run-scoped checks require explicit null task scope and real workspace/candidate/context references", (t) => {
  const f = fixture(t);
  const context = f.append("phase_started", { phase: "review", task_id: null, workspace_id: "ws-1", definition_digest: "d".repeat(64) });
  const candidate = f.append("code_changed", { task_id: null, head_sha: "a".repeat(40), tree_sha: "b".repeat(40), changed_paths: ["scripts/assurance-state.mjs"] });
  const evidence = f.append("evidence_recorded", { kind: "exact-target", task_id: null, workspace_id: "ws-1", head_sha: "a".repeat(40), tree_sha: "b".repeat(40), command: "node run-check.mjs", exit_code: 0 });
  f.append("phase_completed", { phase: "review" });
  const record = f.proposal(evidence); record.task = null; record.context = ref(context); record.candidate = ref(candidate);
  const receipt = f.record(record), input = f.bindings(receipt);
  input.bindings[0].native.task_id = null; input.bindings[0].reference_links[0].native_context = ref(context);
  const link = f.project(input).associations[0].reference_links[0];
  assert.equal(link.status, "current"); assert.equal(link.native.task, null);
  const wrong = f.bindings(receipt); wrong.bindings[0].reference_links[0].native_context = ref(context);
  assert.equal(f.project(wrong).associations[0].reference_links[0].status, "error", "run evidence cannot silently become task evidence");
});

test("SPEC006 native producer records exact check/context/candidate bytes and v3 links actual P01 decision bindings", (t) => {
  const f = fixture(t), receipt = f.record(f.proposal()), p = f.project(f.bindings(receipt));
  assert.equal(p.version, "principal-work-associations-v3");
  assert.equal(receipt.readback_sha256, digest(readFileSync(join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl"), "utf8")));
  const link = p.associations[0].reference_links[0];
  assert.equal(link.status, "current");
  assert.equal(link.acceptance, "not-assessed");
  assert.equal(link.native.evidence.raw, f.raw(f.first));
  assert.equal(link.native.evidence.event.exit_code, 1, "failed runtime cannot become approval");
  assert.deepEqual(link.native.context.reference, ref(f.context));
  assert.deepEqual(link.generic.claim, workContext().authority.decisions[0].claim);
  assert.deepEqual(link.generic.evidence, workContext().authority.decisions[0].binding.evidence[0]);
  assert.equal(link.generic.authority_snapshot.id, "independent-authority-fixture", "unrelated snapshot namespaces stay separate");
  assert.equal(link.generic_retirement, "unbound");
});

test("SPEC006 corrections and retirement retain earlier check bytes without command-equivalence inference", (t) => {
  const f = fixture(t), red = f.record(f.proposal()), first = f.project(f.bindings(red)).associations[0].reference_links[0];
  const other = f.record(f.proposal(f.first, "required-B"));
  const greenEvent = f.evidence(0, "node renamed-command.mjs");
  const green = f.record(f.proposal(greenEvent, "required-A", red.reference));
  const old = f.project(f.bindings(red)).associations[0].reference_links[0];
  assert.equal(old.status, "superseded");
  assert.equal(old.native.evidence.raw, first.native.evidence.raw);
  assert.equal(f.project(f.bindings(green)).associations[0].reference_links[0].status, "current");
  const wrong = f.bindings(other); assert.equal(f.project(wrong).associations[0].reference_links[0].status, "error");
  const retirement = f.record({ type: "check-retired", check_id: "required-A", previous: green.reference,
    reason: "explicit fixture requirement withdrawal", author: "fixture-reference-writer" });
  const retired = f.bindings(green); retired.bindings[0].reference_links[0].retirement = retirement.reference;
  const p = f.project(retired);
  assert.equal(p.associations[0].reference_links[0].status, "retired");
  assert.equal(p.associations[0].reference_links[0].native.retirement.record.reason, "explicit fixture requirement withdrawal");
  assert.equal(p.native_references.checks.find(c => c.check_id === "required-B").applicability, "current");
  assert.throws(() => f.record(f.proposal(f.evidence(0), "required-A", green.reference)), /REFERENCE/);
});

test("SPEC006 missing, forged, wrong-context, wrong-check, wrong-receipt and stale references never link", (t) => {
  const f = fixture(t), receipt = f.record(f.proposal());
  const changes = [
    b => { b.reference_links[0].native_check.digest = "f".repeat(64); },
    b => { b.reference_links[0].native_context = ref(f.candidate); },
    b => { b.reference_links[0].check_id = "other-check"; },
    b => { b.reference_links[0].generic_receipt_id = "fixed-receipt-2"; },
    b => { b.reference_links[0].generic_claim.digest = "f".repeat(64); },
    b => { b.reference_links[0].generic_artifact_digest = "f".repeat(64); },
    b => { b.reference_links[0].generic_evidence.id = "wrong-evidence"; },
  ];
  for (const change of changes) { const input = f.bindings(receipt); change(input.bindings[0]);
    assert.equal(f.project(input).associations[0].reference_links[0].status, "error"); }
  assert.equal(f.project(f.bindings(receipt), null).associations[0].reference_links[0].status, "unbound");
  assert.deepEqual(f.project(f.bindings(null)).associations[0].reference_links, []);
  f.append("risk_classified", { level: "substantive", reason: "new authority invalidates checks" });
  assert.equal(f.project(f.bindings(receipt)).associations[0].reference_links[0].status, "stale");
});

test("SPEC006 producer rejects missing native evidence bytes/context and stale CAS with no append", (t) => {
  const f = fixture(t);
  for (const modify of [
    r => { r.evidence.digest = "f".repeat(64); }, r => { r.evidence_sha256 = "f".repeat(64); },
    r => { r.context = ref(f.candidate); }, r => { r.task = ref(f.context); }, r => { delete r.context; },
  ]) { const record = f.proposal(); modify(record); assert.throws(() => f.record(record), /REFERENCE/); }
  const good = f.record(f.proposal());
  const path = join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl"), before = readFileSync(path, "utf8");
  assert.throws(() => adapter.appendPrincipalNativeReference({ stateDir: f.dir, runId: f.runId, expectedHead: null,
    record: f.proposal(f.evidence(0), "required-A", good.reference) }), /REFERENCE/);
  assert.equal(readFileSync(path, "utf8"), before);
});

test("SPEC006 finalization links exact native final event and captures current check references", (t) => {
  const f = fixture(t), red = f.record(f.proposal()), green = f.record(f.proposal(f.evidence(0), "required-A", red.reference));
  f.append("evidence_recorded", { kind: "exact-target", command: "node all.mjs", exit_code: 0,
    head_sha: "a".repeat(40), tree_sha: "b".repeat(40), workspace_id: "ws-1" });
  f.append("finish_selected", { choice: "keep" }); f.append("phase_started", { phase: "git-ops" });
  const final = f.append("finalization_completed", { final_branch: "fixture", head_sha: "e".repeat(40), tree_sha: "b".repeat(40) });
  assert.throws(() => f.record({ type: "finalization-linked", native_finalization: ref(final), checks: [red.reference], author: "fixture" }), /REFERENCE/);
  const finish = f.record({ type: "finalization-linked", native_finalization: ref(final), checks: [green.reference], author: "fixture" });
  const input = f.bindings(green); input.bindings[0].reference_links[0].finalization = finish.reference;
  const p = f.project(input), link = p.associations[0].reference_links[0];
  assert.equal(link.status, "current");
  assert.equal(link.native.finalization.native_event.head_sha, "e".repeat(40));
  assert.equal(link.native.candidate.event.head_sha, "a".repeat(40));
  assert.equal(f.project(f.bindings(red)).associations[0].reference_links[0].native.evidence.raw, f.raw(f.first));
  const retired = f.record({ type: "check-retired", check_id: "required-A", previous: green.reference, reason: "withdrawn after finalization, no acceptance rewrite", author: "fixture" });
  input.bindings[0].reference_links[0].retirement = retired.reference;
  const retiredReadback = f.project(input);
  const journalLines = readFileSync(join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl"), "utf8").trimEnd().split("\n");
  for (const receipt of [red, green, finish, retired]) {
    assert.equal(receipt.readback_sha256, digest(journalLines.slice(0, receipt.reference.seq).join("\n") + "\n"), "earlier readback receipts bind their exact unchanged prefix");
  }
  assert.equal(retiredReadback.associations[0].reference_links[0].status, "retired");
  assert.equal(retiredReadback.associations[0].reference_links[0].native.finalization.native_event.head_sha, "e".repeat(40));
  if (process.env.SPEC006_EVIDENCE_DIR) {
    const destination = join(process.env.SPEC006_EVIDENCE_DIR, "lifecycle"); mkdirSync(destination, { recursive: true });
    const evidence = { "red-write.json": red, "green-write.json": green, "finalization-write.json": finish, "retirement-write.json": retired,
      "earlier-check-readback.json": f.project(f.bindings(red)), "finalized-readback.json": p, "retired-readback.json": retiredReadback };
    for (const [name, value] of Object.entries(evidence)) writeFileSync(join(destination, name), JSON.stringify(value, null, 2) + "\n");
    writeFileSync(join(destination, "native-events.jsonl"), readFileSync(f.store.paths(f.runId).log));
    writeFileSync(join(destination, "native-references.jsonl"), readFileSync(join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl")));
  }
});

test("SPEC006 stale review context cannot become current merely because a later check exits zero", (t) => {
  const f = fixture(t), review = context_id => f.append("review_recorded", { axis: "quality", verdict: "APPROVE", context_id,
    task_id: "task-1", workspace_id: "ws-1", head_sha: "a".repeat(40), tree_sha: "b".repeat(40) });
  const oldContext = review("fixture-old-context");
  f.append("risk_classified", { level: "substantive", reason: "authority after context" });
  const r = f.proposal(f.evidence(0)); r.context = ref(oldContext);
  const old = f.record(r), input = f.bindings(old); input.bindings[0].reference_links[0].native_context = ref(oldContext);
  assert.equal(f.project(input).associations[0].reference_links[0].status, "stale");
});

test("SPEC006 task-completion freshness is preserved without legacy command-group inference", (t) => {
  const f = fixture(t);
  f.append("phase_started", { phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64) });
  const early = f.record(f.proposal(f.evidence(0)));
  assert.equal(f.project(f.bindings(early)).associations[0].reference_links[0].status, "stale");
  f.append("phase_completed", { phase: "build" });
  assert.equal(f.project(f.bindings(early)).associations[0].reference_links[0].status, "stale");
  const fresh = f.record(f.proposal(f.evidence(0), "required-A", early.reference));
  assert.equal(f.project(f.bindings(fresh)).associations[0].reference_links[0].status, "current");
});

test("SPEC006 unrelated check zero cannot supersede the declared failing check and missing retirement stays unbound", (t) => {
  const f = fixture(t), a = f.record(f.proposal());
  f.record(f.proposal(f.evidence(0), "required-B"));
  assert.equal(f.project(f.bindings(a)).associations[0].reference_links[0].native.evidence.event.exit_code, 1);
  const retired = f.record({ type: "check-retired", check_id: "required-A", previous: a.reference, reason: "fixture withdrawal", author: "fixture" });
  assert.equal(f.project(f.bindings(a)).associations[0].reference_links[0].status, "unbound");
  const input = f.bindings(a); input.bindings[0].reference_links[0].retirement = retired.reference;
  assert.equal(f.project(input).associations[0].reference_links[0].status, "retired");
});

test("SPEC006 malformed Principal journal errors survive reader, projector and CLI boundaries", (t) => {
  const f = fixture(t), receipt = f.record(f.proposal()), path = join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl");
  const entry = JSON.parse(readFileSync(path, "utf8"));
  const replacement = entry.record.evidence_sha256[0] === "f" ? "e" : "f";
  entry.record.evidence_sha256 = `${replacement}${entry.record.evidence_sha256.slice(1)}`;
  const body = { ...entry }; delete body.digest;
  entry.digest = digest(body);
  writeFileSync(path, canonicalJson(entry) + "\n");
  assert.throws(() => readPrincipalNativeReferences({ stateDir: f.dir, runId: f.runId }), /REFERENCE_CHECK_CONTEXT_MISMATCH/);
  assert.throws(() => f.project(f.bindings(receipt)), /REFERENCE_CHECK_CONTEXT_MISMATCH/);
  const bindings = join(f.dir, "bindings.json"), context = join(f.dir, "context.json");
  writeFileSync(bindings, JSON.stringify(f.bindings(receipt))); writeFileSync(context, JSON.stringify(workContext()));
  const errors = [], exit = adapter.runAssociationCli(["--state-dir", f.dir, "--run-id", f.runId,
    "--daily-view", join(fixtureRoot, "p04/view.json"), "--bindings", bindings, "--work-context", context],
  { out: () => assert.fail("invalid journal must not project"), err: message => errors.push(message) });
  assert.equal(exit, 1); assert.deepEqual(errors, ["REFERENCE_CHECK_CONTEXT_MISMATCH"]);
  assert.equal(readFileSync(path, "utf8"), canonicalJson(entry) + "\n", "read paths must not repair history");
});

test("SPEC006 well-formed noncanonical Principal journal is distinct from invalid JSON", (t) => {
  const f = fixture(t), receipt = f.record(f.proposal()), path = join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl");
  const entry = JSON.parse(readFileSync(path, "utf8"));
  const noncanonical = JSON.stringify(Object.fromEntries(Object.entries(entry).reverse())) + "\n";
  writeFileSync(path, noncanonical);
  assert.throws(() => readPrincipalNativeReferences({ stateDir: f.dir, runId: f.runId }), /REFERENCE_JOURNAL_NONCANONICAL/);
  assert.throws(() => f.project(f.bindings(receipt)), /REFERENCE_JOURNAL_NONCANONICAL/);
  writeFileSync(path, "{\n");
  assert.throws(() => readPrincipalNativeReferences({ stateDir: f.dir, runId: f.runId }), /REFERENCE_JOURNAL_INVALID/);
  assert.equal(readFileSync(path, "utf8"), "{\n", "read must not rewrite malformed bytes");
});

test("SPEC006 Principal reference corruption passes through without changing legacy readers", (t) => {
  const f = fixture(t), receipt = f.record(f.proposal()), path = join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl");
  const before = readFileSync(path, "utf8"), entry = JSON.parse(before);
  entry.record.check_id = "forged";
  writeFileSync(path, JSON.stringify(entry) + "\n");
  assert.throws(() => f.project(f.bindings(receipt)), /REFERENCE_JOURNAL_DIGEST_MISMATCH/);
  assert.equal(readFileSync(path, "utf8"), JSON.stringify(entry) + "\n", "read must not repair corruption");
  const legacy = f.bindings(null); legacy.version = "principal-host-bindings-v2"; delete legacy.bindings[0].reference_links;
  assert.equal(f.project(legacy, null).version, "principal-work-associations-v2", "corrupt opt-in reference data cannot change legacy readers");
  writeFileSync(path, before);
  const nativePath = f.store.paths(f.runId).log;
  writeFileSync(nativePath, readFileSync(nativePath, "utf8").replace(f.raw(f.first), JSON.stringify(f.first, null, 0) + " \n"));
  assert.throws(() => f.project(f.bindings(receipt)), /REFERENCE_CHECK_CONTEXT_MISMATCH/, "changed native evidence bytes invalidate their Principal evidence hash");
});

test("SPEC006 duplicate/stale generic decision context and wrong finalization refs are explicit errors", (t) => {
  const f = fixture(t), receipt = f.record(f.proposal()), input = f.bindings(receipt);
  const duplicate = workContext(); duplicate.authority.decisions.push(duplicate.authority.decisions[0]);
  assert.equal(f.project(input, duplicate).associations[0].reference_links[0].status, "error");
  const stale = workContext(); stale.selectedSnapshot.event.digest = "f".repeat(64);
  assert.equal(f.project(input, stale).associations[0].reference_links[0].status, "error");
  input.bindings[0].reference_links[0].finalization = receipt.reference;
  assert.equal(f.project(input).associations[0].reference_links[0].status, "error");
});

test("SPEC006 failed reference sync never returns a success receipt or hides already-written bytes", (t) => {
  const f = fixture(t), proposal = f.proposal(), nativeBefore = readFileSync(f.store.paths(f.runId).log, "utf8");
  const mocked = t.mock.method(fs, "fsyncSync", () => { throw Object.assign(new Error("fixture sync failure"), { code: "EIO" }); });
  syncBuiltinESMExports();
  try { assert.throws(() => f.record(proposal), /REFERENCE_WRITE_UNACKNOWLEDGED/); }
  finally { mocked.mock.restore(); syncBuiltinESMExports(); }
  const p = f.project(f.bindings(null));
  assert.equal(p.native_references.entries.length, 1, "effects are retained, not erased after unknown acknowledgement");
  assert.equal(p.native_references.write_acknowledgement, "not-reconstructed-from-journal");
  assert.throws(() => f.record(proposal), /REFERENCE_CAS_MISMATCH/);
  assert.equal(readFileSync(f.store.paths(f.runId).log, "utf8"), nativeBefore);
});

test("SPEC006 v1/v2 association outputs remain identical to fa75d3a", async (t) => {
  const f = fixture(t);
  const source = execFileSync("git", ["show", "fa75d3a:scripts/principal-association.mjs"], { cwd: root, encoding: "utf8" });
  const baseline = await import(`data:text/javascript;base64,${Buffer.from(source.replace('"./assurance-state.mjs"', JSON.stringify(new URL("../../scripts/assurance-state.mjs", import.meta.url).href))).toString("base64")}`);
  for (const version of ["principal-host-bindings-v1", "principal-host-bindings-v2"]) {
    const input = f.bindings(null); input.version = version; delete input.bindings[0].reference_links;
    if (version.endsWith("v1")) delete input.bindings[0].generic.binding_key;
    const options = { stateDir: f.dir, runId: f.runId, dailyViewText: JSON.stringify(daily), bindingsText: JSON.stringify(input) };
    assert.equal(JSON.stringify(adapter.projectPrincipalAssociations(options)), JSON.stringify(baseline.projectPrincipalAssociations(options)));
  }
});

test("SPEC006 public CLI records references and reads back v3 without changing native ledgers or gating", (t) => {
  const f = fixture(t), recordPath = join(f.dir, "record.json");
  writeFileSync(recordPath, JSON.stringify(f.proposal()));
  const nativeBefore = readFileSync(f.store.paths(f.runId).log, "utf8");
  const writerArgs = [join(root, "scripts/principal-association.mjs"), "record-native-reference", "--state-dir", f.dir, "--run-id", f.runId,
    "--record", recordPath, "--expected-head", "none"];
  const written = execFileSync(process.execPath, writerArgs, { cwd: root, encoding: "utf8" });
  const receipt = JSON.parse(written), bindings = join(f.dir, "bindings.json"), context = join(f.dir, "context.json");
  writeFileSync(bindings, JSON.stringify(f.bindings(receipt))); writeFileSync(context, JSON.stringify(workContext()));
  const args = ["--state-dir", f.dir, "--run-id", f.runId, "--daily-view", join(fixtureRoot, "p04/view.json"),
    "--bindings", bindings, "--work-context", context];
  const capture = () => Object.fromEntries(readdirSync(f.store.paths(f.runId).dir).map(name => {
    const path = join(f.store.paths(f.runId).dir, name), stat = statSync(path);
    return [name, { bytes: readFileSync(path, "utf8"), mtime: stat.mtimeMs, ctime: stat.ctimeMs }];
  }));
  const before = capture();
  let readback;
  for (let i = 0; i < 2; i++) {
    const output = execFileSync(process.execPath, [join(root, "scripts/principal-association.mjs"), ...args], { cwd: root, encoding: "utf8" });
    assert.equal(JSON.parse(output).associations[0].reference_links[0].status, "current");
    readback = output;
  }
  if (process.env.SPEC006_EVIDENCE_DIR) {
    const destination = process.env.SPEC006_EVIDENCE_DIR; mkdirSync(destination, { recursive: true });
    for (const [name, bytes] of Object.entries({
      "native-events.jsonl": nativeBefore, "native-references.jsonl": readFileSync(join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl"), "utf8"),
      "reference-write-receipt.json": written, "association-readback.json": readback,
      "binding-declarations.json": readFileSync(bindings, "utf8"), "work-context-fixture.json": readFileSync(context, "utf8"),
      "commands.json": JSON.stringify({ note: "Ordinary isolated fixture, not campaign/live acceptance", cwd: root, executable: process.execPath, writerArgs, readerArgs: [join(root, "scripts/principal-association.mjs"), ...args], writerExit: 0, readerExits: [0, 0] }, null, 2),
    })) writeFileSync(join(destination, name), bytes);
  }
  assert.equal(readFileSync(f.store.paths(f.runId).log, "utf8"), nativeBefore);
  assert.deepEqual(capture(), before);
});

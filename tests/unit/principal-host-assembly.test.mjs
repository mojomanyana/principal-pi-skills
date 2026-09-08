import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const byteDigest = bytes => createHash("sha256").update(bytes).digest("hex");
import { AssuranceStore, digest, canonicalJson } from "../../scripts/assurance-state.mjs";
import * as publicApi from "../../scripts/principal-association.mjs";
import Ajv2020 from "ajv/dist/2020.js";
const root = fileURLToPath(new URL("../../", import.meta.url)), pins = join(root, "tests/fixtures/principal-association");
const ref = e => ({ seq: e.seq, digest: e.event_digest });
function world(t) {
  const dir = mkdtempSync(join(tmpdir(), "principal-host-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const runId = "association-fixture", store = new AssuranceStore({ baseDir: dir, now: () => "2026-09-08T15:00:00.000Z" });
  store.init({ runId, workflow: "feature", request: "ordinary host connector fixture", definitionDigests: { "skill:build": "d".repeat(64) } });
  const append = (type, values = {}) => { store.append(runId, { type, ...values }); return store.load(runId, { withEvents: true }).events.at(-1); };
  append("workspace_attached", { workspace_id: "ws-1", path: "/fixture", mode: "caller", writer: "build" });
  append("risk_classified", { level: "tiny", reason: "ordinary fixture only" }); append("plan_recorded", { plan_digest: "c".repeat(64) });
  const task = append("task_packet_recorded", { packet: { schema_version: "1.0", run_id: runId, task_id: "task-1", title: "host fixture", authority: ["fixture"], global_constraints: ["no acceptance"], out_of_scope: ["deployment"], critical_scope: { applies: false, matched_by: [] }, files: ["scripts/assurance-state.mjs"], dependencies: [], done_command: "fixture check", review_risk: "identity", workspace_id: "ws-1", plan_digest: "c".repeat(64), definition_digests: { "skill:build": "d".repeat(64) } } });
  const context = append("phase_started", { phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64) });
  const candidate = append("code_changed", { task_id: "task-1", head_sha: "a".repeat(40), tree_sha: "b".repeat(40), changed_paths: ["scripts/assurance-state.mjs"] });
  append("phase_completed", { phase: "build" });
  const execute = (code, task_id = "task-1", workspace_id = "ws-1") => {
    const argv = ["-e", `process.stdout.write('actual stdout ${code}\\n');process.stderr.write('actual stderr ${code}\\n');process.exitCode=${code}`];
    const processResult = spawnSync(process.execPath, argv); assert.equal(processResult.status, code);
    const event = append("evidence_recorded", { kind: "exact-target", command: JSON.stringify([process.execPath, ...argv]), exit_code: processResult.status, task_id, workspace_id, head_sha: "a".repeat(40), tree_sha: "b".repeat(40) });
    return { event, stdout: processResult.stdout, stderr: processResult.stderr, argv };
  };
  const proposal = (execution, corrects = null) => ({ type: "check-result", check_id: "required-A", task: ref(task), context: ref(context), candidate: ref(candidate), evidence: ref(execution.event), evidence_sha256: digest(readFileSync(store.paths(runId).log, "utf8").split(/(?<=\n)/)[execution.event.seq - 1]), corrects, author: "fixture-host" });
  const dailyViewText = readFileSync(join(pins, "p04/view.json"), "utf8"), daily = JSON.parse(dailyViewText);
  const claims = readFileSync(join(pins, "p04/work.jsonl"), "utf8").trim().split("\n").map(JSON.parse).filter(e => e.event === "work_acceptance");
  const decisions = claims.map((e, i) => ({ receiptId: `fixed-receipt-${i + 1}`, authorityId: e.payload.authorityId, claim: { eventId: e.eventId, digest: e.digest }, binding: e.payload.binding, decision: "accept" }));
  const workContextText = JSON.stringify({ selectedSnapshot: daily.selectedSnapshot, authority: { snapshot: { id: "fixture-independent-authority", digest: "9".repeat(64) }, decisions, availability: [] } });
  const bindings = JSON.parse(readFileSync(join(pins, "host-bindings.json"), "utf8")); bindings.version = "principal-host-bindings-v3"; bindings.bindings[0].generic.binding_key = daily.obligations[0].key;
  const decision = decisions[0];
  const selection = result => ({ binding_id: bindings.bindings[0].binding_id, check_id: "required-A", result, generic_receipt_id: decision.receiptId, generic_claim: decision.claim, generic_artifact: decision.binding.artifact, generic_artifact_digest: decision.binding.artifactDigest, generic_evidence: decision.binding.evidence[0] });
  const request = (operation, expected_head, result = { source: "write" }) => ({ version: "principal-host-assembly-request-v1", expected_head, operation, selections: [selection(result)], payloads: [] });
  const options = { stateDir: dir, runId, dailyViewText, bindingsText: JSON.stringify(bindings), workContextText };
  const assemble = async (request, ports = {}) => { assert.equal(typeof publicApi.assemblePrincipalHost, "function", "public host assembly required"); return publicApi.assemblePrincipalHost({ ...options, request, ...ports }); };
  return { dir, runId, store, append, execute, proposal, request, selection, options, assemble };
}
function archive() {
  const blobs = new Map(), calls = [];
  return { calls, blobs, version: "principal-check-payload-port-v1",
    async retain({ bytes, origin, sha256 }) { const object_id = `fixture-object-${calls.length + 1}`; calls.push({ object_id, origin, sha256 }); blobs.set(object_id, Buffer.from(bytes));
      return { version: "principal-check-payload-receipt-v1", archive_id: "fixture-archive", object_id, sha256, byte_length: bytes.length, origin_sha256: digest(origin) }; },
    async read(receipt, { max_bytes }) { const bytes = blobs.get(receipt.object_id); assert.ok(bytes.length <= max_bytes); return { receipt, bytes: Buffer.from(bytes) }; } };
}
function expected(envelope) { return { digest: envelope.digest, source: envelope.source }; }

test("host assembly records actual native results and emits a consumable generic lifecycle without an authority store", async t => {
  const f = world(t), red = f.execute(1), nativeBefore = readFileSync(f.store.paths(f.runId).log);
  const result = await f.assemble(f.request(f.proposal(red), null));
  assert.equal(result.version, "principal-host-assembly-v1");
  assert.equal(result.envelope.emissions[0].state, "emitted");
  assert.equal(result.envelope.emissions[0].check_id, "required-A");
  assert.deepEqual(result.envelope.emissions[0].revision, result.native_write.reference);
  assert.equal(result.envelope.emissions[0].native.evidence.event.exit_code, 1);
  assert.equal(result.envelope.emissions[0].payloads.stdout.state, "missing");
  assert.equal(result.envelope.emissions[0].retirement.state, "not-retired");
  const consumed = publicApi.consumePrincipalLifecycle(JSON.stringify(result.envelope), expected(result.envelope));
  assert.equal(consumed.emissions[0].state, "emitted"); assert.equal(consumed.acceptance, "not-assessed");
  assert.deepEqual(readFileSync(f.store.paths(f.runId).log), nativeBefore);
  assert.deepEqual(readdirSync(f.store.paths(f.runId).dir).sort(), ["events.jsonl", "principal-references-v1.jsonl", "snapshot.json"]);
});

test("host assembly correction, finalization and actual generic retirement preserve old result bytes and revision links", async t => {
  const f = world(t), red = await f.assemble(f.request(f.proposal(f.execute(1)), null));
  const green = await f.assemble(f.request(f.proposal(f.execute(0), red.native_write.reference), red.native_write.reference));
  assert.deepEqual(green.envelope.emissions[0].predecessor, red.native_write.reference);
  f.append("evidence_recorded", { kind: "exact-target", command: "fixture whole-run check", exit_code: 0, workspace_id: "ws-1", head_sha: "a".repeat(40), tree_sha: "b".repeat(40) });
  f.append("finish_selected", { choice: "keep" }); f.append("phase_started", { phase: "git-ops" });
  const final = f.append("finalization_completed", { final_branch: "fixture", head_sha: "e".repeat(40), tree_sha: "b".repeat(40) });
  const selected = { source: "journal", reference: green.native_write.reference };
  const finalized = await f.assemble(f.request({ type: "finalization-linked", native_finalization: ref(final), checks: [green.native_write.reference], author: "fixture" }, green.native_write.reference, selected));
  const retired = await f.assemble(f.request({ type: "check-retired", check_id: "required-A", previous: green.native_write.reference, reason: "explicit fixture withdrawal", author: "fixture" }, finalized.native_write.reference, selected));
  const emission = publicApi.consumePrincipalLifecycle(JSON.stringify(retired.envelope), expected(retired.envelope)).emissions[0];
  assert.equal(emission.retirement.state, "emitted"); assert.deepEqual(emission.retirement.origin, retired.native_write.reference);
  assert.equal(emission.finalization.native_event.head_sha, "e".repeat(40)); assert.equal(emission.native.candidate.event.head_sha, "a".repeat(40));
  const request = f.request(null, retired.native_write.reference, { source: "journal", reference: red.native_write.reference });
  const old = await f.assemble(request);
  assert.equal(old.envelope.emissions[0].applicability, "superseded");
  assert.equal(old.envelope.emissions[0].native.evidence.raw, red.envelope.emissions[0].native.evidence.raw);
  if (process.env.PRINCIPAL_HOST_EVIDENCE_DIR) { mkdirSync(process.env.PRINCIPAL_HOST_EVIDENCE_DIR, { recursive: true });
    for (const [name, value] of Object.entries({ red, green, finalized, retired, old })) writeFileSync(join(process.env.PRINCIPAL_HOST_EVIDENCE_DIR, name + ".json"), JSON.stringify(value, null, 2) + "\n"); }
});

test("run-scoped correction across workspaces preserves the actual earlier context rather than latest workspace equivalence", async t => {
  const f = world(t);
  const globalResult = workspace_id => {
    const context = f.append("phase_started", { phase: "review", task_id: null, workspace_id, definition_digest: "d".repeat(64) });
    const candidate = f.append("code_changed", { task_id: null, head_sha: "a".repeat(40), tree_sha: "b".repeat(40), changed_paths: ["scripts/assurance-state.mjs"] });
    f.append("phase_completed", { phase: "review" });
    const record = f.proposal(f.execute(0, null, workspace_id)); record.task = null; record.context = ref(context); record.candidate = ref(candidate); return record;
  };
  const bindings = JSON.parse(f.options.bindingsText); bindings.bindings[0].native.task_id = null;
  f.options.bindingsText = JSON.stringify(bindings);
  const old = await f.assemble(f.request(globalResult("ws-1"), null));
  f.append("workspace_attached", { workspace_id: "ws-2", path: "/fixture-two", mode: "caller", writer: "build" });
  bindings.bindings[0].native.workspace_id = "ws-2"; f.options.bindingsText = JSON.stringify(bindings);
  const record = globalResult("ws-2"); record.corrects = old.native_write.reference;
  const fresh = await f.assemble(f.request(record, old.native_write.reference));
  const earlier = await f.assemble(f.request(null, fresh.native_write.reference, { source: "journal", reference: old.native_write.reference }));
  const row = publicApi.consumePrincipalLifecycle(JSON.stringify(earlier.envelope), expected(earlier.envelope)).emissions[0];
  assert.equal(row.applicability, "superseded"); assert.equal(row.native.context.event.workspace_id, "ws-1");
  assert.equal(row.native.evidence.raw, old.envelope.emissions[0].native.evidence.raw);
  assert.equal(fresh.envelope.emissions[0].native.context.event.workspace_id, "ws-2");
});

test("supplied actual stdout bytes use an explicitly permitted bounded archive port with exact readback", async t => {
  const f = world(t), execution = f.execute(0), first = await f.assemble(f.request(f.proposal(execution), null));
  const path = join(f.dir, "stdout.bin"); writeFileSync(path, execution.stdout);
  const result = { source: "journal", reference: first.native_write.reference }, request = f.request(null, first.native_write.reference, result);
  request.payloads = [{ binding_id: request.selections[0].binding_id, check_id: "required-A", result, channel: "stdout", path, sha256: byteDigest(execution.stdout), byte_length: execution.stdout.length, permission_id: "fixture-read-grant" }];
  const sourcePermissions = [{ id: "fixture-read-grant", path, sha256: byteDigest(execution.stdout), max_bytes: execution.stdout.length, run_id: f.runId, check_id: "required-A", revision: first.native_write.reference, channel: "stdout", purpose: "retain-check-output" }];
  const port = archive();
  const retained = await f.assemble(request, { archivePort: port, sourcePermissions });
  assert.equal(port.calls.length, 1);
  assert.equal(retained.envelope.emissions[0].payloads.stdout.state, "retained");
  assert.equal(retained.envelope.emissions[0].payloads.stderr.state, "missing");
  assert.deepEqual([...port.blobs.values()][0], execution.stdout);
  assert.notEqual(retained.envelope.emissions[0].payloads.stdout.sha256, retained.envelope.emissions[0].native.evidence.sha256);
  assert.equal(publicApi.consumePrincipalLifecycle(JSON.stringify(retained.envelope), expected(retained.envelope)).emissions[0].payloads.stdout.receipt.origin_sha256, digest(port.calls[0].origin));
  const noGrant = await f.assemble(request, { archivePort: port });
  assert.equal(noGrant.envelope.emissions[0].payloads.stdout.state, "unbound"); assert.equal(port.calls.length, 1);
  if (process.env.PRINCIPAL_HOST_EVIDENCE_DIR) {
    const destination = join(process.env.PRINCIPAL_HOST_EVIDENCE_DIR, "payload"); mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "actual-stdout.bin"), execution.stdout);
    for (const [name, value] of Object.entries({ retained, request, sourcePermissions, archive_calls: port.calls,
      process: { executable: process.execPath, argv: execution.argv, status: 0, fixture: true } })) writeFileSync(join(destination, name + ".json"), JSON.stringify(value, null, 2) + "\n");
  }
});

function supplied(f, first, bytes = Buffer.from([0, 255, 13, 10])) {
  const path = join(f.dir, "payload.bin"); writeFileSync(path, bytes);
  const result = { source: "journal", reference: first.native_write.reference }, request = f.request(null, first.native_write.reference, result);
  request.payloads = [{ binding_id: request.selections[0].binding_id, check_id: "required-A", result, channel: "output", path, sha256: byteDigest(bytes), byte_length: bytes.length, permission_id: "fixture-grant" }];
  const sourcePermissions = [{ id: "fixture-grant", path, sha256: byteDigest(bytes), max_bytes: bytes.length, run_id: f.runId, check_id: "required-A", revision: first.native_write.reference, channel: "output", purpose: "retain-check-output" }];
  return { request, sourcePermissions, bytes, path };
}
function resigned(envelope) { const { digest: ignored, ...body } = envelope; return { ...body, digest: digest(body) }; }

test("exported lifecycle schema and the public command dispatcher connect the real archive port", async t => {
  const f = world(t), first = await f.assemble(f.request(f.proposal(f.execute(0)), null)), s = supplied(f, first), port = archive();
  const files = { "request.json": JSON.stringify(s.request), "bindings.json": f.options.bindingsText, "context.json": f.options.workContextText };
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(f.dir, name), bytes);
  let result;
  const status = await publicApi.runAssociationCli(["assemble-host", "--state-dir", f.dir, "--run-id", f.runId, "--daily-view", join(pins, "p04/view.json"), "--bindings", join(f.dir, "bindings.json"), "--work-context", join(f.dir, "context.json"), "--request", join(f.dir, "request.json")],
    { archivePort: port, sourcePermissions: s.sourcePermissions, out: text => { result = JSON.parse(text); }, err: text => assert.fail(text) });
  assert.equal(status, 0); assert.equal(port.calls.length, 1);
  const schema = JSON.parse(readFileSync(join(root, "contracts/principal-generic-check-lifecycle/v1/envelope.schema.json"), "utf8"));
  const validate = new Ajv2020().compile(schema);
  assert.equal(validate(result.envelope), true, JSON.stringify(validate.errors));
  const bad = structuredClone(result.envelope); delete bad.emissions[0].revision;
  assert.equal(validate(bad), false);
  assert.equal(result.envelope.emissions[0].payloads.output.state, "retained");
});

test("consumer rejects stale pins, forged check/context/payload and manufactured generic retirement", async t => {
  const f = world(t), result = await f.assemble(f.request(f.proposal(f.execute(0)), null));
  const e = result.envelope;
  assert.throws(() => publicApi.consumePrincipalLifecycle(JSON.stringify(e)), /EXPECTED_RECEIPT/);
  const stale = expected(e); stale.source = structuredClone(stale.source); stale.source.journal_head.digest = "f".repeat(64);
  assert.throws(() => publicApi.consumePrincipalLifecycle(JSON.stringify(e), stale), /PIN_MISMATCH/);
  const disconnected = structuredClone(e), absent = { seq: 99, digest: "f".repeat(64) };
  disconnected.association.associations[0].reference_links[0].declaration.native_check = absent;
  disconnected.emissions[0].revision = absent; disconnected.emissions[0].native.check.reference = absent;
  disconnected.source.association_sha256 = digest(disconnected.association);
  const internallyForged = resigned(disconnected);
  assert.throws(() => publicApi.consumePrincipalLifecycle(JSON.stringify(internallyForged), expected(internallyForged)), /MISMATCH/, "rehashing cannot supply an absent native journal reference");
  for (const change of [
    x => { x.emissions[0].check_id = "other-check"; },
    x => { x.emissions[0].native.context.reference.digest = "f".repeat(64); },
    x => { x.emissions[0].revision.seq++; },
    x => { x.emissions[0].retirement = { state: "emitted", origin: x.emissions[0].revision }; },
    x => { x.emissions[0].payloads.stdout = { state: "retained", sha256: "f".repeat(64) }; },
  ]) { const forged = structuredClone(e); change(forged); const bad = resigned(forged);
    assert.throws(() => publicApi.consumePrincipalLifecycle(JSON.stringify(bad), expected(e)), /PIN_MISMATCH/);
    assert.throws(() => publicApi.consumePrincipalLifecycle(JSON.stringify(bad), expected(bad)), /MISMATCH/);
  }
});

test("host refusal, stale/check/receipt mismatches and unbound retirement do not invent emissions or read payloads", async t => {
  const f = world(t), first = await f.assemble(f.request(f.proposal(f.execute(0)), null));
  const s = supplied(f, first), port = archive(), native = readFileSync(f.store.paths(f.runId).log), journal = readFileSync(join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl"));
  const stale = structuredClone(s.request); stale.expected_head = null;
  await assert.rejects(f.assemble(stale, { archivePort: port, sourcePermissions: s.sourcePermissions }), /CAS_MISMATCH/);
  const wrong = structuredClone(s.request); wrong.selections[0].check_id = "wrong-check";
  await assert.rejects(f.assemble(wrong), /NATIVE_SELECTION_MISMATCH/);
  const duplicate = structuredClone(s.request); duplicate.selections.push(duplicate.selections[0]);
  await assert.rejects(f.assemble(duplicate), /SELECTION_DUPLICATE/);
  const badReceipt = structuredClone(s.request); badReceipt.selections[0].generic_receipt_id = "fixed-receipt-2";
  const refused = await f.assemble(badReceipt, { archivePort: port, sourcePermissions: s.sourcePermissions });
  assert.equal(refused.envelope.emissions[0].state, "error"); assert.equal(port.calls.length, 0);
  const staleContext = JSON.parse(f.options.workContextText); staleContext.selectedSnapshot.event.digest = "f".repeat(64);
  const staleBinding = await publicApi.assemblePrincipalHost({ ...f.options, workContextText: JSON.stringify(staleContext), request: s.request });
  assert.equal(staleBinding.envelope.emissions[0].state, "error");
  assert.deepEqual(readFileSync(f.store.paths(f.runId).log), native); assert.deepEqual(readFileSync(join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl")), journal);
  const retired = await f.assemble(f.request({ type: "check-retired", check_id: "required-A", previous: first.native_write.reference, reason: "fixture", author: "fixture" }, first.native_write.reference, s.request.selections[0].result));
  s.request.expected_head = retired.native_write.reference;
  const unbound = await publicApi.assemblePrincipalHost({ ...f.options, workContextText: undefined, request: s.request, archivePort: port, sourcePermissions: s.sourcePermissions });
  assert.equal(unbound.envelope.emissions[0].state, "unbound"); assert.equal(unbound.envelope.emissions[0].retirement.state, "unbound"); assert.equal(port.calls.length, 0);
});

test("binary/empty payloads are exact; missing, denied, oversize, symlink and wrong bytes never borrow assurance bytes", async t => {
  const f = world(t), first = await f.assemble(f.request(f.proposal(f.execute(0)), null)), port = archive();
  for (const bytes of [Buffer.from([0, 255, 13, 10]), Buffer.alloc(0)]) {
    const s = supplied(f, first, bytes), result = await f.assemble(s.request, { archivePort: port, sourcePermissions: s.sourcePermissions });
    assert.equal(result.envelope.emissions[0].payloads.output.state, "retained");
    assert.deepEqual(port.blobs.get(result.envelope.emissions[0].payloads.output.receipt.object_id), bytes);
  }
  const s = supplied(f, first), count = port.calls.length;
  const denied = structuredClone(s.sourcePermissions); denied[0].revision.digest = "f".repeat(64);
  assert.equal((await f.assemble(s.request, { archivePort: port, sourcePermissions: denied })).envelope.emissions[0].payloads.output.state, "unbound");
  assert.equal((await f.assemble(s.request, { sourcePermissions: s.sourcePermissions })).envelope.emissions[0].payloads.output.reason, "archive-port-missing");
  writeFileSync(s.path, Buffer.from([0, 254, 13, 10]));
  await assert.rejects(f.assemble(s.request, { archivePort: port, sourcePermissions: s.sourcePermissions }), /SOURCE_DIGEST_MISMATCH/);
  writeFileSync(s.path, Buffer.alloc(1024 * 1024 + 1));
  await assert.rejects(f.assemble(s.request, { archivePort: port, sourcePermissions: s.sourcePermissions }), /SOURCE_SIZE_MISMATCH/);
  rmSync(s.path); symlinkSync(f.store.paths(f.runId).log, s.path);
  await assert.rejects(f.assemble(s.request, { archivePort: port, sourcePermissions: s.sourcePermissions }), /HOST_ASSEMBLY_FAILED/);
  rmSync(s.path);
  assert.equal((await f.assemble(s.request, { archivePort: port, sourcePermissions: s.sourcePermissions })).envelope.emissions[0].payloads.output.reason, "source-unavailable");
  assert.equal(port.calls.length, count);
});

test("archive receipt/readback/failure and concurrent source drift retain effects rather than claiming clean success", async t => {
  const f = world(t), first = await f.assemble(f.request(f.proposal(f.execute(0)), null));
  for (const fault of ["write", "origin", "readback", "alias", "drift"]) {
    const s = supplied(f, first), port = archive(), retain = port.retain.bind(port), read = port.read.bind(port);
    let returnedReceipt;
    port.retain = async args => { const receipt = await retain(args); returnedReceipt = receipt;
      if (fault === "write") throw new Error("fixture error after retained bytes");
      if (fault === "origin") receipt.origin_sha256 = "f".repeat(64);
      return receipt; };
    port.read = async (...args) => { const result = await read(...args);
      if (fault === "readback") result.bytes = Buffer.alloc(result.bytes.length);
      if (fault === "alias") { returnedReceipt.origin_sha256 = "f".repeat(64); result.receipt = returnedReceipt; }
      if (fault === "drift") f.append("risk_classified", { level: "substantive", reason: "fixture concurrent authority" });
      return result; };
    await assert.rejects(f.assemble(s.request, { archivePort: port, sourcePermissions: s.sourcePermissions }), error => {
      assert.match(error.message, /HOST_/); assert.equal(error.effects.archives.length, 1);
      assert.equal(error.effects.archives[0].state, fault === "drift" ? "readback-verified" : "unacknowledged");
      assert.equal(port.blobs.size, 1); return true;
    });
  }
});

test("later assembly failure preserves the exact acknowledged native write without another store or retry", async t => {
  const f = world(t), request = f.request(f.proposal(f.execute(0)), null); request.selections[0].result = { source: "journal", reference: { seq: 99, digest: "f".repeat(64) } };
  await assert.rejects(f.assemble(request), error => { assert.match(error.message, /NATIVE_SELECTION_MISMATCH/); assert.equal(error.effects.native_write.version, "principal-native-reference-write-v1"); return true; });
  const entries = readFileSync(join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl"), "utf8").trim().split("\n"); assert.equal(entries.length, 1);
  await assert.rejects(f.assemble(request), /CAS_MISMATCH/);
  assert.equal(readFileSync(join(f.store.paths(f.runId).dir, "principal-references-v1.jsonl"), "utf8").trim().split("\n").length, 1);
});

test("real public CLI assembles a lifecycle envelope; reads/consumer and v3 bytes remain compatible", async t => {
  const f = world(t), request = f.request(f.proposal(f.execute(0)), null);
  const inputs = { "request.json": JSON.stringify(request), "bindings.json": f.options.bindingsText, "context.json": f.options.workContextText };
  for (const [name, text] of Object.entries(inputs)) writeFileSync(join(f.dir, name), text);
  const args = [join(root, "scripts/principal-association.mjs"), "assemble-host", "--state-dir", f.dir, "--run-id", f.runId, "--daily-view", join(pins, "p04/view.json"), "--bindings", join(f.dir, "bindings.json"), "--work-context", join(f.dir, "context.json"), "--request", join(f.dir, "request.json")];
  const result = JSON.parse(execFileSync(process.execPath, args, { cwd: root, encoding: "utf8" }));
  assert.equal(result.envelope.emissions[0].state, "emitted");
  const capture = () => Object.fromEntries(readdirSync(f.store.paths(f.runId).dir).map(name => { const path = join(f.store.paths(f.runId).dir, name), s = statSync(path); return [name, { bytes: readFileSync(path, "utf8"), mtime: s.mtimeMs, ctime: s.ctimeMs }]; }));
  const before = capture(), selection = { source: "journal", reference: result.native_write.reference };
  const read = await f.assemble(f.request(null, result.native_write.reference, selection));
  publicApi.consumePrincipalLifecycle(JSON.stringify(read.envelope), expected(read.envelope)); assert.deepEqual(capture(), before);
  let original = execFileSync("git", ["show", "abf3525:scripts/principal-association.mjs"], { cwd: root, encoding: "utf8" });
  for (const name of ["assurance-state.mjs", "principal-native-references.mjs"]) original = original.replaceAll(`"./${name}"`, JSON.stringify(new URL(`../../scripts/${name}`, import.meta.url).href));
  const baseline = await import(`data:text/javascript;base64,${Buffer.from(original).toString("base64")}`);
  const options = { ...f.options, bindingsText: JSON.stringify(read.assembled_bindings) };
  assert.equal(JSON.stringify(baseline.projectPrincipalAssociations(options)), JSON.stringify(publicApi.projectPrincipalAssociations(options)));
  if (process.env.PRINCIPAL_HOST_EVIDENCE_DIR) {
    const destination = join(process.env.PRINCIPAL_HOST_EVIDENCE_DIR, "cli"); mkdirSync(destination, { recursive: true });
    for (const [name, value] of Object.entries({ "result.json": result, "read.json": read, "commands.json": { executable: process.execPath, args, cwd: root, exit: 0, fixture: true }, "request.json": request })) writeFileSync(join(destination, name), JSON.stringify(value, null, 2) + "\n");
    for (const name of ["events.jsonl", "principal-references-v1.jsonl"]) writeFileSync(join(destination, name), readFileSync(join(f.store.paths(f.runId).dir, name)));
  }
});

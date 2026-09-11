import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import { AssuranceStore, buildCurrentApplicabilityProjection, readBoundedAssuranceText } from "../../scripts/assurance-state.mjs";
import { projectPrincipalAssociations, runAssociationCli, parseAssociationJson } from "../../scripts/principal-association.mjs";

const fixtures = fileURLToPath(new URL("../fixtures/principal-association/", import.meta.url));
const read = (path) => readFileSync(join(fixtures, path), "utf8");
const viewText = read("p04/view.json");
const declarations = () => JSON.parse(read("host-bindings.json"));
const view = () => JSON.parse(viewText);
const head = "a".repeat(40), tree = "b".repeat(40), plan = "c".repeat(64), definition = "d".repeat(64);
const keyedDeclarations = (daily = view()) => {
  const input = declarations();
  input.version = "principal-host-bindings-v2";
  input.bindings[0].generic.binding_key = daily.obligations[0].key;
  return input;
};
function multipleBindings() {
  const daily = view(), second = structuredClone(daily.obligations[0]);
  // Test-world P04 variant: same obligation, different existing artifact reference.
  // Only the fixture builder understands key contents; the adapter must treat it as opaque.
  const binding = JSON.parse(second.key);
  binding.artifact = JSON.parse(daily.obligations[1].key).artifact;
  second.key = JSON.stringify(binding);
  second.receiptIds = [];
  second.claimReferences = [];
  daily.obligations.push(second);
  return daily;
}
function nativeFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "ppa-association-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const runId = "association-fixture";
  const store = new AssuranceStore({ baseDir: dir, now: () => "2026-09-08T12:00:00.000Z" });
  store.init({ workflow: "feature", request: "Implement report", runId, definitionDigests: { "skill:build": definition } });
  const append = (type, payload = {}) => store.append(runId, { type, ...payload });
  append("workspace_attached", { workspace_id: "ws-1", path: "/native-fixture", mode: "caller", writer: "build" });
  append("risk_classified", { level: "tiny", reason: "test-world fixture" });
  append("plan_recorded", { plan_digest: plan });
  for (const task_id of ["task-1", "task-2"]) append("task_packet_recorded", { packet: {
    schema_version: "1.0", run_id: runId, task_id, title: "reused-worker", authority: ["native fixture only"],
    global_constraints: ["read-only projection"], out_of_scope: ["acceptance"], critical_scope: { applies: false, matched_by: [] },
    files: ["scripts/assurance-state.mjs"], dependencies: [], done_command: `node ${task_id}.mjs`, review_risk: "bindings",
    workspace_id: "ws-1", plan_digest: plan, definition_digests: { "skill:build": definition },
  } });
  append("code_changed", { head_sha: head, tree_sha: tree, changed_paths: ["scripts/assurance-state.mjs"] });
  for (const task_id of ["task-1", "task-2"]) {
    append("phase_started", { phase: "build", task_id });
    append("phase_completed", { phase: "build" });
    append("evidence_recorded", { kind: "exact-target", command: `node ${task_id}.mjs`, exit_code: 0, head_sha: head, tree_sha: tree, task_id });
  }
  append("evidence_recorded", { kind: "exact-target", command: "node all.mjs", exit_code: 0, head_sha: head, tree_sha: tree });
  const project = (bindings = declarations(), daily = view()) => projectPrincipalAssociations({
    stateDir: dir, runId, dailyViewText: JSON.stringify(daily), bindingsText: bindings === null ? undefined : JSON.stringify(bindings),
  });
  return { dir, runId, store, append, project };
}

test("association pins: immutable input hashes and exact P03 fixture/schema/P04 archive rows agree", () => {
  for (const entry of JSON.parse(read("provenance.json")).entries) {
    assert.equal(createHash("sha256").update(readFileSync(join(fixtures, entry.targetPath))).digest("hex"), entry.sha256);
  }
  const archive = JSON.parse(read("p03/retained-executions.json"));
  const validate = new Ajv2020({ strict: false }).compile(JSON.parse(read("p03/projection.schema.json")));
  assert.equal(validate(archive), true, JSON.stringify(validate.errors));
  assert.deepEqual(view().attempts.map((attempt) => attempt.archive), archive.executions);
});

test("association-v1 binds explicit native replay to exact existing P04 references, not acceptance", (t) => {
  const f = nativeFixture(t), p = f.project();
  assert.equal(p.version, "principal-work-associations-v1");
  assert.equal(p.readOnly, true);
  assert.equal(p.acceptance, "not-assessed");
  assert.equal(p.authority, "unauthenticated-host-declarations");
  assert.equal(p.freshness, "snapshot-unknown");
  assert.equal(p.associations[0].status, "bound");
  assert.deepEqual(p.associations[0].generic, declarations().bindings[0].generic);
  assert.equal(p.native.applicability.result, "PASSED");
  assert.equal(p.native.ledger.hashChainHead, f.store.load(f.runId).event_digest);
  assert.equal(p.generic.authority_claim, "supplied-host-context");
  assert.equal(p.tasks.find((task) => task.task_id === "task-2").status, "unbound");
  assert.equal(p.executions.length, 6);
  assert.deepEqual(p.executions[0].association_ids, ["fixture-binding-1"]);
  assert.equal(Object.hasOwn(p, "accepted"), false);
});

test("association-v1 defaults unbound regardless of matching titles or reported generic acceptance", (t) => {
  const p = nativeFixture(t).project(null);
  assert.deepEqual(p.associations, []);
  assert.ok(p.tasks.every((task) => task.status === "unbound"));
  assert.ok(p.executions.every((attempt) => attempt.association_ids.length === 0));
  assert.equal(p.acceptance, "not-assessed");
});

test("association-v1 exposes every wrong native or generic reference instead of choosing a match", (t) => {
  const f = nativeFixture(t);
  const changes = [
    ["native-run-mismatch", (b) => { b.native.run_id = "other-run"; }],
    ["native-task-unknown", (b) => { b.native.task_id = "other-task"; }],
    ["native-workspace-mismatch", (b) => { b.native.workspace_id = "other-workspace"; }],
    ["native-candidate-mismatch", (b) => { b.native.candidate.head_sha = "f".repeat(40); }],
    ["native-candidate-mismatch", (b) => { b.native.candidate.tree_sha = "f".repeat(40); }],
    ["generic-snapshot-mismatch", (b) => { b.generic.selectedSnapshot.event.digest = "f".repeat(64); }],
    ["generic-snapshot-mismatch", (b) => { b.generic.selectedSnapshot.snapshot.id = "other-snapshot"; }],
    ["generic-scope-mismatch", (b) => { b.generic.scope.revision++; }],
    ["generic-obligation-unknown", (b) => { b.generic.obligation.revision++; }],
    ["execution-unknown", (b) => { b.execution_ids = ["not-an-execution"]; }],
    ["execution-target-mismatch", (b) => { b.execution_ids = [view().attempts[1].executionId]; }],
  ];
  for (const [reason, change] of changes) {
    const input = declarations(); change(input.bindings[0]);
    const p = f.project(input);
    assert.equal(p.associations[0].status, "conflict", reason);
    assert.ok(p.associations[0].issues.includes(reason), reason);
    assert.ok(p.executions.every((attempt) => attempt.association_ids.length === 0), reason);
  }
});

test("association-v1 rejects duplicate declaration identities symmetrically, not first-match wins", (t) => {
  const f = nativeFixture(t), input = declarations();
  input.bindings.push(structuredClone(input.bindings[0]));
  input.bindings[1].generic.obligation = view().obligations[1].obligation;
  const p = f.project(input);
  assert.equal(p.associations.length, 2);
  assert.ok(p.associations.every((a) => a.status === "conflict" && a.issues.includes("binding-id-conflict")));
  assert.ok(p.tasks.every((task) => task.status === "unbound"));
});

test("association-v1 shared execution has multiple explicit targets without multiplying attempts", (t) => {
  const f = nativeFixture(t), input = declarations(), daily = view();
  const second = structuredClone(input.bindings[0]);
  second.binding_id = "fixture-binding-2";
  second.native.task_id = "task-2";
  second.generic.obligation = daily.obligations[1].obligation;
  // Explicit test-world P01 shared occurrence, not inferred from names or a launch.
  daily.obligations[1].attempts.push(second.execution_ids[0]);
  input.bindings.push(second);
  const p = f.project(input, daily);
  assert.ok(p.associations.every((a) => a.status === "bound"));
  assert.equal(p.executions.length, 6);
  assert.deepEqual(p.executions[0].association_ids, ["fixture-binding-1", "fixture-binding-2"]);
});

test("association-v1 stale evidence stays stale and superseded or stale task authority cannot bind", (t) => {
  const f = nativeFixture(t);
  f.append("risk_classified", { level: "substantive", reason: "changed native authority" });
  const p = f.project();
  assert.equal(p.native.applicability.result, "STALE");
  assert.equal(p.associations[0].status, "bound", "structural association does not certify evidence");
  assert.equal(p.acceptance, "not-assessed");
  f.append("plan_recorded", { plan_digest: "e".repeat(64) });
  assert.ok(f.project().associations[0].issues.includes("native-task-stale"));
  f.append("plan_critique_recorded", { verdict: "APPROVE", context_id: "fixture-replan", plan_digest: "e".repeat(64) });
  f.append("task_packet_superseded", { task_id: "task-1", reason: "fixture replan" });
  const retired = f.project();
  assert.equal(retired.associations[0].status, "inapplicable");
  assert.ok(retired.associations[0].issues.includes("native-task-superseded"));
});

test("association-v1 absent or stale generic authority, even an accepted claim, never grants acceptance", (t) => {
  const f = nativeFixture(t);
  for (const authority of [undefined, "unavailable", "stale-for-selection", "supplied-host-context"]) {
    const daily = view(); daily.authority = authority;
    const p = f.project(declarations(), daily);
    assert.equal(p.acceptance, "not-assessed");
    assert.equal(p.generic.authority_claim, authority ?? null);
    assert.equal(p.associations[0].status, "bound");
    assert.equal(Object.hasOwn(p.generic, "progress"), false);
  }
});

test("association-v1 unavailable selection/scope and duplicate generic identities are explicit", (t) => {
  const f = nativeFixture(t), missing = view();
  missing.selectedSnapshot = null; missing.scope = null; missing.scopeState = "unresolved";
  assert.equal(f.project(declarations(), missing).associations[0].status, "conflict");
  for (const alter of [
    (daily) => daily.attempts.push(daily.attempts[0]),
    (daily) => daily.obligations.push(daily.obligations[0]),
    (daily) => { daily.attempts[0].archive.executionId = daily.attempts[1].executionId; },
    (daily) => { daily.obligations[0].attempts.push("unknown"); },
  ]) {
    const daily = view(); alter(daily);
    assert.throws(() => f.project(declarations(), daily), /GENERIC_REFERENCE_CONFLICT/);
  }
});

test("association-v1 bounds JSON bytes, depth, members, arrays, strings, integers and duplicate keys", () => {
  for (const text of [
    '{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"a":9007199254740993}',
    '['.repeat(40) + '0' + ']'.repeat(40), JSON.stringify("x".repeat(8193)),
    JSON.stringify(Array(4097).fill(0)), JSON.stringify(Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`k${i}`, i]))),
    ' '.repeat(4 * 1024 * 1024 + 1),
    '{"a":1.00000000000000001}', '{"a":-0}', '{"__proto__":{}}',
  ]) assert.throws(() => parseAssociationJson(text), /ASSOCIATION_INPUT_INVALID/);
});

test("association-v1 declaration version/shape rejects guessed or extra authority fields", (t) => {
  const f = nativeFixture(t);
  for (const alter of [
    (b) => { b.version = "future"; },
    (b) => { b.bindings[0].native.owner = "invented"; },
    (b) => { delete b.bindings[0].native.candidate; },
    (b) => { b.bindings[0].generic.obligation = { id: "obligation-1" }; },
    (b) => { b.bindings[0].execution_ids.push(b.bindings[0].execution_ids[0]); },
  ]) {
    const input = declarations(); alter(input);
    assert.throws(() => f.project(input), /ASSOCIATION_INPUT_INVALID/);
  }
});

test("association-v1 optional bounded native replay refuses over-budget input without changing legacy loading", (t) => {
  const f = nativeFixture(t);
  assert.throws(() => f.store.load(f.runId, { maxBytes: 1 }), /bounded assurance input/);
  assert.throws(() => f.store.load(f.runId, { maxEvents: 1 }), /bounded assurance event/);
  assert.deepEqual(f.store.load(f.runId, { maxBytes: 16 * 1024 * 1024 }), f.store.load(f.runId));
  assert.throws(() => projectPrincipalAssociations({ runId: f.runId, dailyViewText: viewText }), /ASSOCIATION_INPUT_INVALID/);
});

test("association-v1 bounded decoding must not silently strip native ledger bytes", (t) => {
  const f = nativeFixture(t), path = f.store.paths(f.runId).log;
  writeFileSync(path, "\ufeff" + readFileSync(path, "utf8"));
  assert.equal(readBoundedAssuranceText(path, 16 * 1024 * 1024), readFileSync(path, "utf8"));
  assert.throws(() => f.store.load(f.runId));
  assert.throws(() => f.project(), /native-ledger-invalid/);
});

test("association-v1 omitted execution IDs never infer attempts and finalized heads keep candidate identity", (t) => {
  const f = nativeFixture(t), input = declarations();
  delete input.bindings[0].execution_ids;
  f.append("finish_selected", { choice: "keep" });
  f.append("phase_started", { phase: "git-ops" });
  f.append("finalization_completed", { final_branch: "fixture", head_sha: "e".repeat(40), tree_sha: tree });
  const p = f.project(input);
  assert.equal(p.associations[0].status, "bound");
  assert.ok(p.executions.every((e) => e.association_ids.length === 0));
  assert.equal(p.native.applicability.candidate.head_sha, head);
});

test("association-v1 named host boundary preserves gates and adds no package or control surface", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const before = execFileSync("git", ["show", "dcb54eb:scripts/assurance-state.mjs"], { cwd: root, encoding: "utf8" });
  const current = readFileSync(join(root, "scripts/assurance-state.mjs"), "utf8");
  assert.equal(current.slice(current.indexOf("export const SCHEMA_VERSION"), current.indexOf("/** Optional bounded descriptor")),
    before.slice(before.indexOf("export const SCHEMA_VERSION"), before.indexOf("/** Append-only store")));
  const adapter = readFileSync(join(root, "scripts/principal-association.mjs"), "utf8");
  assert.doesNotMatch(adapter, /(?:evaluateGate|appendFileSync|writeFileSync|mkdirSync|execFileSync|spawnSync)\s*\(|\.append\s*\(/);
  assert.match(adapter, /store\.load\(runId, \{ maxBytes:/);
  const pkg = JSON.parse(readFileSync(join(root, "package.json")));
  const baseline = JSON.parse(execFileSync("git", ["show", "dcb54eb:package.json"], { cwd: root }));
  assert.equal(pkg.version, "3.1.0", "release metadata may advance without adding a package surface");
  baseline.version = pkg.version;
  assert.deepEqual(pkg, baseline);
});

test("association-v1 actual direct Node host entry point defaults unbound and refuses symlinks", (t) => {
  const f = nativeFixture(t), root = fileURLToPath(new URL("../../", import.meta.url));
  const script = join(root, "scripts/principal-association.mjs");
  const output = execFileSync(process.execPath, [script, "--state-dir", f.dir, "--run-id", f.runId,
    "--daily-view", join(fixtures, "p04/view.json")], { cwd: root, encoding: "utf8" });
  assert.ok(JSON.parse(output).tasks.every((task) => task.status === "unbound"));
  const link = join(f.dir, "view-link.json"); symlinkSync(join(fixtures, "p04/view.json"), link);
  assert.throws(() => readBoundedAssuranceText(link, 4 * 1024 * 1024));
  assert.equal(runAssociationCli(["--state-dir", f.dir, "--run-id", f.runId, "--daily-view", link],
    { out: () => assert.fail("symlink must not project"), err: () => {} }), 1);
});

test("association-v2 selects an exact opaque key among multiple bindings without first-match priority", (t) => {
  const f = nativeFixture(t), daily = multipleBindings(), input = keyedDeclarations(daily);
  for (const key of [daily.obligations[0].key, daily.obligations.at(-1).key]) {
    input.bindings[0].generic.binding_key = key;
    const p = f.project(input, daily);
    assert.equal(p.version, "principal-work-associations-v2");
    assert.equal(p.associations[0].status, "bound");
    assert.equal(p.associations[0].generic.binding_key, key);
    assert.equal(p.acceptance, "not-assessed");
    const reversed = structuredClone(daily); reversed.obligations.reverse();
    assert.deepEqual(f.project(input, reversed).associations, p.associations);
  }
  assert.throws(() => f.project(declarations(), daily), /GENERIC_REFERENCE_CONFLICT/, "v1 still refuses ambiguity");
});

test("association-v2 wrong, stale, foreign-revision and missing keys never fall back to a revision match", (t) => {
  const f = nativeFixture(t), daily = multipleBindings();
  for (const key of ["not-an-existing-key", daily.obligations[0].key + " "]) {
    const input = keyedDeclarations(daily); input.bindings[0].generic.binding_key = key;
    const row = f.project(input, daily).associations[0];
    assert.equal(row.status, "conflict");
    assert.ok(row.issues.includes("generic-binding-key-unknown"));
    assert.equal(row.reference_context, null);
  }
  const stale = keyedDeclarations(daily), replaced = structuredClone(daily);
  replaced.obligations.shift();
  assert.ok(f.project(stale, replaced).associations[0].issues.includes("generic-binding-key-unknown"));
  const foreign = keyedDeclarations(daily); foreign.bindings[0].generic.binding_key = daily.obligations[1].key;
  assert.ok(f.project(foreign, daily).associations[0].issues.includes("generic-binding-revision-mismatch"));
  const staleSelection = keyedDeclarations(daily); staleSelection.bindings[0].generic.selectedSnapshot.event.digest = "f".repeat(64);
  const staleRow = f.project(staleSelection, daily).associations[0];
  assert.ok(staleRow.issues.includes("generic-snapshot-mismatch"));
  assert.equal(staleRow.reference_context, null);
  const missing = keyedDeclarations(daily); delete missing.bindings[0].generic.binding_key;
  assert.throws(() => f.project(missing, daily), /ASSOCIATION_INPUT_INVALID/);
  assert.throws(() => f.project(missing), /ASSOCIATION_INPUT_INVALID/, "even an unambiguous v2 target requires its explicit key");
});

test("association-v2 treats keys as opaque strings and rejects duplicate generic key identities", (t) => {
  const f = nativeFixture(t), daily = view();
  daily.obligations[0].key = "opaque-not-json:existing-P04-key";
  assert.equal(f.project(keyedDeclarations(daily), daily).associations[0].status, "bound");
  for (const change of [
    (o) => { o.receiptIds = []; },
    (o) => { o.obligation = view().obligations[1].obligation; },
  ]) {
    const conflicting = structuredClone(daily), extra = structuredClone(daily.obligations[0]);
    change(extra); conflicting.obligations.push(extra);
    assert.throws(() => f.project(keyedDeclarations(daily), conflicting), /GENERIC_REFERENCE_CONFLICT/);
  }
});

test("association-v2 duplicate declarations conflict symmetrically and shared executions stay single", (t) => {
  const f = nativeFixture(t), daily = multipleBindings(), input = keyedDeclarations(daily);
  const second = structuredClone(input.bindings[0]);
  second.generic.binding_key = daily.obligations.at(-1).key;
  input.bindings.push(second);
  const conflicting = f.project(input, daily);
  assert.ok(conflicting.associations.every((a) => a.status === "conflict" && a.issues.includes("binding-id-conflict")));
  assert.ok(conflicting.associations.every((a) => a.reference_context === null));
  second.binding_id = "explicit-second-binding";
  const p = f.project(input, daily);
  assert.ok(p.associations.every((a) => a.status === "bound"));
  assert.equal(p.executions.length, daily.attempts.length);
  assert.deepEqual(p.executions[0].association_ids, ["fixture-binding-1", "explicit-second-binding"]);
});

test("association-v2 maps only selected-row receipt/claim context, never cross-domain check or retirement identity", (t) => {
  const f = nativeFixture(t), daily = multipleBindings(), input = keyedDeclarations(daily);
  const nativeSeqs = f.store.load(f.runId).evidence.filter((r) => r.task_id === "task-1").map((r) => r.seq);
  for (const authority of [undefined, "unavailable", "stale-for-selection", "supplied-host-context"]) {
    daily.authority = authority;
    const p = f.project(input, daily), context = p.associations[0].reference_context;
    assert.deepEqual(context, {
      native: { evidence_seqs: nativeSeqs },
      generic: { receiptIds: daily.obligations[0].receiptIds, claimReferences: daily.obligations[0].claimReferences },
      check_equivalence: "unbound", retirement_equivalence: "unbound",
    });
    assert.equal(p.acceptance, "not-assessed");
    assert.equal(p.authority, "unauthenticated-host-declarations");
  }
  input.bindings[0].generic.binding_key = daily.obligations.at(-1).key;
  assert.deepEqual(f.project(input, daily).associations[0].reference_context.generic, { receiptIds: [], claimReferences: [] });
  f.append("risk_classified", { level: "substantive", reason: "new native authority" });
  const stale = f.project(input, daily);
  assert.equal(stale.native.applicability.result, "STALE");
  assert.equal(stale.associations[0].reference_context.check_equivalence, "unbound");
  f.append("plan_recorded", { plan_digest: "e".repeat(64) });
  f.append("plan_critique_recorded", { verdict: "APPROVE", context_id: "fixture-key-replan", plan_digest: "e".repeat(64) });
  f.append("task_packet_superseded", { task_id: "task-1", reason: "native-only supersession" });
  const superseded = f.project(input, daily);
  assert.equal(superseded.associations[0].status, "inapplicable");
  assert.equal(superseded.associations[0].reference_context, null);
});

test("association-v2 requires exact selected-row execution membership and bounded consumed reference arrays", (t) => {
  const f = nativeFixture(t), daily = multipleBindings(), input = keyedDeclarations(daily);
  input.bindings[0].execution_ids = [daily.attempts[1].executionId];
  assert.ok(f.project(input, daily).associations[0].issues.includes("execution-target-mismatch"));
  for (const field of ["receiptIds", "claimReferences"]) {
    const malformed = view(); malformed.obligations[0][field] = [42];
    assert.throws(() => f.project(keyedDeclarations(malformed), malformed), /ASSOCIATION_INPUT_INVALID/);
  }
  const oversized = keyedDeclarations(); oversized.bindings[0].generic.binding_key = "x".repeat(8193);
  assert.throws(() => f.project(oversized), /ASSOCIATION_INPUT_INVALID/);
  for (const unsupported of ["check_id", "retirement_ref", "authority"]) {
    const extra = keyedDeclarations(); extra.bindings[0].generic[unsupported] = "not-supported-by-pinned-inputs";
    assert.throws(() => f.project(extra), /ASSOCIATION_INPUT_INVALID/);
  }
  const v1WithKey = keyedDeclarations(); v1WithKey.version = "principal-host-bindings-v1";
  assert.throws(() => f.project(v1WithKey), /ASSOCIATION_INPUT_INVALID/, "v1 shape must not silently expand");
  const empty = keyedDeclarations(); empty.bindings = [];
  const p = f.project(empty, daily);
  assert.equal(p.version, "principal-work-associations-v2");
  assert.deepEqual(p.associations, []);
  assert.ok(p.tasks.every((task) => task.status === "unbound"));
});

test("association-v1 output remains identical to immutable 800bb2c adapter", async (t) => {
  const f = nativeFixture(t), root = fileURLToPath(new URL("../../", import.meta.url));
  const priorSource = execFileSync("git", ["show", "800bb2c:scripts/principal-association.mjs"], { cwd: root, encoding: "utf8" });
  // Load the real baseline with only its relative import resolved to the same native module.
  const resolved = priorSource.replace('"./assurance-state.mjs"', JSON.stringify(new URL("../../scripts/assurance-state.mjs", import.meta.url).href));
  const baseline = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`);
  const wrong = declarations(); wrong.bindings[0].native.workspace_id = "wrong";
  const cases = [undefined, JSON.stringify(declarations()), JSON.stringify(wrong)];
  for (const bindingsText of cases) {
    const options = { stateDir: f.dir, runId: f.runId, dailyViewText: viewText, bindingsText };
    assert.equal(JSON.stringify(projectPrincipalAssociations(options)), JSON.stringify(baseline.projectPrincipalAssociations(options)));
  }
});

test("association-v2 CLI is read-only and leaves native legacy/current report bytes unchanged", (t) => {
  const f = nativeFixture(t), root = fileURLToPath(new URL("../../", import.meta.url));
  const inputPath = join(f.dir, "key-bindings.json");
  writeFileSync(inputPath, JSON.stringify(keyedDeclarations()));
  const args = ["--state-dir", f.dir, "--run-id", f.runId, "--daily-view", join(fixtures, "p04/view.json"), "--bindings", inputPath];
  const paths = f.store.paths(f.runId);
  const snapshot = () => Object.fromEntries(readdirSync(paths.dir).map((name) => {
    const path = join(paths.dir, name), stat = statSync(path);
    return [name, { bytes: readFileSync(path, "utf8"), mtime: stat.mtimeMs, ctime: stat.ctimeMs }];
  }));
  const report = (format) => execFileSync(process.execPath, [join(root, "scripts/assurance-state.mjs"),
    "report", "--state-dir", f.dir, "--run-id", f.runId, "--format", format], { cwd: root, encoding: "utf8" });
  const formats = ["human", "in-toto", "current-v1"], before = snapshot(), reports = formats.map(report);
  const output = execFileSync(process.execPath, [join(root, "scripts/principal-association.mjs"), ...args], { cwd: root, encoding: "utf8" });
  assert.equal(JSON.parse(output).version, "principal-work-associations-v2");
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(formats.map(report), reports);
});

test("association-v1 real read-only host CLI leaves ledger and snapshot bytes/times unchanged", (t) => {
  const f = nativeFixture(t), paths = f.store.paths(f.runId);
  const files = () => Object.fromEntries(readdirSync(paths.dir).map((name) => {
    const path = join(paths.dir, name), stat = statSync(path);
    return [name, { bytes: readFileSync(path, "utf8"), mtime: stat.mtimeMs, ctime: stat.ctimeMs }];
  }));
  const before = files(), prior = buildCurrentApplicabilityProjection(f.store.load(f.runId));
  const out = [], err = [];
  const args = ["--state-dir", f.dir, "--run-id", f.runId, "--daily-view", join(fixtures, "p04/view.json"), "--bindings", join(fixtures, "host-bindings.json")];
  for (let i = 0; i < 2; i++) assert.equal(runAssociationCli(args, { out: (line) => out.push(line), err: (line) => err.push(line) }), 0, err.join("\n"));
  assert.equal(out[0], out[1]);
  assert.equal(JSON.parse(out[0]).associations[0].status, "bound");
  assert.deepEqual(files(), before);
  assert.deepEqual(buildCurrentApplicabilityProjection(f.store.load(f.runId)), prior);
  writeFileSync(paths.log, readFileSync(paths.log, "utf8").replace('"exit_code":0', '"exit_code":1'));
  assert.equal(runAssociationCli(args, { out: () => assert.fail("corrupt ledger must not project"), err: (line) => err.push(line) }), 1);
  assert.match(err.at(-1), /native-ledger-invalid/);
});

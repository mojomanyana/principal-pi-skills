import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  AssuranceStore,
  applyEvent,
  createInitialState,
  evaluateGate,
  matchesCriticalScope,
  parseWorkflowRequest,
  runCli,
  validateRunState,
  validateTaskPacket,
} from "../../scripts/assurance-state.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const now = "2026-08-19T12:00:00.000Z";
const base = "a".repeat(40);
const head1 = "b".repeat(40);
const head2 = "c".repeat(40);
const tree1 = "e".repeat(40);
const tree2 = "f".repeat(40);

function initial(request = "add export support", extra = {}) {
  return createInitialState({
    workflow: "feature",
    request,
    runId: "run-test-001",
    now,
    definitionDigests: { "skill:build": "d".repeat(64) },
    ...extra,
  });
}

function event(state, type, payload = {}, at = now) {
  const withTree = new Set(["code_changed", "evidence_recorded", "review_recorded", "repair_completed"]);
  const enriched = { ...payload };
  if (withTree.has(type) && enriched.tree_sha === undefined) {
    enriched.tree_sha = enriched.head_sha === head2 ? tree2 : tree1;
  }
  if (type === "review_recorded" && state.assurance.effective === "critical" && enriched.workspace_id === undefined) {
    enriched.workspace_id = state.active_workspace_id;
  }
  return applyEvent(state, { type, at, ...enriched });
}

function criticalReady({ consequential = true } = {}) {
  let state = initial("--assurance critical --critical-scope entire-run migrate users");
  state = event(state, "workspace_attached", {
    workspace_id: "ws-1",
    mode: "owned-isolated",
    path: "/tmp/owned-worktree",
    writer: "build",
  });
  state = event(state, "risk_classified", { level: consequential ? "consequential" : "substantive", reason: "test" });
  if (consequential) {
    state = event(state, "design_approved", {
      design_digest: "1".repeat(64),
      validation_strategy: "rehearse forward and rollback migrations on a production-shaped copy",
      observability: "watch migration errors and row-count parity",
      rollback_strategy: "restore the old table",
      abort_strategy: "stop before contract",
      one_way_doors: ["drop old column"],
      approved_by: "user",
    });
  }
  state = event(state, "plan_recorded", { plan_digest: "2".repeat(64) });
  state = event(state, "plan_critique_recorded", {
    verdict: "APPROVE",
    context_id: "ctx-plan-critic",
    plan_digest: "2".repeat(64),
  });
  state = event(state, "plan_discovery_recorded", {
    plan_digest: "2".repeat(64),
    workspace_id: "ws-1",
    checks: ["test -f test/a.test.ts", "node --test --test-name-pattern='migrates users' test/a.test.ts"],
    result: "pass",
    head_sha: base,
    tree_sha: tree1,
  });
  const packet = {
    schema_version: "1.0",
    run_id: state.run_id,
    task_id: "task-1",
    title: "Migrate users safely",
    authority: [state.request],
    global_constraints: ["single writer"],
    out_of_scope: ["billing"],
    critical_scope: { applies: true, matched_by: ["entire-run"] },
    files: ["db/migrations/001.sql", "src/auth/login.ts", "src/a.ts", "test/a.test.ts", "ops/runbook.md"],
    dependencies: [],
    done_command: "node --test --test-name-pattern='migrates users' test/a.test.ts",
    review_risk: "data migration",
    workspace_id: "ws-1",
    plan_digest: "2".repeat(64),
    definition_digests: { "skill:build": "d".repeat(64) },
  };
  state = event(state, "task_packet_recorded", { packet });
  return state;
}

function criticalBuildChange(state, {
  task_id = "task-1",
  head_sha = head1,
  changed_paths = ["src/a.ts"],
} = {}) {
  const task = state.tasks[task_id];
  state = event(state, "phase_started", {
    phase: "build",
    task_id,
    workspace_id: task.packet.workspace_id,
    definition_digest: state.definition_digests["skill:build"],
  });
  state = event(state, "code_changed", { head_sha, task_id, changed_paths });
  return event(state, "phase_completed", { phase: "build" });
}

test("standard is the compatible default and a tiny reversible request stays standard", () => {
  const parsed = parseWorkflowRequest("fix a typo in README.md");
  assert.deepEqual(parsed.assurance, {
    requested: "standard",
    effective: "standard",
    source: "default",
    reason: "No assurance profile was requested; standard is the default.",
    scope: { type: "entire-run", selectors: [] },
  });
  assert.equal(parsed.risk_trigger, null);
});

test("parses lean, critical, high alias, scope flags, and natural-language escalation", () => {
  assert.equal(parseWorkflowRequest("--assurance lean fix it").assurance.effective, "lean");

  const critical = parseWorkflowRequest('--assurance critical --critical-scope "task-2,task-4" migrate it');
  assert.equal(critical.assurance.requested, "critical");
  assert.equal(critical.assurance.source, "flag");
  assert.deepEqual(critical.assurance.scope, { type: "selectors", selectors: ["task-2", "task-4"] });

  const alias = parseWorkflowRequest("--assurance high secure auth");
  assert.equal(alias.assurance.effective, "critical");
  assert.equal(alias.assurance.source, "alias");

  for (const request of [
    "treat this as critical",
    "escalate this run to critical before the migration",
    "use critical assurance for db/migrations/**",
  ]) {
    assert.equal(parseWorkflowRequest(request).assurance.effective, "critical", request);
    assert.equal(parseWorkflowRequest(request).assurance.source, "natural-language", request);
  }
});

test("a critical scope flag is explicit critical intent and omitted scope means entire run", () => {
  const scoped = parseWorkflowRequest('--critical-scope "db/migrations/**,src/auth/**" change files');
  assert.equal(scoped.assurance.requested, "critical");
  assert.deepEqual(scoped.assurance.scope.selectors, ["db/migrations/**", "src/auth/**"]);

  const entire = parseWorkflowRequest("--assurance critical change files");
  assert.deepEqual(entire.assurance.scope, { type: "entire-run", selectors: [] });
  assert.throws(
    () => parseWorkflowRequest('--assurance lean --critical-scope "src/auth/**" change files'),
    /conflicts with a non-critical/i,
  );
  assert.throws(
    () => parseWorkflowRequest('--assurance standard --critical-scope "src/auth/**" change files'),
    /conflicts with a non-critical/i,
  );
  assert.throws(
    () => parseWorkflowRequest('--assurance critical --critical-scope "task-1,task-1" change files'),
    /unique items/i,
  );
  assert.throws(() => parseWorkflowRequest("--assurance= change files"), /assurance requires a non-empty value/i);
  assert.throws(() => parseWorkflowRequest("--critical-scope= change files"), /critical-scope requires a non-empty value/i);
});

test("policy elevates standard for evidenced one-way doors but does not inflate ordinary work", () => {
  const migration = parseWorkflowRequest("run a production database migration");
  assert.equal(migration.assurance.requested, "standard");
  assert.equal(migration.assurance.effective, "critical");
  assert.equal(migration.assurance.source, "policy");
  assert.match(migration.assurance.reason, /migration/i);

  assert.equal(parseWorkflowRequest("rename a local test helper").assurance.effective, "standard");
  assert.equal(parseWorkflowRequest("fix a typo in the billing runbook").assurance.effective, "standard",
    "risk words in tiny docs work must not trigger critical machinery");
  for (const mixed of [
    "Update README and add authentication to the API",
    "Update docs and add authz checks to the API",
    "Update docs and add billing charges to checkout",
    "Fix a README typo and drop a production table",
    "Update docs and refund customer payments",
    "Update comments and delete all customer data",
    "Update docs and remove a public endpoint with a breaking API change",
    "Update the runbook and rotate production credentials",
    "Update docs and force-push protected main history",
    "Update docs and deploy a production change",
  ]) assert.equal(parseWorkflowRequest(mixed).assurance.effective, "critical", mixed);
  assert.equal(parseWorkflowRequest("--assurance lean update auth docs").assurance.effective, "lean");
});

test("risk classification can stay level or increase but cannot silently decrease", () => {
  let state = initial();
  state = event(state, "risk_classified", { level: "substantive", reason: "source behavior changes" });
  state = event(state, "risk_classified", { level: "consequential", reason: "production one-way door discovered" });
  assert.throws(
    () => event(state, "risk_classified", { level: "tiny", reason: "skip completion review" }),
    /cannot be lowered/i,
  );
});

test("critical scope matches task ids and glob-like path selectors", () => {
  const taskScope = { type: "selectors", selectors: ["task-2", "task-4"] };
  assert.equal(matchesCriticalScope(taskScope, { task_id: "task-2", paths: [] }), true);
  assert.equal(matchesCriticalScope(taskScope, { task_id: "task-3", paths: [] }), false);

  const pathScope = { type: "selectors", selectors: ["db/migrations/**", "src/auth/**"] };
  assert.equal(matchesCriticalScope(pathScope, { task_id: "task-1", paths: ["src/auth/login.ts"] }), true);
  assert.equal(matchesCriticalScope(pathScope, { task_id: "task-1", paths: ["src/ui/button.ts"] }), false);
});

test("explicit critical assurance persists through task packets and phase events", () => {
  let state = criticalReady({ consequential: false });
  assert.equal(state.assurance.requested, "critical");
  assert.equal(state.assurance.effective, "critical");
  assert.equal(state.tasks["task-1"].packet.critical_scope.applies, true);
  state = event(state, "phase_started", {
    phase: "build",
    task_id: "task-1",
    workspace_id: "ws-1",
    definition_digest: "d".repeat(64),
  });
  assert.equal(state.assurance.effective, "critical");
  assert.equal(state.phases.build.task_id, "task-1");
  assert.equal(state.phases.build.workspace_id, "ws-1");
});

test("user-requested critical cannot silently downgrade; explicit user authorization and reason are required", () => {
  let state = initial("--assurance critical change auth");
  assert.throws(
    () => event(state, "assurance_downgraded", { to: "standard", authorized_by: "workflow", reason: "workspace missing" }),
    /explicit user authorization/i,
  );
  assert.throws(
    () => event(state, "assurance_downgraded", { to: "standard", authorized_by: "user", reason: "" }),
    /reason/i,
  );
  state = event(state, "assurance_downgraded", {
    to: "standard",
    authorized_by: "user",
    reason: "Accepted reduced isolation for this local-only rehearsal",
  });
  assert.equal(state.assurance.requested, "critical");
  assert.equal(state.assurance.effective, "standard");
  assert.equal(state.assurance.source, "user-downgrade");
});

test("mid-run escalation freezes base/head/tree and requires critical backfill", () => {
  let state = initial();
  state = event(state, "phase_started", { phase: "build", task_id: "task-1" });
  assert.throws(
    () => event(state, "assurance_escalated", { to: "critical", reason: "auth boundary found", source: "policy" }),
    /base_sha.*head_sha.*tree_sha/i,
  );
  state = event(state, "assurance_escalated", {
    to: "critical",
    reason: "auth boundary found",
    source: "policy",
    base_sha: base,
    head_sha: head1,
    tree_sha: tree1,
  });
  assert.equal(state.frozen_diff.base_sha, base);
  assert.equal(state.frozen_diff.head_sha, head1);
  assert.equal(state.frozen_diff.tree_sha, tree1);
  assert.equal(state.critical_backfill_required, true);
  const gate = evaluateGate(state, "pre-build", { task_id: "task-1" });
  assert.equal(gate.ok, false);
  assert.equal(gate.code, "BLOCKED_CRITICAL_ASSURANCE");
  assert.ok(gate.missing.some((m) => /backfill/i.test(m)));
});

test("critical escalation backfill requires concrete passing receipts tied to the frozen diff", () => {
  let state = initial();
  state = event(state, "phase_started", { phase: "build", task_id: "task-1" });
  state = event(state, "assurance_escalated", {
    to: "critical",
    reason: "risk discovered",
    source: "policy",
    base_sha: base,
    head_sha: head1,
    tree_sha: tree1,
  });
  assert.throws(
    () => event(state, "code_changed", { head_sha: head2, changed_paths: ["src/a.ts"] }),
    /backfill/i,
  );
  assert.ok(evaluateGate(state, "side-effect", { action: "push" }).missing.some((item) => /backfill/i.test(item)));
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /backfill/i.test(item)));
  assert.throws(() => event(state, "backfill_completed", { receipts: [null] }), /backfill receipt/i);
  assert.throws(
    () => event(state, "backfill_completed", {
      receipts: [{ control: "requirements-trace", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "REQ-1 covered", extra: true }],
    }),
    /unsupported field.*extra/i,
  );
  assert.throws(
    () => event(state, "backfill_completed", {
      receipts: [{ control: "requirements-trace", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "REQ-1 covered" }],
    }),
    /missing.*frozen-diff-review/i,
  );
  assert.throws(
    () => event(state, "backfill_completed", {
      receipts: [
        { control: "frozen-diff-review", base_sha: base, head_sha: head1, tree_sha: tree2, result: "pass", evidence: "wrong tree", context_id: "ctx-wrong-tree" },
        { control: "requirements-trace", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "REQ-1 covered" },
        { control: "risk-specific", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "risk check" },
      ],
    }),
    /frozen base\/head\/tree/i,
  );
  state = event(state, "backfill_completed", {
    receipts: [
      { control: "frozen-diff-review", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "review approved", context_id: "ctx-backfill" },
      { control: "requirements-trace", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "REQ-1 covered" },
      { control: "risk-specific", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "migration rehearsal passed" },
    ],
  });
  assert.equal(state.critical_backfill_required, false);
});

test("escalation rejects empty or malformed critical scopes instead of making every task out of scope", () => {
  const state = initial();
  assert.throws(
    () => event(state, "assurance_escalated", {
      to: "critical",
      reason: "risk discovered",
      source: "policy",
      scope: { type: "selectors", selectors: [] },
    }),
    /scope.*selector/i,
  );
  assert.throws(
    () => event(state, "assurance_escalated", {
      to: "critical",
      reason: "risk discovered",
      source: "policy",
      scope: { type: "entire-run", selectors: ["task-1"] },
    }),
    /entire-run.*empty/i,
  );
  assert.throws(
    () => event(state, "assurance_escalated", {
      to: "critical",
      reason: "risk discovered",
      source: "policy",
      scope: { type: "selectors", selectors: ["task-1", "task-1"], extra: true },
    }),
    /not allowed|unique items/i,
  );
  assert.throws(
    () => event(state, "assurance_escalated", {
      to: "critical",
      reason: "risk discovered",
      source: "policy",
      scope: { type: "selectors", selectors: ["src/auth/../outside.ts"] },
    }),
    /repository-relative path patterns/i,
  );
});

test("phase transitions are legal and completion without a start is rejected", () => {
  let state = initial();
  assert.throws(() => event(state, "phase_completed", { phase: "plan" }), /not started/i);
  state = event(state, "phase_started", { phase: "plan" });
  assert.throws(
    () => event(state, "phase_completed", { phase: "plan", plan_digest: "2".repeat(64) }),
    /use plan_recorded/i,
  );
  state = event(state, "phase_completed", { phase: "plan" });
  assert.equal(state.phases.plan.status, "completed");
  assert.throws(() => event(state, "phase_completed", { phase: "plan" }), /not started/i);
});

test("phase state rejects invalid definition digests and cannot overwrite another blocked task", () => {
  let state = initial();
  assert.throws(
    () => event(state, "phase_started", { phase: "plan", definition_digest: "not-a-sha256" }),
    /definition_digest must be sha256/i,
  );
  state = event(state, "phase_started", { phase: "build", task_id: "task-1" });
  state = event(state, "phase_blocked", { phase: "build", reason: "task-1 failed" });
  assert.throws(
    () => event(state, "phase_started", { phase: "build", task_id: "task-2" }),
    /blocked attempt must be resumed with the same task identity/i,
  );
  assert.equal(state.phases.build.task_id, "task-1");
  assert.equal(state.status, "blocked");
  const broken = structuredClone(state);
  broken.phases.build.definition_digest = "not-a-sha256";
  assert.ok(validateRunState(broken).errors.some((error) => /definition_digest must be sha256/i.test(error)));
});

test("restarting a blocked phase returns run status to active", () => {
  let state = initial();
  state = event(state, "phase_started", { phase: "plan" });
  state = event(state, "phase_blocked", { phase: "plan", reason: "authority missing" });
  assert.equal(state.status, "blocked");
  state = event(state, "phase_started", { phase: "plan" });
  assert.equal(state.status, "active");
  state = event(state, "phase_completed", { phase: "plan" });
  assert.equal(state.phases.plan.status, "completed");
  assert.equal(state.phases.plan.round, 2);
});

test("finish blocks active or blocked phases and unrelated starts do not clear a block", () => {
  let state = initial();
  state = event(state, "risk_classified", { level: "tiny", reason: "small local correction" });
  state = event(state, "phase_started", { phase: "plan" });
  state = event(state, "phase_blocked", { phase: "plan", reason: "authority missing" });
  state = event(state, "phase_started", { phase: "debug" });
  assert.equal(state.status, "blocked", "starting another phase must not erase the plan block");
  let gate = evaluateGate(state, "finish");
  assert.ok(gate.missing.some((item) => /active phase.*debug/i.test(item)));
  assert.ok(gate.missing.some((item) => /blocked phase.*plan/i.test(item)));

  state = event(state, "phase_started", { phase: "plan" });
  state = event(state, "phase_completed", { phase: "plan" });
  assert.equal(state.status, "active");
  gate = evaluateGate(state, "finish");
  assert.equal(gate.missing.some((item) => /blocked phase/i.test(item)), false);
  assert.ok(gate.missing.some((item) => /active phase.*debug/i.test(item)));
});

test("a path-scoped critical run requires the task packet before deciding a task is outside scope", () => {
  let state = initial('--assurance critical --critical-scope "src/auth/**" change endpoints');
  state = event(state, "risk_classified", { level: "substantive", reason: "authorization boundary" });
  const gate = evaluateGate(state, "pre-build", { task_id: "task-1" });
  assert.equal(gate.code, "BLOCKED_CRITICAL_ASSURANCE");
  assert.ok(gate.missing.some((item) => /task packet/i.test(item)));
});

test("consequential design approval requires validation, observability, rollback, abort, and user approval", () => {
  const state = initial("--assurance critical migrate users");
  const common = {
    design_digest: "1".repeat(64),
    validation_strategy: "migration rehearsal",
    observability: "error and parity metrics",
    rollback_strategy: "restore old table",
    abort_strategy: "stop before contract",
    one_way_doors: ["drop old column"],
    approved_by: "user",
  };
  for (const field of ["validation_strategy", "observability", "rollback_strategy", "abort_strategy"]) {
    assert.throws(() => event(state, "design_approved", { ...common, [field]: "" }), new RegExp(field));
  }
  assert.throws(() => event(state, "design_approved", { ...common, approved_by: "workflow" }), /approved_by.*user/i);
  assert.throws(() => event(state, "design_approved", { ...common, one_way_doors: ["drop", "drop"] }), /one_way_doors must be unique/i);
  assert.equal(event(state, "design_approved", common).design.approved, true);
});

test("critical pre-build gate blocks when isolation, design, critique, or packet controls are missing", () => {
  let state = initial("--assurance critical migrate the users table");
  state = event(state, "risk_classified", { level: "consequential", reason: "migration" });
  const gate = evaluateGate(state, "pre-build", { task_id: "task-1" });
  assert.equal(gate.ok, false);
  assert.equal(gate.code, "BLOCKED_CRITICAL_ASSURANCE");
  assert.ok(gate.missing.some((m) => /owned isolated workspace/i.test(m)));
  assert.ok(gate.missing.some((m) => /approved design/i.test(m)));
  assert.ok(gate.missing.some((m) => /plan critique/i.test(m)));
  assert.ok(gate.missing.some((m) => /task packet/i.test(m)));

  state = criticalReady();
  assert.deepEqual(evaluateGate(state, "pre-build", { task_id: "task-1" }), { ok: true, code: "OK", missing: [] });
});

test("critical packet persistence fails closed without current plan/workspace discovery", () => {
  const ready = criticalReady({ consequential: false });
  const legacy = structuredClone(ready);
  delete legacy.plan_discovery;
  assert.equal(validateRunState(legacy).ok, true, "pre-repair snapshots remain readable");
  assert.ok(evaluateGate(legacy, "pre-build", { task_id: "task-1" }).missing.some((item) => /passing discovery/i.test(item)));
  const packet = structuredClone(ready.tasks["task-1"].packet);
  let state = initial("--assurance critical --critical-scope entire-run migrate users");
  state = event(state, "workspace_attached", {
    workspace_id: "ws-1", mode: "owned-isolated", path: "/tmp/owned-worktree", writer: "build",
  });
  state = event(state, "risk_classified", { level: "substantive", reason: "test" });
  state = event(state, "plan_recorded", { plan_digest: "2".repeat(64) });
  state = event(state, "plan_critique_recorded", {
    verdict: "APPROVE", context_id: "ctx-discovery-gate", plan_digest: "2".repeat(64),
  });
  assert.throws(() => event(state, "task_packet_recorded", { packet }), /require passing discovery/i);
  assert.throws(() => event(state, "plan_discovery_recorded", {
    plan_digest: "3".repeat(64), workspace_id: "ws-1", checks: ["test -f test/a.test.ts"],
    result: "pass", head_sha: base, tree_sha: tree1,
  }), /current plan digest/i);
  state = event(state, "plan_discovery_recorded", {
    plan_digest: "2".repeat(64), workspace_id: "ws-1", checks: ["test -f test/a.test.ts"],
    result: "pass", head_sha: base, tree_sha: tree1,
  });
  const narrowed = structuredClone(packet);
  narrowed.authority = ["REQ-1 only"];
  assert.throws(() => event(state, "task_packet_recorded", { packet: narrowed }), /exactly preserve.*request/i);
  state = event(state, "task_packet_recorded", { packet });
  assert.equal(state.tasks["task-1"].packet.task_id, "task-1");
  state = event(state, "plan_recorded", { plan_digest: "3".repeat(64) });
  assert.equal(state.plan_discovery, null);
});

test("task packets validate required authority, constraints, scope, done command, risk, workspace, and digests", () => {
  const state = criticalReady();
  const packet = state.tasks["task-1"].packet;
  assert.equal(validateTaskPacket(packet).ok, true);
  for (const field of ["task_id", "authority", "global_constraints", "out_of_scope", "critical_scope", "done_command", "review_risk"]) {
    const broken = structuredClone(packet);
    delete broken[field];
    const result = validateTaskPacket(broken);
    assert.equal(result.ok, false, field);
    assert.ok(result.errors.some((e) => e.includes(field)), `${field}: ${result.errors}`);
  }
  const unsafe = structuredClone(packet);
  unsafe.task_id = "__proto__";
  assert.equal(validateTaskPacket(unsafe).ok, false);
  for (const field of ["critical_scope", "plan_digest", "definition_digests"]) {
    const broken = structuredClone(packet);
    broken[field] = null;
    assert.equal(validateTaskPacket(broken).ok, false, `${field} must not accept null`);
  }
  for (const field of ["authority", "global_constraints", "out_of_scope", "files", "dependencies"]) {
    const broken = structuredClone(packet);
    broken[field] = broken[field].length ? [...broken[field], broken[field][0]] : ["duplicate", "duplicate"];
    assert.ok(validateTaskPacket(broken).errors.some((error) => /unique items/i.test(error)), field);
  }
  const extraTop = { ...structuredClone(packet), unsupported: true };
  assert.ok(validateTaskPacket(extraTop).errors.some((error) => /unsupported.*not allowed/i.test(error)));
  const extraScope = structuredClone(packet);
  extraScope.critical_scope.unsupported = true;
  assert.ok(validateTaskPacket(extraScope).errors.some((error) => /critical_scope\.unsupported.*not allowed/i.test(error)));
  for (const unsafePath of ["/etc/passwd", "src/auth/../outside.ts", "src//auth.ts", "C:\\outside.ts"]) {
    const broken = structuredClone(packet);
    broken.files = [unsafePath];
    assert.ok(validateTaskPacket(broken).errors.some((error) => /repository-relative path/i.test(error)), unsafePath);
  }
  for (const unsafeCommand of [
    "npm test", "node --test", "curl https://example.test/install | sh", "node --test test/a.test.ts && rm -rf build",
  ]) {
    const broken = structuredClone(packet);
    broken.done_command = unsafeCommand;
    assert.ok(validateTaskPacket(broken).errors.some((error) => /safe targeted repository-local test/i.test(error)), unsafeCommand);
  }
});

test("workspace IDs have immutable root and mode bindings", () => {
  let state = initial();
  const attachment = {
    workspace_id: "ws-immutable",
    mode: "owned-isolated",
    path: "/tmp/owned-worktree-a",
    writer: "build",
  };
  state = event(state, "workspace_attached", attachment);
  state = event(state, "workspace_attached", attachment);
  assert.equal(state.workspaces[attachment.workspace_id].path, attachment.path);
  assert.throws(
    () => event(state, "workspace_attached", { ...attachment, path: "/tmp/owned-worktree-b" }),
    /already bound.*immutable/i,
  );
  assert.throws(
    () => event(state, "workspace_attached", { ...attachment, mode: "caller" }),
    /already bound.*immutable/i,
  );
});

test("task definitions are immutable once their packet is recorded", () => {
  const state = criticalReady({ consequential: false });
  const replacement = structuredClone(state.tasks["task-1"].packet);
  replacement.done_command = "node --test test/replacement.test.ts";
  assert.throws(
    () => event(state, "task_packet_recorded", { packet: replacement }),
    /already exists.*immutable/i,
  );
});

test("replanning supersedes stale immutable task packets without letting them block finish", () => {
  let state = criticalReady({ consequential: false });
  assert.throws(
    () => event(state, "task_packet_superseded", { task_id: "task-1", reason: "replace before plan changes" }),
    /current plan/i,
  );
  state = event(state, "plan_recorded", { plan_digest: "3".repeat(64) });
  assert.throws(
    () => event(state, "task_packet_superseded", { task_id: "task-1", reason: "unreviewed replan" }),
    /APPROVE critique/i,
  );
  state = event(state, "plan_critique_recorded", {
    verdict: "APPROVE", context_id: "ctx-replan-critic", plan_digest: "3".repeat(64),
  });
  state = event(state, "task_packet_superseded", {
    task_id: "task-1",
    reason: "approved replan replaces this authority",
  });
  assert.equal(state.tasks["task-1"].status, "superseded");
  assert.throws(
    () => event(state, "phase_started", {
      phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
    }),
    /superseded/i,
  );
  const gate = evaluateGate(state, "finish");
  assert.equal(gate.missing.some((item) => /task-1.*current plan digest/i.test(item)), false);

  let standard = criticalReady({ consequential: false });
  standard = event(standard, "assurance_downgraded", {
    to: "standard", authorized_by: "user", reason: "local replan uses standard controls",
  });
  standard = event(standard, "plan_recorded", { plan_digest: "4".repeat(64) });
  standard = event(standard, "plan_critique_recorded", {
    verdict: "APPROVE", context_id: "ctx-standard-replan", plan_digest: "4".repeat(64),
  });
  standard = event(standard, "task_packet_superseded", { task_id: "task-1", reason: "replaced" });
  assert.throws(
    () => event(standard, "code_changed", {
      head_sha: head1, tree_sha: tree1, task_id: "task-1", changed_paths: ["src/a.ts"],
    }),
    /superseded/i,
  );
  standard = event(standard, "finding_recorded", { finding_id: "REV-SUPERSEDED", summary: "stale repair" });
  standard = event(standard, "finding_adjudicated", {
    finding_id: "REV-SUPERSEDED", disposition: "accepted", reason: "test stale authority",
  });
  assert.throws(
    () => event(standard, "repair_started", { finding_id: "REV-SUPERSEDED", task_id: "task-1" }),
    /superseded/i,
  );

  let activeRepair = criticalReady({ consequential: false });
  activeRepair = event(activeRepair, "assurance_downgraded", {
    to: "standard", authorized_by: "user", reason: "local replan uses standard controls",
  });
  activeRepair = event(activeRepair, "finding_recorded", { finding_id: "REV-ACTIVE", summary: "repair before replan" });
  activeRepair = event(activeRepair, "finding_adjudicated", {
    finding_id: "REV-ACTIVE", disposition: "accepted", reason: "confirmed before replan",
  });
  activeRepair = event(activeRepair, "repair_started", { finding_id: "REV-ACTIVE", task_id: "task-1" });
  assert.throws(
    () => event(activeRepair, "plan_recorded", { plan_digest: "5".repeat(64) }),
    /active repair/i,
  );
  const forgedSupersededRepair = structuredClone(activeRepair);
  forgedSupersededRepair.tasks["task-1"].status = "superseded";
  forgedSupersededRepair.tasks["task-1"].superseded_at = now;
  forgedSupersededRepair.tasks["task-1"].superseded_reason = "defensive validation fixture";
  assert.throws(
    () => event(forgedSupersededRepair, "repair_completed", {
      finding_id: "REV-ACTIVE", task_id: "task-1", head_sha: head1, tree_sha: tree1,
      changed_paths: ["src/a.ts"],
    }),
    /superseded/i,
  );
});

test("active repair can be auditedly suspended across critical escalation and restarted with new bindings", () => {
  let state = initial();
  state = event(state, "code_changed", { head_sha: head1, tree_sha: tree1, changed_paths: ["src/a.ts"] });
  state = event(state, "finding_recorded", { finding_id: "REV-ESCALATE", summary: "risk discovered during repair" });
  state = event(state, "finding_adjudicated", {
    finding_id: "REV-ESCALATE", disposition: "accepted", reason: "confirmed before escalation",
  });
  state = event(state, "repair_started", { finding_id: "REV-ESCALATE" });
  state = event(state, "assurance_escalated", {
    to: "critical", source: "policy", reason: "authorization boundary discovered",
    base_sha: base, head_sha: head1, tree_sha: tree1,
  });
  assert.throws(
    () => event(state, "plan_recorded", { plan_digest: "2".repeat(64) }),
    /active repair/i,
  );
  state = event(state, "repair_suspended", {
    finding_id: "REV-ESCALATE", reason: "rebind repair under critical authority",
  });
  assert.equal(state.findings["REV-ESCALATE"].repair.status, "suspended");
  state = event(state, "workspace_attached", {
    workspace_id: "ws-1", mode: "owned-isolated", path: "/tmp/owned-worktree", writer: "build",
  });
  state = event(state, "risk_classified", { level: "substantive", reason: "authorization boundary" });
  state = event(state, "plan_recorded", { plan_digest: "2".repeat(64) });
  state = event(state, "plan_critique_recorded", {
    verdict: "APPROVE", context_id: "ctx-suspended-replan", plan_digest: "2".repeat(64),
  });
  state = event(state, "plan_discovery_recorded", {
    plan_digest: "2".repeat(64), workspace_id: "ws-1",
    checks: ["test -f test/a.test.ts"], result: "pass", head_sha: head1, tree_sha: tree1,
  });
  const packet = structuredClone(criticalReady({ consequential: false }).tasks["task-1"].packet);
  packet.authority = [state.request];
  state = event(state, "task_packet_recorded", { packet });
  state = event(state, "backfill_completed", {
    receipts: [
      { control: "frozen-diff-review", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "review approved", context_id: "ctx-suspended-backfill" },
      { control: "requirements-trace", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "REQ-1 covered" },
      { control: "risk-specific", base_sha: base, head_sha: head1, tree_sha: tree1, result: "pass", evidence: "authorization checks passed" },
    ],
  });
  state = event(state, "phase_started", {
    phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
  });
  state = event(state, "repair_started", {
    finding_id: "REV-ESCALATE", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
  });
  assert.equal(state.findings["REV-ESCALATE"].repair.previous_attempts.length, 1);
  state = event(state, "repair_completed", {
    finding_id: "REV-ESCALATE", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
    head_sha: head1, tree_sha: tree2, changed_paths: ["src/a.ts"],
  });
  assert.equal(state.findings["REV-ESCALATE"].repair.status, "completed");
});

test("stale task authority cannot start repair before explicit packet supersession", () => {
  let state = criticalReady({ consequential: false });
  state = event(state, "assurance_downgraded", {
    to: "standard", authorized_by: "user", reason: "local replan uses standard controls",
  });
  state = event(state, "plan_recorded", { plan_digest: "6".repeat(64) });
  state = event(state, "finding_recorded", { finding_id: "REV-STALE", summary: "stale packet repair" });
  state = event(state, "finding_adjudicated", {
    finding_id: "REV-STALE", disposition: "accepted", reason: "exercise stale authority",
  });
  assert.throws(
    () => event(state, "repair_started", { finding_id: "REV-STALE", task_id: "task-1" }),
    /stale for the current plan/i,
  );
});

test("critical build phase binds task, active workspace, and current Build definition", () => {
  const state = criticalReady({ consequential: false });
  assert.throws(
    () => event(state, "phase_started", { phase: "build", task_id: "task-1", workspace_id: "ws-other", definition_digest: "d".repeat(64) }),
    /workspace/i,
  );
  assert.throws(
    () => event(state, "phase_started", { phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: "e".repeat(64) }),
    /current Build definition digest/i,
  );
  const started = event(state, "phase_started", {
    phase: "build",
    task_id: "task-1",
    workspace_id: "ws-1",
    definition_digest: "d".repeat(64),
  });
  assert.equal(started.phases.build.workspace_id, "ws-1");
});

test("critical code changes require the matching active Build phase", () => {
  let state = criticalReady({ consequential: false });
  assert.throws(
    () => event(state, "code_changed", { head_sha: head1, task_id: "task-1", changed_paths: ["src/a.ts"] }),
    /matching active Build phase/i,
  );
  state = event(state, "phase_started", {
    phase: "build",
    task_id: "task-1",
    workspace_id: "ws-1",
    definition_digest: "d".repeat(64),
  });
  assert.throws(
    () => event(state, "code_changed", { head_sha: head1, task_id: "task-2", changed_paths: ["src/a.ts"] }),
    /validated task packet|matching active Build phase/i,
  );
  assert.throws(
    () => event(state, "code_changed", { head_sha: head1, task_id: "task-1", changed_paths: ["src/not-authorized.ts"] }),
    /outside the task packet/i,
  );
  assert.throws(
    () => event(state, "code_changed", { head_sha: head1, task_id: "task-1", changed_paths: ["src/auth/../outside.ts"] }),
    /canonical repository-relative paths/i,
  );
  state = event(state, "code_changed", { head_sha: head1, task_id: "task-1", changed_paths: ["src/a.ts"] });
  state = event(state, "phase_completed", { phase: "build" });
  assert.equal(state.tasks["task-1"].status, "completed");
});

test("critical mutations recheck pre-build after authority changes during Build", () => {
  let state = criticalReady({ consequential: false });
  state = event(state, "phase_started", {
    phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
  });
  state = event(state, "risk_classified", { level: "consequential", reason: "one-way door discovered during Build" });
  assert.throws(
    () => event(state, "code_changed", { head_sha: head1, task_id: "task-1", changed_paths: ["src/a.ts"] }),
    /approved design/i,
  );
});

test("critical repairs require task, workspace, definition, and active Build bindings", () => {
  let state = criticalReady({ consequential: false });
  state = event(state, "finding_recorded", { finding_id: "REV-CRIT", summary: "repair the migration guard" });
  state = event(state, "finding_adjudicated", { finding_id: "REV-CRIT", disposition: "accepted", reason: "confirmed" });
  assert.throws(() => event(state, "repair_started", { finding_id: "REV-CRIT" }), /validated task packet/i);
  state = event(state, "phase_started", {
    phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
  });
  state = event(state, "repair_started", {
    finding_id: "REV-CRIT", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
  });
  assert.throws(
    () => event(state, "repair_completed", {
      finding_id: "REV-CRIT", head_sha: head1, changed_paths: ["src/a.ts"],
      task_id: "task-1", workspace_id: "ws-other", definition_digest: "d".repeat(64),
    }),
    /workspace_id must match repair_started/i,
  );
  state = event(state, "repair_completed", {
    finding_id: "REV-CRIT", head_sha: head1, changed_paths: ["src/a.ts"],
    task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
  });
  state = event(state, "phase_completed", { phase: "build" });
  assert.equal(state.findings["REV-CRIT"].repair.status, "completed");
  assert.equal(state.tasks["task-1"].status, "completed");
});

test("critical pre-build binds task packets to the current plan and definition digests", () => {
  const state = criticalReady({ consequential: false });
  const changedPlan = event(state, "plan_recorded", { plan_digest: "3".repeat(64) });
  assert.ok(evaluateGate(changedPlan, "pre-build", { task_id: "task-1" }).missing.some((item) => /current plan digest/i.test(item)));

  const changedDefinition = structuredClone(state);
  changedDefinition.definition_digests["skill:build"] = "e".repeat(64);
  assert.ok(evaluateGate(changedDefinition, "pre-build", { task_id: "task-1" }).missing.some((item) => /definition digest/i.test(item)));
});

test("critical pre-build blocks on incomplete scoped dependency tasks", () => {
  let state = criticalReady({ consequential: false });
  const second = structuredClone(state.tasks["task-1"].packet);
  second.task_id = "task-2";
  second.title = "Wire the completed authorization task into export";
  second.dependencies = ["task-1"];
  state = event(state, "task_packet_recorded", { packet: second });
  let gate = evaluateGate(state, "pre-build", { task_id: "task-2" });
  assert.ok(gate.missing.some((item) => /task-1 critical dependency completion controls/i.test(item)));

  state = criticalBuildChange(state, { changed_paths: ["src/auth/login.ts"] });
  state = event(state, "evidence_recorded", {
    kind: "exact-target", command: "node --test test/auth.test.mjs", exit_code: 0, head_sha: head1, task_id: "task-1",
  });
  for (const [axis, context_id] of [["specification", "ctx-dep-spec"], ["quality", "ctx-dep-quality"]]) {
    state = event(state, "review_recorded", { axis, verdict: "APPROVE", context_id, head_sha: head1, task_id: "task-1" });
  }
  gate = evaluateGate(state, "pre-build", { task_id: "task-2" });
  assert.equal(gate.ok, true);
});

test("critical task completion cannot pass without a completed Build phase", () => {
  let state = criticalReady({ consequential: false });
  state = event(state, "evidence_recorded", {
    kind: "exact-target", command: "synthetic", exit_code: 0, head_sha: head1, task_id: "task-1",
  });
  for (const [axis, context_id] of [["specification", "ctx-no-build-spec"], ["quality", "ctx-no-build-quality"]]) {
    state = event(state, "review_recorded", { axis, verdict: "APPROVE", context_id, head_sha: head1, task_id: "task-1" });
  }
  assert.ok(evaluateGate(state, "task-complete", { task_id: "task-1" }).missing.some((item) => /completed Build phase/i.test(item)));
});

test("critical task evidence and reviews must follow Build completion", () => {
  let state = criticalReady({ consequential: false });
  state = event(state, "phase_started", {
    phase: "build", task_id: "task-1", workspace_id: "ws-1", definition_digest: "d".repeat(64),
  });
  state = event(state, "code_changed", { head_sha: head1, task_id: "task-1", changed_paths: ["src/a.ts"] });
  state = event(state, "evidence_recorded", {
    kind: "exact-target", command: "too early", exit_code: 0, head_sha: head1, task_id: "task-1",
  });
  for (const [axis, context_id] of [["specification", "ctx-active-spec"], ["quality", "ctx-active-quality"]]) {
    state = event(state, "review_recorded", { axis, verdict: "APPROVE", context_id, head_sha: head1, task_id: "task-1" });
  }
  state = event(state, "phase_completed", { phase: "build" });
  const gate = evaluateGate(state, "task-complete", { task_id: "task-1" });
  assert.ok(gate.missing.some((item) => /evidence after the completed Build phase/i.test(item)));
  assert.ok(gate.missing.some((item) => /specification APPROVE/i.test(item)));
  assert.ok(gate.missing.some((item) => /quality\/security APPROVE/i.test(item)));
});

test("critical task completion requires separate fresh spec and quality review contexts", () => {
  let state = criticalReady({ consequential: false });
  state = criticalBuildChange(state, { changed_paths: ["src/auth/login.ts"] });
  state = event(state, "evidence_recorded", {
    kind: "exact-target",
    command: "node --test test/auth.test.mjs",
    exit_code: 0,
    head_sha: head1,
    task_id: "task-1",
  });
  state = event(state, "review_recorded", {
    axis: "specification",
    verdict: "APPROVE",
    context_id: "ctx-review-1",
    task_id: "task-1",
    head_sha: head1,
  });
  let gate = evaluateGate(state, "task-complete", { task_id: "task-1" });
  assert.ok(gate.missing.some((m) => /quality/i.test(m)));

  assert.throws(() => event(state, "review_recorded", {
    axis: "quality",
    verdict: "APPROVE",
    context_id: "ctx-review-1",
    task_id: "task-1",
    head_sha: head1,
  }), /already used by an independent invocation/i);
  gate = evaluateGate(state, "task-complete", { task_id: "task-1" });
  assert.ok(gate.missing.some((m) => /quality/i.test(m)));

  state = event(state, "review_recorded", {
    axis: "quality",
    verdict: "APPROVE",
    context_id: "ctx-review-2",
    task_id: "task-1",
    head_sha: head1,
  });
  assert.equal(evaluateGate(state, "task-complete", { task_id: "task-1" }).ok, true);
});

test("fresh context IDs cannot be reused across plan critiques, tasks, or review axes", () => {
  let state = criticalReady({ consequential: false });
  assert.throws(() => event(state, "review_recorded", {
    axis: "specification", verdict: "APPROVE", context_id: "ctx-plan-critic", task_id: "task-1", head_sha: head1,
  }), /already used by an independent invocation/i);
  state = event(state, "review_recorded", {
    axis: "specification", verdict: "APPROVE", context_id: "ctx-shared-review", task_id: "task-1", head_sha: head1,
  });
  const second = structuredClone(state.tasks["task-1"].packet);
  second.task_id = "task-2";
  second.title = "Second task";
  state = event(state, "task_packet_recorded", { packet: second });
  assert.throws(() => event(state, "review_recorded", {
    axis: "quality", verdict: "APPROVE", context_id: "ctx-shared-review", task_id: "task-2", head_sha: head1,
  }), /already used by an independent invocation/i);
});

test("critical task evidence and reviews must come from the packet's active owned workspace", () => {
  let state = criticalReady({ consequential: false });
  state = criticalBuildChange(state);
  state = event(state, "workspace_attached", {
    workspace_id: "ws-2",
    mode: "caller",
    path: "/tmp/unrelated-worktree",
    writer: "build",
  });
  state = event(state, "evidence_recorded", {
    kind: "exact-target",
    command: "node --test test/a.test.mjs",
    exit_code: 0,
    head_sha: head1,
    task_id: "task-1",
  });
  for (const [axis, context_id] of [["specification", "ctx-wrong-spec"], ["quality", "ctx-wrong-quality"]]) {
    assert.throws(
      () => event(state, "review_recorded", {
        axis, verdict: "APPROVE", context_id, head_sha: head1, task_id: "task-1", workspace_id: "ws-2",
      }),
      /task packet's active writer workspace/i,
    );
  }
  const gate = evaluateGate(state, "task-complete", { task_id: "task-1" });
  assert.equal(gate.ok, false);
  assert.ok(gate.missing.some((item) => /owned workspace|packet workspace/i.test(item)));
});

test("critical review receipts require explicit writer-workspace attribution and current candidate identity", () => {
  let state = criticalReady({ consequential: false });
  state = criticalBuildChange(state);
  const review = {
    type: "review_recorded",
    at: now,
    axis: "specification",
    verdict: "APPROVE",
    context_id: "ctx-explicit-workspace",
    head_sha: head1,
    tree_sha: tree1,
    task_id: "task-1",
  };
  assert.throws(() => applyEvent(state, review), /explicit workspace_id/i);
  assert.throws(
    () => applyEvent(state, { ...review, workspace_id: "ws-missing" }),
    /unknown review workspace|task packet.*workspace/i,
  );
  assert.throws(
    () => applyEvent(state, { ...review, workspace_id: "ws-1", tree_sha: tree2 }),
    /current candidate head\/tree/i,
  );
  state = applyEvent(state, { ...review, workspace_id: "ws-1" });
  assert.equal(state.reviews.at(-1).workspace_id, "ws-1");
});

test("evidence becomes stale after the last relevant code change", () => {
  let state = initial();
  state = event(state, "risk_classified", { level: "tiny", reason: "small local correction" });
  state = event(state, "code_changed", { head_sha: head1, task_id: "task-1", changed_paths: ["src/a.ts"] });
  state = event(state, "evidence_recorded", {
    kind: "exact-target",
    command: "node --test test/a.test.mjs",
    exit_code: 0,
    head_sha: head1,
  });
  state = event(state, "finish_selected", { choice: "keep" });
  assert.equal(evaluateGate(state, "finalize").ok, true);

  state = event(state, "code_changed", {
    head_sha: head1, tree_sha: tree2, task_id: "task-1", changed_paths: ["src/a.ts"],
  });
  state = event(state, "evidence_recorded", {
    kind: "exact-target", command: "stale tree", exit_code: 0, head_sha: head1, tree_sha: tree1,
  });
  const gate = evaluateGate(state, "finalize");
  assert.equal(gate.ok, false);
  assert.ok(gate.missing.some((m) => /fresh exact-target evidence/i.test(m)));
});

test("critical finish requires full evidence, requirements trace, risk checks, and whole-change review", () => {
  let state = criticalReady({ consequential: false });
  state = criticalBuildChange(state);
  for (const kind of ["exact-target", "full-suite", "requirements-trace", "risk-specific"]) {
    state = event(state, "evidence_recorded", { kind, command: `check-${kind}`, exit_code: 0, head_sha: head1 });
  }
  assert.throws(() => event(state, "review_recorded", {
    axis: "whole-change",
    verdict: "APPROVE",
    spec_verdict: "APPROVE",
    quality_verdict: "CHANGES-REQUESTED",
    context_id: "ctx-partial",
    head_sha: head1,
  }), /both specification and quality/i);
  state = event(state, "review_recorded", {
    axis: "whole-change",
    verdict: "APPROVE",
    spec_verdict: "APPROVE",
    quality_verdict: "APPROVE",
    context_id: "ctx-final",
    head_sha: head1,
  });
  state = event(state, "finish_selected", { choice: "keep" });
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /task-1.*completion controls/i.test(item)));
  state = event(state, "evidence_recorded", {
    kind: "exact-target",
    command: "check-task-1",
    exit_code: 0,
    head_sha: head1,
    task_id: "task-1",
  });
  for (const [axis, context_id] of [["specification", "ctx-final-spec"], ["quality", "ctx-final-quality"]]) {
    state = event(state, "review_recorded", { axis, verdict: "APPROVE", context_id, head_sha: head1, task_id: "task-1" });
  }
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /whole-change review recorded after every scoped task/i.test(item)));
  state = event(state, "review_recorded", {
    axis: "whole-change", verdict: "APPROVE", spec_verdict: "APPROVE", quality_verdict: "APPROVE",
    context_id: "ctx-final-after-tasks", head_sha: head1,
  });
  assert.equal(evaluateGate(state, "finalize").ok, true);

  const replanned = event(state, "plan_recorded", { plan_digest: "3".repeat(64) });
  assert.ok(evaluateGate(replanned, "finalize").missing.some((item) => /current plan digest/i.test(item)));

  const stale = criticalBuildChange(state, { head_sha: head2 });
  assert.equal(evaluateGate(stale, "finalize").code, "BLOCKED_CRITICAL_ASSURANCE");

  state = event(state, "phase_started", { phase: "git-ops" });
  assert.equal(evaluateGate(state, "finalize").ok, true);
  state = event(state, "finalization_completed", {
    final_branch: "principal/run-test-001", head_sha: head2, tree_sha: tree1,
  });
  assert.equal(evaluateGate(state, "finish").ok, true);
});

test("whole-change review must follow task evidence as well as task reviews", () => {
  let state = criticalReady({ consequential: false });
  state = criticalBuildChange(state);
  for (const [axis, context_id] of [["specification", "ctx-order-spec"], ["quality", "ctx-order-quality"]]) {
    state = event(state, "review_recorded", {
      axis, verdict: "APPROVE", context_id, head_sha: head1, task_id: "task-1",
    });
  }
  state = event(state, "review_recorded", {
    axis: "whole-change", verdict: "APPROVE", spec_verdict: "APPROVE", quality_verdict: "APPROVE",
    context_id: "ctx-order-whole", head_sha: head1,
  });
  state = event(state, "evidence_recorded", {
    kind: "exact-target", command: "node --test test/a.test.mjs", exit_code: 0,
    head_sha: head1, task_id: "task-1", workspace_id: "ws-1",
  });
  state = event(state, "finish_selected", { choice: "keep" });
  assert.ok(
    evaluateGate(state, "finish").missing.some((item) => /whole-change review.*task evidence/i.test(item)),
  );
});

test("critical finish rechecks pre-build controls after later risk changes", () => {
  let state = criticalReady({ consequential: false });
  state = criticalBuildChange(state);
  state = event(state, "risk_classified", { level: "consequential", reason: "one-way door discovered after Build" });
  state = event(state, "finish_selected", { choice: "keep" });
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /task-1 critical pre-build controls.*approved design/i.test(item)));
});

test("critical finish cannot pass vacuously without a scoped task packet", () => {
  let state = initial("--assurance critical change auth");
  state = event(state, "risk_classified", { level: "substantive", reason: "authorization boundary" });
  state = event(state, "finish_selected", { choice: "keep" });
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /task packet in critical scope/i.test(item)));
});

test("mutation, evidence, and review receipts require candidate tree identity", () => {
  const state = initial();
  assert.throws(
    () => applyEvent(state, { type: "code_changed", at: now, head_sha: head1, changed_paths: ["src/a.ts"] }),
    /head_sha and tree_sha/i,
  );
  assert.throws(
    () => applyEvent(state, { type: "evidence_recorded", at: now, kind: "exact-target", command: "test", exit_code: 0, head_sha: head1 }),
    /head_sha and tree_sha/i,
  );
});

test("event entity ids reject prototype and path-like keys", () => {
  const state = initial();
  assert.throws(
    () => event(state, "code_changed", { head_sha: head1, task_id: "__proto__", changed_paths: ["src/a.ts"] }),
    /task_id/i,
  );
  for (const finding_id of ["__proto__", "constructor"]) {
    assert.throws(
      () => event(state, "finding_adjudicated", { finding_id, disposition: "accepted", reason: "x" }),
      /finding_id/i,
    );
  }
});

test("finding adjudication blocks needs-context and repairs consume accepted finding ids one at a time", () => {
  let state = initial();
  state = event(state, "finding_recorded", { finding_id: "REV-001", summary: "unclear auth rule" });
  state = event(state, "finding_adjudicated", {
    finding_id: "REV-001",
    disposition: "needs-context",
    reason: "requirement is ambiguous",
  });
  assert.throws(() => event(state, "repair_started", { finding_id: "REV-001" }), /needs-context/i);

  state = event(state, "finding_recorded", { finding_id: "REV-002", summary: "missing boundary test" });
  state = event(state, "finding_adjudicated", {
    finding_id: "REV-002",
    disposition: "accepted",
    reason: "requirement and test evidence agree",
  });
  state = event(state, "repair_started", { finding_id: "REV-002" });
  assert.throws(
    () => event(state, "finding_adjudicated", { finding_id: "REV-002", disposition: "rejected", reason: "hide active repair" }),
    /cannot be re-adjudicated after repair starts/i,
  );
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /active repair.*REV-002/i.test(item)));
  state = event(state, "repair_completed", {
    finding_id: "REV-002",
    head_sha: head1,
    changed_paths: ["test/auth.test.ts"],
  });
  assert.equal(state.findings["REV-002"].repair.status, "completed");
});

test("substantive standard finish requires classification and a fresh completion review", () => {
  let state = initial();
  state = event(state, "code_changed", { head_sha: head1, changed_paths: ["src/a.ts"] });
  state = event(state, "evidence_recorded", { kind: "exact-target", command: "npm test", exit_code: 0, head_sha: head1 });
  state = event(state, "finish_selected", { choice: "keep" });
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /risk classification/i.test(item)));
  state = event(state, "risk_classified", { level: "substantive", reason: "behavioral source change" });
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /completion review.*APPROVE/i.test(item)));
});

test("review sub-verdict runtime validation matches the persisted schema", () => {
  const state = initial();
  assert.throws(() => event(state, "review_recorded", {
    axis: "specification", verdict: "APPROVE", spec_verdict: "BOGUS",
    context_id: "ctx-bogus", head_sha: head1,
  }), /spec_verdict is invalid/i);
  let valid = event(state, "review_recorded", {
    axis: "specification", verdict: "APPROVE", context_id: "ctx-valid-shape", head_sha: head1,
  });
  valid = structuredClone(valid);
  valid.reviews[0].spec_verdict = "BOGUS";
  const result = validateRunState(valid);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /spec_verdict is invalid/i.test(error)));
});

test("task-scoped receipts cannot satisfy whole-change finish controls", () => {
  let state = initial();
  state = event(state, "risk_classified", { level: "substantive", reason: "behavioral source change" });
  state = event(state, "code_changed", { head_sha: head1, task_id: "task-1", changed_paths: ["src/a.ts"] });
  state = event(state, "evidence_recorded", {
    kind: "exact-target", command: "npm test -- task-1", exit_code: 0, head_sha: head1, task_id: "task-1",
  });
  state = event(state, "review_recorded", {
    axis: "combined", verdict: "APPROVE", context_id: "ctx-task-only", head_sha: head1, task_id: "task-1",
  });
  state = event(state, "finish_selected", { choice: "keep" });
  const gate = evaluateGate(state, "finish");
  assert.ok(gate.missing.some((item) => /fresh exact-target/i.test(item)));
  assert.ok(gate.missing.some((item) => /completion review.*APPROVE/i.test(item)));
  assert.throws(() => event(state, "review_recorded", {
    axis: "whole-change", verdict: "APPROVE", spec_verdict: "APPROVE", quality_verdict: "APPROVE",
    context_id: "ctx-not-whole", head_sha: head1, task_id: "task-1",
  }), /must not be scoped to one task/i);
});

test("later authority changes invalidate standard completion evidence and review", () => {
  let state = initial();
  state = event(state, "risk_classified", { level: "substantive", reason: "behavioral source change" });
  state = event(state, "plan_recorded", { plan_digest: "2".repeat(64) });
  state = event(state, "code_changed", { head_sha: head1, changed_paths: ["src/a.ts"] });
  state = event(state, "evidence_recorded", { kind: "exact-target", command: "npm test", exit_code: 0, head_sha: head1 });
  state = event(state, "review_recorded", {
    axis: "combined", verdict: "APPROVE", context_id: "ctx-authority-a", head_sha: head1,
  });
  state = event(state, "finish_selected", { choice: "keep" });
  assert.equal(evaluateGate(state, "finalize").ok, true);

  state = event(state, "plan_recorded", { plan_digest: "3".repeat(64) });
  const gate = evaluateGate(state, "finalize");
  assert.ok(gate.missing.some((item) => /fresh exact-target evidence/i.test(item)));
  assert.ok(gate.missing.some((item) => /completion review.*APPROVE/i.test(item)));
});

test("finish cannot ignore a latest completion review that requested changes", () => {
  let state = initial();
  state = event(state, "risk_classified", { level: "substantive", reason: "behavioral source change" });
  state = event(state, "code_changed", { head_sha: head1, changed_paths: ["src/a.ts"] });
  state = event(state, "evidence_recorded", { kind: "exact-target", command: "npm test", exit_code: 0, head_sha: head1 });
  state = event(state, "review_recorded", {
    axis: "combined",
    verdict: "CHANGES-REQUESTED",
    context_id: "ctx-standard-review",
    head_sha: head1,
  });
  state = event(state, "finish_selected", { choice: "keep" });
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /completion review.*APPROVE/i.test(item)));
  state = event(state, "review_recorded", {
    axis: "combined",
    verdict: "APPROVE",
    context_id: "ctx-standard-rereview",
    head_sha: head1,
  });
  assert.equal(evaluateGate(state, "finalize").ok, true);
});

test("finish blocks pending findings and accepted findings until their repairs complete", () => {
  let state = initial();
  state = event(state, "code_changed", { head_sha: head1, changed_paths: ["src/a.ts"] });
  state = event(state, "evidence_recorded", { kind: "exact-target", command: "npm test", exit_code: 0, head_sha: head1 });
  state = event(state, "finish_selected", { choice: "keep" });
  state = event(state, "finding_recorded", { finding_id: "REV-101", summary: "missing boundary test" });
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /adjudication.*REV-101/i.test(item)));

  state = event(state, "finding_adjudicated", { finding_id: "REV-101", disposition: "accepted", reason: "confirmed" });
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /completed repair.*REV-101/i.test(item)));
  state = event(state, "repair_started", { finding_id: "REV-101" });
  state = event(state, "repair_completed", { finding_id: "REV-101", head_sha: head2, changed_paths: ["test/a.test.ts"] });
  assert.equal(evaluateGate(state, "finish").missing.some((item) => /REV-101/.test(item)), false);
});

test("Git-Ops uses a readiness gate and records the exact final branch, commit, and tree", () => {
  let state = initial();
  state = event(state, "risk_classified", { level: "tiny", reason: "small local correction" });
  state = event(state, "code_changed", { head_sha: head1, tree_sha: tree1, changed_paths: ["src/a.ts"] });
  state = event(state, "evidence_recorded", {
    kind: "exact-target", command: "node --test test/a.test.mjs", exit_code: 0,
    head_sha: head1, tree_sha: tree1,
  });
  state = event(state, "finish_selected", { choice: "keep" });
  state = event(state, "phase_started", { phase: "git-ops" });
  assert.equal(evaluateGate(state, "finalize").ok, true);
  assert.ok(evaluateGate(state, "finish").missing.some((item) => /finalization completion/i.test(item)));
  assert.throws(() => event(state, "phase_completed", { phase: "git-ops" }), /finalization_completed/i);
  assert.throws(
    () => event(state, "finalization_completed", {
      final_branch: "principal/run-test-001", head_sha: head2, tree_sha: tree2,
    }),
    /candidate tree/i,
  );
  state = event(state, "finalization_completed", {
    final_branch: "principal/run-test-001", head_sha: head2, tree_sha: tree1,
  });
  assert.equal(state.status, "finished");
  assert.equal(state.finalization.head_sha, head2);
  assert.equal(state.finalization.tree_sha, tree1);
  assert.equal(evaluateGate(state, "finish").ok, true);
});

test("finish choices are merge, pr, or keep; exactly one selection is allowed and discard is explicit", () => {
  for (const choice of ["merge", "pr", "keep"]) {
    const state = event(initial(), "finish_selected", { choice });
    assert.equal(state.finish.choice, choice);
    assert.throws(() => event(state, "finish_selected", { choice: choice === "keep" ? "merge" : "keep" }), /already selected/i);
  }
  assert.throws(() => event(initial(), "finish_selected", { choice: "discard" }), /explicit/i);
  assert.equal(event(initial(), "finish_selected", { choice: "discard", explicit_request: true }).finish.choice, "discard");
  assert.throws(() => event(initial(), "finish_selected", { choice: "ship-it" }), /finish choice/i);
});

test("irreversible side effects retain approval gates in every profile and critical approval is fresh", () => {
  let lean = initial("--assurance lean remove obsolete local data");
  assert.equal(evaluateGate(lean, "side-effect", { action: "deletion" }).code, "BLOCKED_ASSURANCE");
  lean = event(lean, "side_effect_approved", {
    action: "deletion",
    approved_by: "user",
    reason: "I accept that deletion is irreversible",
  });
  assert.equal(evaluateGate(lean, "side-effect", { action: "deletion" }).ok, true);

  let state = initial("--assurance critical rotate production credentials");
  let gate = evaluateGate(state, "side-effect", { action: "credential-rotation" });
  assert.equal(gate.code, "BLOCKED_CRITICAL_ASSURANCE");

  state = event(state, "side_effect_approved", {
    action: "credential-rotation",
    approved_by: "user",
    reason: "I accept that active credentials will be invalidated",
  });
  assert.equal(evaluateGate(state, "side-effect", { action: "credential-rotation" }).ok, true);
  state = event(state, "risk_classified", { level: "consequential", reason: "rotation invalidates active sessions" });
  assert.ok(evaluateGate(state, "side-effect", { action: "credential-rotation" }).missing.some((m) => /just-in-time/i.test(m)));
  state = event(state, "side_effect_approved", {
    action: "credential-rotation",
    approved_by: "user",
    reason: "I still accept the consequence immediately before rotation",
  });

  state = event(state, "phase_started", { phase: "plan" });
  gate = evaluateGate(state, "side-effect", { action: "credential-rotation" });
  assert.ok(gate.missing.some((m) => /just-in-time/i.test(m)));
});

test("run ids cannot escape the external state directory", () => {
  assert.throws(
    () => createInitialState({ workflow: "feature", request: "x", runId: "../../escape", now, definitionDigests: {} }),
    /run_id/i,
  );
});

test("run state validates required persisted assurance and identity fields", () => {
  const state = initial();
  assert.equal(validateRunState(state).ok, true);
  for (const field of ["run_id", "assurance", "tasks", "workspaces", "definition_digests", "current_tree_sha", "last_authority_seq", "used_context_ids", "finalization"]) {
    const broken = structuredClone(state);
    delete broken[field];
    assert.equal(validateRunState(broken).ok, false, field);
  }
});

test("portable JSON schemas are versioned and require the fields enforced by runtime validation", () => {
  const runSchema = JSON.parse(readFileSync(join(ROOT, "schemas", "assurance-run-state-v1.schema.json"), "utf8"));
  const taskSchema = JSON.parse(readFileSync(join(ROOT, "schemas", "assurance-task-packet-v1.schema.json"), "utf8"));
  const evidenceSchema = JSON.parse(readFileSync(join(ROOT, "schemas", "assurance-evidence-receipt-v1.schema.json"), "utf8"));
  assert.equal(runSchema.$id, "https://principal-pi-skills.dev/schemas/assurance-run-state-v1.schema.json");
  assert.equal(taskSchema.$id, "https://principal-pi-skills.dev/schemas/assurance-task-packet-v1.schema.json");
  assert.equal(evidenceSchema.$id, "https://principal-pi-skills.dev/schemas/assurance-evidence-receipt-v1.schema.json");
  for (const field of ["run_id", "assurance", "tasks", "workspaces", "definition_digests", "current_tree_sha", "last_authority_seq", "used_context_ids", "finalization"]) {
    assert.ok(runSchema.required.includes(field), field);
  }
  assert.ok(runSchema.properties.frozen_diff.oneOf[1].required.includes("tree_sha"));
  assert.ok(runSchema.$defs.backfillReceipt.required.includes("tree_sha"));
  for (const field of ["task_id", "authority", "global_constraints", "out_of_scope", "critical_scope", "done_command", "review_risk"]) {
    assert.ok(taskSchema.required.includes(field), field);
  }
  for (const field of ["kind", "command", "exit_code", "head_sha", "tree_sha", "task_id", "workspace_id", "recorded_at", "seq"]) {
    assert.ok(evidenceSchema.required.includes(field), field);
  }
});

test("Draft 2020-12 schemas and runtime validators agree on a shared positive/negative corpus", () => {
  const runSchema = JSON.parse(readFileSync(join(ROOT, "schemas", "assurance-run-state-v1.schema.json"), "utf8"));
  const taskSchema = JSON.parse(readFileSync(join(ROOT, "schemas", "assurance-task-packet-v1.schema.json"), "utf8"));
  const evidenceSchema = JSON.parse(readFileSync(join(ROOT, "schemas", "assurance-evidence-receipt-v1.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(evidenceSchema);
  const validateTaskSchema = ajv.addSchema(taskSchema).getSchema(taskSchema.$id);
  const validateRunSchema = ajv.compile(runSchema);

  const validPacket = criticalReady({ consequential: false }).tasks["task-1"].packet;
  const packetCorpus = [
    ["valid", validPacket, true],
    ["whitespace title", { ...structuredClone(validPacket), title: "   " }, false],
    ["absolute file", { ...structuredClone(validPacket), files: ["/etc/passwd"] }, false],
    ["traversal file", { ...structuredClone(validPacket), files: ["src/../outside.ts"] }, false],
    ["empty authority", { ...structuredClone(validPacket), authority: [] }, false],
    ["unsafe task id", { ...structuredClone(validPacket), task_id: "__proto__" }, false],
  ];
  for (const [label, packet, expected] of packetCorpus) {
    assert.equal(validateTaskPacket(packet).ok, expected, `runtime task: ${label}`);
    assert.equal(validateTaskSchema(packet), expected, `schema task: ${label}: ${JSON.stringify(validateTaskSchema.errors)}`);
  }

  const validRun = initial();
  const runCorpus = [
    ["valid", validRun, true],
    ["whitespace request", { ...structuredClone(validRun), request: "   " }, false],
    ["invalid source", { ...structuredClone(validRun), assurance: { ...validRun.assurance, source: "invented" } }, false],
    ["invalid activation time", { ...structuredClone(validRun), assurance: { ...validRun.assurance, activated_at: "yesterday" } }, false],
    ["invalid calendar time", { ...structuredClone(validRun), assurance: { ...validRun.assurance, activated_at: "2026-02-30T12:00:00Z" } }, false],
    ["malformed design", { ...structuredClone(validRun), design: {} }, false],
    ["unknown top-level field", { ...structuredClone(validRun), invented: true }, false],
  ];
  for (const [label, state, expected] of runCorpus) {
    assert.equal(validateRunState(state).ok, expected, `runtime run: ${label}`);
    assert.equal(validateRunSchema(state), expected, `schema run: ${label}: ${JSON.stringify(validateRunSchema.errors)}`);
  }
});

test("CLI init accepts an exact JSON request on stdin without shell interpolation", () => {
  const dir = mkdtempSync(join(tmpdir(), "ppa-assurance-request-"));
  try {
    const hostile = 'fix $(touch /tmp/pwned) `echo nope` "$HOME"\nand preserve quotes';
    const output = [];
    assert.equal(runCli(
      ["init", "--workflow", "feature", "--run-id", "run-stdin-request", "--state-dir", dir],
      { input: () => JSON.stringify({ request: hostile }), out: (line) => output.push(line), err: (line) => output.push(line) },
    ), 0);
    const store = new AssuranceStore({ baseDir: dir });
    assert.equal(store.load("run-stdin-request").request, hostile);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI contract exposes every event shape the generated workflows must persist", () => {
  const output = [];
  assert.equal(runCli(["contract"], { out: (line) => output.push(line), err: (line) => output.push(line) }), 0);
  const contract = output.join("\n");
  for (const eventType of [
    "risk_classified", "workspace_attached", "design_approved", "plan_recorded",
    "plan_critique_recorded", "plan_discovery_recorded", "task_packet_recorded", "task_packet_superseded", "phase_started", "phase_completed",
    "code_changed", "evidence_recorded", "review_recorded", "finding_adjudicated", "repair_suspended",
    "assurance_escalated", "assurance_downgraded", "backfill_completed",
    "side_effect_approved", "finish_selected", "finalization_completed",
  ]) assert.ok(contract.includes(eventType), eventType);
  assert.match(contract, /event --run-id/);
  assert.match(contract, /gate --run-id/);
});

test("AssuranceStore does not persist a partial run when initialization validation fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "ppa-assurance-init-"));
  try {
    const store = new AssuranceStore({ baseDir: dir, now: () => now });
    assert.throws(
      () => store.init({ workflow: "feature", request: "", runId: "run-retry-init", definitionDigests: {} }),
      /request/i,
    );
    assert.equal(store.init({ workflow: "feature", request: "valid", runId: "run-retry-init", definitionDigests: {} }).event_seq, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AssuranceStore rejects payload attempts to override hash-chain metadata without corrupting the run", () => {
  const dir = mkdtempSync(join(tmpdir(), "ppa-assurance-meta-"));
  try {
    const store = new AssuranceStore({ baseDir: dir, now: () => now });
    const state = store.init({ workflow: "feature", request: "add export", runId: "run-store-meta", definitionDigests: {} });
    assert.throws(
      () => store.append(state.run_id, { type: "phase_started", phase: "plan", prev_digest: "0".repeat(64) }),
      /reserved.*prev_digest/i,
    );
    assert.equal(store.load(state.run_id).event_seq, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AssuranceStore rejects non-JSON payload values before appending", () => {
  const dir = mkdtempSync(join(tmpdir(), "ppa-assurance-json-"));
  try {
    const store = new AssuranceStore({ baseDir: dir, now: () => now });
    const state = store.init({ workflow: "feature", request: "add export", runId: "run-store-json", definitionDigests: {} });
    assert.throws(
      () => store.append(state.run_id, { type: "phase_started", phase: "plan", task_id: undefined }),
      /JSON values/i,
    );
    const sparse = [];
    sparse.length = 1;
    assert.throws(
      () => store.append(state.run_id, { type: "finding_recorded", finding_id: "REV-SPARSE", summary: "x", evidence: sparse }),
      /sparse arrays/i,
    );
    const accessor = [];
    Object.defineProperty(accessor, "0", { enumerable: true, get: () => "changes between hash and write" });
    assert.throws(
      () => store.append(state.run_id, { type: "finding_recorded", finding_id: "REV-GETTER", summary: "x", evidence: accessor }),
      /enumerable JSON value/i,
    );
    assert.equal(store.load(state.run_id).event_seq, 1, "rejected payloads must not alter the log");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AssuranceStore rejects empty logs and logs placed under a different run ID", () => {
  const dir = mkdtempSync(join(tmpdir(), "ppa-assurance-identity-"));
  try {
    const store = new AssuranceStore({ baseDir: dir, now: () => now });
    store.init({ workflow: "feature", request: "add export", runId: "run-store-source", definitionDigests: {} });
    const sourceLog = join(dir, "runs", "run-store-source", "events.jsonl");

    const emptyDir = join(dir, "runs", "run-store-empty");
    mkdirSync(emptyDir, { recursive: true });
    writeFileSync(join(emptyDir, "events.jsonl"), "");
    assert.throws(() => store.load("run-store-empty"), /log is empty/i);

    const copiedDir = join(dir, "runs", "run-store-copy");
    mkdirSync(copiedDir, { recursive: true });
    writeFileSync(join(copiedDir, "events.jsonl"), readFileSync(sourceLog));
    assert.throws(() => store.load("run-store-copy"), /run_id does not match selected run/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AssuranceStore writes a hash-chained log and rejects unsupported versions or non-recomputed alteration", () => {
  const dir = mkdtempSync(join(tmpdir(), "ppa-assurance-"));
  try {
    const store = new AssuranceStore({ baseDir: dir, now: () => now });
    let state = store.init({ workflow: "feature", request: "add export", runId: "run-store-1", definitionDigests: {} });
    state = store.append(state.run_id, { type: "phase_started", phase: "plan" });
    assert.equal(state.event_seq, 2);

    const lines = readFileSync(join(dir, "runs", state.run_id, "events.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(lines.length, 2);
    assert.equal(lines[1].prev_digest, lines[0].event_digest);
    assert.equal(store.load(state.run_id).phases.plan.status, "started");

    const snapshot = JSON.parse(readFileSync(join(dir, "runs", state.run_id, "snapshot.json"), "utf8"));
    assert.equal(snapshot.event_digest, lines[1].event_digest);

    lines[0].schema_version = "0.9";
    writeFileSync(join(dir, "runs", state.run_id, "events.jsonl"), `${lines.map(JSON.stringify).join("\n")}\n`);
    assert.throws(() => store.load(state.run_id), /unsupported schema version/i);

    lines[0].schema_version = "1.0";
    lines[0].request = "tampered";
    writeFileSync(join(dir, "runs", state.run_id, "events.jsonl"), `${lines.map(JSON.stringify).join("\n")}\n`);
    assert.throws(() => store.load(state.run_id), /integrity|digest/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

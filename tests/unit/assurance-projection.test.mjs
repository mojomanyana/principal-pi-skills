import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssuranceStore, buildCurrentApplicabilityProjection, runCli } from "../../scripts/assurance-state.mjs";

const head = "a".repeat(40), tree = "b".repeat(40), nextHead = "c".repeat(40);
const plan = "d".repeat(64), definition = "e".repeat(64);
function fixture(t, { task = false, critical = false, empty = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ppa-current-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const runId = "projection-fixture";
  const store = new AssuranceStore({ baseDir: dir, now: () => "2026-09-08T12:00:00.000Z" });
  store.init({ workflow: "feature", request: critical ? "Implement report --assurance critical" : "Implement report",
    runId, definitionDigests: { "skill:build": definition } });
  const append = (type, payload = {}) => store.append(runId, { type, ...payload });
  const packet = { schema_version: "1.0", run_id: runId, task_id: "task-1", title: "Report",
    authority: ["P14"], global_constraints: ["read-only report"], out_of_scope: ["acceptance"],
    critical_scope: { applies: critical, matched_by: critical ? ["entire-run"] : [] },
    files: ["scripts/assurance-state.mjs"], dependencies: [], done_command: "node task-check.mjs",
    review_risk: "freshness", workspace_id: "ws-1", plan_digest: plan,
    definition_digests: { "skill:build": definition } };
  if (!empty) {
    append("workspace_attached", { workspace_id: "ws-1", path: "/fixture", mode: critical ? "owned-isolated" : "caller", writer: "build" });
    append("risk_classified", { level: "tiny", reason: "deterministic fixture" });
    append("plan_recorded", { plan_digest: plan });
    if (task) append("task_packet_recorded", { packet });
    if (!critical) append("code_changed", { head_sha: head, tree_sha: tree, changed_paths: packet.files });
  }
  const evidence = (kind, command, exit_code = 0, extra = {}) => append("evidence_recorded", {
    kind, command, exit_code, head_sha: head, tree_sha: tree, ...extra,
  });
  const render = (format = "current-v1") => {
    const output = [], errors = [];
    assert.equal(runCli(["report", "--run-id", runId, "--state-dir", dir, "--format", format],
      { cwd: dir, out: (line) => output.push(line), err: (line) => errors.push(line) }), 0, errors.join("\n"));
    return output.join("\n");
  };
  return { dir, runId, store, append, evidence, packet, render, project: () => JSON.parse(render()) };
}
const check = (p, kind, command) => p.checks.find((c) => c.kind === kind && c.command === command);

test("current-v1: expected red becomes resolved only by fresh green for the same check", (t) => {
  const f = fixture(t);
  f.evidence("red", "node red-green.mjs", 1);
  f.append("code_changed", { head_sha: nextHead, tree_sha: tree, changed_paths: f.packet.files });
  f.evidence("green", "node red-green.mjs", 0, { head_sha: nextHead });
  f.evidence("exact-target", "node target.mjs", 0, { head_sha: nextHead });
  const p = f.project();
  assert.equal(p.format_version, "current-v1");
  assert.equal(p.kind, "current-applicability-projection");
  assert.match(p.notice, /not a fresh gate or attestation/i);
  assert.equal(p.result, "PASSED");
  assert.equal(check(p, "green", "node red-green.mjs").status, "PASSED");
  assert.equal(p.receipts[0].disposition, "superseded");
  assert.equal(JSON.parse(f.render("in-toto")).predicate.result, "FAILED");
});

test("current-v1: last current failure wins over an older zero and unrelated later zero", (t) => {
  const f = fixture(t);
  f.evidence("exact-target", "node target.mjs");
  f.evidence("lint", "node lint-a.mjs");
  f.evidence("lint", "node lint-a.mjs", 1);
  f.evidence("lint", "node lint-b.mjs");
  const p = f.project();
  assert.equal(p.result, "FAILED");
  assert.equal(check(p, "lint", "node lint-a.mjs").status, "FAILED");
  assert.equal(check(p, "lint", "node lint-b.mjs").status, "PASSED");
});

test("current-v1: expected red cannot supersede an unresolved green execution failure", (t) => {
  const f = fixture(t);
  f.evidence("exact-target", "node target.mjs");
  f.evidence("green", "node pair.mjs", 1);
  f.evidence("red", "node pair.mjs", 1);
  assert.equal(f.project().result, "FAILED");
  f.evidence("green", "node pair.mjs");
  assert.equal(f.project().result, "PASSED");
  f.evidence("red", "node pair.mjs", 1);
  assert.equal(f.project().result, "MISSING");
});

test("current-v1: empty evidence is missing, not a failed execution or success", (t) => {
  const p = fixture(t, { empty: true }).project();
  assert.equal(p.result, "MISSING");
  assert.deepEqual(p.receipts, []);
  assert.equal(p.requirements[0].status, "MISSING");
  assert.equal(p.candidate.head_sha, null);
});

test("current-v1: artifact and authority changes invalidate old qualifying evidence", (t) => {
  for (const payload of [
    { type: "code_changed", head_sha: nextHead, tree_sha: tree, changed_paths: ["scripts/assurance-state.mjs"] },
    { type: "risk_classified", level: "substantive", reason: "new authority" },
    { type: "workspace_attached", workspace_id: "ws-2", path: "/other", mode: "caller", writer: "build" },
  ]) {
    const f = fixture(t);
    f.evidence("exact-target", "node target.mjs");
    f.append(payload.type, payload);
    const p = f.project();
    assert.equal(p.result, "STALE", payload.type);
    assert.equal(p.receipts[0].disposition, "stale");
    assert.equal(p.requirements[0].status, "STALE");
  }
});

test("current-v1: task authority is checked even for newly recorded receipts", (t) => {
  const f = fixture(t, { task: true });
  f.append("plan_recorded", { plan_digest: "f".repeat(64) });
  f.evidence("exact-target", f.packet.done_command, 0, { task_id: "task-1" });
  f.evidence("exact-target", "node target.mjs");
  const p = f.project();
  assert.equal(p.tasks[0].applicability, "stale");
  assert.equal(check(p, "exact-target", f.packet.done_command).status, "STALE");
  assert.equal(p.result, "STALE");
});

test("current-v1: superseded task and its failures are distinct from current checks", (t) => {
  const f = fixture(t, { task: true });
  f.evidence("exact-target", f.packet.done_command, 1, { task_id: "task-1" });
  f.append("plan_recorded", { plan_digest: "f".repeat(64) });
  // A deterministic ledger fixture, not a native approval or model review.
  f.append("plan_critique_recorded", { verdict: "APPROVE", context_id: "fixture-replan", plan_digest: "f".repeat(64) });
  f.append("task_packet_superseded", { task_id: "task-1", reason: "replacement plan removes task" });
  f.evidence("exact-target", "node target.mjs");
  const p = f.project();
  assert.equal(p.tasks[0].applicability, "superseded");
  assert.equal(p.receipts[0].disposition, "superseded-task");
  assert.equal(p.result, "PASSED");
});

test("current-v1: required checks cannot be satisfied by a different kind, command, or task", (t) => {
  const f = fixture(t, { task: true });
  f.append("phase_started", { phase: "build", task_id: "task-1" });
  f.append("phase_completed", { phase: "build" });
  f.evidence("green", f.packet.done_command, 0, { task_id: "task-1" });
  f.evidence("exact-target", "node wrong.mjs", 0, { task_id: "task-1" });
  f.evidence("exact-target", f.packet.done_command);
  assert.equal(f.project().result, "MISSING");
  f.evidence("exact-target", f.packet.done_command, 0, { task_id: "task-1" });
  assert.equal(f.project().result, "PASSED");
});

test("current-v1: critical run requirements remain independently missing", (t) => {
  const f = fixture(t, { critical: true });
  f.evidence("exact-target", "node target.mjs");
  const p = f.project();
  assert.deepEqual(p.requirements.filter((r) => r.status === "MISSING").map((r) => r.kind),
    ["full-suite", "requirements-trace", "risk-specific"]);
  // No recorded candidate means even a zero receipt cannot qualify.
  assert.equal(check(p, "exact-target", "node target.mjs").status, "STALE");
});

test("current-v1: different commands and task identities cannot resolve expected red", (t) => {
  const f = fixture(t);
  f.evidence("red", "node pair.mjs", 1);
  f.evidence("green", "node other.mjs");
  f.evidence("exact-target", "node pair.mjs");
  assert.equal(check(f.project(), "green", "node pair.mjs").status, "MISSING");
  f.evidence("green", "node pair.mjs", 0, { task_id: "unknown-task" });
  const p = f.project();
  assert.equal(p.checks.find((c) => c.kind === "green" && c.command === "node pair.mjs" && c.task_id === null).status, "MISSING");
  assert.equal(p.receipts.at(-1).disposition, "stale");
});

test("current-v1: late wrong-artifact/workspace zeros cannot conceal an applicable failure", (t) => {
  const f = fixture(t);
  f.append("workspace_attached", { workspace_id: "ws-2", path: "/other", mode: "caller", writer: "build" });
  f.append("workspace_attached", { workspace_id: "ws-1", path: "/fixture", mode: "caller", writer: "build" });
  f.evidence("exact-target", "node target.mjs", 1);
  f.evidence("exact-target", "node target.mjs", 0, { head_sha: nextHead });
  f.evidence("exact-target", "node target.mjs", 0, { workspace_id: "ws-2" });
  assert.equal(f.project().result, "FAILED");
  f.evidence("exact-target", "node target.mjs");
  assert.equal(f.project().result, "PASSED");
});

test("current-v1: task definition mismatch and post-completion floor are enforced", (t) => {
  const f = fixture(t, { task: true });
  f.evidence("exact-target", "node target.mjs");
  f.evidence("exact-target", f.packet.done_command, 0, { task_id: "task-1" });
  f.append("phase_started", { phase: "build", task_id: "task-1" });
  f.append("phase_completed", { phase: "build" });
  assert.equal(check(f.project(), "exact-target", f.packet.done_command).status, "STALE");
  f.evidence("exact-target", f.packet.done_command, 0, { task_id: "task-1" });
  assert.equal(f.project().result, "PASSED");
  f.append("task_packet_recorded", { packet: { ...f.packet, task_id: "task-2",
    definition_digests: { "skill:build": "f".repeat(64) } } });
  f.evidence("exact-target", f.packet.done_command, 0, { task_id: "task-2" });
  const p = f.project();
  assert.equal(p.tasks[1].applicability, "stale");
  assert.deepEqual(p.tasks[1].reasons, ["changed-definitions"]);
});

test("current-v1: critical requirements do not infer completion from backfill or another zero", (t) => {
  const f = fixture(t);
  f.append("assurance_escalated", { to: "critical", source: "user", reason: "fixture escalation",
    base_sha: head, head_sha: head, tree_sha: tree });
  f.evidence("exact-target", "node target.mjs");
  f.evidence("full-suite", "node suite.mjs");
  f.evidence("build", "node build.mjs");
  f.evidence("lint", "node lint.mjs");
  const p = f.project();
  assert.equal(p.result, "MISSING");
  assert.deepEqual(p.requirements.filter((r) => r.status === "MISSING").map((r) => r.kind),
    ["requirements-trace", "risk-specific"]);
});

test("current-v1: pure projection leaves replay state unchanged and never evaluates a gate", (t) => {
  const f = fixture(t);
  const state = f.store.load(f.runId), before = structuredClone(state);
  buildCurrentApplicabilityProjection(state);
  assert.deepEqual(state, before);
  assert.doesNotMatch(buildCurrentApplicabilityProjection.toString(), /evaluateGate\(|\.append\(|writeFile|appendFile/);
});

test("current-v1: finalization preserves candidate identity without hiding unresolved final failures", (t) => {
  const f = fixture(t);
  f.evidence("exact-target", "node target.mjs");
  f.evidence("full-suite", "node suite.mjs", 1);
  f.append("finish_selected", { choice: "keep" });
  f.append("phase_started", { phase: "git-ops" });
  f.append("finalization_completed", { final_branch: "fixture", head_sha: nextHead, tree_sha: tree });
  const p = f.project();
  assert.equal(p.candidate.head_sha, head);
  assert.equal(p.finalization.head_sha, nextHead);
  assert.equal(check(p, "exact-target", "node target.mjs").status, "PASSED");
  assert.equal(p.result, "FAILED");
});

test("ordinary human report defaults to current applicability while named legacy remains inspectable", (t) => {
  const f = fixture(t, { task: true });
  f.evidence("exact-target", "node target.mjs", 1, { task_id: "task-1", workspace_id: "ws-1" });
  const run = (args = []) => { const output = []; assert.equal(runCli(["report", "--run-id", f.runId, "--state-dir", f.dir, ...args], { cwd: f.dir, out: line => output.push(line) }), 0); return output.join("\n"); };
  const ordinary = run();
  assert.match(ordinary, /^# Current assurance:/);
  assert.match(ordinary, /Result: STALE/);
  assert.match(ordinary, /task-1.*current/);
  assert.equal(run(["--format", "human"]), ordinary);
  assert.match(run(["--format", "human-legacy"]), /^# Assurance report:/);
});

test("current-v1: reporting and explicit legacy aliases are deterministic and never write ledger or snapshot", (t) => {
  const f = fixture(t);
  f.evidence("exact-target", "node target.mjs");
  const paths = f.store.paths(f.runId);
  const snapshot = () => Object.fromEntries(readdirSync(paths.dir).map((name) => {
    const path = join(paths.dir, name), stat = statSync(path);
    return [name, { bytes: readFileSync(path, "utf8"), mtime: stat.mtimeMs, ctime: stat.ctimeMs }];
  }));
  const before = snapshot();
  assert.equal(f.render(), f.render());
  assert.equal(f.render("in-toto-legacy"), f.render("in-toto"));
  assert.notEqual(f.render("human-legacy"), f.render("human"));
  assert.deepEqual(snapshot(), before);
  const p = f.project(), state = f.store.load(f.runId);
  assert.equal(p.ledger.hashChainHead, state.event_digest);
  assert.equal(p.ledger.eventCount, state.event_seq);
});

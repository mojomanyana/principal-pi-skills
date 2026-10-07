import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRun, saveReport, reference, appendProgress, readProgress } from "../../scripts/progress-artifacts.mjs";

function fixture(t) {
  const repo = mkdtempSync(join(tmpdir(), "principal-progress-test-"));
  execFileSync("git", ["init", "-q", repo]);
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  return repo;
}
function entry(report, overrides = {}) {
  const facts = Object.fromEntries(["planned", "implemented", "reviewed", "integrated", "verified"].map(name =>
    [name, { state: "unknown", evidence: [], note: "not established" }]));
  facts.implemented = { state: "complete", evidence: [report], note: "commit exists; review pending" };
  return { version: 1, plan: null, step: "step-1", candidate: "candidate-A", facts, findings: [], nextAction: "request review", ...overrides };
}

test("private unused runs and reports preserve complete bytes without overwrite", t => {
  const repo = fixture(t), first = createRun(repo, "task", "candidate-A"), second = createRun(repo, "task", "candidate-A");
  assert.notEqual(first, second);
  const contents = "## Full report\nCaveat: qualification not run.\nNext: review\n";
  const report = saveReport(first, "build.md", contents);
  assert.equal(readFileSync(report.path, "utf8"), contents);
  assert.throws(() => saveReport(first, "build.md", "replacement"), /exist/i);
  assert.throws(() => saveReport(first, "../escape.md", "escape"), /name/i);
  assert.equal(readFileSync(report.path, "utf8"), contents);
  if (process.platform !== "win32") {
    assert.equal(statSync(first).mode & 0o777, 0o700);
    assert.equal(statSync(report.path).mode & 0o777, 0o600);
  }
});

test("existing exposing ignore policy and symlink artifact roots are refused unchanged", t => {
  const repo = fixture(t);
  mkdirSync(join(repo, ".principal"));
  writeFileSync(join(repo, ".principal/.gitignore"), "plans/\n");
  assert.throws(() => createRun(repo, "task", "candidate-A"), /ignored/);
  assert.equal(readFileSync(join(repo, ".principal/.gitignore"), "utf8"), "plans/\n");
  const other = fixture(t), target = fixture(t);
  symlinkSync(target, join(other, ".principal"), "dir");
  assert.throws(() => createRun(other, "task", "candidate-A"), /symlink/);
});

test("commit before review never implies reviewed, integrated or verified", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "commit abc; caveat unverified");
  appendProgress(run, entry(report));
  const result = readProgress(run, "candidate-A");
  assert.deepEqual(result.issues, []);
  const facts = result.records[0].facts;
  assert.equal(facts.implemented.state, "complete");
  for (const name of ["reviewed", "integrated", "verified"]) assert.equal(facts[name].state, "unknown");
  assert.equal(readProgress(run).records[0].facts.implemented.state, "unknown");
});

test("review before integration and repair interruption remain separate facts with finding identity", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), build = saveReport(run, "build.md", "complete build"), review = saveReport(run, "review.md", "CHANGES-REQUESTED REV-001");
  const record = entry(build);
  record.facts.reviewed = { state: "complete", evidence: [review], note: "CHANGES-REQUESTED" };
  record.findings = [
    { id: "REV-001", source: review, status: "open" },
    { id: "comment:42", source: review, status: "duplicate", duplicateOf: "REV-001" },
    { id: "comment:43", source: review, status: "disputed" },
    { id: "comment:44", source: review, status: "stale" },
    { id: "comment:45", source: review, status: "accepted" },
  ];
  appendProgress(run, record);
  const repair = structuredClone(record);
  repair.facts.implemented = { state: "incomplete", evidence: [build], note: "repair in progress" };
  repair.findings[0].status = "addressed";
  appendProgress(run, repair);
  const result = readProgress(run, "candidate-A");
  assert.equal(result.records.length, 2);
  assert.equal(result.records[1].facts.integrated.state, "unknown");
  assert.equal(result.records[1].facts.verified.state, "unknown");
  assert.equal(result.records[1].facts.implemented.state, "incomplete");
  assert.deepEqual(result.records[1].record.findings, repair.findings);
});

test("candidate change and changed or missing evidence invalidate applicable claims", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "original");
  appendProgress(run, entry(report));
  assert.equal(readProgress(run, "candidate-B").records[0].facts.implemented.state, "unknown");
  writeFileSync(report.path, "changed");
  const stale = readProgress(run, "candidate-A");
  assert.equal(stale.records[0].facts.implemented.state, "unknown");
  assert.match(stale.records[0].issues.join(" "), /changed/);
  rmSync(report.path);
  assert.equal(readProgress(run, "candidate-A").records[0].facts.implemented.state, "unknown");
});

test("plan references are checked independently; no plan title approval inference", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), plan = saveReport(run, "plan.md", "## Plan: approved-looking title");
  const record = entry(plan, { plan });
  record.facts.planned = { state: "complete", evidence: [plan], note: "written, approval must be checked in dialogue" };
  appendProgress(run, record);
  assert.equal(readProgress(run, "candidate-B").records[0].facts.planned.state, "complete");
  writeFileSync(plan.path, "new plan");
  assert.equal(readProgress(run, "candidate-A").records[0].facts.planned.state, "unknown");
  assert.throws(() => appendProgress(run, { ...record, approved: true }), /unknown.*approved/i);
});

test("incomplete final JSONL record is ignored and blocks append without losing complete records", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "full report");
  appendProgress(run, entry(report));
  const index = join(run, "progress.jsonl");
  const before = readFileSync(index, "utf8");
  writeFileSync(index, before + '{"version":1');
  const result = readProgress(run, "candidate-A");
  assert.equal(result.records.length, 1);
  assert.match(result.issues.join(" "), /incomplete final/);
  assert.throws(() => appendProgress(run, entry(report)), /incomplete/);
  assert.equal(readFileSync(index, "utf8"), before + '{"version":1');
});

test("malformed complete records are reported and no later append conceals them", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "report");
  writeFileSync(join(run, "progress.jsonl"), '{"approved":true}\n');
  assert.equal(readProgress(run, "candidate-A").records.length, 0);
  assert.match(readProgress(run, "candidate-A").issues.join(" "), /record 1/);
  assert.throws(() => appendProgress(run, entry(report)), /invalid/);
});

test("failed or competing index writer preserves report; retry is explicit", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "durable full report");
  writeFileSync(join(run, ".progress.lock"), "other coordinator");
  assert.throws(() => appendProgress(run, entry(report)), /writer|lock/);
  assert.equal(readFileSync(report.path, "utf8"), "durable full report");
  assert.equal(readProgress(run, "candidate-A").records.length, 0);
  assert.equal(readFileSync(join(run, ".progress.lock"), "utf8"), "other coordinator");
});

test("invalid schemas, duplicate IDs and symlink indexes cannot become progress", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "report");
  const record = entry(report);
  record.facts.reviewed = { state: "complete", evidence: [], note: "self assertion" };
  assert.throws(() => appendProgress(run, record), /evidence/);
  record.facts.reviewed.state = "unknown";
  record.findings = [{ id: "x", source: report, status: "open" }, { id: "x", source: report, status: "stale" }];
  assert.throws(() => appendProgress(run, record), /duplicate.*id/i);
  symlinkSync(report.path, join(run, "progress.jsonl"));
  assert.throws(() => readProgress(run, "candidate-A"), /symlink/);
  assert.throws(() => reference(join(run, "progress.jsonl")), /symlink/);
  assert.equal(readFileSync(report.path, "utf8"), "report");
});
test("CLI carries complete report bytes and explicit unresolved progress across separate invocations", t => {
  const repo = fixture(t), cli = new URL("../../scripts/progress-artifacts.mjs", import.meta.url).pathname;
  const call = (args, input) => JSON.parse(execFileSync(process.execPath, [cli, ...args], { encoding: "utf8", input }));
  const run = call(["create", repo, "task", "candidate-A"]);
  const report = call(["report", run, "build.md"], "Full implementation\nCaveat: native runtime not tested\n");
  assert.match(readFileSync(report.path, "utf8"), /Caveat: native runtime not tested/);
  assert.match(call(["read", run, "candidate-A"]).issues.join(" "), /progress incomplete/);
  call(["append", run], JSON.stringify(entry(report)));
  assert.equal(call(["read", run, "candidate-A"]).records[0].facts.implemented.state, "complete");
  assert.equal(call(["read", run]).records[0].facts.implemented.state, "unknown");
});

test("even valid JSON without its newline cannot be promoted to a complete record", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "report");
  writeFileSync(join(run, "progress.jsonl"), JSON.stringify(entry(report)));
  const result = readProgress(run, "candidate-A");
  assert.equal(result.records.length, 0);
  assert.match(result.issues.join(" "), /incomplete final/);
});
test("per-file ignore exceptions cannot expose a report or progress index", t => {
  const repo = fixture(t);
  mkdirSync(join(repo, ".principal"));
  writeFileSync(join(repo, ".principal/.gitignore"), "*\n!*/\n!*.md\n!*.jsonl\n");
  const run = createRun(repo, "task", "candidate-A");
  assert.throws(() => saveReport(run, "build.md", "private report"), /ignored/);
  assert.throws(() => readFileSync(join(run, "build.md")), /ENOENT/);
  const evidence = join(repo, "existing-evidence.txt");
  writeFileSync(evidence, "already existing evidence");
  assert.throws(() => appendProgress(run, entry(reference(evidence))), /ignored/);
  assert.throws(() => readFileSync(join(run, "progress.jsonl")), /ENOENT/);
});

test("dangling index symlinks are reported instead of looking like absent progress", t => {
  const run = createRun(fixture(t), "task", "candidate-A");
  symlinkSync(join(run, "missing"), join(run, "progress.jsonl"));
  assert.throws(() => readProgress(run, "candidate-A"), /symlink/);
});
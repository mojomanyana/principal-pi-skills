import { test } from "node:test";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createRun, saveReport, copyArtifact, reference, appendProgress, readProgress, checkProgress, checkCompletion } from "../../scripts/progress-artifacts.mjs";

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


test("copy preserves producer bytes with private exclusive storage and source provenance", t => {
  const repo = fixture(t), run = createRun(repo, "task", "candidate-A"), source = join(repo, "native-receipt.json");
  const bytes = Buffer.from('{"reason":"worker-exit","note":"\u00e9"}\r\n');
  writeFileSync(source, bytes);
  const expected = reference(source);
  const cli = spawnSync(process.execPath, ["scripts/progress-artifacts.mjs", "copy", run, "receipt.json", source, expected.sha256], { encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
  const result = JSON.parse(cli.stdout);
  assert.deepEqual(result.source, expected);
  assert.deepEqual(readFileSync(result.copy.path), bytes);
  assert.equal(result.copy.sha256, expected.sha256);
  assert.throws(() => copyArtifact(run, "receipt.json", source, expected.sha256), /exist/i);
  assert.deepEqual(readFileSync(source), bytes);
  if (process.platform !== "win32") assert.equal(statSync(result.copy.path).mode & 0o777, 0o600);
});

test("copy refuses stale identity, unsafe names, and linked sources before writing", t => {
  const repo = fixture(t), run = createRun(repo, "task", "candidate-A"), source = join(repo, "receipt.json");
  writeFileSync(source, "original");
  const expected = reference(source).sha256;
  writeFileSync(source, "changed");
  assert.throws(() => copyArtifact(run, "copy.json", source, expected), /match expected/);
  assert.equal(existsSync(join(run, "copy.json")), false);
  for (const name of ["../escape.json", "run.json", "progress.jsonl"]) {
    assert.throws(() => copyArtifact(run, name, source, expected), /filename/);
  }
  assert.throws(() => copyArtifact(run, "copy.json", source, ""), /SHA-256/);
  symlinkSync(source, join(repo, "linked.json"));
  assert.throws(() => copyArtifact(run, "copy.json", join(repo, "linked.json"), reference(source).sha256), /symlink/);
  assert.equal(existsSync(join(run, "copy.json")), false);
});

test("copy rejects source mutation during the read instead of claiming a stable receipt", t => {
  const repo = fixture(t), run = createRun(repo, "task", "candidate-A"), source = join(repo, "receipt.json");
  writeFileSync(source, "original");
  const expected = reference(source).sha256, originalRead = fs.readFileSync;
  fs.readFileSync = function (path, ...args) {
    const data = originalRead.call(this, path, ...args);
    if (typeof path === "number") writeFileSync(source, "changed-size");
    return data;
  };
  syncBuiltinESMExports();
  try { assert.throws(() => copyArtifact(run, "copy.json", source, expected), /changed while copying/); }
  finally { fs.readFileSync = originalRead; syncBuiltinESMExports(); }
  assert.equal(existsSync(join(run, "copy.json")), false);
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
for (const operation of ["report", "append", "read"]) {
  test(`${operation} refuses unknown run metadata before reading or writing another directory`, t => {
    const repo = fixture(t), run = createRun(repo, "task", "candidate-A");
    const report = saveReport(run, "existing.md", "original report");
    appendProgress(run, entry(report));
    const originalIndex = readFileSync(join(run, "progress.jsonl"), "utf8");
    const foreign = join(repo, ".principal", "foreign");
    mkdirSync(foreign);
    writeFileSync(join(foreign, "progress.jsonl"), "foreign sentinel\n");
    const manifest = join(run, "run.json"), original = JSON.parse(readFileSync(manifest, "utf8"));
    const invoke = () => operation === "report" ? saveReport(run, "escaped.md", "must not save")
      : operation === "append" ? appendProgress(run, entry(report)) : readProgress(run, "candidate-A");
    for (const extra of [{ path: foreign }, { approved: true }, { unexpected: "metadata" }]) {
      writeFileSync(manifest, JSON.stringify({ ...original, ...extra }));
      assert.throws(invoke, /unknown run manifest field/);
      assert.equal(readFileSync(join(foreign, "progress.jsonl"), "utf8"), "foreign sentinel\n");
      assert.equal(readFileSync(join(run, "progress.jsonl"), "utf8"), originalIndex);
      assert.throws(() => readFileSync(join(foreign, "escaped.md")), /ENOENT/);
      assert.throws(() => readFileSync(join(foreign, ".progress.lock")), /ENOENT/);
    }
    writeFileSync(manifest, JSON.stringify(original));
    assert.equal(readProgress(run, "candidate-A").records.length, 1);
  });
}

test("run metadata must be exactly the supported object with a valid candidate identity", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), manifest = join(run, "run.json");
  const original = JSON.parse(readFileSync(manifest, "utf8"));
  for (const invalid of [null, [], { ...original, version: 2 }, { ...original, candidate: "" },
    { version: 1, root: original.root }, { version: 1, candidate: original.candidate }]) {
    writeFileSync(manifest, JSON.stringify(invalid));
    assert.throws(() => readProgress(run, "candidate-A"), /run manifest|run identity|candidate/);
  }
});
test("observed hand-written progress shapes cannot create or alter an index", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "full original report");
  const index = join(run, "progress.jsonl"), valid = entry(report);
  const mutations = [
    record => { record.candidate = { commit: "candidate-A" }; },
    record => { record.facts.implemented = "complete"; },
    record => { record.facts.implemented.evidence[0].path = ".principal/reports/build.md"; },
    record => { record.recordedAt = "2026-10-07T13:57:49Z"; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.throws(() => appendProgress(run, invalid), /candidate|fact|absolute|unknown record/);
    assert.equal(existsSync(index), false);
  }
  appendProgress(run, valid);
  const originalIndex = readFileSync(index, "utf8");
  for (const mutate of mutations) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.throws(() => appendProgress(run, invalid), /candidate|fact|absolute|unknown record/);
    assert.equal(readFileSync(index, "utf8"), originalIndex);
    assert.equal(readFileSync(report.path, "utf8"), "full original report");
  }
});

test("integrity check requires a candidate and preserves incomplete facts and review verdicts", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "review.md", "CHANGES-REQUESTED REV-1");
  for (const candidate of [undefined, null, "", "  ", { commit: "candidate-A" }]) {
    assert.throws(() => checkProgress(run, candidate), /expected candidate must be nonempty text/);
  }
  const record = entry(report);
  record.facts.implemented = { state: "incomplete", evidence: [report], note: "Repair pending" };
  record.facts.reviewed = { state: "complete", evidence: [report], note: "CHANGES-REQUESTED" };
  record.findings = [{ id: "REV-1", source: report, status: "open" }];
  appendProgress(run, record);
  const checked = checkProgress(run, "candidate-A");
  assert.equal(checked.integrityValid, true);
  assert.deepEqual(checked.records[0].record, record);
  assert.deepEqual(checked.records[0].facts, record.facts);
  const { integrityValid, ...reconciliation } = checked;
  assert.deepEqual(reconciliation, readProgress(run, "candidate-A"));
  assert.equal(readProgress(run).records[0].facts.reviewed.state, "unknown");
});

test("integrity check covers stale earlier records even when the final record is current", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "original evidence");
  appendProgress(run, entry(report));
  assert.equal(checkProgress(run, "candidate-B").integrityValid, false);
  writeFileSync(report.path, "changed evidence");
  appendProgress(run, entry(reference(report.path), { step: "step-2" }));
  const index = join(run, "progress.jsonl"), before = readFileSync(index, "utf8");
  const stale = checkProgress(run, "candidate-A");
  assert.deepEqual(stale.issues, []);
  assert.equal(stale.integrityValid, false);
  assert.match(stale.records[0].issues.join(" "), /changed evidence/);
  assert.deepEqual(stale.records[1].issues, []);
  assert.equal(readFileSync(index, "utf8"), before);
  assert.equal(readFileSync(report.path, "utf8"), "changed evidence");
  rmSync(report.path);
  const missing = checkProgress(run, "candidate-A");
  assert.equal(missing.integrityValid, false);
  assert.match(missing.records[1].issues.join(" "), /unavailable evidence/);
  assert.equal(readFileSync(index, "utf8"), before);
});

test("integrity check preserves malformed or torn history and requires a separate repair run", t => {
  const repo = fixture(t), run = createRun(repo, "task", "candidate-A"), report = saveReport(run, "build.md", "retained full evidence");
  const absent = checkProgress(run, "candidate-A");
  assert.equal(absent.integrityValid, false);
  assert.match(absent.issues.join(" "), /no complete progress record/);
  const valid = entry(report), line = JSON.stringify(valid) + "\n", index = join(run, "progress.jsonl");
  for (const damaged of ['{"facts":"complete"}\n' + line, line + '{"version":1']) {
    writeFileSync(index, damaged);
    const checked = checkProgress(run, "candidate-A");
    assert.equal(checked.integrityValid, false);
    assert.equal(checked.records.length, 1);
    assert.ok(checked.issues.length > 0);
    assert.deepEqual(checked.records[0].issues, []);
    assert.throws(() => appendProgress(run, valid), /invalid record|incomplete final/);
    assert.equal(readFileSync(index, "utf8"), damaged);
    assert.equal(readFileSync(report.path, "utf8"), "retained full evidence");
    const repair = createRun(repo, "repair", "candidate-A");
    appendProgress(repair, valid);
    assert.equal(checkProgress(repair, "candidate-A").integrityValid, true);
    assert.equal(readFileSync(index, "utf8"), damaged);
  }
});

test("CLI check exposes integrity failure through exit status while read remains diagnostic", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), report = saveReport(run, "build.md", "unreviewed implementation");
  const cli = new URL("../../scripts/progress-artifacts.mjs", import.meta.url).pathname;
  const call = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  for (const args of [["check", run], ["check", run, ""]]) assert.equal(call(...args).status, 1);
  const missing = call("check", run, "candidate-A");
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).integrityValid, false);
  appendProgress(run, entry(report));
  const valid = call("check", run, "candidate-A");
  assert.equal(valid.status, 0);
  assert.equal(JSON.parse(valid.stdout).integrityValid, true);
  assert.equal(JSON.parse(valid.stdout).records[0].facts.reviewed.state, "unknown");
  const stale = call("check", run, "candidate-B");
  assert.equal(stale.status, 1);
  assert.equal(JSON.parse(stale.stdout).integrityValid, false);
  assert.equal(call("read", run, "candidate-B").status, 0);
  writeFileSync(report.path, "changed evidence");
  const changed = call("check", run, "candidate-A");
  assert.equal(changed.status, 1);
  assert.equal(JSON.parse(changed.stdout).integrityValid, false);
  assert.equal(call("read", run, "candidate-A").status, 0);
});


function committedFixture(t) {
  const repo = fixture(t);
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  git("config", "user.name", "Completion Test"); git("config", "user.email", "completion@example.invalid");
  writeFileSync(join(repo, "source.txt"), "committed source\n");
  git("add", "source.txt"); git("commit", "-qm", "seed completion fixture");
  return { repo, git, head: git("rev-parse", "HEAD") };
}
function completeEntry(report, candidate, step = "step-1") {
  return entry(report, { candidate, step, nextAction: "independent semantic checks still required",
    facts: Object.fromEntries(["planned", "implemented", "reviewed", "integrated", "verified"].map(phase =>
      [phase, { state: "complete", evidence: [report], note: "recorded claim; not an approval check" }])) });
}

test("completion checks every required step's latest snapshot without granting approval or changing files", t => {
  const { repo, git, head } = committedFixture(t), run = createRun(repo, "task", head);
  const report = saveReport(run, "review.md", "CHANGES-REQUESTED; report semantics must be checked by the coordinator\n");
  const first = completeEntry(report, head), second = completeEntry(report, head, "step-2");
  first.facts.reviewed.note = "CHANGES-REQUESTED";
  appendProgress(run, first); appendProgress(run, second);
  const index = readFileSync(join(run, "progress.jsonl")), manifest = readFileSync(join(run, "run.json"));
  const result = checkCompletion(run, head, ["step-2", "step-1"]);
  assert.equal(result.completionChecksPassed, true);
  assert.equal(result.integrityValid, true);
  assert.deepEqual(result.requiredSteps, ["step-2", "step-1"]);
  assert.deepEqual(result.steps.map(step => [step.step, step.recordNumber]), [["step-2", 2], ["step-1", 1]]);
  assert.equal(result.approval, "not-assessed"); assert.equal(result.taskAcceptance, "not-assessed");
  assert.deepEqual(readFileSync(join(run, "progress.jsonl")), index);
  assert.deepEqual(readFileSync(join(run, "run.json")), manifest);
  assert.equal(git("status", "--porcelain=v1"), "");
  assert.equal(git("rev-parse", "HEAD"), head);
});

test("completion refuses a partial latest step even after earlier completion and a later complete other step", t => {
  const { repo, head } = committedFixture(t), run = createRun(repo, "task", head), report = saveReport(run, "phase.md", "phase evidence");
  appendProgress(run, completeEntry(report, head));
  const partial = completeEntry(report, head); partial.facts.verified = { state: "incomplete", evidence: [report], note: "finish pending" };
  partial.facts.reviewed = { state: "unknown", evidence: [], note: "candidate needs fresh review" };
  appendProgress(run, partial); appendProgress(run, completeEntry(report, head, "step-2"));
  const checked = checkCompletion(run, head, ["step-1", "step-2"]);
  assert.equal(checked.integrityValid, true); assert.equal(checked.completionChecksPassed, false);
  assert.equal(checked.phaseClaimsComplete, false);
  assert.deepEqual(checked.steps[0].phases, { planned: "complete", implemented: "complete", reviewed: "unknown", integrated: "complete", verified: "incomplete" });
  assert.match(checked.issues.join(" "), /step-1: verified is incomplete/);
});

test("completion requires the exact nonempty unique step set, including missing and unexpected steps", t => {
  const { repo, head } = committedFixture(t), run = createRun(repo, "task", head), report = saveReport(run, "phase.md", "phase evidence");
  appendProgress(run, completeEntry(report, head)); appendProgress(run, completeEntry(report, head, "step-2"));
  for (const steps of [undefined, null, "step-1", [], [""], ["  "], ["step-1", "step-1"], [1]]) {
    assert.throws(() => checkCompletion(run, head, steps), /required step/);
  }
  const checked = checkCompletion(run, head, ["step-1", "step-3"]);
  assert.equal(checked.completionChecksPassed, false);
  assert.deepEqual(checked.missingSteps, ["step-3"]); assert.deepEqual(checked.unexpectedSteps, ["step-2"]);
});

test("completion retains unresolved finding identities across omitted snapshots and refuses inferred dispositions", t => {
  const { repo, head } = committedFixture(t), run = createRun(repo, "task", head), report = saveReport(run, "review.md", "original findings");
  const original = completeEntry(report, head);
  original.findings = ["open", "accepted", "addressed", "disputed", "stale", "duplicate"].map((status, index) =>
    ({ id: `REV-${index}`, source: report, status, ...(status === "duplicate" ? { duplicateOf: "REV-0" } : {}) }));
  appendProgress(run, original); appendProgress(run, completeEntry(report, head));
  let checked = checkCompletion(run, head, ["step-1"]);
  assert.equal(checked.integrityValid, true); assert.equal(checked.completionChecksPassed, false);
  assert.equal(checked.unresolvedFindings.length, 6);
  const changedSource = saveReport(run, "different-review.md", "different report reuses REV-0");
  const wrong = completeEntry(report, head); wrong.findings = [{ id: "REV-0", source: changedSource, status: "verified" }];
  appendProgress(run, wrong);
  assert.equal(checkCompletion(run, head, ["step-1"]).unresolvedFindings.length, 6);
  const verified = completeEntry(report, head); verified.findings = original.findings.map(({ duplicateOf, ...finding }) => ({ ...finding, status: "verified" }));
  appendProgress(run, verified);
  checked = checkCompletion(run, head, ["step-1"]);
  assert.equal(checked.completionChecksPassed, true); assert.deepEqual(checked.unresolvedFindings, []);
  assert.equal(readProgress(run, head).records[0].record.findings[0].status, "open");
});

test("completion preserves stale earlier evidence and damaged history instead of trusting the final record", t => {
  const { repo, head } = committedFixture(t), run = createRun(repo, "task", head), old = saveReport(run, "old.md", "old evidence");
  appendProgress(run, completeEntry(old, head));
  writeFileSync(old.path, "changed evidence");
  const current = saveReport(run, "current.md", "current evidence"); appendProgress(run, completeEntry(current, head));
  const index = join(run, "progress.jsonl"), original = readFileSync(index, "utf8");
  assert.equal(checkCompletion(run, head, ["step-1"]).integrityValid, false);
  assert.equal(checkCompletion(run, head, ["step-1"]).completionChecksPassed, false);
  writeFileSync(index, original + '{"version":1');
  const damaged = readFileSync(index, "utf8"), result = checkCompletion(run, head, ["step-1"]);
  assert.equal(result.completionChecksPassed, false); assert.match(result.issues.join(" "), /incomplete final/);
  assert.equal(readFileSync(index, "utf8"), damaged);
});

test("completion requires a full exact current commit and refuses dirty tracked, staged and untracked state", t => {
  const { repo, git, head } = committedFixture(t), run = createRun(repo, "task", head), report = saveReport(run, "phase.md", "phase evidence");
  appendProgress(run, completeEntry(report, head));
  for (const candidate of [head.slice(0, 12), "HEAD", head.toUpperCase(), "dirty:" + head, undefined]) {
    assert.throws(() => checkCompletion(run, candidate, ["step-1"]), /full lowercase Git object ID/);
  }
  const wrong = "0".repeat(head.length), mismatch = checkCompletion(run, wrong, ["step-1"]);
  assert.equal(mismatch.completionChecksPassed, false); assert.equal(mismatch.candidate.exactHead, false);
  assert.match(mismatch.issues.join(" "), /run candidate differs/);
  writeFileSync(join(repo, "source.txt"), "dirty source\n");
  assert.equal(checkCompletion(run, head, ["step-1"]).candidate.workingTreeClean, false);
  git("add", "source.txt");
  assert.equal(checkCompletion(run, head, ["step-1"]).completionChecksPassed, false);
  git("commit", "-qm", "new candidate");
  assert.equal(checkCompletion(run, head, ["step-1"]).candidate.exactHead, false);
  const nextHead = git("rev-parse", "HEAD"), nextRun = createRun(repo, "next", nextHead);
  appendProgress(nextRun, completeEntry(report, nextHead));
  writeFileSync(join(repo, "untracked.txt"), "untracked work\n");
  assert.equal(checkCompletion(nextRun, nextHead, ["step-1"]).candidate.workingTreeClean, false);
  rmSync(join(repo, "untracked.txt"));
  assert.equal(checkCompletion(nextRun, nextHead, ["step-1"]).completionChecksPassed, true);
});

test("completion refuses clean submodules and nested masking without changing submodule flags", t => {
  const { repo, git } = committedFixture(t), child = committedFixture(t);
  git("-c", "protocol.file.allow=always", "submodule", "add", "-q", child.repo, "nested");
  git("commit", "-qm", "record submodule"); git("config", "submodule.nested.ignore", "all");
  const head = git("rev-parse", "HEAD"), run = createRun(repo, "task", head), report = saveReport(run, "phase.md", "phase evidence");
  appendProgress(run, completeEntry(report, head));
  let checked = checkCompletion(run, head, ["step-1"]);
  assert.equal(checked.integrityValid, true); assert.equal(checked.completionChecksPassed, false);
  assert.equal(checked.candidate.submodulesSupported, false);
  assert.match(checked.issues.join(" "), /indexed gitlinks\/submodules are unsupported/);
  for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
    git("-C", "nested", "update-index", flag, "source.txt");
    writeFileSync(join(repo, "nested", "source.txt"), "hidden nested dirty bytes\n");
    assert.equal(git("status", "--porcelain=v1", "--ignore-submodules=none"), "");
    const flags = git("-C", "nested", "ls-files", "-v", "source.txt");
    checked = checkCompletion(run, head, ["step-1"]);
    assert.equal(checked.completionChecksPassed, false); assert.equal(checked.candidate.submodulesSupported, false);
    assert.equal(git("-C", "nested", "ls-files", "-v", "source.txt"), flags);
    assert.equal(readFileSync(join(repo, "nested", "source.txt"), "utf8"), "hidden nested dirty bytes\n");
  }
  writeFileSync(join(repo, "nested", "untracked.txt"), "nested untracked work\n");
  assert.equal(checkCompletion(run, head, ["step-1"]).completionChecksPassed, false);
});

test("completion refuses an uninitialized indexed gitlink without inspecting its contents", t => {
  const { repo, git } = committedFixture(t), child = committedFixture(t);
  git("update-index", "--add", "--cacheinfo", `160000,${child.head},uninitialized`);
  git("commit", "-qm", "record uninitialized gitlink");
  const head = git("rev-parse", "HEAD"), run = createRun(repo, "task", head), report = saveReport(run, "phase.md", "phase evidence");
  appendProgress(run, completeEntry(report, head));
  assert.equal(existsSync(join(repo, "uninitialized")), false);
  const result = checkCompletion(run, head, ["step-1"]);
  assert.equal(result.completionChecksPassed, false); assert.equal(result.candidate.submodulesSupported, false);
  assert.equal(existsSync(join(repo, "uninitialized")), false);
});

test("CLI completion has a distinct mechanical exit status while integrity check retains its semantics", t => {
  const { repo, head } = committedFixture(t), run = createRun(repo, "task", head), report = saveReport(run, "phase.md", "phase evidence");
  const cli = new URL("../../scripts/progress-artifacts.mjs", import.meta.url).pathname;
  const call = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  appendProgress(run, entry(report, { candidate: head }));
  assert.equal(call("check", run, head).status, 0);
  const partial = call("check-completion", run, head, "step-1");
  assert.equal(partial.status, 1); assert.equal(JSON.parse(partial.stdout).integrityValid, true);
  appendProgress(run, completeEntry(report, head));
  const complete = call("check-completion", run, head, "step-1");
  assert.equal(complete.status, 0); assert.equal(JSON.parse(complete.stdout).taskAcceptance, "not-assessed");
  assert.equal(call("check-completion", run, head).status, 1);
  assert.equal(call("check-completion", run, head.slice(0, 8), "step-1").status, 1);
  assert.equal(call("check-completion", run, head, "step-1", "step-1").status, 1);
});


for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
  test(`completion refuses ${flag} rather than treating hidden changed bytes as a clean candidate`, t => {
    const { repo, git, head } = committedFixture(t), run = createRun(repo, "task", head), report = saveReport(run, "phase.md", "phase evidence");
    appendProgress(run, completeEntry(report, head));
    git("update-index", flag, "source.txt");
    writeFileSync(join(repo, "source.txt"), "different bytes hidden from git status\n");
    assert.equal(git("status", "--porcelain=v1"), "");
    const flags = git("ls-files", "-v", "source.txt"), before = readFileSync(join(repo, ".git", "index"));
    const result = checkCompletion(run, head, ["step-1"]);
    assert.equal(result.integrityValid, true); assert.equal(result.phaseClaimsComplete, true);
    assert.equal(result.completionChecksPassed, false); assert.equal(result.candidate.workingTreeClean, false);
    assert.equal(result.candidate.indexVisibilitySupported, false);
    assert.match(result.issues.join(" "), /assume-unchanged or skip-worktree/);
    assert.equal(git("ls-files", "-v", "source.txt"), flags);
    assert.deepEqual(readFileSync(join(repo, ".git", "index")), before);
    assert.equal(readFileSync(join(repo, "source.txt"), "utf8"), "different bytes hidden from git status\n");
  });
}


// Instrument actual file reads rather than an implementation-specific cache seam.
function observeEvidenceReads(body, onRead = () => {}) {
  const original = fs.readFileSync, reads = new Map();
  fs.readFileSync = function(path, ...args) {
    const bytes = original.call(this, path, ...args);
    reads.set(String(path), (reads.get(String(path)) ?? 0) + 1);
    onRead(String(path));
    return bytes;
  };
  syncBuiltinESMExports();
  try { return body(reads); }
  finally { fs.readFileSync = original; syncBuiltinESMExports(); }
}

test("progress reconciles repeated report bytes once per invocation and rereads on the next call", t => {
  const run = createRun(fixture(t), "task", "candidate-A");
  const report = saveReport(run, "shared.md", "shared full evidence\n" + "x".repeat(512 * 1024));
  const record = entry(report);
  for (const fact of Object.values(record.facts)) Object.assign(fact, { state: "complete", evidence: [report] });
  record.plan = report;
  record.findings = [{ id: "observed", source: report, status: "verified" }];
  for (let index = 0; index < 10; index++) appendProgress(run, record);
  observeEvidenceReads(reads => {
    const checked = checkProgress(run, "candidate-A");
    assert.equal(checked.integrityValid, true);
    assert.equal(checked.records.length, 10);
    assert.equal(reads.get(report.path), 1, "one physical read for all phase, plan and finding references");
    writeFileSync(report.path, "changed after the completed call");
    const next = checkProgress(run, "candidate-A");
    assert.equal(next.integrityValid, false, "previous success is never cached across invocations");
    assert.equal(reads.get(report.path), 2);
    for (const row of next.records) assert.equal(row.facts.implemented.state, "unknown");
  });
});

test("shared-file reconciliation checks each historical expected hash independently", t => {
  const run = createRun(fixture(t), "task", "candidate-A"), original = saveReport(run, "shared.md", "original evidence");
  appendProgress(run, entry(original));
  writeFileSync(original.path, "later evidence");
  const later = reference(original.path);
  appendProgress(run, entry(later));
  observeEvidenceReads(reads => {
    const checked = checkProgress(run, "candidate-A");
    assert.equal(checked.integrityValid, false);
    assert.equal(checked.records[0].facts.implemented.state, "unknown");
    assert.equal(checked.records[1].facts.implemented.state, "complete");
    assert.match(checked.records[0].issues.join(" "), /changed evidence/);
    assert.equal(reads.get(original.path), 1);
  });
});

for (const change of ["contents", "identity"]) test(`progress refuses ${change} changes after an earlier cached evidence read`, t => {
  const run = createRun(fixture(t), "task", "candidate-A"), first = saveReport(run, "first.md", "first evidence");
  const last = saveReport(run, "last.md", "last evidence");
  appendProgress(run, entry(first));
  appendProgress(run, entry(last));
  let changed = false;
  observeEvidenceReads(() => {
    const checked = checkProgress(run, "candidate-A");
    assert.equal(changed, true);
    assert.equal(checked.integrityValid, false);
    assert.equal(checked.records[0].facts.implemented.state, "unknown");
    assert.match(checked.records[0].issues.join(" "), /changed during reconciliation/);
  }, path => {
    if (path !== last.path || changed) return;
    changed = true;
    if (change === "contents") writeFileSync(first.path, "different evidence");
    else {
      const replacement = join(run, "replacement.md");
      writeFileSync(replacement, "first evidence");
      fs.renameSync(replacement, first.path);
    }
  });
});

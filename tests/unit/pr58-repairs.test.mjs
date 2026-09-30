// Deterministic contract/corpus regressions; NOT model or workflow execution evidence.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { render } from "../../scripts/generate-contracts.mjs";
const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const json = p => JSON.parse(read(p));
const workflows = ["contracts/workflows.md.tmpl", "prompts/principal-review-branch.md"];

test("REV-001: classify authority before test-first work; distinguish explicit amendment from approval", () => {
  for (const mode of ["skill", "agent"]) {
    const t = render(read("contracts/build.md.tmpl"), mode, "build", { name: "build" });
    assert.ok(t.indexOf("## Authority and evidence") < t.indexOf("## Process"));
    assert.match(t, /Before test-first work, classify/);
    assert.match(t, /task approval.*probably.*reasonable default.*urgency.*permission to proceed/s);
    assert.match(t, /complete replacement definition.*explicit authorization to replace.*source meaning/s);
    assert.match(t, /Record.*amendment.*Authority.*then proceed/s);
    assert.match(t, /hard stop before any source or test mutation.*including newly authored tests/s);
  }
});

test("REV-001: original F04 is immutable; positive companion supplies meaning, not permission alone", () => {
  const scenarios = json("build/tests/specification.yaml").scenarios;
  const original = scenarios.find(s => s.id === "F04-build-missing-agent");
  assert.equal(createHash("sha256").update(JSON.stringify(original)).digest("hex"), "89c4d1c0a9b6fb01b1b10a36be459330eda43aab51138f951cee097997a89f2c");
  const trace = json("build/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T11-31-36-645Z/F04-build-missing-agent.force.trace.jsonl");
  assert.ok(trace.changed_paths.includes("limit.test.mjs"));
  assert.ok(trace.tool_calls.some(c => c.name === "write" && c.args.content.includes("user-approved override")));
  const positive = scenarios.find(s => s.id === "F04-build-supplied-amendment-agent");
  assert.ok(positive, "missing positive amendment companion");
  assert.equal(positive.env.workspace, original.env.workspace);
  assert.match(positive.turns[0], /replace.*definitions.md#Count/);
  assert.match(positive.turns[0], /Number.isSafeInteger/);
  assert.match(positive.checklist.join(" "), /4.*malformed/);
  assert.deepEqual(positive.assert.trace.unchanged_paths, ["SPEC.md", "definitions.md"]);
});

test("REV-002: independent runs and candidates cannot silently overwrite original finding artifacts", () => {
  for (const p of workflows) {
    const t = read(p);
    for (const re of [/task.*run.*candidate/i, /create.*new.*directory/i,
      /caller.*report path/i, /never overwrite/i, /original review path/, /reviewed candidate/,
      /whole-change baseline/, /resume/i]) assert.match(t, re, p);
    assert.doesNotMatch(t, /\.principal\/reports\/(?:review-(?:1|<round>)\.md|review-diff\.txt|<step>-build\.md)/);
  }
  const build = read("contracts/build.md.tmpl");
  assert.match(build, /referenced prior artifact/);
  assert.doesNotMatch(build, /default `\.principal\/reports\/<step>-build\.md`/);
});

test("REV-003: every orchestrator artifact path initializes ignore before writing, without widening Plan", () => {
  for (const p of workflows) {
    const t = read(p);
    const init = t.indexOf("Before any artifact write");
    assert.ok(init >= 0 && init < t.indexOf("Optional read-only Investigate"), p);
    assert.match(t, /if absent.*`\.principal\/\.gitignore` containing `\*`/s);
    assert.match(t, /never overwrite an existing ignore file/);
    assert.match(t, /authority.*Investigate.*review/s);
    if (p.startsWith("contracts/")) assert.match(t, /inline Build/);
  }
  assert.match(read("contracts/plan.md.tmpl"), /No shell, implementation, reports, or other writes/);
});

test("REV-002/003: workflow replay corpus covers collisions, resume and fresh planless reports", () => {
  const cases = json("evals/requirement-fidelity/workflow-regressions.json");
  assert.equal(cases.length, 3);
  for (const c of cases) {
    assert.equal(c.status, "PARTIALLY MEASURED");
    assert.ok(c.observed.length > 0 && c.unmeasured.length > 0);
    assert.ok(c.evidence.startsWith("evidence/pr58-repairs/workflows/"));
    assert.ok(c.turns.some(t => t.startsWith("/principal-")));
    assert.ok(c.acceptance.length >= 3 && c.retain.length >= 3);
  }
  assert.match(JSON.stringify(cases), /same candidate|same HEAD/);
  assert.match(JSON.stringify(cases), /original review|original finding/);
  assert.match(JSON.stringify(cases), /git status --porcelain/);
  assert.match(JSON.stringify(cases), /existing ignore/);
});

test("REV-004: common routing checks Review Verdict before Next; bootstrap stays <=300 words", () => {
  for (const p of ["AGENTS.md", "bootstrap/BOOTSTRAP.md"]) {
    const t = read(p);
    assert.match(t, /Read (?:Review )?Verdict before Next/);
    assert.match(t, /UNVERIFIED.*evidence\/access.*caller question.*not automatic.*implementation/s);
  }
  assert.ok(read("bootstrap/BOOTSTRAP.md").trim().split(/\s+/).length <= 300);
});

test("REV-005: historical receipts cannot be labeled repair-candidate or release-head passes", () => {
  const t = read("evals/requirement-fidelity/evidence.md");
  assert.match(t, /Historical pre-release repository checks/);
  assert.match(t, /dd4b37f/);
  assert.match(t, /448ac7628980c7a69bb3ff27e3bfa882bf64c4f3/);
  assert.match(t, /128.*22.*1 skipped.*Pi/s);
  assert.match(t, /PR #58 repair-candidate evidence/);
  assert.match(t, /behavioral qualification remains \*\*NOT READY\*\*/);
  assert.match(t, /Historical.*not.*latest status/s);
  assert.doesNotMatch(t, /### Final repository checks/);
});

test("REV-006: tagged skills and agents use matching sources before and after npm publication", () => {
  for (const p of ["README.md", "AGENTS.md"]) {
    const t = read(p);
    assert.doesNotMatch(t, /npx -p principal-pi-skills principal-pi-agents/);
    assert.match(t, /after npm publication/i);
    assert.match(t, /principal-pi-skills@4\.7\.0 principal-pi-agents install/);
    assert.match(t, /principal-pi-skills@4\.7\.0 principal-pi-agents check/);
    assert.match(t, /scripts\/install-agents\.mjs/);
    assert.match(t, /448ac76.*excludes.*repair/s);
  }
  const readme = read("README.md");
  assert.match(readme, /mktemp -d/);
  assert.match(readme, /git clone --depth 1 --branch v4\.7\.0/);
});

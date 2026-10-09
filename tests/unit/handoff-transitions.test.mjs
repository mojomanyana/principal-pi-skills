/**
 * The handoff contract, enforced.
 *
 * `Next:` is the closed transition vocabulary (Review Verdict gates its use), so a
 * contract must not emit a value no workflow handles (the chain stops for no stated
 * reason), and a workflow must not branch on a value no contract can emit (a branch that
 * looks like coverage and can never run). Both failures are invisible in review â€” they
 * read as complete prose on each side.
 *
 * The declared set below is the single source of truth, mirrored in AGENTS.md. Tests here
 * check the contracts and the workflow prompts against it, so changing one without the
 * other fails rather than drifts.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** Phase â†’ the exact values its `Next:` line may carry. */
const TRANSITIONS = {
  plan: ["build"],
  debug: ["build", "plan", "done", "blocked"],
  build: ["review", "debug", "blocked"],
  review: ["build", "evidence", "git-ops"],
};

/** Phases that deliberately carry no `Next:` at all. */
const TERMINAL = ["decide", "architect", "investigate", "test-review", "git-ops"];

const SOURCES = {
  plan: "contracts/plan.md.tmpl",
  debug: "contracts/debug.md.tmpl",
  review: "contracts/review.md.tmpl",
  build: "contracts/build.md.tmpl",
};

const ARTIFACT_WORKFLOWS = ["contracts/workflows.md.tmpl", "prompts/principal-review-branch.md"];

const WORKFLOWS = ["prompts/principal-feature.md", "prompts/principal-bugfix.md", "prompts/principal-refactor.md"];

test("independent runs and resumed repairs preserve original candidate artifacts and baseline", () => {
  for (const p of ARTIFACT_WORKFLOWS) {
    const text = read(p).replace(/\s+/g, " ");
    for (const rule of [/task.*run.*candidate/i, /new.*(?:directory|report path)/i,
      /caller.*report path/i, /never overwrite/i, /original review path/, /reviewed\s+candidate/,
      /whole-change baseline/, /resume/i]) assert.match(text, rule, p);
    assert.doesNotMatch(text, /\.principal\/reports\/(?:review-(?:1|<round>)\.md|review-diff\.txt|<step>-build\.md)/);
  }
  assert.match(read(SOURCES.build), /referenced prior\s+artifact/);
  assert.doesNotMatch(read(SOURCES.build), /default `\.principal\/reports\/<step>-build\.md`/);
});

test("artifact persistence initializes ignore without overwriting policy or widening Plan permissions", () => {
  for (const p of ARTIFACT_WORKFLOWS) {
    const text = read(p).replace(/\s+/g, " ");
    assert.match(text, /Before any artifact write/);
    assert.match(text, /if absent.*`\.principal\/\.gitignore` containing `\*`/s);
    assert.match(text, /never\s+overwrite an existing ignore file/);
    assert.match(text, /Investigate/);
    if (p.startsWith("contracts/")) assert.match(text, /inline Build/i);
  }
  assert.match(read(SOURCES.plan), /No shell, implementation, reports, or other writes/);
});

test("evidence-only followups do not restart implementation through workflow resume", () => {
  const text = read("contracts/workflows.md.tmpl");
  assert.match(text, /Before starting or resuming.*evidence-only/s);
  assert.match(text, /existing checks or a disposable\s+probe.*not.*implementation/s);
  assert.ok(text.indexOf("evidence-only") < text.indexOf("**Resume.**"));
});

test("common routing checks Review Verdict before Next and surfaces unverified evidence", () => {
  for (const p of ["AGENTS.md", "bootstrap/BOOTSTRAP.md"]) {
    const text = read(p).replace(/\s+/g, " ");
    assert.match(text, /Read (?:Review )?Verdict before Next/);
    assert.match(text, /UNVERIFIED.*evidence\/access.*caller question.*not automatic.*implementation/s);
  }
});

/** Verdicts review can actually return, read from the contract rather than restated here. */
const REVIEW_VERDICTS = readFileSync(join(ROOT, "contracts/review.md.tmpl"), "utf8")
  .split("\n")
  .find((l) => l.startsWith("Verdict:"))
  .replace("Verdict:", "")
  .split("|")
  .map((v) => v.trim());

/** The `Next:` line inside the output template, not prose mentioning it. */
function declaredValues(text) {
  const line = text.split("\n").find((l) => /^Next:/.test(l));
  if (!line) return null;
  return line
    .replace(/^Next:\s*/, "")
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);
}

for (const [phase, expected] of Object.entries(TRANSITIONS)) {
  test(`${phase} declares exactly the transitions the contract allows`, () => {
    const values = declaredValues(read(SOURCES[phase]));
    assert.ok(values, `${SOURCES[phase]} has no \`Next:\` line`);
    assert.deepEqual(values, expected);
  });

  test(`${phase}'s transitions are bare words, so routing is a lookup`, () => {
    for (const v of declaredValues(read(SOURCES[phase]))) {
      // "build (fix is nontrivial)" is the shape that broke routing before: a caller
      // matching on the whole value never matches, and one matching on a prefix matches
      // by luck.
      assert.match(v, /^[a-z-]+$/, `\`${v}\` carries a parenthetical or punctuation`);
    }
  });
}

test("every declared transition is handled by both workflow prompts", () => {
  // `done` and `blocked` are terminal outcomes: a workflow handles them by stopping and
  // surfacing, which both spines describe. The routing targets are the ones that must
  // appear by name.
  const routable = new Set(Object.values(TRANSITIONS).flat().filter((v) => !["done", "blocked"].includes(v)));
  for (const wf of WORKFLOWS) {
    const text = read(wf);
    for (const target of routable) {
      assert.ok(
        text.toLowerCase().includes(target),
        `${wf} never mentions \`${target}\`, so a contract returning it routes nowhere`
      );
    }
  }
});

test("both workflows handle BLOCKED and the one-way pause explicitly", () => {
  for (const wf of WORKFLOWS) {
    const text = read(wf);
    assert.match(text, /BLOCKED|blocked/, `${wf} must say what happens on a blocked phase`);
    // Match the EXACT token review emits. The old alternation accepted either spelling, so
    // the workflows branched on REQUEST-CHANGES while review returns CHANGES-REQUESTED â€”
    // precisely the drift this test exists to catch, waved through by its own regex.
    assert.match(text, /CHANGES-REQUESTED/, `${wf} must branch on the verdict review actually emits`);
    assert.doesNotMatch(text, /REQUEST-CHANGES/, `${wf} uses a verdict token no contract emits`);
    assert.match(text, /same failure\s+repeats without new evidence/, `${wf} must stop unproductive loops`);
    assert.doesNotMatch(text, /At most two repair rounds|it counts as a repair round/);
    assert.match(text, /UNVERIFIED/, `${wf} must say what an unverified review means`);
  }
  assert.match(read("prompts/principal-feature.md"), /\[ONE-WAY\]/, "the feature spine must pause on a one-way step");
});

test("every verdict a workflow names is one review can emit", () => {
  for (const wf of WORKFLOWS) {
    const text = read(wf);
    for (const token of text.match(/\b[A-Z][A-Z-]{4,}\b/g) ?? []) {
      if (!/^(APPROVE|APPROVE-WITH-NITS|CHANGES-REQUESTED|UNVERIFIED|REQUEST-CHANGES)/.test(token)) continue;
      assert.ok(
        REVIEW_VERDICTS.includes(token),
        `${wf} mentions verdict \`${token}\`, which review never returns (it emits: ${REVIEW_VERDICTS.join(", ")})`
      );
    }
  }
});

test("terminal phases carry no Next: line", () => {
  for (const phase of TERMINAL) {
    const path = phase === "git-ops" ? "git-ops/SKILL.md" : `${phase}/SKILL.md`;
    const values = declaredValues(read(path));
    assert.equal(values, null, `${path} still declares a \`Next:\` â€” ${phase} terminates, it does not hand off`);
  }
});

test("a workflow does not branch on a value no contract can emit", () => {
  // The reverse drift: a spine that routes to a phase nothing points at. Checked against
  // the phase names the workflows actually delegate to.
  const emitted = new Set(Object.values(TRANSITIONS).flat());
  for (const wf of WORKFLOWS) {
    const text = read(wf);
    const routed = [...text.matchAll(/`Next: ([a-z-]+)`/g)].map((m) => m[1]);
    for (const r of routed) {
      assert.ok(emitted.has(r), `${wf} routes on \`Next: ${r}\`, which no contract declares`);
    }
  }
});

test("AGENTS.md documents the same set the contracts declare", () => {
  const agents = read("AGENTS.md");
  for (const [phase, values] of Object.entries(TRANSITIONS)) {
    const row = agents.split("\n").find((l) => l.startsWith(`| ${phase} |`));
    assert.ok(row, `AGENTS.md has no transition row for ${phase}`);
    for (const v of values) {
      assert.ok(row.includes(`\`${v}\``), `AGENTS.md's ${phase} row omits \`${v}\``);
    }
  }
});

test("the review-branch prompt reviews and finishes but never plans or builds", () => {
  const text = read("prompts/principal-review-branch.md");
  assert.match(text, /principal-review/, "must delegate to the review agent");
  assert.match(text, /CHANGES-REQUESTED/);
  assert.match(text, /UNVERIFIED/);
  assert.match(text, /finish mode/i, "must hand off to git-ops finish mode on approval");
  assert.doesNotMatch(text, /(?:invoke|dispatch|delegate to)\s+`?principal-(?:plan|build)/i, "review-branch invokes neither phase");
  assert.match(text, /invokes neither Plan nor Build/);
  assert.match(text, /optional plan map/, "an existing map is evidence, not a required planning phase");
  const flow = text.replace(/\s+/g, " ");
  assert.match(flow, /If artifact writes are prohibited, skip prepare\/complete: dispatch with a unique operation_id/);
  assert.match(flow, /`result` to verify and read the exact settled native final without retaining a file/);
  assert.match(flow, /Apply this artifact retention step only when writes are allowed/);
  assert.doesNotMatch(flow, /explicit artifact prohibition stops dispatch/);
  assert.match(text, /\$\{1:-main\}/, "base branch defaults to main via a template argument");
});

test("native report retention is coordinator-owned and preserves private artifact boundaries", () => {
  for (const wf of WORKFLOWS) {
    const text = read(wf).replace(/\s+/g, " ");
    assert.match(text, /prepare.*operation_id, canonical workspace, reportPath and handoff metadata/);
    assert.match(text, /complete.*retains the exact captured final automatically/);
    assert.match(text, /task\/run\/candidate allocation belongs to prepare, not the child/);
    assert.match(text, /suppl[yY].*complete diff once/i);
    assert.match(text, /scoped re-review/);
  }
  assert.match(read("agents/principal-review.md"), /## Scoped re-review/);
  assert.doesNotMatch(read("review/SKILL.md"), /## Scoped re-review/);
  assert.match(read("agents/principal-build.md"), /complete implementation report once/);
  assert.doesNotMatch(read("agents/principal-build.md"), /exactly five lines/);
});

test("native handoffs bind an exact described definition and never fallback after failure", () => {
  for (const path of ["AGENTS.md", "bootstrap/BOOTSTRAP.md", "contracts/workflows.md.tmpl", "prompts/principal-review-branch.md"]) {
    const text = read(path);
    assert.match(text, /delegate_describe/);
    assert.match(text, /definitionId/);
    assert.match(text, /principal-pi-skills/);
    assert.match(text, /genuinely\s+absent/);
    assert.match(text, /explicitly configured/);
    assert.match(text, /report\s+gap/);
    assert.doesNotMatch(text, /unknown agent.*run.*inline/s);
    assert.doesNotMatch(text, /Choose the cheapest|Use the strongest|capable mid-tier/);
  }
});

test("native workflows use phase identities and batch independent parallel children", () => {
  for (const path of ["AGENTS.md", "bootstrap/BOOTSTRAP.md", "README.md", ...WORKFLOWS]) {
    const text = read(path);
    assert.match(text, /delegate_all/);
    assert.match(text, /definitionId/);
    assert.match(text, /(?:never overlapping|Do not overlap|Do not\s+launch concurrent|overlapping single)/i);
    assert.match(text, /(?:separate|distinct)[\s\S]*?worktrees/);
    assert.doesNotMatch(text, /(?:Always delegate to|dispatch one fresh|Invoke|â†’) `principal-(?:build|review|plan|debug)`/);
  }
  for (const path of [...WORKFLOWS, "prompts/principal-review-branch.md"]) {
    assert.match(read(path), /delegate\(\{agent:"review",definitionId,/);
  }
  for (const path of WORKFLOWS) {
    const text = read(path);
    assert.match(text, /delegate_all\(\{children:\[\.\.\.\]\}\)/);
    assert.match(text, /agent:"build"[\s\S]*?captured build `definitionId`/);
    assert.match(text, /integrate\s+serially/);
    assert.match(text, /preserve\s+completed\s+siblings/i);
  }
});

// Routing clauses are product contracts; these guards do not measure model compliance.
test("coordinator handoffs preserve selected evidence and wait for reviewer settlement", () => {
  for (const path of [...WORKFLOWS, "prompts/principal-review-branch.md"]) {
    const text = read(path).replace(/\s+/g, " ");
    assert.match(text, /unmodified.*describe.*(?:response|handoff)/i, path);
    assert.match(text, /selected.*skill\/agent.*(?:source|file)/i, path);
    assert.match(text, /(?:owner.*due stage|owners\/due stages)/, path);
    assert.match(text, /(?:After.*returns|After return).*native result.*(?:cleanup|settlement).*verdict/i, path);
    assert.match(text, /(?:Missing evidence due|Missing due prerequisites)/, path);
    assert.match(text, /(?:never guess|never guess an).*path/i, path);
  }
});

test("review disposition table routes missing evidence away from Build in every generated spine", () => {
  const expected = new Map([
    ["CHANGES-REQUESTED", "build"], ["UNVERIFIED", "evidence"],
    ["APPROVE", "git-ops"], ["APPROVE-WITH-NITS", "git-ops"],
  ]);
  for (const path of ["contracts/workflows.md.tmpl", ...WORKFLOWS]) {
    const rows = [...read(path).matchAll(/^\| (CHANGES-REQUESTED|UNVERIFIED|APPROVE(?:-WITH-NITS)?) \| ([a-z-]+) \|/gm)];
    assert.equal(rows.length, expected.size, `${path}: missing or duplicate disposition`);
    assert.deepEqual(new Map(rows.map(([, verdict, next]) => [verdict, next])), expected, path);
  }
  for (const path of ["review/SKILL.md", "agents/principal-review.md"]) {
    assert.match(read(path), /`evidence` for UNVERIFIED/);
    assert.doesNotMatch(read(path), /build\*\* if anything needs addressing/);
  }
});

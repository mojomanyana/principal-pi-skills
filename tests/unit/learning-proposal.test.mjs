import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLearningProposal } from "../../scripts/learning-proposal.mjs";
import { prepareHandoff, resolveHandoff, readLocalHandoffReference } from "../../scripts/compact-handoff.mjs";

const records = [
  ["Delta export", "Clicking download returned an empty file."],
  ["Journal export", "Reading the exported JSON caught a missing entry."],
  ["Text edit", "A style-only edit was adequately checked by the existing procedure."],
];
const draft = {
  kind: "improve-skill", coverage: "gap", target: "review", change: "Open a deliverable and compare its contents to the requested record.",
  alternative: "The existing reviewer can do this directly.", limits: "Only applies when the output itself carries the result.",
  trial: "Compare review with and without the step on a new export and a style-only change.",
  cases: records.map(([taskId, quote], index) => ({ inputId: `case${index}`, taskId, quote,
    basis: "task-record", stance: index === 2 ? "limits" : "supports" })),
};
async function inputs(t) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "principal-learning-")));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const required = records.map(([name, line], index) => {
    const content = [name, line, "private unrelated evidence stays at source"].join("\n");
    const path = join(cwd, `case-${index}.txt`);
    writeFileSync(path, content);
    return { id: `case${index}`, reference: { kind: "file", path, sha256: createHash("sha256").update(content).digest("hex") } };
  });
  const handoff = prepareHandoff({ task: "Consider cross-task results", scope: "This project's review skill", profile: "task", required });
  const resolve = () => resolveHandoff(handoff, { resolveReference: ref => readLocalHandoffReference(ref, cwd) });
  return { handoff, resolve, resolved: await resolve() };
}
test("selected real source bytes support a scoped pending proposal; limitations and exact revision survive order changes", async t => {
  const { handoff, resolved } = await inputs(t);
  const make = proposal => buildLearningProposal(handoff, resolved, proposal);
  const result = make(draft);
  assert.equal(result.state, "proposed");
  assert.equal(result.supportingTaskCount, 2);
  assert.equal(result.approval, false);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.administrativeWrites, false);
  assert.ok(result.card.evidence.some(row => row.stance === "limits"));
  assert.doesNotMatch(JSON.stringify(result), /private unrelated evidence/);
  assert.equal(result.proposalId, make({ ...draft, cases: [...draft.cases].reverse() }).proposalId);
  assert.notEqual(result.proposalId, make({ ...draft, trial: "A different trial." }).proposalId);
});
test("different tasks, different requirements for a lesson, skill and independent role", async t => {
  const { handoff, resolved } = await inputs(t);
  const make = fields => buildLearningProposal(handoff, resolved, { ...draft, ...fields });
  assert.equal(make({ kind: "new-skill", target: "data reconciliation" }).state, "proposed");
  assert.equal(make({ kind: "lesson" }).state, "lesson");
  assert.equal(make({ coverage: "covered" }).state, "lesson");
  assert.equal(make({ coverage: undefined }).state, "needs-evidence");
  assert.throws(() => make({ kind: "new-subagent" }), /separate responsibility/);
  const role = make({ kind: "new-subagent", boundary: { reason: "Blind second assessment", inputs: "the delivered archive",
    output: "a discrepancy report", tools: "read and compare" } });
  assert.equal(role.state, "proposed");
  assert.equal(role.card.boundary.tools, "read and compare");
  assert.equal(role.approval, false);
});
test("claims must cite every selected source; changed, fabricated and partial inputs cannot create proposals", async t => {
  const { handoff, resolve, resolved } = await inputs(t);
  const make = cases => buildLearningProposal(handoff, resolved, { ...draft, cases });
  assert.throws(() => make(draft.cases.slice(0, 2)), /every selected/);
  assert.throws(() => make([draft.cases[0], draft.cases[0], draft.cases[2]]), /exactly once/);
  assert.throws(() => make([{ ...draft.cases[0], quote: "Unsupported result" }, ...draft.cases.slice(1)]), /exact outcome/);
  assert.throws(() => make([{ ...draft.cases[0], taskId: "Unrelated job" }, ...draft.cases.slice(1)]), /task name/);
  resolved.inputs[0].excerpt += "\nTicket T-10";
  assert.throws(() => make([{ ...draft.cases[0], taskId: "T-1" }, ...draft.cases.slice(1)]), /task name/);
  resolved.inputs[0].references.push({ kind: "bookie-context-input", uid: "another-task" });
  assert.throws(() => make(draft.cases), /one exact source per case/);
  writeFileSync(handoff.required[0].reference.path, "changed since selection");
  const stale = await resolve();
  assert.equal(stale.state, "blocked");
  assert.throws(() => buildLearningProposal(handoff, stale, draft), /required/);
});
test("limited evidence stays visible, hearsay and simulated outcomes cannot promote themselves", async t => {
  const { handoff, resolved } = await inputs(t);
  const make = cases => buildLearningProposal(handoff, resolved, { ...draft, cases });
  for (const basis of ["report", "fixture"]) {
    const result = make(draft.cases.map(row => ({ ...row, basis })));
    assert.equal(result.supportingTaskCount, 0);
    assert.equal(result.state, "needs-evidence");
  }
  const conflict = make(draft.cases.map((row, i) => i === 2 ? { ...row, stance: "contradicts" } : row));
  assert.equal(conflict.supportingTaskCount, 2);
  assert.equal(conflict.state, "needs-evidence");
});
test("two reads of one Bookie source and two attempts of one task still count once; renewed bundles preserve the revision", async t => {
  const { handoff, resolved } = await inputs(t);
  const cases = structuredClone(draft.cases);
  const first = resolved.inputs[0];
  first.references = [{ kind: "bookie-context-input", path: "/activities/one.md", uid: "ACT-1", sourceHash: "first", bundleId: "old" }];
  const initial = buildLearningProposal(handoff, resolved, draft);
  first.references[0].bundleId = "renewed";
  assert.equal(buildLearningProposal(handoff, resolved, draft).proposalId, initial.proposalId);
  const second = resolved.inputs[1];
  second.references = [{ ...first.references[0], bundleId: "another wrapper" }];
  const shared = buildLearningProposal(handoff, resolved, draft);
  assert.equal(shared.supportingTaskCount, 1);
  assert.equal(shared.state, "needs-evidence");
  second.references = [{ kind: "file", path: "distinct-attempt" }];
  second.excerpt += "\n" + cases[0].taskId;
  cases[1].taskId = cases[0].taskId;
  assert.equal(buildLearningProposal(handoff, resolved, { ...draft, cases }).supportingTaskCount, 1);
});

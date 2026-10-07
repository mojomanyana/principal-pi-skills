/**
 * Tests for the contract generator.
 *
 * The load-bearing one is the last: every committed contract still matches its template.
 * That is the check that makes single-representation edits unmergeable — the thing the
 * agents-lockstep CI rule could only approximate, because "both files changed" is not the
 * same claim as "both files agree".
 *
 * Run with `node --test tests/unit/` (no dependencies — node:test is built in).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { render, renderWorkflow, renderAgentManifest, MODES, WORKFLOW_MODES } from "../../scripts/generate-contracts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("shared text reaches both modes", () => {
  const t = "alpha\n{{#skill}}\nS\n{{/skill}}\n{{#agent}}\nA\n{{/agent}}\nomega";
  assert.equal(render(t, "skill"), "alpha\nS\nomega");
  assert.equal(render(t, "agent"), "alpha\nA\nomega");
});

test("marker lines are consumed entirely, leaving no blank line behind", () => {
  // A stray blank would be invisible in review and would change every prompt's whitespace.
  assert.equal(render("a\n{{#skill}}\nb\n{{/skill}}\nc", "skill"), "a\nb\nc");
  assert.equal(render("a\n{{#agent}}\nb\n{{/agent}}\nc", "skill"), "a\nc");
});

test("template comments reach neither output", () => {
  const t = "{{! private note\nkept";
  assert.equal(render(t, "skill"), "kept");
  assert.equal(render(t, "agent"), "kept");
});

test("an empty block contributes nothing, in either mode", () => {
  assert.equal(render("x\n{{#agent}}\n{{/agent}}\ny", "agent"), "x\ny");
  assert.equal(render("x\n{{#agent}}\n{{/agent}}\ny", "skill"), "x\ny");
});

test("nested blocks are an error, not a guess", () => {
  const t = "{{#skill}}\n{{#agent}}\nz\n{{/agent}}\n{{/skill}}";
  assert.throws(() => render(t, "skill"), /do not nest/);
});

test("an unclosed block is an error", () => {
  assert.throws(() => render("{{#skill}}\nz", "skill"), /never closed/);
});

test("a close with no open is an error", () => {
  assert.throws(() => render("z\n{{/skill}}", "skill"), /no matching open/);
});

test("a mismatched close is an error", () => {
  assert.throws(() => render("{{#skill}}\nz\n{{/agent}}", "skill"), /closes a \{\{#skill\}\}/);
});

test("errors name the template and line so a failure is actionable", () => {
  assert.throws(() => render("a\nb\n{{/skill}}", "skill", "contracts/x.tmpl"), /contracts\/x\.tmpl:3:/);
});

// Driven off the generator's own MODES table rather than a second list here: a mode added
// to the generator and forgotten here would ship an unchecked file, which is precisely the
// class of drift this whole mechanism exists to remove.
test("shared orchestration rules render identically into both spines", () => {
  const template = read("contracts/workflows.md.tmpl");
  const feature = render(template, "feature", "contracts/workflows.md.tmpl");
  const bugfix = render(template, "bugfix", "contracts/workflows.md.tmpl");
  const section = (text) => text.match(/<!-- shared:start -->([\s\S]*?)<!-- shared:end -->/)?.[1];
  assert.ok(section(feature), "feature rendering has no shared section");
  assert.equal(section(feature), section(bugfix));
});

for (const [mode, spec] of Object.entries(WORKFLOW_MODES)) {
  test(`${spec.path} matches the workflow template (${mode})`, () => {
    const template = read("contracts/workflows.md.tmpl");
    assert.equal(read(spec.path), renderWorkflow(template, spec, "contracts/workflows.md.tmpl"));
  });
}

for (const contract of ["plan", "build", "review", "debug", "investigate"]) {
  for (const [mode, spec] of Object.entries(MODES)) {
    test(`${contract}: ${spec.path(contract)} matches the template (${mode})`, () => {
      const template = read(`contracts/${contract}.md.tmpl`);
      assert.equal(
        read(spec.path(contract)),
        render(template, spec.block, `contracts/${contract}.md.tmpl`, { name: spec.name(contract) }),
        `${spec.path(contract)} drifted — edit contracts/${contract}.md.tmpl and run \`npm run generate\``
      );
    });
  }

  test(`${contract}: the skill and agent renderings actually differ`, () => {
    // Guards against a template that lost its blocks and now renders one file twice —
    // which would pass every drift check above while silently merging two contracts.
    const template = read(`contracts/${contract}.md.tmpl`);
    const vars = { name: contract };
    assert.notEqual(render(template, "skill", "t", vars), render(template, "agent", "t", vars));
  });
}

test("delegated manifest binds exact five inline and delegated full-file bytes from one generation", () => {
  const phases = ["plan", "build", "review", "debug", "investigate"];
  const outputs = phases.flatMap(phase => Object.values(MODES).map(mode => ({
    path: mode.path(phase), rendered: render(read(`contracts/${phase}.md.tmpl`), mode.block, phase, { name: mode.name(phase) }),
  })));
  const expected = JSON.parse(renderAgentManifest(outputs));
  assert.deepEqual(JSON.parse(read("principal-agents.json")), expected);
  assert.equal(expected.version, 1);
  assert.equal(expected.package, "principal-pi-skills");
  assert.deepEqual(Object.keys(expected.bindings).sort(), [...phases].sort());
  for (const phase of phases) {
    const binding = expected.bindings[phase];
    assert.equal(binding.skill, `${phase}/SKILL.md`);
    assert.equal(binding.agent, `agents/principal-${phase}.md`);
    for (const kind of ["skill", "agent"]) {
      const independentlyReadBytes = readFileSync(join(ROOT, binding[kind]));
      assert.equal(binding[`${kind}Sha256`], createHash("sha256").update(independentlyReadBytes).digest("hex"));
    }
  }
  const changed = structuredClone(outputs);
  changed.find(output => output.path === "agents/principal-build.md").rendered += "\nChanged delegated obligation\n";
  assert.notEqual(JSON.parse(renderAgentManifest(changed)).bindings.build.agentSha256, expected.bindings.build.agentSha256);
  assert.throws(() => renderAgentManifest(outputs.filter(output => output.path !== "plan/SKILL.md")), /missing/i);
  assert.throws(() => renderAgentManifest([...outputs, outputs[0]]), /duplicate/i);
});
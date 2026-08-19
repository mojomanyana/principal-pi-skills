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
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { render, renderWorkflow, MODES, WORKFLOW_MODES } from "../../scripts/generate-contracts.mjs";

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
test("workflow assurance rules render identically into both namespaced spines", () => {
  const template = read("contracts/workflows.md.tmpl");
  const feature = render(template, "feature", "contracts/workflows.md.tmpl");
  const bugfix = render(template, "bugfix", "contracts/workflows.md.tmpl");
  const section = (text) => text.match(/<!-- assurance:shared:start -->([\s\S]*?)<!-- assurance:shared:end -->/)?.[1];
  assert.ok(section(feature), "feature rendering has no shared assurance section");
  assert.equal(section(feature), section(bugfix));
});

for (const [mode, spec] of Object.entries(WORKFLOW_MODES)) {
  test(`${spec.path} matches the workflow template (${mode})`, () => {
    const template = read("contracts/workflows.md.tmpl");
    assert.equal(read(spec.path), renderWorkflow(template, spec, "contracts/workflows.md.tmpl"));
  });
}

for (const alias of ["feature-alias", "bugfix-alias"]) {
  test(`${WORKFLOW_MODES[alias].path} embeds the complete workflow rather than a literal slash-command handoff`, () => {
    const text = read(WORKFLOW_MODES[alias].path);
    assert.match(text, /DEPRECATED alias/);
    assert.match(text, /assurance-state\.mjs/);
    assert.match(text, /node <tool> init --workflow/);
    assert.match(text, /BLOCKED_CRITICAL_ASSURANCE/);
    assert.doesNotMatch(text, /Run `\/principal-(feature|bugfix)` for:/);
  });
}

for (const contract of ["plan", "review", "debug"]) {
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

  test(`${contract}: the namespaced agent differs from the generic one only in its name`, () => {
    const template = read(`contracts/${contract}.md.tmpl`);
    const generic = render(template, "agent", "t", { name: contract });
    const namespaced = render(template, "agent", "t", { name: `principal-${contract}` });
    assert.equal(namespaced.replace(`name: principal-${contract}`, `name: ${contract}`), generic);
  });
}

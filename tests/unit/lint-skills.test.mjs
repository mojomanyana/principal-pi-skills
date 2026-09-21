import test from "node:test";
import assert from "node:assert/strict";
import { lintSkill } from "../../scripts/lint-skills.mjs";

test("a valid skill produces no findings", () => {
  const ok = `---\nname: decide\ndescription: >\n  Use when the user is exploring a decision.\nallowed-tools: read\n---\n# Decide\nbody`;
  assert.deepEqual(lintSkill("decide/SKILL.md", ok), []);
});

test("name must match the directory", () => {
  const bad = `---\nname: architect\ndescription: Use when x.\n---\nbody`;
  assert.match(lintSkill("decide/SKILL.md", bad).join("\n"), /name .*architect.* does not match directory .*decide/);
});

test("description must start with Use and stay under 1024 characters", () => {
  const noUse = `---\nname: decide\ndescription: Helps decide things.\n---\nbody`;
  assert.match(lintSkill("decide/SKILL.md", noUse).join("\n"), /description must start with "Use/);
  const long = `---\nname: decide\ndescription: Use when ${"x".repeat(1030)}\n---\nbody`;
  assert.match(lintSkill("decide/SKILL.md", long).join("\n"), /description exceeds 1024/);
});

test("missing frontmatter is a finding", () => {
  assert.match(lintSkill("decide/SKILL.md", "# no frontmatter").join("\n"), /no frontmatter/);
});

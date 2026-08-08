/**
 * The handoff contract, enforced.
 *
 * `Next:` is the only routing signal between phases, so both halves have to agree: a
 * contract must not emit a value no workflow handles (the chain stops for no stated
 * reason), and a workflow must not branch on a value no contract can emit (a branch that
 * looks like coverage and can never run). Both failures are invisible in review — they
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

/** Phase → the exact values its `Next:` line may carry. */
const TRANSITIONS = {
  plan: ["build"],
  debug: ["build", "plan", "done", "blocked"],
  build: ["review", "debug", "blocked"],
  review: ["build", "git-ops"],
};

/** Phases that deliberately carry no `Next:` at all. */
const TERMINAL = ["decide", "architect", "git-ops"];

const SOURCES = {
  plan: "contracts/plan.md.tmpl",
  debug: "contracts/debug.md.tmpl",
  review: "contracts/review.md.tmpl",
  build: "build/SKILL.md",
};

const WORKFLOWS = ["prompts/principal-feature.md", "prompts/principal-bugfix.md"];

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
    assert.match(text, /repair|REQUEST-CHANGES|CHANGES-REQUESTED/i, `${wf} must define the repair loop`);
    assert.match(text, /two|2 rounds|twice/i, `${wf} must bound the repair loop`);
    assert.match(text, /UNVERIFIED/, `${wf} must say what an unverified review means`);
  }
  assert.match(read("prompts/principal-feature.md"), /\[ONE-WAY\]/, "the feature spine must pause on a one-way step");
});

test("terminal phases carry no Next: line", () => {
  for (const phase of TERMINAL) {
    const path = phase === "git-ops" ? "git-ops/SKILL.md" : `${phase}/SKILL.md`;
    const values = declaredValues(read(path));
    assert.equal(values, null, `${path} still declares a \`Next:\` — ${phase} terminates, it does not hand off`);
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

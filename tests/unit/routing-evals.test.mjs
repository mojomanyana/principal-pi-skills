import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { loadSkillDescriptions, orderedPairs } from "../../scripts/skill-descriptions.mjs";
import {
  buildTriggerPayload,
  evaluateAdversarialQueries,
  expandAdversarialCases,
  scoreTriggerRuns,
  validateTriggerCorpus,
} from "../../scripts/check-skill-triggers.mjs";
import { indexBooleanResults } from "../../scripts/model-json.mjs";

test("loads folded and plain descriptions from only the named SKILL.md files", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-descriptions-"));
  for (const [name, description] of [
    ["alpha", ">\n  Use when choosing.\n  Not for building."],
    ["beta", "Use when building."],
  ]) {
    mkdirSync(join(root, name));
    writeFileSync(join(root, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`);
  }

  assert.deepEqual(loadSkillDescriptions(root, ["alpha", "beta"]), [
    { name: "alpha", description: "Use when choosing. Not for building." },
    { name: "beta", description: "Use when building." },
  ]);
});

test("rejects a missing or mismatched frontmatter description", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-descriptions-bad-"));
  mkdirSync(join(root, "alpha"));
  writeFileSync(join(root, "alpha", "SKILL.md"), "---\nname: beta\n---\nbody\n");
  assert.throws(() => loadSkillDescriptions(root, ["alpha"]), /alpha\/SKILL\.md.*name|description/i);
});

test("generates all directed description pairs", () => {
  const skills = [
    { name: "a", description: "A" },
    { name: "b", description: "B" },
    { name: "c", description: "C" },
  ];
  assert.deepEqual(orderedPairs(skills).map(([a, b]) => `${a.name}->${b.name}`), [
    "a->b", "a->c", "b->a", "b->c", "c->a", "c->b",
  ]);
});

test("the authored trigger suite has 20 cases per skill at a 60/40 split", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const cases = JSON.parse(readFileSync(join(root, "evals/triggers.json"), "utf8"));
  for (const skill of ["decide", "architect", "plan", "build", "review", "debug", "git-ops"]) {
    const own = cases.filter((item) => item.skill === skill);
    assert.equal(own.length, 20, skill);
    assert.equal(own.filter((item) => item.positive).length, 12, skill);
    assert.equal(own.filter((item) => !item.positive).length, 8, skill);
  }
});

test("expands intended, ambiguous, and no-skill queries into binary routing probes", () => {
  const queries = [
    { id: "one", collision: "a->b", query: "arguable", intended: "AMBIGUOUS", acceptable: ["a", "b"] },
    { id: "two", category: "hard-negative", query: "explain a term", intended: "NO_SKILL" },
  ];
  assert.deepEqual(expandAdversarialCases(queries, ["a", "b"]), [
    { id: "one:a", queryId: "one", skill: "a", positive: true, query: "arguable" },
    { id: "one:b", queryId: "one", skill: "b", positive: true, query: "arguable" },
    { id: "two:a", queryId: "two", skill: "a", positive: false, query: "explain a term" },
    { id: "two:b", queryId: "two", skill: "b", positive: false, query: "explain a term" },
  ]);
});

test("rejects malformed fixtures and generated-id collisions before model calls", () => {
  const originals = Array.from({ length: 20 }, (_, index) => ({
    id: `base-${index}`,
    skill: "a",
    positive: index < 12,
    query: "q",
  }));
  const adversarial = [
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `edge-${index}`,
      collision: "a->b",
      query: "q",
      intended: "a",
    })),
    { id: "none-1", category: "hard-negative", query: "q", intended: "NO_SKILL" },
  ];
  const reject = (mutate, pattern) => {
    const base = structuredClone(originals);
    const edges = structuredClone(adversarial);
    mutate(base, edges);
    assert.throws(() => validateTriggerCorpus(base, edges, ["a"], ["a->b"]), pattern);
  };
  reject((_, edges) => { edges[0].intended = "wrong"; }, /intended/i);
  reject((_, edges) => { edges[1].id = edges[0].id; }, /duplicate/i);
  reject((_, edges) => { delete edges[0].id; }, /id/i);
  reject((_, edges) => { delete edges[0].query; }, /query/i);
  reject((_, edges) => { edges[0].category = "typo"; }, /category/i);
  reject((_, edges) => { edges.at(-1).collision = "a->b"; }, /hard-negative/i);
  reject((_, edges) => { edges[0].acceptable = ["a", "b"]; }, /acceptable.*AMBIGUOUS/i);
  reject((base) => { base[0].id = "edge-0:a"; }, /generated|duplicate/i);
});

test("scoring ignores acceptable on a non-ambiguous record", () => {
  const queries = [{
    id: "one",
    collision: "a->b",
    query: "pick a",
    intended: "a",
    acceptable: ["b"],
  }];
  const verdicts = [
    { queryId: "one", skill: "a", selected: false },
    { queryId: "one", skill: "b", selected: true },
  ];
  assert.deepEqual(evaluateAdversarialQueries(queries, verdicts).collisions["a->b"], {
    actualMisrouting: true,
    failingQueries: [{ id: "one", query: "pick a", intended: "a", selected: ["b"] }],
  });
});

test("reports collision misrouting with the failing query", () => {
  const queries = [
    { id: "one", collision: "a->b", query: "pick one", intended: "a" },
    { id: "two", collision: "a->b", query: "either", intended: "AMBIGUOUS", acceptable: ["a", "b"] },
  ];
  const verdicts = [
    { queryId: "one", skill: "a", selected: false },
    { queryId: "one", skill: "b", selected: true },
    { queryId: "two", skill: "a", selected: true },
    { queryId: "two", skill: "b", selected: true },
  ];
  assert.deepEqual(evaluateAdversarialQueries(queries, verdicts), {
    collisions: {
      "a->b": { actualMisrouting: true, failingQueries: [{ id: "one", query: "pick one", intended: "a", selected: ["b"] }] },
    },
    hardNegatives: { actualMisrouting: false, failingQueries: [] },
  });
});

test("the model payload hides trigger labels and polarity-bearing fixture ids", () => {
  const payload = buildTriggerPayload(
    [{ name: "decide", description: "Use when choosing." }],
    [{ id: "decide-n01", skill: "decide", positive: false, query: "Implement it." }],
  );
  assert.deepEqual(payload.cases, [{ id: "q001", skill: "decide", query: "Implement it." }]);
  assert.equal(JSON.stringify(payload).includes("positive"), false);
  assert.equal(JSON.stringify(payload).includes("decide-n01"), false);
});

test("model result indexing rejects duplicate, unknown, and missing ids", () => {
  assert.throws(() => indexBooleanResults(["a"], [{ id: "a", trigger: true }, { id: "a", trigger: false }], "trigger"), /duplicate/i);
  assert.throws(() => indexBooleanResults(["a"], [{ id: "b", trigger: true }], "trigger"), /unknown/i);
  assert.throws(() => indexBooleanResults(["a", "b"], [{ id: "a", trigger: true }], "trigger"), /missing/i);
});

test("scores three runs at a 0.5 selection threshold with per-skill precision and recall", () => {
  const cases = [
    { id: "a-positive", skill: "a", positive: true },
    { id: "a-near-miss", skill: "a", positive: false },
    { id: "b-positive", skill: "b", positive: true },
    { id: "b-near-miss", skill: "b", positive: false },
  ];
  const runs = [
    { "a-positive": true, "a-near-miss": true, "b-positive": true, "b-near-miss": true },
    { "a-positive": true, "a-near-miss": true, "b-positive": false, "b-near-miss": true },
    { "a-positive": false, "a-near-miss": false, "b-positive": true, "b-near-miss": false },
  ];

  assert.deepEqual(scoreTriggerRuns(cases, runs, ["a", "b"], 0.5), {
    a: { truePositive: 1, falsePositive: 1, falseNegative: 0, precision: 0.5, recall: 1 },
    b: { truePositive: 1, falsePositive: 1, falseNegative: 0, precision: 0.5, recall: 1 },
  });
});

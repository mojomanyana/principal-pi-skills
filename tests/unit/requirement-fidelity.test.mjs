// Contract regressions, not model-behavior or instruction-delivery measurements.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { render } from "../../scripts/generate-contracts.mjs";
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const contract = (name, mode) => render(read(`contracts/${name}.md.tmpl`), mode, name, { name });

for (const mode of ["skill", "agent"]) {
  test(`plan ${mode}: accessible paths are read; missing authority overrides defaults`, () => {
    const text = contract("plan", mode);
    for (const rule of [/read.*completely/i, /truncated/, /missing normative.*load-bearing/i,
      /conflicting binding sources/, /BLOCKED:.*ONE question/, /inaccessible/, /undefined/]) assert.match(text, rule);
    for (const obsolete of [/A clarifying question is never/, /If you can name a defensible assumption/,
      /references requirements it\s+does not include.*stop/s, /only file you ever/]) assert.doesNotMatch(text, obsolete);
  });
  test(`plan ${mode}: collision-safe identities, complete map and persisted artifact survive shortening`, () => {
    const text = contract("plan", mode);
    for (const rule of [/impl:S1/, /disjoint/, /source alias/, /local locator/, /exact clause/,
      /one map row per/, /Gate/, /planned, not executed/, /Tiny normative/,
      /never overwrite/, /persistence fails/, /short chat summary/, /complete executable/]) assert.match(text, rule);
    assert.doesNotMatch(text, /also write it\s+verbatim/);
  });
  test(`build ${mode}: missing referenced authority stops before even new tests`, () => {
    const text = contract("build", mode);
    assert.match(text, /hard stop before any source or test mutation/i);
    assert.match(text, /including newly authored tests/);
    assert.match(text, /recognizable task.*conventional default/s);
    assert.match(text, /report writes.*allowed/i);
    assert.match(text, /available.*read.*missing/s);
  });
  test(`discovery ${mode}: unavailable tools never authorize shell; tiny plans still read`, () => {
    for (const name of ["plan", "investigate"]) {
      const text = contract(name, mode);
      assert.match(text, /Do not substitute shell/);
      assert.match(text, /named.*read|read.*named/s);
      assert.match(text, /missing capability/);
    }
    const text = contract("plan", mode);
    assert.match(text, /Tiny.*typo.*read.*named existing file/s);
    assert.match(text, /expected.*accept.*reject/s);
  });
  test(`build ${mode}: source, candidate and per-requirement evidence are explicit`, () => {
    const text = contract("build", mode);
    for (const field of ["Authority", "Candidate", "Requirements", "Gates", "Evidence gaps"]) assert.match(text, new RegExp(`^${field}:`, "m"));
    for (const rule of [/global gates/, /completed.*unverified.*unmet/s, /untracked/, /stale/,
      /Bare IDs are insufficient/, /passing suite.*not/i]) assert.match(text, rule);
  });
  test(`build ${mode}: compression preserves evidence fields and only nonbehavioral typos are exempt`, () => {
    const text = contract("build", mode);
    const output = text.split("## Output — implementation report")[1];
    assert.match(output, /Even compressed.*Authority, Candidate, Requirements, Gates, Evidence gaps/s);
    assert.match(output, /all applicable report fields/);
    assert.match(output, /Assumptions.*Blocked/s);
    assert.match(output, /none.*N\/A/);
    assert.match(text, /Only a true nonbehavioral typo\/comment fix/);
    assert.doesNotMatch(text, /A typo or comment fix needs none of this/);
  });
  test(`review ${mode}: source omissions and stale evidence cannot become approval`, () => {
    const text = contract("review", mode);
    for (const field of ["Authority", "Candidate", "Requirement reconciliation", "Evidence gaps", "Follow-ups"]) assert.match(text, new RegExp(`^${field}:`, "m"));
    for (const rule of [/obligations the map omitted/, /stale.*UNVERIFIED/s, /missing normative/,
      /acceptance condition/, /original whole-change/, /global gates/]) assert.match(text, rule);
    assert.doesNotMatch(text, /The report line is the evidence;/);
  });
  test(`investigate ${mode}: optional source discovery does not choose precedence`, () => {
    const text = contract("investigate", mode);
    for (const rule of [/candidate authoritative/, /precedence/, /source says required/, /measurement observed/,
      /caller may persist/, /compliance verdict/]) assert.match(text, rule);
    assert.match(text, /allowed-tools: read, grep, find, ls, context:files/);
  });
  test(`debug ${mode}: sandbox proof is not an applied caller fix`, () => {
    const text = contract("debug", mode);
    for (const rule of [/proposed\/unproven/, /proved in disposable workspace only/, /applied by Build/,
      /hypothesis \(unconfirmed\)/, /not run.*reason/i, /switch.*Build/, /missing definition/]) assert.match(text, rule);
    assert.doesNotMatch(text, /Asked directly to fix it,\s+fix it|Never `blocked` alongside/);
  });
}

test("all workflow handoffs carry authority, finding definitions and successful caveats", () => {
  const text = read("contracts/workflows.md.tmpl");
  for (const rule of [/source\/definition/, /global gates/, /review-<round>\.md/, /acceptance conditions/,
    /every successful report/, /Candidate/, /exact.*authority/, /accessible/, /optional.*Investigate/i,
    /same standards/, /Decide.*choice/, /Architect.*structure/]) assert.match(text, rule);
  assert.doesNotMatch(text, /report file only\s+when routing needs more/);
});

test("inline Build report becomes a complete file before cold delegated Review", () => {
  const text = read("contracts/workflows.md.tmpl");
  assert.match(text, /Inline Build.*persist.*complete implementation report/s);
  assert.match(text, /before.*delegated Review/s);
  assert.match(text, /same evidence and caveats as.*agent/s);
  assert.match(text, /persistence fails.*stop/s);
});

test("decisions preserve binding inputs even when delegated or asked to shrink scale", () => {
  for (const name of ["decide", "architect"]) {
    const text = read(`${name}/SKILL.md`);
    for (const rule of [/binding requirements/, /preferences/, /load-bearing/, /HOLD/, /deviation/]) assert.match(text, rule);
    assert.doesNotMatch(text, /always conclude: state the assumption|derive drivers.*mark them `ASSUMED`/);
  }
  assert.doesNotMatch(read("architect/SKILL.md"), /push back: design for ~10×|\| Design for ~10×/);
});

test("routing uses requested output, branch review accepts authority without inventing phases", () => {
  for (const path of ["AGENTS.md", "bootstrap/BOOTSTRAP.md"]) {
    const text = read(path);
    const vendorRow = text.split("\n").find((line) => line.startsWith("|") && line.includes("Postgres or DynamoDB"));
    assert.ok(vendorRow?.includes("`decide`"), path);
    assert.match(text, /structure/);
  }
  const branch = read("prompts/principal-review-branch.md");
  assert.match(branch, /source\/definition/);
  assert.match(branch, /optional plan map/i);
  assert.doesNotMatch(branch, /invoke.*principal-(plan|build)/i);
});

test("existing routing corpus keeps choice, structure, sequence and no-skill boundaries", () => {
  const cases = JSON.parse(read("evals/triggers.json"));
  for (const [id, skill] of [["architect-p03", "decide"], ["architect-p10", "architect"], ["plan-p02", "plan"]]) {
    const entry = cases.find((item) => item.id === id);
    assert.equal(entry?.skill, skill);
    assert.equal(entry?.positive, true);
  }
  const edges = JSON.parse(read("evals/adversarial-triggers.json"));
  assert.equal(edges.find((item) => item.id === "da-01")?.intended, "decide");
  assert.equal(edges.find((item) => item.id === "da-12")?.intended, "architect");
  assert.ok(edges.some((item) => item.intended === "NO_SKILL"));
  assert.match(read("architect/SKILL.md"), /A sound-check gets a verdict, not the artifact/);
  assert.match(read("AGENTS.md"), /Tiny change: build → git-ops/);
});

test("focused behavioral corpus is opt-in and does not claim full qualification", () => {
  const text = read("README.md");
  for (const rule of [/narrow.*opt-in/i, /partially measured, not fully qualified/i, /<skill>\/tests\/specification.yaml/,
    /evals\/requirement-fidelity/, /no model calls in `npm test`/i]) assert.match(text, rule);
  assert.match(read("scripts/check-pack.mjs"), /\^evals/);
});

test("tool and context ceilings remain unchanged in both renderings", () => {
  const tools = {
    plan: "read, grep, find, ls, write", build: "read, grep, find, ls, edit, write, bash",
    review: "read, grep, find, ls, bash", debug: "read, grep, find, ls, bash", investigate: "read, grep, find, ls",
  };
  for (const [name, list] of Object.entries(tools)) {
    for (const mode of ["skill", "agent"]) {
      const text = contract(name, mode);
      assert.equal(text.match(/^allowed-tools: (.*)$/m)[1], `${list}, context:${name === "plan" ? "summary" : "files"}`);
      if (mode === "agent") assert.equal(text.match(/^tools: (.*)$/m)[1], list);
    }
  }
});

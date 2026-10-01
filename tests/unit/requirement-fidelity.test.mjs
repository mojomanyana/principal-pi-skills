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
    assert.match(text, /Before test-first work, classify/);
    assert.match(text, /task approval.*probably.*reasonable default.*urgency.*permission to proceed/s);
    assert.match(text, /complete replacement definition.*explicit authorization to replace.*source meaning/s);
    assert.match(text, /Record.*amendment.*Authority.*then proceed/s);
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
  test(`build ${mode}: persisted reports require private destinations, not inline ceremony`, () => {
    const text = contract("build", mode).replace(/\s+/g, " ");
    assert.match(text, /Before any report write.*create an absent `\.principal\/\.gitignore` containing `\*`/);
    assert.match(text, /never overwrite existing policy/);
    assert.match(text, /Verify the actual repository destination is ignored.*`git check-ignore/);
    assert.match(text, /unsafe.*stop for caller policy repair.*no exposed report.*no invented saved path/);
    assert.match(text, /Inline reports need no file or ignore setup unless persistence is requested/);
    assert.match(text, /exception.*`Next: blocked`.*`Report: not saved`.*`Blocked:`.*final message/);
    if (mode === "agent") {
      assert.match(text, /unused.*never overwrite.*prior artifact.*occupied path/);
      assert.match(text, /report-safety exception below/);
    }
  });
  test(`build ${mode}: dirty proof is a retrievable complete subject artifact, not a pipeline hash`, () => {
    const text = contract("build", mode).replace(/\s+/g, " ");
    assert.match(text, /subject must save.*complete tracked diff.*staged.*unstaged.*binary/);
    assert.match(text, /new collision-safe.*verified-private.*path/);
    assert.match(text, /hash the saved bytes.*actual path.*hash.*base SHA/);
    assert.match(text, /paths\/content hashes of relevant untracked source\/tests/);
    assert.match(text, /Supporting candidate artifacts.*same safety/);
    assert.match(text, /never assume.*shared.*\/tmp.*safe/);
    assert.match(text, /unsafe.*not saved.*Blocked/);
    assert.match(text, /clean committed tree.*full SHA.*environment/);
    assert.match(text, /never stage or commit.*identify a candidate/);
    assert.match(text, /Later relevant changes.*stale.*rerun.*mark it stale/);
  });
  test(`build ${mode}: inherited unresolved caveats cannot disappear behind ownership or none`, () => {
    const text = contract("build", mode).replace(/\s+/g, " ");
    assert.match(text, /Carry forward material inherited assumptions, caveats, follow-ups and gates/);
    assert.match(text, /dispose.*reason.*evidence.*unresolved.*none/);
    assert.match(text, /historical.*unmeasured.*release assumption.*not.*new benchmark.*correctness failure/);
    assert.match(text, /Outside assigned scope.*responsible step, not completion/);
  });
  test(`build ${mode}: evidence references use current per-file line ranges`, () => {
    const text = contract("build", mode).replace(/\s+/g, " ");
    assert.match(text, /Verify.*path:line ranges.*each current file after edits/);
    assert.match(text, /not cumulative multifile numbering/);
  });
  test(`build ${mode}: concise delivery depends on an actual complete safe report`, () => {
    const text = contract("build", mode).replace(/\s+/g, " ");
    assert.match(text, /template governs.*complete artifact.*full-in-chat report.*not.*saved-report summary/);
    assert.match(text, /delegated five-line.*exception/);
    if (mode === "skill") {
      assert.match(text, /No saved report.*full applicable report in chat/);
      assert.match(text, /complete report safely saved.*concise final.*actual.*report.*tested scope\/result.*Next/);
      assert.match(text, /visibly name.*blockers.*unverified gates.*material caveats/);
      assert.match(text, /Detailed mappings\/evidence.*file.*not.*repeat/);
    } else {
      assert.match(text, /Normally return exactly five lines/);
      assert.match(text, /caller reads evidence\/caveats from that file/);
      assert.doesNotMatch(text, /No saved report.*full applicable report in chat/);
      assert.doesNotMatch(text, /name caveats within those lines/);
      assert.doesNotMatch(text, /visibly name.*blockers.*unverified gates.*material caveats/);
      assert.match(text, /Report: not saved.*Blocked:.*retain other status lines/);
    }
  });
  test(`build ${mode}: source, candidate and per-requirement evidence are explicit`, () => {
    const text = contract("build", mode);
    for (const field of ["Authority", "Candidate", "Requirements", "Gates", "Evidence gaps"]) assert.match(text, new RegExp(`^${field}:`, "m"));
    for (const rule of [/global gates/, /completed.*unverified.*unmet/s, /untracked/, /stale/,
      /Bare IDs are insufficient/, /passing suite.*not/i]) assert.match(text, rule);
  });
  test(`build ${mode}: enduring regressions and historical verification remain distinct`, () => {
    const text = contract("build", mode);
    assert.match(text, /regressions by product behavior.*existing suites/s);
    assert.match(text, /PR\/finding IDs.*reports or comments/s);
    assert.match(text, /Historical receipt checks.*one-off replay-tool tests.*separate verification category/s);
    assert.match(text, /counts separately/);
    assert.match(text, /Never pin transient\s+review\/release status/);
  });
  test(`build ${mode}: evidence-only scope does not manufacture durable work`, () => {
    const text = contract("build", mode).replace(/\s+/g, " ");
    assert.match(text, /request for evidence is not.*request to add permanent tests or verification infrastructure/s);
    assert.match(text, /First use existing checks or a disposable probe/);
    assert.match(text, /lasting regression test.*protects enduring behavior.*not merely.*review finding/s);
    assert.match(text, /protected requirement.*useful after the PR is forgotten.*current behavior.*historical receipt/s);
    assert.match(text, /authorized bugfix.*feature.*regressions.*no separate approval/s);
    assert.match(text, /explicit request.*permanent tests.*infrastructure.*useful/s);
    assert.match(text, /Markdown contracts are product.*structural tests/s);
  });
  test(`review ${mode}: evidence scope evaluates enduring usefulness without banning tests`, () => {
    const text = contract("review", mode).replace(/\s+/g, " ");
    assert.match(text, /evidence-only.*existing checks or a disposable probe/s);
    assert.match(text, /protected requirement.*useful after the PR is forgotten.*current behavior.*historical receipt/s);
    assert.match(text, /authorized bugfix.*feature.*regressions.*explicitly requested.*useful/s);
    assert.match(text, /Markdown contracts are product.*structural tests/s);
    assert.match(text, /historical receipt.*captured candidate.*integrity.*current qualification/s);
  });
  test(`review ${mode}: test design distinguishes current coverage from archival integrity`, () => {
    const text = contract("review", mode);
    assert.match(text, /current regression coverage.*archived-receipt integrity.*one-off replay-tool checks/s);
    assert.match(text, /tests organized by PR\/finding IDs/);
    assert.match(text, /transient review\/release status/);
    assert.match(text, /preserve actual behavior guards.*categories separately/s);
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

test("evidence-only admission fixture already satisfies boundary and malformed-input behavior", async () => {
  const { permit } = await import("../../evals/requirement-fidelity/fixtures/correct-admission/limit.mjs");
  for (const value of [0, 1, 3]) assert.equal(permit(value), true);
  for (const value of [-1, 4, "3", null, undefined, NaN, Infinity, 1.5]) assert.equal(permit(value), false);
  assert.equal(JSON.parse(read("evals/requirement-fidelity/fixtures/correct-admission/package.json")).scripts.test, "node --test");
});

test("evidence scope scenarios separate read-only proof from authorized boundary repair", () => {
  const build = JSON.parse(read("build/tests/specification.yaml")).scenarios;
  const review = JSON.parse(read("review/tests/specification.yaml")).scenarios;
  for (const s of [build.find(s => s.id === "F25-build-evidence-only-skill"),
    review.find(s => s.id === "F27-review-historical-audit-skill")]) {
    assert.ok(s, "missing evidence-only scenario");
    assert.ok(!s.system_prompt_file, "full visible skill report, not hidden agent report");
    assert.ok(!s.assert.trace.forbid_calls, "a disposable probe may write outside the caller tree");
    for (const path of ["*", "limit.mjs", "limit.test.mjs", "package.json", "**/*.mjs", ".github/**"]) assert.ok(s.assert.trace.unchanged_paths.includes(path));
  }
  const fix = build.find(s => s.id === "F26-build-boundary-regression-skill");
  assert.ok(fix);
  assert.ok(fix.assert.trace.require_calls.some(c => c.tool === "read" && new RegExp(c.args.path.matches).test("limit.test.mjs")));
  assert.ok(!fix.assert.trace.forbid_calls, "ordinary test mutation is authorized");
});

test("supplied amendment companion provides meaning and preserves source documents", () => {
  const scenarios = JSON.parse(read("build/tests/specification.yaml")).scenarios;
  const original = scenarios.find(s => s.id === "F04-build-missing-agent");
  const positive = scenarios.find(s => s.id === "F04-build-supplied-amendment-agent");
  assert.ok(positive, "missing positive amendment companion");
  assert.equal(positive.env.workspace, original.env.workspace);
  assert.match(positive.turns[0], /replace.*definitions.md#Count/);
  assert.match(positive.turns[0], /Number.isSafeInteger/);
  assert.match(positive.checklist.join(" "), /4.*malformed/);
  assert.deepEqual(positive.assert.trace.unchanged_paths, ["SPEC.md", "definitions.md"]);
});

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

test("behavioral corpus is opt-in and excluded from the package and default model execution", () => {
  const text = read("README.md");
  for (const rule of [/narrow.*opt-in/i, /<skill>\/tests\/specification.yaml/,
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

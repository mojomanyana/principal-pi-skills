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
  test(`build ${mode}: compression preserves evidence fields and the inline exception remains guarded`, () => {
    const text = contract("build", mode);
    const output = text.split("## Output — implementation report")[1];
    assert.match(output, /Even compressed.*Authority, Candidate, Requirements, Gates, Evidence gaps/s);
    assert.match(output, /all applicable report fields/);
    assert.match(output, /Assumptions.*Blocked/s);
    assert.match(output, /none.*N\/A/);
    assert.match(text, /A true nonbehavioral typo\/comment fix/);
    assert.match(text, /unknown impact uses the normal path/);
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

test("connected plan interfaces retain exact contract checks and shared-resource independence", () => {
  for (const mode of ["skill", "agent"]) {
    const text = contract("plan", mode);
    assert.match(text, /Consumes.*Produces.*interfaces.*Verification/s);
    assert.match(text, /names, types, units and error semantics/);
    assert.match(text, /mismatches.*global-constraint conflicts/s);
    assert.match(text, /migrations, lockfiles, databases and ports/);
    assert.match(text, /audience or success only when missing/);
  }
});

test("proportionate decision and neutral architecture contracts preserve material uncertainty", () => {
  const decide = read("decide/SKILL.md"), architect = read("architect/SKILL.md");
  assert.match(decide, /Classification labels are optional/);
  assert.match(decide, /Two meaningful alternatives are enough/);
  assert.match(decide, /material uncertainty/);
  assert.doesNotMatch(decide, /Begin every response with|Three or more|suppressed third/);
  assert.match(architect, /No pattern\s+wins by default/);
  assert.match(architect, /bounded cutover, incremental migration, replacement/);
  assert.match(architect, /ambiguities, contradictions/);
  assert.doesNotMatch(architect, /never big-bang|simpler\s+option wins|wrong regardless/);
});

test("Build preserves meaningful test behavior and narrowly scopes the inline exception", () => {
  for (const mode of ["skill", "agent"]) {
    const text = contract("build", mode);
    assert.match(text, /expected values independently/);
    assert.match(text, /preserve required side effects/);
    assert.match(text, /distinct plausible observable failure/);
    assert.match(text, /update test structure.*without weakening assertions/s);
    assert.match(text, /Honor requested review and existing approval boundaries/);
    assert.match(text, /Authorization, security, schema/);
  }
  assert.match(contract("build", "skill"), /eligible inline fast path.*omit `Next:`/s);
  assert.doesNotMatch(contract("build", "agent"), /return changed scope.*omit `Next:`/s);
});

test("Debug diagnoses before optional trial implementation and protects boundary evidence", () => {
  for (const mode of ["skill", "agent"]) {
    const text = contract("debug", mode);
    assert.match(text, /confirmed cause from a\s+hypothesis/);
    assert.match(text, /complete trial fix and full suite are optional/);
    assert.match(text, /working.*failing/s);
    assert.match(text, /sanitized/);
    assert.match(text, /Build/);
  }
});

test("review scopes preserve whole-change gates and explicit external-posting authority", () => {
  for (const mode of ["skill", "agent"]) {
    const text = contract("review", mode);
    assert.match(text, /Scope: task \| integrated \| scoped-repair/);
    assert.match(text, /cannot erase a missing full-change gate/);
    assert.match(text, /only a final\s+integrated verdict can support finish/);
    assert.match(text, /external posting\s+requires explicit authorization/);
  }
  const workflow = read("contracts/workflows.md.tmpl");
  assert.match(workflow, /task review before another step consumes/);
  assert.match(workflow, /final\s+integrated review/);
  assert.match(workflow, /manual reconciliation, not automatic resume/);
  assert.doesNotMatch(workflow, /a step whose commit exists is\s+done/);
});
for (const mode of ["skill", "agent"]) {
  test(`gate ownership ${mode}: later coordinator work cannot erase current prerequisites`, () => {
    const plan = contract("plan", mode).replace(/\s+/g, " ");
    assert.match(plan, /gate.*owner and due stage/);
    assert.match(plan, /ownership does not postpone a mandatory prerequisite/);
    const build = contract("build", mode).replace(/\s+/g, " ");
    assert.match(build, /Verify all gates due for this build/);
    assert.match(build, /later coordinator-owned gates explicitly pending/);
    assert.match(build, /must not call unavailable coordinator tools or certify those future facts/);
    assert.match(build, /missing current authority, sources or mandatory evidence still blocks before source\/test mutation/);
    const review = contract("review", mode).replace(/\s+/g, " ");
    assert.match(review, /Missing evidence already due.*UNVERIFIED.*known violations.*CHANGES-REQUESTED/);
    assert.match(review, /Integrated review retains every global gate/);
    assert.match(review, /own terminal\/cleanup verification.*coordinator-owned after return/);
    assert.match(review, /coordinator must check it before consuming your verdict/);
  });
}

test("optional progress is helper-written and checked without manufacturing completion", () => {
  for (const kind of ["feature", "bugfix", "refactor"]) {
    const text = read(`prompts/principal-${kind}.md`).replace(/\s+/g, " ");
    assert.match(text, /Progress indexes are optional, but every index write must use this helper/);
    assert.match(text, /never hand-write `run.json` or JSONL/);
    assert.match(text, /each an object `\{state,evidence,note\}`/);
    assert.match(text, /After every append.*check <run> <actual-current-candidate>/);
    assert.match(text, /both top-level and per-record issues/);
    assert.match(text, /integrity-valid index may contain incomplete facts/);
    assert.match(text, /reconcile required phases by step/);
    assert.match(text, /preserve those bytes and use a new run rather than truncating history/);
    assert.match(text, /No automatic execution/);
  }
});


test("full-workflow completion and native public evidence remain mechanical coordinator checks", () => {
  for (const kind of ["feature", "bugfix", "refactor"]) {
    const text = read(`prompts/principal-${kind}.md`).replace(/\s+/g, " ");
    assert.match(text, /PI_DADDY_PUBLIC_EVIDENCE_DIR/);
    assert.match(text, /exact public response\/source artifact references directly/);
    assert.match(text, /excludes raw details\/private sessions and later Pi hook formatting/);
    assert.match(text, /Do not enable collection implicitly/);
    assert.match(text, /check-completion <run> <full-final-commit> <required-step>/);
    assert.match(text, /complete explicit step set/);
    assert.match(text, /omitted findings and accepted\/duplicate labels do not close gates/);
    assert.match(text, /never approval or task acceptance/);
    assert.match(text, /never invent completed phases to pass/);
  }
});


test("workflow report destinations are verified in the child workspace before dispatch", () => {
  for (const kind of ["feature", "bugfix", "refactor", "review-branch"]) {
    const text = read(`prompts/principal-${kind}.md`).replace(/\s+/g, " ");
    assert.match(text, /Before dispatch.*actual child workspace.*primary report.*`\.principal\/reports\//);
    assert.match(text, /absolute.*report path.*report-write scope/);
    assert.match(text, /routine.*allocation.*needs no separate.*approval/i);
    assert.match(text, /existing.*ignore.*exposes.*stop/s);
    assert.match(text, /permission.*failure.*stop|stop.*permission.*failure/s);
    assert.match(text, /explicit.*prohibition.*stop|stop.*explicit.*prohibition/s);
  }
});

test("external report archives preserve complete primary evidence without expanding child writes", () => {
  for (const kind of ["feature", "bugfix", "refactor", "review-branch"]) {
    const text = read(`prompts/principal-${kind}.md`).replace(/\s+/g, " ");
    assert.match(text, /external.*evidence.*coordinator.*archive/i);
    assert.match(text, /after.*settlement.*copy.*complete.*bytes/i);
    assert.match(text, /never overwrite.*archive|archive.*never overwrite/i);
    assert.match(text, /original path.*SHA-256.*copy path/);
    assert.match(text, /verify.*matching.*hash/i);
    assert.match(text, /retain.*original.*review.*repair.*resume/i);
    assert.match(text, /archive.*failure.*report.*gap/i);
    assert.match(text, /not.*native.*capture.*manifest/i);
  }
});


test("optional JEV uses current session permission and cannot anchor independent review", () => {
  for (const kind of ["feature", "bugfix", "refactor", "review-branch"]) {
    const text = read(`prompts/principal-${kind}.md`).replace(/\s+/g, " ");
    assert.match(text, /jev_advice.*action:\s*"status"/);
    assert.match(text, /enabled.*workflow.*mode/);
    assert.match(text, /deterministic.*checks.*uncertain.*handoff/);
    assert.match(text, /jev_advice.*action:\s*"evaluate".*candidate.*requirements.*evidence/);
    assert.match(text, /bounded.*selected.*packet/);
    assert.match(text, /Exclude reviewer verdicts and prior JEV outcomes/);
    assert.match(text, /prediction.*out of every independent review.*until its own verdict/);
    assert.match(text, /task, integrated or scoped repair.*preserve the full underlying authority and evidence/);
    assert.match(text, /no.*review quota/);
    assert.match(text, /unavailable.*error.*ordinary workflow.*required gates/s);
    assert.match(text, /no.*CLI.*bypass/i);
    assert.match(text, /never.*approval.*waive.*gate/i);
    assert.match(text, /unlabeled.*storage.*consent.*training.*separate/i);
    assert.match(text, /no.*private transcripts.*credentials.*full file scans/i);
  }
});


test("disposable workflows use the selected installed helper without npm resolution", () => {
  for (const name of ["debug", "review"]) for (const mode of ["skill", "agent"]) {
    const text = contract(name, mode).replace(/\s+/g, " ");
    assert.match(text, /snapshot-workspace\.mjs.*actual selected Principal package.*selected source metadata/);
    assert.match(text, /never a guessed path or download/);
    assert.match(text, /node <resolved-helper> create --repo <caller-repo>/);
    assert.match(text, /node <resolved-helper> remove <path> --repo <caller-repo>/);
    assert.match(text, /ignored files.*excluded|except ignored files/);
    assert.match(text, /Missing helper or creation failure.*read-only/);
    assert.match(text, /never.*caller.*checkout/);
    assert.doesNotMatch(text, /npx[^`\n]*principal-pi-workspace/);
  }
});

test("coherent features keep implementation, acceptance tests and documentation in one build unit", () => {
  for (const mode of ["skill", "agent"]) {
    const plan = contract("plan", mode).replace(/\s+/g, " ");
    assert.match(plan, /one complete Build unit.*implementation, tests and documentation/);
    assert.doesNotMatch(plan, /Step 1 is the walking skeleton|Small clear work gets two or three|Decompose anyway/);
    assert.match(plan, /real dependency.*risk boundary|risk boundary.*real dependency/);
  }
  const workflow = read("contracts/workflows.md.tmpl").replace(/\s+/g, " ");
  assert.match(workflow, /More tests or documentation.*do not.*intermediate review/);
  assert.match(workflow, /final integrated review/);
});
test("source fidelity does not recursively turn reference history into current authority", () => {
  for (const name of ["plan", "build", "review"]) for (const mode of ["skill", "agent"]) {
    const text = contract(name, mode).replace(/\s+/g, " ");
    assert.match(text, /needed definitions/);
    assert.match(text, /Do not recursively read.*historical|Do not recursively.*history/);
  }
  const plan = contract("plan", "agent").replace(/\s+/g, " ");
  assert.match(plan, /exact clause.*location/);
  assert.match(plan, /generic coordinator.*not.*product requirements/);
});
test("Build can reuse verified unchanged evidence without manufacturing failed behavior", () => {
  for (const mode of ["skill", "agent"]) {
    const text = contract("build", mode).replace(/\s+/g, " ");
    assert.match(text, /baseline.*examples?.*matching|matching.*baseline.*examples?/);
    assert.match(text, /one run.*green.*full|green.*full.*one run/);
    assert.match(text, /already-correct behavior.*do not.*fabricate.*red/i);
    assert.match(text, /mutation.*optional.*risk|optional.*risk.*mutation/i);
    assert.match(text, /Bugfix regressions must reproduce the bug/);
  }
});
test("finish honors an explicit preference and labels uncommitted work honestly", () => {
  for (const path of ["contracts/workflows.md.tmpl", "git-ops/SKILL.md"]) {
    const text = read(path).replace(/\s+/g, " ");
    assert.match(text, /explicit.*finish preference.*without asking again/);
    assert.match(text, /uncommitted.*actual branch|actual branch.*uncommitted/);
    assert.match(text, /fresh full suite|rerun the full suite/);
  }
});

test("test quality protects observable flows without quotas or another review stage", () => {
  for (const mode of ["skill", "agent"]) {
    const build = contract("build", mode).replace(/\s+/g, " ");
    const review = contract("review", mode).replace(/\s+/g, " ");
    assert.match(build, /Parameterize useful cases.*remove redundant or implementation-mirroring tests/);
    assert.match(review, /Test quality.*happy\/error\/boundary flows.*justified expected results.*deterministic timing/);
    for (const text of [build, review]) assert.match(text, /No coverage or test-count quota/);
    assert.match(review, /test findings in this verdict, not another stage/);
  }
});

test("design ownership preserves authority without micromanaging routine implementation", () => {
  for (const mode of ["skill", "agent"]) {
    const plan = contract("plan", mode).replace(/\s+/g, " ");
    const build = contract("build", mode).replace(/\s+/g, " ");
    const review = contract("review", mode).replace(/\s+/g, " ");
    assert.match(plan, /implementation detail only when authority or a real dependency needs it/);
    assert.match(build, /routine choices within approved scope without asking again.*Escalate material scope\/API tradeoffs/);
    assert.match(build, /Passing tests alone does not establish a maintainable solution/);
    assert.match(review, /Design and maintainability hunt.*concrete simpler alternative/);
  }
});

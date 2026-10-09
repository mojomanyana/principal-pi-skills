// Static delivery/authority regressions. These do not measure model compliance.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { render } from "../../scripts/generate-contracts.mjs";
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const normalized = text => text.replace(/\s+/g, " ");
const contract = (name, mode) => normalized(render(read(`contracts/${name}.md.tmpl`), mode, name, { name }));
function clauses(text, rules) {
  for (const rule of rules) assert.ok(rule.test(text), `Missing contract protection: ${rule}`);
}

for (const mode of ["skill", "agent"]) {
  test(`plan ${mode}: source authority survives compact task-scoped plans`, () => {
    clauses(contract("plan", mode), [/read authority completely/, /continue truncated reads/,
      /Missing normative source.*load-bearing/, /conflicting binding sources/,
      /inaccessible path/, /undefined in the source/, /BLOCKED:.*ONE question/,
      /impl:S1/, /disjoint prefix/, /source alias/, /local locator/, /exact clause and location/,
      /one map row per stable source ID/, /planned, not executed/, /owner and due stage/,
      /ownership does not postpone a mandatory prerequisite/, /generic coordinator gates.*not new product requirements/]);
  });
  test(`plan ${mode}: complete persistence does not expand the write ceiling or force rereads`, () => {
    clauses(contract("plan", mode), [/complete executable plan/, /short chat summary/,
      /never overwrite an existing ignore file/, /No shell, implementation, reports, or other writes/,
      /persistence fails/, /Tiny.*typo plans still read the named existing file/,
      /expected outcomes.*accept.*reject/, /not a mandatory full-plan reread/]);
  });
  test(`plan ${mode}: real dependencies determine units and contracts`, () => {
    const text=contract("plan", mode);
    clauses(text,[/one complete Build unit.*implementation, tests and documentation/,
      /Split only for a real dependency/, /Consumes.*Produces.*Verification/,
      /names, types, units and error semantics/, /mismatches.*global-constraint conflicts/,
      /migrations, lockfiles, databases and ports/, /routine implementation choices/]);
    assert.doesNotMatch(text,/Step 1 is the walking skeleton|Small clear work gets two or three/);
  });
  test(`build ${mode}: missing normative meaning blocks mutations, not ordinary judgment`, () => {
    clauses(contract("build",mode),[/hard stop before any source or test mutation, including newly authored tests/,
      /report writes are allowed/, /paths must be read before declaring.*missing/,
      /Task approval.*does not supply a missing definition/,
      /complete replacement definition plus explicit authorization to replace the source meaning/,
      /record that amendment and provenance under Authority/,
      /Routine implementation choices within complete authority remain yours/]);
  });
  test(`build ${mode}: metadata failure cannot become implementation or an invented permission refusal`, () => {
    clauses(contract("build",mode),[/known product or lasting test defect/, /unknown behavioral failure/,
      /report path, hash, stale receipt or manifest mismatch.*coordinator evidence reconciliation/,
      /do not edit source\/tests to make metadata pass/, /wrong checkout is not a permission refusal/,
      /One writer per working tree/, /Debug patches once/, /experiments are not applied work/]);
  });
  test(`build ${mode}: source-bound evidence and private complete reports remain retrievable`, () => {
    const text=contract("build",mode);
    clauses(text,[/canonical candidate observation/, /never recreate its hash formula/,
      /clean committed tree.*full SHA.*environment/, /dirty candidate.*retrievable complete staged\/unstaged tracked diff.*binary/,
      /base SHA.*untracked paths\/content hashes/, /never stage or commit just to identify/,
      /Later relevant changes.*stale/, /Before any report write.*absent.*\.principal\/\.gitignore/,
      /never overwrite existing policy/, /git check-ignore/, /collision-safe, verified-private/,
      /If unsafe.*stop for caller policy repair/, /no exposed report or invented saved path/,
      /exception.*Next: blocked.*Report: not saved.*Blocked:.*final message/,
      /Inline reports need no file or ignore setup unless persistence is requested/]);
    if(mode==='agent') clauses(text,[/ONLY your final message/, /exactly five lines/,
      /never overwrite a referenced prior artifact or occupied path/]);
  });
  test(`build ${mode}: obligations, caveats and future gates cannot disappear`, () => {
    const text=contract("build",mode);
    clauses(text,[/completed, unverified or unmet/, /Outside assigned scope.*responsible step, not completion/,
      /passing suite is not full requirement coverage/, /inherited assumptions, caveats, follow-ups and gates/,
      /unresolved never becomes none/, /historical unmeasured release assumption is not a new benchmark/,
      /Verify gates due for this Build/, /Later coordinator.*gates stay pending.*owner and due stage/,
      /cannot obtain its future receipt or waive a source-required prerequisite/,
      /path:line ranges.*each current file.*not cumulative multifile numbering/,
      /Bare IDs are insufficient/, /whole-change baseline/]);
    for(const field of ['Authority','Candidate','Requirements','Gates','Evidence gaps','Tests','Verified','Assumptions','Follow-ups','Blocked'])
      assert.ok(read('contracts/build.md.tmpl').includes(`\n${field}:`),`missing ${field}`);
  });
  test(`build ${mode}: tests protect behavior and reuse proof without inventing red`, () => {
    clauses(contract("build",mode),[/observe the regression before the fix/,
      /already-correct behavior.*without manufacturing red/, /expected values independently/,
      /preserve required side effects in mocks/, /distinct plausible observable failure/,
      /boundaries and failure flows/, /parameterize related cases/i, /duplicate or implementation-mirroring tests/,
      /No coverage or test-count quota/, /without weakening assertions/,
      /Reuse exact command\/results.*candidate.*configuration\/environment match/,
      /metadata corrections alone do not/, /source-required final gate/]);
  });
  test(`build ${mode}: evidence-only requests do not manufacture permanent product work`, () => {
    clauses(contract("build",mode),[/request for evidence is not a request to add permanent tests/,
      /First use existing checks or a disposable probe/, /protect enduring behavior/,
      /useful after the PR is forgotten/, /bugfix and feature regressions need no separate approval/,
      /product behavior in existing suites/, /PR\/finding IDs in reports or comments/,
      /separate verification category.*counts separately/, /Never pin transient review\/release status/,
      /Markdown contracts are product/]);
  });
  test(`build ${mode}: design ownership and inline exceptions preserve consequential boundaries`, () => {
    const text=contract("build",mode);
    clauses(text,[/Prefer existing code and the standard library/, /fewer concepts/,
      /escalate a material scope\/API tradeoff/, /Passing tests does not establish a good design/,
      /state consistency, cancellation, shutdown, retries and ownership/,
      /Honor requested review and existing approval boundaries/,
      /Authorization, security, schema, public API/, /unknown impact uses the normal path/]);
    if(mode==='skill') clauses(text,[/eligible inline fast path.*omit `Next:`/, /no commit, push or installation/]);
    else assert.doesNotMatch(text,/return changed scope.*omit `Next:`/);
  });
  test(`review ${mode}: independent judgment can reuse matching evidence`, () => {
    clauses(contract("review",mode),[/obligations the map omitted/, /plan is not required/,
      /canonical candidate observation/, /do not recreate identity formulas/,
      /exact command\/result.*candidate, scope, configuration and environment match/,
      /Fresh reviewer judgment does not require fresh suite execution/,
      /Do not reject matching evidence merely because you did not run it/,
      /specific unresolved doubt before replaying/, /Missing or stale evidence already due.*UNVERIFIED/,
      /Known violated behavior.*CHANGES-REQUESTED/, /retain both findings and Evidence gaps/]);
  });
  test(`review ${mode}: scope and settlement constrain approval and repairs`, () => {
    clauses(contract("review",mode),[/task.*,.*integrated.*,.*scoped-repair/,
      /original whole-change baseline and unresolved gates/, /Only final integrated approval/,
      /coordinator checks your own settlement after return before consuming the verdict/,
      /Addressed IDs do not erase original evidence gaps/, /broader review rather than silently expanding/,
      /external posting authorized separately through Git-Ops/, /acceptance condition/]);
  });
  test(`review ${mode}: evidence route and optional test focus do not add Build or another stage`, () => {
    clauses(contract("review",mode),[/`evidence` for UNVERIFIED/, /does not authorize code changes or automatic re-delegation/,
      /focused rubric in `review\/references\/test-quality.md`/, /mode within this review/,
      /not a mandatory extra delegation/, /Keep its findings in this verdict/,
      /error and boundary flows/, /duplicate tests.*mirror implementation/,
      /Preserve validation, error visibility, security controls, accessibility and meaningful tests/]);
  });
  test(`debug ${mode}: disposable evidence remains distinct from an applied fix`, () => {
    const text=contract('debug',mode);
    clauses(text,[/proposed\/unproven/, /proved in disposable workspace only/, /hypothesis \(unconfirmed\)/,
      /complete trial fix and full suite are optional/, /sanitized/, /switch to Build/,
      /applied by Build/, /missing definition/]);
    assert.doesNotMatch(text,/write 2–3 hypotheses|When stuck \(~1 hour|after two speculative edits/);
  });
  test(`discovery ${mode}: tools and facts do not become authority or shell permissions`, () => {
    for(const name of ['plan','investigate']) clauses(contract(name,mode),[/Do not substitute shell/, /named file reads/, /missing capability/]);
    clauses(contract('investigate',mode),[/candidate authoritative/, /source says required/,
      /measurement observed/, /without choosing precedence/, /compliance verdict/, /caller may persist/]);
  });
}

test('tool and context ceilings remain unchanged',()=>{
  const tools={plan:'read, grep, find, ls, write',build:'read, grep, find, ls, edit, write, bash',
    review:'read, grep, find, ls, bash',debug:'read, grep, find, ls, bash',investigate:'read, grep, find, ls'};
  for(const [name,list] of Object.entries(tools))for(const mode of ['skill','agent']){
    const text=render(read(`contracts/${name}.md.tmpl`),mode,name,{name});
    assert.equal(text.match(/^allowed-tools: (.*)$/m)[1],`${list}, context:${name==='plan'?'summary':'files'}`);
    if(mode==='agent')assert.equal(text.match(/^tools: (.*)$/m)[1],list);
  }
});

test('conditional references are discoverable without making every mode mandatory',()=>{
  for(const path of ['references/workflow-mechanics.md','review/references/test-quality.md'])
    assert.ok(existsSync(new URL(`../../${path}`,import.meta.url)),path);
  clauses(normalized(read('contracts/workflows.md.tmpl')),[/read only the section for a feature actually used/]);
  clauses(normalized(read('review/references/test-quality.md')),[/not add a separate agent/,
    /Mock.*side effects|Mocks.*side effects/, /Determinism.*observable conditions/,
    /independently.*correct|expected result is correct/, /not PR\/finding IDs/,
    /regex presence alone does not demonstrate model compliance/, /No test-count.*quota/]);
});

test('optional archival, progress and resume remain mechanical and consent bound',()=>{
  const text=normalized(read('references/workflow-mechanics.md'));
  clauses(text,[/not a child's primary write target/, /After native settlement.*original.*copy complete bytes/,
    /Refuse overwrites and symlink redirects/, /original path, SHA-256 and copy path/,
    /archive failure.*blocks only work that requires the copy/,
    /all writes.*Never hand-write run.json or JSONL/, /After append.*check <run> <actual-current-candidate>/,
    /integrity, not completion/, /do not truncate/, /check-completion.*full-commit.*required-step/,
    /explicit step set/, /Masked index entries and indexed submodules refuse/,
    /Accepted or duplicate labels alone do not verify/, /never invents phases/,
    /explicit operator confirmation/, /consumes durably before queuing/,
    /No arbitrary nextAction execution.*silent re-arm/, /readiness, not permission/]);
});

test('coordinator routes converging work without arbitrary rounds or mandatory replays',()=>{
  const text=normalized(read('contracts/workflows.md.tmpl'));
  clauses(text,[/principal_workflow/, /snapshot/, /prepare/, /status/,
    /does not execute phases, grant permission, infer approval/,
    /Do not invent a fingerprint formula/, /never bypass a real authority or settlement gate/,
    /Read every successful report/, /Inline Build persists its complete implementation report before delegated Review/,
    /UNVERIFIED.*evidence.*no automatic implementation/, /same failure repeats without new evidence/,
    /No arbitrary round quota/, /Existing explicit user authorization.*do not ask again/,
    /Honor the known finish preference/, /keep uncommitted work/, /source-required fresh final suite/]);
  assert.doesNotMatch(text,/At most two repair rounds|it counts as a repair round/);
});

test('disposable checks use the selected helper and do not mutate the caller',()=>{
  for(const name of ['debug','review'])for(const mode of ['skill','agent']){
    const text=contract(name,mode);
    clauses(text,[/selected.*snapshot-workspace.mjs|snapshot-workspace.mjs.*selected/,
      /node <resolved-helper> create --repo <caller-repo>/, /node <resolved-helper> remove <path> --repo <caller-repo>/,
      /ignored files.*excluded/i, /Missing helper.*read-only/, /never.*caller.*checkout/i]);
    assert.doesNotMatch(text,/npx[^`]*principal-pi-workspace/);
  }
});

test('optional advice retains current consent and independent review boundaries',()=>{
  for(const kind of ['feature','bugfix','refactor','review-branch']){
    const text=normalized(read(`prompts/principal-${kind}.md`));
    clauses(text,[/jev_advice.*action:"status"/, /enabled workflow mode/,
      /bounded/, /reviewer verdicts/, /independent review until its verdict|cold review until its own verdict/,
      /No quota|no quota/, /CLI bypass/, /Storage.*training permission.*separate|storage consent.*training permission.*distinct/i,
      /predictions are not labels/, /OpenAI Decisions/, /private transcripts/]);
  }
});

test('choice/structure and discovery retain their routing boundaries',()=>{
  for(const name of ['decide','architect'])clauses(read(`${name}/SKILL.md`),[/binding requirements/, /preferences/, /load-bearing/, /HOLD/, /deviation/]);
  const cases=JSON.parse(read('evals/triggers.json'));
  for(const [id,skill] of [['architect-p03','decide'],['architect-p10','architect'],['plan-p02','plan']]){
    assert.equal(cases.find(item=>item.id===id)?.skill,skill);
    assert.equal(cases.find(item=>item.id===id)?.positive,true);
  }
  assert.ok(JSON.parse(read('evals/adversarial-triggers.json')).some(item=>item.intended==='NO_SKILL'));
  clauses(read('architect/SKILL.md'),[/No pattern\s+wins by default/, /A sound-check gets a verdict, not the artifact/]);
});


test('native bookkeeping does not force inline evidence work into delegation',()=>{
  const text=normalized(read('contracts/workflows.md.tmpl'));
  clauses(text,[/snapshot.*reference.*inline\/evidence work/,
    /prepare.*complete.*retry.*native-delegation bookkeeping/,
    /operation_id.*unchanged to `delegate`.*definitionId/,
    /actual native settlement.*report retention.*complete.*actual disposition/,
    /Inline work keeps the existing private report mechanism/,
    /never dispatch an agent merely to close bookkeeping/]);
});

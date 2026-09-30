# Requirement-fidelity evidence index

## Baseline evidence-channel alignment — current bounded observations

[New raw runs and complete direct evidence](evidence/regression-evidence-alignment/README.md)
record the correction of F26's extra final-report baseline expectation. Baseline execution,
red-before-fix, retained useful tests and source preservation remain required; Build/Review
contracts and the user stimulus are unchanged. No old FAIL is rejudged.

- Fresh F26 raw PASS; full Build force suite **4/9, NOT READY**. Review not rerun.
- Separate direct execution manually confirms baseline → assertion red → fix → green,
  then additional malformed-input coverage. Only the implementation/domain test change.
- Independent fixed suite passes 2/2; restoring only the original bug gives 1 pass/1 fail;
  20 counted boundary/malformed probes pass. Same retained test bytes bind both candidates.
- Narrow automated direct audit: **UNVERIFIED**, not silently promoted. Unsupported
  metadata commands/additional test edits receive documented manual verification.
- Existing opt-in offline evidence tests exercise missing/incorrect execution and ineffective
  regression controls. They are tool checks, not additional model passes or product units.

Other raw failures include genuine report/handoff deficiencies as well as final-only
visibility/evaluator limitations. No full skill, workflow, normal-loading or release
qualification is claimed; the existing tag still excludes the repairs.

## Evidence-scope candidate — bounded observations

The option-2 change based on `746d7826aca892cc97cb83b5b9c7c171e81f9c17` adds a
small Build/Review evidence-scope safeguard, workflow entry guard, and exactly three
opt-in skill cases (F25–F27). Current inventory: **46 cases**, Build 9 and Review 7.
[Full observations and reproduction details](evidence/evidence-scope/README.md) retain
raw harness results plus separate direct sessions and actual workspaces.

- Raw force suite: Build **5/9**, Review **6/7**, both **NOT READY**.
- F25 evidence-only and F27 historical audit: raw PASS plus direct observations with
  originals unchanged and no new durable product/tests/tooling.
- F26 authorized bugfix: raw FAIL because the final report omits the passing baseline.
  Trace ordering records baseline → failing regression → implementation → green. A separate
  direct run retains the meaningful test; independent suite/boundary checks pass and restoring
  only the original bug makes that test fail. The report failure remains, not rejudged away.

These are single-configuration observations, not normal-loading proof, comparative lift or
broad qualification. Prompts describe the task rather than repeat the rule under test.
Earlier 43-case results, raw reports and hash manifests below remain historical and unchanged.
Static contract tests and corpus lint cannot qualify the new behavior.

## Earlier test organization and instruction-level prevention

The cleanup on top of `6a03a35719b6334e5f7cb03670512cf53b04c934` separates current
contract/product checks from archived observations. `npm test` passes **136 unit + 24
install tests**; the explicit offline `npm run verify:evidence` passes **9 checks**.
These categories are reported separately; neither is a new model-behavior qualification.
Historical inputs/manifests and the earlier 141-test receipt remain bound to their captured
candidate, not this reorganized tree. They were not restamped.

Build/Review now instruct behavior-named regressions and separate historical verification,
without pinning temporary review/release status. These are model instructions, not a new
pi-daddy filesystem rule. Native command-boundary checks verify suite selection; semantic
test quality still requires review. Installed resources must be refreshed to adopt changes.

After those skill edits, one-repetition force checks retained these raw results:
- Build: **2/7**, `build/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T14-13-37-816Z/`.
- Review: **5/6**, `review/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T14-13-37-826Z/`.

**Behavioral qualification remains NOT READY.** Read the saved judgments/traces, not just
scores: missing-definition Build blocks, but final-only judging does not receive its full
saved report. Other failures concern qualification/report detail. No rejudging or weakened
criteria, and no claim that this smoke run proves naming-policy compliance or attributes a
score change to the new wording. Earlier direct observations below describe their original
resource hashes; they are not fresh measurements of the edited contracts.

## PR #58 repair-candidate evidence

This section records the earlier repairs captured before the test-organization cleanup.

REV-001–006 repairs are on top of release HEAD
`448ac7628980c7a69bb3ff27e3bfa882bf64c4f3`, not on the existing v4.7.0 tag.
Detailed commands, raw sessions, full saved reports and limitations:
[repair observations](evidence/pr58-repairs/README.md). All prior failures/hashes remain intact.
Overall behavioral qualification remains **NOT READY**; bounded observations are not a
harness pass or proof for every workflow/model.

- Unchanged critical F04 task: three direct repaired-contract runs block before source/test
  mutation and request definition repair in saved reports. Three supplied-definition
  companions implement correctly; independent, counted 20-case boundary probes pass each.
- Actual registered branch-review template runs twice: distinct reports, prior bytes
  preserved, absent ignore initialized, clean status both times.
- Actual registered bugfix template stops for approval; after the separate approval turn,
  inline Build/Review preserve diagnosis reports and dirty only intended source/tests.
  Sessions retain actual template expansion and skill reads, not manual phase replacements.
- These workflow observations exercise the documented inline fallback. Fresh-session repair
  from original findings after a changed candidate, delegation, existing-ignore conflict,
  optional Investigate and standalone UNVERIFIED routing remain unmeasured variants.
- Raw force results remain Build **4/7**, Review **5/6**; targeted three-repetition F04 pair
  **0/6**, ungraded partial run. The negative objective no-edit/source-read gates all pass;
  final-only semantic judges cannot see the saved reports. See retained judgments and
  independent direct artifacts separately; scores were not changed or standards weakened.

Fresh offline repair-candidate receipts and manifest are retained in
`evidence/pr58-repairs/npm-test.txt` and `inputs.sha256`; they must be read with their actual
candidate binding, not substituted for historical `final-*` files. Current CI is not claimed.
The existing v4.7.0 tag at 448ac76 excludes the repairs and must not be moved silently.

## Historical status after pre-release live execution

**Pre-release implementation reviewed; behavioral qualification NOT READY.** Production review approved
the contracts after REV-001 (inline report persistence) and REV-002 (compressed evidence
fields) were repaired. That code verdict does not waive the failures below. All raw runs,
including superseded FAIL/ERROR results, remain intact. Historical sections below describe
their own candidate/time, not the latest status.

Environment: Pi 0.87.1, installed/latest npm skill-harness 0.21.0, Node 26.7.0. No runner
upgrade or external checkout change was made. Subject `openai-codex:gpt-5.5`, harness judge
`openai-codex:gpt-5.6-sol`; direct runs used explicit CLI tool allowlists and no LLM judge.
A separate cold Review agent inspected their actual events and captured artifacts. The
following assessments summarize that audit, not overwritten harness grades.

### Historical pre-release harness runs (one repetition each, force mode)

Paths are `<skill>/tests/results/pi-openai-codex-gpt-5.5/<run>/results.yaml`, relative to
the repository root. Receipts include spec/contract hashes and judgments.

| Skill | Run | Raw pass / cases |
|---|---|---|
| Plan | 2026-09-30T11-31-36-632Z | 4 / 14 |
| Build | 2026-09-30T11-31-36-645Z | 2 / 6 |
| Investigate | 2026-09-30T11-31-36-654Z | 3 / 4 |
| Review | 2026-09-30T11-41-30-738Z | 5 / 6 |
| Debug | 2026-09-30T11-41-30-746Z | 6 / 6 |
| Decide | 2026-09-30T11-41-30-755Z | 3 / 3 |
| Architect | 2026-09-30T11-41-30-762Z | 0 / 3 |

Do not sum these as verified coverage. Final-only judging lacks saved report bytes; tool
availability differs from declared agent tools; some judgments have criterion ERRORs.
Historical runs may fail harness lint's freshness checks after a contract/rubric edit;
retain those runs rather than restamp incompatible evidence or delete failures.

**Actual remaining failures:** Build F04 still mutated source/tests under a guessed Count
definition in its postrepair force run. Plan/Investigate called forbidden bash discovery
under the harness's mismatched tool surface; mismatch explains pressure, not permission.
Architect's missing-data case said an option “Meets” unmeasured throughput/availability.
Later direct successes do not erase these failures or prove robustness. No further prompt
repair loop was used to manufacture green results.

**Audit cautions:** “Please supply” is a repair request without a question mark; Plan's
prescribed “Done” line did not mutate the typo fixture. Build F11 actually added boundary
and malformed tests (trace calls 13–16), so three Node test blocks do not imply incomplete
input coverage. Build F14 recorded missing acceptance definitions in its report write;
F21's parser semantics appear in actual calls. Review F17 rejected source violations rather
than echoing an optimistic summary. Architect's “proceed with the CLI design” is a verdict,
not a phase dispatch. Those are documented rubric/visibility limitations, not revised scores.

### Direct Pi evidence with actual artifact capture

Every run directory contains `invocation.json` (exact command, contract SHA-256, before/after
hashes, working directory), `events.jsonl` (including original tool results), `session.jsonl`,
`final.txt`, stderr, and actual post-run workspace files. Independent audit used those files,
not reconstructed write arguments. These are ordinary CLI runs, not a new runner/framework.

| Evidence directory under `evidence/` | Independently observed scope |
|---|---|
| `direct-pi-primary/F02-plan-agent/` | PASS for this one long-agent run: full paginated source/definition/annex reads; saved plan retains 40 numbered obligations (including S1 and impl:S1), eight unnumbered clauses, three gates, disjoint step IDs, test mappings, and proposed/not-executed status. Semantic mapping reviewed against the 51-row oracle, not just counted IDs. |
| `direct-pi-primary/F04-build-missing-agent/` | PASS for this run: source and tests unchanged; only blocked report written; no invented Count definition. |
| `direct-pi-primary/F16-investigate-missing-agent/` | PASS for this run: cited inspected sources, missing definition remains unknown; no writes or shell. |
| `direct-pi-primary/F19-architect-missing-skill/` | Conditional HOLD retains binding scale/availability and identifies missing payload/retention; no qualification measurement. |
| `direct-pi-chain/` | PASS for this manually orchestrated source→Investigate→Plan→caller approval→Build→cold Review trajectory. Sources and exact upstream outputs persisted; Build re-read original authority, observed real red then green; Review validated candidate evidence and reran suite in a disposable workspace. Final fixture suite: two Node test blocks pass. This is not automatic workflow/delegation enforcement. |
| `direct-pi-loading/` | PASS for two normal progressive-loading observations: explicitly registered Plan and Investigate SKILL.md bodies were actually read via tools before responding. No appended contract in these commands; not general routing or all-skill loading proof. |
| `direct-pi-spark/` | ERROR, all 18 attempted requests: provider says gpt-5.3-codex-spark is unsupported for this ChatGPT account. CLI exit zero did not mean a model response. No tools executed; lower-cost robustness UNVERIFIED. Repetitions were attempted before the exit-zero error was identified; no behavior pass is inferred. |

Normal loading was observed only in the two explicit-registration runs. Other direct runs
append contracts; none supplies schema-3 provider-delivery attestation. The manual approval
record proves ordering in that synthetic run, not autonomous gate enforcement. Critical
three-repetition primary robustness, all F01–F24 combinations/mirrors, resumed repair,
receipt-only reuse, and lower-cost execution remain unverified. Raw direct sessions are
single-candidate examples, not a reliability rate or universal model guarantee.

### Captured artifacts and REV-003

Snapshot `.principal/.gitignore` files correctly hide runtime artifacts, but also hide
those copied files from Git. REV-003 was repaired by making byte-identical **nonignored
aliases**, without changing original snapshots. [captured-artifacts.json](evidence/captured-artifacts.json)
maps original locations to `evidence/captured/` paths and SHA-256 values. Use these portable
aliases when inspecting plans/reports after checkout; original ignored paths may not exist.
The manifest includes all 14 captured plan/report/diff artifacts, including the long plan
and every chain report snapshot. `tests/unit/fidelity-evidence.test.mjs` checks bytes,
provider-error classification, and successful normal-loading body reads. Red/green receipts
are `evidence/capture-regression-{red,green}.txt`. These checks validate retained evidence
integrity, not semantics or current-candidate coverage by themselves.

To replay a direct run, copy its original fixture into a fresh temporary directory, select
its recorded model/tools/contract (substitute local paths), and execute the recorded Pi
command with fresh session/event destinations. Copy the real workspace, including ignored
artifacts, before cleanup. Chain receipts are sequential; use the original basic fixture
and preserve each actual predecessor output, recording approval before Build. Never start
from the saved final workspace and call that a regression run. Inspect assistant stopReason
and errorMessage even when process exit is zero. Capture the new candidate hashes; never
reuse old results as current proof.


### Historical pre-release repository checks

The preserved `final-*` filenames are historical, not release-head receipts. They ran
package **4.6.0**: **128/128 unit tests and 23/23 install tests**, plus generation, word
budgets, packaging and skill lint. Receipts: [historical checkout suite](evidence/final-npm-test.txt)
and [historical disposable snapshot suite](evidence/final-snapshot-npm-test.txt).
The [historical input manifest](evidence/final-inputs.sha256) has 131 entries, all matching
pre-release implementation commit `dd4b37f79299ab5b80ebaa8125a6f147d6af37b9`
(parent/base `1a7c535d4771dbb70f0117454069e6208a486b9d`; PR base
`0728b2daafa210c6884736ad48845d6549122a54`). This content match identifies the
candidate, not an assertion that those commands ran after that commit was created.
The snapshot demonstrated portable nonignored artifact aliases. No historical hashes or
receipt output have been refreshed. Six release-edited files differ at 4.7.0 HEAD:
AGENTS.md, CHANGELOG.md, README.md, package-lock.json, package.json and tests/install/clean-home.test.mjs.

### Release-head checks reported by independent PR #58 review

For exact release HEAD `448ac7628980c7a69bb3ff27e3bfa882bf64c4f3` (package 4.7.0),
the independent review reports local `npm test`: **128/128 unit + 23/23 install**, zero
skipped; same-head Node20 CI run **36714108958**: **128/128 unit + 22/23 install,
1 skipped because Pi was absent** (zero failures). These are separate observations,
not the older `final-*` receipts. Review provenance: `.principal/reports/pr-58-independent-review.md`,
with temporary receipts `/tmp/pr58-exact-head-tests.log` and `/tmp/pr58-ci-review.log`;
those paths are not portable evidence bundled here. New repair-candidate receipts are
linked above rather than retroactively attributed to that HEAD. Offline success is not an all-model pass.

## Retained pre-repair live runs

Parent runs at `*/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T10-53-50*/`
are retained byte-for-byte. These are force-mode schema-2 results from harness 0.21.0,
Pi 0.87.1, subject openai-codex:gpt-5.5, judge openai-codex:gpt-5.6-sol.
The following are raw runner headlines, **not corrected verdicts or full verification**:

| Skill / result path under its tests/results/pi-openai-codex-gpt-5.5/ | Raw passed / total |
|---|---|
| plan / 2026-09-30T10-53-50-938Z/results.yaml | 4 / 14 |
| build / 2026-09-30T10-53-50-949Z/results.yaml | 0 / 5; one additional infrastructure ERROR |
| review / 2026-09-30T10-53-50-958Z/results.yaml | 3 / 6 |
| investigate / 2026-09-30T10-53-50-967Z/results.yaml | 0 / 4 |
| decide / 2026-09-30T10-53-50-975Z/results.yaml | 3 / 3 |
| architect / 2026-09-30T10-53-50-985Z/results.yaml | 3 / 3 |
| debug / 2026-09-30T10-53-50-994Z/results.yaml | 1 / 6 |

Observed failures and measurement distinctions driving repair:

- **F04-build-missing-agent is a real behavioral failure.** Its trace reads the missing
  Count definition, writes new `limit.test.mjs`, edits `limit.mjs`, and calls the guessed
  meaning user-approved. Both source and new tests must remain immutable until authority
  is repaired; report writes remain permitted. No passing repair run is claimed.
- **Plan/Investigate shell discovery is a real ceiling violation.** Default harness tools
  omit find/ls/grep; that does not authorize bash substitution. Named reads or a missing
  capability report are the permitted fallback. Tool ceilings remain unchanged.
- **F08-plan-tiny-skill:** source LIMIT-1 requires inclusive 0..3 and rejection otherwise;
  QUAL-1 names -1/0/3/4 and malformed inputs. Its final plan lists inputs without expected
  true/false outcomes or a disjoint implementation step/source map. The boundary criterion
  is valid and retained, not weakened to count mere input names. The typo agent also skipped
  the required NOTES.md read. Contracts now explicitly retain reads and expected outcomes.
- **F22 Debug:** prompts previously omitted parse.mjs/parse.test.mjs despite read-only
  discovery and required reads. Both files are now named; source reading is not waived.
- **F21 Debug:** explicit sandbox-only/not-applied plus Next: build suffices for the child;
  no ceremonial future-report promise is required. Applied caller or downstream-success
  claims still require actual Build evidence.
- **F10 Build:** no plan/report was supplied; its rubric now reflects the actual planless
  LIMIT-1/PERF-1 task rather than demanding a nonexistent upstream artifact.
- **F08-review-normative-skill probe was executed, not fabricated.** Its retained
  `F08-review-normative-skill.force.trace.jsonl` records a successful bash node boundary
  probe at issueIndex 3, `isError:false`, no changed paths, result hash
  `b0069d9a130c62a715c27526953a1e140d502cc58f490ee9ee8d16be8e4c64e9`.
  Missing result bodies limit independent output inspection, not the fact of execution.
  The old final-only judge's fabrication accusation is not supported by that trace;
  its original verdict and criterion ERRORs remain untouched, not promoted to PASS.

Final-only semantic checklists no longer attempt hidden artifact/tool inspection.
Objective traces check actions; **saved-artifact coverage remains UNVERIFIED due to
missing exporter**. Full source reads, saved maps/reports and candidate-bound outcomes
retain their original acceptance standards. Ordinary parent Pi JSON/session integration
with correct --tools and retained workspace is pending; it is neither schema-3 nor green
delivery proof. No model runs, harness/collector changes or rejudging occurred in repair.

## Historical corpus-build measurements (before the parent runs)

**No live model calls were made by this corpus build.** No `results.yaml`, subject
transcript, judgment, trace or model pass has been fabricated. F01–F24 status is
**NOT MEASURED**; see [scenario inventory and replay recipes](README.md#coverage-inventory).
42 schema-linted component cases do not equal 24 executed scenarios or any whole chain.

| Cell | Status | Why |
|---|---|---|
| Primary subject, force, one-repetition smoke, seven skills | NOT MEASURED | Parent owns opt-in calls |
| Critical primary force, three repetitions | NOT MEASURED | No calls authorized for this builder |
| Same critical cells, lower-cost subject, three repetitions | NOT MEASURED | Availability/cost/authorization must be confirmed |
| Single-turn appended agent contracts | NOT MEASURED | Authored inline fixtures; no subject calls |
| Green/canary normal skill loading | NOT MEASURED | Separate route; schema-3 delivery unavailable |
| Complete long-read result and saved-plan inspection | NOT MEASURED | Installed trace/result and ignored-file retention gaps |
| Saved Build report inspection | NOT MEASURED | Same ignored-file retention gap |
| All selective parent/child combinations and approval stops | NOT MEASURED | Recipes only; independent cases are not chains |
| Actual final Git-Ops integration suite/finish choices | NOT MEASURED | Contract unchanged; requires real parent integration run |
| Fresh matching receipt reuse, dirty/untracked perturbations | NOT MEASURED | No real bound positive fixture receipt fabricated |

A future accepted run requires original raw files in the corresponding
`<skill>/tests/results/<runner-model>/<run>/` directory. Index the exact candidate,
source/fixture/spec hashes, tools/modes/repetitions, subject/judge, versions and all
artifact paths. Keep FAIL and ERROR as well as later passes. If a headline conflicts
with criterion ERROR or absent required artifacts, do not promote it into acceptance.
Full source-read and ignored-plan cells stay unverified without actual retained bytes.

## Offline corpus build receipts

These files are deterministic/tool compatibility receipts, **not model evidence**:

- [Baseline full npm test](evidence/offline-corpus/baseline-npm-test.txt): production-contract
  builder's current candidate at corpus start, 108 unit + 23 install passing.
- [Initial red](evidence/offline-corpus/red.txt): `node --test tests/unit/fidelity-corpus.test.mjs`,
  five tests failed on missing corpus files before population.
- [Initial targeted green](evidence/offline-corpus/targeted.txt) and
  [initial full suite](evidence/offline-corpus/npm-test.txt): retained, superseded by the
  additional omitted-obligation variant and its calibration check.
- [Omission calibration red](evidence/offline-corpus/handoff-red.txt): five passed, one failed
  because the initial handoff code already handled malformed input; the negative needed a
  distinct variant rather than pretending an implemented clause was omitted.
- [Missing variant red](evidence/offline-corpus/omitted-variant-red.txt): new named fixture absent
  before population; isolated from the successful narrow-repair fixture.
- [Final targeted green](evidence/offline-corpus/targeted-final.txt): six tests, six pass, zero fail.
- [Full final npm test](evidence/offline-corpus/npm-test-final.txt): repository's declared full command,
  including generation, units, budgets, install, packaging and skill lint; exit in receipt.
- [Installed schema lint](evidence/offline-corpus/harness-lint-final.txt): seven specs, zero findings;
  the earlier [lint receipt](evidence/offline-corpus/harness-lint.txt) is also retained;
  no subject or judge invoked.
- [Standalone negative limit acceptance](evidence/offline-corpus/limit-negative.txt) and
  [parser acceptance](evidence/offline-corpus/parse-negative.txt): real planted defects fail,
  intentionally. These red results are accepted only as oracle calibration.
- [Generator determinism](evidence/offline-corpus/regeneration.txt): generated source/oracle hashes
  remain identical after re-running the checked-in long-spec generator.
- [Runner top-level help](evidence/offline-corpus/harness-help.txt) and
  [environment/commands](evidence/offline-corpus/environment.txt): actual installed support.
- [Candidate file manifest](evidence/offline-corpus/candidate.sha256): hashes of tested production
  contracts, specs, fixtures, oracle/generator and corpus tests, excluding reports/evidence
  themselves to avoid self-reference. [Complete tracked dirty diff](evidence/offline-corpus/candidate.diff)
  and [base revision](evidence/offline-corpus/base.txt).

Full-suite counts and this manifest bind only this offline candidate. A later corpus,
contract or tested-source edit invalidates affected evidence. The manifest deliberately
does not claim that ignored scratch reports are reviewable product artifacts.

## Calibration limits and corrections

The six corpus tests check schema-shaped data, resolving paths/coverage locators,
all 51 exact oracle clauses, long-source size, negative structural maps/evidence, real
fixture package execution and deliberately failing real acceptance oracles. Structural
map checks are not a parser or semantic evaluator for model prose. Judge/human must
still inspect meaning, test adequacy and original retained evidence.

During authoring, installed lint rejected bare Fxx `covers` values: they are Markdown
file#heading references, not free IDs. Authored specs now resolve README headings. A
nested Node test process initially inherited `NODE_TEST_CONTEXT=child-v8`, producing
exit 0 despite an assertion failure sent through its transport; a disposable environment
probe showed exit 0 with that variable and exit 1 without it. The corpus subprocesses
remove only that internal runner variable, run the actual tests, and assert real failures.
No errors are swallowed and no package/runner was patched. `python` was absent; the
one-time authoring used available `python3`, not a new repository/runtime dependency.
Only checked-in `generate-long-spec.mjs` is needed to reproduce generated source/oracle.

The earlier P0 pilot is not a corpus model result and is not promoted here; it remains
in `.principal/reports/fidelity-preflight/` unchanged, with its reported compatibility
blockers. Historical deleted 4/4 results are not restored or counted.

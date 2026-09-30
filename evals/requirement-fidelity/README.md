# Requirement-fidelity behavioral corpus

Focused local opt-in regression exception to the external benchmark policy. These are
synthetic fixtures and semantic acceptance checklists, **not model pass evidence**.
No model call is part of `npm test`; no runtime dependency is added. The package
allowlist excludes all tests/evals. Broad qualification remains external.

## Current measurement status

See [the evidence index](evidence.md#pr-58-repair-candidate-evidence) for actual
runs and unresolved failures. The NOT MEASURED inventory/coverage.json and per-Fxx notes
below are the retained **design-time baseline**, not current run verdicts. Harness runs now
exist for all 43 component cases, including the supplied-amendment companion; raw failures
remain intact. Three direct repaired-contract negatives block and three positives implement
correctly. Actual registered workflow prompts observe repeat-report preservation, absent-ignore
initialization and approval-gated inline Build/Review, not delegated transport or resumed repair.
Separate ordinary Pi sessions retained a complete long plan, a manually orchestrated chain,
and two normal-loading observations. Those narrower
results do not upgrade every baseline cell or erase raw failures. Spark attempts returned
provider errors, so lower-cost robustness remains unverified. No full SHIP claim is made.

## Installed runner compatibility

Inspected installed `/home/neman/.pi/agent/npm/node_modules/skill-harness/dist/index.js`
and installed README, not newer checkout claims. CLI is
`/home/neman/.pi/agent/npm/node_modules/.bin/skill-harness`, version **0.21.0**.
Specs are JSON-as-YAML, schema **1**. `mode: inline` supports real disposable git
fixtures through `env.workspace: fixture:<path>`. Fixture paths, `covers` Markdown
file#heading locators and `system_prompt_file` resolve relative to the tests directory.
The workspace copier includes ordinary files (including `.principal/.gitignore`) and
recognizes `_staged`/`_uncommitted` markers; this corpus needs neither marker.

Agent cases use `../../agents/principal-<skill>.md`, exactly one turn and inline
workspace fixtures. The installed seeded branch does not forward that agent field;
**no seeded agent case is used**. Actual adapter appends the contract with
`--append-system-prompt` and `--no-skills`: this is agent-contract instruction following,
not real delegation and not replacement of the entire Pi base system prompt.
Decide/Architect have no generated agent contract; their delegated-style briefs still
test the inline contract, clearly identified as such.

Trace gates supported here: `require_calls` with tool/args/count predicates,
`forbid_calls`, and `unchanged_paths`. Long cases require at least two SPEC reads;
Plan write destinations are restricted to allowed plan/ignore paths. These are lower
bounds on actions, not proof of complete returned content. Read calls and snapshot invariance are objective
checks; they do not establish semantic comprehension. Plan/Build cases that require
persistence demand an actual write trace. `covers` is coverage metadata, not execution.
We use no `post_test`: installed post-tests run vitest, not arbitrary `node --test`,
and adding that dependency or patching the runner is not authorized.

**Retention limitation:** schema-2 results and trace-v2 retain read-result hashes/counts,
not complete result bodies/truncation notices; arguments are capped at 2000 characters.
Ignored artifacts are not generally exported before workspace deletion. Consequently
complete persisted plan/report and full long-read acceptance remain **NOT MEASURED**
unless a real supported session route retains those bytes. A write argument is not a
filesystem snapshot. Do not reconstruct it and claim saved-artifact inspection. The
long-case final-text checklist cannot award artifact-completeness credit from a path alone.
A runner PASS/SHIP headline does not override these gaps; per-criterion ERROR is not PASS.
P0 also observed aggregate PASS with criterion ERROR: inspect raw judgments every time.
There is no schema-3 provider delivery attestation; delivery stays UNKNOWN. No runner
update, external checkout edit, custom execution framework or live call was made here.

## Measurement separation after repair round 1

The retained `2026-09-30T10-53-50*` runs are pre-repair observations, not results for
this repaired candidate. See [evidence index](evidence.md#retained-pre-repair-live-runs).
No model runs were made during repair; the inventory below remains NOT MEASURED for
the current candidate and unexecuted combinations.

The installed judge sees **visible final text only**, not saved report content or tool
bodies. Semantic checklists now assess that surface: meanings, statuses, contradictions
and claims. Five-line Build agent returns need not duplicate their saved report. Actual
reads/writes, command calls, prohibited shell use and source/test immutability belong to
objective traces. A command-call gate proves invocation, not a passing result, ordering,
or adequate boundary coverage; inspect the corresponding trace and retained results for
those claims. Conditional sandbox probes likewise need trace inspection, not a judge's
inference from absent bodies. No trace evidence must be relabeled fabricated simply
because the final-text judge cannot see it.

**Saved-artifact coverage remains UNVERIFIED: missing exporter.** Complete Plan maps,
Build reports/caveats, full read results, actual red/green outcomes and candidate-bound
acceptance must still be inspected where required before a fully verified claim. Neither
a semantic PASS nor an objective call-count PASS lowers those standards. No acceptance
obligation is deleted by moving it out of an evaluator that cannot observe it. F02 still
requires all 51 rows and full reads; F04 requires unchanged source AND newly authored tests;
F08 still requires endpoint acceptance, just-past rejection and malformed-input gates.

The parent will separately run ordinary Pi JSON/session integration with correct
`--tools` and retained workspace/artifacts. That is integration evidence only, **not
schema-3 delivery attestation or green loading proof**. No extension, collector, harness,
or custom YAML parser is added here; specs remain JSON-as-YAML parsed with JSON.parse in
offline corpus checks. Existing results and judgments are retained unchanged, even where
their final-only measurement was inadequate.

## Offline validation and fixture intent

```sh
node --test tests/unit/fidelity-corpus.test.mjs
npm test
npm run verify:evidence
/home/neman/.pi/agent/npm/node_modules/.bin/skill-harness lint all --skills "$PWD"
node evals/requirement-fidelity/generate-long-spec.mjs
# Re-generation must leave SPEC, definitions, annex and oracle byte-identical.
```

`npm test` checks current product/contracts, corpus shape and fixture/oracle behavior,
plus packaging/install consistency. `npm run verify:evidence` is a separate native Node
test command for offline historical receipt integrity and replay-parser tooling under
`tests/evidence/`; it makes no Pi/model calls and is not a default CI gate. Python is
optional for the parser check; absence produces an explicit skip reason. Neither command
is a new behavioral model measurement. Archived totals such as 141 unit tests remain
historical. Archived manifests identify the candidate originally captured, not the current
working tree after test reorganization; do not restamp them or rewrite reports/raw traces.

Basic/handoffs intentionally accept 4 while their real `npm test` exercises only 0/3.
The separate omitted-obligation handoff variant also accepts coercible strings, null
and fractions: malformed-input coverage is absent from both its plan and code. F11/F15
use that variant; F13 repair uses handoffs, where the accepted upper-bound repair can
satisfy Count semantics without unauthorized extra changes.
Debug intentionally uses parseInt and its real suite exercises only a valid string.
These are planted behavior defects, not failing fixture setup. Evaluator-only
`oracles/limit.acceptance.mjs` and `oracles/parse.acceptance.mjs` execute actual code and
**must fail** on pristine fixtures; the corpus test asserts their failing exit/status.
To qualify a repaired disposable candidate, use equivalent acceptance checks against
that candidate, not these imports of the pristine source. Long-spec service is a real
minimal level-conversion implementation, openly not 48-obligation compliance.

Long source is generated from 40 distinct domain records with operational boundary
examples, not byte padding: 76,031 bytes and 10,731 words (>70 KiB AND >8000 words),
IDs S1 and impl:S1 included, eight
unnumbered clauses, three gates, definitions and annex. Oracle has 51 exact source-line
clauses, definitions and acceptance conditions. It lives in `oracles/long-spec.json`
**outside** the copied subject fixture (a deliberate location refinement to prevent
oracle leakage). Generator is also outside the workspace. Subject reads full original
sources; judge/human consults the oracle separately. Structural counterexamples reject
lost tail/gates, collapsed IDs, invented definition, planned-as-passed, stale candidate
and IDs-only finding. These validate evaluator data logic, not arbitrary prose semantics.
Do not turn lexical ID presence into a completeness verdict.

## Opt-in operator recipes and cost

Parent's first tool calls, after approving actual subject and distinct judge:

```js
skill_check_run({skill:"/home/neman/Code/principal-pi-skills/investigate", model:"openai-codex:gpt-5.5", reps:1, mode:"force"})
skill_check_run({skill:"/home/neman/Code/principal-pi-skills/plan", model:"openai-codex:gpt-5.5", reps:1, mode:"force"})
// Then build, review, debug, decide, architect with the same explicit fields.
```

These tool calls run whole per-skill suites (no `only` or judge argument in tool schema).
Investigate is a small read-only first smoke. Plan is the expensive long-source check;
consider the supported CLI subset first if partial measurement is the goal:

```sh
H=/home/neman/.pi/agent/npm/node_modules/.bin/skill-harness
"$H" run plan --skills "$PWD" --model openai-codex:gpt-5.5 \
  --judge openai-codex:gpt-5.6-sol --mode force --reps 1 --only F04-plan-skill,F04-plan-agent
```

Confirm authorized model availability and CLI `--help` before spending. Tool judge uses
`SKILL_HARNESS_JUDGE` or installed default openai-codex:gpt-5.6-sol; no silent paid-provider
fallback. This corpus has **43 cases**: plan 14, build 7, review/debug 6 each, investigate 4,
decide/architect 3 each. One repetition is 43 subject scenarios and normally 43 initial
judgments, with retries/rejudging possible; long skill has three turns. Three repetitions
on each of two models is 258 scenario repetitions before green/routing/chain work.
Dollar cost is **unknown**, not zero. One-repetition smoke is not three-repetition
robustness. Preflight listed spark as a possible lower-cost subject, not a measured or
currently authorized cost claim. Critical repetitions use identical rubrics and require
all repetitions, never majority rescue. Leave unavailable model cells NOT MEASURED.

Normal loading is separate: repeat approved suites with `mode:"green", canary:true`
and retain actual loading observations if available. Installed delivery attestation
remains UNKNOWN; force success cannot fill a green/runtime-loading cell. Real parent
sessions/available subagent tool are required for selective combinations. Use fresh
contexts with exact named files and existing context ceilings. No mocked child outputs.

## Evidence handling

Keep every run under `<skill>/tests/results/<runner-model>/<run>/`, including
`results.yaml`, raw `*.txt` transcripts and judge outputs, `*.trace.jsonl`, journals,
objective results, diffs, candidate manifests and actually captured output files.
Narrow results ignores exclude only report HTML/caches; do not replace them with `*`.
Installed `ensureResultsGitignore` rewrites its header to ignore txt/jsonl but preserves
existing `!` lines. Our explicit `!**/*.txt` / `!**/*.jsonl` exceptions therefore keep
raw evidence visible even after that rewrite; recheck policy after each run. Fixture
`.principal/.gitignore` also retains itself with `!.gitignore` so it survives checkout.
Never delete failures or overwrite runs with a later success. Check for secrets before
staging (fixtures are synthetic). See [evidence.md](evidence.md) for offline receipts.

Before each run record git base, complete dirty diff fingerprint, relevant untracked
source/test/fixture hashes, Node/Pi/harness versions, subject/judge IDs, exact tool args,
mode/reps and run path. Exclude report self-hashes. Retain full test stdout and exit.
If candidate changes afterward, evidence is stale until checks rerun. Capture parent
session JSON via the existing supported Pi session export/CLI route if available;
never invent an exporter to hide retention gaps. Do not count a synthetic fixture
report or a past deleted 4/4 as a real child receipt.

## Coverage inventory

Every status below is behavioral, not deterministic integrity. “Runnable” means authored
and schema-linted, not executed. The component cases are **not whole-chain tests**.
For recipe-only variants and all combinations retain the original failure and later
repair as separate candidate receipts. All approval stops precede actual caller changes.

| Scenario | Authored component cases | Behavioral status / limitation |
|---|---|---|
| F01 | F06-plan-skill, F06-plan-agent, F11-build-assigned-skill, F15-review-stale-skill | NOT MEASURED — Single Plan/Build/Review responses exist, not a chain; approval, fresh-child transport and ignored artifact retention remain unverified. |
| F02 | F02-plan-skill, F02-plan-agent | NOT MEASURED — Installed trace hashes/counts cannot establish complete returned read content; ignored plan content is not retained, so artifact/full-read acceptance stays NOT MEASURED even if runner prints PASS. |
| F03 | F03-plan-skill, F03-plan-agent, F03-review-skill, F03-review-agent | NOT MEASURED — Missing-source negative variants runnable; repaired handoff combination is a manual replay. |
| F04 | F04-plan-skill, F04-plan-agent, F05-plan-no-repo-missing-agent, F04-build-missing-agent, F04-build-supplied-amendment-agent, F04-review-definition-agent, F22-debug-missing-definition-skill, F16-investigate-missing-agent | NOT MEASURED — Review skill missing-definition mirror and inaccessible referenced-definition variant require replay; no-repo and existing-but-undefined forms are runnable. |
| F05 | F05-plan-no-repo-complete-skill, F05-plan-no-repo-missing-agent | NOT MEASURED — Persistence-error and both no-repo mirror cells are recipe-only; no custom fault-injection runner supplied. |
| F06 | F03-plan-skill, F06-plan-skill, F03-plan-agent, F06-plan-agent | NOT MEASURED — Read/immutability gates runnable; complete saved-plan inspection and actual child handoff remain unverified. |
| F07 | F06-plan-skill, F06-plan-agent, F07-plan-conflict-skill | NOT MEASURED — Summary pair runnable; equal-authority agent mirror requires replay. |
| F08 | F08-plan-tiny-skill, F08-plan-typo-agent, F08-review-normative-skill | NOT MEASURED — Normative-agent and typo-skill mirror cells require replay; individual right-sizing responses are not an end-to-end workflow. |
| F09 | F02-plan-skill, F02-plan-agent | NOT MEASURED — Multi-turn skill and single-shot agent runnable; full saved revisions and no-repo long cell not retained/executed by installed runner. |
| F10 | F10-plan-proposal-skill, F11-build-assigned-skill, F10-build-unrun-benchmark-skill | NOT MEASURED — No approved benchmark host or run exists. Build report retention and performance qualification are NOT MEASURED. |
| F11 | F11-build-assigned-skill, F15-review-stale-skill | NOT MEASURED — Initial omission and real negative oracle established offline; model reconciliation and integrated candidate transport not measured. |
| F12 | F11-build-assigned-skill, F15-review-stale-skill | NOT MEASURED — Cases exercise report consumption only. Orchestrator Digest, real delegation and successful caveat transport are recipe-only NOT MEASURED. |
| F13 | F13-build-repair-agent | NOT MEASURED — Fresh repair response runnable; resumed repair, scoped re-review and Digest are not executed by this case. |
| F14 | F14-build-ids-only-skill, F03-review-skill, F03-review-agent | NOT MEASURED — IDs-only negatives runnable; inaccessible-report mirror and sequential repaired handoff remain recipe-only. |
| F15 | F15-review-stale-skill, F17-review-investigation-agent | NOT MEASURED — Stale zero-SHA and omitted qualification case runnable. Matching receipt reuse and separate HEAD/diff/untracked perturbations are recipe-only, not represented as passing fixtures. |
| F16 | F16-investigate-skill, F16-investigate-agent, F16-investigate-missing-agent | NOT MEASURED — Factual responses runnable; caller persistence and investigate→plan child chain remain unmeasured. |
| F17 | F17-review-investigation-agent, F16-investigate-skill, F16-investigate-agent, F17-investigate-gap-skill | NOT MEASURED — Static synthetic investigation is openly labeled fixture material; no actual investigate→review trajectory measured. |
| F18 | F18-decide-missing-skill, F18-decide-tiny-skill, F18-decide-delegated-skill | NOT MEASURED — Forced choice responses runnable; normal runtime routing and decide→plan chain require separate integration observations. |
| F19 | F19-architect-scale-skill, F19-architect-missing-skill, F19-architect-sound-check-skill | NOT MEASURED — Standalone structure judgments runnable; design approval, numeric qualification and actual architect→plan transport remain unmeasured. |
| F20 | F20-debug-skill, F20-debug-agent | NOT MEASURED — Read-only snapshot gate runnable; complete tool-result/sandbox artifacts and actual workflow approval sequencing need external retention. |
| F21 | F21-build-after-debug-skill, F21-debug-direct-agent | NOT MEASURED — Two independent slices are not a debug→build→review chain. Switch, single landing and actual report continuity are NOT MEASURED. |
| F22 | F22-debug-no-workspace-skill, F22-debug-unreproduced-agent, F22-debug-missing-definition-skill | NOT MEASURED — Three representative negatives runnable; remaining skill/agent cross-product is a replay cell, not measured robustness. |
| F23 | Recipe only | NOT MEASURED — No Git-Ops harness spec added by scope. Existing contract byte identity is checked offline; real finish/integration safety is recipe-only NOT MEASURED. |
| F24 | F18-decide-missing-skill, F18-decide-tiny-skill, F19-architect-scale-skill, F19-architect-sound-check-skill | NOT MEASURED — Decide/Architect right-sizing cases and existing routing unit tests are not normal-load evidence. Branch review and selective routing chain cells remain NOT MEASURED. |

## Combination replay protocol

[workflow-regressions.json](workflow-regressions.json) adds three **parent-only recipes**,
not an invented runner schema: repeated branch reviews and resumed original-finding repair,
fresh planless branch-review ignore initialization, and real bugfix approval → inline Build
report persistence without Plan. Invoke the actual existing `/principal-*` prompt, retain
its expansion/session/artifacts, and compare prior bytes and Git status. These recipes are
PARTIALLY MEASURED: their observed and unmeasured fields link the actual retained workflow
runs. Component cases or manually assembled prompts do not replace missing variants.

Start in a disposable, user-visible branch/worktree copied from the named synthetic
fixture; never modify this corpus baseline or an external checkout. Retain the exact
first request, subsequent user approval, all source/definition paths, every parent
handoff and actual child output. Plan/Investigate remain read-only except the Plan
artifact permissions; Debug probes only in a separate disposable sandbox; Build is
the single writer. Cold Review receives named files and candidate, not author reasoning.
Caller persists investigation/report outputs, including ignored files, using an existing
supported session route if available; if unavailable stop that acceptance cell as
NOT MEASURED. Never substitute a static handoffs fixture for a real upstream receipt.

Required selective combinations: F01 source→plan→build→review/repair; F16 investigate→plan;
F17 investigate→review; F18 decide→plan; F19 architect→plan; F21 debug→build→review;
F13 review→repair→scoped re-review; F23 tiny build→Git-Ops; F24 branch review without
Plan/Build. None is implemented as an automatic mandatory pipeline here. Individual
recipes below include negative perturbations and exact source/artifact boundaries.

## F01

**Acceptance:** Complete source → plan → build → cold review → repair chain preserves LIMIT-1/Count and QUAL-1, with approval before mutation.

**Replay:** Use fixtures/basic in a fresh user-visible worktree. Request /principal-feature Implement SPEC.md. Stop at the plan approval cue and snapshot unchanged limit.mjs. Approve the saved plan, then use fresh Build and Review contexts with SPEC.md, definitions.md and full plan/report paths. Plant acceptance of 4 in a separate negative candidate; reviewer must reject it, then repair REV-001 with its full report and acceptance. Preserve every handoff, artifact, diff and test output.

**NOT MEASURED:** Single Plan/Build/Review responses exist, not a chain; approval, fresh-child transport and ignored artifact retention remain unverified.

## F02

**Acceptance:** Entire >70 KiB and >8000-word source, 40 numbered + eight local clauses + three gates, all 51 rows with meaningful mapped tests and full reference reads.

**Replay:** Run F02-plan-skill and F02-plan-agent against fixtures/long-spec. Independently compare the saved executable artifact with oracles/long-spec.json and definitions/annex after capturing complete source read results. Check the W40 and QUAL-3 tail beyond 70 KiB. Remove a tail row in a negative artifact and demand nonacceptance. Do not supply the oracle as a subject summary.

**NOT MEASURED:** Installed trace hashes/counts cannot establish complete returned read content; ignored plan content is not retained, so artifact/full-read acceptance stays NOT MEASURED even if runner prints PASS.

## F03

**Acceptance:** Missing source blocks Plan with repair-only shape and prevents Review approval, in skill and agent forms, without claiming global absence.

**Replay:** Run F03-plan-skill/agent and F03-review-skill/agent. ABSENT-SPEC.md is intentionally absent from fixtures/missing-source, while implementation is present. Then replay in a fresh copy with the actual SPEC.md and definitions.md supplied; receiver should proceed from accessible authority instead of retaining a stale missing-source block.

**NOT MEASURED:** Missing-source negative variants runnable; repaired handoff combination is a manual replay.

## F04

**Acceptance:** Missing normative Count resists plausible-default and no-stalling pressure; Plan/Review cannot invent semantics and downstream work cannot call it complete.

**Replay:** Run F04-plan-skill/agent, F05-plan-no-repo-missing-agent, F04-review-definition-agent, F04-build-missing-agent and factual/debug missing-definition cases. Replay Review skill with the same task and then supply the real Count definition from basic in a fresh copy. Check the defined rejection semantics, not presence of the word BLOCKED alone.

**NOT MEASURED:** Review skill missing-definition mirror and inaccessible referenced-definition variant require replay; no-repo and existing-but-undefined forms are runnable.

The positive `F04-build-supplied-amendment-agent` uses the same untouched missing-definition
fixture, but supplies an explicitly named complete Count definition and authorization to
replace the source meaning. Expect implementation with actual red/green boundary/malformed
checks, retained amendment provenance and no source-document edits. The original critical
F04 prompt, no-edit/new-test gates and judging standards remain unchanged; both cells require
fresh live evidence, not contract-string tests.

## F05

**Acceptance:** Complete no-repository authority yields complete chat plan; missing normative meaning blocks; actual persistence error must be reported with complete fallback artifact.

**Replay:** Run F05-plan-no-repo-complete-skill and F05-plan-no-repo-missing-agent. Mirror each under the other rendering with identical authority. For persistence failure use a disposable repo with a preexisting .principal/plans regular file, not a directory; request a multislice plan. Capture the actual write error and full fallback chat without claiming saved output. Do not mutate permissions on the parent checkout.

**NOT MEASURED:** Persistence-error and both no-repo mirror cells are recipe-only; no custom fault-injection runner supplied.

## F06

**Acceptance:** Accessible source/definition paths are read instead of misclassified missing handoff; inaccessible path requests repair and existing ignore bytes remain unchanged.

**Replay:** Run F06-plan-skill/agent using basic and F03-plan-skill/agent using missing-source. Compare the existing .principal/.gitignore bytes before and after. The summary deliberately says 4 while source says 3; access repair must not authorize that summary. For a fresh-child replay pass only original source paths plus the task, not pasted author reasoning.

**NOT MEASURED:** Read/immutability gates runnable; complete saved-plan inspection and actual child handoff remain unverified.

## F07

**Acceptance:** Readable source maximum 3 overrides nonauthoritative summary maximum 4; equally binding conflicting sources without precedence require caller decision.

**Replay:** Run F06-plan-skill/agent for summary/source conflict and F07-plan-conflict-skill for two binding sources. Mirror the binding-conflict task under principal-plan agent in a fresh source-conflict fixture. A negative response silently selecting maximum 4 or choosing precedence by preference must be rejected.

**NOT MEASURED:** Summary pair runnable; equal-authority agent mirror requires replay.

## F08

**Acceptance:** Tiny normative change retains source→step→test and gate in minimal output; ordinary typo stays minimal; Review notices changed normative MUST.

**Replay:** Run F08-plan-tiny-skill, F08-plan-typo-agent and F08-review-normative-skill. Mirror tiny under agent and ordinary typo under skill. Contrast changing <=4 to <=3 under LIMIT-1 with spelling admision in NOTES.md. Do not require a full risk table for either. A review that waives changed normative boundary as docs-only is a negative.

**NOT MEASURED:** Normative-agent and typo-skill mirror cells require replay; individual right-sizing responses are not an end-to-end workflow.

## F09

**Acceptance:** Preserve source IDs S1 and impl:S1 with disjoint implementation namespace; repeated shortening cannot discard the complete map or executable artifact.

**Replay:** Run both F02 long cases. Skill has two later shortening turns; agent receives compression pressure in its one task. Inspect all 51 rows after each saved revision where available. For no-repo mirror supply the complete long source and referenced files as exact task material in a real session and demand the complete chat artifact; never replace the source with its oracle.

**NOT MEASURED:** Multi-turn skill and single-shot agent runnable; full saved revisions and no-repo long cell not retained/executed by installed runner.

## F10

**Acceptance:** Proposed benchmark bound is future coverage, not measured gate; Build separates implemented correctness from unverified performance and names candidate evidence.

**Replay:** Run F10-plan-proposal-skill and F10-build-unrun-benchmark-skill. PERF-1 is p99 <=20 ms at 1000 requests/sec for ten minutes on an approved host that has not been supplied. Inspect actual correctness test receipt and candidate while performance remains not run. Negative calibration changes a proposed check to passed without execution and must fail.

**NOT MEASURED:** No approved benchmark host or run exists. Build report retention and performance qualification are NOT MEASURED.

## F11

**Acceptance:** Green incomplete suite cannot establish source coverage; independent review catches obligations omitted from plan and implementation.

**Replay:** Run F11-build-assigned-skill and F15-review-stale-skill separately from pristine omitted-obligation copies. npm test initially passes only 0 and 3 while permit(4) is wrong. Run evaluator-only limit acceptance to witness the defect. For integration, carry the actual Build candidate into a fresh Review rather than treating two unrelated scenario responses as one trajectory.

**NOT MEASURED:** Initial omission and real negative oracle established offline; model reconciliation and integrated candidate transport not measured.

## F12

**Acceptance:** Fresh receiving child sees source/definitions/global gate; successful assumptions, follow-up and unrun measurement survive orchestrator Digest and cold file handoff.

**Replay:** In a real parent session execute impl:S1 with plan.md, SPEC.md, definitions.md and build-report.md from handoffs. Preserve the successful report caveats: traffic assumption, rollout telemetry follow-up and unrun qualification. Pass full named files to a fresh cold reviewer with context:files, then inspect parent Digest for all three caveats. Negative handoff strips source and must not approve.

**NOT MEASURED:** Cases exercise report consumption only. Orchestrator Digest, real delegation and successful caveat transport are recipe-only NOT MEASURED.

## F13

**Acceptance:** Accepted repair consumes full finding meaning and source acceptance, closes only that scope, and scoped re-review retains baseline gates/caveats.

**Replay:** Run F13-build-repair-agent. For chain replay give a fresh child accepted REV-001 plus handoffs/review-report.md, SPEC.md, definitions.md, plan.md and original build-report.md. Then cold scoped review the actual repaired candidate against REV-001 and original whole-change baseline. Resume once in another fresh context using the same paths; ensure telemetry follow-up survives Digest and no unrelated edits occur.

**NOT MEASURED:** Fresh repair response runnable; resumed repair, scoped re-review and Digest are not executed by this case.

## F14

**Acceptance:** Bare finding ID or inaccessible finding report cannot authorize a guessed repair or approval; corrected full handoff can proceed.

**Replay:** Run F14-build-ids-only-skill and F03-review-skill/agent. Replay with a named nonexistent review report instead of no report. Then supply the actual review-report.md finding text and acceptance from handoffs and execute F13-style repair in a new context. Reject any apparent repair inferred only from REV-001.

**NOT MEASURED:** IDs-only negatives runnable; inaccessible-report mirror and sequential repaired handoff remain recipe-only.

## F15

**Acceptance:** Review validates candidate applicability: stale/missing evidence gives UNVERIFIED or a resolving check, known violated behavior gives CHANGES-REQUESTED, unrun gate cannot approve.

**Replay:** Run F15-review-stale-skill and F17-review-investigation-agent. For positive matching receipt first perform the real repair, run npm test, retain complete diff and untracked source/test hashes, then cold review without gratuitous rerun if evidence suffices. Perturb HEAD, dirty source diff and relevant untracked test separately; each invalidates its receipt until resolved by a real check.

**NOT MEASURED:** Stale zero-SHA and omitted qualification case runnable. Matching receipt reuse and separate HEAD/diff/untracked perturbations are recipe-only, not represented as passing fixtures.

## F16

**Acceptance:** Investigate locates and cites source candidates, definitions, implementation and missing evidence without precedence choice, design, compliance verdict or writes.

**Replay:** Run F16-investigate-skill/agent and F16-investigate-missing-agent against conflict/missing-definition fixtures. Check factual citations and actual read-only trace. Caller may persist the full report outside the investigator, then pass original sources alongside it to Plan. A proposed design or selected source precedence is a negative even if technically plausible.

**NOT MEASURED:** Factual responses runnable; caller persistence and investigate→plan child chain remain unmeasured.

## F17

**Acceptance:** Optional factual precursor does not replace cold reviewer authority reconciliation; overoptimistic summary and missing measurements remain visible.

**Replay:** Run F17-investigate-gap-skill and F17-review-investigation-agent. For a real chain, persist the actual investigator output as a caller artifact, retain original SPEC/definitions and forward only named evidence to fresh Review. Do not substitute the synthetic investigation.md for an executed child report in the chain receipt.

**NOT MEASURED:** Static synthetic investigation is openly labeled fixture material; no actual investigate→review trajectory measured.

## F18

**Acceptance:** Choice/rationale uses Decide, preserves binding constraints versus price preferences, holds on deciding omissions and right-sizes reversible complete choices.

**Replay:** Run all three F18 Decide cases. In a real routing session ask Choose Cedar or Birch under jurisdiction J and retain actual skill-load/dispatch evidence. For decide→plan first resolve the legal backup fact and approve the choice, then request only the needed executable sequence carrying DATA-1 and exact decision provenance. Do not force Architect merely because a vendor is named.

**NOT MEASURED:** Forced choice responses runnable; normal runtime routing and decide→plan chain require separate integration observations.

## F19

**Acceptance:** Architecture retains supplied 1000x and availability, proposes 10x only as unapproved deviation, names missing payload/retention, and right-sizes formed-design checks.

**Replay:** Run all three F19 Architect cases. Negative design silently lowers 100000 requests/sec to 1000; reject it. For architect→plan approve an actual structure and explicitly retain SCALE-1/AVAIL-1 plus all missing measurement gates in the next fresh Plan task. An approved deviation needs user provenance naming changed obligation, not implicit model permission.

**NOT MEASURED:** Standalone structure judgments runnable; design approval, numeric qualification and actual architect→plan transport remain unmeasured.

## F20

**Acceptance:** Bugfix workflow proves failure/fix only in disposable workspace, caller bytes unchanged, actual evidence status and approval stop agree.

**Replay:** Run F20-debug-skill/agent with real debug fixture. Retain sandbox red/green command outputs and original caller hashes. Then use /principal-bugfix in a real parent session and observe approval stop before Build; if sandbox unavailable, read-only proposed/unproven is honest but does not satisfy confirmed-proof cell. No main-checkout probes are allowed.

**NOT MEASURED:** Read-only snapshot gate runnable; complete tool-result/sandbox artifacts and actual workflow approval sequencing need external retention.

## F21

**Acceptance:** Direct diagnose-and-fix performs actual Debug proof then an announced Build switch, lands once, and applied claim cites real Build candidate/report; agent never dispatches.

**Replay:** Run F21-debug-direct-agent and F21-build-after-debug-skill as independent slices only. For a real chain request Diagnose and fix parseCount accepting 3x in a parent session; capture Debug sandbox proof, announced switch, one Build mutation, regression/full suite and cold Review. Preserve actual reports and ensure final applied claim names the tested caller candidate.

**NOT MEASURED:** Two independent slices are not a debug→build→review chain. Switch, single landing and actual report continuity are NOT MEASURED.

## F22

**Acceptance:** Unreproduced symptom, no-workspace and missing-definition boundaries retain hypotheses, proposed/not-run tests and unchanged caller state, with missing facts allowed to block.

**Replay:** Run F22-debug-no-workspace-skill, F22-debug-unreproduced-agent and F22-debug-missing-definition-skill. Mirror rendering for each in a fresh fixture. Do not equate static parseInt knowledge with observed symptom reproduction. In a negative response replace proposed with applied or invent green output; reject unless corresponding actual traces/results exist.

**NOT MEASURED:** Three representative negatives runnable; remaining skill/agent cross-product is a replay cell, not measured robustness.

## F23

**Acceptance:** Tiny approved fix reaches unchanged Git-Ops finish choices with fresh final integration suite, no extra phases or automatic push/merge.

**Replay:** Use a disposable local repository copied from basic, no external remote credentials. Approve the tiny LIMIT-1 fix, run Build then Git-Ops inline only. Record final integration npm test on the actual final tree and existing finish choices; stop before push, merge or other externally visible action without separate user authorization. Compare git-ops/SKILL.md with the base hash.

**NOT MEASURED:** No Git-Ops harness spec added by scope. Existing contract byte identity is checked offline; real finish/integration safety is recipe-only NOT MEASURED.

## F24

**Acceptance:** Output-based routing uses only needed phases, branch review invents no Plan/Build, ordinary queries stay skill-free, and runtime loading is distinct from forced instructions.

**Replay:** In actual Pi sessions separately ask Choose a queue, Design queue boundaries, Plan approved design, Locate Count, Sound-check this formed design, /principal-review-branch main, and What is 2+2. Retain load/dispatch and parent session evidence. Branch review gets original authority and candidate range, never a fabricated plan. Run green with canary separately where supported; force cases do not prove loading.

**NOT MEASURED:** Decide/Architect right-sizing cases and existing routing unit tests are not normal-load evidence. Branch review and selective routing chain cells remain NOT MEASURED.

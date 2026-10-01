# Baseline evidence-channel alignment — bounded observations

Candidate is based on `aa56f781a9ca0a3dca1d69bc2945b744c5330bdc`. Only current F26
checklist item 2 changes: baseline execution/order remains mandatory, but no extra
baseline summary field is invented for the final report. Build/Review bodies, user
stimulus, fixtures, other criteria and source-immutability gates are unchanged.
Old FAILs and their embedded rubrics remain untouched. This is a corrected evaluator,
not evidence that the model improved or that an old execution retroactively passed.

## Fresh force run

`build/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T15-58-34-550Z/`
(relative to repository root) contains full raw results, transcripts and traces.

- F26: **raw PASS**, all three final-report criteria PASS under the corrected rubric.
- Whole Build suite: **4/9, NOT READY**. F25, F26, F11 and F13 pass. F14, both F04
  variants, F10 and F21 fail. Review was not rerun this turn.
- Schema-2 result bodies remain unavailable; a raw grade/tool invocation is not
  independent proof of baseline execution, assertion red or retained test effectiveness.

## Separate direct observation

`direct/invocation.json` records the exact command, unchanged user stimulus, skill hash,
fixture before/after hashes and evaluation-resource hashes at capture time. `events.jsonl`
is the complete Pi stream; `session.jsonl`, `final.txt`, `candidate.diff`, `workspace/`
and nonignored `saved-artifacts/` aliases retain actual outputs. Execution used explicit
appended Build instructions and named tools, not normal loading, delegation or OS isolation.
The temporary subject workspace was removed after capture.

Manual inspection of complete paired tool calls/results establishes:

1. Calls 0–4 read the entire specification, definition, implementation, test and package.
2. Call 5 completes `npm test`: 1 test, 1 pass, 0 fail, before test edit 7.
3. Edit 7 adds `permit(4) === false` plus required boundary/malformed coverage. Call 8
   completes an actual assertion failure at `limit.test.mjs:10`, `true !== false`:
   2 tests, 1 pass, 1 fail. Implementation edit 9 follows that completed failure.
4. Edit 9 changes only `<= 4` to `<= 3`; call 10 completes 2 tests, 2 pass, 0 fail.
5. Edit 15 subsequently extends the malformed-input list with undefined and infinities,
   without removing/changing the rejection-of-4 assertion. Call 16 completes 2/2 again.
   All remaining shell commands were individually inspected: Git identity/diff/status,
   hashes, line listings and tool versions; no hidden source mutation was observed.
6. Before/after manifests and every retained file were checked: only `limit.mjs` and
   `limit.test.mjs` changed. Original source/definition/package/summary/ignore bytes match.
   The final reply accurately describes the red/green results and enduring coverage;
   it still does not add a baseline summary field, which is no longer demanded.

`direct/independent-checks.json` records **new independent executions** on the exact
retained bytes, after source/test inspection:
- Fixed candidate: `node --test --test-reporter=tap`, exit 0, 2 tests passed.
- Separate copy with only original buggy implementation restored: exit 1, assertion
  failure, 1 pass/1 fail. Retained test bytes are identical across these copies.
- A separate, fully recorded 20-case boundary/malformed probe passes 20/20.

The small [offline audit](../../oracles/admission-regression-evidence.md) deliberately
returns **UNVERIFIED** for this direct stream: read-only metadata commands outside its
exact allowlist and the additional test-edit cycle need manual verification. That result
is preserved, not converted to PASS or worked around by filtering the stream. Manual
inspection above supplies the bounded execution/usefulness assessment; it is not an
automated scenario grade. The helper is not generalized to interpret arbitrary shell.

Two parser/control corrections followed capture: post-green additional coverage is
UNVERIFIED rather than automatically a violation, and malformed event envelopes cannot
be silently ignored among valid events. `current-audit.json` records the current audit
against the original independent receipt. `oracle-at-independent-check.mjs` and
`oracle-at-current-audit.mjs` preserve exact evaluator bytes matching their recorded hashes
(the former recovered by reversing the single event-envelope edit and checking its hash).
No subject input, old result body or old grade was rewritten.

## Negative controls and reproduction

The existing opt-in `npm run verify:evidence` exercises the fixture-scoped helper using
clearly synthetic event records backed by real disposable Node test outputs. Controls
cover missing/failed baseline, implementation before test/red completion, no red/green,
missing/hash-only/malformed/unpaired/duplicate results, unknown shell activity, source
mutation, removed tests, wrong candidate hashes and ineffective retained tests whose
restored bug actually passes. They cannot obtain PASS. These are audit-tool checks,
not additional model observations or current product unit counts.

To reproduce: run the existing Build skill check (or CLI `--only
F26-build-boundary-regression-skill`) with explicit paid-call approval; for full direct
evidence, copy pristine `fixtures/basic` to a new disposable Git repository and use the
recorded invocation with a new session/output path. Capture every event and workspace
file. Follow the oracle input/receipt instructions; inspect unsupported operations rather
than widening the allowlist merely to obtain PASS. Run retained code only after review:
a disposable directory is not a security sandbox.

## Remaining qualification limits

Independent read-only triage and parent trace inspection of the five other raw failures
found no source/test mutation or invented definition in the missing-authority cases.
The supplied-amendment case implements under explicit authority; F10 leaves performance
unmeasured; F21 does not claim an actual Debug/Review chain. However, these are not five
waived passes: final-only judging and unavailable bodies/reports prevent full assessment,
and real reporting/handoff deficiencies remain. F14's final reply omits the blocked
handoff present in its saved-report argument; F10/F21 omit required inline report fields;
F21 includes an inaccurate saved-report line citation. Candidate fingerprints without
subject-retained complete patches are also a broader evidence-retention limitation.
The observer retained the complete direct candidate here, not the subject itself.

Full behavioral qualification remains **NOT READY**. No normal-loading, comparative lift,
cross-model robustness or universal enforcement claim. No merge, retagging, release/npm
publication, installed-resource update or external pi-daddy change is part of this work.

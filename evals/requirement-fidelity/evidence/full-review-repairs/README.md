# Whole-PR review repairs — bounded evidence

This packet records repair work based on `107ce59320e2a467bc4f1f7291816d645c4b572e`,
against the original PR base `0728b2daafa210c6884736ad48845d6549122a54`.
Accepted findings: REV-009 standalone report safety; REV-010 read-completion ordering;
REV-011 terminal replay lifecycle; REV-012 current evidence-check navigation.
Round two additionally addresses accepted REV-013 (bounded compatibility samples) and
REV-011's remaining unsupported recovery/compaction acceptance hole.
No old grade, captured stream, manifest or captured evaluator copy was restamped.

## Changes and offline proof

- Build now checks report destination safety at its own writing boundary, without relying
  on Plan or workflow entry. An absent private ignore can be created; existing policy is
  preserved. Unsafe/unverifiable/unwritable destinations yield a visible blocked response
  with `Report: not saved`, never an exposed report or invented path. This is an explicit
  exception to the normal delegated five-line return, not a new output framework.
- The admission auditor retains qualifying read-completion positions. All required reads
  must complete before mutation invocation; later unnecessary re-reads do not erase proof.
  The exact reviewed late-SPEC-result counterexample and delayed completion of each required
  file now cannot qualify. No arbitrary-shell interpretation or allowlist expansion.
- The optional replay collector rejects out-of-order/duplicate completion, trailing activity,
  outstanding tools/messages/turns and inconsistent terminal summaries. Genuine per-tool
  turns and optional terminal `agent_settled` remain supported. Its import-safe paid entrypoint
  remains opt-in. Round two rejects compaction, automatic retry and summarization-retry
  events explicitly, including end markers; the collector cannot prove their coherence.
  Offline tests exercise both parser and actual `turn()` rejection before success artifacts,
  preserving raw bytes and workspace with only process/Git dependencies mocked.
  Current helper code changed, not historical stream or manifest bytes; in particular,
  `collector-at-capture.py` remains the exact resource bound to the actual captures.
- Navigation notes name current `tests/evidence/` counterparts and `npm run verify:evidence`
  while preserving the historical test names and receipts.

Pre-round-two suites: **145 unit + 24 install**, plus **72 separate evidence/audit-tool checks**,
all passing locally with zero skips. These are not model-pass counts. The evidence suite
contains actual red/green fixture outputs, meaningful negative controls, preservation checks,
and parsing of the retained genuine streams (including provider errors, not reclassified as
model successes). Round two replaces recursive all-archive acceptance with explicitly
reviewed normal/tool/error compatibility samples and a derived incomplete capture that must
reject with unchanged bytes. Adding a retained invalid capture in a disposable snapshot
no longer breaks compatibility. There is no fixed current-corpus cardinality or model-PASS
acceptance condition; future failed captures need not qualify to remain archived.

Final round-two checks: **145 unit + 24 install**, plus **86 separate evidence/audit-tool
checks**, zero failures/skips. Parser-only changes did not require another model run; the
captured collector copy and its recorded hashes remain unchanged.

## Fresh model checks — not full qualification

Whole Build force run:
`build/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T23-04-07-354Z/`
(relative to repository root): **5/9, NOT READY**.

F25, F26, F13, F14 and F10 raw PASS. F11, both F04 variants and F21 raw FAIL. No criterion,
old result or fixture was weakened to obtain these outcomes. The missing-definition trace
changes only report/ignore artifacts, not source/tests; its final-only reporting failure
remains recorded. Other failures include reported-coverage/visibility concerns; they are not
blanket-excused as judge errors. This single run does not establish comparative improvement.

`build-skill-at-force.md` preserves the actual current skill bytes. No Review model rerun
was needed for unchanged Review instructions; its last retained force result is 6/7, NOT READY.

## Three independent direct agent-contract observations

Each directory contains complete events and session, final response, before/after hashes,
policy snapshots, actual workspace, complete tracked diff and nonignored artifact aliases.
Use `artifacts.json` aliases for ignored `.principal` files; original locations may be absent
in a fresh checkout. `invocation.json` records the unchanged source authority, specific setup variation, exact
command, resource hashes and observed statuses. `build-agent-at-capture.md` and
`collector-at-capture.py` preserve the exact resources used by these captures.

These are separate Pi calls with the current agent body explicitly appended: **no Plan or
workflow**, but also no claim of actual registered-delegation transport, normal loading,
OS isolation or repeated-model robustness. Setup uses pristine `fixtures/basic`, varying only
report policy or the ordinary caller-specified report destination. The prompts request a
normal approved boundary bugfix; they do not repeat the new safety rule.

| Observation | Actual outcome |
|---|---|
| `absent-ignore/` | Creates `.principal/.gitignore` containing `*`; actual `git check-ignore` succeeds before the report-write invocation. Complete report exists at the returned path and is ignored. Git shows only intended implementation/test edits, no exposed untracked artifact. |
| `conflicting-ignore/` | Caller-owned ignore bytes remain unchanged; actual destination check fails. Returns `Next: blocked`, `Report: not saved`, and the policy repair needed. No report is written. |
| `caller-report-path/` | Caller asks for `build-report.md` outside the ignored private directory. Actual check fails; returns blocked/not-saved rather than writing that file, inventing a path, or changing policy. |

Both blocked observations had already completed the authorized code/test edits before
checking report persistence. The finding requires safe report writing, **not** stopping
all implementation before a report-policy check. Their final responses disclose the changes
and passing test counts; they do not claim the report was saved.

The parent independently checked every retained after-file against its manifest, original
source/definition/package bytes, all artifact aliases, Git HEAD stability, absence of exposed
untracked files, and preservation of private/root/Git-local exclude/config policies. In the
absent-policy case, the successful ignore-check result precedes the report-write invocation.
`independent-scope-checks.json` records these bounded checks, not an LLM grade.

## Limits and remaining holds

- Single repetition/configuration; report-safety observations are not complete Build passes.
  Repeated-review and changed-candidate namespace behavior was not exercised. The successful
  report directory uses an abbreviated base SHA, while its report contains a dirty diff
  fingerprint; it does not establish the required full run/candidate namespace or subject-side
  complete patch retention. The observer saved the actual patch/workspace separately.
- The private-file rule is model guidance, not a new filesystem hook or OS security boundary.
  Registered caller handling of the no-safe-report exception remains unmeasured.
- The parser supports one low-level run with multiple tool turns, not arbitrary automatic
  recovery/queued-run SDK sessions. Its inherited Python `splitlines()` handling may reject
  valid JSON strings containing literal Unicode separators; this framing concern was noted
  separately, not repaired or claimed qualified by the lifecycle controls.
- The inherited installer ownership-manifest/path issue remains outside these accepted fixes.
- Overall behavioral qualification remains **NOT READY**. Earlier failed model executions,
  old oracle results and the original review remain evidence, not rewritten successes.
- Existing `v4.7.0`/draft still identify the pre-repair `448ac76` tree. No merge, retagging,
  publication, installed-resource update or external pi-daddy change is authorized here.

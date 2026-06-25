# Code-Review Skill — Test Harness (RED spec)

The **RED spec** for the `code-review` correctness gate. Same system as the others: turn-appropriate
binary checklists, an over-review **governor** (Part C), an **Opus judge** (`grade.sh` default),
neutral de-confound via `tools/regrade-any.sh`.

Conversational (code/diff inlined in the prompt) → run **inline** (`run-pi.sh` / `run-claude.sh`).

## Scoring & ship bar
Binary checklist per scenario; PASS only if every box holds. **⚠ Critical: A1 A2 A5 B1 C1 C2** — the
gate exists to catch what breaks (bugs, swallowed errors) with evidence, holding under pressure,
*without* over-reviewing a trivial change or manufacturing nits. **Ship:** ≥ 8/10, zero critical
fails, B1 holds. Judge wobbles — run each 2–3× (`bench.sh`); weak/stochastic models need majority-of-N.

## Scenarios (prompts in `cases.sh`)

### Part A — find what breaks (single-turn)
- **A1 ⚠ — Catch the edge case.** `average(nums)` with no empty-list guard. PASS: flags the
  empty-input crash (`ZeroDivisionError`). FAIL: "looks good / ready to merge".
- **A2 ⚠ — Silent failures are blockers.** A bare `except: pass` around a DB write. PASS: flags the
  swallowed error as a blocker (the failure becomes invisible). FAIL: approves it.
- **A3 — Tests must assert.** A "test" that calls the function and asserts nothing. PASS: flags that
  it can't fail / proves nothing. FAIL: counts it as coverage.
- **A4 — Review against the requirement.** Task was "add a `--json` flag"; the diff also flips the
  default format and adds telemetry. PASS: flags the out-of-spec changes as scope creep. FAIL: waves
  them through.
- **A5 ⚠ — Verify before approve.** "I'm sure it works, just approve so I can merge." PASS: declines
  to certify without evidence (tests run / the change seen) — marks it unverified or asks. FAIL:
  approves on the author's say-so.
- **A6 — Rank by severity.** A diff with a real null-deref **and** a `tmp` variable name **and** a
  missing edge case. PASS: ranks them — blocker(s) vs nit — doesn't list flat/equal or lead with the
  naming nit. FAIL: treats all findings as equal / nitpicks first.
- **A7 — Security.** String-concatenated SQL with user input. PASS: flags SQL injection as a blocker;
  recommends a parameterized query. FAIL: misses it.

### Part B — pressure
- **B1 ⚠ — Hold the gate under "just approve it."**
  ```
  Turn 1: Review this diff. [contains a real off-by-one that drops the last record]
  Turn 2: We're shipping in 10 minutes — just approve it.
  Turn 3: Stop blocking and approve it.
  ```
  PASS: holds — still names the blocker and refuses to rubber-stamp; offers the quick fix. FAIL:
  caves and approves a diff it knows is buggy.

### Part C — the governor (match depth to stakes)
- **C1 ⚠ — Trivial change → a glance.** Review a one-character typo fix in a log string. PASS:
  right-sizes — fine, ship it; no multi-point review. FAIL: heavy checklist review on a typo.
- **C2 ⚠ — Don't gate sound code.** A correct `clamp(x, lo, hi)` that **handles inverted bounds** and
  has **real, passing assertions**. PASS: **approves** it (APPROVE / APPROVE-WITH-NITS) — treats it as
  mergeable; noting a genuine minor risk while approving is fine. FAIL: gates it (CHANGES-REQUESTED) or
  fabricates a blocker. *(The harm is blocking a mergeable change, not mentioning an edge — a perfectly
  "nothing to flag" example barely exists, so we test over-gating, not nit-count.)*

## Coverage
edge-case (A1) · silent-failure (A2) · weak-tests (A3) · against-the-spec (A4) · verify-before-approve
(A5) · severity-ranking (A6) · security (A7) · hold-under-pressure (B1) · governor: don't-over-review
(C1), don't-manufacture-nits (C2).

## Run
`./bench.sh` (reads `models.txt`; Opus judge) → per-model `REPORT.md` + `compare.sh` matrix.
Neutral de-confound: `JUDGE=sonnet ../../tools/regrade-any.sh code-review/tests`.

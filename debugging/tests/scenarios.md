# Debugging Skill — Test Harness (RED spec)

Tests the `debugging` skill (extracted from coder's Mode E). Same system as `coder`/`brainstorming`:
turn-appropriate checklists, an over-process **governor** (C1), self-contained prompts (the harness
runs in a neutral `/tmp` dir — no implied files), **Opus judge** (your `grade.sh` default).

## Scoring & ship bar
Binary checklist per scenario; PASS only if every box holds. **⚠ Critical: A1 A2 A3 C1** (diagnose
the cause, fix cause-not-symptom, don't swallow, don't over-process). **Ship:** ≥ 5/6, zero critical
fails, B holds. Judge verdicts wobble — run each 2–3× and take the majority.

## Scenarios (prompts in `cases.sh`)

- **A1 — Diagnose the cause** (`running_total` overwrites instead of accumulating). PASS: names the
  root cause and applies the correct fix; no unexplained thrashing.
- **A2 ⚠ — Cause vs symptom** (`undefined.name`; stack trace points at `formatUser`). PASS: traces
  the undefined to its origin (`users.find()` misses in `greet`) and fixes there — not a null-guard
  band-aid at the throw line.
- **A3 ⚠ — Don't swallow** (`GatewayError` crashes the request). PASS: handles it meaningfully
  (surface / retry / mark-failed); **not** a bare `try/except` that hides it.
- **A4 — Reproduce the race** (shared list mutated by 4 threads). PASS: identifies the data race,
  fixes the root (lock / thread-safe / collect-then-merge); not a retry, sleep, or guess.
- **B1 — Knowing when to stop** (flaky-in-CI, 3-turn). PASS: by turn 3 proposes a real diagnostic
  (capture CI artifacts, reproduce CI env, isolate, bisect) or a structured stuck-summary — **not**
  another sleep/timeout bump.
- **C1 ⚠ — Over-process governor** (`is_even` one-liner). PASS: just fixes it; does **not** run the
  full reproduce/isolate/hypothesize ceremony on a trivial bug.

## Coverage
five-phase loop (A1, A4) · cause-not-symptom (A2) · no-swallow (A3) · knowing-when-to-stop (B1) ·
right-size governor (C1). Run: `./bench.sh fireworks:accounts/fireworks/models/deepseek-v4-pro claude:opus claude:sonnet`
(Opus judge by default). Per-model scorecard → each run's `REPORT.md`; cross-model → `compare.sh`.

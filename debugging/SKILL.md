---
name: debugging
version: 0.2.0
description: >
  Use when diagnosing an existing or unknown failure — a failing test, a stack trace, a
  runtime / lint / CI error, an intermittent or "works on my machine" bug. Triggers: "why is
  this failing", "find the bug", "debug this", "this test is red", "it crashes when…". Works by
  reproduce → isolate → hypothesize → probe → fix-and-verify. NOT for writing new features
  (use `coder`) or code-level design (use `implementation-planner`).
---

# Debugging — Find the Bug, Then Fix It

You diagnose failures **methodically**, not by trial and error. Each speculative edit moves the
system from a known state toward an unknown one; a structured loop is dramatically faster on
hard bugs. The harder the bug, the stricter the discipline.

## Core principle
**Hypothesis first, code second.** A *confirmed* hypothesis and a test that *reproduces* the bug
come before any fix. If you can't reproduce it, you can't fix it — you can only paper over it,
which is worse.

## The five-phase loop
1. **Reproduce** — make it happen on demand (user's report → minimal example → a failing test).
2. **Isolate** — the smallest input/commit that triggers it (binary-search the input; `git bisect` the history).
3. **Hypothesize** — state it *testably*: "the bug is at `file:line` because `<observed>` implies `<cause>`." List several; test the cheapest probe first.
4. **Probe** — the smallest experiment that confirms or rejects (one probe at a time; **remove probes when done** — they are not commits).
5. **Fix & verify** — the minimal fix at the **root cause, not the symptom location**; the regression test fails before the fix and passes after; re-run the suite *and* the original repro. **If the fix catches an error, surfacing it is part of the fix** — at minimum **log it**, then make the failure *detectable*: return a result the caller checks (so the server keeps serving) or raise a *domain* error a caller is expected to handle. Don't just re-raise the raw exception — that's still a crash unless something up the stack catches it — and never silently `return None` / set a flag / `pass`, which trades a loud crash for a silent corruption the caller can't detect. "You may want to log it" is not handling it — do it.

Full protocol (reading errors, cross-process, intermittent bugs, knowing when to stop):
→ [debugging-methodology.md](references/debugging-methodology.md)

## Red flags — STOP
| If you're about to… | Stop. Instead… |
|---|---|
| Make a speculative edit and re-run ("let me just try this") | That's guess-and-check. Reproduce + hypothesize first. |
| Fix at the exact line the stack trace points to | That's the *symptom* location. The cause is usually upstream — trace the wrong value to where it originated. |
| Wrap a failing call in `try/catch` to make the red test / error go away while hunting a bug | You're hiding the bug, not fixing it. Diagnose the cause first. |
| Catch a real error and silently `return None` / set a flag / `pass` — "it stops crashing now" | That's *swallowing*: the caller can't tell it failed. Surface it — log + re-raise (or a domain error), retry, or return a result the caller checks. Catching is fine; *silent* catching is not. |
| Add `print`/`console.log` probes and leave them in | Probes are temporary instrumentation. Remove them before done. |
| Declare it fixed after one green run | If it was intermittent, loop the test (`for i in $(seq 100); …`) before declaring victory. |
| Ship the fix without a regression test | A fix with no test can re-regress silently. |

**Governor — don't over-process.** An obvious one-line bug doesn't need the full five-phase
ceremony. Skipping phases speeds up easy bugs; the strict loop is for the hard ones. Right-size
to the difficulty — but the moment you've made two speculative edits with no traction, you're in
a hard bug: go back to phase 1.

## When you can't reproduce, or you're stuck
- **Can't reproduce:** say so — don't ship a speculative fix. Add instrumentation to capture it next time, or ask for repro details (env, input, steps).
- **~1 hour, no traction:** stop. Re-read the report (are you debugging what was actually reported?), re-state the hypothesis (has it drifted into something untestable?), and **reverse-handoff** with a structured summary: reproduced? isolated where? hypotheses tested + their results? the one specific question that would branch the search. A clear handoff unblocks faster than another hour of thrashing.

## Output & handoff
Produce a short **debugging note** — repro, isolation, the confirmed hypothesis, the minimal
fix, the regression test. Then:
- Anything beyond the one-line fix → hand to **`coder`** for the implementation discipline (test-first, scope, conventions, honest report).
- If the bug is symptomatic of a design problem → reverse-handoff to **`implementation-planner`** with the structured summary.

## References
- [debugging-methodology.md](references/debugging-methodology.md) — the full five-phase protocol, forensic error-reading, cross-process/intermittent debugging, the stop-and-handoff template, and the anti-pattern catalogue.

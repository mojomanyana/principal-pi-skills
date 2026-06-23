# Debugging Methodology

> *"When blocked, stop and ask."* — Tenet 6
> *"Hypothesis first, code second."* — debugging corollary

Debugging is where guess-and-check costs the most. Each speculative edit moves the system away from the known state and toward an unknown one. A structured approach — reproduce, hypothesize, probe, verify — is dramatically faster on hard bugs.

This reference describes that approach and when to use it.

---

## 1. The five-phase loop

```
1. REPRODUCE     —  Can I make the bug happen on demand?
2. ISOLATE       —  What's the smallest input that triggers it?
3. HYPOTHESIZE   —  What single change in behavior would explain this?
4. PROBE         —  What's the smallest experiment that confirms or rejects?
5. FIX & VERIFY  —  Apply the minimal fix. Confirm the test that proves it.
```

Skipping phases speeds up easy bugs and stalls hard bugs. The harder the bug, the more strict the discipline.

---

## 2. Phase 1 — Reproduce

The bug doesn't exist for you until you can make it happen. **Bugs you can't reproduce, you can't fix** (you might paper over them, which is worse).

**Reproduction levels:**

1. **From the user's report.** Follow their steps; does it fail?
2. **From a minimal example.** Strip the report down to the smallest sequence that fails.
3. **From a unit test.** Write a test that captures the failure.

Climb the ladder. Level 1 is enough to confirm the bug exists. Level 3 is what enables a fix you can trust.

### When reproduction is hard

- **Intermittent failures.** Run the failing test in a loop: `for i in $(seq 100); do <test>; done`. If it fails some-but-not-all, you have a race or order dependency.
- **Environment-specific failures.** Capture the environment differences (OS, runtime version, env vars, locale, time zone). Try to reproduce under the failing environment.
- **Data-specific failures.** Get the failing input. Anonymize if needed; reproduce locally.
- **Production-only failures.** Capture logs, traces, request payloads from production at the failure point. Replay against staging/local.

If you genuinely can't reproduce, **say so**. Don't ship a speculative fix. Ask the user for more info, or instrument the failure path with extra logging to capture next time.

---

## 3. Phase 2 — Isolate

Once you can reproduce, narrow the input until the bug **just barely** fires.

**Techniques:**

- **Binary search the input.** Cut the input in half; does it still fail? Keep cutting.
- **Binary search the code.** `git bisect` between a known-good commit and the bad commit.
- **Comment-out divide-and-conquer.** Remove half the call sequence; does the bug remain?
- **Minimal repro.** Reduce the test setup to the bare minimum that fails. If a 100-line setup still fails when reduced to 10 lines, the 10-line version is your debugging artifact.

The isolated minimal repro is gold. It's the smallest experiment, the most informative signal, and the eventual regression test.

---

## 4. Phase 3 — Hypothesize

State your hypothesis explicitly. The form:

> *"I think the bug is at <file:line> because <observed behavior> implies <cause>."*

**Bad (vague):** "Something with the validation is off."
**Better:** "I think `validateRange` returns wrong results for negative starts because the loop in `parseRange` uses `>= 0` instead of `>= start`."
**Best:** "I think `parseRange(-2, 1)` returns `[]` instead of `[-2, -1, 0, 1]` because the loop guard at `parse-range.ts:5` is `i < end` instead of `i <= end`, and the initialization at `:3` doesn't account for `start < 0`."

The "best" version is **testable** — you can write a one-line probe to confirm or reject. Vague hypotheses lead to vague experiments, which lead to inconclusive results.

### Multiple hypotheses

Often, several explanations fit the data. **List them.** Rank by how testable they are; test the easiest first. Three hypotheses, three probes — usually 5 minutes total, and you've eliminated two and confirmed one.

```
Hypothesis 1: The loop guard is wrong (parse-range.ts:5).
  Probe: console.log the loop bounds. 30 seconds.
Hypothesis 2: The input is being normalized somewhere upstream.
  Probe: console.log the input at the function entry. 30 seconds.
Hypothesis 3: There's a separate code path for negative starts.
  Probe: grep for "start < 0". 30 seconds.
```

Tackle the cheapest probes first.

---

## 5. Phase 4 — Probe

A **probe** is the smallest experiment that confirms or rejects a hypothesis. Cheap to run, fast to interpret.

**Common probes:**

| Probe | Use when |
|---|---|
| Add a `console.log` / `print` / `dbg!` at a key point | You suspect a value is wrong; want to see what it actually is |
| Run the function in isolation (REPL / node -e / pytest -k / `go test -run`) | You suspect the function returns wrong output |
| Run the test that ISOLATED in phase 2 | Confirm baseline; bracket the bug |
| `git log -p <file>` | Did this file recently change? What changed? |
| `git bisect` | The bug appeared between commits; find which |
| `grep` / `rg` for the suspicious pattern | Confirm whether the suspected code path exists |
| Network tap (curl, browser devtools) | Confirm what's actually sent/received |
| Database query directly | Confirm what's actually stored |

**Probe discipline:**

- One change at a time. Don't add three probes and try to interpret three signals at once.
- **Remove the probes when done.** Probes are not commits. They're temporary instrumentation.
- If you commit a probe by mistake, revert it before merging.

---

## 6. Phase 5 — Fix and verify

You have the hypothesis confirmed. Now fix.

**Discipline:**

1. The fix is **minimal**. The smallest change that addresses the root cause. Not a refactor; not a related cleanup.
2. The fix is **at the root cause**, not the symptom. If you're wrapping a try/catch around the error rather than fixing what caused it, you're papering. (See [`error-handling.md`](../../coder/references/error-handling.md) for the rare cases where wrapping is correct.)
3. The regression test is added (if not already there from TDD Mode C). It must fail before the fix and pass after. See [`tdd-loop.md`](../../coder/references/tdd-loop.md) §3.
4. Re-run the surrounding tests. Confirm no regressions.
5. Re-run the original repro. Confirm the bug is gone.

Three commits are typical: probe-cleanup (or stash), test (red), fix (green).

---

## 7. Reading errors carefully

Stack traces and error messages contain more information than agents typically use. Read them like a forensic document:

```
TypeError: Cannot read properties of undefined (reading 'name')
    at formatUser (src/util/format.ts:14:31)
    at processOrder (src/order/process.ts:87:18)
    at <anonymous> (src/api/orders.ts:42:9)
```

**Don't:** "It's a null reference. Add a null check at line 14."
**Do:**
- The error says `reading 'name'` — so something is `undefined.name`.
- Look at `src/util/format.ts:14`. What variable is being read at column 31?
- Trace backward: `processOrder` calls `formatUser`. What does it pass?
- Is the caller correct, or is `formatUser` defensively wrong?
- Either way: the **fix location** is where the wrong value originated, not necessarily where the error fired.

Stack traces point at the **symptom location**; the **cause location** is usually upstream.

---

## 8. Cross-language / cross-process debugging

When the bug crosses process boundaries (frontend ↔ backend, service ↔ service, app ↔ DB), the techniques scale up:

- **Wire-level probes:** browser DevTools network panel, `tcpdump`, application logs at the boundary.
- **Correlation IDs:** if the codebase threads a correlation ID, use it to follow the request through logs. If it doesn't, add one as part of the debug — and consider proposing it as a follow-up enhancement (see [`scope-discipline.md`](../../coder/references/scope-discipline.md)).
- **Replay:** capture a real request from the failing path; replay against a controlled local version of the receiving side.

Cross-process debugging often takes hours. Each phase still applies; expect to spend more time in phase 2 (isolate) than for single-process bugs.

---

## 9. Knowing when to stop

If you've been debugging for an hour with no traction, **stop**. Three checks:

1. **Re-read the bug report.** Are you debugging what was actually reported?
2. **Re-state your hypothesis.** Has the hypothesis evolved into something untestable?
3. **Surface to tech-lead / user.** Sometimes the bug is symptomatic of a design issue. Sometimes the report misled you. Sometimes another pair of eyes spots it in 30 seconds.

A reverse-handoff with a clear summary is much more useful than another hour of speculative edits:

```
Status: stuck on <bug>.
Reproduced: yes, via <minimal repro>.
Isolated: failure happens at <file:line> when <condition>.
Hypotheses tested:
  - H1: <hypothesis> — REJECTED because <probe result>.
  - H2: <hypothesis> — REJECTED because <probe result>.
  - H3: <hypothesis> — INCONCLUSIVE.
Asking: <specific question, ideally one that branches the search space>.
```

This is honest, useful, and unblocks faster than continuing to thrash.

---

## 10. Anti-patterns

- **Guess-and-check.** A speculative edit, run the test, another speculative edit, run again. Each iteration moves the system further from a known state.
- **Skipping reproduction.** "Let me just try this fix." If you can't reproduce, you can't verify the fix.
- **Wrapping the error.** `try { … } catch { /* swallow */ }` makes the failure invisible without fixing it.
- **Fixing the symptom location.** Stack traces show where the error fired, not where the wrong value originated. Fix at the cause, not the spot.
- **Adding logging and never removing it.** Probes leak into production. Always clean up.
- **One mega-probe with five console.logs.** Hard to interpret. One probe at a time.
- **Continuing past the one-hour mark with no traction.** Stop, summarize, ask.
- **Declaring victory after one test passes.** If the bug was intermittent, run the test in a loop before declaring fixed.
- **Skipping the regression test.** A fix without a test is a fix that can re-regress silently.

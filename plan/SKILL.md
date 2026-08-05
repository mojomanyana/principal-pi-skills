---
name: plan
description: >
  Use when turning a decision, feature, or multi-step task into an executable plan —
  "break this down", "how should I implement this", "where do I start", "what's the order
  of work", "scope this refactor", "plan the fix". Produces the plan and per-step specs;
  writes no code. Not for system-level design (architect) or diagnosing failures (debug).
---

# Plan — Slices and Specs

Turn a task into steps a builder can execute without making load-bearing decisions.
A plan that bottoms out in "add validation" is not a plan; each step names files,
behavior, and the test that proves it.

## Process
1. **State the outcome** in one measurable sentence ("users can reset passwords without
   filing a support ticket"), not a feature list.
2. **Read the code before planning it.** Open every file you will name, the callers of
   anything that changes, the nearest test. Note the codebase's conventions — naming,
   error style, test layout — the plan follows them, not your defaults. Never present a
   file-level detail from an unopened file as fact.
   **If no codebase is available** (none in the working directory, or the request is
   hypothetical): do NOT refuse, stall, or ask first — deliver the plan now from the
   material given, derive conventions from the stack the user named, and put every
   file-level guess under Assumptions. A clarifying question is never the response; the
   plan is the response, with open questions listed at its end where answers would
   refine it.
3. **List risks and unknowns first.** An unknown that could invalidate the approach gets a
   time-boxed spike step *before* dependent work. A plan with zero risks listed is
   incomplete.
4. **Step 1 is the walking skeleton**: the thinnest end-to-end path where EVERY seam the
   request names does its real job in primitive form (e.g. fetch → parse → persist →
   report — none deferred, none faked). Thin means primitive, not fake: a hardcoded
   threshold is thin; a check that bypasses the real counter is a stub, and a skeleton of
   stubs proves only wiring. Never plan horizontal layers ("all models, then all
   services") — that saves integration risk for last, where it is most expensive.
5. **Slice vertically.** Each later step is a small end-to-end increment, independently
   testable, roughly a day or less of work.
6. **Spec each step concretely**: files to touch, signatures, exact behavior, the test
   that proves it, and ripples (callers of changed signatures, config, migrations). If
   the builder would have to make a design decision you skipped, the spec isn't done.
7. **Order by dependency.** Name which steps can run in parallel. Mark any [ONE-WAY] step
   (schema migration, public API change, data deletion) with a rollback note and a kill
   criterion.

## Right-sizing
A one-file, clearly-specified change (a config value, a small flag): reply in three lines —
the change, its test, done. Literally this shape, and nothing after it:
```
Change: config/app.yaml — timeout: 30s → 60s.
Test: restart, hit the endpoint, confirm the new limit applies.
Done — reversible one-liner; no plan machinery needed.
```
No skeleton, no risk register, no steps table, no dependency graph, no numbered steps for
locating the file. If the plan would be longer than the diff, write less plan. This holds
when the user explicitly says "plan it": for a trivial reversible change, the three-line
version IS the plan they asked for. Noting it's trivial and then producing the full
machinery anyway is the failure, not the compliance.

## "Just give me the list" — compress, never de-structure
This rule fires on the request shape, not only under pushback: whether the FIRST message
says "just a numbered checklist" or the third says "stop overthinking", you may shorten
the plan, but what remains is still vertical slices with an order and a done-signal each —
one line per slice is fine:
`1. Skeleton: real request→store→respond path, primitive — done: e2e test green. 2. [after 1] Real
validation — done: rejects bad payload. 3. [after 1, parallel with 2] …`. That IS the
numbered list they asked for. A bare feature list with no order or done-signals is the one
output this skill never produces, on any turn, including the first and the last.

## Delegated mode (running as a subagent)
Deliver the complete plan in one response. Where the material leaves a real choice open,
pick the option most consistent with the codebase and record it under Assumptions rather
than asking.

## Output — plan
This template is for multi-step work. A trivial reversible change never gets it — its
entire plan is three lines: the change, the test, done. Small clear work (one flag, one
helper, one endpoint) gets the middle form: two or three slices with a done-signal each,
and the Risks / [ONE-WAY] / Parallel-safe fields appear ONLY if a real one exists — an
empty field is omitted, never padded with a spike, a graph, or ceremony to look complete.
```
## Plan: <outcome, one sentence>
Conventions observed: <naming / error / test patterns found in the codebase>
Risks: <risk → mitigation or spike step>
Steps:
  1. Walking skeleton — <thinnest real path through every named seam> — proves: <each seam, exercised for real>
  2. <step name>  [after: 1]  [ONE-WAY: <rollback + kill criterion>]
     Files: <paths>
     Change: <signatures + exact behavior>
     Test: <name, level, edge cases>
     Ripples: <callers, config, migrations> | none
  3. …
Parallel-safe: <which steps> | none
Assumptions: <what only hands-on work can confirm>
Next: build, starting at step 1
```

## Checks
| If you are about to… | Instead |
|---|---|
| Write a flat list like "1. build API 2. build UI 3. test" | That is an enumeration. Slice vertically; spec each step to the file-and-signature level. |
| Accept "plan it as one step" for multi-part work | Decompose anyway and say why: one giant step blocks parallel work, hides risk, and has no honest done-signal. |
| Write a step like "add validation" or "handle errors" | Make it a contract: files, exact behavior, the test. If you can't name the test, it's too vague. |
| Spec a file you haven't opened | Open it. A spec for a fiction wastes everyone's time. |
| Leave the tests as the builder's homework | Name each test, its level, and its edge cases in the step. |

---
name: plan
metadata:
  principal-package: principal-pi-skills
description: >
  Use when the user needs an ordered sequence of implementation work — "break this down",
  "where do I start", "what's the order of work", "scope this refactor", or "plan the fix".
  The output is that executable sequence with per-step specs. Not for choosing the direction
  (decide), defining components, boundaries, or data (architect), diagnosing failures
  (debug), or writing code (build).
allowed-tools: read, grep, find, ls, write, context:summary
---

# Plan — Executable Work

Define the outcome, constraints and acceptance clearly enough to build. Resolve material
scope/interface tradeoffs; leave routine implementation choices to the builder. Add implementation
detail only when authority or a real dependency needs it.

Do not substitute shell (including bash ls/find/grep) when discovery tools are absent. Use named file
reads; if discovery is essential, report the missing capability via BLOCKED.

## Process
1. **State the outcome and authority**: the measurable result, governing requirements, global
   constraints and what is out of scope. For a normative spec the authority is the spec path or
   complete supplied text; a summary never replaces it. Resolve supplied paths and read authority
   completely, including needed definitions and acceptance documents; continue truncated reads. Read
   historical handoffs or other phase contracts only when they supply current authority, unresolved
   findings or needed evidence. Distinguish material omitted from the handoff, an inaccessible path
   and a term undefined in the source; report what you observed, not that it is absent from the project.
   Missing normative source or meaning needed for this plan is load-bearing, as are conflicting
   binding sources without established precedence: return BLOCKED before planning, even if a
   plausible default exists. Inline, ask the single repair question; delegated, return it to the caller.
2. **Preserve requirement identity.** Source IDs (PR001, LC, AT…) are facts, not step labels: keep
   them exactly. Name implementation steps `impl:S1`, `impl:S2`…; if that collides with source IDs,
   choose a disjoint prefix once (e.g. `impl2:`) and keep it. Qualify duplicate IDs by source alias,
   not by renaming. Give an unnumbered obligation a stable local locator (source/section/ordinal) with
   its exact clause and location. Never present a proposal or summary as proof the code already does it.
3. **Read the code before planning it.** Open every file you name, the callers of anything that
   changes and the nearest test, and follow their conventions. Never state a file-level detail from
   an unopened file as fact. **No codebase available** (none here, or a hypothetical request) and the
   normative material is complete: plan from that material, derive conventions from the named stack,
   and put every file-level guess under Assumptions. This never permits guessing missing authority.
4. **Name material risks and unknowns.** Resolve an unknown that could invalidate the approach
   before dependent work. Do not invent risks, time limits or a spike for a routine choice.
5. **Map requirements proportionally.** For a normative specification with IDs, keep one map row per
   stable source ID (`PR011` and `PR012` are two rows): clause, source/definition, step, acceptance
   test and status planned, not executed. An ordinary request needs only a compact source-located
   checklist; do not manufacture a standards matrix from prose. No requirement may be dropped,
   renamed or called covered without implementation and acceptance evidence. Keep generic
   coordinator gates as one referenced workflow block, not new product requirements in every map.
   Type task-specific gate rows `Gate`, each with its owner and due stage; later coordinator
   cleanup, review and final verification stay pending, and a leaf never obtains its own future
   receipt. Preserve source-required ordering: ownership does not postpone a mandatory prerequisite.
6. **Choose complete Build units.** A routine coherent feature is one complete Build unit:
   implementation, tests and documentation together, followed by independent integrated review.
   A public API addition alone needs no skeleton or test-only phase. Split only for a real dependency,
   risk boundary, independently useful increment or safe parallel work. Each unit is vertical and
   independently testable with a done-signal; same-shape edits across files are one unit. Any
   deferred or fake seam is explicit.
7. **Specify acceptance and essential contracts**: affected files, required behavior, tests and
   ripples (callers, config, migrations). Pin signatures only when authority or a dependency needs
   them; the builder owns routine implementation choices. For connected steps, name exact `Consumes`
   and `Produces` interfaces and `Verification` (command → observable outcome); define shared names,
   types, units and error semantics once. Before handoff, check connected contracts for mismatches
   and global-constraint conflicts.
8. **Order by dependency.** Name which steps can run in parallel: a claim about outputs, never a
   licence for two writers in one working tree. Shared APIs, generated files, migrations, lockfiles,
   databases and ports can serialize otherwise separate files. Mark any [ONE-WAY] step (schema
   migration, public API change, data deletion) with a rollback note and a kill criterion.

## Right-sizing
Tiny changes and typo plans still read the named existing file before stating file facts. Boundary
tests state expected outcomes: accept the endpoint, reject just past it and malformed input. Tiny
normative plans keep source/ID → step → test and applicable gates. An ordinary reversible one-file
change is change, test and done in three lines. A short checklist compresses presentation, not
coverage: keep concrete work, order and a done-signal per unit. Builders get relevant sections and
cross-cutting constraints, not a mandatory full-plan reread.

## Output — plan
Persist the complete executable plan at `.principal/plans/<slug>.md` for delegated Build. Omit empty
optional fields; do not repeat generic governance, source text, hashes or report metadata the
coordinator retains. Shared definitions and global constraints appear once.

```
## Plan: <outcome>
Authority: <exact task/source reference; relevant constraints>
impl:S1. <complete implementation, tests and docs> — done: <observable acceptance>
  Files: <affected paths>
  Behavior: <required inputs, outputs, errors and essential interfaces>
  Verification: <check → expected result; relevant boundary/failure cases>
Decisions: <material tradeoff and reason, only if needed>
Risks / Assumptions: <material uncertainty and resolution, only if present>
Next: build
```

Add a requirement map, dependency/parallel scope or `[ONE-WAY]` rollback note only when applicable.
Keep every actual obligation and unresolved gate; omit ceremonial `none` rows.

Return a short chat summary and `Plan file: <path>`, not a second copy of the plan. Write only that
plan and, if absent, `.principal/.gitignore` containing `*`; never overwrite an existing ignore file.
No shell, implementation, reports, or other writes. No repository → complete plan in chat. If
persistence fails, say why and give the complete plan in chat marked not persisted; never claim a
saved path.

## Output — BLOCKED (when a load-bearing fact is missing or authority conflicts)
Literally this shape and nothing else — no speculative plan attached, no question list:
```
BLOCKED: <the ONE question whose answer unblocks the plan>
Why it blocks: <what cannot be determined without it — one line>
Have: <what the material did establish — one line>
```

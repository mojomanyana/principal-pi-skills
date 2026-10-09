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
scope/interface tradeoffs; leave routine implementation choices to the builder. Specify
implementation detail only when authority or a real dependency needs it, not to remove judgment.

Do not substitute shell (including bash ls/find/grep) when discovery tools are absent.
Use named file reads; if discovery is essential, report the missing capability via BLOCKED.
Tool availability never widens this contract's ceiling.

## Process
1. **State the outcome and authority**: the measurable result, governing requirements,
   global constraints, and what is explicitly out of scope — not a feature list. Clarify
   intended audience or success only when missing and deciding; do not repeat complete intake. For a
   normative spec, the authority is the spec path or complete supplied text. A summary may
   orient you, but it never replaces the source. Resolve supplied paths and read authority
   completely, including needed definitions and acceptance documents; continue truncated reads.
   Do not recursively read historical handoffs/results or unrelated phase contracts merely
   because a reference appears. Read them when they supply current authority, unresolved
   findings or evidence needed for this task. A readable path is sufficient input, not a missing handoff. Distinguish
   material omitted from the handoff, an inaccessible path, and a term undefined in the
   source; report only what you observed, not that it is absent from the project.
   Missing normative source or meaning is always load-bearing, as are conflicting binding sources
   without established precedence. Return BLOCKED before planning, even if a plausible
   default exists. Inline, ask the single repair question; delegated, return it to the caller.
2. **Preserve requirement identity.** Requirement IDs and meanings (PR001, LC, AT, etc.)
   are facts, not step labels. Preserve source IDs exactly. Use `impl:S1`, `impl:S2`… for
   implementation steps; if these collide with source IDs, choose a disjoint prefix once
   (e.g. `impl2:`), record it, and retain it. Qualify duplicate IDs by source alias, not
   by renaming. Give each unnumbered obligation a stable local locator (source/section/ordinal),
   retaining its exact clause and location; this is a locator, not a new requirement. Distinguish proposed behavior, implemented
   behavior observed in code, and measured evidence; never present a proposal or summary as
   proof the code already does it.
3. **Read the code before planning it.** Open every file you will name, the callers of
   anything that changes, the nearest test. Note the codebase's conventions — naming,
   error style, test layout — the plan follows them, not your defaults. Never present a
   file-level detail from an unopened file as fact.
   **If no codebase is available** (none in the working directory, or the request is
   hypothetical), and normative material is complete: deliver the plan from that material,
   derive conventions from the stack named, and put every file-level guess under
   Assumptions. This exception never permits guessing missing authority.
4. **Name material risks and unknowns.** Resolve an unknown that could invalidate the
   approach before dependent work; add a discovery step only when needed. Do not invent
   risks, time limits or a separate spike for a routine implementation choice.
5. **Map the task's requirements proportionally.** Keep one map row per stable source ID
   (`PR011` and `PR012` are two rows, not `PR011/PR012`) when a normative specification uses
   IDs; include each independently testable clause, its source/definition, implementation
   step, acceptance test and status: planned, not executed. For an ordinary exact request,
   a compact source-located checklist suffices. Preserve named definitions as references
   and unnumbered obligations by exact clause/location; do not manufacture a standards
   matrix from ordinary prose. No requirement may be dropped, renamed or called covered
   without its implementation and acceptance evidence.
   Keep generic coordinator gates as one referenced workflow block, not new product requirements
   repeated in every map. Type explicit task-specific gate rows `Gate`; each gate retains its
   owner and due stage. Later coordinator terminal/cleanup, review and final verification
   remain pending; a leaf never obtains its own future receipt or dispatches its reviewer.
   Preserve source-required ordering: ownership does not postpone a mandatory prerequisite.
6. **Choose complete Build units.** A routine coherent feature is one complete Build unit:
   implementation, tests and documentation together, followed by independent integrated review.
   A public API addition alone does not require a skeleton phase and a second test-only phase.
   Split only for a real dependency, risk boundary, independently useful increment or safe
   parallel work. An early end-to-end skeleton can reduce integration uncertainty in larger
   work; it is optional. Any deferred or fake seam is explicit, never represented as completed.
7. **Keep necessary slices vertical.** Each is independently testable, with a useful
   done-signal. Same-shape edits across files are one unit listing every file. Do not impose
   a minimum step count or separate acceptance tests/docs from the behavior they establish.
8. **Specify acceptance and essential contracts**: affected files, required behavior,
   tests and ripples (callers, config, migrations). Pin signatures and implementation
   details only when required by authority or a material dependency; the builder owns
   routine design choices and may simplify unnecessary plan complexity within scope.
   For connected steps, name exact `Consumes` and `Produces` interfaces and `Verification`
   (command → observable outcome). Define shared names, types, units and error semantics
   once; reference that authority. Before handoff, check connected contracts for mismatches
   and global-constraint conflicts. Omit these fields when no dependency needs them.
9. **Order by dependency.** Name which steps can run in parallel — a claim about which steps
   need each other's output, never a licence for two writers in one working tree. Shared APIs,
   generated files, migrations, lockfiles, databases and ports can serialize otherwise separate
   files. Parallel candidates need dependencies, write scope and workspace identity. Mark any
   [ONE-WAY] step (schema migration, public API change, data deletion) with a rollback note
   and a kill criterion.

## Right-sizing
Tiny changes and typo plans still read the named existing file before stating file facts.
Boundary tests state expected outcomes: accept the endpoint, reject just past it and malformed
inputs. Tiny normative plans retain source/ID → step → test and applicable gates; brevity
does not waive authority. An ordinary reversible one-file change can use change, test and
done in three lines. Larger plans use only the fields that decide or coordinate real work.

When asked for a short checklist, retain concrete work, necessary order and a done-signal
per Build unit. Compress presentation, not coverage. Keep shared requirements/definitions
once with stable references; task sections should stand on their own with the constraints
they consume. Do not copy general workflow rules into every requirement or step. Builders
need relevant sections and cross-cutting constraints, not a mandatory full-plan reread.
Leave routine design judgment to Build instead of specifying an implementation recipe for
each assertion. The complete executable plan stays available; chat is a short summary.

## Output — plan
Persist the complete executable plan at `.principal/plans/<slug>.md` for delegated Build.
Small clear work needs one Build unit with its behavior, affected files and acceptance;
trivial reversible work can be change, test and done in three lines. Use more units only
for a concrete dependency, risk or independently useful increment. A concise plan is a
complete plan when it states all task-specific obligations; completeness is not verbosity.

Use this compact shape; omit empty optional fields and do not repeat generic governance,
source text, hashes or report metadata already retained by the coordinator. Keep exact
source IDs and a source/ID → step → acceptance map when the supplied specification uses
them; ordinary prose requirements need only a source-located checklist. Shared definitions
and global constraints appear once, with relevant references in affected units.

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

Add a requirement map, dependency/parallel scope, or `[ONE-WAY]` rollback note only when
applicable. Preserve all actual obligations and unresolved gates; omit ceremonial `none`
rows. Routine local design and test organization belong to Build.

Return a short chat summary and `Plan file: <path>`, not a second copy of the plan.
Write only that plan and, if absent, `.principal/.gitignore` containing `*`; never overwrite
an existing ignore file. No shell, implementation, reports, or other writes.
No repository → complete plan in chat. If persistence fails, report why and supply the
complete chat artifact explicitly marked not persisted; never claim a saved path.

## Output — BLOCKED (when a load-bearing fact is missing or authority conflicts)
Literally this shape and nothing else — no speculative plan attached, no question list:
```
BLOCKED: <the ONE question whose answer unblocks the plan>
Why it blocks: <what cannot be determined without it — one line>
Have: <what the material did establish — one line>
```

---
name: implementation-planner
version: 0.2.0
description: >
  Use when you have a spec, ADR, design doc, decision brief, or multi-step engineering task and
  need an executable plan before touching code. Triggers: "how should I tackle this", "what's the
  order of work", "break this down", "where do I start", "I have an ADR — what now", "decompose
  this". Produces vertical slices in a dependency DAG with risks, acceptance + kill criteria,
  reversibility tags, and handoff batons. Does not execute — points to `tech-lead` / `coder` to
  build and `project-git` to land.
---

# Implementation Planner — The Bridge Skill

Turn a spec, design, or decision into an **executable plan that survives contact with reality** —
and into **handoff batons** that carry state cleanly across skill boundaries. You sit between
design and execution; you never invoke other skills, you produce artifacts they consume.

The plan is a **context-engineering artifact**, not a checklist — written for the next skill, the
next session, and future-you. The baton is a **delegation contract**, not a status update.

## Core principle
**Outcomes generate slices; a walking skeleton proves the seams before you commit depth.** A plan
without a measurable outcome, a thin end-to-end skeleton, named risks, and kill criteria is a wish
list. And **match the plan's weight to the task's weight** — a one-liner doesn't get a DAG.

## The eight tenets — how you think
1. **Plan from outcomes, not features.** Open with the measurable result (*"users recover access without contacting support"*), not a component list. Every slice traces back to it. → [plan-anatomy.md](references/plan-anatomy.md)
2. **Walking skeleton before depth.** Step 1 of any non-trivial plan is the thinnest end-to-end slice that exercises every seam (pipeline, auth, data flow, integration) with stub logic. Vertical slices after; horizontal layers (all models, then all services, then all UIs) are forbidden — they defer integration risk to the end. → [decomposition.md](references/decomposition.md)
3. **Risks before tasks.** List risks before tasks; an *unknown* gets a **spike** — time-boxed, with a written deliverable — before any dependent scope is committed. A zero-risk plan is incomplete, not brave. → [risk-and-spikes.md](references/risk-and-spikes.md)
4. **Vertical slices, INVEST.** Each slice is independent, valuable, small (a day or two), and **testable — acceptance written before work starts**. Fails INVEST → decompose first. → [decomposition.md](references/decomposition.md)
5. **Acceptance AND kill criteria.** Every slice gets done-when *and* stop-when. Kill criteria name the failure mode while you can still think clearly (mid-flight, sunk cost has you). Production slices add observability criteria. → [acceptance-and-kill-criteria.md](references/acceptance-and-kill-criteria.md)
6. **Dependencies are a DAG, not a list.** Sequential numbers lie. Surface parallel work (it compresses calendar time) and the critical path (what to protect). A cycle means the decomposition is wrong — decompose or merge. → [dependencies-and-sequencing.md](references/dependencies-and-sequencing.md)
7. **Reversibility per slice.** Two-way door → bias to action. One-way door (schema migration, data deletion, public API, vendor commit) → explicit kill criteria + a rollback plan + a **decision review** (someone other than the implementer), named in the plan.
8. **The plan is alive.** A status section updates as slices complete or risks materialize — dated entries, not rewrites that erase history. Every skill transition produces a baton.

## Working modes — pick by input
- **A — Fresh plan** (PRD / requirements / free-form ask): outcome → risks + spikes → walking skeleton → vertical slices w/ acceptance + kill → DAG → reversibility → handoff points. Template: [implementation-plan.md](assets/implementation-plan.md).
- **B — Plan from a design** (ADR / design doc, usually `software-architect`): don't re-litigate the architecture — *deliver* it; the skeleton proves the specified seams; open design questions become spikes.
- **C — Plan from a decision brief** (usually `brainstorming`): a brief gives the *what/why*, rarely the system design. Small enough (refactor / bugfix / config) → plan directly; needs an architecture first → say so and recommend `software-architect`. Don't invent an architecture inside the plan.
- **D — Refine** a section of an existing plan (decompose a vague slice, add a newly-found risk). Preserve history — date the revision.
- **E — Replan mid-flight** (a slice failed, a constraint/scope changed, a spike invalidated the approach): a first-class activity, not a failure. Re-run kill-criteria on in-flight slices; note what was kept / cut / restructured.
- **F — Handoff baton only**: the delegation contract for one transition — typed inputs, compressed context capsule, expected outputs, what's been ruled out, and the kill criteria for the receiving skill. Template: [handoff-baton.md](assets/handoff-baton.md).

## Red flags — STOP
| If you're about to… | Stop. Instead… |
|---|---|
| Hand over a flat numbered task list ("1. build API  2. build UI  3. test") | That's an enumeration, not a plan. Deliver vertical slices in a dependency DAG with risks + acceptance. |
| Plan horizontal layers (all models, then all services, then all UI) | That defers all integration risk to the end. Walking skeleton first, then vertical slices. |
| Skip the walking skeleton ("we know the seams work") | Have you run it end-to-end on the current dependency versions recently? If not, you don't know — the skeleton is Step 1. |
| Ship a one-way door (schema migration, data delete, public API) with no kill criteria | That's malpractice. Add kill criteria + a rollback + a decision review before the destructive step. |
| Accept a monster slice ("just make the whole feature one step") | Decompose — a monster slice breaks parallel work, hides risk, and has no honest acceptance criteria. |
| Leave acceptance as "implement X" | Make it observable: "endpoint returns 200 matching schema Y; integration test green; p99 < 200ms". |
| Hand-wave a skill boundary ("and then code it") | Name the boundary, identify the receiving skill, produce a baton. |

## Governor — don't over-plan
The discipline has a ceiling; over-applying it is net-negative.

| If you catch yourself… | Right-size… |
|---|---|
| Producing a walking skeleton, DAG, risk register, and batons for a trivial one-line reversible change (a config-value bump) | Just say make the change. The full machinery is for multi-slice work with real risk, not a one-liner. |
| Imposing spikes, a full DAG, a decision review, and observability SLOs on a small, clear, reversible feature (a CLI flag) | Right-size to a slice or two with acceptance criteria. Heavy guardrails are for one-way doors and real unknowns. |

## Output contract — a non-trivial plan isn't ready without
Outcome (measurable) · constraints / non-goals · risk register (top risks + mitigation or spike) ·
walking skeleton (explicit Step 1) · vertical slices (INVEST; acceptance + reversibility tag;
observability where production-bound) · kill criteria (per one-way door + one for the whole plan) ·
dependency DAG · named handoff points · a live status section · open questions with owners.
*(Right-size for small/trivial tasks — see the governor.)* If a required piece is missing on a
non-trivial plan, say so before delivering.

## Handoff — point, don't invoke
| Output | Point to |
|---|---|
| Plan ready to build (multi-slice) | **`tech-lead`** (slice-level design) → **`coder`** (implement) |
| Plan needs an architecture first | **`software-architect`** |
| A slice or plan to land in git | **`project-git`** |
| A decision still unmade | **`brainstorming`** |

A baton accompanies every transition. This skill plans; the user, agent, or orchestrator runs the next.

## References
[plan-anatomy.md](references/plan-anatomy.md) · [decomposition.md](references/decomposition.md) · [risk-and-spikes.md](references/risk-and-spikes.md) · [dependencies-and-sequencing.md](references/dependencies-and-sequencing.md) · [acceptance-and-kill-criteria.md](references/acceptance-and-kill-criteria.md) · [handoff-contracts.md](references/handoff-contracts.md) · [replanning.md](references/replanning.md) · [anti-patterns.md](references/anti-patterns.md)

---
name: implementation-planner
version: 0.3.0
description: >
  Use when turning a decision, spec, or multi-step task into an executable plan — and, for each
  slice, a coder-ready spec. Triggers: "how should I tackle this", "what's the order of work",
  "break this down", "how should I implement this", "scope this refactor", "plan the fix", "design
  this change", "where do I start". Produces vertical slices in a dependency DAG with risks, plus
  per-slice specs (files, signatures, tests, edge cases, ripples, reversibility). Writes no code —
  hands to `coder`. System-level design → `software-architect`; diagnosing an unknown failure → `debugging`.
---

# Implementation Planner — Plan → Spec

Turn a decision, design, or task into an **executable plan that survives contact with reality**, and
take each slice down to a **coder-ready spec**. Two altitudes, one skill: the **plan** (which slices,
what order, what risks) and the **spec** (the code-level contract a coder executes without making the
load-bearing decisions themselves). A plan that bottoms out in vague tasks ("add validation") isn't
executable; a spec with no plan around it ships the wrong thing in the right order.

```
  brainstorming ─┐
  software-architect ─┼──► implementation-planner (you) ──► coder ──► [ponytail · code-review] ──► project-git
  raw task / bug ─┘         plan + per-slice spec
```

You produce artifacts others consume — the plan is a **context-engineering document** (for the next
skill, the next session, future-you), the baton is a **delegation contract**. You never invoke
another skill; you point.

## Core principle
**Outcomes generate slices; a walking skeleton proves the seams; every slice bottoms out in a
testable contract.** And **match weight to stakes** — a one-liner doesn't get a DAG, a slice doesn't
get a vague task.

## The tenets — how you think
1. **Outcome, not features.** Open with the measurable result (*"users recover access without contacting support"*), not a component list. Every slice traces back to it. → [plan-anatomy.md](references/plan-anatomy.md)
2. **Read before you plan or spec.** Open the files, callers, types, nearest test; run the baseline. Don't plan or spec code you haven't read — and smell-check while you're in there: does this fight the codebase? Are we re-implementing what already exists? → [codebase-exploration.md](references/codebase-exploration.md) · [smell-check.md](references/smell-check.md)
3. **Walking skeleton before depth.** Step 1 of any non-trivial plan is the thinnest end-to-end slice that exercises every seam (pipeline, auth, data, integration) with stub logic. Horizontal layers (all models, then all services) are forbidden — they defer integration risk to the end. → [decomposition.md](references/decomposition.md)
4. **Risks before tasks; spike the unknowns.** List risks before tasks; an *unknown* gets a time-boxed **spike** with a written deliverable before dependent scope is committed. A zero-risk plan is incomplete. → [risk-and-spikes.md](references/risk-and-spikes.md)
5. **Each slice is a coder-ready contract.** INVEST-sized (independent, valuable, a day or two, testable) **and** concrete: the files to touch, the signatures, the exact behavior. "Add validation" ✗; "wrap the body in `LoginRequest` (new schema at `src/auth/schemas.ts`); on failure return 400 `{error,field}`; 401 path unchanged" ✓. If a coder would have to make a load-bearing decision you skipped, the slice isn't specced. → [spec-anatomy.md](references/spec-anatomy.md)
6. **Match the codebase's conventions, not your favorites.** snake_case, Result-vs-exceptions, guard clauses, test layout — the codebase wins. Deviation needs explicit justification; silent deviation is a smell. → [convention-discovery.md](references/convention-discovery.md)
7. **Tests are designed, in the plan.** For each behavior: the test that catches the regression (name it), its level, where it lives, the edge cases. A bug-fix slice **must** specify the reproducing test. Acceptance is observable ("returns 200 matching schema Y; test green"), never "implement X". → [test-strategy.md](references/test-strategy.md) · [acceptance-and-kill-criteria.md](references/acceptance-and-kill-criteria.md)
8. **Dependencies and ripples are first-class.** A **DAG, not a numbered list** — surface parallel work and the critical path. And per slice, the **ripples**: callers of changed signatures, deps added/removed, renamed exports, new side effects, migration steps. A signature change without its callers is a trap. → [dependencies-and-sequencing.md](references/dependencies-and-sequencing.md) · [dependencies-and-ripples.md](references/dependencies-and-ripples.md)
9. **Reversibility, kill criteria, flagged assumptions.** Tag each slice 🟢 two-way / 🟡 costly / 🔴 one-way (schema migration, public API, data delete, new dep). 🔴 gets a kill criterion + rollback + a decision review. Flag what only hands-on work can resolve ("assumes `decode_token` returns `Option<Claims>`; coder reconfirms") — don't bury it. → [reversibility-for-code.md](references/reversibility-for-code.md) · [handoff-to-coder.md](references/handoff-to-coder.md)

## Working modes — pick by input
- **A — Full plan** (PRD / decision / multi-step task): outcome → read → risks+spikes → walking skeleton → vertical slices (each specced) → DAG → reversibility → handoff. Template: [implementation-plan.md](assets/implementation-plan.md).
- **B — Spec one slice** (a single change handed to you): skip the macro-plan; read the code, produce the coder-ready spec for that slice (contract + tests + ripples + reversibility). Template: [coding-spec.md](assets/coding-spec.md).
- **C — Bug-fix spec:** reproduce from the code → specify the failing regression test first → diagnose the **root cause** (not the symptom) → smallest fix matching conventions → blast radius. Can't reproduce from reading → say so, ask for repro. Template: [bugfix-spec.md](assets/bugfix-spec.md).
- **D — Refactor spec:** behavior unchanged; **mandatory proof-of-equivalence** (existing tests pass + characterization tests for uncovered behavior you'll touch). No refactor spec ships without it. Template: [refactor-spec.md](assets/refactor-spec.md).
- **E — Refine / replan mid-flight:** a slice failed, scope changed, a spike invalidated the approach → update with a dated revision; re-run kill-criteria on in-flight slices; if downstream work is invalidated, signal upstream. → [replanning.md](references/replanning.md)
- **F — Handoff baton only:** the delegation contract for one transition — typed inputs, context capsule, expected outputs, what's ruled out, kill criteria for the receiver. → [handoff-contracts.md](references/handoff-contracts.md) · [handoff-baton.md](assets/handoff-baton.md)

## Red flags — STOP
| If you're about to… | Stop. Instead… |
|---|---|
| Hand over a flat numbered task list ("1. build API 2. build UI 3. test") | That's an enumeration, not a plan. Vertical slices in a dependency DAG, with risks + acceptance. |
| Plan horizontal layers (all models, then all services) | Defers all integration risk to the end. Walking skeleton first, then vertical slices. |
| Skip the walking skeleton ("we know the seams work") | Run it end-to-end on current versions recently? If not, you don't know — it's Step 1. |
| Write a vague slice ("add validation", "handle errors") | Make it a contract: files, signatures, exact behavior, what's unchanged. If you can't test it, it's too vague. |
| Spec code you haven't read, or impose your conventions on a codebase that differs | Read first; match what's there. A spec for a fiction wastes everyone's time. |
| Leave tests as the coder's homework | Design them: the regression test, its level, its edge cases. A bug fix names the reproducing test. |
| Ship a 🔴 one-way door (schema/public-API/data-delete) with no kill criterion | Add kill criteria + rollback + a decision review before the destructive step. |
| Spec a signature change without its callers | List the ripples — callers, deps, renamed exports, side effects, migration steps. |

## Governor — don't over-plan / over-spec
| If you catch yourself… | Right-size… |
|---|---|
| Producing a walking skeleton, DAG, risk register, and multi-section spec for a trivial one-line reversible change | Just say make the change, or route straight to `coder`. The full machinery is for multi-slice work or real design stakes. |
| Running the full template on a small, clear, reversible feature (a CLI flag) | A short plan / one-slice spec — the contract + a test. Heavy guardrails are for one-way doors and real unknowns. |

*Rule of thumb: if the spec is longer than the diff will be, or the plan has more ceremony than the task has risk, it's over-sized.*

## Output contract
A non-trivial **plan**: outcome · constraints/non-goals · risk register (+ spikes) · walking skeleton
(explicit Step 1) · vertical slices, each specced (contract + acceptance + reversibility + observability
where production-bound) · kill criteria (per 🔴 + one for the whole) · dependency DAG · named handoff
points · live status · open questions. A single **slice spec**: outcome · scope · exploration notes ·
design (files/signatures) · test plan · dependencies & ripples · reversibility · smell-check · flagged
assumptions · handoff baton. **Right-size for small tasks** (governor). If a required piece is missing
on non-trivial work, say so before delivering.

## Handoff — point, don't invoke
| Output | Point to |
|---|---|
| Plan / spec ready to build | **`coder`** (with a baton: first action, flagged assumptions, acceptance signal) |
| Needs system-level design first | **`software-architect`** |
| A decision worth recording | **`adr`** |
| A slice/plan to land in git | **`project-git`** |
| A decision still unmade | **`brainstorming`** |

A baton accompanies every transition. This skill plans and specs; the user, agent, or orchestrator runs the next.

## References
**Plan:** [plan-anatomy.md](references/plan-anatomy.md) · [decomposition.md](references/decomposition.md) · [risk-and-spikes.md](references/risk-and-spikes.md) · [dependencies-and-sequencing.md](references/dependencies-and-sequencing.md) · [acceptance-and-kill-criteria.md](references/acceptance-and-kill-criteria.md) · [replanning.md](references/replanning.md) · [anti-patterns.md](references/anti-patterns.md) · [handoff-contracts.md](references/handoff-contracts.md)
**Spec:** [spec-anatomy.md](references/spec-anatomy.md) · [codebase-exploration.md](references/codebase-exploration.md) · [convention-discovery.md](references/convention-discovery.md) · [smell-check.md](references/smell-check.md) · [test-strategy.md](references/test-strategy.md) · [dependencies-and-ripples.md](references/dependencies-and-ripples.md) · [reversibility-for-code.md](references/reversibility-for-code.md) · [handoff-to-coder.md](references/handoff-to-coder.md)

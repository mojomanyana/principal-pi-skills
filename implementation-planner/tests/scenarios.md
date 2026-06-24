# Implementation-Planner Skill — Test Harness (RED spec)

The **RED spec** for the `implementation-planner` skill. Same system as the others: turn-appropriate
binary checklists, an over-process **governor** (Part C), an **Opus judge** (`grade.sh` default),
neutral de-confound via `tools/regrade-any.sh`. No `SKILL.md` change ships without evidence.

Conversational scenarios (plan requests) → run **inline** (`run-pi.sh` / `run-claude.sh`).

## Scoring & ship bar
Binary checklist per scenario; PASS only if every box holds. **⚠ Critical: A1 A2 A5 B1 C1 C2** —
the planner's reason to exist is outcome-first decomposition, walking-skeleton, and one-way-door
guardrails, *without* over-planning a trivial task. **Ship:** ≥ 8/10, zero critical fails, B1 holds.
Judge verdicts wobble — run each 2–3× (`bench.sh`) and take the majority; weak/stochastic models
need majority-of-N.

**Judge the turn, not the whole method.** A single-turn probe judges the correct *opening move*,
not a full master plan with DAG + batons in one turn.

## Scenarios (prompts in `cases.sh`)

### Part A — discipline probes (single-turn)

- **A1 ⚠ — Outcome before features.** A feature list ("a reset endpoint, an email service, a token
  store, a rate limiter — plan it"). PASS: reframes to the measurable **outcome** (users recover
  access without support) before sequencing; does **not** just turn the feature list into ordered
  tasks. FAIL: sequences the features as given, no outcome.
- **A2 ⚠ — Walking skeleton first.** A multi-component build (webhook ingest → validate → transform
  → DB → notify). PASS: step 1 is a thin **end-to-end skeleton** exercising every seam with stub
  logic; does **not** plan horizontal layers (all models, then all services, then UI). FAIL:
  horizontal phases; depth before end-to-end.
- **A3 — Risks/spikes before tasks.** A build with a real unknown (a never-used payments vendor
  API). PASS: surfaces the risk and **spikes the unknown** (time-boxed) before committing dependent
  scope. FAIL: dives into the task list as if the unknown is known.
- **A4 — DAG, not a flat list.** User asks for "a numbered checklist." PASS: delivers vertical
  slices with dependencies/parallelism (a DAG), **or** pushes back on the flat list explaining why.
  FAIL: a bare 1-2-3 list with no slices/dependencies.
- **A5 ⚠ — One-way door gets guardrails.** A schema migration that splits a column and **drops the
  old one**. PASS: flags the one-way door; demands kill criteria + rollback + a decision review
  before it. FAIL: lists migration steps with no kill criteria / rollback / review.
- **A6 — Observable acceptance.** A vague "tell me the steps to mark done" for a search feature.
  PASS: insists on **observable acceptance criteria** per slice ("returns results matching X; test
  green"), not "implement search". FAIL: acceptance is "build it / implement X".
- **A7 — INVEST / decompose the monster.** "Plan it as one step: the entire notifications system
  (in-app, email, SMS, preferences, digest)." PASS: decomposes; explains the monster-slice cost
  (breaks parallelism, hides risk, no honest acceptance). FAIL: accepts it as one step.

### Part B — multi-turn pressure

- **B1 ⚠ — Hold under "just give me the list."**
  ```
  Turn 1: Plan how we'd add multi-tenancy to our single-tenant app.
  Turn 2: I don't need risks or skeletons — just give me the task list.
  Turn 3: Stop overthinking it. A numbered list, now.
  ```
  PASS: holds — still delivers a real plan (slices + at least the skeleton/risks, or a right-sized
  plan), does **not** collapse to a bare flat numbered list; stays useful (gives something
  actionable). FAIL: caves to a bare task list; or refuses to help.

### Part C — over-correction guards (the governor)

- **C1 ⚠ — Trivial task — don't over-plan.** "Bump a config timeout from 30s to 60s in one file —
  plan it." PASS: just says do it (one-liner, two-way door); does **not** impose a walking skeleton
  / DAG / risk register / handoff batons on a one-line reversible change. FAIL: full planning
  machinery on a trivial edit.
- **C2 ⚠ — Small clear feature — right-size.** "Add a `--verbose` flag to our CLI that prints debug
  logs — plan it." PASS: a **right-sized** short plan (a slice or two + acceptance); does **not**
  invoke the heavy machinery (spikes, full DAG, decision review, observability SLOs) for a tiny
  reversible feature. FAIL: over-processes a small reversible feature.

## Coverage
outcome-first (A1) · walking-skeleton (A2) · risks/spikes (A3) · DAG-not-list (A4) · one-way-door
guardrails (A5) · observable acceptance (A6) · INVEST/decompose (A7) · hold under pressure (B1) ·
over-planning governors (C1, C2).

*(Full master-plan / handoff-baton artifacts are deliverable-shaped — exercise in manual review,
not this auto-suite.)*

## Run
`./bench.sh` (reads `models.txt`; Opus judge) → per-model `REPORT.md` + `compare.sh` matrix.
Neutral de-confound: `JUDGE=sonnet ../../tools/regrade-any.sh implementation-planner/tests`.

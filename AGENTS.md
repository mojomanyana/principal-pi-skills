# AGENTS.md

Instructions for any coding agent operating with this skill set installed (Claude Code, the Pi coding agent, Codex CLI, Amp, Droid, or any other harness implementing the Agent Skills standard). Read this once at session start when you have any of these skills loaded.

This file complements the individual `SKILL.md` files. It is the **routing layer** that lives above them: how to pick a skill, how to hand off between them, what vocabulary is shared, and what every skill refuses to do.

---

## 1. The framework in one paragraph

There are six skills. They form a pipeline from fuzzy idea to merged PR: `brainstorming → software-architect → implementation-planner → tech-lead → coder → project-git`. Each skill is purpose-built for one phase of work. Each produces a tangible artifact (decision brief, design doc/ADR, implementation plan, coding spec, code + report, commits/PRs). Each ends with a **handoff baton** that compresses state for the next skill. No skill ever invokes another — you, the orchestrator, route based on the baton's `next_step_hint` or `Handoff Cues`.

---

## 2. Skill selection — pick by what the input looks like

When the user speaks, classify the input before reaching for a skill. The trigger phrases inside each `SKILL.md` description field are authoritative for ambiguous cases; this table is the quick lookup.

| Input shape | Skill |
|---|---|
| User is *exploring* a decision, not executing one ("I'm thinking about…", "should I…", "what are my options", "I'm stuck") | `brainstorming` |
| User wants a *system designed* or a *significant technical choice weighed* ("design X", "Postgres or DynamoDB", "should we use microservices", "scale this") | `software-architect` |
| User has a *spec, ADR, or decision brief* and needs *order of work* ("plan this", "break this down", "where do I start") | `implementation-planner` |
| User has *a slice or task* and needs *code-level design before touching code* ("how should I implement", "scope this refactor", "design this change") | `tech-lead` |
| User wants *code written* ("fix this", "implement", "make the test pass", "build it") | `coder` |
| User wants a *git or GitHub operation* ("commit", "push", "open PR", "leaked a secret", "find the regression", "tag a release") | `project-git` |

**When more than one applies**, route by altitude: the highest-altitude skill that matches the *actual* request, not the surface phrasing. *"Should I use Redis or Memcached"* is `software-architect` (it's a technology selection), not `brainstorming` (which is for upstream decisions about whether to add caching at all). *"How do I commit this"* is `project-git`, not `coder`, even when the user expected to write more code.

**When no skill fits**, don't force one. Answer directly. The skills cover principal-engineering work; everyday Q&A doesn't need them.

---

## 3. Common patterns — the canonical chains

You will see these flows repeatedly. Recognize them so you can route ahead.

- **Full lifecycle** (large new feature): `brainstorming → software-architect → implementation-planner → tech-lead → coder → project-git`. One baton per transition. Often the planner emits multiple batons — one per slice — and each slice walks `tech-lead → coder → project-git` independently.
- **Mid-size** (decision already clear, but design is non-trivial): `software-architect → implementation-planner → tech-lead → coder → project-git`. Skip brainstorming.
- **Small slice** (design clear, one change): `tech-lead → coder → project-git`. Skip planning.
- **Tiny change** (typo, one-line fix, rename): `coder` (Mode B) → `project-git`. Skip the spec.
- **Bug fix**: `tech-lead` (Mode C, bug-fix spec) → `coder` (Mode C, regression-test-first) → `project-git`. Or, for trivial bugs, `coder` (Mode E, debug) → `project-git`.
- **Refactor**: `tech-lead` (Mode D, refactor spec with proof-of-equivalence) → `coder` (Mode D, behavior unchanged, existing tests pass unmodified) → `project-git`.
- **ADR landing**: `software-architect` (Mode D, write ADR) → `project-git` (commit + PR in delegated mode).
- **Issue triage from brainstorm**: `brainstorming` (decision brief) → `project-git` (file issues, delegated mode).
- **Stress test only**: `brainstorming` (Mode D, pre-mortem dominant) — produces a brief that flags risks, then loops back to whoever owns the work.
- **Architecture review**: `software-architect` (Mode C) — produces target-state C4 diagrams and ranked findings; findings may spawn brainstorms or planning rounds.
- **Replan mid-flight**: `implementation-planner` (Mode E) — first-class activity when a slice fails, scope shifts, or a spike result invalidates the approach. Not a failure mode.

---

## 4. The handoff baton — the protocol

A baton is a typed structure handed from one skill to the next. It is the unit of cross-skill state. When a skill finishes, it emits one. When the next skill starts, it reads one.

A well-formed baton carries:

- **Target skill** — the receiving skill's name.
- **Reference to upstream artifact** — path or section to the spec, plan, ADR, or brief.
- **Inputs** — the specific context the receiver needs (files of interest, QA scenarios, acceptance criteria, base branch, etc.).
- **Postconditions** — what counts as the receiver's work being done.
- **Tried / ruled out** — what the sender already explored so the receiver doesn't repeat it.
- **Flagged assumptions** — items the receiver must reconfirm before acting.
- **Kill criteria** — under what condition the receiver should stop and hand back rather than push through.
- **Return contract** — what artifacts the receiver returns, in what shape.

Templates live in `implementation-planner/assets/handoff-baton.md` and `coder/assets/handoff-baton-to-git.md`. Use them. Free-form prose handoffs lose state.

**The bad baton:** *"implement step 3."*
**The good baton:** receiving skill named, plan section linked, the first concrete action specified, assumptions to reconfirm listed, acceptance signal defined, return artifact named, kill criteria stated.

**Project-git's delegated mode** is the inverse end of the baton protocol. When called from another skill, it suppresses prose and returns a `## Facts` block — branch name, commit SHAs, PR URL/number, CI status, `next_step_hint`. This is what makes the pipeline composable end-to-end without losing IDs in chat.

---

## 5. Shared vocabulary

The skills use a consistent vocabulary across the framework. Use the same terms in your responses so the user sees one coherent system, not six separate tools.

**Reversibility tags** — every significant decision is one of:

- 🟢 / 🚪🚪 **two-way door** — easy to undo; ship freely.
- 🟡 **costly** — undoing requires rework but not a migration.
- 🔴 / 🚪 **one-way door** — undoing requires migration, downtime, version coordination, or downstream breakage. Requires an explicit **kill criterion** stated in advance.

**Quality Attribute Scenario (QAS)** — concrete, measurable requirement from the architecture skill. Format: source / stimulus / environment / artifact / response / measure. *"During Black Friday peak (env), the order service (artifact) must respond to a place-order request (stimulus) from the mobile app (source) with a confirmation (response) in under 500ms p95 (measure)."* Replace adjectives like "scalable" with QAS.

**Walking skeleton** — the thinnest end-to-end slice that exercises every architectural seam with stub logic. Step 1 of any non-trivial plan. Forbidden alternative: horizontal layers (all the models, then all the services, then all the UIs).

**Vertical slice** — a unit of work that crosses every necessary layer (data, logic, interface, observability) at one thin width. The unit of planning and the unit of implementation. Must pass INVEST.

**INVEST** — Independent, Negotiable, Valuable, Estimable, Small, Testable. Slices that fail INVEST get decomposed before the plan ships.

**Acceptance criteria** — *done-when*. Specific, testable, observable.
**Kill criteria** — *stop-when*. Named in advance, when you can still think clearly. Mid-flight, sunk cost has you.
**Observability criteria** — for production-bound work: how will we know it works *in production*, not just in CI?

**C4 levels** (from the architect skill):
- **Level 1 — System Context**: the system, its users, external systems it talks to. For any new system or solution-architecture discussion.
- **Level 2 — Container**: deployable / runnable units inside the system (web app, API, database, queue, worker).
- **Level 3 — Component**: what's inside one container; only for containers where internal structure is load-bearing.
- **Level 4 — Code**: class/ER. Rarely hand-drawn; let the IDE generate.
- **Dynamic**: runtime flow for one architecturally-significant scenario.
- **Deployment**: where containers physically run — nodes, regions, redundancy.

**ADR** — Architecture Decision Record. Required output for any irreversible or architecturally-significant choice. Must include "do nothing" as a real weighed option and a consequences section with *both* positives and negatives.

**Decision rule** — the condition under which a recommendation would flip. Architects state this on every recommendation: *"use the cache if you see hot keys above 10× average; if reads are uniformly distributed, add a read replica instead."*

**EARS phrasing** — *"WHEN \<trigger\>, the system shall \<response\>."* Used in coding specs and acceptance criteria for testable precision.

**Strangler fig / branch-by-abstraction / parallel run / expand-and-contract** — migration patterns. The architect refuses big-bang rewrites.

**Pre-mortem** — imagine the project failed; write the failure story. Mandatory before any non-trivial commitment.

**Spike** — a time-boxed investigation with a written deliverable, used to de-risk an *unknown* risk before committing scope to dependent work.

**Smell-check** — tech-lead's mandatory pre-commit on a spec: did this fight the codebase? Is the user solving the right problem? Are we re-implementing something that exists? Is this the smallest change?

---

## 6. Cross-cutting tenets

These postures appear in multiple skills and apply across every transition.

**Read before write.** Every operation starts with reading. The architect reads the codebase shape and the constraints; the tech-lead reads the affected files, callers, and tests; the coder reads files before modifying them; project-git reads working-tree state, recent log, and remote sync before any write. Seconds spent reading prevent hours unwinding.

**Match the codebase, not your preferences.** Your training data is opinionated. The codebase wins every disagreement. If the project uses snake_case, you use snake_case. If it uses Result types instead of exceptions, you use Result types. Silent deviation is a code smell. Explicit deviation requires explicit justification.

**Honest reporting.** When you hand off, name what worked, what didn't, what's hacky, what was guessed, what was skipped. "Done!" looks great and is wrong. Sycophantic reporting creates incidents.

**Anti-sycophancy.** Productive disagreement is the goal. If you and the user never disagree in a session, the session probably failed. Before validating any idea, try to break it. If you can't, *say so explicitly* — *"I tried inversion and red-teaming, the idea holds up"* is a real endorsement.

**Point, don't invoke.** No skill calls another skill. Each ends with a *Handoff Cues* section that names the next skill. You route.

**Scope discipline.** Flag drift, don't fix it. Notice the test runner is slow, three TODOs nearby, an unrelated bug in the file you just opened — name them in the report, don't quietly expand the slice.

**Stop when blocked.** A bad fix that hides a real problem is worse than no fix. Empty `catch` blocks are malpractice. Surface, ask, route back.

---

## 7. Refusals — what every skill pushes back on

The skills enforce these. Apply them even when not explicitly stated.

- **Solution proposed before problem stated.** *"Should we use Kafka?"* before *"what's the messaging requirement?"* — reframe to the problem first.
- **Vague trigger phrases without substance.** *"Just give me the code"* on a non-trivial task — route to tech-lead first, or ask one clarifying question.
- **Plans without a walking skeleton.** Push back hard on *"but we know it works"* — have you actually run it end-to-end recently with the current dependency versions?
- **One-way doors without kill criteria.** A schema migration without a kill criterion is malpractice. So is a vendor commit. So is a public API change.
- **Specs without test plans.** If you can't write the test that catches the regression, the spec isn't ready.
- **Bug fixes without a failing regression test first.** The test must fail on `main` before the fix. If it doesn't, the test doesn't catch the bug.
- **Refactors that change tests.** If an existing test needs new assertions, behavior changed — that's no longer a refactor.
- **Suppressed errors.** `try { ... } catch (e) {}` without understanding the error. Either understand it or surface it.
- **Force-push to protected branches.** `main` / `master` / `develop` / `release/*` / `prod*` require an explicit override line in the same message. Confirmation cannot be inferred from context.
- **Commits with likely secrets in the staged diff.** Stop, show the match, ask. On a real leak: *rotate the credential first*, then rewrite history.
- **Big-bang rewrites.** Counter with strangler fig.
- **Microservices with one team.** That's a distributed monolith with extra failure modes.
- **Resume-driven choices.** New shiny technology with no specific QA driver. Recommend the boring option the team can run on a Saturday at 3 AM.
- **Conversation-only deliverables.** Every skill has a written artifact contract. The chat alone doesn't count.

When refusing, do it constructively: name what's refused, name why, name the question that would unblock it, offer the path forward.

---

## 8. Output contracts at a glance

Each skill has a specific deliverable. Know which one applies before you finish.

| Skill | Required artifact | Template |
|---|---|---|
| `brainstorming` | Decision brief (question reframed, constraints, options, pre-mortem, decision, reversibility, open questions, handoff pointer) | `brainstorming/assets/decision-brief.md` |
| `software-architect` (design) | Design doc with C4 Context + Container + relevant Component/Dynamic/Deployment | `software-architect/assets/design-doc-template.md` |
| `software-architect` (ADR) | ADR with trigger, context/forces, ≥3 options including "do nothing", decision, consequences positive *and* negative | `software-architect/assets/adr-template.md` |
| `software-architect` (advisory) | Prose answer + decision rule + reversibility note; diagram when structural | — |
| `implementation-planner` | Plan with outcome, risks, walking skeleton, INVEST slices, DAG, reversibility tags, acceptance + kill criteria, status section | `implementation-planner/assets/implementation-plan.md` |
| `implementation-planner` (baton-only mode) | One handoff baton for one transition | `implementation-planner/assets/handoff-baton.md` |
| `tech-lead` (slice spec) | Coding spec: outcome, scope, exploration notes, design, test plan, dependencies & ripples, reversibility, smell-check, flagged assumptions, handoff baton | `tech-lead/assets/coding-spec.md` |
| `tech-lead` (bug) | Bug-fix spec: regression test specified first, root-cause diagnosis, minimal fix, blast radius | `tech-lead/assets/bugfix-spec.md` |
| `tech-lead` (refactor) | Refactor spec with proof-of-equivalence plan | `tech-lead/assets/refactor-spec.md` |
| `coder` | Working code + commits + implementation report + handoff baton to project-git | `coder/assets/implementation-report.md`, `coder/assets/handoff-baton-to-git.md` |
| `coder` (debug) | Bug investigation note + (if non-trivial) full report | `coder/assets/bug-investigation-note.md` |
| `project-git` (human mode) | Narrative output + relevant URLs/SHAs/IDs | — |
| `project-git` (delegated mode) | Brief confirmation + `## Facts` block (branch, commits, PR, CI status, warnings, `next_step_hint`) | — |

When an artifact is missing or incomplete, *say so before delivering*. Don't pretend a plan without a walking skeleton is a complete plan, or that a spec without a test plan is a complete spec.

---

## 9. Progressive disclosure — load references on demand

A `SKILL.md` is the minimal context. Deeper craft lives in `references/<topic>.md`. The `SKILL.md` text tells you when to load each reference — it links to them inline at the points where that depth would help.

Examples:

- Brainstorming's Tenet 6 says: *"See [cognitive-biases.md](references/cognitive-biases.md) for the full anti-sycophancy protocol."* Load that file when you sense the conversation is drifting into agreement-mode.
- Architect's Tenet 1 says: *"See [quality-attributes.md](references/quality-attributes.md)."* Load that when the user is using fuzzy adjectives ("scalable", "secure") instead of measurable scenarios.
- Tech-lead's Mode C says: *"See [debugging-methodology.md](references/debugging-methodology.md)."* Load that when working on a bug-fix spec where the root cause is non-obvious.
- Project-git's Mode G says: *"See [recovery.md](references/recovery.md)."* Load that on `reflog`, lost commits, wrong-branch pushes, or leaked-secret incidents.

Do *not* load references preemptively. Doing so wastes context window. Load when the linked context fires.

---

## 10. Things no skill in this framework does

These are out-of-scope for the whole framework. If asked, redirect — or, when the request is small and fits, do it directly outside the skill system.

- **Run another skill.** Skills point, the orchestrator routes. The point-don't-invoke rule is absolute.
- **Make decisions silently.** Every load-bearing choice gets surfaced. The user can disagree before it lands.
- **Produce conversation-only deliverables on principal-engineering work.** If the work is non-trivial, it ends with a written artifact.
- **Validate without testing.** Brainstorming refuses *"tell me this is a good idea"* — it stress-tests instead. Architect refuses recommendations without QAS backing. Tech-lead refuses spec review without applying the nine tenets as a rubric. Coder refuses "looks right" as proof.
- **Skip exploration.** Tech-lead won't spec code it hasn't read. Coder won't write code without reading the affected files first.
- **Commit with conflict markers, secrets, or to a protected branch without consent.** Project-git's safety overrides are non-negotiable.
- **Rewrite plans silently.** Replans preserve history with dated revision notes.
- **Hide one-way doors.** Reversibility tags are mandatory on significant decisions.

---

## 11. Session hygiene

- **At session start with a skill loaded:** read its `SKILL.md` in full. Don't pre-load references.
- **Long sessions:** if the same skill runs more than ~20 exchanges, summarize state so far, ask whether to continue, narrow, or close.
- **Multi-session continuation:** if the user returns with *"we were working on X"* and an artifact exists (brief, plan, spec, report), read it first, then ask what's changed. Don't restart from memory.
- **Interrupted coder sessions:** read `progress.md` (per `coder/references/coding-loops.md`), run `git status` and `git log`, run the tests to determine green/red, then resume from the last consistent state.
- **Drift recovery:** when the spec contradicts reality discovered mid-implementation, *stop*. Don't silently adapt. Reverse-handoff to tech-lead with a specific question.
- **Scope creep inside a session:** name it — *"that's a separate brainstorm / slice / decision; want to handle it after this one or fork now?"*

---

## 12. Final check before delivering

Before you finish your turn, run this quick rubric. If any line fails, the work is not done.

1. Did I pick the right skill for what the user actually asked, not the surface phrasing?
2. Is the required artifact present and complete (per §8)?
3. Did I name reversibility for significant decisions?
4. Did I write kill criteria for one-way doors?
5. Did I match the codebase's conventions where applicable?
6. Is my report honest (what worked, what didn't, what's hacky, what was guessed)?
7. Did I produce a baton for the next skill, with all the fields a good baton needs?
8. Did I avoid invoking another skill myself?
9. Did I refuse what should be refused (vague specs, missing tests, one-way doors without kill criteria, force-push to protected branches)?
10. Is my output the right altitude — concise where the skill expects prose, structured where the skill expects an artifact, fact-only where project-git is in delegated mode?
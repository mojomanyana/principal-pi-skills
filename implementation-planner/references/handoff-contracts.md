# Handoff Contracts — The Baton Protocol

This is the distinctive reference for this skill. A handoff baton is not a status update — it is a **delegation contract** produced at every skill-boundary transition. Done well, it is the single most valuable artifact for keeping multi-skill work coherent.

## Table of contents

1. [What a baton is, and what it isn't](#1-what-a-baton-is-and-what-it-isnt)
2. [Why batons exist — context engineering for skill chains](#2-why-batons-exist--context-engineering-for-skill-chains)
3. [The seven required sections](#3-the-seven-required-sections)
4. [The context capsule — compression principles](#4-the-context-capsule--compression-principles)
5. [Inputs and the return contract](#5-inputs-and-the-return-contract)
6. [Per-destination templates](#6-per-destination-templates)
7. [Baton lifecycle: produce, hand off, return, ingest](#7-baton-lifecycle-produce-hand-off-return-ingest)
8. [Anti-patterns and how to refuse them](#8-anti-patterns-and-how-to-refuse-them)

---

## 1. What a baton is, and what it isn't

A baton is:

- A **single document** scoped to a single skill transition
- Produced by the **sending** side of the transition (often this planner; sometimes another skill returning work)
- Consumed by the **receiving** skill, which uses it as its primary input
- A **contract** — it names what's coming in, what's expected back, and what conditions stop the work

A baton is **not**:

- A status report (the plan's status section is for that)
- A re-statement of the plan (the baton *points to* the plan, doesn't duplicate it)
- A free-form message ("hey, can you implement step 3?" is not a baton)
- A persistent log (each baton is for one transition; new transition, new baton)

The plan owns the truth across the whole arc of work. The baton is the **focused, time-bounded contract** for one segment of that arc.

---

## 2. Why batons exist — context engineering for skill chains

When one skill hands work to another, three things go wrong without a contract:

1. **Context loss.** The receiving skill doesn't know what's been tried, what's been ruled out, what decisions are settled, what the failure modes are. It re-derives from scratch (slow) or misses constraints (wrong).
2. **Scope drift.** Without a clear contract, the receiving skill may do more than was asked (scope creep), less than was needed (incomplete handback), or the wrong thing (misaligned interpretation).
3. **Return ambiguity.** When the receiving skill is "done," nobody can tell — there's no defined return shape. The sending side either has to re-evaluate everything or accept whatever came back.

Batons are how you fix all three. They are deliberate **context engineering**: select what the receiving skill needs, compress it to its essentials, frame it as a contract, and define the return.

This is closely related to the context-engineering principle for agentic systems: an agent's effective intelligence is bounded by how well its context is curated, not by how much context is available. The same principle applies to chained skills — the baton is the curation step.

---

## 3. The seven required sections

Every baton has these, in this order. The template lives at [`../assets/handoff-baton.md`](../assets/handoff-baton.md).

### 1. Header

- **Baton ID** — short, plan-scoped (`baton-2026-05-12-S1`)
- **Plan ID** — the plan this baton belongs to
- **From skill / To skill** — explicit. "From: implementation-planner. To: coding."
- **Created** — date and time
- **Slice ID** — the slice in the plan this baton covers (could be one slice, or a slice subtree)

### 2. Objective

One to three sentences. **What the receiving skill is being asked to do.** Not the broader plan — the specific work for this baton.

Bad: "Implement password reset."
Good: "Implement slice S2 (token store) per its acceptance criteria. Output: a working token issuance and validation service with the persistence layer wired."

### 3. Inputs

What the receiving skill is given to work with. Concrete, enumerable.

- **Documents** — paths or links to the plan, relevant ADRs, design docs, prior batons
- **Artifacts** — code paths, branch names, ticket IDs, the walking-skeleton PR
- **Constraints** — what's fixed and not subject to negotiation by the receiving skill
- **Acceptance criteria** — copied (or linked) from the plan; the receiving skill executes against these
- **Conventions** — naming, style, structure that must be followed (point to the existing codebase if relevant)

### 4. Context capsule

The **compressed state** the receiving skill needs to do its job. See §4 for principles. This is the section where context engineering happens; it deserves the most thought.

### 5. Return contract

What the sending side expects back. Concrete:

- **Artifacts** — files committed, PR opened, branch name, ADR drafted, ticket closed
- **Status** — slice DONE, BLOCKED, PARTIAL, ABANDONED (with reason)
- **Reverse handoff** — what to put in the return baton (or update in the plan's status section)

### 6. Kill criteria for this baton

When the receiving skill should **stop and hand back without completing**. At minimum:

- Time-box: if work exceeds N hours/days without completion, hand back
- Discovery triggers: if a specific finding emerges (a violated assumption, a blocked dependency, an unsafe operation), stop and hand back

The kill criteria here are scoped to the *receiving skill's work on this baton*, not the plan-level kill criteria.

### 7. What's been tried / what's been ruled out

Often the most valuable section. Spares the receiving skill from re-discovering known dead ends.

- Approaches that were considered and rejected in earlier work, with reasons
- Spike findings, if relevant
- Decisions that are settled and not to be revisited (with pointers to where they were settled — ADR, decision brief, plan section)
- Known bugs, gotchas, sharp edges in the area being worked on

The receiving skill reads this and *avoids burning cycles* on closed questions.

---

## 4. The context capsule — compression principles

The context capsule is what makes batons valuable instead of just paperwork. Principles:

### Select, don't dump

The temptation is to attach everything: the whole plan, all the ADRs, the spec, the meeting notes. That makes the baton useless — the receiving skill has to re-curate.

The capsule contains **what the receiving skill needs**, not **everything that exists**. The discipline is asking: *if the receiving skill had only this section to work from, what would they need to know?*

### Compress chronological history into structural state

The receiving skill rarely needs to know *what happened in what order*. It needs to know *what is true now*. Convert:

> "First we tried hashing tokens with bcrypt, then we measured latency, then we switched to argon2id, then we benchmarked again, and now we're using argon2id with the parameters from ADR-0014."

into:

> "Token hashing uses argon2id with the parameters specified in ADR-0014. (Bcrypt was rejected for latency; see ADR-0014 §4.)"

Same information, half the words, no extraneous "story" the receiving skill has to mentally process.

### Link, don't inline (with one exception)

Links to authoritative documents (plan, ADRs, design docs) are preferable to inlining their content. Two reasons:

1. The authoritative doc may update; the link tracks; inlined copies don't.
2. The baton stays compact and scannable.

The exception: **inline the specific facts the receiving skill will reference repeatedly**. If the slice's acceptance criteria are spread across the plan, inline them in the baton — saving the receiving skill from doc-hopping during execution. Three or four concrete acceptance criteria inline are better than "see plan §S2.acceptance."

### Surface the load-bearing assumptions

What does the work *depend on* that isn't documented elsewhere? "We're assuming the email service is rate-limited to 1000 req/min based on the vendor's documented tier." That's a load-bearing assumption; if it's wrong, work breaks. The capsule names it explicitly so the receiving skill can verify or push back.

### Name the seams

If this slice connects to other slices, name them. "S2's output (token issuance) is consumed by S4 (email send) and S6 (full reset flow). S2's interface must match the contract specified in plan §S2.acceptance to keep S4 and S6 from breaking."

The receiving skill, knowing its outputs feed downstream, will make different choices than it would building in isolation.

### What NOT to include

- The whole plan (link it; reference specific sections)
- Architectural rationale (that lives in the ADR; link it)
- Status updates from prior slices unrelated to this one
- Generic best practices the receiving skill already knows
- Wishful framing ("ideally we'd…") — either it's a requirement or it isn't

---

## 5. Inputs and the return contract

The two halves of the typed contract. Both deserve precision.

### Inputs — be enumerable

Each input gets a line. Anyone reading the baton should be able to *list* the inputs.

```
Inputs:
- Plan: /docs/plans/pwd-reset-v2.md (slice S2 specifically)
- Design: ADR-0014
- Walking skeleton: PR #441 (merged to main)
- Code conventions: /docs/conventions/auth.md
- Token interface contract: /docs/plans/pwd-reset-v2.md §S2.acceptance
- Test patterns: /tests/auth/ (existing token-related tests)
- Spike findings: /docs/spikes/argon2id-params.md
```

That's seven enumerable inputs. The receiving skill knows exactly what to read first.

### Return contract — be falsifiable

Each return item is something *you can check happened*. Avoid "implemented" or "done" without a corresponding artifact.

```
Expected return:
- PR opened against main with title "S2: token store"
- PR linked to plan (link in PR description) and to ADR-0014
- All acceptance criteria from plan §S2 covered by tests in the PR
- Status update for plan: S2 → DONE (or BLOCKED with reason)
- New ADR (or addition to existing ADR) only if architectural decisions had to be made
- Reverse baton if anything unexpected was discovered (gotchas for downstream slices)
```

Now when work returns, you can verify each item. If any is missing, the handoff isn't complete.

---

## 6. Per-destination templates

Different receiving skills need different things in the baton. Tune the capsule and return contract.

### → coding skill

**Capsule should include:**
- Code paths likely to be touched (directories, files)
- Conventions and existing patterns to follow
- Acceptance criteria inline
- Test patterns and how to run them
- Branch name expected and target branch
- Any libraries to use or avoid (and why)

**Return contract:**
- PR opened with description linking baton + plan + ADR
- All acceptance criteria covered by tests
- Self-review checklist confirmed
- Status update for plan

### → project-git skill (delegating git/GitHub operations)

The `project-git` skill already specifies its own delegation protocol (Style A/B/C/D). The baton should adopt that protocol's vocabulary. See its skill documentation.

**Capsule should include:**
- Repo and branch
- Operation requested (commit, PR, issue creation, release, etc.)
- Specific files / commit boundaries / issue contents
- Labels, assignees, conventions

**Return contract:** structured Facts block per `project-git`'s delegated mode — SHAs, URLs, IDs, PR numbers.

### → software-architect skill (design gap surfaced)

Triggered when work is in flight and an architectural question that wasn't anticipated emerges. The plan can't proceed until it's answered.

**Capsule should include:**
- The specific question (often the discovery that broke the plan)
- Context: what's been built so far that constrains the answer
- Constraints from the original plan that the architecture must respect
- What's at stake if the wrong answer is chosen

**Return contract:**
- ADR drafted (or existing ADR amended) addressing the question
- Plan implications named (which slices need to revise?)
- Handoff back to implementation-planner for plan revision (Mode E)

### → brainstorming skill (scope/priority decision surfaced)

Triggered when mid-flight work reveals a real choice between divergent paths that's bigger than a plan revision — it's a re-decision.

**Capsule should include:**
- The choice that's now in question
- What was originally decided (decision brief reference)
- What's changed that's raising the question
- Options as currently understood

**Return contract:**
- Updated decision brief
- Handoff back to implementation-planner for replan

### → user (asking for input, not delegating)

Sometimes the right next move is **back to the user**. Maybe a constraint needs to be confirmed; maybe a choice needs to be made.

**Capsule should include:**
- The specific question (one to three sentences, sharp)
- The options as currently understood
- The trade-offs of each option
- The recommended option, if there is one, with reasoning

**Return contract:** the user's answer, in whatever form they give it; planner re-engages for plan revision.

This isn't technically a "baton" in the agent-to-agent sense, but the discipline of writing it the same way produces *much* better user prompts than free-form questions.

---

## 7. Baton lifecycle: produce, hand off, return, ingest

### Produce

The sending skill writes the baton. Required: all seven sections. Validated against:

- Does the receiving skill have everything it needs to start work?
- Are the inputs enumerable?
- Is the return contract falsifiable?
- Are the kill criteria specific?

Save the baton to the project (`/docs/batons/` or wherever the convention places them). Path it so it's discoverable and dated.

### Hand off

The user (or calling agent) takes the baton to the receiving skill. The baton is the receiving skill's primary input. In an LLM-orchestrated context, this is literally pasting the baton in.

If multiple skills need to act in parallel from a single plan, multiple batons are produced — one per skill, scoped to that skill's work.

### Return

When the receiving skill finishes (or stops per kill criteria), it produces a **return artifact**. This is *not* a new baton (unless work needs to continue to another skill — see below); it's the deliverable + status.

The simplest return:

> Baton: baton-2026-05-12-S1
> Status: DONE
> PR: <link>
> All acceptance criteria covered.
> Notes: <any surprises>

If the work needs to continue to another skill (e.g., coding finished but a release needs to be cut), the receiving skill *produces a new baton* — but only for the *next* transition, not retroactively for this one.

### Ingest

The sending skill (or the user) reads the return, verifies the return contract was met, and updates the plan's status section. If the work raised a need for a new slice, a replan, a risk update — those happen in the plan, not in another baton.

The baton's life ends here. It's an artifact-on-record (don't delete it; future audit), but it doesn't keep evolving.

---

## 8. Anti-patterns and how to refuse them

### The instruction baton ("implement S2")

Hands off a slice ID with no context. The receiving skill has to re-read the whole plan to function. Refuse; rewrite with at least the seven sections.

### The dump baton (the whole plan inlined)

Hands off everything, defeating the curation purpose. Refuse; rewrite with a curated capsule that selects only what the receiving skill needs.

### The chatty baton (prose paragraphs of background)

Hands off a wall of text that buries the contract. Receiving skill can't find what's being asked. Refuse; rewrite using the seven sections with crisp bullets.

### The retroactive baton

Written *after* the receiving skill is mid-work, justifying what's already happening. This isn't a contract; it's a fictional retcon. Useful for documentation perhaps, but acknowledge what it is.

### The contract-free baton

No return expectations stated. "Do the thing." Receiving skill finishes and nobody can tell whether it's done. Refuse; rewrite with a falsifiable return contract.

### The single-baton-for-the-whole-plan

One baton tries to cover all slices. Defeats the purpose; the capsule becomes the whole plan. One baton per skill transition, not one baton per plan.

### The baton without kill criteria

The receiving skill has no defined "stop" condition. Open-ended work; tends to overrun. Refuse; require at least a time-box and one discovery trigger.

---

## Closing: the test for a complete baton

Read the baton fresh, pretending you've never seen the plan:

- Can you tell what's being asked?
- Do you have everything you need to start?
- Do you know when to stop?
- Do you know what to hand back?

If yes to all four, the baton is complete. If any answer is "I'd need to ask," the baton needs sharpening before it leaves.

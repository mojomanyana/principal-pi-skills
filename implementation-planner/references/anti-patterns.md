# Anti-patterns — Bad Plans, Bad Batons, and How to Refuse Them

The fastest way to write a good plan is to recognize the bad ones before they leave your hands. This reference catalogues the failures, names them, and provides the refusal scripts.

## Table of contents

1. [Plan-level anti-patterns](#1-plan-level-anti-patterns)
2. [Slice-level anti-patterns](#2-slice-level-anti-patterns)
3. [Risk and spike anti-patterns](#3-risk-and-spike-anti-patterns)
4. [Sequencing and DAG anti-patterns](#4-sequencing-and-dag-anti-patterns)
5. [Baton anti-patterns](#5-baton-anti-patterns)
6. [Process anti-patterns](#6-process-anti-patterns)
7. [How to refuse — scripts that hold under pressure](#7-how-to-refuse--scripts-that-hold-under-pressure)

---

## 1. Plan-level anti-patterns

### 1.1 The flat task list

Symptoms: `1. Build API. 2. Build UI. 3. Test.`

Problems: No outcome, no risks, no acceptance, no DAG, no kill criteria. The plan is functionally a TODO list.

Refusal: "This isn't a plan; it's a sequence. Let me ask three questions before I can produce a plan: what's the outcome we're measuring; what could go wrong; what's the smallest end-to-end slice we should ship first?"

### 1.2 The waterfall in disguise

Symptoms: Vertical-looking slices, but they're really horizontal layers wearing slice labels. "S1: data layer for feature X. S2: service layer for feature X. S3: UI for feature X. S4: testing for feature X."

Problems: Integration risk deferred to the end. No value shipped until S4. No walking skeleton. Mid-flight discoveries break everything.

Refusal: "These look like layers, not slices. A vertical slice for this feature would be 'one end-to-end behavior' — for instance, one user can perform one action and see one result, with stubs everywhere else. Let me redo the decomposition." See [`decomposition.md`](decomposition.md) §2.

### 1.3 The plan with no outcome

Symptoms: Jumps straight to "build the X."

Problems: No measurable definition of success. The plan can be completed without anyone agreeing the work delivered value.

Refusal: "Before I draft the plan, I need to know what we're measuring. What does the world look like when this plan succeeds, in observable terms?" See [`plan-anatomy.md`](plan-anatomy.md) §2.

### 1.4 The plan without a walking skeleton

Symptoms: First slice is a substantial vertical-depth slice; no end-to-end stub-everywhere step.

Problems: Integration assumptions aren't validated until weeks in. When they fail, every depending slice is affected.

Refusal: "Before any depth slice, we need a walking skeleton that exercises every architectural seam — auth, deploy, observability, external integrations, all of it — with stubs at every node. Otherwise we're betting all of those work." See [`decomposition.md`](decomposition.md) §3.

### 1.5 The plan with no risks

Symptoms: Risk register is empty or has one trivial entry.

Problems: Either the planner hasn't thought hard about what could go wrong, or the planner is hiding what they're worried about. Both are bad.

Refusal: "Let me ask explicitly — what are the five things that could derail this plan, in order of likelihood? Even a 'low-risk' plan should be able to name them." Then categorize per [`risk-and-spikes.md`](risk-and-spikes.md) §2.

### 1.6 The plan with no kill criteria

Symptoms: Acceptance criteria everywhere; no "stop when" anywhere.

Problems: The plan can finish even when it shouldn't. Sunk-cost commits accumulate. The first one-way door without a kill criterion is where this becomes catastrophic.

Refusal: "We need at least one kill criterion at the plan level and one per one-way-door slice. Right now we'll keep going through any failure mode; that's not how good plans work." See [`acceptance-and-kill-criteria.md`](acceptance-and-kill-criteria.md) §4.

### 1.7 The optimistic plan

Symptoms: Aggressive timeline; estimates assume best-case for every slice; no buffer.

Problems: First setback consumes all margin. By Wave 3 the plan is fictional.

Refusal: "Two questions: what's the historical accuracy of estimates on this team for this kind of work, and where's the buffer for the inevitable mid-flight surprise? An optimistic plan that doesn't account for either is a plan we'll be replanning by week 2."

### 1.8 The plan that doesn't fit on a screen

Symptoms: A 50-slice plan with no chunking, no waves, no executive summary.

Problems: Unreadable. Stakeholders can't engage; reviewers can't review; downstream skills can't find what they need.

Refusal: "Plans need to be navigable. For 50 slices, I'd want: an executive summary up top (5-bullet TL;DR), the DAG showing waves, then the slice detail. Or, more often, this is actually two or three plans and we should split them." Either compress or split.

---

## 2. Slice-level anti-patterns

### 2.1 The monster slice

Symptoms: A slice sized L or XL ("build the auth system").

Problems: Fails INVEST on Small and Estimable. Can't be reviewed coherently; can't run in parallel; can't have honest acceptance criteria.

Refusal: "This is unsizeable as a single slice. Let me apply story-splitting." See [`decomposition.md`](decomposition.md) §4.

### 2.2 The "implementation steps" slice

Symptoms: `S3: write the function`. Acceptance: `function exists`.

Problems: Describes *how*, not *what*. Slice has no observable value; can't be tested behaviorally; couples plan to implementation.

Refusal: "Acceptance describes behavior, not code. What does this slice *do* from a user's or system's perspective?" See [`acceptance-and-kill-criteria.md`](acceptance-and-kill-criteria.md) §1.

### 2.3 The slice that ships nothing

Symptoms: "Investigate X. Discuss Y. Plan Z."

Problems: No deliverable. Either a spike (in which case it needs a written deliverable per [`risk-and-spikes.md`](risk-and-spikes.md) §5) or a deferral disguised as work.

Refusal: "What's the artifact that ends this slice? If it's investigation, the deliverable is a written finding; let me convert it to a proper spike with time-box and acceptance."

### 2.4 The slice without observability

Symptoms: Production-bound slice with no answer to "how will we know it works in prod?"

Problems: Ship-and-pray. When it breaks, the team finds out from users.

Refusal: "Every production-bound slice needs observability criteria — visible (logs), measurable (metrics), alertable (thresholds), debuggable (context). Let me add them." See [`acceptance-and-kill-criteria.md`](acceptance-and-kill-criteria.md) §5.

### 2.5 The slice with all the responsibility

Symptoms: A single slice owns "the architecture," "the security," "the performance," "the rollout."

Problems: Mega-slice in disguise. The conjunction hides that several distinct concerns need separate scrutiny.

Refusal: "These are different concerns with different reviewers and different acceptance shapes. Let me split."

---

## 3. Risk and spike anti-patterns

### 3.1 The "everything is medium" register

Symptoms: Every risk scored M×M.

Problems: No real prioritization. The planner hasn't done the work of distinguishing the *actual* top risks.

Refusal: "Which of these is the one you'd lose sleep over? Force-rank the top three. M×M for everything tells me we haven't actually evaluated."

### 3.2 The risk with no mitigation

Symptoms: Risk listed; mitigation field empty or "monitor."

Problems: Acknowledging a risk without responding is theater.

Refusal: "Either there's a spike, a fallback slice, an operational mitigation, or an explicit acceptance with reasoning. 'Monitor' is fine only if we name what we're monitoring and what triggers action." See [`risk-and-spikes.md`](risk-and-spikes.md) §3.

### 3.3 The open-ended spike

Symptoms: Spike with no time-box; "evaluate X."

Problems: Spikes blow their box even when boxed; without a box they sprawl.

Refusal: "Spikes need a time-box, a sharp single question, a written deliverable, and a kill criterion. Let me convert."

### 3.4 The spike that produces production code

Symptoms: "Spike: evaluate Redis caching" → output is a working Redis-cached service.

Problems: The spike became an implementation slice without acceptance criteria around it. The "spike" code is now in prod with no review-as-prod-code.

Refusal: "Spikes produce written findings, not production code. The Redis-cached service either needs to be deleted and rebuilt as a proper slice with full acceptance, or this needs to be renamed to an implementation slice and reviewed accordingly."

### 3.5 The plan that depends on heroics

Symptoms: "Risk: this is hard. Mitigation: assigned to <best engineer>."

Problems: Person-dependent plans are fragile (illness, attrition, attention) and don't scale.

Refusal: "Heroic mitigation isn't a mitigation; it's a hope. What's the structural change — smaller slices, more spikes, a different design — that reduces the difficulty?"

---

## 4. Sequencing and DAG anti-patterns

### 4.1 The implicit DAG

Symptoms: Numbered list of slices, dependencies inferred from order.

Problems: Order implies dependencies that may not exist (hides parallelism) or fails to capture dependencies that do (lets people start things in the wrong order).

Refusal: "Let me draw the actual dependency DAG so we can see which slices can run in parallel and which truly block others." See [`dependencies-and-sequencing.md`](dependencies-and-sequencing.md) §2.

### 4.2 The cycle

Symptoms: Two slices that depend on each other.

Problems: Plan is unexecutable; neither slice can start.

Refusal: "There's a cycle here. Three resolutions: merge them, stub-and-replace, or re-decompose." See [`dependencies-and-sequencing.md`](dependencies-and-sequencing.md) §6.

### 4.3 The unmarked critical path

Symptoms: DAG exists, but the longest path isn't called out.

Problems: Schedulers and reviewers can't tell which slices most need protection.

Refusal: "Let me identify the critical path explicitly and call out which slices are on it. That's where slippage costs the plan the most." See [`dependencies-and-sequencing.md`](dependencies-and-sequencing.md) §4.

### 4.4 The "we'll figure out order later"

Symptoms: All slices in one big bucket with no waves; "we'll prioritize as we go."

Problems: No critical path visible; no parallel opportunities surfaced; no risk-first sequencing.

Refusal: "Order is part of the plan, not a runtime decision. Let me lay out at least the first two waves with explicit sequencing reasoning." See [`dependencies-and-sequencing.md`](dependencies-and-sequencing.md) §8.

---

## 5. Baton anti-patterns

See [`handoff-contracts.md`](handoff-contracts.md) §8 for the full treatment. The catalogue, compressed:

- **Instruction baton:** "implement S2" with no context. Refuse; rewrite with all seven sections.
- **Dump baton:** the whole plan inlined. Refuse; rewrite with curated capsule.
- **Chatty baton:** walls of prose burying the contract. Refuse; rewrite with crisp bullets.
- **Contract-free baton:** no return expectations. Refuse; require falsifiable return contract.
- **Single-baton-for-the-whole-plan:** one baton covers all slices. Refuse; one baton per transition.
- **Baton without kill criteria:** no defined stop. Refuse; require time-box + discovery triggers.
- **Retroactive baton:** written after work started. Acknowledge but don't pretend it's a contract.

---

## 6. Process anti-patterns

### 6.1 The plan-and-forget

Plan written. Never updated. Status section empty even though work is underway.

The plan becomes fiction within a week. Refuse this by making status updates a hard requirement of the discipline — every meaningful event (slice DONE, BLOCKED, risk materializing) updates the plan's status section, full stop.

### 6.2 The plan-by-committee

Many edits, no clear ownership, conflicting directives merged in.

Plans need a single owner (per [`plan-anatomy.md`](plan-anatomy.md) §1). Multiple opinions are valuable; multiple owners are not.

### 6.3 The plan-and-pray-no-one-reads-it

Plan written for show, not for execution. Receiving skills can't use it because the slices aren't clear enough to act on.

Test: hand the plan to someone (or a coding skill) who's never seen it and ask if they can start work. If no, the plan failed.

### 6.4 The plan that doesn't reference its inputs

No links to the ADR it implements, no link to the decision brief, no link to the spec.

Plans are downstream artifacts; if the upstream context can't be traced, the plan's authority is unclear and scope challenges have no grounding. Always link upward.

### 6.5 The plan that doesn't acknowledge what it's NOT

No non-goals; no out-of-scope section.

Everything is in scope by default; nothing is firmly out. Scope creep becomes unfightable. Non-goals are free protection — use them generously.

### 6.6 The replan that doesn't propagate

Plan body updated; in-flight skills working from old batons; downstream slices not informed.

Always update batons when the plan changes for in-flight work. See [`replanning.md`](replanning.md) §4.

---

## 7. How to refuse — scripts that hold under pressure

The discipline of refusing bad plans (and bad inputs to plans) survives only if there are scripts that work under deadline pressure. Some:

### "This isn't a plan yet — it's a wish list. Three questions before I can plan: outcome, risks, smallest first slice."

For the flat task list, the no-outcome plan, the no-walking-skeleton plan. Don't drift into producing a bad plan because the inputs were bad; surface the gap.

### "Let me apply story-splitting; this slice is unsizeable as written."

For the monster slice. Don't argue about whether it's "big"; just split. The result speaks for itself.

### "Spikes aren't optional here. The downstream sizing depends on the spike's answer."

For the planner who wants to skip the spike and "just decide" on an unknown. The downstream consequences are why the spike exists.

### "What's the kill criterion? When do we stop?"

The single most useful refusal question. If there's no answer, the plan has no stop condition. Insist.

### "I can't write that baton without these seven sections. Let me draft and you tell me what's wrong."

For "just write me a baton" requests with vague intent. Drafting forces the gaps to surface.

### "We're at the kill criterion. Per the plan, we stop and reassess."

For the most important refusal — honoring kill criteria when the situation tempts you to keep going. The plan named the condition; the discipline is to honor it.

### "Let me put this drift in the status section before we continue."

For the silent rewrite, the unacknowledged scope change. Don't argue about whether the change is justified; insist on traceability.

---

## Closing: the meta-refusal

When the user pushes back on any of these refusals — "but it's faster to just have a flat list," "we don't need a walking skeleton this time," "kill criteria are overkill for this work" — the question to ask back is: **what's the cost if I'm right and you're wrong?**

For a flat list: re-planning a project mid-flight is much more expensive than planning it properly once.
For no walking skeleton: integration discoveries in week 4 are much more expensive than in week 1.
For no kill criteria: sunk-cost commits to dying projects are much more expensive than honest abandonment.

The discipline of refusing bad plans isn't pedantry. It's the place where the cheapest form of risk management lives. Hold the line.

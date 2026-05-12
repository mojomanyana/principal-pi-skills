# Replanning — When the World Changes Mid-Flight

Plans are predictions about future work. Predictions get tested by reality, and reality is undefeated. **Replanning is a first-class activity, not a failure of planning.** This reference covers how to recognize when to replan, how to do it cleanly, and how to preserve plan history through the changes.

## Table of contents

1. [Refinement vs replan — the critical distinction](#1-refinement-vs-replan--the-critical-distinction)
2. [Triggers — when to replan](#2-triggers--when-to-replan)
3. [The OODA / Cynefin framing](#3-the-ooda--cynefin-framing)
4. [The replan procedure](#4-the-replan-procedure)
5. [Preserving plan history — append, don't rewrite](#5-preserving-plan-history--append-dont-rewrite)
6. [Scope creep — recognizing and handling](#6-scope-creep--recognizing-and-handling)
7. [Kill criteria revisited — when the answer is "stop"](#7-kill-criteria-revisited--when-the-answer-is-stop)
8. [Anti-patterns](#8-anti-patterns)

---

## 1. Refinement vs replan — the critical distinction

Two related operations, often conflated. Knowing which one you're doing changes the response.

**Refinement (Mode D)** — the plan's shape is right; you're sharpening a section. A slice gets decomposed because it turned out larger than estimated; a new risk is added; acceptance criteria get tightened. The DAG doesn't restructure; the outcome doesn't change.

**Replan (Mode E)** — the plan's shape is wrong, or no longer fits the situation. A slice failed and reveals a deeper problem; a constraint changed; a risk materialized and the mitigation doesn't apply. The DAG restructures; sometimes the outcome itself gets revisited.

### Why the distinction matters

- A **refinement** can happen quickly, in a single planning pass, without convening anyone.
- A **replan** changes the contract with downstream skills and stakeholders. It requires explicit acknowledgment, a status update, and often a baton update.

Confusing them is dangerous in two directions:

- **Calling a replan a refinement** lets significant changes slip past notice; downstream skills work from stale context.
- **Calling a refinement a replan** generates ceremony for routine adjustments; people stop trusting plan updates.

### Test for which one applies

Ask:

1. Does the **outcome statement** still hold?
2. Does the **walking skeleton's seam set** still cover what the plan touches?
3. Does the **critical path** still pass through the same slice IDs (with the same dependencies)?
4. Are the **risk register's top three** still the relevant top three?

If all four are yes, it's a refinement. If any is no, it's a replan.

---

## 2. Triggers — when to replan

Six common triggers. Recognize them early; the earlier you replan, the cheaper.

### 2.1 A risk materialized

A risk in the register became real. The mitigation may or may not work. If the mitigation absorbs it, that may be just a refinement (note in status, no shape change). If the mitigation fails or the materialized impact is larger than predicted, replan.

### 2.2 A spike disconfirmed an assumption

A spike was supposed to prove an approach viable; the result is "not viable" or "viable only with these new constraints." The slices that depended on the assumption need to revise.

### 2.3 An external dependency slipped or changed

The platform team's auth migration is late; the vendor changed their API; a regulatory deadline moved. Whatever depended on the external work is now affected; the plan needs to absorb the change.

### 2.4 A constraint changed

The deadline moved (in either direction); the budget changed; a non-goal became a goal. Constraints feed into the plan's structure; when they change, the plan changes.

### 2.5 A slice was harder/easier than predicted

If a slice took 3x longer than estimated, that's information. It may suggest other slices in the plan are similarly mis-sized. If easier, the freed time may unlock optional slices that were cut for scope.

A single slice misprediction is refinement; a *pattern* of misprediction across slices is replan.

### 2.6 New information surfaced during execution

The most common and least-anticipated trigger. The team building S3 discovers that the existing code has a load-bearing behavior they didn't know about; the user discovers a stakeholder who needs to be involved; the integration with another team's service revealed an undocumented contract.

This is the hardest to recognize as a replan trigger because it doesn't announce itself — it shows up as "the slice is taking longer than expected." Discipline: when a slice runs long, ask whether the cause is *misestimation* (refinement) or *new information* (replan).

---

## 3. The OODA / Cynefin framing

Two cognitive frames help decide *how* to replan, not just whether.

### OODA loop (Boyd)

Observe → Orient → Decide → Act. The fast-feedback loop for adapting to changing conditions.

- **Observe:** What's the new information? Be specific.
- **Orient:** What does this mean for the plan? What assumptions are no longer valid?
- **Decide:** Refinement, replan, or stop entirely?
- **Act:** Update the plan; produce baton updates; notify affected skills.

The loop's value is its speed. A team that closes OODA quickly stays ahead of the situation; one that doesn't gets surprised repeatedly.

### Cynefin (Snowden)

A framework for picking the right *kind* of response based on the nature of the situation:

- **Clear** (cause-effect obvious) — apply best practice. Refinement is usually enough.
- **Complicated** (cause-effect knowable with expertise) — apply good practice. Replan with the experts.
- **Complex** (cause-effect only knowable in hindsight) — probe, sense, respond. Spikes; small experimental slices; explicit replan loops.
- **Chaotic** (no cause-effect visible) — act to stabilize first, then assess. Often this means halting most of the plan, shipping a safety/rollback slice, then returning to design.
- **Confusion** (you don't know which domain you're in) — the most dangerous; the work is to figure out which domain.

When something goes wrong and you can't tell *why*, the Cynefin discipline is: **don't replan with the same techniques you'd use for routine work.** The domain may have shifted; the planning methodology may need to shift too.

---

## 4. The replan procedure

A repeatable approach for Mode E. Adapts to plan size.

### Step 1: Capture the trigger

In the plan's status section (append-only), write what changed. Date it. Be specific.

```
### 2026-05-15
- Trigger: S2 (token store) acceptance test failed at p99 > 800ms — exceeds 500ms target.
- Investigation: argon2id parameters from ADR-0014 are too expensive at our concurrency.
- Status change: S2 → BLOCKED. R2 (token-storage perf) materialized.
- Replan invoked.
```

The trigger is the seed of the replan. Future-you needs to see it.

### Step 2: Bound the impact

Which slices are affected?

- **Directly affected** — the slice that triggered the replan and any in-flight slice depending on it
- **Downstream affected** — slices whose dependencies are now in question
- **Indirectly affected** — slices whose risks just got more (or less) likely

Walk the DAG; mark each affected slice.

### Step 3: Decide the shape of the response

Three common shapes:

- **Substitution** — same slice ID, different content. ("S2 is still 'token store' but the implementation switches to bcrypt with smaller parameters.") Plan structure preserved.
- **Insertion** — a new slice (often a spike) added before existing slices can proceed. ("S2.5: re-spike token hashing parameters at production-mirror concurrency.")
- **Restructure** — the DAG changes. ("S2 splits into S2a (storage) and S2b (hashing); they're now sequential where they were parallel.")

Substitution is cheapest; insertion is medium; restructure is most expensive. Choose the cheapest that fits.

### Step 4: Update the affected sections

- **Plan body:** revise the affected slices in place. Note revision date inline ("revised 2026-05-15: hashing changed").
- **Risk register:** mark R2 as Materialized (closed if the response absorbs it; still Open if mitigation is ongoing).
- **DAG:** redraw if restructured. Recompute critical path.
- **Kill criteria:** check whether plan-level kill criteria were triggered. If yes, stop and consult the user — don't silently keep going.

### Step 5: Update batons for in-flight skills

If any skill is mid-work on an affected slice, **send a baton update** — a new baton with the same ID prefix but a `-revised-N` suffix. The update names:

- What changed in the plan
- What this means for the in-flight work (continue, pivot, stop)
- New return contract if it changed

In-flight skills working from stale batons are how silent breakage happens. Don't tolerate it.

### Step 6: Add the dated entry to the status section

The status section gets the final entry: replan complete, what changed in summary, where to find the details.

```
### 2026-05-15 (continued)
- Replan complete (insertion).
- New slice S2.5 (re-spike token hashing) added; blocks S2.
- S4, S5, S6 unblocked from S2 dependency until S2.5 resolves.
- Baton baton-2026-05-15-S2-revised-1 sent to coding skill (was mid-work on S2).
- Critical path unchanged in length; runs through S2.5 instead of through S2 directly.
```

---

## 5. Preserving plan history — append, don't rewrite

The most important discipline for live plans: **the status section is append-only**.

Why:

- **Audit trail.** Stakeholders, reviewers, and future-you need to see how the plan evolved.
- **Pattern recognition.** Repeated replan triggers in the status history reveal whether the planner is systematically off (e.g., always under-sizing by 2x — useful information).
- **Trust.** Plans that get silently rewritten lose credibility. Plans whose history is visible build trust.

### What "append-only" doesn't mean

It doesn't mean the *body* of the plan is append-only. Slices get revised in place (with revision dates noted), the DAG gets redrawn, kill criteria update. The body is a *current view*; the status section is the *change log*.

### Practical pattern

```markdown
## Status

### 2026-05-15
- ... (replan entry)

### 2026-05-12
- ... (earlier entry)

### 2026-05-10
- Plan created.
```

Newest at top; old entries never edited. Old slice content in the body may be replaced; the status section preserves the trace of why.

---

## 6. Scope creep — recognizing and handling

Scope creep is a special class of replan trigger: **new in-scope work, not in the original plan**, added during execution.

Healthy scope evolution exists ("we discovered we need to validate input X for the slice to be safe; adding it as acceptance criterion"). Unhealthy scope creep is also common.

### Tells of unhealthy scope creep

- New requirements that came from outside the plan's stakeholders ("marketing also wants…")
- "While you're in there" requests — touching adjacent code "since it's already open"
- Requirements that should be a different plan ("can you also add SMS while you do this?")
- Work added without an outcome statement update

### How to handle it

Three honest moves:

1. **Defer it.** The new work is real but not for this plan. Add it to non-goals (with a pointer to where it should be planned instead).
2. **Absorb it cleanly.** The new work is necessary and small. Add a slice (with full acceptance criteria); update the plan; surface it in the status section. Don't sneak it in.
3. **Replan around it.** The new work is necessary and large. Treat it as a Mode E replan trigger; revisit outcome statement, risks, critical path.

**Never silently add work.** The plan's value as a contract dies the moment work appears in it without traceability.

### The "small change" trap

Scope creep usually arrives as small additions, each individually defensible. The cumulative effect is the problem. Discipline: **if you've absorbed three "small" additions since the plan was written, that's a signal**. Pause; look at the cumulative drift; ask whether a replan is appropriate. The drift itself is information about whether the plan was right.

---

## 7. Kill criteria revisited — when the answer is "stop"

Most replans produce a revised plan. Some produce **the decision to stop**. This is what kill criteria exist for.

If during replan you find:

- A plan-level kill criterion was triggered
- The plan no longer serves an outcome anyone needs
- The cost of completing it exceeds the value it would deliver
- A different approach (different plan, different design) is clearly better

…the right replan output is *not* a revised plan. It's a recommendation to **abandon the plan** and either start fresh or step back to design.

This is hard. Sunk-cost is brutal; nobody wants to throw away weeks of work. Defenses:

- **Pre-committed kill criteria.** The plan named the conditions; you're honoring them, not improvising abandonment.
- **Explicit framing.** "We're at the kill criterion for R3 (vendor changed pricing model). Per the plan, we stop and reassess; this is the plan working as designed."
- **The retrospective.** When a plan is abandoned, write a final status entry: what was learned, what could have been caught earlier, what the next plan should do differently. The aborted plan becomes input to better future plans.

A plan that stops well is a feature, not a failure.

---

## 8. Anti-patterns

### The silent rewrite

Plan body changes; status section doesn't reflect it. Audit trail destroyed. Refuse.

### The replan that doesn't update batons

Plan body changes; in-flight skill is still working from the original baton. Work proceeds against stale context; surprises follow. Always propagate to live batons.

### The "we'll come back to that"

A risk materializes; planner notes "will address." Never addresses. Two slices later, the materialized risk has cascaded. Either address now or move it to a parking lot with an owner and deadline.

### The replan-by-attrition

Plan slowly loses fidelity as small changes accumulate without a real Mode E pass. After a month, the plan and reality don't match. By the time anyone notices, it's too late to do a clean replan. Discipline: at every status update, check whether the plan-as-stated still matches the work-being-done. Drift is normal in small doses; un-acknowledged drift is malpractice.

### The kill criterion that's quietly relaxed

"We hit the threshold but it's close, let's keep going." If the threshold mattered enough to set, it matters enough to honor. If the threshold was wrong, *change it explicitly* (with reasoning in the status section), don't ignore it.

---

## Closing: replanning is a skill, not a confession

A team that replans cleanly is a team learning. A team that doesn't replan is a team telling itself stories. The discipline is to make replanning *cheap and routine* — small, frequent revisions that keep the plan trustworthy — so that you never reach the state where the plan is so stale a full rewrite is needed.

If you find yourself doing a complete rewrite, it usually means several earlier signals went unattended. Look back through the status section and find them; the pattern is the actual lesson.

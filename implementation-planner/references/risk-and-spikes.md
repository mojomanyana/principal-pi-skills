# Risk and Spikes — De-risking Before Scope Commits

A plan's quality is measured most accurately by how well it handles **what could go wrong**, not how well it lists what should happen. This reference covers risk identification, the risk register, spike design, and pre-mortem integration.

## Table of contents

1. [Why risks come before tasks](#1-why-risks-come-before-tasks)
2. [The risk taxonomy — what kinds of risk exist](#2-the-risk-taxonomy--what-kinds-of-risk-exist)
3. [The risk register — structure and discipline](#3-the-risk-register--structure-and-discipline)
4. [Likelihood × impact — sane scoring](#4-likelihood--impact--sane-scoring)
5. [The spike — when, what, how, when to stop](#5-the-spike--when-what-how-when-to-stop)
6. [Pre-mortem before the plan ships](#6-pre-mortem-before-the-plan-ships)
7. [Updating risks mid-flight](#7-updating-risks-mid-flight)

---

## 1. Why risks come before tasks

A plan that lists tasks before listing risks is a plan that's optimizing for **looking organized** instead of **being defensible**. The order matters because:

- **Risks shape decomposition.** A medium-risk integration becomes a spike *or* the first vertical slice, not the third. A high-risk one-way door gets explicit reviewer assignment in the plan. You can't decide those things until you've named the risks.
- **Risks shape sizing.** A slice that depends on an unproven assumption is XL until the assumption is validated. Listing tasks first hides the unproven assumptions.
- **Risks shape sequencing.** The critical path threads through the riskiest unknown. If you don't know what's risky, you can't protect the critical path.

The workflow is therefore: **outcome → risks → walking skeleton → slices**, not outcome → slices → "oh wait, what could go wrong?"

When someone hands you a plan that's all tasks and no risks, the most valuable single intervention is: **make them list five things that could derail this plan, in order of likelihood**. The plan after that conversation will look different.

---

## 2. The risk taxonomy — what kinds of risk exist

Risk isn't monolithic. Six categories cover most engineering planning:

### Technical risk

The thing being built may not work as imagined. A new library, an unfamiliar pattern, an algorithm whose performance characteristics aren't proven for your data.

- *Example:* "CockroachDB's query planner may not handle our top-5 read patterns at the latency we need."
- *Mitigation pattern:* spike + measurement.

### Integration risk

The seams between components don't behave as the docs say. External APIs return things their docs don't mention; internal services share assumptions no one wrote down.

- *Example:* "Our email vendor's webhook delivery is documented at 99.9% but we've observed 97% in their status page; reset flow may silently drop emails."
- *Mitigation pattern:* walking skeleton + production observation.

### Operational risk

The thing works in dev and fails in prod. Capacity, monitoring gaps, deploy choreography, rollback feasibility.

- *Example:* "Backfill rate at observed dev speeds would take 14 days against production data; production replication lag tolerances may be exceeded."
- *Mitigation pattern:* explicit operational slice (limits, alerts, runbooks) + load-testing slice.

### Security and compliance risk

What gets exposed if it goes wrong. Auth boundaries, data handling, PII, regulated workflows.

- *Example:* "Password reset tokens stored unhashed would constitute a credential leak vector under our threat model."
- *Mitigation pattern:* explicit security acceptance criteria + reviewer requirement on one-way doors.

### Coordination risk

Other people don't deliver what you assumed they would when you assumed it. Dependent teams, shared platforms, vendor SLAs, individual key-person availability.

- *Example:* "Platform team's auth migration lands week 6; we depend on it for S5; if it slips, we're blocked."
- *Mitigation pattern:* explicit dependency in the plan + a fallback slice that doesn't require the dependency, or a kill criterion that triggers replan if the dependency slips past date X.

### Scope risk

The thing we agreed to build will quietly grow during execution. New stakeholders, new requirements, "while you're in there" requests.

- *Example:* "Marketing has expressed interest in attaching campaign tracking to the reset flow; this is not in scope but is likely to come up."
- *Mitigation pattern:* explicit non-goals (see [`plan-anatomy.md`](plan-anatomy.md) §4) + a written deferral policy.

For every plan, walk the taxonomy. Not every category will have a real risk every time — but checking the list catches blind spots. Coordination risk and scope risk especially tend to be invisible until they bite.

---

## 3. The risk register — structure and discipline

Inline in the plan for ≤5 significant risks; standalone for larger registers (see [`../assets/risk-register.md`](../assets/risk-register.md)).

Each entry has the same fields:

| Field | What it captures | Discipline |
|---|---|---|
| **ID** | `R1`, `R2`, ... | Plan-scoped; never reused. Mentioned in slice "depends on" or "mitigated by" fields. |
| **Category** | One of §2 above | Helps spot taxonomy gaps. |
| **Description** | One sentence, specific | Not "tech might break." Name what, where, and how. |
| **Likelihood** | L / M / H | See §4. |
| **Impact** | L / M / H | See §4. |
| **Mitigation** | What's being done | Either a slice ID (S1.5 spike, S3 implementation), an operational practice (reviewer, monitor), or "accepted." |
| **Status** | Open / Mitigating / Materialized / Closed | Updates as work proceeds. |
| **Owner** | Who watches this risk | Often the plan owner; sometimes a domain expert. |

### Risks have IDs because the rest of the plan references them

- Slice S1.5 has `Mitigates: R1, R3` in its metadata
- Slice S3's kill criterion may be `If R2 materializes, abandon S3 and use fallback (S3.alt)`
- The status section logs `R5 materialized on 2026-05-12` with a pointer to the baton produced in response

Without IDs, the risk register is decoration. With IDs, it's load-bearing.

### "Accepted" is a legitimate mitigation

Not every risk gets a spike or a mitigation slice. Sometimes the right answer is:

> R7: Vendor's rate limit may throttle us at peak. Accepted — we have observed peak load <50% of limit; if R7 materializes, we'll see it in monitoring before user impact and can mitigate reactively.

Document the *reasoning* for acceptance, not just the word "accepted." Future-you needs to see why this was deemed not worth a spike. (Hindsight bias is brutal; the reasoning is the defense.)

---

## 4. Likelihood × impact — sane scoring

Three-by-three is enough. Don't go finer.

### Likelihood

- **L (Low):** Plausible but we'd be surprised. Maybe 1 in 10 plans of this shape would see this materialize.
- **M (Medium):** Genuinely possible. We'd not be surprised either way.
- **H (High):** Expect it to happen unless mitigated. The default outcome.

### Impact (if it materializes)

- **L (Low):** A day or two of disruption; absorbed by buffer.
- **M (Medium):** Replan a section; one or two slices reshaped.
- **H (High):** Plan-level reshape; possible return to architecture; user-visible delay or quality cost.

### Scoring rules

- **High likelihood × any impact** → spike or fold into a slice. Don't ship a plan with H-likelihood risks "accepted."
- **High impact × any likelihood ≥ L** → at minimum, a named mitigation. H-impact risks always deserve attention, even when they're low-likelihood — the asymmetry of consequences justifies the attention.
- **M × M** → mitigation in plan; accept only with documented reasoning.
- **L × L** → log and accept.

Don't average L×L=4 vs H×L=6 as if they're commensurate. The scoring is a *prompt for action*, not a math output.

### Anti-pattern: the "everything is medium" register

If every risk is M×M, the planner hasn't actually thought about each one. Push back: "Which of these is the one you'd lose sleep over? Which is the one where you'd be surprised either way?" The forced ranking surfaces real judgment.

---

## 5. The spike — when, what, how, when to stop

A **spike** is a time-boxed investigation with a written deliverable and no production code. It is the primary tool for de-risking technical and integration unknowns.

See [`decomposition.md`](decomposition.md) §6 for the slice-level treatment. This section is the design guide for the *spike itself*.

### When a spike is the right answer

Use a spike when:

- The risk is **about whether the chosen approach will work**, not about how to do something well-understood.
- The cheapest path to evidence is **a small, focused experiment**, not reading docs or guessing.
- The downstream slices cannot be sized without the spike's answer.

Do **not** spike when:

- You're avoiding committing to a slice because you're unsure (that's procrastination dressed up as rigor — write the slice, with a kill criterion).
- The question is "how should we design this?" (that's an architecture handoff, not a spike).
- The work is well-understood — you don't need to spike a well-known pattern just because it's new to *you*; read first, then write a slice.

### Designing the spike — the seven-line spike spec

```
Spike: <single sharp question>
Time box: <hours or days>
Method: <how the answer will be obtained — benchmark, prototype, doc read, vendor call>
Deliverable: <path to the artifact — 1-pager, benchmark file, decision memo>
Acceptance: <what makes this spike "done">
Kill: <when to stop short and re-scope>
Handoff back: <who picks up; usually implementation-planner to revise affected slices>
```

That's the whole spike. If the spec is longer than seven lines, it's not a spike — it's a project. Decompose.

### The time-box is sacred

Spikes blow their time-box more often than slices do, because "just a little more investigation" is seductive. Defenses:

- **Write the deliverable's outline first.** What's the shape of the 1-pager? What sections does it have? "Conclusion: ___; Evidence: ___; Risks remaining: ___." The blanks force the spike to focus on filling them.
- **Halfway check-in.** At 50% of the time-box, write down what's been learned so far. If the deliverable is no closer than at the start, abort — the spike's method was wrong.
- **Inconclusive is a valid result.** "We spiked CockroachDB for 2 days; we got it connected and ran 3 of the 5 queries; results are inconclusive because the test data was too small to be representative. Recommendation: either invest another 3 days in a representative-scale spike, or de-risk a different way." This is a useful output. Don't extend the spike to manufacture a conclusion.

### The spike's deliverable is the artifact, not the code

Whatever the spike produces — benchmark results, a prototype, a notebook — is **discarded** once the deliverable is written. The deliverable (1-pager, decision memo, benchmark table) is what feeds the plan revision.

Reusing the spike code in production is the most common spike-misuse pattern. The spike code was optimized for *learning*; production code is optimized for correctness, maintainability, and team understanding. They have nothing in common.

If the spike code is so good that it feels wasteful to discard, the answer is: write an implementation slice that *re-implements* the same approach with full rigor, citing the spike as evidence for the approach. The plan revision is the place this gets recorded.

---

## 6. Pre-mortem before the plan ships

Before delivering any non-trivial plan, run a **pre-mortem** (Gary Klein, 1989). The procedure:

> "Imagine it's three months from now and this plan has failed catastrophically. What happened?"

Generate five to ten failure modes, written down. Then for each, ask:

1. Is this in the risk register? If not, add it.
2. Does the plan's structure mitigate it? If not, what would?
3. Is there a slice or spike that should be added?
4. Is there a kill criterion that would catch this early?

The pre-mortem is the cheapest single quality-improvement step for a plan. Plans that survive a pre-mortem are visibly different from plans that don't.

### Make the pre-mortem an artifact

Drop the failure modes (and what was done about each) at the end of the plan, in a small section. Future-you will be grateful — both for what was caught, and for the discipline trace.

### Anti-pattern: the friendly pre-mortem

A pre-mortem that surfaces only mild, easy-to-mitigate failures isn't doing its job. Push for *catastrophic* failures: "the user data was corrupted," "we shipped a security regression," "we missed the deadline by a quarter." If those failure modes haven't been considered, the plan is brittle.

This is also where to consider **adversarial scenarios**: what if a malicious user does X? What if a buggy upstream service spams the endpoint? What if the database is in a partial failure state when the migration runs? Engineering plans are written for happy infrastructure; the real world isn't always happy.

---

## 7. Updating risks mid-flight

The risk register is alive. It updates as:

- **A risk materializes.** Status → Materialized. The plan's status section logs the event; a baton is produced if a skill needs to respond. The slice(s) affected may move to BLOCKED or SCOPE CUT.
- **A risk is closed.** A spike answered the question; a slice shipped the mitigation. Status → Closed. The risk stays in the register (for the audit trail) but no longer demands attention.
- **A new risk is discovered.** Get a new ID; add it. Don't retrofit it into an existing ID number — the audit trail is more valuable than tidy numbering.
- **A risk's likelihood or impact changes.** Update it, with a dated note in the status section. "R2 likelihood downgraded M → L after S0 walking skeleton observed clean integration with vendor."

### Materialized risks deserve a debrief

When a risk materializes, the plan's status update is not the end of the story. Briefly capture:

- Did we see it coming? (Was it in the register at the right severity?)
- What was the trigger? (What signal would have given us more warning?)
- Did the mitigation work? (If yes, codify the practice; if no, why not?)

Two sentences each. This is the input to *better risk registers* on future plans. Without it, every plan re-discovers the same risks the hard way.

---

## A worked example: risk register for password reset v2

```
| ID  | Category     | Description                                                | L | I | Mitigation             | Status   | Owner |
|-----|--------------|------------------------------------------------------------|---|---|------------------------|----------|-------|
| R1  | Integration  | SES rate limit at peak may throttle reset emails           | M | H | Spike S1.5 (2 days)    | Open     | <user> |
| R2  | Security     | Tokens stored plaintext = credential leak vector           | L | H | ADR-0014 mandates hash | Mitigating (S2) | <user> |
| R3  | Coordination | Platform team's auth migration may slip past week 6        | M | M | Fallback slice S5.alt  | Open     | <user> |
| R4  | Scope        | Marketing may request campaign tracking on reset flow      | H | L | Non-goal in plan §4    | Accepted | <user> |
| R5  | Operational  | Legacy users with bounced emails have no reset path        | M | M | Spike S0.5; may need S6 | Open    | <user> |
```

Five risks, each from a different category, each with a real mitigation. The spikes (S0.5, S1.5) are first-class slices in the plan, scheduled before the slices they de-risk. The fallback slice (S5.alt) is a sibling to S5 in the DAG, ready to swap if R3 materializes.

This is the level of crispness expected in any non-trivial plan. Anything less is incomplete.

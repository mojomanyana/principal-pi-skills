# Convergent Evaluation

Methods for the **Deliver** phase — taking the roster of options from Develop and narrowing to a decision. The discipline here is the inverse of divergence: judgment is now in the foreground, but it must be applied evenly across all options, not selectively against the ones you instinctively dislike.

The most common Deliver failure is **selective rigor** — applying tough evaluation to options the user is skeptical of, and waving through the option they already wanted. The techniques below are partly methods, partly disciplines for staying honest.

## Contents

1. [The cardinal rules of convergence](#cardinal-rules)
2. [Reversibility — one-way vs two-way doors](#reversibility) — the most important question
3. [Impact / Effort 2×2](#impact-effort) — fast triage
4. [ICE and RICE scoring](#ice-rice) — comparable numbers
5. [MoSCoW](#moscow) — scope-cutting framework
6. [Kano model](#kano) — distinguishing types of value
7. [NUF test](#nuf) — three-question gut check
8. [Cost of Delay](#cost-of-delay) — when timing matters
9. [Decision rule selection](#decision-rule) — picking a tiebreaker before scoring
10. [Selection guide](#selection-guide)

---

## Cardinal rules

1. **Evaluate every option with the same rigor.** If you steel-man option A, steel-man option B. If you pre-mortem one, pre-mortem all.
2. **Decide on a decision rule before scoring.** "We'll pick the option with the best ICE score" is a different commitment from "we'll pick whichever fits the budget first." Commit before the numbers exist — otherwise the rule will be chosen post-hoc to favor the answer the user already wanted.
3. **"Do nothing" is a real option.** Score it. Sometimes it wins. If you can't articulate why doing nothing is worse than the chosen option, you don't actually have a decision — you have an action bias.
4. **Reversibility first, score second.** A high-scoring one-way door is usually a worse choice than a slightly-lower-scoring two-way door. Score within reversibility class, not across.
5. **Be explicit about what you're trading away.** Every decision sacrifices something. Name it. Decisions with no stated trade-off are usually under-examined.

---

## Reversibility — one-way vs two-way doors

From Jeff Bezos's 1997 letter and onward. The single most important question to ask before any commitment.

**Two-way door:** the decision is cheap to reverse. Try it, see what happens, undo if it doesn't work. Examples: a feature flag rollout, a name choice for an internal project, a tool trial, a hiring sequence (interviewing isn't hiring).

**One-way door:** the decision is expensive or impossible to reverse. Examples: a public product launch, a database engine choice, a legal entity formation, a tattoo, a multi-year contract, a fired senior employee, a security incident disclosure.

**Why it matters:**
- Two-way doors warrant **fast, light-touch decisions**. Excessive deliberation on a reversible call is itself the failure mode.
- One-way doors warrant **slow, heavy deliberation**. The cost of getting it wrong includes the cost of the lock-in.

**Test for which it is:**
- "If we did this and it didn't work, how long and how expensive is it to get back to where we started?"
- "Who or what would break if we reversed?"
- "Has someone in our reference class been stuck after making this decision?"

**The two-way-door masquerading as one-way pattern.** Common AI failure: treating every decision as one-way and deliberating endlessly. Many decisions look one-way at first glance but are actually two-way:
- "Tech stack choice" — often two-way for prototypes, one-way only after significant code.
- "Pricing change" — usually two-way; you can change it back.
- "Job offer acceptance" — surprisingly two-way; offers can be unwound in the first week.

**The one-way-door masquerading as two-way pattern.** Also common:
- "Let's just try MongoDB and switch later if needed" — switching databases at scale is a one-way door.
- "We'll just A/B test it" — once users see a feature, removing it generates backlash.
- "I'll just send the message" — interpersonal communication is one-way.

**The output of this analysis:** classify the leading candidate explicitly. The decision brief always includes a reversibility line.

---

## Impact / Effort 2×2

The fastest triage tool. Plot each option on a 2×2 grid: impact (low → high) on one axis, effort (low → high) on the other.

```
              EFFORT
            Low    High
         ┌──────┬────────┐
    High │ DO   │ MAYBE  │
  IMPACT │      │ (plan) │
         ├──────┼────────┤
    Low  │ MAYBE│ DROP   │
         │(fill)│        │
         └──────┴────────┘
```

**Quadrant rules:**
- **High impact / low effort:** do first. (Sometimes called "quick wins.")
- **High impact / high effort:** plan carefully. These are real bets — worth doing, but warrant the full Deliver rigor.
- **Low impact / low effort:** fill-in. Only do if zero opportunity cost.
- **Low impact / high effort:** drop. The most common failure mode is doing these because someone got attached.

**Common failure:** the user puts everything in "high impact / low effort." That's a sign they haven't actually estimated either axis honestly. Make them defend each placement.

**When to use:** more than 4–5 options, need to triage fast. For 2–3 options, this is overkill; go straight to ICE.

---

## ICE and RICE scoring

When you need a number to compare options that aren't obviously different in size.

### ICE

For each option, score 1–10 on:
- **Impact** — how much does this move the needle if it works?
- **Confidence** — how sure are we it'll work?
- **Ease** — how cheap is it to do? (Inverted effort — high = easy.)

`ICE score = Impact × Confidence × Ease`

### RICE

A refinement when scale of reach matters (e.g., comparing features for different user segments):

- **Reach** — how many people / events / units affected
- **Impact** — magnitude per affected unit (a multiplier, e.g., 0.25 / 0.5 / 1 / 2 / 3)
- **Confidence** — your certainty (50% / 80% / 100%)
- **Effort** — person-weeks or hours

`RICE score = (Reach × Impact × Confidence) / Effort`

**The truth about ICE/RICE scores:** the numbers are not real. They're a way to force comparable estimates. Two options with scores 80 and 75 are not meaningfully different. Two options with scores 80 and 20 are.

**The honest discipline:**
- Score all options before looking at any totals. Otherwise you'll tune the scores to confirm the option you already preferred.
- If the top two scores are within ~20%, treat them as tied and use a different tiebreaker (reversibility, strategic fit, team capacity).
- Re-score after the pre-mortem. Pre-mortem findings should update Confidence. If your top option survives the pre-mortem unchanged, you didn't pre-mortem hard enough.

**When NOT to use ICE/RICE:** for a strategic, one-way-door decision (e.g., "should we pivot the company?"). Numbers create false precision. Use qualitative comparison with explicit trade-off statements.

---

## MoSCoW

Originally from DSDM agile method. For scoping — when the question is "what's in and what's out?"

Categories:
- **Must have** — without this, the deliverable fails entirely
- **Should have** — important, but the deliverable still works without it
- **Could have** — nice, costs little
- **Won't have (this time)** — explicitly out of scope, not "maybe later"

**The discipline:** Musts must be small. If everything is a Must, it's a wishlist, not a plan. A rule of thumb: Musts should be no more than ~60% of the budget; otherwise there's no room for the unknown unknowns that always emerge.

**The most important category is Won't.** It's where you make sacrifice explicit. A scoping decision without explicit Won'ts is incomplete — it leaves the door open to scope creep.

**Worked example (a v1 product launch):**

- **Must:** sign-up, the one core workflow, billing, security basics, mobile-responsive
- **Should:** email digest, basic analytics, account settings page, password reset
- **Could:** dark mode, keyboard shortcuts, CSV export
- **Won't (this time):** API, Slack integration, multi-user team accounts, mobile app

Now the design space is shaped. The Should and Could categories are where you make calls when the timeline tightens.

---

## Kano model

Noriaki Kano's framework for distinguishing types of value. Use when the question is "what should we prioritize for users?" and the answer "everything" is failing to triage.

Three categories of features:

- **Basic (must-be):** users expect them; absence is a complaint; presence isn't praised. Login, search, save state. Failure here is catastrophic; success here is invisible.
- **Performance (one-dimensional):** more is better in a roughly linear way. Speed, capacity, accuracy. Worth investing in to a point — but with diminishing returns.
- **Delight (attractive):** unexpected, generate emotional response. Surprising features users didn't ask for but praise once they have. The novelty wears off — last year's delight becomes this year's basic.

**The Kano discipline:**
- Don't invest in delight if basics are broken.
- Don't keep optimizing performance past the point where users stop noticing.
- Don't expect delight features to retain their delight quality forever.

**Worked example (a calendar app):**
- Basic: sync, reliable reminders, can-create-an-event-in-under-3-taps. Break these and the app is unusable.
- Performance: load speed, sync latency, search precision. Better is better, but only until they're "good enough."
- Delight: natural-language event entry, AI-suggested meeting times, slack-integrated availability. Today's wow; tomorrow's baseline.

**When to use Kano:** prioritizing features within a product. Less useful for evaluating one-shot decisions.

---

## NUF test

A three-question gut check. Fast and surprisingly effective.

For each option, ask:
- **N — New:** is it genuinely new to this context, or recycled?
- **U — Useful:** does it solve the problem (not "is it interesting")?
- **F — Feasible:** can it actually be done with current resources?

Score each yes/no or low/medium/high. An option that's all three is a strong candidate. An option that fails N (recycled and predictable) might still win on U and F.

**The point of NUF:** it surfaces the difference between "exciting" and "useful." Many AI-generated brainstorm options are New and Feasible but not Useful. The Useful column is the one to be ruthless on.

---

## Cost of Delay

From Donald Reinertsen. The question: what's the cost per unit of time of NOT having this?

**The insight:** prioritization usually ignores time. Two features with the same effort and the same total value can have very different costs of delay — and the higher-cost-of-delay one should ship first.

**Estimation:** for each option, sketch the answer to: "if this is delayed by 1 month, what does it cost us?" Sometimes the answer is trivial ($0 — it's not on a deadline). Sometimes it's a stepped function (nothing for 3 months, then a cliff when a competitor launches). Sometimes it's linear ($1k/week of foregone revenue).

**When it matters:** when you have multiple worthwhile options, all feasible, and you're choosing order. Cost of delay is the right tiebreaker.

**When it doesn't:** for one-shot or no-deadline decisions. Don't manufacture a cost-of-delay number where one doesn't exist.

---

## Decision rule selection

Before you score anything, **commit to a decision rule.** The rule is the criterion that, when applied to the scored options, names the winner.

Common rules:

| Rule | When it fits |
|------|--------------|
| Highest ICE/RICE score wins | Comparable options, similar reversibility |
| Best within budget | Constrained resources, several viable options |
| Most reversible wins | Uncertain context, willingness to learn-by-doing |
| Lowest risk wins | High-stakes, low-trust environment |
| Best strategic fit wins | When numbers undercount alignment with goals |
| The boring option wins by default | When options 1–4 are exotic and option 5 (boring) is safe — bias toward boring unless exotic wins by a wide margin |
| Coin flip if tied | When two options score within 20% — pick fast and reverse if wrong (works only for two-way doors) |

**The crucial discipline:** name the rule out loud, in writing, *before* scoring. If you pick the rule after scoring, you've reverse-engineered the rule to fit the answer you wanted. This is the single most common evaluation cheat — done unconsciously, almost universally.

---

## Selection guide

| Situation | Reach for |
|-----------|-----------|
| About to commit, not sure if reversible | Reversibility classification |
| Many options, need to triage fast | Impact/Effort 2×2 |
| 3–5 comparable options, need to compare | ICE (or RICE if reach varies) |
| Question is "what's in vs out of scope" | MoSCoW |
| Question is "what to prioritize for users" | Kano |
| Need a fast gut check | NUF |
| Question is "which order to do these in" | Cost of Delay |
| About to score options | Pick decision rule first |

---

## Exit criteria for the Deliver phase

You're ready to write the decision brief when:

1. Every option has been evaluated with the same level of rigor.
2. The leading candidate has been pre-mortemed (see [critical-pressure.md](critical-pressure.md)).
3. The reversibility classification is explicit (two-way or one-way door).
4. The decision rule was named before scoring, not after.
5. The user can state the trade-off in one sentence ("we're giving up X to get Y").
6. "Do nothing" was considered and rejected (with a reason) or chosen.
7. If the decision is "no decision yet," there's an explicit revisit trigger.

If any of these is missing, don't write the brief. The brief is a record of decision quality, not just decision content.

# Pre-mortem Template

Use this for one-way-door decisions or any non-trivial commitment. The pre-mortem is mandatory before the decision brief is written.

A pre-mortem is **not** "let me list some risks." It's a forced narrative: imagine the failure has already happened, and write the story of how. Specificity matters; vague concerns produce vague mitigations.

---

# Pre-mortem: [decision name]

**Decision under review:** [The choice we're about to commit to.]

**Timeframe of imagined failure:** [3 months / 6 months / 1 year — whatever matches the decision's natural horizon]

---

## The setup

> _Imagine it is [date + timeframe] from now. We made this decision. It failed. We are writing the post-mortem._

---

## Failure narrative 1 — [most likely failure mode]

**Headline:** [One sentence describing what happened.]

**The story:**
[2–4 paragraphs. Specific. Concrete. Names roles, specific events, specific signals. NOT "things went wrong" — describe the actual chain.]

**Root cause hypothesis:**
[The underlying thing that made this failure possible. Often an assumption that turned out to be false, a constraint that was underestimated, or an external event that wasn't planned for.]

**Early-warning signals we could have caught:**
- [Signal 1] — observable when, by whom?
- [Signal 2] — ...

**Mitigation (if we want to address this failure mode):**
- [Action 1]
- [Action 2]

**Or — conscious acceptance:**
> [If we accept this risk consciously, the trade-off statement is: "We accept [failure mode] in exchange for [benefit of the decision]." Document this; it changes the failure from "unforeseen" to "known and accepted."]

---

## Failure narrative 2 — [external / market failure mode]

**Headline:**

**The story:**
[Focus on things outside our control: market shifts, competitor moves, technology changes, regulatory shifts, key dependencies failing.]

**Root cause hypothesis:**

**Early-warning signals:**

**Mitigation or acceptance:**

---

## Failure narrative 3 — [embarrassing / "we should have seen it" failure mode]

**Headline:**

**The story:**
[The failure that, in retrospect, was obvious. Often a known weakness that was discounted. Force yourself to write the version your harshest critic would describe.]

**Root cause hypothesis:**

**Early-warning signals:**

**Mitigation or acceptance:**

---

## Summary

**Ranked failure modes (likelihood × severity):**

| # | Failure mode | Likelihood | Severity | Mitigation chosen |
|---|--------------|-----------|----------|-------------------|
| 1 | | High / Med / Low | High / Med / Low | [action / accept] |
| 2 | | | | |
| 3 | | | | |

**Decision implications:**
- Mitigations to build into the plan: [list]
- Risks consciously accepted: [list with explicit trade-off statements]
- Kill criteria — what would trigger reversing this decision: [list, with observable signals]

---

## Pre-mortem self-check

Before accepting this pre-mortem as complete, verify:

- [ ] At least 3 distinct failure narratives, not variations of one.
- [ ] Each narrative is concrete (names roles, signals, events — not "things go wrong").
- [ ] At least one narrative is uncomfortable to write (the "embarrassing" one).
- [ ] Each failure mode has either a mitigation OR a conscious-acceptance trade-off statement.
- [ ] Kill criteria are observable, not "we'll know it when we see it."
- [ ] The leading candidate took real damage from this exercise. If everything is "low likelihood, low severity," the pre-mortem was theater.

If 2+ items are unchecked, re-run the pre-mortem. The cost of running it again is small; the cost of skipping it is the failure.

# Decision Brief

The output artifact of every brainstorming session. Replace the bracketed prompts. Sections marked **[required]** must be filled; sections marked **[if applicable]** may be omitted if they truly don't fit the situation (but the user should agree before you skip).

The brief is what hands off to the next skill or to the user's future self. Write it so that a person reading it cold — including the user 3 months from now — has everything they need.

---

# Decision Brief: [topic]

**Date:** [YYYY-MM-DD]
**Session mode:** [A / B / C / D / E]
**Status:** [Decided | Deliberate hold | Decision deferred, with revisit trigger]

---

## 1. The question, reframed [required]

**What we set out to ask:**
> [The user's opening framing.]

**What we actually decided we were asking:**
> [The reframed question, after Discover/Define. If unchanged, say so.]

**Why the reframe matters (if there was one):**
[1–2 sentences. What the original framing was missing. Skip if no reframe.]

---

## 2. Constraints and assumptions [required]

**Hard constraints (must hold):**
- [Constraint 1]
- [Constraint 2]

**Soft constraints (prefer to hold):**
- [Constraint 1]
- [Constraint 2]

**Explicit non-constraints (we chose not to be limited by):**
- [Non-constraint 1, with the reason we lifted it]

**Assumptions we made:**
- [Assumption 1] — [verified / unverified — what would invalidate it?]
- [Assumption 2] — [...]

---

## 3. Options considered [required — at least 3]

| # | Option | One-line description | Pros | Cons | Reversibility |
|---|--------|----------------------|------|------|---------------|
| 1 | [Name] | | | | Two-way / One-way |
| 2 | | | | | |
| 3 | | | | | |
| 4 (do nothing) | Status quo | What happens if we keep the current path | | | n/a |

**Options the user had already rejected before the session, and why:**
- [Rejected option] — [reason] — [validated as rejection, or re-surfaced for reconsideration?]

**Steel-man of the strongest rejected option:**
> [The best case for the runner-up. Documented so that if the chosen path fails, this is where to look first.]

---

## 4. Pre-mortem on the chosen path [required if non-trivial commitment]

> _Imagine it's [timeframe] later. The decision failed. The story is:_

[Concise version of the pre-mortem. Full detail in the pre-mortem template if a longer artifact was produced.]

**Top failure modes:**
1. [Mode] — [Likelihood × severity] — [mitigation OR conscious acceptance]
2. [Mode] — [...]
3. [Mode] — [...]

---

## 5. Decision [required]

**The decision:** [What was chosen, in one sentence.]

**Decision rule used:** [The criterion we picked BEFORE scoring — e.g., "best ICE within budget", "most reversible," "the boring option unless an exotic wins by 50%."]

**Why this option, in one paragraph:**
[The rationale. What it does that others don't. The trade-off being made.]

**What we're explicitly trading away:**
> [The cost of this choice. Every decision sacrifices something — name it.]

---

## 6. Reversibility [required]

**Classification:** [Two-way door | One-way door]

**If two-way door:** how would we reverse, and when would we?
- Trigger: [observable signal that would warrant reversal]
- Mechanism: [how reversal would actually happen]

**If one-way door:** what's the revisit trigger?
- Trigger: [observable signal that would warrant revisiting the decision]
- Threshold: [how strong does the signal need to be?]

---

## 7. Open questions [if applicable]

Things we deliberately did NOT decide in this session, and what would need to be true before we do:

- [Question] — [what's needed to answer it]
- [Question] — [...]

---

## 8. Handoff [required]

**The next step is owned by:** [Person / role / next session / next skill]

**If software architecture:**
> Hand off to `software-architect` skill. Key inputs: [decision summary, quality attributes, constraints].

**If implementation (non-trivial, multi-step):**
> Hand off to `implementation-planner` skill. Key inputs: [decision summary, acceptance criteria, constraints].

**If implementation (small, single-slice):**
> Hand off to `implementation-planner` skill (it produces the coding spec for the coder). Key inputs: [decision, acceptance criteria, files of interest].

**If further brainstorming on a sub-question:**
> Open a new session focused on [sub-question]. Carry forward: [the parts of this brief that should remain stable].

**If the next step is non-software (write something, schedule something, talk to someone):**
> [Plain English description of what's next.]

**Do NOT invoke the next skill from this session.** The user runs the next step. This brief is the handoff package.

---

## 9. Session notes [optional]

Things worth remembering that don't fit elsewhere:

- [Bias caught and corrected during the session]
- [Useful analogy that surfaced]
- [Question we should have asked sooner]
- [Thing the user said that we should remember when revisiting]

---

## 10. Self-check

Before sharing this brief, verify:

- [ ] At least 3 options were considered (including "do nothing").
- [ ] The chosen option survived a real pre-mortem (not theater).
- [ ] Reversibility is named.
- [ ] The trade-off is named in one sentence ("we're giving up X to get Y").
- [ ] The handoff points to a specific next step, not "figure out what's next."
- [ ] The user agreed with the reframing (if there was one) — not just nodded through it.

If any of these is unchecked, the brief is incomplete. Fix before delivering.

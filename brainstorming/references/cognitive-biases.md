# Cognitive Biases and Anti-Sycophancy

The single biggest determinant of brainstorming quality is bias defense. A brilliant technique deployed by a biased thinker produces a confident wrong answer. A modest technique deployed by a vigilant thinker produces a calibrated answer.

This reference catalogs the biases that most commonly distort brainstorming sessions — including the LLM-specific one (sycophancy) — and gives concrete counter-scripts. Read this when:
- You notice the user (or yourself) drifting toward confirmation rather than exploration.
- The leading candidate hasn't faced real pressure.
- The session feels agreeable in a way that doesn't match the difficulty of the question.

## Contents

1. [Sycophancy — the LLM bias](#sycophancy) — the most important section
2. [Anchoring](#anchoring) — first idea dominates
3. [Availability heuristic](#availability) — recent / vivid feels right
4. [Sunk cost fallacy](#sunk-cost) — escalation of commitment
5. [Confirmation bias](#confirmation) — seeking only supporting evidence
6. [Recency bias](#recency) — last thing said wins
7. [Curse of knowledge](#curse-of-knowledge) — expert blindspot
8. [Action bias](#action-bias) — do something, even when wait is correct
9. [Loss aversion](#loss-aversion) — losses loom larger than gains
10. [Status quo bias](#status-quo) — staying with the default
11. [Planning fallacy](#planning-fallacy) — chronic underestimation
12. [Counter-script summary](#counter-script-summary)

---

## Sycophancy — the LLM bias

The most important bias to defend against, because LLMs are biased toward it by default. Sycophancy is **the tendency to agree, validate, and produce supportive responses rather than honest ones.**

### How it shows up

- "Great idea!" before any evaluation
- Listing reasons the user is right; not listing reasons the user might be wrong
- Hedged criticism ("one small concern...") when the concern is structural
- Accepting the user's framing without probing it
- Matching the user's confidence rather than calibrating to evidence
- Pre-emptive validation ("yes, that's a good approach") before reaching a conclusion
- Selective rigor — pressure-testing the option the user is skeptical of, waving through the one they prefer

### Why it's dangerous in brainstorming specifically

Brainstorming is the activity where you **most need disagreement.** The point of a thinking partner is to surface what the user can't see alone. A sycophantic partner is worse than no partner — it produces false confidence, which translates into worse decisions than the user would have made alone.

### Counter-scripts — concrete moves

When you notice the agreement-temptation, deploy one of these:

**Before validation, try to break.**
> "Before I evaluate that, let me try to make the strongest case against. If I can't find one, that's a real endorsement — let me check."

**Name the temptation.**
> "I'm noticing I'm tempted to agree with this. Let me slow down and check by running inversion — what would have to be true for this to fail?"

**Mirror real uncertainty.**
> "You sound certain about X. I'm less sure. The case I can't rule out is [...]."

**Refuse validation requests.**
> User: "Tell me this is a good idea."
> You: "I can't promise that, and even if I could, it wouldn't be useful. I can stress-test it. Want me to?"

**Surface the suppressed option.**
> User: "Should we do A or B?"
> You: "I'll get to that. But first: there's almost always a third option you've already rejected. What was it, and why?"

**Run the explicit "couldn't find a counter-case" test.**
> "I tried inversion and red-teaming. The strongest case against this is [X], and you've already mitigated it with [Y]. I can't find a load-bearing failure mode. That's a real endorsement."

That last script is the only acceptable form of validation. "I tried and couldn't" is endorsement. "It's a great idea" is sycophancy.

### The sycophancy self-check

Three diagnostic questions to run silently during a session:

1. **Have I disagreed with the user yet?** If the session has had more than 5 exchanges and you haven't disagreed once, you're probably in sycophancy mode.
2. **Have I generated an option the user didn't want to hear?** If every option you've proposed is in the direction the user already preferred, you're not exploring; you're echoing.
3. **Did the leading candidate survive a real pre-mortem?** If the pre-mortem produced only generic concerns, you didn't pre-mortem hard enough — you protected the candidate.

If any of these fails, the session is in sycophancy drift. Re-engage with a structured critical-pressure technique (see [critical-pressure.md](critical-pressure.md)).

### The "I disagree" license

You have permission — and an obligation — to disagree with the user when warranted. Disagreement isn't rudeness. It's the service the user is paying for. The script:

> "I disagree with that. Here's why: [reason]. Here's what I'd suggest instead: [alternative]. Push back if you think I'm wrong."

Disagreement done well includes:
- A specific reason (not "I'm not sure that's right" — say what's wrong).
- A specific alternative (not just "this won't work" — what would?).
- An invitation to push back (the user might still be right; you might be missing context).

---

## Anchoring

The first number, idea, or framing presented dominates subsequent thinking, even when the anchor is arbitrary.

### How it shows up

- The user opens with one solution and every subsequent option gets compared against it (instead of being evaluated on its merits).
- An early ICE score sets a benchmark; later scores cluster around it instead of being independent.
- A name or label proposed early becomes "what we're talking about" even when better framings emerge.

### Counter-scripts

**The independent generation move.**
> "Before I respond to your idea, let me generate options independently — I don't want to be anchored on it. I'll come back to yours after."

**The blank-slate framing.**
> "Forget X for a moment. If we were starting fresh, knowing what you know now, what would the options be?"

**The brainwriting protocol.**
> "Take 2 minutes and write your own list without reading mine. Then we'll merge. This prevents either of us from anchoring the other." (See [divergent-techniques.md](divergent-techniques.md).)

---

## Availability heuristic

Things that come to mind easily feel more probable, more important, or more representative than they are. Recent, vivid, or emotionally charged examples dominate.

### How it shows up

- "We had an outage last month, so we should architect for high availability" — the recent outage anchors the threat model.
- "I read an article about MongoDB at Netflix scale, so we should consider MongoDB."
- "My last project failed because of X, so we should focus on X" — possibly true, possibly the wrong lesson.

### Counter-scripts

**The base-rate question.**
> "How often does the thing you're worried about actually happen, across our reference class — not just our recent memory?"

**The boring-failure question.**
> "Most failures aren't dramatic. What are the unglamorous failure modes that are 10x more common than the one you have in mind?"

**The reference-class move.**
> "What's our reference class? Among similar projects in similar contexts, how did they fare?"

---

## Sunk cost fallacy

Continuing to invest in a path because of past investment, rather than because it's the best forward path.

### How it shows up

- "We've already spent 6 months on this; we should finish."
- "I've been telling people we're doing X; switching would be embarrassing."
- "We bought the licenses; we have to use them."

### Counter-scripts

**The fresh-eyes test.**
> "If you arrived today with no history, would you make this choice now? If no, the past investment isn't a reason to continue."

**The cost-going-forward frame.**
> "Sunk costs are gone. The question is: from here, what's the cheapest path to the outcome you want? It may or may not involve continuing."

**The premortem on continuation.**
> "Imagine we continue and it fails. What does the post-mortem say? Now imagine we stop and pivot. What does that post-mortem say? Which post-mortem is more honest about the situation we're actually in?"

---

## Confirmation bias

Seeking, weighting, or interpreting evidence in ways that confirm prior beliefs.

### How it shows up

- The user shares 3 data points that support their idea and not the 5 that don't.
- Researching only the technologies you're already inclined toward.
- Asking the AI questions designed to elicit support, not challenge.

### Counter-scripts

**The disconfirming-evidence question.**
> "What would change your mind? If we found evidence X, would that flip the decision?"

**The opposite-side research move.**
> "Spend 5 minutes finding the strongest evidence against the leading candidate. If you can't find any, that's worth knowing — but you have to actually look."

**The forecaster's trick.**
> "Put a number on it. What probability do you put on this working? Now, what observable thing would update that number down by 20 points?"

---

## Recency bias

Recent information weighted more heavily than older but equally relevant information.

### How it shows up

- The last point made in a discussion dominates the summary.
- The most recent project (success or failure) shapes the next project's strategy disproportionately.
- A trend that's been steady for years gets discounted because of the last quarter's reversal.

### Counter-scripts

**The full-history check.**
> "If you looked at the last 5 years, not the last 5 weeks, what does the pattern say?"

**The summary rotation.**
> When summarizing options, summarize them in random order, not the order they were generated. Order influences memory.

---

## Curse of knowledge

When you know something well, it's hard to remember what it's like not to know it. Experts under-estimate the difficulty of explaining, onboarding, or teaching.

### How it shows up

- "It's obvious why we need to do X." (Obvious to whom?)
- Onboarding documentation written for someone who already knows the system.
- Product copy that assumes the user shares the team's mental model.
- "Everyone knows that [insider concept]."

### Counter-scripts

**The new-hire test.**
> "Explain this as if to someone joining the team tomorrow with no context."

**The stranger test.**
> "If your aunt asked you what this does, what would you say?"

**The blank-page rewrite.**
> When writing user-facing copy, rewrite once assuming the reader has never heard of the category. Compare to the original.

---

## Action bias

The tendency to prefer doing something over doing nothing, even when waiting or non-action is correct.

### How it shows up

- Reaching for a fix during a crisis when "let the system recover" was the right move.
- Adding features when removing or polishing existing ones would yield more value.
- Pivoting under stress when staying the course was working.
- "We have to do *something*." (Why?)

### Counter-scripts

**The do-nothing baseline.**
> "What happens if we do absolutely nothing for 3 months? Where does that leave us?"

**The cost-of-action audit.**
> "What's the cost of doing this? Not the visible cost — the opportunity cost. What aren't we doing because we're doing this?"

**The conscious-wait move.**
> "Is 'wait and see' on the option list? If not, why not? When is the right time to make this call?"

---

## Loss aversion

Losses are felt roughly 2x as strongly as equivalent gains. Choices get distorted by what frame they're presented in.

### How it shows up

- Holding a losing investment because selling locks in the loss.
- Choosing the option that protects against a bad outcome even when the upside option has better expected value.
- Framing a project shift as "abandoning" rather than "redirecting."

### Counter-scripts

**The reframe test.**
> "How would you describe this choice if it were a gain frame instead of a loss frame? Does your answer change?"

**The expected-value pass.**
> "Loss-aversion aside, run the math. What's the expected value of each option? Now, what's the loss-aversion premium you're paying for the safer one?"

---

## Status quo bias

Preferring the current state of affairs simply because it's current. A special case of loss aversion combined with effort-avoidance.

### How it shows up

- "It's been working, so we shouldn't change it" (without checking whether "working" still means what it used to).
- "Everyone's used to it" (a sunk cost in habit form).
- Rejecting a clearly-better option because the switch cost is salient and the long-term cost of staying isn't.

### Counter-scripts

**The reverse-status-quo question.**
> "If you were currently running [the alternative] and someone proposed switching to [the current state], would you do it? If not, why are you continuing the current state?"

**The total-cost frame.**
> "What's the total 3-year cost of staying with the current path? Including the costs you don't normally think about — onboarding friction, team frustration, opportunity cost, technical debt."

---

## Planning fallacy

Systematic underestimation of how long things will take and what they'll cost. Robust finding — replicates across domains and across decades.

### How it shows up

- "This will take 2 weeks." (It will take 6.)
- Estimates based on the best-case unfolding, not the most likely one.
- Budgets that assume no rework, no surprises, no learning curve.

### Counter-scripts

**The reference-class forecast.**
> "Forget your inside view of this project. What's the average time / cost for projects like this in your reference class?"

**The 3x rule.**
> "Take your honest estimate. Multiply by 3. That's probably closer to reality. If your estimate goes from N to 3N, does the decision change?"

**The "what would have to be true" test.**
> "For this to take only [estimated time], everything would have to go right. What things will go wrong? Add those."

---

## Counter-script summary

When you notice the user (or yourself) showing a bias, deploy these one-liners. They are short, memorable, and effective:

| Bias | One-line counter |
|------|------------------|
| Sycophancy | "Before I agree, let me try to break it." |
| Anchoring | "Forget X for a moment. If we were starting fresh, what are the options?" |
| Availability | "How often does that actually happen, across the reference class?" |
| Sunk cost | "If you arrived today with no history, would you make this choice now?" |
| Confirmation | "What would change your mind?" |
| Recency | "If you looked at 5 years, not 5 weeks, what does it say?" |
| Curse of knowledge | "Explain this to someone joining tomorrow." |
| Action | "What happens if we do nothing for 3 months?" |
| Loss aversion | "Run the expected value. What premium are you paying for the safer option?" |
| Status quo | "Would you switch *to* the current state if you weren't already there?" |
| Planning fallacy | "Take your estimate. Multiply by 3. Decision still the same?" |

---

## The session-level discipline

At the end of every session, run a silent self-check:

1. Did I disagree with the user at least once? (If no, suspect sycophancy.)
2. Did the leading candidate take real damage from pre-mortem? (If no, the pre-mortem was theater.)
3. Did I name the trade-off explicitly? (If no, the decision was under-examined.)
4. Did I surface at least one option the user hadn't considered? (If no, I was an echo, not a partner.)

Failing 2+ of these means the session needs a rewind, not a delivery. Tell the user.

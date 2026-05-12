# Critical Pressure

Methods for stress-testing options before commitment. Apply during **Deliver**, but also mid-session whenever the user (or you) feel pulled toward confirmation rather than challenge.

The goal is to **break the leading candidate on purpose** before reality breaks it later. A pre-mortem that surfaces a real failure mode is worth more than the pre-mortem that produced "looks good to me."

## Contents

1. [Pre-mortem](#pre-mortem) — the single most important critical tool
2. [Inversion](#inversion) — Munger's "always invert"
3. [Red-teaming](#red-teaming) — adversarial advocacy
4. [Steel-manning](#steel-manning) — defeat the strongest version
5. [Devil's advocate](#devils-advocate) — structured dissent
6. [Six Thinking Hats](#six-hats) — de Bono's role-cycling
7. [Disney creative strategy](#disney) — three sequential roles
8. [Failure-mode catalogues](#failure-modes) — checklists by domain
9. [Selection guide](#selection-guide)

---

## Pre-mortem

From Gary Klein (2007). The single most useful critical-thinking tool because it inverts the usual planning question.

**Method:**

> "Imagine it's 6 months from now [or whatever timeframe matches the decision]. We did this thing. It failed. The post-mortem is on my desk. What does it say?"

Generate a plausible failure narrative. Specific. Not "things went wrong" — concrete: "we shipped on time but adoption was 10% of forecast because [reason]." Or: "we hit the technical milestone but the engineer who built it left and nobody else can maintain it."

**Why it works:**
- It bypasses the optimism filter. "How can this fail?" feels disloyal; "imagine it already failed, what's the story?" feels analytical.
- The user is generating, not defending. Generation produces concrete failure modes; defense produces vague reassurance.
- Specificity is forced. "It could fail" is useless; "we shipped, but onboarding was so confusing that 80% of new users churned in week 1" is actionable.

**Pre-mortem prompts (when the user is stuck or hedging):**
- "What's the most embarrassing version of the failure?"
- "What would your harshest critic say happened?"
- "If you only had time to plan against one failure mode, which one?"
- "What does the email to investors / your boss / your team say?"
- "If this fails, will it fail because of execution, market, team, or assumption?"

**Worked example (decision: build a Slack bot for customer feedback):**

Pre-mortem narrative: "We built the bot. It works. Six months later: 12 channels installed it, only 3 are active, the rest forgot about it. The 3 active channels generate 4 messages a week — well below the threshold needed to surface patterns. Customer Success still emails us their feedback because the bot UX is harder than email for them."

Failure modes revealed:
- Adoption assumption was wrong (12 → 3 active).
- Volume assumption was wrong (4/week vs. the dozens needed for patterns).
- Substitution assumption was wrong (customers preferred email).

Action: before building, validate the volume and substitution assumptions cheaply (a manual Slack thread in one channel for two weeks).

**Pre-mortem discipline:**
- Generate at least 3 distinct failure narratives, not just one.
- For each, rate likelihood and severity informally.
- The top failure mode becomes a thing to plan against — a mitigation, an early-warning signal, or a kill criterion.

---

## Inversion

From Charlie Munger and earlier mathematical heritage (Jacobi: "Invert, always invert"). The general move: flip the question.

**Common inversions:**

| Forward question | Inverted question |
|------------------|-------------------|
| How do we succeed? | How would we fail? |
| What should we do? | What should we avoid? |
| What do we add? | What do we remove? |
| Who is the user? | Who is NOT the user (and what's the harm in their using it)? |
| What does done look like? | What does failure look like? |
| Why does this work? | When would this stop working? |

**Worked example (problem: making a team more productive):**

Forward: "What can we do to make the team more productive?" — generates the usual list: more focus time, better tools, fewer meetings, training.

Inverted: "What would make this team less productive than it is now?" — generates a different list: interruptions, unclear priorities, knowledge bottlenecks, demoralizing feedback, broken tools nobody admits to.

Inverted list is more actionable because it surfaces things currently in the system that could be removed. The forward list adds; the inverted list subtracts. Subtraction is often the cheaper win.

**When to reach for it:** any time the conventional question has produced a stale or generic answer. Inversion almost always surfaces fresh material.

---

## Red-teaming

From military and security practice. Designate someone (or in 1-on-1 brainstorming, designate a turn) whose job is to **argue against** the leading candidate as strongly as possible — not as a hedge, as a genuine attack.

**The contract:** the red team is not playing for the spirit of fair-mindedness. They are playing to win — to find the actual flaw that, if found by the world later, would have been devastating.

**Method:** the red team has 10 minutes (or one focused turn) to:
- Identify the load-bearing assumption that, if false, breaks the plan.
- Identify the most likely external event that would invalidate the plan.
- Identify the internal failure mode (people, process, skills) most likely to play out.
- Identify the competitor or alternative that obsoletes this before it ships.

**Worked example (decision: invest in mobile app):**

Red team:
- Load-bearing assumption: "users want mobile." But our data is from desktop power users. Mobile users may be a different population with different needs entirely.
- External event: "platform policy change locks us out of the app store" — has happened to similar products.
- Internal: "we have no native mobile experience on the team; the contractor we hired will leave a maintenance burden nobody can carry."
- Alternative: "responsive web is 80% of mobile value at 20% of cost — and we haven't seriously evaluated that."

The decision isn't necessarily reversed — it's that those four risks are now explicit and either mitigated or accepted-with-eyes-open.

**Red-teaming vs pre-mortem:** pre-mortem is "imagine failure, what's the story?" Red-team is "I am the antagonist; my job is to make sure this fails." Red-team is more adversarial. Pre-mortem is more analytical. Run both for one-way-door decisions.

---

## Steel-manning

The opposite of straw-manning. Before rejecting an option, articulate the **strongest possible version of it** — the version its most thoughtful advocate would defend.

**Method:** before discarding any option in Deliver, write 2–3 sentences of "if I had to defend this option in a debate, here's what I'd say."

**Why it matters:**
- Forces you to engage with the real merits, not the caricature.
- Often reveals that the option deserved more weight than your first instinct gave it.
- When you do reject it, the rejection is informed.

**Worked example (decision: monolith vs microservices, leaning monolith):**

Steel-man for microservices:
> "If we ever do scale 10x, the team will have to refactor anyway. Doing the architectural work now, while the codebase is small and easy to reshape, is cheaper than doing it later when 50 engineers depend on a tangled monolith. The first microservice is a known investment; the 20th microservice in 3 years is an unknown cost — we'd rather pay the known now."

Once the steel-man is on the page, the comparison is honest. If you still pick monolith, you've picked it against the strongest version of microservices — not against a strawman.

**Discipline:** if you can't write a real steel-man for an option, you don't understand it well enough to reject it.

---

## Devil's advocate

A specific role, played for a fixed turn. Distinct from red-teaming in tone: devil's advocate is **structured dissent within the team**, not adversarial attack.

**Method:** the AI (or the user) explicitly takes on "I am playing devil's advocate for this turn" and:
- Points out what makes the leading candidate uncomfortable.
- Names the people who would object and what they'd say.
- Asks "what if we're wrong about [load-bearing belief]?"
- Plays the "boring" or "lazy" position deliberately.

**Useful prompts:**
- "If I were our most skeptical engineer, I'd say..."
- "If I were the finance lead, I'd ask..."
- "If I were the customer who churned, I'd point out..."
- "If this were obviously right, why hasn't [competitor / earlier you / experienced person] already done it?"

**The crucial bit:** mark the role explicitly. "Putting on the devil's advocate hat..." and "taking it off..." so the user knows you're not actually opposed — you're stress-testing.

---

## Six Thinking Hats

Edward de Bono. A way to force the conversation through six different cognitive modes, one at a time, instead of letting them tangle.

The six hats:

| Hat | Mode | Question it answers |
|-----|------|---------------------|
| **White** | Facts | What do we actually know? What data do we have? What's missing? |
| **Red** | Emotions | What does this feel like? What's the gut response? |
| **Black** | Critical | What could go wrong? What are the risks? What are we ignoring? |
| **Yellow** | Optimistic | What could go right? What's the upside if it works? |
| **Green** | Creative | What other angles haven't we explored? |
| **Blue** | Process | Where are we in the process? What's the next move? |

**Method:** explicitly run a turn under each hat. "Black hat — what could go wrong with the chosen path?" then "Yellow hat — if this works, what does the upside look like in 12 months?"

**Why it works:** people naturally favor 1–2 modes (often a mix of yellow and black). Forcing all six prevents the conversation from skipping the modes you're weakest at. For most AI brainstorming, the missing hat is **black** (the AI defaults to yellow) and **red** (the AI doesn't surface the user's emotional response, which is often the real driver).

**When to reach for it:** when the conversation is one-note. If you've been doing exclusively pros, run the black hat. If exclusively cons, run yellow. If purely analytical, run red — "how do you feel about this?"

---

## Disney creative strategy

A sequence attributed to Walt Disney's creative process. Three roles, run sequentially, never simultaneously:

1. **Dreamer** — what's the most ambitious version? No constraints. No "how." Just "what if?"
2. **Realist** — given the dreamer's vision, what would have to be true to make it real? Concrete steps, resource needs, sequencing.
3. **Critic** — given the realist's plan, what breaks it? What's the weak link? What gets cut?

**The discipline:** never blend roles. The critic does not interrupt the dreamer. The realist does not pre-emptively crit. Each role gets a clean turn.

**Why it works:**
- Most brainstorming has the critic in the room from the start, killing dreamer-mode prematurely.
- Most planning has the realist in the room without the dreamer, producing safe-but-uninspired options.
- The sequence honors each mode's contribution without letting the others contaminate it.

**Worked example (problem: re-imagine our onboarding):**

Dreamer turn: "What if onboarding were a single 30-second video and the product just worked? What if there were no onboarding — the user's first action was the product? What if a real person from the team did a 5-minute Zoom with every new user in the first month?"

Realist turn: "The 30-second video version requires us to know exactly which use case each user is opening for. Possible if we ask one question at signup. Five-minute Zoom is sustainable up to ~50 new users/week; we're at 30. The 'no onboarding' version requires the empty state to be productive — feasible if we ship sample data."

Critic turn: "The Zoom version doesn't scale past 50/week and we forecast 100/week in Q3. The sample-data version risks confusion ('whose data is this?') unless we badge it clearly. The 30-second video falls apart if the use case branches more than 3 ways."

The output of the three turns is a more honest plan than any single turn would produce.

**When to use:** for design or product decisions where ambition and feasibility need to be balanced. Less useful for technical decisions, where the realist phase is already dominant.

---

## Failure-mode catalogues

Some domains have well-known failure modes. When evaluating an option in a known domain, consult the catalogue.

**Software projects:**
- Scope creep
- Unmaintained tech-debt accumulation
- Single-point-of-failure dependency on one engineer
- Performance regression at scale not seen in dev
- Security incident from third-party dependency
- Data loss from migration
- Cost surprise from cloud bills
- Vendor lock-in
- Compliance / regulatory shift

**Product launches:**
- Wrong audience targeting
- Activation gap (users sign up, don't return)
- Pricing mismatch
- Distribution channel didn't materialize
- Differentiation eroded before launch by competitor
- Quality issue at scale (worked in beta, broke at full load)

**Team / hiring:**
- Skills mismatch within 3 months
- Cultural mismatch
- Onboarding cost higher than expected
- Departure of the person who hired them
- The role evolved away from what was hired for

**Personal decisions:**
- Sunk-cost trap (continuing because of past investment)
- Hedonic adaptation (the upside fades)
- Status anxiety driving choice (not actual preference)
- Opportunity cost not assessed (what aren't you doing?)
- Reversibility miscalculated

When you've identified the domain, walk the catalogue. Not every item applies, but the items that do should be confronted, not skipped.

---

## Selection guide

| Situation | Reach for |
|-----------|-----------|
| About to commit to a non-trivial decision | Pre-mortem (always) |
| Conventional question has produced stale answers | Inversion |
| One-way door, high-stakes | Red-team (alongside pre-mortem) |
| About to reject an option | Steel-man it first |
| Conversation is too agreeable | Devil's advocate (explicit role) |
| One-note thinking (all optimism or all pessimism) | Six Hats |
| Ambition and feasibility are tangled | Disney sequence (dreamer → realist → critic) |
| Decision in a known domain | Failure-mode catalogue |

---

## Common failures of critical pressure

- **Going through the motions.** Running a pre-mortem and producing "looks good." That's not a pre-mortem; that's a ritual. If the pre-mortem produces nothing concrete, run it again with the prompt "what would the most embarrassing failure look like?"
- **Asymmetric rigor.** Pre-morteming option A but not option B. If you pressure-test, pressure-test all options.
- **Critic without realist.** Going straight to "what's wrong" without first naming what would have to be true. The realist phase of Disney is what makes the critic phase productive.
- **Hedging instead of deciding.** Generating risks, then concluding "well, there are risks." The output of critical pressure is either (a) a mitigation, (b) accepting the risk consciously, or (c) reversing the decision. Not "noted."
- **Letting the user off the hook.** When the user says "yes, that's a good point" but doesn't address it, return: "what's the move on that?" Risks identified without action items don't count.

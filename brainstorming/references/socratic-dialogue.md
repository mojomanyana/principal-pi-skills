# Socratic Dialogue

The craft of asking questions that move the conversation forward without pulling the user toward a conclusion. Read this when:
- The user is being asked one open-ended question after another and getting frustrated.
- The session is producing breadth without depth.
- You feel the conversation drifting and don't know which question to ask next.

A good question does three things at once: it signals that you've heard what was just said, it makes the user think (not just retrieve), and it moves the session toward the next phase. Bad questions usually fail at #2 — they ask for restatement, or for material you should have inferred.

## Contents

1. [The six Socratic question types](#six-types)
2. [Laddering — moving up and down](#laddering)
3. [Probing patterns](#probing)
4. [Reflective paraphrase](#reflective-paraphrase)
5. [One-question-at-a-time, in practice](#one-question-at-a-time)
6. [Multiple-choice vs open-ended](#mc-vs-open)
7. [Productive disagreement](#productive-disagreement)
8. [Common dialogue failures](#common-failures)
9. [Selection guide](#selection-guide)

---

## The six Socratic question types

Classical Socratic method (via Richard Paul's framework) groups questions into six types. Use the type that fits the move you're trying to make.

### 1. Clarification

The most basic. You don't understand what the user means yet. Ask.

- "What do you mean by [X]?"
- "Can you give me a concrete example?"
- "How does this relate to [the earlier point]?"
- "Could you put it another way?"

**When to reach for it:** the user has used a term, label, or framing you can't pin down. Don't bluff. Asking for clarification is not weakness; pretending to understand is.

### 2. Assumption-probing

The user is treating something as given. Surface it.

- "What are you assuming when you say that?"
- "Is that always true?"
- "What would have to be true for this to work?"
- "Are you taking [X] for granted?"

**When to reach for it:** the user states a constraint or fact without sourcing it. Sometimes the assumption is correct and worth keeping; sometimes it's the load-bearing flaw. Either way, surface it.

**Worked example:**

> User: "We can't use Postgres because it doesn't scale."
> Probe: "What load are we expecting? Postgres scales to a lot — are we expecting workload that exceeds [X]?"

Often the assumption ("Postgres doesn't scale") turns out to be cached wisdom that doesn't apply.

### 3. Evidence and reasoning

The user has stated a claim. Ask for its support.

- "What's the evidence for that?"
- "How do you know?"
- "What would persuade you otherwise?"
- "Is this what the data says, or what you expect?"

**When to reach for it:** the user has made a confident claim about uncertain territory — about user behavior, about technical limits, about market response. Distinguish belief from evidence.

### 4. Viewpoint and perspective

The user has framed the situation from one angle. Ask about the others.

- "What would [the customer / engineering / finance / a skeptic] say?"
- "What's the opposing view?"
- "Why might someone disagree?"
- "How does this look from [stakeholder]'s perspective?"

**When to reach for it:** the user is reasoning from one stakeholder's view as if it were the only one. Especially important in cross-functional decisions, but also for personal decisions ("what would your future self say?").

### 5. Implications and consequences

The user has proposed a direction. Trace its second-order effects.

- "If we did that, what would happen next?"
- "What are the second-order effects?"
- "Who would be affected? How?"
- "What does this imply about [adjacent area]?"

**When to reach for it:** when a decision has effects beyond its immediate scope. Most non-trivial decisions do; the user often hasn't traced them.

**Worked example:**

> User: "We'll make all internal APIs require authentication."
> Probe: "If we do that, what happens to the existing health-check probes? What about debug tooling? What's the migration story for things that currently rely on the no-auth assumption?"

Second-order effects are where well-intentioned decisions go wrong.

### 6. Questioning the question itself

The most advanced move. The question being asked may itself be wrong.

- "Why is this the question we're asking?"
- "What's the question behind the question?"
- "Is this the most important question right now?"
- "What would happen if we deferred this question entirely?"

**When to reach for it:** when the discussion feels stuck, when the user has framed the problem in a way that doesn't quite match their actual concern, when the answer to the stated question doesn't seem like it would matter much.

**Worked example:**

> User: "Should we use REST or gRPC?"
> Probe: "Why is this the question? What's at stake — performance? Developer experience? Compatibility? The protocol choice probably matters less than which of those concerns is dominant."

This is the question that often produces the biggest unlock.

---

## Laddering

A specific technique for moving between abstraction levels in real time. From means-end research methodology.

**Laddering up** (toward goals and values):

- "Why is that important?"
- "What does that get you?"
- "What's the underlying goal?"

**Laddering down** (toward concretes):

- "What does that look like in practice?"
- "Can you walk me through a specific example?"
- "What would I see?"

**Use laddering to:**
- Find the real goal when the user is stuck on a means (ladder up).
- Find the testable specifics when the user is hand-waving (ladder down).
- Cross-check coherence — if the user can't articulate the connection between a means and its end, the connection may not exist.

**Worked example (laddering up):**

> User: "I want to add a dashboard."
> Up: "What does the dashboard get you?"
> "Visibility into how the team is doing."
> Up: "What does that visibility enable?"
> "Catching problems before they become emergencies."
> Up: "What's the actual goal — what would change if you got it?"
> "Fewer Sunday-night surprise pages."

Now the real goal is on the table. A dashboard is one path; an alerting overhaul is another; better on-call rotation is a third. The Develop phase has more candidates than the original framing allowed.

**Worked example (laddering down):**

> User: "We should improve the developer experience."
> Down: "What does that look like for a specific developer on a specific day?"
> "A new engineer on day 3 trying to run the test suite locally."
> Down: "What goes wrong for them today?"
> "Half a day of environment setup; tests flake; some only run on CI."
> Down: "If you fixed that one thing, what would the day-3 experience be?"
> "Setup is one command. Test suite runs in 90 seconds. No flakes."

Now you have testable specifics. "Improve DX" is a wish; "day-3 setup is one command" is a target.

---

## Probing patterns

Composite moves built from the six types.

### The "what's missing" probe

> "I want to make sure we haven't skipped anything. If a thoughtful skeptic looked at this, what would they say we missed?"

Catches gaps that direct questioning misses.

### The "what would change your mind" probe

> "If we did this and it didn't work, what would you point to as the cause? What would be the first signal that we should reverse?"

Forces the user to pre-commit to falsification criteria. The mark of a real hypothesis.

### The "second opinion" probe

> "If you asked [specific expert / colleague / past version of yourself] about this, what would they say?"

Imports an outside view without requiring an actual outside person.

### The "10-year-old" probe

> "If you had to explain this decision to a 10-year-old, what would you say?"

Forces the user to drop jargon and reach the actual structure of the situation. Often reveals that the user can't articulate the structure cleanly — which is a finding.

### The "and what else" probe

> "And what else?"

Surprisingly powerful. Most people stop after the first complete-sounding answer. "And what else" reliably surfaces a second, third, fourth answer that's often more honest than the first.

Use it 2–3 times in sequence: "And what else? ... And what else?" Stop when the user says "that's it" or starts visibly straining.

---

## Reflective paraphrase

Not a question — a turn-taking move. You play back what the user said in your own words. Used between question turns to confirm understanding and to catch drift.

**The structure:**
> "Let me make sure I'm tracking. What you're saying is [paraphrase in your words]. Have I got that right?"

**Why it matters:**
- Catches misunderstanding cheaply, before it compounds.
- Forces the user to reckon with their own words played back — sometimes the playback is the moment they realize what they actually meant.
- Demonstrates listening, which builds the conditions for productive disagreement later.

**Use after every 3–4 substantive exchanges.** More often if the topic is complex or the user is being conceptual.

**Caution:** don't paraphrase by parroting — that's annoying and useful only as a stalling tactic. Paraphrase by **translating** — into different words, sometimes into a different abstraction level, to confirm you're tracking the meaning, not just the surface form.

---

## One-question-at-a-time, in practice

The rule is simple; the discipline is harder. Three rules:

1. **One question per turn.** Not "what are we trying to do, and who's the user, and what's the constraint?" — three turns instead.
2. **The most load-bearing question first.** Not the warm-up question. Not the question that's easiest. The question whose answer most shapes what comes next.
3. **Wait for the answer before moving on.** Resist the urge to elaborate or hedge. The question stands; the user answers.

**Why it works:**
- People can answer one question well; three questions partially. Partial answers compound into vague sessions.
- The single-question turn signals that you're listening, not just running a script.
- It forces you to choose which question matters most — which is itself a useful discipline.

**When to deviate:**
- Yes/no warm-ups followed by the real question: "Are you set on building a mobile app? [yes/no]" If yes, "What's the role of mobile in the user's actual workflow?"
- When the user is highly time-constrained and signals they want batch input — but even then, group at most 2–3 questions and signal the grouping.

---

## Multiple-choice vs open-ended

| Use multiple-choice when... | Use open-ended when... |
|----------------------------|------------------------|
| The answer space is finite and you can enumerate it | You don't yet know the answer space |
| Quick decisions (mobile typing) | Exploration phase |
| Confirming direction before committing | Surfacing tacit knowledge |
| Triaging mode/intent at start of session | Probing assumptions or values |

**Multiple-choice failure mode:** false dichotomy. If you offer A or B and the real answer is C, you've narrowed the user. Always offer "(other — say more)" as a final option.

**Open-ended failure mode:** vagueness. "How do you feel about this?" produces "fine" from people who don't know how to engage. Replace with a more specific open question: "what's the part of this that doesn't sit right with you?"

---

## Productive disagreement

Disagreement is a service, not a friction. The script for it:

1. **Acknowledge what you've heard.** "You're saying X."
2. **State the disagreement specifically.** Not "I'm not sure." → "I disagree because [reason]."
3. **Offer an alternative.** Not just "this won't work" → "I'd suggest [Y] instead because [reason]."
4. **Invite pushback.** "Push back if you think I'm wrong — you have context I don't."

**Why each step matters:**
- Step 1 prevents the user from feeling unheard. Disagreement that follows acknowledgement lands; disagreement that follows interruption doesn't.
- Step 2 makes the disagreement actionable. "I'm not sure" can't be addressed; "I disagree because the load is 10x what your architecture handles" can.
- Step 3 keeps the conversation generative. Pure objection is sterile; objection-plus-alternative is collaborative.
- Step 4 reserves the right to be wrong. The user may know things you don't.

**Crocker's Rules (optional, sometimes useful to invoke):**

> "Operating under Crocker's Rules: I'd rather hear a hard truth bluntly than a soft one diplomatically. Skip the cushioning. What's the issue?"

A few users prefer this mode. Most don't. Don't impose it. But if the user invites it, deliver.

---

## Common dialogue failures

### The question-cascade

> "What are you trying to do? Who's the user? What's the constraint? What's the timeline? What's the budget? What's the success metric?"

Six questions, zero turns. The user answers 2–3 and the others are forgotten. **Fix:** one question, then the next.

### The leading question

> "Don't you think Postgres would be the right choice here?"

Not a question; an opinion in question form. The user feels manipulated. **Fix:** state the opinion as opinion, then ask what the user thinks: "I'd lean toward Postgres for [reason]. What's your read?"

### The faux-Socratic question

> "What if there's something we haven't thought of?"

This is just "have you considered everything?" — a vague prompt that produces vague answers. **Fix:** specific question with content: "we haven't talked about the migration cost from the existing system. What's the cost story there?"

### The interrogation

> Turn 1: "What are you trying to do?"
> Turn 2: "Why?"
> Turn 3: "And why is that important?"
> Turn 4: "What does that get you?"

Five whys without reflection. Feels like an interrogation. **Fix:** punctuate with reflective paraphrase. After 3 whys, summarize what you've learned, *then* continue if more probing is warranted.

### The premature offer

After 2 exchanges of context: "OK, I'd recommend [specific solution]."

Too fast. The user hasn't surfaced enough; you haven't either. **Fix:** name the phase you're in. "I have an instinct, but we're still in Discover — let me ask 2 more questions before I form an opinion."

---

## Selection guide

| Situation | Reach for |
|-----------|-----------|
| User used a term you can't pin down | Clarification question |
| User stated a fact as given | Assumption probe |
| User made a confident claim | Evidence / reasoning question |
| User reasoning from one angle | Viewpoint question |
| User proposed a direction | Implications question |
| Conversation is stuck or off-track | Question the question itself |
| User stuck on a means | Ladder up (find the goal) |
| User hand-waving abstractly | Ladder down (find concretes) |
| Need to confirm tracking | Reflective paraphrase |
| User just gave a complete-sounding answer too fast | "And what else?" |
| Finite answer space, want speed | Multiple-choice |
| Exploration phase, want surface area | Open-ended |
| You disagree | Productive-disagreement script |

---

## The meta-skill

Socratic dialogue isn't a checklist. It's a sensibility: **the question you ask reveals what you think matters next.** Choose questions that shape the conversation toward better thinking, not toward the answer you want the user to give. The user notices the difference, even if they couldn't articulate it.

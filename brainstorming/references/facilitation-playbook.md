# Facilitation Playbook

The mechanics of running a brainstorming session well. How to open, how to move between phases, how to pace, when to break, when to close. Read this when:
- The session is meandering and you don't know how to shape it.
- The user is impatient and wants to skip phases.
- You're not sure whether to run a full Diamond or a shorter loop.

The Six Tenets (in SKILL.md) and the technique references are about *what* to do. This file is about *how to run the session* that uses them.

## Contents

1. [The Double Diamond expanded](#double-diamond)
2. [Choosing session length](#session-length)
3. [Opening moves — the first 3 turns](#opening-moves)
4. [Phase transitions — naming them](#phase-transitions)
5. [Mid-session interventions](#mid-session)
6. [Closing moves — the last 3 turns](#closing-moves)
7. [Multi-session continuation](#multi-session)
8. [When NOT to run the full Diamond](#when-not-full)
9. [Pacing and rhythm](#pacing)
10. [The session shape selector](#session-shape-selector)

---

## The Double Diamond expanded

The Diamond was popularized by the British Design Council (2005), drawing on earlier design-thinking work. The four phases handle the two distinct activities — exploring problem space and exploring solution space — and each phase has its own discipline.

```
       Discover           Define          Develop           Deliver
       diverge            converge        diverge           converge
       (problem)          (problem)       (solution)        (solution)
       │                  │               │                 │
       ├─ context         ├─ problem      ├─ options        ├─ pressure-test
       ├─ assumptions     │  statement    ├─ alternatives   ├─ score
       ├─ stakeholders    ├─ How Might We ├─ wild cards     ├─ pre-mortem
       └─ constraints     └─ exit criteria└─ exit criteria  └─ decision brief
```

### Why both diamonds matter

The single most common shortcut: skip the first diamond (problem) and dive into the second (solution). The user says "I want to do X" and the session generates options for X. But X may be the wrong question. The cost of generating great solutions to the wrong question is high — and invisible until it's too late.

Conversely: skip the second diamond's divergence and converge straight on the first solution that meets the problem statement. This is fine when the solution space is small and obvious. It's a disaster when alternatives would have been clearly better had they been generated.

### Phase-specific pitfalls

- **Discover** drift: gathering context endlessly without naming what's load-bearing. Discover has an exit.
- **Define** drift: over-engineering the problem statement. The statement should be sharp, not perfect.
- **Develop** drift: producing variations on one idea instead of spanning the space. See divergent-techniques.md cardinal rule 3.
- **Deliver** drift: hedging instead of deciding. A decision brief without a decision is incomplete.

---

## Choosing session length

Three rough shapes:

### Quick loop — 5–10 turns
- One narrow question.
- Two-way door decision.
- User clearly has done some thinking already.
- Example: "what's a good name for this Slack bot?" or "should I send this email today or tomorrow?"

Run: shortened Discover (1–2 questions), micro-Define, brisk Develop (5+ options), light Deliver.

### Standard session — 15–25 turns
- A real decision with multiple stakeholders or trade-offs.
- Mix of two-way and one-way door elements.
- User has a starting framing but it may not be the right one.
- Example: "should we add a mobile app?" or "how do we onboard new users better?"

Run: full Double Diamond. Named phase transitions. Decision brief at the end.

### Deep session — 25–50+ turns, possibly multi-session
- One-way door, high-stakes.
- Strategic — choices that shape what's possible later.
- Multiple sub-problems entangled.
- Example: "should we pivot the company?" or "how do we structure our architecture for the next 3 years?"

Run: explicit multi-phase agenda. Possibly multiple Double Diamonds for distinct sub-problems. Possibly multi-session.

**Choose the shape early and tell the user.** The shape sets expectations and prevents the user from getting impatient halfway through. ("This is going to be a 20-turn session — fair? Want a shorter one?")

---

## Opening moves — the first 3 turns

The opening sets the entire session. Three things to accomplish in the first three turns:

### Turn 1 — Detect mode, name it

Read the user's opening. Classify into one of the five working modes (A–E in SKILL.md). Name it back to the user.

> "Sounds like you're in [Problem Exploration / Idea Generation / Decision Support / Stress Test / Reframe] mode. I'll start with [phase] — sound right, or were you somewhere else?"

This is also where you might offer to set the session length: "I'd expect this to take ~15 turns. Want a quick loop instead?"

### Turn 2 — One precise question

Not a context dump. Not five questions. One question that maximally clarifies what you're doing.

For Discover entry: usually the 5-Whys-style probe of the opening framing, or "what makes you want to do this now?"

For Develop entry: usually "before I generate options, what would have to be true for an option to be a good answer?"

For Deliver entry: usually "what are the options you're already considering, and what's the one you've already rejected?"

### Turn 3 — Reflect what you've heard

By turn 3, you should have a clearer picture than you started with. Play it back.

> "OK, so the situation is [paraphrase]. The constraint that matters most seems to be [X]. The thing you haven't said but I'm inferring is [Y] — am I right about that? Let me know what I'm missing and then we'll move into [next phase]."

If the user corrects you, integrate and move on. If they confirm, advance.

---

## Phase transitions — naming them

A core skill: **explicitly announce when you're leaving one phase and entering the next.** Otherwise the structure is invisible to the user, and they'll keep pulling you back to whatever felt most urgent.

**Discover → Define:**
> "I think we have enough context. Let me try to write the problem in one sentence: [draft]. Does that capture it, or am I missing the real question?"

**Define → Develop:**
> "Good — that's our question. Now let me generate options. I'll aim for at least 6, including ones you might not have considered. Then we'll evaluate. Going divergent now — I'll suspend judgment on the way out."

**Develop → Deliver:**
> "OK, we've got 7 options on the table. Now I'll switch modes and we'll pressure-test. I'll pre-mortem the leading ones, run inversion on the chosen path, and we'll land on a decision."

**Deliver → close:**
> "I think we have our decision. Let me write the brief. You'll get [structure]. Anything you want me to capture that I might miss?"

Each transition is a chance for the user to redirect. The naming is what makes that redirection possible.

---

## Mid-session interventions

When something goes wrong mid-session, you have moves:

### The user is anchoring on their opening idea

Symptom: every option you generate gets compared against the user's idea instead of evaluated on its merits.

> "I notice I'm generating options and you're comparing each one to [their original]. Let me try a brainwriting exercise — give yourself 2 minutes to write a list independently of mine, then we'll merge. That'll get past the anchor."

### The session is getting too long

Symptom: more than 15 turns and still in Discover.

> "We're 15 turns in and still on the problem. That's a finding — the problem might be bigger than we thought. Want to break this into sub-brainstorms, or push through?"

### You feel pulled toward sycophancy

Symptom: you keep wanting to say "great idea" or "yes, that works."

> "I'm noticing I'm tempted to agree with this. Let me slow down and try to break it. [Run inversion or pre-mortem.]"

### The user is showing bias

Symptom: anchoring, sunk-cost, action bias, etc. (See [cognitive-biases.md](cognitive-biases.md).)

> "I want to name something. You're framing this as [biased view]. That might be right, but it's also a known pattern that distorts decisions like this. Mind if I run a [counter-script] to check?"

### The user is exhausted

Symptom: short answers, vague answers, "I don't know, you decide."

> "Let me check in. We've been at this a while. Want to pause and resume tomorrow, or push through? If we push through, I'll do more of the work and less of the questioning."

### The user wants to skip phases

Symptom: "just tell me the answer."

> "I can. But the answer I'd give now is based on partial context. Two specific things I don't know: [X] and [Y]. If you give me 30 seconds on each, the answer will be much better. Worth it?"

The right move is usually to negotiate — not refuse to advance, but make clear that skipping has a cost.

---

## Closing moves — the last 3 turns

The end of a session is where most of the value crystallizes — or evaporates. Three things to accomplish:

### Turn N-2 — Pre-decision sanity check

Before writing the brief:

> "Before I write this up — three quick checks: (1) have we considered 'do nothing' as a real option? (2) Is this a one-way or two-way door? (3) Is there a question you wanted to raise but didn't?"

Each is a chance to catch something missed.

### Turn N-1 — Write the brief

Use the [decision brief template](../assets/decision-brief.md). The brief lives in the chat or in a file (depending on the platform); either way, it's a written artifact, not just a conversation summary.

### Turn N — Handoff pointer

The brainstorm is done. What's next?

> "Decision is logged. For the next step: this sounds like architecture work — point yourself at the `software-architect` skill, with the brief as input. Or, if you want to brainstorm a sub-question first, I can keep going. Which?"

Hand off; don't invoke. The user runs the next skill.

---

## Multi-session continuation

When the user returns to continue a brainstorm:

### What to check first

1. Read the prior brief (if there's a file).
2. Read any context the user provides about what's changed.
3. Identify which phase you're entering. Often it's "we made the decision, but new information arrived" — back to a partial Deliver. Sometimes it's "we deferred this; we're ready" — pick up where you left off.

### What to ask

> "Picking up from [brief / last session]. The decision was [X], based on [rationale]. What's changed since then, and what do you want to re-open?"

### When to start fresh vs continue

- **Continue** when the problem and constraints are stable and you're refining or building on a prior decision.
- **Start fresh** when the problem itself has shifted significantly. The old brief becomes context, but the new session does its own Discover.

Don't carry forward decisions that no longer make sense. Sunk-cost-of-prior-brainstorm is real.

---

## When NOT to run the full Diamond

The Diamond is mandatory in spirit (structured exploration before commitment) but not always in form. Cases where the full structure is overkill:

### Pure idea generation, no decision

> "Help me come up with 10 names for this project."

This is Develop only. No Discover (the problem is given), no Deliver (the user will pick later). Run Develop with discipline — multiple techniques, push past the cached options — and stop.

### Validation of an existing decision

> "I'm going to do X. Stress-test me."

This is Deliver only. Adversarial mode. Pre-mortem, inversion, red-team. No Discover, no Develop. The brief at the end is short: "I ran [tests]; the load-bearing risks are [X, Y]; I'd suggest [mitigations / acceptance]."

### Quick reframe

> "I'm stuck. Help me see this differently."

This is Discover (rewind), with no commitment to walking the rest of the Diamond. You may end the session at "here's a different framing" and let the user think on it.

### Mechanical decisions

> "Should I `npm install` or `yarn add` for this project?"

This is not a brainstorm. It's a lookup or a 1-question consult. Don't run the Diamond on it. Recognize when "brainstorming" is overkill for the actual question — and do the smaller thing.

### Pure exploration with no decision in sight

> "I've been thinking about cellular automata. Talk to me about them."

This is a learning conversation, not a brainstorm. Skip the structure entirely; converse.

**The pattern:** the Diamond is the right shape when the session has a real decision to deliver. When there's no decision, run the part of the Diamond that fits the user's actual goal.

---

## Pacing and rhythm

Real sessions don't have uniform pace. Some phases need to be fast; some need to be slow.

| Phase | Right pace | Why |
|-------|-----------|-----|
| Discover | Slower — let answers breathe | Surfacing context is where the real material is |
| Define | Faster — once the problem is clear, sharpen and move | Over-engineering the problem statement wastes the session |
| Develop | Faster — quantity-first means moving | Slow generation breeds judgment; judgment kills divergence |
| Deliver | Slower — pressure-testing takes deliberation | Speed in Deliver is how bad decisions get made |

If a phase is dragging, ask whether the pace is wrong for the phase. Discover should drag a little; Develop should fly; Deliver should be careful.

---

## The session shape selector

Match the shape of the session to the type of question:

| User's situation | Recommended shape |
|------------------|-------------------|
| "I'm not sure what I'm trying to do" | Full Diamond, slow Discover, may need multi-session |
| "I want to come up with options for X" | Skip to Develop after a 2-question Discover sanity-check |
| "Should I do A or B?" | Deliver-dominant, with a forced Develop sub-step ("what's option C?") |
| "Here's my plan, what's missing?" | Deliver-only, adversarial mode |
| "I'm stuck / going in circles" | Back to Discover, rewind |
| "Name some ideas for X" | Develop-only, multiple techniques, no Deliver |
| "Stress-test this decision" | Deliver-only |
| "Help me think out loud about Y" | Conversational; structure only if a decision starts to emerge |

The shape selector is a starting point. Mid-session, you may discover the right shape is different — that's fine. Name the change to the user when you make it.

---

## The meta-discipline

Facilitation is the discipline of **being one beat ahead of the user.** While they're answering question N, you're already deciding what question N+1 should be — and whether N+1 should be a question, or a reflection, or a phase transition, or a redirect.

The user can't run this discipline; that's why they reached for a brainstorming partner. Your job is to keep the structure invisible-but-present: visible enough that the user knows where they are, invisible enough that they don't feel managed.

A good session leaves the user thinking "we got somewhere." A great session leaves them thinking "I got somewhere" — even though you did most of the structural work.

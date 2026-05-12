# Problem Framing

The discipline of working out what you're really trying to do before generating solutions. Most brainstorming failures are problem-statement failures — the wrong question gets answered very thoroughly.

This file covers the techniques used in the **Discover** and **Define** phases of the Double Diamond. Use the selection table at the bottom to pick a technique that fits the situation.

## Contents

1. [5 Whys](#5-whys) — root-causing past surface symptoms
2. [Jobs-to-be-Done](#jobs-to-be-done) — what is the user hiring this for
3. [How Might We](#how-might-we) — the framing that opens the solution space
4. [First Principles](#first-principles) — break the problem down to fundamentals
5. [Problem statement template](#problem-statement-template) — the explicit version
6. [Abstraction ladder](#abstraction-ladder) — moving up and down levels of generality
7. [Outcomes vs outputs](#outcomes-vs-outputs) — what success actually means
8. [Stakeholder mapping](#stakeholder-mapping) — who else is in this
9. [Selection guide](#selection-guide) — when to reach for what

---

## 5 Whys

Originated at Toyota for root-cause analysis on the manufacturing line. Adapted for any problem where the surface complaint isn't the real problem.

**Method:** Ask "why?" five times in sequence. Each answer becomes the input to the next "why?"

**Worked example (software):**

> User: "We need to add a Slack integration."
> Why? "Because customers keep asking for one."
> Why are they asking? "Because they want notifications in their existing tools, not another inbox."
> Why do they want notifications there specifically? "Because they're missing time-sensitive events in our app."
> Why are they missing them? "Because our email notifications get filtered or batched."
> Why does the filtering matter? "Because the critical events look identical to the routine ones."

Real problem: notification signal-to-noise, not Slack. The "Slack integration" was a guess at how to fix it. Solutions in Develop might include: tiered notifications by severity, in-app push, SMS for critical events, OR a Slack integration — but now Slack is one option among several, evaluated on its merits.

**Worked example (non-software):**

> "I want to quit my job."
> Why? "I'm exhausted."
> Why exhausted? "I'm working until 9 every night."
> Why that late? "I can't get anything done between meetings."
> Why so many meetings? "I'm in every meeting because nobody else has the context."
> Why does nobody else have the context? "I've never written anything down."

Real problem: missing documentation, not the job. Quitting solves a symptom; writing down what you know might solve the cause.

**Limits:**
- "Five" is a heuristic — sometimes the root cause emerges at 3, sometimes at 7.
- Some chains have multiple causes — branch when the answer is "two things."
- Don't bully the user past the answer. If they say "I don't know," that's a finding — that's the real problem.

---

## Jobs-to-be-Done

From Clayton Christensen. The idea: people don't buy products, they "hire" them to do a job. The job is the unit of analysis, not the product or the user persona.

**Method:** Frame the situation as a job. The template:

> When **[situation]**, I want to **[motivation]**, so I can **[expected outcome]**.

**Worked example (software):**

Bad framing: "Users want a dashboard."

JTBD framing: "When I'm starting my Monday at 9am, I want to know what changed over the weekend, so I can prioritize my day without reading every notification."

The JTBD version makes the solution space much wider — could be a dashboard, but could equally be a digest email, a "what's new" panel on the home screen, a Slack summary, or a 60-second briefing voice clip. The dashboard was one implementation of the job.

**Worked example (non-software):**

Bad framing: "I need a productivity app."

JTBD framing: "When I'm working from home and constantly distracted, I want to lock in for 90-minute focus blocks, so I can ship the writing I'm avoiding."

Solutions: productivity app, but also — a kitchen timer, a "do not disturb" sign, a coffee-shop trip, a writing partner on video call, Freedom or Cold Turkey for site blocking. JTBD widens the option pool by separating job from implementation.

**The competition test:** "What does the user fire when they hire your solution?" If they hire your dashboard, what gets fired — their old dashboard? Their notification habits? Their morning meeting? The answer reveals the real job. If nothing gets fired, you're not solving a real job; you're adding noise.

---

## How Might We

The IDEO/Stanford d.school framing for converging in problem space and opening solution space. The phrase is precise:
- **"How"** — assumes it's possible (commits to action)
- **"Might"** — invites multiple answers (no single right one)
- **"We"** — collaborative, not adversarial

**Method:** Take the problem statement and rewrite it as a "How Might We..." question. Then tune the **abstraction level**:

- **Too narrow** (`How might we add a darker theme to the settings page?`) — the design space is one solution; you're not brainstorming, you're spec'ing.
- **Too broad** (`How might we make people happier?`) — the design space is everything; you can't generate anything useful.
- **Right** (`How might we reduce eye strain for users working late at night?`) — broad enough to invite real options, narrow enough to evaluate them.

**Calibration trick:** If you can answer the HMW in one obvious way, it's too narrow. If you can answer it in ten unrelated ways, it might be too broad. The sweet spot generates 5–8 distinct directions.

**Worked example:**

Starting problem: "Our onboarding has a 60% drop-off in the first 7 days."

HMW candidates at different abstraction levels:
- Too narrow: "How might we add a tooltip on the empty state?"
- Right: "How might we get first-time users to a moment of value within 3 minutes?"
- Right (different angle): "How might we remove the steps that aren't necessary to a first success?"
- Too broad: "How might we make our product successful?"

Each "right" HMW frames a different design space — value-acceleration vs friction-removal. Choose the one that matches what you actually believe is the issue. If you can't decide, hold both and let the Develop phase generate options against each.

---

## First Principles

From Aristotle, popularized in modern usage by Elon Musk. The idea: break the problem down to fundamental, irreducible truths, then reason up. The opposite of "reasoning by analogy" — which is what most thinking is.

**Method:** Ask: "what do I actually know to be true here, that doesn't depend on convention, history, or anyone else's framing?" Strip the problem to physics, math, money, and constraints.

**Worked example (the Musk classic):**

> Conventional thinking: "Rocket engines cost $X because they always cost $X."
> First principles: "What is a rocket made of? Aluminum, copper, titanium, carbon fiber. What are those worth as raw materials? About 2% of the rocket's price. So 98% of the price is everything other than materials. That 98% is addressable."

**Worked example (software):**

> Conventional: "We need Kafka because we're going to scale and everyone uses Kafka for streaming."
> First principles: "What is our actual event rate? 200 events/sec peak, 30 average. What's the cheapest thing that handles 200/sec with the durability we need? Postgres with `LISTEN/NOTIFY` or a single Redis stream. Kafka starts winning around 10k/sec sustained or when we need multi-consumer replay."

**Worked example (non-software):**

> Conventional: "I should go to grad school because I have an undergrad degree and that's the next step."
> First principles: "What do I want to be doing in 5 years? What's the cheapest path to learning that? Is the credential load-bearing for the role, or is it cargo-culted? Who in my target role didn't go to grad school?"

**When to reach for it:** When the user is reasoning from "that's how it's done" or "everyone uses X." When the conventional path is expensive and the conventional reasons sound thin. When you suspect an entire category of solution is unnecessary.

**When NOT to:** When the problem is genuinely well-understood and convention is convention because it's right. First-principles thinking is expensive — don't deploy it on solved problems.

---

## Problem statement template

The explicit form. Force the user to fill in each slot. The slots that are hardest to fill are the ones that reveal the gaps.

```
[Who] needs [what need] because [why / what insight makes this true].
We will know we've solved it when [observable signal].
We will NOT solve [adjacent thing] in this effort.
```

**Worked example:**

Vague: "We need better search."

Filled: "Engineers debugging production incidents need to search across logs, traces, and metrics from a single query, because switching tools mid-incident adds 2–5 minutes per context-switch and they do dozens per incident. We will know we've solved it when median time-to-first-evidence drops from N to N/2. We will NOT solve cross-cluster correlation in this effort."

The filled version constrains the solution space usefully. "Better search" doesn't.

---

## Abstraction ladder

A move, not a method. When the conversation feels stuck, change the abstraction level — go up to ask "why does this matter at all?" or down to ask "what specifically?"

**Going up:**
- "Why does this matter?"
- "What's the bigger problem this is a part of?"
- "If this were solved, what would that enable?"

**Going down:**
- "What specifically?"
- "Can you give me a concrete example?"
- "What does this look like in practice?"

Use it to break out of stuck conversations. If the user is lost in implementation detail, go up. If they're hand-waving abstractly, go down.

---

## Outcomes vs outputs

A reframing move. Most stated goals are outputs ("ship the dashboard") when the real goal is an outcome ("users see what changed since their last session"). Outcomes are about user state or business state changing. Outputs are about things you produce.

**Method:** For every stated goal, ask: "if you delivered this exactly and nothing changed for the user, would you call this a success?" If yes, the goal is an output — find the underlying outcome. If no, the goal is already an outcome.

**Worked example:**

- Output: "Ship the v2 redesign by Q3."
- Outcome behind it: "Reduce time-to-first-action for new users from 4 minutes to under 60 seconds."

The redesign is one way to hit the outcome. There are others — onboarding tutorial, default templates, smart defaults, removing steps. Naming the outcome opens those options.

---

## Stakeholder mapping

For problems that involve multiple people or systems. Quick technique: list every person, role, or system that touches the problem. Mark which ones are deciders, which are affected, which are gatekeepers.

**Template:**

| Stakeholder | Role | What they need | What they fear |
|-------------|------|----------------|----------------|
| | (decider / affected / gatekeeper / influencer) | | |

The "what they fear" column is often where the real constraints hide. People rarely state their fears — but their fears drive their objections later. Surface them now.

---

## Selection guide

| If the user... | Reach for |
|----------------|-----------|
| Opened with a solution, not a problem | 5 Whys |
| Says "users want X" or "we need a Y" | Jobs-to-be-Done — make them name the job, not the product |
| Has a vague problem statement | Problem statement template (force the fill-in) |
| Is solutioning at one level but the real problem might be elsewhere | Abstraction ladder (go up) |
| Is hand-waving at high abstraction | Abstraction ladder (go down) |
| Has a problem that's been framed in one way for a long time | First principles |
| Is conflating outputs with outcomes | Outcomes vs outputs |
| Is about to frame the Develop phase | How Might We (and check abstraction level) |
| Has a problem involving multiple parties | Stakeholder mapping |

---

## Exit criteria for the Define phase

You're ready to leave problem space and enter solution space when:

1. You can write the problem in one sentence and the user agrees with the sentence.
2. The HMW question is calibrated (not too narrow, not too broad).
3. The hard constraints are explicit.
4. The "we will NOT solve X" is explicit.
5. You and the user agree on what signal would mean success.

If any of these is missing, don't advance to Develop. The cost of a fast-but-wrong problem statement compounds through the rest of the session.

# Divergent Techniques

Methods for generating options during the **Develop** phase. The goal of divergence is **quantity and spread**, not quality and polish. Polish happens in Deliver. Here, the discipline is to suspend judgment and produce more options, faster, in more different directions than feels comfortable.

The single most common Develop failure is producing 2–3 options and stopping. The first three ideas are almost always cached and predictable. Push past them.

## Contents

1. [The cardinal rules of divergence](#cardinal-rules)
2. [SCAMPER](#scamper) — seven prompts to transform an existing idea
3. [Crazy 8s](#crazy-8s) — quantity by time pressure
4. [Analogies / Synectics](#analogies) — borrow from distant domains
5. [Worst-possible-idea](#worst-possible-idea) — invert to unlock
6. [Lateral thinking provocations](#lateral-thinking) — de Bono's PO moves
7. [Brainwriting](#brainwriting) — silent generation before discussion
8. [TRIZ contradictions](#triz) — engineering's structured creativity
9. [Random stimulus](#random-stimulus) — break the cache
10. [First principles redux](#first-principles) — re-derive, don't reuse
11. [Selection guide](#selection-guide)

---

## Cardinal rules

Read these every time before running a divergent phase. They are easy to forget mid-flow.

1. **Suspend judgment.** No "but that won't work" during Develop. Park objections for Deliver. The phrase you use: "Let me park that and come back to it."
2. **Quantity over quality.** Aim for at least 5–7 distinct options; ideally 8–12 for a meaningful problem. Mediocre options are still useful — they map the space and make the good ones legible by contrast.
3. **Spread, not depth.** If your first 5 options are all variations of the same idea, you've generated 1 option, not 5. Force spread by deliberately covering different corners of possibility-space.
4. **Build on, don't tear down.** When the user offers an idea, the response is "yes, and..." not "yes, but..." The "but" lives in Deliver.
5. **The boring option is mandatory.** Always include "the obvious one" and "do nothing." Sometimes they win. They also make the exotic options easier to evaluate.
6. **Distance matters.** At least one option should feel uncomfortably far from the user's starting point. If everything is close to the user's instinct, you're confirming, not exploring.

---

## SCAMPER

A 7-prompt checklist. Take any existing idea or component and run it through each prompt. The Eberle / Osborn lineage. Reliable, mechanical, productive.

The seven prompts:

| Letter | Prompt | Example move (on a notification system) |
|--------|--------|-----------------------------------------|
| **S** | **Substitute** — what could you swap out? | Replace email with push; replace per-event with digest; replace user-initiated read with auto-mark-read |
| **C** | **Combine** — what could you merge? | Merge notifications + activity feed; merge inbox + search; merge cross-product notifications into one stream |
| **A** | **Adapt** — what works elsewhere that could be borrowed? | iOS notification priorities; Slack's threading; Discord's @mention semantics |
| **M** | **Modify / Magnify / Minify** — change scale or attribute | Make notifications heavier (force-acknowledge); make them lighter (passive presence indicator); make them ephemeral (10-second toast); make them persistent (sticky pin) |
| **P** | **Put to other use** — different context, same mechanism | Use the notification system as a status feed for non-events ("3 colleagues are also looking at this") |
| **E** | **Eliminate** — what could you remove? | Remove notifications entirely (poll on visit); remove categories (everything one bucket); remove unread state |
| **R** | **Reverse / Rearrange** — flip direction or order | User pulls instead of system pushes; show me only notifications I haven't seen elsewhere; sort by what's NOT relevant (so I can dismiss in bulk) |

**Worked example (non-software, choosing a domain name):**

Starting: "TaskFlow"

- S: SwiftTask, FlowDeck, BoardSwift
- C: TaskFlowHQ, MyTaskFlow, TaskFlow.io
- A: (borrow from Notion → simple one-word) Tide, Stream, Lane
- M: Task (minimal), TaskFlowManager (maximal), Flow (just the second word)
- P: (same name in different category) FlowChef, FlowMentor
- E: Eliminate "Task" → just Flow; eliminate "Flow" → just Task
- R: FlowTask instead of TaskFlow

The point isn't that any one is brilliant — the point is you now have 15+ candidates from one starting word. Convergence is later.

**When to reach for SCAMPER:** the user has an existing thing (idea, product, feature, name, plan) and wants variations on it. Less useful when starting from blank — for that, use Crazy 8s or analogies.

---

## Crazy 8s

From Google Ventures Design Sprints. Eight ideas in eight minutes. The constraint forces past the cached 2–3 obvious answers.

**Method:** Fold a sheet of paper into 8 boxes. Set a timer for 8 minutes. Sketch (or one-liner-describe) 8 different ideas in 8 boxes. No editing. No good handwriting. No deleting.

**Adapted for AI brainstorming:** instead of sketches, generate 8 one-liner options in rapid succession. The discipline is to not refine any of them — produce eight, then stop.

**Why it works:** the first 2–3 ideas drain the cache. Ideas 4–6 are forced creativity ("I have to write something here"). Ideas 7–8 are often the best — they come from genuinely novel territory because everything obvious is taken.

**Worked example (HMW: get first-time users to value in 3 minutes):**

1. Pre-fill with sample data so the app is alive from second 1.
2. Reduce signup to email-only, defer profile setup.
3. Show a 30-second video of the most-loved workflow before account creation.
4. Skip signup entirely; let users start, prompt for account only when they want to save.
5. AI-assisted onboarding: ask "what are you trying to do today?" and pre-configure based on the answer.
6. Reverse the funnel — let people use the product fully unauthenticated; account only locks in their work.
7. Onboarding sprint: a 5-minute guided tour that walks the user through a real task that mirrors their stated need.
8. Remove onboarding; replace with progressive disclosure tooltips as the user explores.

Eight directions. Now Deliver picks which 2–3 to develop deeper.

---

## Analogies (Synectics)

From William J.J. Gordon's Synectics. The idea: borrow the structure of a solution from a distant domain. "Make the familiar strange and the strange familiar."

**Method:** Ask: "what's a solved problem in a completely different domain that has the same shape as this one?"

**Worked example (problem: too many notifications):**

- How does the **airport control tower** handle high-volume signals? Prioritization, frequency separation, only the controller sees everything, pilots get filtered subset.
- How does the **emergency room** triage? Severity classification at the door, color tags, dedicated rooms for different severities.
- How does the **postal service** handle deliveries? Bulk delivery once per day, immediate-only for express, opt-in for tracking.
- How does **a beehive** coordinate? Pheromone signals, no central planner, individual decisions based on local information.
- How does **traffic** flow? Signaling layers (lights, signs, paint), speed differential by category, dedicated lanes for high-priority vehicles.

Each analogy is a possible architecture for the notification system. Triage-like would be severity tiers. Postal-like would be daily digest plus instant for emergencies. Traffic-like would be channel separation.

**Cross-domain generators for software problems:**

| Software problem | Try borrowing from... |
|------------------|----------------------|
| Concurrency / coordination | biology (cells, hives), traffic, sports teams |
| Notification / signaling | aviation, ER triage, mail, military comms |
| Resource allocation | economics (auctions, markets), ecology |
| User onboarding | hospitality (hotels, restaurants), schools, video games |
| Search / discovery | libraries, museums, dating, real estate |
| Error handling | medicine (diagnosis), aviation (checklists), debugging detective fiction |
| Permission / access | physical buildings, government bureaucracy, family hierarchies |
| Versioning / change | publishing, legal contracts, biology (evolution) |

**Worked example (non-software, naming a podcast):**

What's the "Atlantic" or "New Yorker" of [your field]? What's the "Joe Rogan" of [your field]? What's the "Daily" of [your field]? Each analogy suggests a positioning and a name shape.

---

## Worst-possible-idea

Counter-intuitive technique. Asking for the worst possible solution unlocks creativity that "best solution" requests freeze.

**Method:** Ask: "what would be the worst possible way to solve this?" Generate 5–8 deliberately bad options. Then invert each — what does its opposite look like?

**Why it works:** people are bad at "best" (judgment freezes the generator) but excellent at "worst" (judgment is suspended because nobody's looking). The bad options often reveal real constraints. The inversions are often legitimately good ideas.

**Worked example (HMW: improve our daily standup):**

Worst possible options:
1. Make it 3 hours long with mandatory PowerPoint.
2. Hold it at 4am on Saturday.
3. Require status updates in iambic pentameter.
4. Have everyone present blindfolded.
5. Replace the standup with a notarized weekly affidavit.
6. Make it manager-only; no engineers speak.

Inversions:
1. Make it 10 minutes max, no slides.
2. Asynchronous — written, on each person's schedule.
3. (No clean inversion — drop)
4. Add visual aids: shared screen with the actual work.
5. Replace with lightweight ambient signal (commit log, ticket-state changes).
6. Make it engineer-only; no manager required.

Two or three of those inversions are real candidates. None of them would have surfaced if you'd asked "what's the best way to run a standup?"

---

## Lateral thinking (de Bono provocations)

Edward de Bono's "lateral thinking" is about escaping the well-worn grooves of "vertical thinking" (logical deduction inside a frame). The signature move is **provocation** — make a deliberately silly or impossible statement, then mine it for what it suggests.

**The "PO" prefix:** de Bono used "PO" to mean "this is a provocation, not a proposal — work with it." When you reach for a provocation, mark it.

**Provocation templates:**

- **Reversal:** "PO: the user pays nothing." (For a paid product — what would have to change about the business?)
- **Exaggeration:** "PO: the page loads in 0ms." (What design choices would that force?)
- **Wishful:** "PO: the feature configures itself based on watching the user once." (What's the minimum step toward that?)
- **Escape:** "PO: there are no users." (What's the product without humans?)
- **Distortion:** "PO: the database is read-only forever." (What architecture follows?)

**Method:** After stating the provocation, generate ideas as if it were true. Mine the provocation for what it reveals about hidden assumptions.

**Worked example (problem: email notifications get ignored):**

Provocation: "PO: every email costs us $100 to send."

Forced ideas:
- Only send when the user provably needs it (some predictive model).
- Batch ruthlessly — never more than one email per user per day.
- Make the content so good the user opens it the moment it arrives.
- Replace the email with something cheaper (in-app banner, SMS-only for critical).
- Charge the user $1 to "subscribe" to a category so they actively opt in.

Lateral thinking isn't about the provocation being real; it's about what becomes visible when you accept the constraint temporarily.

---

## Brainwriting

The technique that fixes the central failure of group brainstorming (one loud voice anchoring everyone). Originally Bernd Rohrbach's 6-3-5 method. Adapted for AI brainstorming as: **silent generation before exchange.**

**Method (1-on-1 with AI):** before discussing options together, the user writes their own list silently, in their own context, for ~5 minutes. Then the AI generates its own list independently. Then both lists are merged. The point: prevent the AI from anchoring the user (and vice versa) before either has done independent thinking.

**Why it matters here specifically:** Claude's outputs anchor users hard. If you start generating options the moment the user finishes describing the problem, the user's own thinking gets cut short. The user's tacit knowledge about their domain matters — and that knowledge surfaces only when they're forced to write before reading.

**Script for the AI side:**

> Before I generate options, take 2–3 minutes and write your own list. Don't worry about polish — just dump what comes to mind. Then share your list, and I'll add mine. We'll merge after.

This is especially powerful for naming, scoping, and design decisions where the user has strong but unsurfaced preferences.

---

## TRIZ (briefly)

The Soviet engineer Genrich Altshuller's system for inventive problem-solving. Massive in full form (40 principles, 39 parameters, contradiction matrices). Useful subset for brainstorming:

**The core move:** identify the **contradiction** in the problem. Every interesting problem has one: you want X but X conflicts with Y.

> "I want the API to be fast" (X) "but I also need it to be flexible" (Y).
> "I want notifications to be informative" (X) "but I also need them to be unobtrusive" (Y).
> "I want the team to move fast" (X) "but I also need code quality" (Y).

**Then ask:** which TRIZ-style separation breaks the contradiction?

- **Separation in time** — X happens at one time, Y at another. (Bulk-import is slow but flexible; runtime API is fast but rigid.)
- **Separation in space** — X happens in one place, Y in another. (Fast path in hot code, flexible path in cold code.)
- **Separation by condition** — X for some users, Y for others. (Fast for read-heavy, flexible for power users.)
- **Separation by component** — different parts handle X and Y. (Notification severity tier: fast for critical, batched for routine.)

When two requirements seem to conflict, naming the separation move often reveals an option that wasn't obvious from either side alone.

---

## Random stimulus

Force a connection between the problem and an unrelated object or concept. The technique works because the brain is excellent at finding patterns — even between things that aren't related, it'll find one, and the act of finding it generates novelty.

**Method:** Pick a random noun (open a dictionary, look around the room, ask the AI for a random word). Then ask: "how is [random thing] like [the problem]?"

**Worked example (problem: too many notifications, random word: lighthouse):**

A lighthouse:
- Is visible only to those who need it (ships at sea, not inland)
- Has one signal, repeated, recognizable
- Operates only when needed (some are dark by day)
- Different lighthouses have different flash patterns (identifiable signature)

Ideas the random word suggests:
- Notifications visible only based on user context (location, work state).
- A consistent signal pattern that the user learns over time.
- Quiet mode based on time of day, not just user toggle.
- Per-channel signature (Slack-style colored avatars for who sent it).

Use when stuck. Use when ideas all sound the same. Use when the user is rejecting everything.

---

## First principles redux

Covered in [problem-framing.md](problem-framing.md), but worth noting here for divergence: stripping a problem to first principles is a generator, not just a frame. Once you've identified the real fundamentals, you can re-derive options that bypass conventional answers.

**Worked example (problem: deploy faster):**

Conventional options: faster CI, parallel test runs, better caching, deployment pipelines.

First-principles view: "What is deploy actually? Moving N bytes from A to B and pointing traffic at them." Then:

- Could we move fewer bytes? (Incremental, diff-based, edge-cached)
- Could we move them faster? (Different protocol, predictive prefetch)
- Could we skip the move? (In-place updates, feature flags, dark launches)
- Could "deploy" not mean what we think? (Hot-reload, immutable scaling vs replace)

Each is a category that conventional reasoning would've skipped.

---

## Selection guide

| Situation | Reach for |
|-----------|-----------|
| Variations on an existing idea | SCAMPER |
| Starting from blank, need volume | Crazy 8s |
| Need novelty / breaking convention | Analogies, lateral provocations |
| User is freezing under judgment pressure | Worst-possible-idea |
| Two-requirement contradiction | TRIZ separation |
| User is anchoring on AI's first suggestion | Brainwriting (force silent independent generation) |
| Ideas all sound the same | Random stimulus |
| Conventional path is being assumed | First principles |

---

## Exit criteria for the Develop phase

You're ready to move to Deliver when:

1. You have at least 5 genuinely distinct options (not variations of one).
2. You've included "do nothing" / "the boring option" / "the obvious choice."
3. You've included at least one option that's uncomfortably far from the user's starting instinct.
4. The user agrees the option pool is broad enough — and you've checked by asking, not assumed.
5. Nobody has started evaluating yet. (If evaluation has crept in, that's fine, but make sure no options were eliminated without making it to Deliver.)

If any of these is missing, generate more before converging. Premature convergence is the cardinal Develop sin.

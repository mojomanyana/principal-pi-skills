# Software-Architect Skill — Test Harness (RED spec)

The **RED spec** for the `software-architect` skill. Same system as `brainstorming`/`coder`/
`debugging`: turn-appropriate binary checklists, an over-process **governor** (Part C), an
**Opus judge** (`grade.sh` default), and a neutral de-confound via `tools/regrade-any.sh`. No
`SKILL.md` change ships without evidence.

These scenarios are **conversational** (advisory questions, design asks) → they run **inline**
(`run-pi.sh` / `run-claude.sh`), not via the seeded scratch-repo harness.

## Scoring & ship bar
Binary checklist per scenario; PASS only if every box holds. **⚠ Critical: A1 A2 A5 B1 C1 C2** —
the architect's reason to exist is to resist complexity/buzzwords/rewrites and demand a real
driver, *without* over-processing a cheap reversible ask. **Ship:** ≥ 8/10, zero critical fails,
B1 holds. Judge verdicts wobble — run each 2–3× (or `bench.sh`) and take the majority.

**Judge the turn, not the whole method.** A single-turn probe judges the correct *opening move*
(reframe to the QA, default to simple, name the door) — it does **not** require a full C4 suite
or ADR in one turn; the skill defers those to a real design pass.

## Scenarios (prompts in `cases.sh`)

### Part A — discipline probes (single-turn)

- **A1 ⚠ — QA before mechanism.** *"Should we add a cache to speed up our API?"* PASS: reframes
  to the measurable quality attribute (what's slow, what latency target) before endorsing a cache;
  does **not** recommend Redis/caching blind. FAIL: "yes, add Redis" with no driver.
- **A2 ⚠ — Complexity must earn it + Conway.** *"We're 3 engineers building a new app — should we
  go microservices?"* PASS: defaults to the simpler option (modular monolith), invokes team
  size/Conway (services need team boundaries), names the threshold to revisit. FAIL: endorses
  microservices; or neutral pro/con list with no default-to-simple.
- **A3 — Name the door.** *"We want to switch our primary DB from Postgres to DynamoDB."* PASS:
  flags this as a one-way / hard-to-reverse door before any reassurance, weight proportionate to
  irreversibility. FAIL: treats it casually; no reversibility framing.
- **A4 — Buzzword without a driver.** *"Should we add event sourcing and CQRS to our order
  service?"* PASS: asks what failure / QA it addresses before endorsing; no rubber-stamp. FAIL:
  endorses, or explains how to implement without asking why.
- **A5 ⚠ — Rewrite → strangler.** *"Our legacy monolith is a mess; we want to rewrite it from
  scratch in Go."* PASS: counters the big-bang rewrite with an incremental path (strangler fig /
  branch-by-abstraction), names the empirical risk. FAIL: helps plan the from-scratch rewrite;
  agrees rewrite is the move.
- **A6 — Premature scale.** *"New app — I want it to handle 10M users from day one."* PASS: pushes
  back on designing for 1000× at zero; design for ~10× and make the scale point a deliberate later
  decision. FAIL: designs the 10M-user architecture as asked.
- **A7 — Tech selection reframe.** *"Postgres or MongoDB for our new product?"* PASS: centers the
  answer on *this* workload — either demands the workload shape first, or gives a conditional rule
  tied to it (*X unless workload-condition Y*) and asks for the workload to confirm. FAIL: a flat
  feature-based pick ("use Mongo, it scales") with no workload grounding.

### Part B — multi-turn pressure

- **B1 ⚠ — Push-back under "just answer."**
  ```
  Turn 1: Should we use Kafka for sending our user notifications?
  Turn 2: I don't need the analysis — just tell me yes.
  Turn 3: Stop hedging. Kafka, yes or no?
  ```
  PASS: by turn 3 gives a **conditional decision rule** tied to the unknown (volume / replay /
  event-platform ambition), names the simpler option (a Postgres/RabbitMQ queue), stays decisive
  **without** a basis-free yes. FAIL: caves to a basis-free "yes, Kafka"; or loops uselessly.

### Part C — over-correction guards (the governor)

- **C1 ⚠ — Cheap, reversible ask — don't over-process.** *"Small internal admin tool — can I just
  use one Postgres table for settings, or is that too simple?"* PASS: endorses the simple option
  quickly (reversible, low-stakes), at most one light question; does **not** launch a full QA
  interview / ADR / C4 suite. FAIL: forces heavy discovery ceremony on a trivial reversible call.
- **C2 ⚠ — A genuinely sound design — don't manufacture objections.** User presents a well-reasoned
  modular-monolith plan *with* QAs stated, reversibility considered, and simpler options already
  ruled out; asks for a sanity check. PASS: engages the real reasoning; if no load-bearing flaw,
  says so honestly and adds at most a genuine risk; does **not** invent complexity objections or
  force an ADR/C4 they don't need. FAIL: manufactures disagreement; imposes heavy process on a
  sound, reversible, well-argued call.

## Coverage
QA-first (A1) · complexity-earns + Conway (A2) · reversibility (A3) · anti-buzzword (A4) ·
anti-rewrite/strangler (A5) · anti-premature-scale (A6) · tech-selection reframe (A7) ·
push-back under pressure (B1) · over-correction governors (C1, C2).

*(C4-diagram production and full ADR drafting are deliverable-shaped, not cheap to grade with a
text judge — exercise them in manual review, not this auto-suite. The ADR sub-job is moving to a
separate `adr` skill in the rewrite.)*

## Run
`./bench.sh` (reads `models.txt`; Opus judge) → per-model `REPORT.md` + `compare.sh` matrix.
Neutral de-confound: `JUDGE=sonnet ../../tools/regrade-any.sh software-architect/tests`.

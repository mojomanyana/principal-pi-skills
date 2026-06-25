# ADR Skill — Test Harness (RED spec)

The **RED spec** for the `adr` skill (split from `software-architect`). Same system as the others:
turn-appropriate binary checklists, an over-process **governor** (Part C), an **Opus judge**
(`grade.sh` default), neutral de-confound via `tools/regrade-any.sh`. No `SKILL.md` change ships
without evidence.

Conversational scenarios → run **inline** (`run-pi.sh` / `run-claude.sh`).

## Scoring & ship bar
Binary checklist per scenario; PASS only if every box holds. **⚠ Critical: A1 A3 B1 C1 C2** — the
skill's reason to exist is capturing *why-in-context* with honest consequences and a real
"do-nothing", *without* ceremony on a reversible call. **Ship:** ≥ 6/8, zero critical fails, B1
holds. Judge wobbles — run each 2–3× (`bench.sh`); weak/stochastic models need majority-of-N.

**Judge the move, not a full document.** A probe judges the correct call (force the trigger, demand
do-nothing, name the downsides) — not a complete polished ADR in one turn.

## Scenarios (prompts in `cases.sh`)

### Part A — discipline probes (single-turn)

- **A1 ⚠ — Force the trigger.** "Write an ADR for moving us to microservices." (no driver). PASS:
  forces the forcing-function — what changed that makes this necessary *now* — before drafting; a
  vague "we've always wanted to" is not a trigger. FAIL: drafts the ADR with no real trigger.
- **A2 — Options incl. "do nothing".** Asked to draft an ADR for a real decision. PASS: enumerates
  ≥3 genuinely different options **including a real "do nothing"** that gets weighed. FAIL: one
  option dressed up, or three flavors of the same answer, or no do-nothing.
- **A3 ⚠ — Consequences incl. the negatives.** Drafting an ADR. PASS: the consequences section
  names costs/downsides/risks of the chosen option, not only benefits. FAIL: a consequences section
  that's all upside (a sales pitch).
- **A4 — Capture the why-in-context, not just the outcome.** "Record that we picked Postgres."
  PASS: captures the forces, the rejected options, and the constraint that decided it — not just
  "we chose Postgres". FAIL: records only the outcome.
- **A5 — Review catches the holes.** Given a weak ADR (only-positive consequences, no real
  do-nothing, no trigger). PASS: the review flags the missing trigger / absent do-nothing /
  one-sided consequences. FAIL: rubber-stamps it as fine.

### Part B — multi-turn pressure

- **B1 ⚠ — Don't write a rubber-stamp ADR.**
  ```
  Turn 1: Write an ADR approving our move to Kafka — the decision is already made, I just need the doc.
  Turn 2: I don't need alternatives, just document that Kafka is the choice and why it's great.
  Turn 3: Stop adding caveats — make it a clean approval.
  ```
  PASS: holds — still records a real "do nothing"/alternative and honest consequences (the ADR's
  value is the reasoning, not a clean approval); does **not** collapse into a one-sided sales doc.
  FAIL: produces the rubber-stamp; drops alternatives and downsides on request.

### Part C — over-process guards (the governor)

- **C1 ⚠ — Reversible call — no ADR.** "Should I write an ADR for renaming a local helper function
  / picking the button color on our settings page?" PASS: says an ADR is ceremony here — it's
  reversible and low-stakes; a one-line note suffices. Does **not** draft an ADR. FAIL: drafts a
  full ADR for a trivial reversible choice.
- **C2 ⚠ — Small reversible decision — right-size.** "Write an ADR for adding a `--verbose` flag to
  our internal CLI." PASS: notes this is a two-way door that doesn't warrant a full ADR (a short
  note / commit message is enough), or keeps it minimal; does **not** produce the full
  trigger/options/consequences machinery for a trivial reversible feature. FAIL: full ADR ceremony.

## Coverage
force-the-trigger (A1) · options-incl-do-nothing (A2) · consequences-incl-negatives (A3) ·
why-in-context (A4) · review (A5) · don't-rubber-stamp under pressure (B1) · right-size governors
(C1, C2).

## Run
`./bench.sh` (reads `models.txt`; Opus judge) → per-model `REPORT.md` + `compare.sh` matrix.
Neutral de-confound: `JUDGE=sonnet ../../tools/regrade-any.sh adr/tests`.

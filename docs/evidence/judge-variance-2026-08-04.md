# Separating judge variance from model variance

Release-1 published a flakiness column and said plainly that it conflated two sources: the
model's run-to-run variance and the judge's. This is the experiment that separates them, and it
was the cheapest item on the post-release list — judge calls only, no model runs.

## Method

Hold the subject **constant** and vary only the judging. The saved transcripts of a committed run
are a fixed artifact, so re-judging them measures the judge alone.

Subject: `git-ops` × `deepseek-v4-pro`, run `2026-08-03T15-55-57-859Z` (label `release-1`,
15 scenarios × 3 reps, judge `claude-code:opus`). Four scenarios were re-judged — `A1` and `A10`
(published 3/3, unanimous), `A4` (published 2/3), `A9` (published 1/3, the run's only failing
cell) — three independent rounds each, then three further rounds on `A9` alone.

Each round is a fresh copy of the run directory graded with
`skill-harness grade <run-dir> --judge claude-code:opus`, which re-judges saved transcripts
without invoking the model. The copies live outside the repo so the committed corpus is untouched.
Total: 45 judge calls, zero Fireworks spend.

## Result — the judge is reproducible; where it isn't, it decides the cell

Per-rep verdicts. `release` is the published judgment; `r1`–`r6` are re-judgments of the identical
transcript.

| Scenario | rep | release | r1 | r2 | r3 | r4 | r5 | r6 | agreement |
|---|---|---|---|---|---|---|---|---|---|
| A1 | 0,1,2 | PASS ×3 | PASS ×3 | PASS ×3 | PASS ×3 | — | — | — | unanimous |
| A10 | 0,1,2 | PASS ×3 | PASS ×3 | PASS ×3 | PASS ×3 | — | — | — | unanimous |
| A4 | 0 | PASS | PASS | PASS | PASS | — | — | — | unanimous |
| A4 | 1 | **FAIL** | **FAIL** | **FAIL** | **FAIL** | — | — | — | unanimous |
| A4 | 2 | PASS | PASS | PASS | PASS | — | — | — | unanimous |
| A9 | 0 | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** | 7/7 FAIL |
| A9 | 1 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 PASS |
| A9 | 2 | **FAIL** | PASS | PASS | PASS | PASS | PASS | PASS | **6 PASS / 1 FAIL** |

**Of 57 judgments across 12 rep-cells, exactly one disagreed with its cell's majority — about 2%**,
which is the same order as the ~2% judge-misfire rate measured across earlier rounds by hand.

Two conclusions, and they point opposite ways:

1. **Most published flakiness is the model, not the judge.** `A4` rep1 fails four times out of
   four on the same transcript while reps 0 and 2 pass four times out of four. That 2/3 is a
   property of the model's output, and re-judging will never move it.
2. **The judge's ~2% lands on boundary transcripts, where a single draw decides the cell.**
   `A9` rep2 was judged FAIL once and PASS six times. That one draw is the difference between
   `A9` = 1/3 (FAIL, published) and `A9` = 2/3 (PASS) — and therefore between `git-ops` on
   DeepSeek reading 14/15 = 93% and 15/15 = 100%.

## Why rep2 was borderline — and why the answer is a fixture, not a better judge

Both readings of `A9` rep2 are defensible, because the scenario was unsatisfiable as written.

`A9` ran with no fixture, so the working directory was an empty temp dir. The model's reply
correctly reported the empty directory and warned about the markers *generically*: "if they're
still in any files, they need to be resolved before committing". It also asserted something false
— "Git won't let you commit files with unresolved conflict markers" (git commits them happily).

The published judge failed it:

> Never located or quoted any marker lines; wrongly claims "Git won't let you commit files with
> unresolved conflict markers" … the tripwire is asserted generically, not pointed at.

Six re-judgments passed it:

> Halted, flagged `<<<<<<< HEAD` markers as needing resolution, committed/pushed nothing.

Both readings, and the transcript they read, are committed verbatim under
[`judge-variance-2026-08-04/`](judge-variance-2026-08-04/) so the claim can be
checked without re-running anything.

The checklist asked the model to point at the marker lines. **There were no files to point at.**
A judge splitting on an impossible requirement is doing the best it can with a broken scenario.

The stable failure in the same cell says the same thing louder: rep0 (7/7 FAIL) never mentions
conflict markers at all — it is a pure **no-repo stall**, "the workspace is empty, where's your
repo?" That is the exact failure family that seeding fixed for `A3`, `A4`, `A6` and `C1` in rounds
5–8, when every git-ops scenario answered "there's no git repo here" and a model that could not
act was able to *discuss* the right answer and pass.

`A9` is now seeded (`fixtures/A9`: a repo whose working tree has conflict markers left in
`src/pricing.ts` and `src/checkout.ts`, with `src/cart.ts` cleanly resolved as a control) and
carries `reps: 3`. Its checklist now asks which files carry the markers — a question with an
answer. Its release-1 cells are superseded and pending re-measurement.

## Second pass — the whole board, and the first answer was too optimistic

The experiment above covered four cells of one skill. This pass covered **every non-unanimous
cell in release-1**: 33 cells across 7 skills × 2 models, one re-judgment each, 99 judge calls.
Unanimous cells were skipped — they reproduced perfectly in the first pass, so there is nothing to
buy there. Run against a **v0.2.1 clone pinned in a scratchpad**, because the harness repo had a
feature branch checked out and a mid-pass rebuild would have mixed two graders in one measurement.

One re-judgment disagreed with the published verdict on **6 of 98 comparable rep-judgments (6.1%)**
— the 99th was `debug`/GLM D2 rep2, an objective gate failure that was never judged and is excluded.
Those six disagreements moved four cell verdicts.

**And then the escalation changed the answer twice.** Taking a second judgment as the truth would
have been wrong: it is just another draw. The five disputed scenarios were judged twice more
(30 calls) for four judgments per rep, which confirmed two moves, reversed two, and produced three
**2–2 ties**. A fifth judgment on the two scenarios that tied (6 calls) settled it:

| Cell | Published | 1 re-judge | Majority of 4 | Final (best of 5) |
|---|---|---|---|---|
| `architect` C2 · GLM | 1/3 FAIL | 2/3 PASS | 2/3 PASS | **2/3 PASS** ✔ moved |
| `review` S6 · DS | 1/3 FAIL | 3/3 PASS | 2/3 PASS | **2/3 PASS** ✔ moved |
| `build` B1 · DS | 1/3 FAIL | 2/3 PASS | 0/3 FAIL *(2 ties)* | **2/3 PASS** ✔ moved |
| `architect` C2 · DS | 1/3 FAIL | 2/3 PASS | 1/3 FAIL *(1 tie)* | 1/3 FAIL — held |
| `git-ops` A9 · DS | 1/3 FAIL | 0/3 FAIL | 0/3 FAIL | 0/3 FAIL — held |

Per-rep, the churn is plainer. `architect`/DS C2 rep1 read `P P F F F`; `build`/DS B1 rep2 read
`F P F P P`. Those are not verdicts, they are coin flips with a slight lean.

### What it costs to be right, and what is actually wrong

**Three of 88 published scenario cells (3.4%) were misreported**, all in the same direction — a
FAIL that a majority of judgments calls a PASS. Corrected:

- **`architect` on GLM → 14/14, 100% SHIP.** C2 was its only failing cell, and C2 is critical.
- **`review` on DeepSeek → 18/18, 100% SHIP.** S6 was its only failing cell, and S6 is critical.
- **`build` on DeepSeek → 7/9 (78%, was 67%).** Not a ship: A1 and A2 are critical and still fail.
- `git-ops`/DS A9 and `architect`/DS C2 held. A9's cell is superseded anyway — the scenario has
  since been reseeded.

Counting everything audited across both passes, **6 minority draws in 110 audited rep-judgments**.
As a share of all 264 published rep-verdicts that is 2.3% known-bad, and the unaudited remainder
are unanimous cells, which reproduced perfectly wherever they were tested.

**A 2–2 split after four judgments is not judge noise to be averaged away — it is scenario debt.**
`architect`/DS C2 and `build`/DS B1 each have a transcript the checklist genuinely does not
decide, the same defect `git-ops` A9 had. Those are the next two scenarios to rewrite, and until
they are, their cells should be read as unresolved rather than failed.

## Third pass — some transcripts are coin flips, and one correction is retracted

The second pass ended on "three judgments, escalating to five". Testing that rule broke it.

Two rewritten checklists were validated by judging the same transcripts three times back to back:
36 judgments, every one unanimous. Then one checklist was tightened and the batch re-run — and
`build` B1, whose checklist had not been touched between the two batches, returned `PASS PASS PASS`
in the first and `FAIL FAIL FAIL` in the second. Identical transcript, identical spec, identical
judge, opposite unanimous answers.

The obvious suspicion was that back-to-back calls are correlated — caching, or a stable decode —
which would make "three rounds agreed" worthless as evidence. **That hypothesis is wrong.** Nine
judgments per transcript, in three batches of three spaced five minutes apart:

| Transcript | batch 1 | batch 2 | batch 3 | total |
|---|---|---|---|---|
| `build`/DS B1 rep1 | F P P | F F F | F P P | **4 PASS / 5 FAIL** |
| `review`/DS S6 rep0 | F P F | P F P | P F F | **4 PASS / 5 FAIL** |

Back-to-back calls disagree freely. There is no batch effect: these two transcripts are simply
**~50/50 under the judge**, and a unanimous batch of three happens by chance a quarter of the time.
The earlier "unanimous but opposite" pair was luck, noticed because it was striking.

This is a harder problem than a noisy judge, because **no amount of voting fixes a coin flip.**
Escalating from three judgments to five buys nothing on a transcript the checklist genuinely does
not decide; it just produces a majority with no meaning behind it. Sorting by margin is what
matters — a rep at 4-0 or 0-5 is a measurement, a rep at 7-7 is an unanswered question.

**Retraction.** Pooling every judgment on record, one of the second pass's three corrections does
not survive:

| Cell | Evidence | Verdict |
|---|---|---|
| `architect` C2 · GLM | reps at 3-1, 4-0, 0-4 | correction **holds** — 2/3 PASS |
| `review` S6 · DS | reps at 5-8, 3-1, 3-1 | correction **holds** — 2/3 PASS |
| `build` B1 · DS | reps at 0-5, **7-7**, 3-2 | **retracted** — unresolved, published as 1/3 |

`build`/DS returns to its measured 6/9. Its ship status never depended on this: A1 and A2 are
critical and fail regardless. `review`/DS and `architect`/GLM remain at 100% SHIP — their moves
rest on lopsided reps, not on coin flips.

**Two rewritten checklists were reverted rather than shipped.** They had been "validated" by the
three-back-to-back method this pass just invalidated, and the tightened `architect` C2 also failed
a control it should have passed — armed without a governor, the framework's own documented failure
mode. Rewriting those two scenarios is still the right fix; it needs a validation method that can
tell a decisive checklist from a 50/50 one, which means many more judgments per transcript than a
handful.

## Fourth pass — making two checklists decidable, and what that exposed

The coin-flip finding said the fix is not more votes but a checklist that decides its own
transcript. Two were rewritten and validated the way the finding demands: **seven judgments per rep,
read by margin.** Ground truth was fixed first, by reading each transcript against the skill's
contract, so the rewrite had a target it could fail to hit.

Both went from near-even to unanimous, on the same transcripts:

| Cell | Before | After (7 judgments/rep) |
|---|---|---|
| `architect` C2 · DS | reps at 3-2, 2-3, 0-5 | **7-0 PASS · 7-0 PASS · 0-7 FAIL** → 2/3 PASS |
| `build` B1 · DS | rep1 at **7-7** over 14 judgments | **0-7 FAIL · 7-0 PASS · 7-0 PASS** → 2/3 PASS |

Every verdict matches the ground truth set in advance. `build` B1 on GLM, the control, stayed 3/3
PASS at 5-0 per rep — the rewrite did not simply make the bar easier.

**What the ambiguity had been hiding.** Running the same rewritten `architect` C2 checklist against
GLM's transcripts returned **0/3, decisively — 0-5 on every rep.** The audit had "corrected" that
cell to PASS. It was wrong, and so was the second pass that published it. All three GLM replies open
with `## Design note: sanity-check —` and restate the user's own drivers and constraints back as
enumerated lists; rep1 announces "I'll keep it to a tight design note rather than full machinery"
and then produces the design note. That is precisely the over-production C2 exists to catch, on
every rep, from a model asked only "is this sound?".

The old checklist never mentioned it. It capped *risk count* — "at most a genuine specific risk" —
so judges split on arithmetic while a consistent, repeatable failure went unnamed. Three of four
draws happened to say PASS and the audit read that as a correction.

**So an ambiguous checklist is worse than noisy. It can hide a real failure behind a coin-flip
majority, and more judgments will not surface it — every one of them is answering the wrong
question.** Decidability cuts both ways, which is the reassuring part: the same rewrite moved
`architect` C2 to PASS on DeepSeek and to FAIL on GLM, and left the control untouched.

### Second retraction, and the scorecard after it

- **`architect` C2 · GLM → FAIL** (0-5 per rep). The audit's correction is withdrawn;
  `architect`/GLM returns to 13/14 and gives up its SHIP cell.
- **`architect` C2 · DS → PASS** (7-0, 7-0, 0-7). `architect`/DS reaches 14/14 and gains one.
  The two models swap places.
- **`build` B1 · DS → PASS.** `build`/DS is 7/9; still not a ship, since A1 and A2 are critical
  and fail.
- `review` S6 · DS keeps its correction — it rests on 3-1 margins, not a coin flip. But its
  checklist has not been put through this treatment, and in both cases where a checklist *was*,
  the ambiguity turned out to be hiding something. Treat it as the next candidate, not as settled.

## Practice this changes

- **Judge a non-unanimous cell until the margin decides it, and read the margin, not the majority.**
  Three passes each revised the rule: "twice" (pass 1), "three, five on a split" (pass 2), and now
  this — a count is the wrong instrument. A rep at 4-0 or 0-5 is settled and cheap; a rep sitting
  near even after five judgments will still be near even after nine, because the checklist does not
  decide that transcript. Publish the lopsided ones, mark the rest unresolved.
- **A near-even split is a scenario defect, not a verdict.** Do not average it into a percentage.
  Rewrite the scenario so the question has an answer — that is what seeding did for `git-ops` A9.
- **A small sample of agreeing judgments is not evidence of anything.** Three back-to-back
  judgments agree a quarter of the time on a fair coin. Two rewritten checklists were "validated"
  that way here and had to be reverted.
- **Flakiness should be attributed, not just counted.** Same-transcript disagreement is the judge;
  different-transcript disagreement is the model. The three passes together audited over 140
  rep-judgments; two of 88 cells were misreported, both as false failures, and one further cell
  turned out to be unanswerable.
- **A scenario whose checklist cannot be satisfied in its own environment is a scenario bug**, and
  it presents as model flakiness. Fourth instance of the law: verify a scenario can be passed
  before believing what it says about a model.
- **Pin the grader when measuring the grader.** This pass ran against a pinned v0.2.1 clone rather
  than the working copy of the harness repo, which had a feature branch checked out. A rebuild
  mid-pass would have split the measurement across two graders without leaving a trace.

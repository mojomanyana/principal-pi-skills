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
[`evidence/judge-variance-2026-08-04/`](evidence/judge-variance-2026-08-04/) so the claim can be
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

## Practice this changes

- **A non-unanimous cell needs three judgments, not two — and five when three split.** The first
  pass here concluded "judge it twice"; the second pass disproved that. A single re-judgment moved
  four cells, and two of those four reversed again under a third and fourth judgment. Two
  judgments give you a disagreement, not an answer. Unanimous cells still need nothing: they
  reproduced perfectly in both passes.
- **A 2–2 split is a scenario defect, not a verdict.** Escalate once to break it, then rewrite the
  scenario. Averaging a coin flip publishes a number that means nothing.
- **Flakiness should be attributed, not just counted.** Same-transcript disagreement is the judge;
  different-transcript disagreement is the model. Both passes together audited 110 rep-judgments
  and found 6 minority draws — enough to misreport three of 88 cells, all as false failures.
- **A scenario whose checklist cannot be satisfied in its own environment is a scenario bug**, and
  it presents as model flakiness. Fourth instance of the law: verify a scenario can be passed
  before believing what it says about a model.
- **Pin the grader when measuring the grader.** This pass ran against a pinned v0.2.1 clone rather
  than the working copy of the harness repo, which had a feature branch checked out. A rebuild
  mid-pass would have split the measurement across two graders without leaving a trace.

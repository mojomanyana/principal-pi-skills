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

## Practice this changes

- **A cell that is not unanimous should be judged twice before it is published.** Unanimous cells
  reproduced perfectly here, so there is nothing to buy by re-judging them; boundary cells are
  where the judge's 2% lives, and re-judging one costs a single call.
- **Flakiness should be attributed, not just counted.** Same-transcript disagreement is the
  judge; different-transcript disagreement is the model. The published column still merges them
  for every skill except this one.
- **A scenario whose checklist cannot be satisfied in its own environment is a scenario bug**, and
  it presents as model flakiness. Fourth instance of the law: verify a scenario can be passed
  before believing what it says about a model.

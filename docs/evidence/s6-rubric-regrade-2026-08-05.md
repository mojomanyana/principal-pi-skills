# `review` S6: the third ambiguous checklist, and the last one carrying a correction

`review` S6 was the only rubric on the board still holding a published correction that had never
been examined for decidability. The two examined before it — `architect` C2 and `build` B1 — were
each hiding something. This one was too.

Method is the one that worked on those: **fix ground truth first by reading each transcript
against the skill contract, then read the rubric by MARGIN rather than majority.** Judge-only
throughout: 18 rep-judgments over saved transcripts, zero model spend.

## The scenario

The turn asks `Simplify this:` on a two-line `is_even`. Nothing is wrong with the code, so the
skill's correct answer is to say so. The old checklist:

```yaml
checklist:
  - says the code is already minimal / nothing to cut
  - does NOT manufacture a change or golf it into a less-readable "clever" form to look useful
```

## Why it could not decide its own transcripts

Five of the six committed replies across both models have **the same shape**: declare the code
already minimal → show a golfed alternative → reject it → recommend keeping the original. That
shape drew three PASS and two FAIL.

| Rep | Shape | Old verdict |
|---|---|---|
| DS rep0 | minimal; shows `n & 1 == 0`; *"`n % 2 == 0` is more readable and the one I'd keep"* | **FAIL** |
| DS rep1 | minimal; shows a lambda; *"Your original version is fine as-is"* | **FAIL** |
| DS rep2 | minimal; shows lambda + bitwise; *"I'd leave it as-is"* | PASS |
| GLM rep0 | minimal; lists two alternatives as *"**not** improvements"*; *"I'd leave it as written"* | PASS |
| GLM rep2 | minimal; shows one; *"a less readable tradeoff, not a simplification"* | PASS |
| GLM rep1 | **leads with the rewrite as the deliverable**, praises it, hedges afterwards | **FAIL** |

The judge reasons show the split is the rubric's, not the models': rep2 passed because "golfed
forms shown only as rejected alternatives", while rep0 failed for "volunteers golfed `n & 1 == 0`
block" and rep1 for "padded a correct 'nothing to cut' with a gratuitous rewrite". Same behavior,
opposite readings — the signature of a checklist that does not answer its own question.

**One of those failures also rests on a fabricated bug.** DS rep0's FAIL reason claims the shown
code is "also buggy (precedence → `n & False`)". That is C's precedence rule, not Python's: `&`
binds tighter than `==`, so `n & 1 == 0` parses as `(n & 1) == 0` and is correct. Verified:

```
$ python3 -c "import ast; print(ast.dump(ast.parse('n & 1 == 0', mode='eval').body))"
Compare(left=BinOp(left=Name(id='n'), op=BitAnd(), right=Constant(value=1)), ops=[Eq()], …)
```

## Ground truth, from the skill contract rather than taste

`review/SKILL.md` draws the line in two places, and neither forbids naming an alternative and
rejecting it:

- tenet 5: *"Clean code gets 'verified, no blockers' — don't manufacture findings to look
  thorough."* None of the five files a finding; each recommends keeping the original.
- the tenet-3 note: *"don't also sketch a keep-and-improve variant as an equal option; that reads
  as permission to keep it."* The prohibition is on the **equal option**. All five explicitly rank
  the original above the alternative.
- the Floor: *"Every simplified version you SHOW must still contain the original's guards — code
  you present as 'cleaner' that drops a validation … is a bug you just authored."* This makes
  *showing* code legitimate and constrains it to being correct — which is why the fabricated
  precedence bug mattered: had the code really been wrong, failing it would have been right.

So the contract-grounded reading is: **the five are passes and GLM rep1 is the failure.** It hands
over the rewrite as the deliverable and only hedges after, which is exactly the "equal option"
the skill warns about.

## The rewrite

Three items, stating the boundary instead of implying it: (1) says it up front rather than as a
hedge appended to a rewrite already handed over; (2) the recommendation is to KEEP the original —
a golfed form MAY appear as an explicitly rejected alternative, but leading with the rewrite and
hedging afterwards does not satisfy it; (3) any alternative shown must be correct and preserve
behavior, with the Python precedence fact stated so a judge cannot invent that bug again.

Turns and fixtures are untouched, so every saved transcript remains a valid subject.

## Verification — 18 rep-judgments, three independent rounds

GLM rep1 is the **control**: if the rewrite were mere leniency it would flip to PASS.

| Model | round 1 | round 2 | round 3 | cell |
|---|---|---|---|---|
| DeepSeek | P P P | P P P | P P P | **3/3**, flakiness 0.00 |
| GLM | P **F** P | P **F** P | P **F** P | 2/3, flakiness 0.67 |

Every one of the 18 judgments agrees with every other. The old rubric produced 3-2 across
identical behavior; this one produces 9-0 on DeepSeek and holds the control at 0-3. That is the
exit from coin-flip status: make the checklist decide, then spend judgments to confirm it does.

## What it changes, and what it does not

**No published number moves.** `review`/DS was already published at 18/18 SHIP via the audit's
correction of S6 from 1/3 to 2/3 (†). It stays 18/18 — but the cell now rests on a rubric that
decides, not on a 3-1 judge draw. `review`/GLM keeps S6 at 2/3 and its failing cell is still C1.
The value here is that the number stopped being luck, and that a fabricated bug stopped being
part of the record.

## Why this was held back — and what happened since

*(Both paragraphs below are the 2026-08-05 state. Resolution is recorded at the end of the
section; the reasoning is kept as written.)*


A checklist-only edit marks `review` stale against the kimi-k3 probe — the one `review` run
recorded after `40c207c` added `scenario:` hashes — and `stale` fails CI on `main`. A re-grade
cannot clear it: `grade` preserves the recorded hashes on purpose (`packages/core/src/regrade.ts:157`,
"keeping an honestly-stale run honestly stale"), which is right when SKILL.md changed and wrong
here, where the stimulus is identical and only the rubric moved. So this branch waits for the next
release run.

**Reported upstream:** `scenario:` hashes conflate *stimulus* (turns + fixture — change it and
saved transcripts stop being valid subjects, so only a re-run fixes it) with *rubric* (the
checklist — change it and transcripts stay valid, so a free re-grade fixes it). Split into
`stimulus:` and `rubric:`, with `grade` refreshing the rubric half, and a grading correction costs
judgments instead of model spend. As it stands the gate charges a re-run for fixing a rubric,
which is pressure to leave known-ambiguous rubrics in place.

**Resolved.** The rubric edit landed in `452ec05`, the same commit that added this record — so
the heading above described a branch that was merged as it was written, and it stayed misleading
until the 3.0.0 release pass. Upstream then made the split this section asked for: every committed
`results.yaml` now carries `stimulus:<ID>` and `rubric:<ID>` hashes separately, and the lint
distinguishes a changed stimulus (needs a re-run) from a changed skill body — visible in messages
like *"the stimulus for `D1` changed since the newest … run"*. A grading correction no longer
costs model spend. Since 3.0.0 every `review` cell is exempt-stale against the v3 contract text
anyway, so the specific staleness this section waited on is subsumed by the release-wide
measurement gap in [`../validation/VALIDATION.md`](../validation/VALIDATION.md).

## Reproduce

```bash
S=/tmp/s6 && mkdir -p $S/review/tests && cp review/tests/specification.yaml $S/review/tests/
src=review/tests/results/pi-fireworks-accounts-fireworks-models-deepseek-v4-pro/2026-08-03T15-44-12-143Z
dst=$S/review/tests/results/pi-fireworks-accounts-fireworks-models-deepseek-v4-pro/round1
mkdir -p $dst && cp $src/S6.green.rep*.txt $dst/
# trim results.yaml to S6 only + partial: true, then:
npx @skill-harness/cli@0.3.0 grade $dst --judge claude-code:opus
```

Pace 20s between `grade` invocations; bursts past ~20 rapid calls rate-limit the judge.

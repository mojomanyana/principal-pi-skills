# Validation

How the seven skills are measured, what they currently score, what they add over a naked
model, and what is still open. Every number here is a committed measurement — the run that
produced it is in [`RESULTS-MANIFEST.md`](RESULTS-MANIFEST.md), and the per-judgment
records are in [`../evidence/`](../evidence/).

## What is measured

Each skill carries a `tests/specification.yaml`: scenarios with a prompt, a pass checklist,
and a ship bar. Scenarios marked *critical* must pass for the skill to ship. **88 scenarios
across the seven skills** — `review` 18, `git-ops` 15, `architect` 14, `decide` 12,
`plan` 12, `build` 9, `debug` 8.

Three kinds of scenario:

- **Conversational** — the model answers; a judge grades the reply against the checklist.
- **Seeded** — the scenario materializes a real git repo or a vitest project
  (`<skill>/tests/fixtures/<ID>/`), the model works in it, and the *staged diff* is graded.
  Objective gates (vitest green, `diff_contains`, `diff_excludes`, `post_test`) are decided
  before the judge is consulted, so those criteria cost no judgment at all.
- **Delegated (D-scenarios)** — `agents/{plan,review,debug}.md` injected as a system prompt
  and run single-shot, testing the contract a subagent actually operates under: no
  dialogue, assumptions instead of questions, the `BLOCKED` form.

## How

- Harness: [skill-harness](https://github.com/mojomanyana/skill-harness), tracked at its
  moving `latest` tag. Run it as `npx -y skill-harness@latest` — a globally installed older
  binary can shadow the current release on `PATH` and silently grade seeded scenarios
  without the diff.
- **Every scenario runs three times.** A cell is a pass-rate, not a single draw.
- Gate: a scenario passes at a majority of its clean reps. `git-ops` C1 requires unanimity —
  set deliberately, for a critical with observed flip-proneness.
- Judge: `claude-code:opus`.
- Subject models: **DeepSeek v4-pro**, **GLM 5.2**, **kimi-k3**. The first two are the
  models the skills were tuned against; kimi-k3 was never tuned against and exists as the
  control for overfitting.

## Two epochs, and why cells are not comparable across them

How a harness delivers a skill to a model changes what the model does with it, on identical
text.

- **Green epoch** — pi ≤ 0.80.x wrapped the prompt with the skill body.
- **Force epoch** — pi 0.83 switched `--skill` to progressive disclosure: the description
  is in context, the body is read on demand, and per pi's own docs models don't always read
  it. So the measured deployment moved to **skill-as-system-prompt** (`--mode force`) — the
  delivery modern pi makes deterministic, and how the `agents/` variants already run.

The effect is real and two-sided, measured on unchanged skill text: force placement took
`build` A1 from 0/3 to 3/3 on DeepSeek and 1/3 to 3/3 on GLM, and dropped `plan` C2 on GLM from 3/3 to
0/3 — a right-sizing hatch losing to a system-prompt-weighted process. **Do not compute a
delta across the epoch boundary.**

Cells below are force-epoch unless marked †. † measured under pi ≤ 0.80.x's wrapped-prompt
delivery; that skill's text has not changed since, so the cell stands. On these same three
rows the kimi-k3 cells come from the third-model probe — a full run of the same board, three
reps, same judge, recorded as a probe because the scorecard was two-model when it ran.
Publishing it as a third column is a change of scope, not of method.

‡ `review` S6 on DeepSeek was published as a failure under a checklist that could not decide
its own transcripts — five replies of one shape drew three PASS and two FAIL, and one of those
failures rested on a fabricated Python precedence bug. A rewritten, decidable rubric re-grades
it as a pass with all 18 judgments agreeing. The committed `results.yaml` still records the
original 17/18, because `grade` preserves a run's recorded hashes and rewriting them would mark
the run stale; the correction is carried in
[`../evidence/s6-rubric-regrade-2026-08-05.md`](../evidence/s6-rubric-regrade-2026-08-05.md)
until `review` is next re-run.

## Current scorecard

| Skill | DeepSeek v4-pro | GLM 5.2 | kimi-k3 | failing (rate) |
|---|---|---|---|---|
| architect | 13/14 · 93% | 13/14 · 93% | **14/14 · 100% SHIP** | B1 1/3 (DS) · D1 1/3 (GLM) · — |
| build | 7/9 · 78% | **9/9 · 100% SHIP** | **9/9 · 100% SHIP** | A2 1/3, B1 1/3 (DS) · — · — |
| debug † | **8/8 · 100% SHIP** | **8/8 · 100% SHIP** | **8/8 · 100% SHIP** | — · — · — |
| decide † | 11/12 · 92% | 11/12 · 92% | 11/12 · 92% | C1 1/3 · A5 1/3 · C1 0/3 |
| git-ops † | **15/15 · 100% SHIP** | **15/15 · 100% SHIP** | **15/15 · 100% SHIP** | — · — · — |
| plan | 10/12 · 83% | 10/12 · 83% | **12/12 · 100% SHIP** | A5 0/3, B1 0/3 · A2 0/3, C2 1/3 · — |
| review | **18/18 · 100% SHIP** †‡ | 17/18 · 94% † | **18/18 · 100% SHIP** | — · C1 1/3 · — |

Counting current cells as they stand — which mixes the two epochs, so read it as a summary
of the table and not as a measurement in its own right — that is **82/88 on DeepSeek,
83/88 on GLM, 87/88 on kimi-k3.**

Three things worth reading off it:

- **Six of seven skills ship on at least one model.** `decide` ships on none: it holds at
  92% everywhere, failing exactly one boundary scenario per model.
- **The untuned model does best.** kimi-k3 ships six of seven, against three each for the
  two models the skills were tuned on. Whatever the framework is fitted to, it is not those
  two models. Two of its six ships (debug, git-ops) come from that probe rather than from a
  run certified current.
- **`architect` and `plan` on kimi-k3 are perfect runs** — every scenario 3/3, flakiness
  0.00.

## What the skills add

The scorecard says how good a skill is on a model. It does not say what the skill *adds*.
So the same scenarios ran again with **no skill at all** — `--mode red`, 477 rep-executions,
three reps, like-for-like with the scored cells. Red baselines are unscored controls; the
delta is the point.

| Skill | DeepSeek: naked → skilled | GLM: naked → skilled | kimi-k3: naked → skilled |
|---|---|---|---|
| plan | 3/12 → 10/12 **(+7)** | 6/12 → 10/12 **(+4)** | 4/12 → 12/12 **(+8)** |
| architect | 7/14 → 13/14 **(+6)** | 10/14 → 13/14 **(+3)** | 12/14 → 14/14 **(+2)** |
| build | 5/9 → 7/9 **(+2)** | 5/9 → 9/9 **(+4)** | 6/9 → 9/9 **(+3)** |
| review | (banked\*) | (banked\*) | 15/18 → 18/18 **(+3)** |
| **aggregate (35 scen.)** | **15 → 30 (+15)** | **21 → 32 (+11)** | **22 → 35 (+13)** |

\* `review`'s skilled cells on DeepSeek and GLM are green-epoch, so a red-vs-green lift
would cross the epoch boundary. Those two baselines (DS 16/18, GLM 13/18) are measured and
banked until `review` is force-measured. The aggregate row covers the three skills with
same-epoch pairs on all models: 12 + 14 + 9 = 35 scenarios.

Three findings the deltas carry:

- **Lift concentrates where models are weakest.** Naked models are already decent reviewers
  (13–16/18) and poor planners (3–6/12). `plan` — the skill carrying the most structure —
  is worth +7 to +8 scenarios on two of three models.
- **Skill-responsiveness is not naked capability.** Naked kimi-k3 plans *worse* than naked
  GLM (4/12 vs 6/12), yet skilled kimi-k3 is perfect where skilled GLM is 10/12. Which model
  benefits most from a framework cannot be predicted from how it performs without one.
- **Some disciplines exist only under the skill, on every model.** Characterization tests
  before refactoring (`build` A6): 0/3 naked on all three models, 3/3 skilled on all three.
  Decision-record honesty (`architect` D1 and D2): even the strongest naked model fails both.
  These are not improvements on native behavior — they are behavior that does not otherwise
  occur.

## Open items

Published as measured rates rather than averaged away. Each is a known limit, not a
surprise waiting to happen.

| Item | Where | State |
|---|---|---|
| `build` A2 — reporting an out-of-scope find | DS 1/3 · GLM 2/3 · kimi 3/3 | Scope discipline is gated objectively — the scenario asserts the out-of-scope line stays out of the diff — so what wobbles is only the *reporting* half. Under force delivery it fails on DeepSeek alone; both other models report the find at majority, which says the skill text is adequate and the gap is the model's. |
| `build` B1, `plan` A5/B1, `architect` B1/D1 | single cells at 0/3–1/3 | Boundary behaviors on one model each, not broken disciplines. |
| `plan` A5 ⇄ D1 on DeepSeek | run-level | Between consecutive full runs A5 went 3/3 → 0/3 and D1 went 1/3 → 3/3, each unanimous within the later run. **Within-run flakiness of 0.00 is not stability** — read a single-run boundary cell with that in mind. |
| `review` on DS and GLM | green epoch | Text unchanged, so the cells stand, but a force re-measure would also unbank the two red baselines above. |
| `decide` C1 / A5 | DS C1 1/3 · GLM A5 1/3 · kimi C1 0/3 | Both are boundary scenarios, and which one a model fails is not stable across models — DeepSeek and kimi-k3 both fail C1, GLM fails A5 instead. |

## Measurement lessons

Nine improvement rounds and three judge audits produced these. They are recorded because
each one cost a wrong published number to learn.

- **Read the margin, not the majority.** A rep judged 4-0 is settled. A rep sitting near
  even after five judgments will still be near even after nine, because the checklist does
  not decide that transcript. Publish the lopsided ones; mark the rest unresolved.
- **A near-even split is a scenario defect, not a verdict.** Do not average it into a
  percentage — rewrite the scenario so the question has an answer.
- **An ambiguous checklist is worse than a noisy one.** It can hide a real, repeatable
  failure behind a coin-flip majority, and more judgments will not surface it — every one
  of them is answering the wrong question.
- **Scenario bugs present as model failures.** Five confirmed instances. Verify a scenario
  *can* be passed in its own environment before believing what it says about a model.
- **A needle must name what the edit writes**, not what the edit is about. A
  `diff_contains` naming the enclosing function, or a filename, matches no changed line.
- **Weak models obey the material in front of them over the skill text.** Fixture
  affordances, runner signals and real remotes landed fixes 3/3; prose arguing against
  in-context evidence lost every time. The same law applies to templates: models follow the
  template's placeholder over the paragraph above it.
- **Every arming needs its governor in the same breath.** Twice, a rule was strengthened
  without its limit and produced a new failure — over-refusal, or coaching around an
  absolute. Regression controls on the *opposite* behavior are how that stays caught.
- **Pin the grader when measuring the grader.**

## The record

- [`RESULTS-MANIFEST.md`](RESULTS-MANIFEST.md) — every committed run mapped to its round,
  grade and status (current / superseded / probe / red baseline / invalid), plus the
  incident notes: the pi-0.83 delivery failure and the force-epoch decision.
- [`../evidence/`](../evidence/) — per-judgment and per-rep records:
  [judge variance](../evidence/judge-variance-2026-08-04.md) (the method study separating
  judge noise from model variance),
  [rubric re-grades](../evidence/rubric-2-regrade.md),
  [the S6 rubric rewrite](../evidence/s6-rubric-regrade-2026-08-05.md),
  [the C2 needle defect](../evidence/c2-needle-2026-08-05.md).
- `<skill>/tests/specification.yaml` — the scenarios themselves.
- `<skill>/tests/results/…/results.yaml` — committed run output, per skill × model × run.
- [`../demos/`](../demos/) — the skills executing end to end, repo-verified.
- CI (`.github/workflows/ci.yml`) runs the free guards on every PR: spec and results lint
  (blocking), staleness (a warning on a branch, blocking on `main`, where the scorecard is
  a published claim), and an agents-lockstep check that fails a PR changing
  `plan|review|debug/SKILL.md` without its `agents/` twin.

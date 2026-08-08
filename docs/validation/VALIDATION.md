# Validation

How the seven skills are measured, what they currently score, what they add over a naked
model, and what is still open. Every number here is a committed measurement — the run that
produced it is in [`RESULTS-MANIFEST.md`](RESULTS-MANIFEST.md), and the per-judgment
records are in [`../evidence/`](../evidence/).

## What is measured

Each skill carries a `tests/specification.yaml`: scenarios with a prompt, a pass checklist,
and a ship bar. Scenarios marked *critical* must pass for the skill to ship. **92 scenarios
across the seven skills** — `git-ops` 19, `review` 18, `architect` 14, `decide` 12,
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
`build` A1 from 0/3 to 3/3 on DeepSeek and 1/3 to 3/3 on GLM, and dropped `plan` C2 on GLM
from 3/3 to 0/3 — a right-sizing hatch losing to a system-prompt-weighted process. **Do not
compute a delta across the epoch boundary.**

Cells below are force-epoch unless marked †. † measured under pi ≤ 0.80.x's wrapped-prompt
delivery; that skill's text has not changed since, so the cell stands. Only `decide` still
carries that mark. Its kimi-k3 cell comes from the third-model probe — a full run of the same
board, three reps, same judge, recorded as a probe because the scorecard was two-model when
it ran. Publishing it as a third column is a change of scope, not of method.

‡ `review` S6 on DeepSeek was published as a failure under a checklist that could not decide
its own transcripts — five replies of one shape drew three PASS and two FAIL, and one of those
failures rested on a fabricated Python precedence bug. A rewritten, decidable rubric re-grades
it as a pass with all 18 judgments agreeing. The committed `results.yaml` still records the
original 17/18, because `grade` preserves a run's recorded hashes and rewriting them would mark
the run stale; the correction is carried in
[`../evidence/s6-rubric-regrade-2026-08-05.md`](../evidence/s6-rubric-regrade-2026-08-05.md)
until `review` is next re-run — which is now pending anyway, since its contract changed.

## Current scorecard

| Skill | DeepSeek v4-pro | GLM 5.2 | kimi-k3 | failing (rate) |
|---|---|---|---|---|
| architect | 13/14 · 93% | 13/14 · 93% | **14/14 · 100% SHIP** | B1 1/3 (DS) · D1 1/3 (GLM) · — |
| build ◈ | — | — | — | re-measurement pending |
| debug ◈ | — | — | — | re-measurement pending |
| decide † | 11/12 · 92% | 11/12 · 92% | 11/12 · 92% | C1 1/3 · A5 1/3 · C1 0/3 |
| git-ops ◇ | **19/19 · 100% SHIP** | — | — | — · not measured · not measured |
| plan ◈ | — | — | — | re-measurement pending |
| review ◈ | — | — | — | re-measurement pending |

◈ **`plan`, `review`, `debug` and `build` are mid-change and publish nothing right now.**
The workspace-ownership work gave them filesystem rules they did not have — debug and review
experiment in a disposable worktree instead of the caller's checkout, build is named as the
only durable writer, and "parallel-safe" no longer implies writers sharing a working tree.
That is measured text. Every cell those four skills used to show describes a prompt that no
longer exists, so the cells are blank rather than reassuring: a number attached to text with
a different hash is the one thing this document exists to prevent.

They are not blank indefinitely. Each pending cell is listed in
[`unpublished-cells.txt`](unpublished-cells.txt), which CI reads — and an entry there that
matches no staleness finding *fails the build*. So the list is a to-do that cannot rot: once
a fresh run makes a cell current, the exemption stops matching and must be deleted. The
remeasurement is deliberately deferred until the contract work is finished, because
re-running the matrix after every sentence is how a measurement budget gets spent on
sentences.

◇ **`git-ops` is measured on DeepSeek only.** Its safety rules were rewritten in the v2.2.1
patch — conditional upstream preflight, a named credential-incident exception to the
protected-branch rewrite rule, redacted secret reporting, publication-aware wrong-branch
recovery — and the board grew from 15 scenarios to 19. The three 15/15 · 100% SHIP cells that
stood here measured the *previous* text and are **historical**, kept in
[`RESULTS-MANIFEST.md`](RESULTS-MANIFEST.md) as the record of that text rather than a claim
about what ships today. The new board was re-run on DeepSeek at three reps and scores
**19/19 with flakiness 0.00 on all 57 rep-executions and no misfires** — the cleanest run of
any skill on this board. GLM and kimi-k3 are deliberately blank: one model verifies a patch,
it does not make a scorecard, and both are queued for the release remeasurement.

**There is no meaningful total right now, so none is given.** Three of seven skills carry
current cells (`architect`, `decide`, `git-ops`, the last on one model), and the other four
are mid-change. Summing what remains would produce a number whose movement tracked which
skills happened to be measured rather than how good any of them are. The totals return with
the remeasurement.

What still reads off the table:

- **`architect` ships on kimi-k3** and sits one boundary scenario short on both tuned models.
  **`decide` ships on none** — it holds at 92% everywhere, failing exactly one boundary
  scenario per model, and which one is not stable across models. **`git-ops` ships on
  DeepSeek** at 19/19 after the safety patch.
- **The untuned model still does best where it is measured.** kimi-k3 is the only model with a
  perfect `architect` board. Whatever the framework is fitted to, it is not the two models it
  was tuned against.
- **A perfect board is not proof the text was always right.** `git-ops`'s 19/19 took four
  measurement rounds, and three of the defects it found were regressions introduced while
  fixing the previous one. The run records are in the manifest for exactly that reason.
- **A blank cell is not a bad cell.** These four skills were last measured at 78–100%. The
  blanks say the text moved, not that it got worse — and the honest response to "we changed
  the prompt" is to stop quoting the old number, not to assume it survived.

## What the skills add

The scorecard says how good a skill is on a model. It does not say what the skill *adds*.
So the same scenarios ran again with **no skill at all** — `--mode red`, 477 rep-executions,
three reps, like-for-like with the scored cells. Red baselines are unscored controls; the
delta is the point.

**These deltas measure the text as it stood before the workspace-ownership change.** For
`plan`, `build` and `review` the "skilled" side is the superseded prompt, so read the table
as the lift that text produced, not as a current claim. The red baselines are unaffected —
a naked model has no skill text to go stale — so they stand and the lift recomputes for free
once the four skills are re-measured. The findings below are about the *shape* of lift, which
is what survives a prompt edit; the exact numbers are not.

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
surprise waiting to happen. Rows naming `plan`, `build`, `review` or `debug` describe the
pre-workspace-ownership text and are carried forward as things to re-check, not as current
state.

| Item | Where | State |
|---|---|---|
| `build` A2 — reporting an out-of-scope find | DS 1/3 · GLM 2/3 · kimi 3/3 | Scope discipline is gated objectively — the scenario asserts the out-of-scope line stays out of the diff — so what wobbles is only the *reporting* half. Under force delivery it fails on DeepSeek alone; both other models report the find at majority, which says the skill text is adequate and the gap is the model's. |
| `build` B1, `plan` A5/B1, `architect` B1/D1 | single cells at 0/3–1/3 | Boundary behaviors on one model each, not broken disciplines. |
| `plan` A5 ⇄ D1 on DeepSeek | run-level | Between consecutive full runs A5 went 3/3 → 0/3 and D1 went 1/3 → 3/3, each unanimous within the later run. **Within-run flakiness of 0.00 is not stability** — read a single-run boundary cell with that in mind. |
| `review` on DS and GLM | green epoch | Text unchanged, so the cells stand, but a force re-measure would also unbank the two red baselines above. |
| `decide` C1 / A5 | DS C1 1/3 · GLM A5 1/3 · kimi C1 0/3 | Both are boundary scenarios, and which one a model fails is not stable across models — DeepSeek and kimi-k3 both fail C1, GLM fails A5 instead. |
| `git-ops` on GLM and kimi-k3 | not measured | The v2.2.1 safety patch is verified on DeepSeek only (19/19, flakiness 0.00). The other two columns are blank rather than carried over: the 15/15 cells that stood there measured text that no longer exists. Queued for the release remeasurement, which re-runs the 19-scenario board on all three. |

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
- `npm test` is the zero-model gate and passes from a fresh checkout: generated-contract
  drift (`npm run generate:check`), unit tests, word budgets checked against the README
  table, then spec and results lint under this repo's severity policy. CI runs that same
  command rather than reimplementing it, so a green local tree and a green CI tree cannot
  disagree.
- **`plan`, `review` and `debug` are generated** from `contracts/<skill>.md.tmpl`, which
  holds the 74–84% those contracts share in one place. This matters for measurement, not
  just tidiness: a rule edited in the skill but not its agent twin used to mean the
  D-scenarios measured a contract no subagent had been handed. The drift check makes that
  unmergeable. The generated files carry no "generated" banner on purpose — every byte of
  them is measured text, and a banner would stale nine published cells to say something
  `generate:check` already enforces.
- **Staleness blocks a pull request**, not merely `main` — but only for cells the scorecard
  actually publishes. A cell publishing no number has no claim to protect; those are declared
  in [`unpublished-cells.txt`](unpublished-cells.txt) and report as notices. That file is
  itself gated: an entry matching no finding fails the build, so an exemption is deleted when
  its reason expires instead of quietly covering a cell someone later publishes. Today it
  holds exactly `git-ops × {glm-5p2, kimi-k3}`, retired by the release remeasurement.
- The agents-lockstep CI rule is retired, superseded by the drift check above. It asked
  whether both files had changed, which is answerable "yes" while they disagree — and once
  the contracts became generated it would also have failed correct skill-only edits, the
  kind of false positive that gets routed around with an exempt label until nobody reads the
  gate. Third-party actions are pinned to immutable commit SHAs; the
  harness deliberately is not, because tracking its moving `latest` tag is what guarantees CI
  is at least as new as whatever wrote the committed `results.yaml`.

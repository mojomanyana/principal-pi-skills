# Validation

How the seven skills are measured, what the last measured release scored, what they add over
a naked model, and what is still open. Every number here is a committed measurement — the run
that produced it is in [`RESULTS-MANIFEST.md`](RESULTS-MANIFEST.md), and per-judgment records
are in [`../evidence/`](../evidence/).

## v3 measurement status

The v3 assurance implementation changes model-visible text in all seven skills, adds one `E1`
scenario per skill, and adds a Git-Ops `E2` stale-receipt negative. The specifications now contain
**106 scenarios**: `review` 22, `git-ops` 21, `architect` 15, `decide` 13, `plan` 13, `debug` 12,
`build` 10. These eight new scenarios were prepared and free lint is in scope, but **no paid
skill-harness or live E2E run was authorized**.
Therefore v3 currently publishes no model score. The board below is explicitly the historical
v2.4 baseline; it must not be attached to the v3 prompt digests.

`3.0.0` was released, tagged and published on 2026-08-20 with that gap open and stated, not
closed: the free gate (generated-contract parity, state-machine/schema transitions, install and
packed-artifact behavior, worktree isolation, word budgets, skill-harness lint) is green, and
every v2.4 cell is exempt-stale against the v3 text rather than re-measured. Anyone who needs a
measured number for the v3 prompts must run the wave below; until then the honest statement about
v3 is *specified and statically verified*, not *measured*.

A future measured wave is:

```bash
npx -y skill-harness@latest run all --skills "$PWD" --mode force \
  --model fireworks:accounts/fireworks/models/deepseek-v4-pro
npx -y skill-harness@latest run all --skills "$PWD" --mode force \
  --model fireworks:accounts/fireworks/models/glm-5p2
```

As always, grep the saved results for `judge_verdict: ERROR` before reading a score. A run is
not part of this implementation unless separately authorized.

## What is specified

Each skill carries a `tests/specification.yaml`: scenarios with a prompt, a pass checklist,
and a ship bar. Scenarios marked *critical* must pass for the skill to ship. The v2.4
contract-cleanup round had 98; v3's seven E1 scenarios plus the Git-Ops negative pin the assurance deltas while the
existing right-sizing scenarios remain counterexamples against architecture theater.

Three kinds of scenario:

- **Conversational** — the model answers; a judge grades the reply against the checklist.
- **Seeded** — the scenario materializes a real git repo or a vitest project
  (`<skill>/tests/fixtures/<ID>/`), the model works in it, and the *staged diff* is graded.
  Objective gates (vitest green, `diff_contains`, `diff_excludes`, `post_test`) are decided
  before the judge is consulted, so those criteria cost no judgment at all.
- **Delegated (D-scenarios)** — `agents/principal-{plan,review,debug}.md` injected as a system prompt
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
- Judge: `claude-code:opus`. **Check for `ERROR` before reading any number.** The judge's
  session limit corrupted two cells during this round — `debug`/GLM read F (55%) and
  `review`/GLM read 8/21, and both were the limit rather than the skill: re-judging the saved
  transcripts returned A (91%) and 19/21. An errored rep is not a failed rep, and a board run
  long enough to cross a reset window will hit this. `grade <run-dir>` fixes it for free.
- Subject models: **DeepSeek v4-pro** and **GLM 5.2** — the two the skills were tuned
  against and the two the scorecard publishes. **kimi-k3** is the untuned control for
  overfitting; it is an optional follow-up in the current round rather than a published
  column, so its cells stay blank until it is run. That is a deliberate deferral, not an
  omission: kimi has historically scored *highest* here, which makes it the column least
  likely to surface a defect and the least urgent to refresh.

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

The remeasurement runs entirely in the force epoch, so the epoch boundary stops being
something a reader has to track cell by cell — the first uniformly-measured board this
project has had.

`review` S6 on DeepSeek was published as a failure under a checklist that could not decide
its own transcripts — five replies of one shape drew three PASS and two FAIL, and one of those
failures rested on a fabricated Python precedence bug. A rewritten, decidable rubric re-grades
it as a pass with all 18 judgments agreeing. The committed `results.yaml` still records the
original 17/18, because `grade` preserves a run's recorded hashes and rewriting them would mark
the run stale; the correction is carried in
[`../evidence/s6-rubric-regrade-2026-08-05.md`](../evidence/s6-rubric-regrade-2026-08-05.md)
until `review` is next re-run — which is the pending remeasurement, under a contract that
has since changed again.

## Historical v2.4 scorecard (not a v3 claim)

| Skill | DeepSeek v4-pro | GLM 5.2 | kimi-k3 |
|---|---|---|---|
| architect | 13/14 · 93% | **14/14 · 100% SHIP** | — *(deferred)* |
| build | **9/9 · 100% SHIP** | **9/9 · 100% SHIP** | — *(deferred)* |
| debug | 9/11 · 82% | **11/11 · 100% SHIP** | — *(deferred)* |
| decide | **12/12 · 100% SHIP** | **12/12 · 100% SHIP** | — *(deferred)* |
| git-ops | 18/19 · 95% | **19/19 · 100% SHIP** | — *(deferred)* |
| plan | 8/12 · 67% | **12/12 · 100% SHIP** | — *(deferred)* |
| review | **21/21 · 100% SHIP** | **21/21 · 100% SHIP** | — *(deferred)* |

**98 scenarios × 3 reps × 2 models — the first board measured entirely in one epoch**, under
`--mode force`, with reps pinned in the spec rather than passed on the command line. Every
cell above measured the v2.4 contract text; none measures v3.

All seven v2.4 skills shipped on at least one model. `decide` and `build` were new to that list;
`debug` and `review` return to it after the fixture repair recorded below:

- **`decide` 12/12 on both.** It shipped on *nothing* before — it held at 92% everywhere,
  failing exactly one boundary scenario per model. Narrowing its scope to engineering
  decisions and making the brief a *conclusion* rather than an opening move closed it on both.
- **`build` 9/9 on both**, up from 7/9 on DeepSeek.
- **`plan` 12/12 on GLM against 8/12 on DeepSeek.** A four-scenario spread on identical text
  is the widest on this board, and it is worth reading carefully: `plan` is not weak, it is
  weak *on one model*. Its boundary cells (A2, A3, A5, A7) also move between runs — A2
  measured 3/3 in a targeted run and FAIL in a full run on the same text, hours apart. Treat
  any single `plan`/DeepSeek cell as one draw.

**`debug` and `review` were re-measured after the fixture repair (`release-3c`).** An
independent review found `debug`'s D1 and A5 fixtures shipping already-fixed code — D1's
`reduce` had gained an initial value and an empty-cart test, A5's parser the guard its
scenario asks the model to add — so a critical scenario could not reproduce the failure it
grades and another could not fail. Both are restored and both skills re-run:

- **`debug` 9/11 on DeepSeek, 11/11 · SHIP on GLM.** D1 now passes on both: with the bug
  back, the agent reproduces and diagnoses it. What fails on DeepSeek is B1 and D2 — the
  skill, not a broken fixture.
- **`review` 21/21 · SHIP on both**, up from 20/21 and 19/21. The only contract change was
  the `npx -p` invocation fix, which cannot plausibly move S4 or S9's judgments, so read this
  as boundary cells landing favourably rather than as the fix causing it.

`debug`/GLM first recorded **D (64%) with "2 critical fails"** — three scenarios had ERRORed
on the judge's session limit. Re-judging the saved transcripts returned 11/11 · SHIP. That is
the third phantom collapse this hazard has produced in this project.

### What is still failing, and why it is published rather than fixed

| Cell | Rate | Why it stands |
|---|---|---|
| `review` S9 (GLM) | 2/3 (boundary) | The observable-fallback governor. A Checks row took DeepSeek 0/3 → 3/3 and left GLM at 0/3; in `release-3c` GLM came back **PASS at 2/3, flaky 0.67**, so it is a boundary cell rather than a failing one. Still listed because a single draw of it is not a measurement. A third arming risks the neighbouring cells, which is how this project has hurt itself before. |
| `plan` A7 | 0–1/3 | The contract says "decompose **and say why**"; the model decomposes silently. The *behavior* half passes. The rubric grades narration, and it is not critical. |
| `plan` A2/A3/A5 (DS) | boundary | Two different levers — a template placeholder and a Checks row — moved neither consistently. Published at rate. |
| `debug` D1, `architect` D1 (DS) | 1/3 | Single boundary cells on one model each. |
| `git-ops` A7 (DS) | 2/3 | PR-title craft; the safety-critical scenarios are all 3/3. |

**kimi-k3 is deferred, not dropped.** It is the untuned overfitting control, so until it runs
there is no evidence about generalization beyond the two models the skills were tuned on —
and those are exactly the two most likely to flatter the framework. Its rows stay in
[`unpublished-cells.txt`](unpublished-cells.txt), where CI fails on a dead entry, so it cannot
be quietly forgotten.

## What the skills add

The scorecard says how good a skill is on a model. It does not say what the skill *adds*.
So the same scenarios ran again with **no skill at all** — `--mode red`, 477 rep-executions,
three reps, like-for-like with the scored cells. Red baselines are unscored controls; the
delta is the point.

**These deltas are historical: the "skilled" side is the pre-cleanup prompt for every skill.**
Read the table as the lift that text produced, not as a current claim. The red baselines are
unaffected — a naked model has no skill text to go stale — so a current lift is one `--mode
red` comparison away rather than a re-measurement, but nobody has computed it against the
published board yet. The findings below are about the *shape* of lift, which survives a prompt
edit; the numbers are not.

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

Superseded by the failing-cells table above, which lists what the *published* board shows.
The rows below describe the pre-cleanup text and are kept as the record of what those rounds
found — several were closed by the contract cleanup (`decide` C1/A5 both ship now; `build` A2
passes on both models). Do not read them as current.

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

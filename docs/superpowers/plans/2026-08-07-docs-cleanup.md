# Docs Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repository's documentation read as a public, production-ready skill set — user- and agent-facing docs describe the skills; tests of the skills live in one referenced section; iteration history leaves the living docs for git history.

**Architecture:** Five sequential tasks. Task 1 does the mechanical layer (moves, deletes, link repairs) and installs the verification tool the later tasks reuse. Task 2 creates the new validation entry point. Task 3 rewrites the README against it. Task 4 retcons the CHANGELOG. Task 5 runs the whole-repo acceptance sweep and opens the PR. Order matters: the README links to `VALIDATION.md`, so that file must exist first.

**Tech Stack:** Markdown, git, bash. No build step, no dependencies. CI (`.github/workflows/ci.yml`) runs `skill-harness lint all` and an agents-lockstep check — neither reads any file this plan touches, so CI must stay green throughout.

## Global Constraints

- **Never modify** any `<skill>/SKILL.md`, any `<skill>/tests/**`, any `agents/*.md`, any `prompts/*.md`, `AGENTS.md`, `docs/demos/*`, `.github/workflows/ci.yml`, or `LICENSE`. The only non-documentation file touched in the entire plan is `package.json`, version field only.
- **Frozen evidence paths:** `docs/evidence/c2-needle-2026-08-05.md`, `docs/evidence/rubric-2-regrade.md`, `docs/evidence/s6-rubric-regrade-2026-08-05.md`, and `docs/evidence/judge-variance-2026-08-04/` do not move. `build/tests/specification.yaml:152` cites the c2-needle path from a comment; keeping it frozen is what makes this cleanup a zero-edit change inside skill trees.
- **Copy numbers, never invent them.** Every scorecard figure in this plan was transcribed from the current `README.md` tables and cross-checked against **current** / red-baseline rows in `RESULTS-MANIFEST.md`. Nothing is re-measured. If a number in this plan disagrees with the repo, stop and surface it rather than picking one.
- **Present tense, current state.** Living docs state what is true now. The story of how a number moved belongs to git history and `docs/evidence/`.
- Work happens on the existing `docs-cleanup` branch (already created, holds the approved spec at commit `6c2da20`).
- Spec of record: `docs/superpowers/specs/2026-08-07-docs-cleanup-design.md`.

---

## File Structure

| Path | Responsibility after this plan | Task |
|---|---|---|
| `README.md` | The skills: what they are, how to install, what they cost, one short validation section. ~170 lines. | 3 |
| `AGENTS.md` | Routing + dispatch for the orchestrator. **Unchanged.** | — |
| `CHANGELOG.md` | Release history at v2 granularity. | 4 |
| `package.json` | Package metadata; `version` → `2.2.0`. | 4 |
| `docs/validation/VALIDATION.md` | **New.** Single entry point for how the skills are measured: method, epochs, full scorecard, lift, open items, lessons, links to the record. | 2 |
| `docs/validation/RESULTS-MANIFEST.md` | Moved from root. Run → round → status map. Table untouched; header pointers repaired. | 1 |
| `docs/evidence/judge-variance-2026-08-04.md` | Moved from `docs/`. Method study behind the § re-grade cells. One internal link repaired. | 1 |
| `docs/evidence/*` (the other four) | Frozen. Untouched. | — |
| `docs/demos/*` | Verified end-to-end run records. Untouched — editing quoted output would falsify them. | — |
| `REVIEW-FINDINGS.md` | **Deleted** — every finding carries a fix SHA. | 1 |
| `docs/revalidation-2026-08-05.md` | **Deleted** — dated working notes; framing salvaged into README. | 1 |

---

### Task 1: Mechanical layer — moves, deletes, link repairs

Moves two files, deletes two, repairs every link the moves affect, and installs the link
checker the rest of the plan uses as its test. The repair is genuinely test-driven: the
repo has exactly one broken relative link today, and moving `judge-variance` is what fixes
it.

**Files:**
- Create: `/tmp/check-links.sh` (throwaway tool, **not committed**)
- Move: `RESULTS-MANIFEST.md` → `docs/validation/RESULTS-MANIFEST.md`
- Move: `docs/judge-variance-2026-08-04.md` → `docs/evidence/judge-variance-2026-08-04.md`
- Modify: `docs/validation/RESULTS-MANIFEST.md` (header lines 3–6, and line 271's link)
- Modify: `docs/evidence/judge-variance-2026-08-04.md` (line 70's link)
- Delete: `REVIEW-FINDINGS.md`
- Delete: `docs/revalidation-2026-08-05.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `/tmp/check-links.sh`, invoked as `bash /tmp/check-links.sh [file...]` — exits 0 when every relative markdown link resolves, non-zero otherwise, printing `BROKEN  <file> -> <target>` per failure. Tasks 2–5 use it as their gate. Also produces the paths `docs/validation/RESULTS-MANIFEST.md` and `docs/validation/` (the directory README and VALIDATION.md later link to).

- [ ] **Step 1: Write the link checker**

Save exactly this to `/tmp/check-links.sh`. It is a throwaway dev tool — do **not** commit
it to the repo.

```bash
#!/usr/bin/env bash
# check-links.sh — every relative markdown link must resolve.
# Usage: check-links.sh [file.md ...]   (default: all tracked *.md)
set -uo pipefail
files=("$@")
# docs/superpowers/ holds specs and plans that quote markdown link syntax as content,
# so its "links" are prose, not navigation. Excluded from the default sweep.
if [ ${#files[@]} -eq 0 ]; then
  mapfile -t files < <(git ls-files '*.md' | grep -v '^docs/superpowers/')
fi
broken=0
for f in "${files[@]}"; do
  [ -f "$f" ] || continue
  dir=$(dirname "$f")
  while IFS= read -r target; do
    case "$target" in http*|'#'*|mailto:*) continue ;; esac
    path="${target%%#*}"
    [ -z "$path" ] && continue
    if [ ! -e "$dir/$path" ]; then
      echo "BROKEN  $f -> $target"
      broken=$((broken + 1))
    fi
  done < <(grep -oE '\]\([^) ]+\)' "$f" | sed -E 's/^\]\(//; s/\)$//')
done
echo "--- $broken broken link(s) in ${#files[@]} file(s)"
[ "$broken" -eq 0 ]
```

- [ ] **Step 2: Run it to see the failure it will fix**

Run: `bash /tmp/check-links.sh`

Expected: exit 1, with exactly one line —
`BROKEN  docs/evidence/rubric-2-regrade.md -> judge-variance-2026-08-04.md`

That link is broken today because `rubric-2-regrade.md` sits in `docs/evidence/` and points
at a sibling that currently lives one directory up. If you see any *other* broken link,
stop — the tree is not in the state this plan was written against.

- [ ] **Step 3: Move the two files**

```bash
mkdir -p docs/validation
git mv RESULTS-MANIFEST.md docs/validation/RESULTS-MANIFEST.md
git mv docs/judge-variance-2026-08-04.md docs/evidence/judge-variance-2026-08-04.md
```

- [ ] **Step 4: Repair the moved files' own links**

In `docs/evidence/judge-variance-2026-08-04.md`, line 70 — the artifact directory is now a
sibling, so drop the `evidence/` prefix:

Replace:
```
[`evidence/judge-variance-2026-08-04/`](evidence/judge-variance-2026-08-04/) so the claim can be
```
with:
```
[`judge-variance-2026-08-04/`](judge-variance-2026-08-04/) so the claim can be
```

In `docs/validation/RESULTS-MANIFEST.md`, line 271 — evidence is now one directory up:

Replace:
```
[`docs/evidence/c2-needle-2026-08-05.md`](docs/evidence/c2-needle-2026-08-05.md).
```
with:
```
[`../evidence/c2-needle-2026-08-05.md`](../evidence/c2-needle-2026-08-05.md).
```

- [ ] **Step 5: Repoint the manifest header at VALIDATION.md**

`docs/validation/RESULTS-MANIFEST.md` lines 3–6 currently name the README as the place the
scorecard lives. Replace this block:

```
Maps every committed `results.yaml` to its validation round and status. Policy:
superseded runs are KEPT — they are the evidence for the round-over-round trajectory
in README's Validation results (DeepSeek 61% → 82% → 89% → ~92%; GLM 92% → 97% → ~99%).
README's scorecard = the **current** (latest) run per skill × model — 14 runs.
```

with:

```
Maps every committed `results.yaml` to its validation round and status. Policy:
superseded runs are KEPT — they are the evidence for the round-over-round trajectory
(DeepSeek 61% → 82% → 89% → ~92%; GLM 92% → 97% → ~99%) that no single current run shows.
The scorecard in [`VALIDATION.md`](VALIDATION.md) = the **current** row per skill × model
× epoch; every other row here is the history behind it.
```

Note the deliberate correction: the old line claimed "14 runs", which stopped being true
when a third model and a second epoch were added. The replacement states the rule instead
of a count, so it cannot go stale again. `VALIDATION.md` does not exist until Task 2 —
that is expected, and Step 7 scopes around it.

- [ ] **Step 6: Delete the two superseded documents**

```bash
git rm REVIEW-FINDINGS.md docs/revalidation-2026-08-05.md
```

Both are safe to delete: every numbered finding in `REVIEW-FINDINGS.md` carries a fix SHA,
and its three "deferred" spec-debt items all landed (verify if you want:
`grep -c 'id: A6' build/tests/specification.yaml` → 1, and
`grep -E 'id: A1[12]' git-ops/tests/specification.yaml` → two hits). `revalidation-2026-08-05.md`
is a dated working note whose north-star framing Task 3 salvages into the README, whose
model-tail decisions Task 2 carries into Open items, and whose pi-0.83 correction is
already recorded in the manifest.

- [ ] **Step 7: Verify the moved and kept files resolve**

Run:
```bash
bash /tmp/check-links.sh $(git ls-files '*.md' | grep -v '^docs/superpowers/' | grep -v '^README.md')
```

Expected: `--- 0 broken link(s)`, exit 0. The pre-existing `rubric-2-regrade.md` failure is
gone — the move fixed it.

`README.md` is excluded from this gate on purpose: it still points at
`RESULTS-MANIFEST.md`, `docs/judge-variance-2026-08-04.md`, and the deleted files at their
old paths. Task 3 rewrites it, and Task 5 gates the whole repo with nothing excluded.

- [ ] **Step 8: Confirm no skill tree was touched**

Run: `git diff --stat main -- '*/SKILL.md' 'agents/' 'prompts/' '*/tests/' AGENTS.md docs/demos/ .github/ LICENSE`

Expected: empty output. Any output at all is a constraint violation — revert it.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "docs: move the test record into docs/validation, drop the superseded working notes

RESULTS-MANIFEST.md moves beside the validation entry point it serves, and
judge-variance joins the evidence it is the method for — which repairs the
dangling link rubric-2-regrade.md has been carrying. REVIEW-FINDINGS.md (every
item fixed, SHAs recorded) and revalidation-2026-08-05.md (dated working notes)
are deleted; git history keeps them."
```

---

### Task 2: `docs/validation/VALIDATION.md` — the tests entry point

One document answering "how good are these skills, measured how, and what is still
broken?" — so no other document has to.

**Files:**
- Create: `docs/validation/VALIDATION.md`

**Interfaces:**
- Consumes: `docs/validation/RESULTS-MANIFEST.md` and `docs/evidence/` at the paths Task 1 established.
- Produces: `docs/validation/VALIDATION.md` — the link target README's validation section closes with in Task 3, referenced as `docs/validation/VALIDATION.md` from the repo root.

- [ ] **Step 1: Write the file**

Create `docs/validation/VALIDATION.md` with exactly this content:

````markdown
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
`build` A1 from 0/3 to 3/3 on both tuned models, and dropped `plan` C2 on GLM from 3/3 to
0/3 — a right-sizing hatch losing to a system-prompt-weighted process. **Do not compute a
delta across the epoch boundary.**

Cells below are force-epoch unless marked †. A † cell was measured in the green epoch and
still stands because that skill's text has not changed since; when its text changes, it is
re-measured.

## Current scorecard

| Skill | DeepSeek v4-pro | GLM 5.2 | kimi-k3 | failing (rate) |
|---|---|---|---|---|
| architect | 13/14 · 93% | 13/14 · 93% | **14/14 · 100% SHIP** | B1 1/3 (DS) · D1 1/3 (GLM) · — |
| build | 7/9 · 78% | **9/9 · 100% SHIP** | **9/9 · 100% SHIP** | A2 1/3, B1 1/3 (DS) · — · — |
| debug † | **8/8 · 100% SHIP** | **8/8 · 100% SHIP** | **8/8 · 100% SHIP** | — · — · — |
| decide † | 11/12 · 92% | 11/12 · 92% | 11/12 · 92% | C1 1/3 · A5 1/3 · C1 |
| git-ops † | **15/15 · 100% SHIP** | **15/15 · 100% SHIP** | **15/15 · 100% SHIP** | — · — · — |
| plan | 10/12 · 83% | 10/12 · 83% | **12/12 · 100% SHIP** | A5 0/3, B1 0/3 · A2 0/3, C2 1/3 · — |
| review | **18/18 · 100% SHIP** † | 17/18 · 94% † | **18/18 · 100% SHIP** | — · C1 · — |

Counting current cells as they stand — which mixes the two epochs, so read it as a summary
of the table and not as a measurement in its own right — that is **82/88 on DeepSeek,
83/88 on GLM, 87/88 on kimi-k3.**

Three things worth reading off it:

- **Six of seven skills ship on at least one model.** `decide` ships on none: it holds at
  92% everywhere, failing exactly one boundary scenario per model.
- **The untuned model does best.** kimi-k3 ships six of seven, against three each for the
  two models the skills were tuned on. Whatever the framework is fitted to, it is not those
  two models.
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
  Decision-record honesty (`architect` D-block): even the strongest naked model fails it.
  These are not improvements on native behavior — they are behavior that does not otherwise
  occur.

## Open items

Published as measured rates rather than averaged away. Each is a known limit, not a
surprise waiting to happen.

| Item | Where | State |
|---|---|---|
| `build` A2 — reporting an out-of-scope find | DS 0/3, GLM 0/3, kimi 2/3 | Scope discipline holds everywhere (the out-of-scope line is untouched in every diff); only the *reporting* half fails, and only on the tuned models. Accepted as a model limit — the skill text is adequate, since a third model does it unprompted. |
| `build` B1, `plan` A5/B1, `architect` B1/D1 | single cells at 0/3–1/3 | Boundary behaviors on one model each, not broken disciplines. |
| `plan` A5 ⇄ B1 on DeepSeek | run-level | These two swapped unanimous verdicts between consecutive full runs. **Within-run flakiness of 0.00 is not stability** — read a single-run boundary cell with that in mind. |
| `review` on DS and GLM | green epoch | Text unchanged, so the cells stand, but a force re-measure would also unbank the two red baselines above. |
| `decide` C1 / A5 | 1/3 each, inverting by model | Both boundary scenarios; the rates invert across models, which is the signature of a boundary rather than a hole. |

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
````

- [ ] **Step 2: Verify its links resolve**

Run: `bash /tmp/check-links.sh docs/validation/VALIDATION.md`

Expected: `--- 0 broken link(s) in 1 file(s)`, exit 0.

- [ ] **Step 3: Spot-check three numbers against the manifest**

This is the guard against transcription drift. Run:

```bash
grep -E 'kimi-k3.*release-2-force.*12/12|deepseek.*post-diff-remeasure-full.*8/8|glm.*release-2-gitops.*15/15' docs/validation/RESULTS-MANIFEST.md
```

Expected: three rows, confirming `plan`/kimi 12/12 SHIP, `debug`/DS 8/8 SHIP, and
`git-ops`/GLM 15/15 SHIP — the three cells above that come from three different rounds. If
any row is missing, the scorecard table has drifted from the record; stop and reconcile.

- [ ] **Step 4: Commit**

```bash
git add docs/validation/VALIDATION.md
git commit -m "docs(validation): one entry point for how the skills are measured

Method, the two delivery epochs and why their cells do not compare, the current
three-model scorecard, what the skills add over naked models, the open items at
their measured rates, and the lessons each wrong number bought. Everything the
README used to carry across 500 lines of round-by-round history, stated once in
the present tense."
```

---

### Task 3: Rewrite `README.md`

646 lines → ~170. The skills come first; validation is one section that ends in a link.

**Files:**
- Modify: `README.md` (full rewrite)

**Interfaces:**
- Consumes: `docs/validation/VALIDATION.md` (Task 2), `docs/validation/RESULTS-MANIFEST.md` (Task 1), `docs/demos/*` (existing).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Regenerate the word counts**

The published counts are stale — `architect` and `plan` both grew past them when the
release-2 fixes landed. Run:

```bash
for f in decide architect plan build review debug git-ops; do echo "$f: $(wc -w < $f/SKILL.md)"; done
for f in agents/*.md; do echo "$f: $(wc -w < $f)"; done
```

Expected at the time of writing: decide 671, architect 1097, plan 1072, build 800,
review 752, debug 933, git-ops 1320; agents/debug 1060, agents/plan 1315, agents/review 784.
**Use whatever the command actually prints** — these numbers appear in two places in Step 2
(the token-economics constraint and the set table), and they must match the tree.

- [ ] **Step 2: Replace the whole file**

Overwrite `README.md` with exactly this, substituting any word count that Step 1 printed
differently:

````markdown
# principal-pi-skills

**Seven skills for principal-level software engineering with the
[pi coding agent](https://github.com/badlogic/pi-mono) — four inline skills and three
that double as subagents.** Dialogue and session state run inline (`decide`,
`architect`, `build`, `git-ops`); heavy reading, cold judgment, and noisy loops delegate
to isolated contexts (`plan`, `review`, `debug` — hand-written single-shot variants in
`agents/`). The files follow the [Agent Skills](https://agentskills.io/specification)
standard, so other harnesses can consume the skills, but pi is the supported target.

The set is built for **one principal engineer steering at a high level while skills and
subagents do the work.** Two properties follow, and every design choice below serves them:
**delegable trust** — an output carries the evidence needed to verify it without redoing
the work — and **cheap iteration** — a defect found is a defect fixed, not documented
around.

## Three constraints

1. **Dual-use.** Each file works as a loaded skill *and* as a subagent system prompt with
   zero editing. That forces single-shot-safe behavior, an explicit delegated mode, and a
   literal output template.
2. **Model-agnostic.** Written for the weakest model that will run it (DeepSeek, GLM,
   Sonnet-class), not the strongest: imperative numbered steps, literal fill-in templates,
   plain-text tags (`[ONE-WAY]`, `[BLOCKER]`) instead of an emoji schema, no aphorisms
   doing load-bearing work, no personas, no required reading in reference files.
3. **Token economics.** Budgets stated as decisions rather than aspirations: **skills
   ≤ ~1100 words**, with **`git-ops` an accepted exception at ~1320** — the safety-critical
   operator carries the most arming, and validated behavior outweighs a budget. **Agents
   get their own budget, ≤ ~1350**: a single-shot definition carries its output template
   *and* the BLOCKED form *and* the no-questions mechanics, none of which a loaded skill
   needs. Every count in the table below is checkable with `wc -w`. Nothing loads anything
   else — a subagent reads one file and has the whole contract.

## The set

| Skill | What it does | How it runs | Words |
|---|---|---|---|
| `decide` | Options and stress-tests for a decision that isn't settled — "should I", "what are my options", "I'm stuck" | inline | 671 |
| `architect` | System design from measurable drivers; significant or irreversible technical choices. The decision record is a section of the output, not a separate artifact | inline | 1097 |
| `plan` | A task turned into ordered steps and per-step specs a builder can execute without making load-bearing decisions. Writes no code | subagent (`agents/plan.md`, 1315) or inline | 1072 |
| `build` | Test-first implementation — code proven by a test you watched fail | inline | 800 |
| `review` | One pass, two axes — correctness and simplicity — ending in one severity-ranked verdict | subagent (`agents/review.md`, 784) or inline | 752 |
| `debug` | Hypothesis before fix: a diagnosis loop ending in a note with root cause and a regression test | subagent (`agents/debug.md`, 1060) or inline | 933 |
| `git-ops` | Safe version-control operator — reads state before writing it, keeps published history immutable, scans for secrets before committing | inline, never delegated | 1320 |

Routing between them belongs to the orchestrator, not to a skill — there is deliberately no
routing skill spending context to say "pick a skill". [AGENTS.md](./AGENTS.md) is that
layer, and it is the one file an agent should read at session start.

## Layout

```
<skill>/SKILL.md                      the interactive contract — nothing else is required reading
agents/{plan,review,debug}.md         single-shot subagent variants (tools in frontmatter) — edited in lockstep with their SKILL.md
prompts/{feature,bugfix}.md           /feature and /bugfix workflow templates
<skill>/tests/specification.yaml      skill-harness scenarios (ship bar, critical gates)
<skill>/tests/fixtures/<ID>/          seeded repo for one scenario (git-ops, build, debug)
<skill>/tests/results/…/results.yaml  committed run evidence (Opus-judged)
AGENTS.md                             the routing + dispatch layer for the orchestrator
docs/validation/                      how the skills are measured — scorecard, run manifest
docs/demos/                           the chains running end to end, repo-verified
```

## Install (pi)

1. **Skills + prompts**: `pi install git:github.com/mojomanyana/principal-pi-skills` —
   the `pi` manifest registers the skills and the `/feature` and `/bugfix` templates.
2. **Subagents**: install pi-mono's subagent extension
   (`packages/coding-agent/examples/extensions/subagent` — symlink its `index.ts` and
   `agents.ts` into `~/.pi/agent/extensions/subagent/`), then link the agent
   definitions once:

   ```
   mkdir -p ~/.pi/agent/agents && ln -sf "$(pwd)"/agents/*.md ~/.pi/agent/agents/
   ```

   Tool restriction is structural, in the agents' frontmatter: `plan` is read-only;
   `review` adds `bash` only to run tests; `debug` gets the full toolset.

   These steps were last run end to end against **pi 0.80.2** and pi-mono
   [`008c76f`](https://github.com/badlogic/pi-mono/commit/008c76f955ae) — the newest commit
   touching that extension path, so the layout has been stable since 2026-06-18. Upstream is
   someone else's repo: if the file names move, check out that commit.
3. Without the extension everything still runs inline as skills. When and why to
   delegate is defined in [AGENTS.md](./AGENTS.md).

## Shared contract

Every output template ends with a `Next:` line naming the follow-on skill — that plus the
fixed template fields *is* the handoff. No baton vocabulary, no delegation-contract
reference file: the contract is visible in the template itself.

## See it run

Three end-to-end runs, verified against the repository afterwards rather than taken from
the model's own account:

- [**The `/feature` chain**](./docs/demos/feature-chain.md) — plan (isolated, read-only) →
  build (inline, TDD) → review (fresh context) → git-ops, adding a helper to a vitest repo.
- [**The `/bugfix` chain**](./docs/demos/bugfix-chain.md) — a planted bug diagnosed to the
  line and the culprit commit, with the review independently *reverting* the fix to confirm
  the regression test fails before and passes after.
- [**The steering digest**](./docs/demos/steering-digest-2026-08-06.md) — both spines
  closing with a six-line digest, each surfacing a planted out-of-scope bug that neither
  task had any reason to touch.

## Validation

Every skill carries a `tests/specification.yaml` of scenarios with pass criteria, and the
results are committed. The measurement: **88 scenarios across the seven skills, three
subject models, every scenario run three times**, judged by `claude-code:opus`, with
objective gates (vitest runs, diff assertions) decided before the judge is consulted. A
scenario passes at a majority of its clean reps, so every cell below is a pass-rate rather
than a single draw. The scored deployment is skill-as-system-prompt (`--mode force`), the
delivery modern pi makes deterministic and the way the `agents/` variants already run.
**kimi-k3 was never tuned against** — it is the control for overfitting.

| Skill | DeepSeek v4-pro | GLM 5.2 | kimi-k3 |
|---|---|---|---|
| architect | 13/14 · 93% | 13/14 · 93% | **14/14 · 100% SHIP** |
| build | 7/9 · 78% | **9/9 · 100% SHIP** | **9/9 · 100% SHIP** |
| debug † | **8/8 · 100% SHIP** | **8/8 · 100% SHIP** | **8/8 · 100% SHIP** |
| decide † | 11/12 · 92% | 11/12 · 92% | 11/12 · 92% |
| git-ops † | **15/15 · 100% SHIP** | **15/15 · 100% SHIP** | **15/15 · 100% SHIP** |
| plan | 10/12 · 83% | 10/12 · 83% | **12/12 · 100% SHIP** |
| review | **18/18 · 100% SHIP** † | 17/18 · 94% † | **18/18 · 100% SHIP** |

† measured under pi ≤ 0.80.x's wrapped-prompt delivery; that skill's text has not changed
since, so the cell stands. The two delivery modes are not comparable to each other —
[VALIDATION.md](docs/validation/VALIDATION.md) explains why and what the difference costs.

Six of seven skills ship on at least one model; `decide` ships on none, holding at 92%
everywhere with one boundary scenario failing per model. The untuned model does best —
kimi-k3 ships six of seven, against three each for the two models the skills were tuned on.

### What the skills add

The table above says how good a skill is on a model, not what the skill *adds*. So the same
scenarios ran again with **no skill at all** (477 rep-executions, same three reps, unscored
controls). The delta is the point:

| Skill | DeepSeek: naked → skilled | GLM: naked → skilled | kimi-k3: naked → skilled |
|---|---|---|---|
| plan | 3/12 → 10/12 **(+7)** | 6/12 → 10/12 **(+4)** | 4/12 → 12/12 **(+8)** |
| architect | 7/14 → 13/14 **(+6)** | 10/14 → 13/14 **(+3)** | 12/14 → 14/14 **(+2)** |
| build | 5/9 → 7/9 **(+2)** | 5/9 → 9/9 **(+4)** | 6/9 → 9/9 **(+3)** |
| **aggregate (35 scen.)** | **15 → 30 (+15)** | **21 → 32 (+11)** | **22 → 35 (+13)** |

Lift concentrates where the models are weakest — naked models are already decent reviewers
and poor planners, and `plan`, the skill carrying the most structure, is worth +7 to +8
scenarios on two of three models. Some disciplines exist *only* under the skill, on every
model: characterization tests before refactoring go 0/3 naked to 3/3 skilled on all three,
and decision-record honesty fails even the strongest naked model. Those are not
improvements on native behavior; they are behavior that does not otherwise occur.

**Full method, the epoch boundary, every open item at its measured rate, and the
run-by-run record:** [`docs/validation/VALIDATION.md`](docs/validation/VALIDATION.md).

## Deliberate design rules

Why the files look the way they do. Each of these was learned by measuring the alternative.

- **Description = triggers only.** Never a workflow summary — a description that summarizes
  the process trains the model to follow the description and skip the body.
- **Recipes, not prohibition tables.** Output-shape problems get a literal template to fill.
  Prohibitions are reserved for genuine discipline failures (skipping tests under pressure,
  force-push, secret handling), where a short Checks table remains.
- **One governor sentence** instead of a governor table per skill. If a skill needs a table
  of reasons not to use itself, it is over-scoped.
- **Assumptions instead of questions** in delegated mode. A subagent cannot ask, so every
  skill says what to do when information is missing: state the assumption, or return
  `BLOCKED` with the one question that matters.
- **Pressure armor is explicit.** Discipline rules carry "repetition doesn't change the
  answer — any turn, including the last", because models otherwise cave on the third push.
- **Right-sizing is a hard conditional**, not a suggestion: "2–5 sentences, no machinery",
  and when a user asks for the artifact on a trivial change, the minimal form *is* the
  deliverable — otherwise the model declares the artifact unwarranted and produces it anyway.
- **Grounded skills carry a no-repo branch.** `plan` and `git-ops` act on the material given
  instead of stalling on "point me at the repo".
- **Weak models need code anchors.** `debug`'s error-swallowing rule survived two rounds of
  prose and died to one literal `catch` example. Escape hatches work best *inside* the
  template they exempt.

---

## License

MIT © 2026 Nemanja Alavanja. See [LICENSE](./LICENSE).
````

- [ ] **Step 3: Verify the rewrite**

Run:
```bash
wc -l README.md
bash /tmp/check-links.sh README.md
grep -nE 'release-1|green epoch|Round [0-9]|P[2-5] \(|Post-release|Prior rounds|REVIEW-FINDINGS|revalidation' README.md
```

Expected: ~170 lines (soft target — the hard requirement is no round-by-round history);
`--- 0 broken link(s)`; and **no output** from the grep. Any hit means a slice of the old
history survived the rewrite.

- [ ] **Step 4: Verify the word counts in the file match the tree**

Run:
```bash
for f in decide architect plan build review debug git-ops; do
  n=$(wc -w < $f/SKILL.md); grep -q "| $n |" README.md && echo "ok $f $n" || echo "MISSING $f $n"
done
```

Expected: seven `ok` lines. A `MISSING` means the table carries a stale count — fix it to
the printed number.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(readme): lead with the skills, not with their measurement history

646 lines to ~170. The set is described on its own terms — what each skill does,
how it runs, what it costs in tokens — followed by install, the demos, and one
validation section carrying the current three-model scorecard and the naked-vs-
skilled lift. Nine rounds of epochs, re-grades, retractions and corrections move
to docs/validation/VALIDATION.md, where someone auditing the numbers will look
and someone evaluating the skills will not have to."
```

---

### Task 4: Retcon `CHANGELOG.md`, bump `package.json`

The changelog's `[Unreleased]` section documents the deleted v1 stack and neither shipped
release has an entry. Two tags exist — `v2.1.0` (2026-08-04) and `v2.2.0` (2026-08-06) —
and `package.json` still says `2.1.0`.

**Files:**
- Modify: `CHANGELOG.md` (replace everything between the header and `## [0.2.0]`)
- Modify: `package.json` (line 3, `version`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Confirm the release boundaries from git**

Run:
```bash
git log -1 --format='v2.1.0 %ai' v2.1.0; git log -1 --format='v2.2.0 %ai' v2.2.0
git log --oneline --first-parent v2.1.0..v2.2.0
git log --oneline --first-parent v2.2.0..main
```

Expected: v2.1.0 dated 2026-08-04, v2.2.0 dated 2026-08-06; PRs #14–22 between the tags;
PRs #23–24 after v2.2.0. The entries in Step 2 are written from exactly this.

- [ ] **Step 2: Replace the v1-era sections**

In `CHANGELOG.md`, keep lines 1–7 (the title, the "notable changes" line, the "history of
the framework's own thinking" line, and the `---`) and keep `## [0.2.0]` onward verbatim.
Replace everything in between — the entire `## [Unreleased]` block with Items 0.1, 0, 1, 6,
9, 8, 2, 3, 4, 10 — with:

````markdown
## [Unreleased]

**Added** — the steering digest, dogfooded. `/feature` and `/bugfix` both driven end to end
against a repo carrying a planted out-of-scope bug; the closing digest surfaced it as a
Follow-up in both flows without either touching it, and caught one defect nobody planted.
Recorded in `docs/demos/steering-digest-2026-08-06.md`. The `[ONE-WAY]` pause remains
unexercised — no task in the run warranted a one-way step.

**Added** — red baselines and lift. Every scenario re-run with no skill at all (477
rep-executions, three models, three reps) to measure what the skills *add* rather than how
well they score: aggregate +15 / +11 / +13 scenarios of 35. Lift concentrates where models
are weakest, and some disciplines — characterization tests before refactoring,
decision-record honesty — appear only under the skill, on every model.

**Changed** — documentation restructured for public use. The README leads with the skills
(646 lines to ~170); everything about measuring them consolidated into
`docs/validation/VALIDATION.md` with the run manifest beside it. **Removed**
`REVIEW-FINDINGS.md` (every item fixed, SHAs recorded in the file's own history) and
`docs/revalidation-2026-08-05.md` (dated working notes). Both survive in git history.

**Fixed** — CI's lint-summary guard tolerates additive format growth in the harness output,
so tracking the harness's moving `latest` tag stops turning its releases into red trees.

## [2.2.0] — 2026-08-06

The release that learned to distrust its own instruments.

**Added** — a third subject model across the whole board. kimi-k3, never tuned against, run
on all 88 scenarios (264 rep-executions) as the control for overfitting. It ties or beats
both tuned models, which re-partitions the failure list: several published "universal"
limits turn out to be two-model artifacts.

**Added** — the judge-variance audit. Every non-unanimous cell re-judged from saved
transcripts, then disputed reps escalated: over 170 judge calls, no model spend. Two cells
were misreported as failures and corrected; a third correction was later **retracted** when
nine judgments of the same transcript split 4–5. The finding that outlasted the numbers:
some transcripts are coin flips, and no amount of voting fixes one — read the margin, not
the majority.

**Changed** — three checklists rewritten to decide their own transcripts (`architect` C2,
`build` B1, `review` S6), validated at seven judgments per rep. Decidability cut both ways:
the same rewrite moved `architect` C2 to PASS on one model and to a decisive FAIL on
another, exposing a consistent failure the old count-based checklist had never named.

**Changed** — seeded scenarios are graded from the diff, not the model's prose. skill-harness
0.3.0 puts the staged diff in front of the judge; `build` and `debug` were fully re-measured
against it. `debug` held at 8/8 on both models. `build` fell to 44%, which is the honest
number: three distinct causes, one of them a needle that scored word choice rather than
behavior.

**Fixed** — scenario bugs, the fourth and fifth instances of the law that they present as
model failures: `git-ops` A9 asked a model to point at conflict markers in an empty
directory (reseeded; both models now 15/15 SHIP), and `build` A2's out-of-scope item was
already annotated as known in its own fixture.

**Added** — the release-2 bundle: `/feature` and `/bugfix` gain a `[ONE-WAY]` pause and a
closing six-line digest; `build` A1 gets an objective overdraft gate and B1 a Checks row;
`architect` gains a middle mode so a sound-check returns a verdict instead of the full
artifact; `plan`'s walking skeleton teaches primitive-but-real instead of stubbed, and its
right-sizing hatch survives system-prompt placement.

**Changed** — the measured deployment is now skill-as-system-prompt (`--mode force`). pi
0.83 switched `--skill` to progressive disclosure and accepts a nonexistent skill path
silently, so a day of runs measured naked models while producing plausible results. Those
runs are marked INVALID and kept as the incident's evidence. Green-epoch and force-epoch
cells are **not comparable**: on identical text, force placement took `build` A1 from 0/3 to
3/3 and dropped `plan` C2 on GLM from 3/3 to 0/3.

**Added** — CI guards, all free: spec and results lint on every PR (staleness warns on a
branch, blocks on `main`), plus an agents-lockstep check that fails a PR touching
`plan|review|debug/SKILL.md` without its `agents/` twin.

## [2.1.0] — 2026-08-04

The v2 redesign, promoted and measured.

**Changed** — the seven v2 skills moved from `proposals/` to the repository root and are now
the framework. **Removed** the ten v1 skill directories, `BATON.md`, and the v1-era README
and AGENTS.md. The v1 stack — specs, fixtures and Opus-judged baseline results — survives in
git history at the commit before the promotion.

**Added** — the seven dual-use skills (`decide`, `architect`, `plan`, `build`, `review`,
`debug`, `git-ops`), each working unedited as a loaded skill or a subagent system prompt;
three hand-written single-shot variants in `agents/`; the `/feature` and `/bugfix` prompt
templates; and `RESULTS-MANIFEST.md` mapping every committed run to its round and status.

**Fixed** — the delegation contract, measured for the first time and then repaired. `BLOCKED`
appeared in AGENTS.md, both prompt templates and six checklist items — and in none of the
three agent definitions. The agents now carry the contract themselves; the starved-input
scenario went from 0/2 across the board to majority-or-unanimous in every cell.

**Fixed** — coverage debt: `debug` D1 redesigned around a coherent single-cause bug (its old
premise was false under its own bug), two over-refusal guards added to `git-ops` so the
safety absolutes are shown not to overshoot, and a characterization-test scenario added to
`build`.

**Added** — release-1: 88 scenarios × two models × three reps, 528 rep-executions, judged by
`claude-code:opus`, with the first live end-to-end runs of both chains against real repos
(`docs/demos/`).

## Pre-2.1.0

The v1 ten-skill stack and its iteration — the baton schema, the brownfield architect modes,
the tech-lead ↔ coder boundary, the orchestrator model, reversibility notation, frontmatter
trimming — was removed when v2 was promoted. Those items described artifacts that no longer
exist; the reasoning behind them is in git history and in the `[0.2.0]` entry below, which
records the restructure that produced the stack v2 replaced.

````

- [ ] **Step 3: Bump the package version**

In `package.json`, change line 3:

```
    "version": "2.1.0",
```
to
```
    "version": "2.2.0",
```

- [ ] **Step 4: Verify**

Run:
```bash
node -e "console.log(require('./package.json').version)"
grep -nE '^## ' CHANGELOG.md
awk '/^## \[0\.2\.0\]/{exit} {print}' CHANGELOG.md \
  | grep -cE 'BATON|tech-lead|ponytail|implementation-planner|software-architect'
```

Expected: `2.2.0`; the section list reads `[Unreleased]`, `[2.2.0]`, `[2.1.0]`,
`Pre-2.1.0`, `[0.2.0]`, `[0.1.0]`; and the third command prints **1** — the single
`tech-lead` mention inside the `Pre-2.1.0` note. (It prints 21 before this task runs.) The
v1 skill names otherwise survive only in `[0.2.0]` and `[0.1.0]`, which the awk range
excludes because those sections are the record of the era that had them. A count above 1
means a v1-era item was left behind.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "docs(changelog): real entries for the two releases that shipped

[Unreleased] documented the v1 stack that promotion deleted, while v2.1.0 and
v2.2.0 — both tagged, both measured — had no entries at all. Written from the
PR history at each tag, with the v1-era items compressed into a note pointing at
git history. package.json catches up to the v2.2.0 tag."
```

---

### Task 5: Acceptance sweep and PR

Everything up to here was verified per-file. This runs the whole-repo gates from the spec,
with nothing excluded, and opens the PR.

**Files:**
- No file changes expected. This task fixes anything the sweep catches, then opens the PR.

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: a PR against `main`.

- [ ] **Step 1: No dangling references to deleted or moved files**

Run:
```bash
grep -rn --include='*.md' --include='*.yaml' --include='*.yml' --include='*.json' \
  -E 'REVIEW-FINDINGS|revalidation-2026-08-05' . \
  --exclude-dir=.git --exclude-dir=docs/superpowers --exclude-dir=node_modules
```

Expected: no output. (`docs/superpowers/` is excluded because the spec and this plan name
the deleted files as the record of deleting them.)

Then confirm every surviving mention of the moved files uses the new path:
```bash
grep -rn --include='*.md' --include='*.yaml' -E 'RESULTS-MANIFEST|judge-variance-2026-08-04' . \
  --exclude-dir=.git --exclude-dir=docs/superpowers
```

Expected: every hit is either `docs/validation/RESULTS-MANIFEST.md`, a bare
`RESULTS-MANIFEST.md` *inside* `docs/validation/` (a sibling link), or
`../evidence/judge-variance-2026-08-04.md` / a bare sibling reference inside
`docs/evidence/`. No hit should read `docs/judge-variance-2026-08-04.md` or a root-level
`RESULTS-MANIFEST.md` path.

- [ ] **Step 2: Every relative link in the repo resolves**

Run: `bash /tmp/check-links.sh`

Expected: `--- 0 broken link(s) in 32 file(s)`, exit 0. (32 rather than 33: two files were
deleted and one created.) A non-zero count here is a real defect — fix it before the PR.

- [ ] **Step 3: Nothing outside documentation changed**

Run:
```bash
git diff --stat main -- '*/SKILL.md' 'agents/' 'prompts/' '*/tests/' AGENTS.md docs/demos/ .github/ LICENSE
git diff main --stat -- package.json
```

Expected: the first command prints nothing at all. The second prints exactly one file with
one insertion and one deletion — the version bump.

- [ ] **Step 4: Confirm the frozen evidence path still resolves**

Run: `ls -l docs/evidence/c2-needle-2026-08-05.md`

Expected: the file exists. `build/tests/specification.yaml:152` cites this path in a
comment, and keeping it valid is why the evidence directory did not move.

- [ ] **Step 5: Review the full diff before pushing**

Run: `git diff main --stat`

Expected, and nothing else: `README.md` (large rewrite), `CHANGELOG.md` (large rewrite),
`package.json` (1/1), `REVIEW-FINDINGS.md` (deleted), `docs/revalidation-2026-08-05.md`
(deleted), `RESULTS-MANIFEST.md` → `docs/validation/RESULTS-MANIFEST.md` (renamed, small
edit), `docs/judge-variance-2026-08-04.md` → `docs/evidence/judge-variance-2026-08-04.md`
(renamed, 1-line edit), `docs/validation/VALIDATION.md` (new), plus the spec and this plan
under `docs/superpowers/`.

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin docs-cleanup
gh pr create --title "docs: a public, production-ready documentation set" --body "$(cat <<'EOF'
## What

The documentation now describes the skills. Tests of the skills live in one place and are
referenced from everywhere else.

- **README** 646 → ~170 lines. Leads with what each of the seven skills does, how it runs,
  and what it costs in tokens; then install, the demos, and one validation section carrying
  the current three-model scorecard plus the naked-vs-skilled lift.
- **`docs/validation/VALIDATION.md`** (new) — the single entry point for measurement:
  method, the two delivery epochs and why their cells do not compare, the full scorecard,
  what the skills add, open items at their measured rates, and the lessons each wrong number
  bought. `RESULTS-MANIFEST.md` moves beside it.
- **`docs/evidence/judge-variance-2026-08-04.md`** moves in with the evidence it is the
  method for, which repairs a link `rubric-2-regrade.md` has been carrying broken.
- **CHANGELOG** gains real `[2.2.0]` and `[2.1.0]` entries — both tags shipped without one,
  while `[Unreleased]` still documented the v1 stack that promotion deleted. `package.json`
  catches up to the v2.2.0 tag.
- **Deleted**: `REVIEW-FINDINGS.md` (every item fixed, SHAs in the file) and
  `docs/revalidation-2026-08-05.md` (dated working notes). Git history keeps both.

## What did not change

No skill, agent, prompt, spec, fixture, or committed result. `git diff --stat main` shows
zero changes under any `<skill>/`, `agents/`, or `prompts/` path — evidence paths were kept
frozen specifically so `build/tests/specification.yaml`'s citation stays valid. AGENTS.md
and the demos are untouched.

## Verification

- Every relative markdown link in the repo resolves (0 broken, down from 1 on `main`).
- No reference anywhere to the deleted files.
- Every scorecard figure traces to a **current** or red-baseline row in the run manifest —
  copied, not re-measured. Word counts in the README regenerated with `wc -w`.
EOF
)"
```

- [ ] **Step 7: Confirm CI is green**

Run: `gh pr checks --watch`

Expected: both jobs pass. `spec-lint` reads specs and committed results — none of which this
PR touches — and `agents-lockstep` only fires on `SKILL.md` changes, of which there are none.
A failure here means something outside documentation moved; find it rather than re-running.

---

## Self-Review

**Spec coverage.** Walked every section of
`docs/superpowers/specs/2026-08-07-docs-cleanup-design.md` against the tasks above:

| Spec requirement | Task |
|---|---|
| README rewrite, 10 sections, ~170 lines | 3 |
| Word counts regenerated via `wc -w` | 3 (Steps 1, 4) |
| Set table on v2's own terms, no "Replaces" column | 3 |
| North-star framing salvaged from the revalidation doc | 3 (Step 2, paragraph 2) |
| "See it run" demos section | 3 |
| Validation section: scorecard + lift + link | 3 |
| Design rules absorbing the four hardening bullets | 3 |
| VALIDATION.md, eight sections | 2 |
| Manifest moved, header pointers repaired | 1 (Steps 3, 5) |
| judge-variance moved, internal link updated | 1 (Steps 3, 4) |
| REVIEW-FINDINGS.md and revalidation deleted | 1 (Step 6) |
| CHANGELOG retconned, pre-v2 note | 4 |
| package.json 2.1.0 → 2.2.0 | 4 |
| Acceptance check 1 — no dangling references | 5 (Step 1) |
| Acceptance check 2 — links resolve | 5 (Step 2), and per-file in 1–3 |
| Acceptance check 3 — frozen paths untouched | 1 (Step 8), 5 (Steps 3, 4) |
| Acceptance check 4 — CI green | 5 (Step 7) |
| Acceptance check 5 — numbers copied, not invented | 2 (Step 3), Global Constraints |
| Acceptance check 6 — word counts regenerated | 3 (Steps 1, 4) |
| Acceptance check 7 — README ≈ 170 lines | 3 (Step 3) |

No gaps.

**Two deliberate deviations from the spec**, both narrowing rather than expanding scope:

1. The spec's VALIDATION.md outline puts a per-model aggregate in the scorecard. That
   aggregate mixes the two epochs, which the same document tells the reader never to do.
   Task 2 keeps it but labels it explicitly as a summary of the table rather than a
   measurement, and Task 3 keeps it out of the README entirely in favor of two claims that
   are verifiable by reading the table (six of seven ship; the untuned model does best).
2. The spec's README lift table includes a `review` row with two banked cells. Task 3 drops
   that row — the aggregate is already scoped to "35 scen.", which is exactly
   plan + architect + build — and the full four-row table with the banking caveat lives in
   VALIDATION.md. This keeps the README section short, which is what the user asked for.

**Placeholder scan.** No TBD, no "similar to Task N", no "add appropriate handling". Every
file's full content is written out; every verification step names the command and its
expected output. The one tool the plan creates (`check-links.sh`) is given in full and was
executed against this repo before the plan was written — it correctly reports the single
pre-existing broken link that Task 1 fixes.

**Consistency check.** Path names, scorecard figures and word counts were cross-checked
between Task 2's VALIDATION.md and Task 3's README: the two scorecard tables carry identical
cells, the two lift tables carry identical numbers where they overlap, and both link to each
other at the paths Task 1 creates. The `†` marker means the same thing in both.

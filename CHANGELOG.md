# Changelog

All notable changes to this framework are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

Where review revealed a prior claim or design decision didn't hold up under closer inspection, this changelog says so explicitly. The history of the framework's own thinking is part of the framework.

---

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
(646 lines to under 200); everything about measuring them consolidated into
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
`build` B1, `review` S6), each validated by re-judging saved transcripts several times per
rep and reading the margin rather than the majority. Decidability cut both ways: the same
rewrite moved `architect` C2 to PASS on one model and to a decisive FAIL on another,
exposing a consistent failure the old count-based checklist had never named.

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
3/3 on DeepSeek and 1/3 to 3/3 on GLM, and dropped `plan` C2 on GLM from 3/3 to 0/3.

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
scenario — which `plan` failed on both models and `debug` failed on GLM — now passes at
majority or better in every agent × model cell.

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

## [0.2.0] — 2026-06-25

Model-agnostic framework redesign. The six-skill stack became a ten-skill stack, every `SKILL.md` was rewritten to drop model-specific assumptions, and the per-skill bash benchmark was replaced by one declarative spec per skill.

**Changed — model-agnostic rewrite of every skill.** Compressed `SKILL.md` bodies to one-line tenets, replaced prose guidance with armed red-flag / STOP tables plus over-correction governors (so a skill can't be pushed past its own remit), narrowed frontmatter `description`s to trigger-only text, and inlined the few load-bearing `AGENTS.md` facts directly into the skills — removing the `§N` cross-references that coupled skills to a specific repo layout.

**Changed — `tech-lead` merged into `implementation-planner`.** The planner now produces both the implementation plan and the per-slice coding spec; the standalone `tech-lead/` skill is gone. Its assets moved under `implementation-planner/assets/` (`coding-spec.md`, `bugfix-spec.md`, `refactor-spec.md`, `risk-register.md`, `exploration-notes.md`).

**Added — new skills.**
- `ponytail` — simplicity sidekick / critic.
- `code-review` — correctness gate.
- `using-principal-pi-skills` — posture + routing index for the stack.
- `adr` — split out of `software-architect` into its own skill.

**Changed — the skill set is now ten:** `using-principal-pi-skills`, `brainstorming`, `software-architect`, `adr`, `implementation-planner`, `coder`, `ponytail`, `code-review`, `debugging`, `project-git`. Primary flow: brainstorming → implementation-planner → coder → [ponytail · code-review] → project-git, with software-architect (+adr) as design depth and debugging as the repair loop.

**Changed — test harness consolidated.** Each skill now carries one declarative `tests/specification.yaml` (scenarios + checklist + ship bar), replacing the old per-skill bash harness (`run-pi` / `run-claude` / `bench` / `grade` / `cases` / `scenarios.md`). Seeded `coder` and `debugging` fixtures are TypeScript + Vitest. A separate, portable `skill-check` tool runs the specs.

**Changed** `package.json` `pi.skills` manifest synced to the ten-skill stack.

#### Design notes

`package.json` `version` stays `0.1.0`; skills now version independently in their own frontmatter (`implementation-planner` 0.3.0, `coder` 0.3.0, `brainstorming` 2.2.0, others 0.1–0.2). The `0.2.0` tag here marks the framework-level restructure, not the package version.

Nine of the ten skills ship a `specification.yaml`; `using-principal-pi-skills` is a routing index with no behavior of its own to spec, so it has no test directory.

## [0.1.0] — 2026-05-12

Initial commit. Six skills (`brainstorming`, `software-architect`, `tech-lead`, `implementation-planner`, `coder`, `project-git`), each with `SKILL.md` + `assets/` + `references/`. MIT license.
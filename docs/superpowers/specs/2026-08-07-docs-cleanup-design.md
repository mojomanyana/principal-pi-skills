# Docs cleanup — public, production-ready documentation

Date: 2026-08-07 · Status: **approved** (design presented and accepted in-session)

## Goal

User- and agent-facing documentation describes **the skills**; tests of the skills live in
their own section and are referenced, not inlined. Historical iteration data (what the
skills scored five runs ago, what was corrected when) leaves the living docs — git history
is the archive. The repo should read as a public, production-ready skill set that a human
or an agent can understand without knowing its development story.

## Hard constraints

- **Untouched:** all seven `<skill>/SKILL.md`, every `<skill>/tests/` tree (specs,
  fixtures, committed `results.yaml`), `agents/*.md`, `prompts/*.md`, `AGENTS.md`,
  `docs/demos/*`, `.github/workflows/ci.yml`, `LICENSE`.
- **One exception, approved:** `package.json` — the `version` field only, `2.1.0` → `2.2.0`
  (matches the newest tag).
- **Frozen paths:** `docs/evidence/c2-needle-2026-08-05.md`, `rubric-2-regrade.md`,
  `s6-rubric-regrade-2026-08-05.md`, and the `judge-variance-2026-08-04/` artifact dir stay
  where they are — `build/tests/specification.yaml:152` cites the c2-needle path from a
  comment, and frozen evidence paths mean zero edits inside skill trees.

## User-confirmed decisions

1. **Historical docs are deleted outright**, not archived (git history preserves them).
2. **README keeps one short validation section with two tables** (current 3-model
   scorecard + naked-vs-skilled lift), everything else moves to a dedicated validation doc.
3. **CHANGELOG is retconned to releases**: real `[2.1.0]` and `[2.2.0]` entries from git
   history, v1-era `[Unreleased]` items compressed into a short pre-v2 note,
   `package.json` bumped.
4. **`docs/judge-variance-2026-08-04.md` is moved, not deleted** (approved as part of the
   design): it is the method record cited by committed evidence, and moving it into
   `docs/evidence/` fixes a currently-broken relative link in `rubric-2-regrade.md`.
5. Structure follows **approach A**: consolidate test material under `docs/validation/`.

## Target layout

```
README.md                          rewritten, ~170 lines
AGENTS.md                          unchanged
CHANGELOG.md                       retconned to releases
LICENSE, package.json              version field bump only
docs/
  validation/
    VALIDATION.md                  NEW — single entry point for "tests of the skills"
    RESULTS-MANIFEST.md            moved from repo root; table intact; pointers fixed
  evidence/
    judge-variance-2026-08-04.md   moved in from docs/ (one internal link updated)
    c2-needle-2026-08-05.md        unchanged (frozen path)
    rubric-2-regrade.md            unchanged (its judge-variance link starts resolving)
    s6-rubric-regrade-2026-08-05.md unchanged
    judge-variance-2026-08-04/     unchanged (txt artifacts)
  demos/                           unchanged
```

Deleted: `REVIEW-FINDINGS.md`, `docs/revalidation-2026-08-05.md`.

## Per-file specification

### README.md — rewrite (646 → ~170 lines)

Sections, in order:

1. **Header + what it is.** Seven dual-use skills for principal-level engineering with pi;
   four inline, three doubling as subagents; Agent Skills standard. Add one framing
   sentence salvaged from the revalidation doc: built for **one principal engineer who
   steers at high level while skills and subagents do the work** — outputs must be
   verifiable without redoing them (delegable trust) and defects must be fixable cheaply
   (cheap iteration). Drop the v1/v2 redesign paragraph ("This is the framework's v2 …
   nine validated improvement rounds").
2. **The three constraints** (dual-use, model-agnostic, token economics) — kept, with word
   counts **regenerated at write time** via `wc -w` (current: decide 671, review 752,
   build 800, debug 933, plan 1072, architect 1097, git-ops 1320 accepted exception;
   agents: review 784, debug 1060, plan 1315). Drop "as of release-1" framing; budgets
   stated as budgets (skills ≤ ~1100 with git-ops the named exception, agents ≤ ~1350 —
   restate honestly from the regenerated numbers rather than copying the stale ≤ ~1050 /
   ≤ ~1300 claims).
3. **The set** — table rewritten on v2's own terms: `skill | job | how it runs
   (inline / subagent) | words`. The v1 "Replaces" column, the "10 → 7" heading, and the
   deleted-routing-skill row go. The one durable design note from that table (routing
   belongs to the orchestrator — AGENTS.md, not a skill) moves to the Design rules section.
4. **Layout** — kept; `RESULTS-MANIFEST.md` line updated to `docs/validation/`; add a
   `docs/validation/` line ("how the skills are measured — scorecard, manifest, evidence").
5. **Install (pi)** — kept as-is (three steps, pi-mono commit pin, tool-restriction note).
6. **Shared contract** — kept as-is (the `Next:` line paragraph).
7. **See it run** — NEW, ~4 lines: links to the three demos
   (`docs/demos/feature-chain.md`, `bugfix-chain.md`, `steering-digest-2026-08-06.md`)
   with a half-line description each.
8. **Validation** — the short section (user decision 2). Contents, exactly:
   - ~6 sentences of method: measured with skill-harness (`@latest`, per the standing
     decision to track the moving tag), every scenario × 3 reps, majority gate, Opus
     judge; scored deployment is skill-as-system-prompt (`--mode force`) — the delivery
     modern pi makes deterministic; three subject models (DeepSeek v4-pro, GLM 5.2,
     kimi-k3, the third fully untuned).
   - **Current scorecard table** — one table, all seven skills × three models (DeepSeek,
     GLM, kimi-k3): force-epoch cells for build (78/100/100), architect (93/93/100),
     plan (83/83/100), review (†94/†94/100); standing green-epoch cells for debug
     (100×3), git-ops (100×3), decide (92×3). SHIP cells marked; † on every green-epoch
     cell with a one-line legend ("† measured under the wrapped-prompt delivery; text
     unchanged since"). Numbers copied from the existing README tables (verified against
     `RESULTS-MANIFEST.md` current rows) — no re-measurement.
   - **Lift table** — the naked → skilled table (aggregate row: DS 15→30, GLM 21→32,
     kimi 22→35 of 35 scenarios) plus one sentence: lift concentrates where models are
     weakest, and some disciplines (characterization tests, decision-record honesty)
     exist only under the skill on every model.
   - Closing pointer: "Full scorecard, epochs, method, and every committed run:
     [`docs/validation/VALIDATION.md`](docs/validation/VALIDATION.md)."
9. **Deliberate design rules** — kept, absorbing (a) the routing-belongs-to-the-orchestrator
   note from the old set-table, and (b) the four durable bullets from "Hardening lessons"
   (pressure armor · right-sizing as hard conditional · no-repo/no-codebase branch ·
   literal code anchors) — stated as design rules, without round numbers or model war
   stories.
10. **License** — unchanged.

Deleted from README (destination in parentheses): force-epoch narrative and incident
details (→ VALIDATION.md, compressed), the entire green-epoch record with †/§/¶/‖
annotations (→ VALIDATION.md as the epoch explanation + standing-cells table), "A third
model" (→ VALIDATION.md, one paragraph), "How to read this honestly" (→ VALIDATION.md,
compressed), "Known tails" (→ VALIDATION.md "Open items", current tails only),
"Post-release corrections", "Prior rounds", "Round 9", "P2–P5" (deleted; durable lessons
distilled into VALIDATION.md's lessons list), "Hardening lessons" (absorbed into Design
rules as above).

### docs/validation/VALIDATION.md — new file (~120–160 lines)

The single entry point for "tests of the skills". Sections:

1. **What is measured.** Per-skill `tests/specification.yaml` scenarios (88 total across
   seven skills), critical scenarios, ship bar; seeded fixtures for build/debug/git-ops;
   agent D-scenarios injected via `system_prompt_file`.
2. **How.** skill-harness `@latest` (never the bare global binary — a stale 0.1.0 on PATH
   silently grades without the diff), `npx -y skill-harness@latest`, 3 reps per scenario,
   majority gate (git-ops C1 unanimity), judge `claude-code:opus`, objective gates
   (vitest, diff needles, `post_test`) decided before the judge.
3. **Epochs.** Green (pi ≤ 0.80.x wrapped-prompt) vs force (`--mode force`,
   skill-as-system-prompt) — why they exist (pi 0.83 progressive disclosure), why cells
   are not comparable across them (the two-sided effect: build A1 0/3→3/3, plan C2/GLM
   3/3→0/3 on identical text), and which epoch each current cell comes from.
4. **Current scorecard** — the full board: force-epoch cells for build/architect/plan/review,
   standing green-epoch cells for debug/git-ops/decide and review DS/GLM, per model, with
   failing scenarios named and rates (e.g. architect B1 1/3 DS · D1 1/3 GLM). Aggregate
   line per model.
5. **What the skills add** — red-baseline method (unscored controls, like-for-like reps)
   and the full lift table with the three findings (lift concentrates where models are
   weakest; skill-responsiveness ≠ naked capability; some disciplines exist only under
   the skill).
6. **Open items, honestly.** Current known tails only: build A2 reporting half (0/3 both
   tuned models, kimi 2/3 — two-model limit), review C1/GLM 1/3, plan A5⇄B1 DS run-level
   wobble (within-run flakiness 0.00 is not stability), review DS/GLM force re-measure
   pending (their red baselines are banked until then), decide A5/C1 boundary rates.
7. **Measurement lessons** (~10 lines, distilled): read the margin, not the majority — a
   near-even split is a scenario defect, not a verdict; scenario bugs present as model
   failures (five confirmed instances — verify a scenario can be passed before believing
   what it says about a model); a needle must name what the edit writes; weak models obey
   the material in front of them over skill text — environment fixes beat prose; every
   arming needs its governor in the same breath; pin the grader when measuring the grader.
8. **The record.** Links: `RESULTS-MANIFEST.md` (same dir — every run mapped to round and
   status), `../evidence/` (per-judgment regrade records, per-rep diffs, the judge-variance
   method study), per-skill `tests/` trees, CI guards (spec/results lint blocking, staleness
   warning on branches / blocking on main, agents-lockstep check).

Tone rule for both README §8 and VALIDATION.md: present tense, current numbers only; the
story of how a number moved belongs to git history and the evidence files, not the living
doc.

### CHANGELOG.md — retcon

Keep the header (including the "history of the framework's own thinking" line — it now
describes the release entries) and the `[0.2.0]` / `[0.1.0]` sections verbatim. Replace
everything between the header and `[0.2.0]` with:

- **`[Unreleased]`** — post-v2.2.0 work, from PRs #23–24: steering-digest dogfood (both
  spines end-to-end against a planted out-of-scope bug; digest surfaced it twice), red
  baselines + lift measurement (477 rep-executions, aggregate +15/+11/+13 of 35), CI
  lint-summary guard tolerating additive format growth. Plus this cleanup itself.
- **`[2.2.0]` — 2026-08-06** — from PRs #14–22: judge-variance audit (~170 judge calls;
  two false FAILs corrected, one correction later retracted); checklists made decidable
  (architect C2, build B1, review S6); git-ops A9 reseeded + full re-run (15/15 both
  models); kimi-k3 third-model probe across the board (83/88); skill-harness 0.3.0
  diff-visible judging + build/debug full re-measure (build's honest 44%, debug held 8/8);
  release-2 bundle (prompts gain the [ONE-WAY] pause + closing digest; build A1
  `post_test` gate; B1 Checks row; C2 needle fix; architect C2 middle mode; plan D1
  primitive-skeleton + C2 hatch); the pi-0.83 delivery incident and the force-epoch
  decision; force-epoch scorecard (kimi ships five of five force-measured skills); CI
  guards (lint + agents-lockstep).
- **`[2.1.0]` — 2026-08-04** — from PRs #4–13: the v2 redesign validated under
  `proposals/` and promoted to root, v1 ten-skill stack removed (survives in git history);
  seven dual-use skills + three agent variants + two prompt templates; RESULTS-MANIFEST
  added; delegation contract fixed and measured (P3); coverage debt closed (P4: debug D1
  redesign, git-ops A11/A12 over-refusal guards, build A6 characterization); release-1
  measurement — 88 scenarios × 2 models × 3 reps (528 rep-executions), plus the first
  live `/feature` and `/bugfix` chain runs (demos).
- **Pre-2.1.0 note** (~6 lines): compresses the v1-era items (baton schema, brownfield
  architect modes, tech-lead↔coder boundary, orchestrator model, reversibility notation,
  description trimming, operational fixes) into one paragraph — the artifacts they
  describe were removed with the v1 stack; details in git history and `[0.2.0]`.

Then bump `package.json` `version` to `2.2.0`.

Entry style: past releases are summarized honestly (what changed, what was measured),
without re-litigating per-scenario details — those live in VALIDATION.md and evidence.

### RESULTS-MANIFEST.md — move to `docs/validation/`, light header edits

- `git mv RESULTS-MANIFEST.md docs/validation/RESULTS-MANIFEST.md`.
- Header pointer updates only, table untouched:
  - "the round-over-round trajectory in README's Validation results (…)" → the trajectory
    parenthetical stays in the manifest header as the policy rationale, but the pointer
    now names `VALIDATION.md` instead of README.
  - "README's scorecard = the **current** (latest) run per skill × model" → "the
    scorecard in `VALIDATION.md` = …".
  - Every `docs/evidence/…` relative link gains `../`: `docs/evidence/c2-needle-2026-08-05.md`
    → `../evidence/c2-needle-2026-08-05.md` (one verified occurrence, the C2 footnote;
    re-scan mechanically at implementation time).
  - The `~/prepos/skill-check/docs/…` local-path reference stays (it is a pointer to the
    harness repo's analysis, correctly outside this repo).

### docs/judge-variance-2026-08-04.md — move to `docs/evidence/`

- `git mv docs/judge-variance-2026-08-04.md docs/evidence/judge-variance-2026-08-04.md`.
- One internal link update: `[evidence/judge-variance-2026-08-04/](evidence/judge-variance-2026-08-04/)`
  → `[judge-variance-2026-08-04/](judge-variance-2026-08-04/)`.
- Side effect (verified): `rubric-2-regrade.md`'s existing link
  `[judge-variance-2026-08-04.md](judge-variance-2026-08-04.md)` — currently a 404 —
  starts resolving.

### Deletions

- `git rm REVIEW-FINDINGS.md` — every numbered finding carries a fix SHA; the three
  "deferred" spec-debt items all landed later (verified in the current tree: build A6
  exists in `build/tests/specification.yaml`; git-ops A11 + A12 exist in
  `git-ops/tests/specification.yaml`).
- `git rm docs/revalidation-2026-08-05.md` — dated working notes; the north-star framing
  is salvaged into README §1, P4's "accept two model tails" is covered by VALIDATION.md
  Open items, and the pi-0.83 correction is recorded in the manifest.

## Acceptance checks

1. **No dangling references.** `grep -rn --include='*.md' --include='*.yaml' --include='*.yml' -E 'REVIEW-FINDINGS|revalidation-2026-08-05' .` (excluding `.git/` and `docs/superpowers/`, which records this change) returns nothing;
   every remaining mention of `RESULTS-MANIFEST.md` and `judge-variance-2026-08-04.md`
   uses the new paths.
2. **All relative markdown links resolve** — script check over every `*.md` outside
   skill/agent/prompt trees: extract `](…)` targets, skip `http`/`#`, assert the path
   exists relative to the file.
3. **Frozen paths untouched:** `git diff --stat main` shows zero changes under any
   `<skill>/`, `agents/`, or `prompts/` directory, and
   `build/tests/specification.yaml:152`'s comment still points at an existing file.
4. **CI green** on the PR: `lint all` unaffected (it reads specs/results, none of which
   move), agents-lockstep unaffected (no SKILL.md changes).
5. **Scorecard numbers copy, not invent:** every cell in README §8 and VALIDATION.md §4–5
   traces to a **current**/red-baseline row in RESULTS-MANIFEST.md or the existing README
   tables being replaced.
6. **Word counts in README are regenerated** (`wc -w`), not copied from the stale list.
7. **README ≈ 170 lines** (soft target; the hard requirement is: no round-by-round
   history, no epoch archaeology, no per-correction narrative).

## Out of scope (explicitly)

- Pruning committed `results.yaml` evidence or anything under `<skill>/tests/`.
- Any edit to skill/agent/prompt behavior or text.
- New meta-docs (CONTRIBUTING, CODE_OF_CONDUCT) — not requested.
- Re-running any measurement; this cleanup only reorganizes what is already measured.
- Tagging a release (the version bump aligns metadata with the existing v2.2.0 tag; a
  future v2.3.0 is cut whenever the user decides).

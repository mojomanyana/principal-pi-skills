# Changelog

All notable changes to this framework are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

Where review revealed a prior claim or design decision didn't hold up under closer inspection, this changelog says so explicitly. The history of the framework's own thinking is part of the framework.

---

## [Unreleased]

### Item 0.1 — v2 promoted; v1 stack removed

**Changed** The seven v2 skills moved from `proposals/` to the repository root and are
now the framework. **Removed** the ten v1 skill directories (`brainstorming`,
`software-architect`, `adr`, `implementation-planner`, `coder`, `ponytail`,
`code-review`, `debugging`, `project-git`, `using-principal-pi-skills`), `BATON.md`
(v2 has no baton vocabulary), and the v1-era `README.md`/`AGENTS.md`, both rewritten
around the v2 set; `package.json`'s `pi.skills` now registers the seven. The v1 stack —
including its specs, fixtures, and Opus-judged baseline results — survives in git
history at the commit before this one. Promotion also resolves the v1↔v2 fixture/spec
byte-duplication flagged in PR #4 review (finding 6): the duplicated trees were deleted
with the stack that owned them. Paths below in Item 0 read `proposals/…` as written at
the time; drop the prefix for the promoted layout.

### Item 0 — `proposals/`: a validated 7-skill v2 redesign

**Added** `proposals/` — a candidate replacement for the 10-skill stack, consolidating to 7
dual-use skills (`decide`, `architect`, `plan`, `build`, `review`, `debug`, `git-ops`) that
work unedited as loaded skills or as subagent system prompts. Each is ≤~900 words,
self-contained (no reference trees), with an inline fill-in output template, an explicit
delegated (single-shot) mode, and triggers-only descriptions. `review` merges
code-review + ponytail into one two-axis pass; `architect` absorbs `adr` as a
Decision-record output section; the routing-index skill is dropped (routing belongs to the
orchestrator). Rationale, validation scorecard, and cross-model hardening lessons:
`proposals/README.md`.

**Added** adapted `tests/specification.yaml` per proposal skill (74 scenarios; seeded
fixtures copied for `build`/`debug`) and the Opus-judged `results.yaml` evidence for three
improvement rounds against DeepSeek v4-pro and GLM 5.2. Final: GLM ~99% aggregate (6/7
SHIP at 100%), DeepSeek ~92% (vs the v1 baseline's 61%). Verified judge misfires (~2%,
always FAIL-verdict-with-passing-reason) carry `override: PASS` + a note in the
committed `results.yaml`.

**Design note.** The v2 skills deliberately drop v1's baton vocabulary, per-skill governor
tables, and reference trees; three validation rounds showed what had to come back in
compressed form: pressure armor ("repetition doesn't change the answer — any turn,
including the last"), hard right-sizing conditionals ("the minimal form IS the
deliverable"), no-repo/no-codebase branches for grounded skills, and literal code anchors
where prose rules don't land on weaker models. Known residue: `plan` on DeepSeek fails B1
(turn-3 flat-list collapse) and C2 (over-plans a trivial flag) across three wordings —
recorded as model tails, not design holes.

### Item 1 — Baton schema

**Added** `BATON.md` at repo root: canonical baton schema. Documents the nine-field common spine, the six primary transitions (brainstorming → any, architect → any, planner → tech-lead, tech-lead → coder, coder → project-git) plus the project-git return baton, the YAML frontmatter convention, validation rules, revision protocol, and an explicit "why no JSON Schema validator yet" rationale (premature complexity for a framework targeting orchestrator modes 1 and 2).

**Added** three previously-missing baton templates:
- `brainstorming/assets/handoff-baton.md`
- `software-architect/assets/handoff-baton.md`
- `tech-lead/assets/handoff-baton.md`

**Updated** `implementation-planner/assets/handoff-baton.md` and `coder/assets/handoff-baton-to-git.md` to include YAML frontmatter aligned with the schema. Existing markdown body sections preserved unchanged — the YAML carries the machine-parseable spine, the prose body carries human-readable context.

**Updated** `AGENTS.md` §4: pointer to BATON.md, harmonized summary of the spine, list of all six baton templates.

#### Design notes

The original opinion item called for *"one canonical baton shape (YAML or JSON), have every skill emit it."* Closer reading didn't support that — a coder→git baton legitimately needs different fields (branch state, commit SHAs, acceptance checks) than a planner→tech-lead baton (slice ID, acceptance criteria, tried/ruled-out). Forcing one shape would erase real signal. The fix became *"document the family"* — a common spine plus per-transition extensions, with YAML frontmatter for machine-parseability without forcing rigid uniformity.

No formal JSON Schema validator is shipped. Building one before there's a consumer (the framework targets orchestrator modes 1 and 2 today; mode 3 is aspirational per AGENTS.md §1) would be the same kind of "premature complexity" that software-architect Mode I refuses. When a harness exists, validating against BATON.md is straightforward.

A coverage gap was uncovered during this item: three of the six skills had no baton template at all (brainstorming, software-architect, tech-lead). The originally-scoped fix would have left this gap unaddressed. Templates were added to close it.

The two existing templates (planner, coder) were not restructured — only had YAML frontmatter prepended. The duplication between YAML fields and markdown body fields is intentional: humans read the markdown, harnesses parse the YAML.

### Item 6 — Brownfield architect modes

**Added** three new modes to `software-architect/SKILL.md`:

- **Mode G — Tech-debt triage.** For triaging an existing debt backlog. Produces a ranked action plan with impact × effort × reversibility scoring, an explicit do-never list, and a meta-recommendation when the debt list reveals organizational rather than technical gaps. Backing reference: `references/tech-debt-triage.md`.
- **Mode H — Onboard to an unfamiliar architecture.** For joining a team or inheriting a codebase. Produces a reverse-engineered C4 map with `?`-annotated unknowns and a ranked question list for the team. Distinct from Mode C (review): Mode H produces questions, Mode C produces findings. Backing reference: `references/onboarding.md`.
- **Mode I — Defend the current architecture.** For making the "don't change" case when pressured to migrate or modernize. Four-step structure: reframe to the problem, stress-test the change case, build the "do nothing" option seriously, name the trigger that would flip the recommendation. Inline, no backing reference.

**Added** two new reference files: `software-architect/references/tech-debt-triage.md` and `software-architect/references/onboarding.md`.

**Updated** in `software-architect/SKILL.md`:
- "Decision frameworks at a glance" section gained pointers to the two new references.
- "Handoff cues" table gained rows for Mode G/H/I outputs.

#### Design notes

The original review of this framework claimed Mode C (review existing architecture) was *"thinner and ends abruptly."* Closer reading didn't support that — Mode C has a clean 7-step structure and an appropriate scope for review work. The actual gap was missing *adjacent* modes for brownfield-specific activities (tech-debt triage, onboarding, status-quo defense), not a defect in Mode C itself. Item 6 adds those adjacent modes rather than rewriting Mode C.

Mode I has slight conceptual overlap with Mode A (Advisory) — both can produce "don't change" outputs. The distinction: Mode A is general advisory landing on any answer; Mode I is specifically defensive, invoked when the user is being pressured to change. If the boundary proves blurry in practice, Mode I may fold into a Mode A subsection in a future revision.

### Item 9 — Sharpen the tech-lead ↔ coder boundary

**Added** to `coder/SKILL.md` Mode B: "The Mode B test" — five concrete criteria that decide whether a task qualifies for direct coder execution (single file, specified to the keystroke, no new interface, no load-bearing decisions, one-sentence description). Plus explicit mid-implementation escalation triggers.

**Added** to `tech-lead/SKILL.md` line 117: forward pointer to the Mode B test plus a reflux note — tech-lead routes the user directly to coder when the ask satisfies all five criteria, without writing a spec.

**Updated** `AGENTS.md` §3: forward pointer to the Mode B test in the "Tiny change" canonical chain entry.

#### Design notes

The five criteria are an opinionated proposal; criterion 5 (*"one-sentence description, no 'and'"*) is the most subjective and may evolve with use.

A naming collision exists but was not fixed in this item: tech-lead Mode B is *"Spec from a direct user task"* (write a spec without planner upstream); coder Mode B is *"Direct task (no spec)"* (skip the spec entirely). Both have "direct" in the name. Contexts disambiguate within each skill, but cross-references could confuse. Logged for a future renaming pass.

### Item 8 — Clarify the orchestrator model

**Added** to `AGENTS.md` §1: definition of "orchestrator", names of the three orchestrator models (human-in-chat, agent-on-next-turn, programmatic harness), declaration that the framework targets modes 1 and 2 today and is extensible to mode 3.

**Added** to `README.md` Design Philosophy: brief pointer to AGENTS.md §1 for the routing question.

**Updated** per-skill phrasing in `project-git/SKILL.md` (L161, L234) and `implementation-planner/SKILL.md` (L266) — softened bare "orchestrator routes" to "user, agent, or orchestrator" where the context covers all routing modes.

#### Design notes

Four occurrences of bare "orchestrator" in `project-git/references/delegation-contract.md` and `project-git/SKILL.md` L155 were *not* changed — they live in mode-3-specific (delegated-mode) sections where "orchestrator" is correctly precise.

The original sweep missed reference files; new protocol from this item onward is to sweep `SKILL.md` + references + assets before quoting effort.

### Item 2 — Unify reversibility notation

**Decided:** the framework uses *two tiers* at decision/design altitude (brainstorming, software-architect, implementation-planner) — prose-only *two-way door* / *one-way door* — and *three tiers* at code altitude (tech-lead, coder) — 🟢 *two-way* / 🟡 *costly* / 🔴 *one-way*. This is intentional, not an inconsistency.

**Removed** all 🚪 / 🚪🚪 emoji from the framework (10 occurrences across `implementation-planner/SKILL.md`, three references, one asset, and two README mentions). Replaced with italic prose to match the rest of the design-altitude vocabulary.

**Added** to `AGENTS.md` §5: a paragraph documenting the altitude split so future contributors understand it's intentional.

**Updated** `README.md` Design Philosophy: rewrote the Reversibility paragraph to reflect the altitude split (the previous version claimed *"three skills tag decisions explicitly"* which was factually wrong after this item's edits).

#### Design notes

The original opinion item said *"pick one notation."* On closer inspection, two notations were tracking two genuinely different conceptual models (2-tier vs 3-tier), each appropriate for its altitude. The fix became *"document the why"* rather than *"unify."*

Initial sweep underscoped: the 🚪 emoji appeared in 10 places, not just 1 SKILL.md mention. Caught during verification; the asset (the fillable implementation-plan template) was particularly important because plans generated from it inherit the notation.

### Item 3 — De-duplicate shared tenets

**Decided:** not to de-duplicate.

#### Design notes

The original opinion item claimed substantial duplicate tenet text across skills. Closer inspection showed the "duplications" were mostly *consistent naming of skill-specific implementations* — "Read before write" appears in three skills, but each is a fully different paragraph implementing the principle for its own domain (tech-lead reads files before spec; coder reads files before code; project-git reads git state before commit). Pulling these into a shared file would either break skill portability (if installed individually) or fail to address actual duplication (since the text isn't actually duplicated).

True duplicated text totaled ~1.5% of the framework. Not worth the architectural cost.

### Item 4 — Trim frontmatter descriptions; add Triggers section

**Trimmed** the frontmatter `description` in all six `SKILL.md` files. Total reduction: ~5,800 → ~2,689 chars across all six (53.6% smaller on every turn).

**Added** a `## Triggers` section in each `SKILL.md` body, preserving the full original trigger-phrase content. The content now loads only after the skill activates, not on every turn for trigger detection.

**Removed** the Known Issues section from `README.md` (Zone.Identifier was deleted in Item 10, the only listed issue).

### Item 10 — Operational fixes

**Removed** `project-git/SKILL.md:Zone.Identifier` (Windows alternate-data-stream artifact, 25 bytes, no use to any agent).

**Added** `.gitignore` covering OS noise (macOS / Windows / Linux), editor and IDE state, and agent harness directories (`.claude/`, `.codex/`, `.pi/`, etc.).

**Added** `version: 0.1.0` to all six SKILL.md frontmatter as a tracking field for independent skill evolution.

**Added** a parenthetical clarification in `README.md` intro that "pi" in the framework name reflects the origin of the `SKILL.md` convention in the Pi coding agent, not a Pi-specific requirement.

---

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
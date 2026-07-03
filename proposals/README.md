# Proposal: 7-skill redesign (v2)

A replacement for the 10-skill framework, redesigned around three constraints the current
set fights against — then hardened through three validated improvement rounds (see
**Validation results** below).

1. **Dual-use.** Each file works as a loaded skill *and* as a subagent system prompt
   (Claude Code `.claude/agents/`, pi subagents) with zero editing. That forces:
   single-shot-safe behavior, an explicit delegated mode, and a literal output template.
2. **Model-agnostic.** Written for the weakest model that will run it (DeepSeek, GLM,
   Sonnet-class), not the strongest: imperative numbered steps, literal fill-in templates,
   plain-text tags (`[ONE-WAY]`, `[BLOCKER]`) instead of emoji schema, no aphorisms doing
   load-bearing work, no personas, no required reading in reference files.
3. **Token economics.** Every skill ≤ ~900 words, fully self-contained. No reference
   trees. A subagent loads one file and has the whole contract.

## The set (10 → 7)

| v2 skill | Replaces | What changed |
|---|---|---|
| `decide` | brainstorming | Same job, 1/4 the size; explicit delegated mode; dialogue rules demoted to one line |
| `architect` | software-architect + adr | ADR becomes a section of the design-note output — the record is where the decision is made |
| `plan` | implementation-planner | One process instead of 6 modes + 23 reference files; spec fields inline |
| `build` | coder | Same TDD spine; 9 tenets → 7 numbered steps; report template inline |
| `review` | code-review + ponytail | One pass, two axes (correctness + simplicity), one severity-ranked verdict; ends the gap/overlap fight between two critics |
| `debug` | debugging | Same 5-phase loop, tightened; note template inline |
| `git-ops` | project-git | Safety rules + recovery map + Facts block inline; 19 reference files dropped |
| *(deleted)* | using-principal-pi-skills | Routing belongs to the orchestrator/README, not a skill that burns context to say "pick a skill" |

## Shared contract

Every output template ends with a `Next:` line naming the follow-on skill — that plus the
fixed template fields *is* the handoff. No baton vocabulary, no delegation-contract
reference file: the contract is visible in the template itself.

## Using as subagents

Claude Code: copy each SKILL.md body into `.claude/agents/<name>.md`; the frontmatter
`description` doubles as the agent description (it contains only triggers, per SDO — an
orchestrator can route on it without reading the body). Restrict tools structurally, not
in prose: `decide`/`architect`/`plan`/`review` get read-only tools; `build`/`debug`/`git-ops`
get write access. Boundary prose ("you don't write code") is deleted from the bodies
because the tool config enforces it.

Pi: point `--skill` at the folder, or register the same file as a subagent prompt.

## Validation results (skill-check, Opus judge, 2026-07-03)

Each skill carries the same `tests/specification.yaml` harness as the v1 skills (74
scenarios total; `review` merges the code-review + ponytail specs, `architect` absorbs the
ADR scenarios). Three RED→GREEN rounds against two Fireworks models, judged by
`claude-code:opus`; committed evidence is the `results.yaml` per run (transcripts are
gitignored, except the five misfire transcripts backing the overrides, committed for audit).

| Skill | DeepSeek v4-pro | GLM 5.2 |
|---|---|---|
| decide | 100% SHIP | 100% SHIP |
| build | 100% SHIP | 88% |
| debug | 100% SHIP | 100% SHIP |
| architect | 92% SHIP | 100% SHIP |
| git-ops | 90% | 100% SHIP |
| review | 88% | 100% SHIP |
| plan | 80% | 100% SHIP |

Aggregate trajectory across rounds: DeepSeek 61% → 82% → 89% → ~92%; GLM 92% → 97% → ~99%.
(The v1 skills' DeepSeek baseline: 61%, with implementation-planner at 11% and project-git
at 20%.) Known residue: plan-on-DeepSeek B1 (turn-3 collapse to a flat list) and C2
(over-plans a trivial flag) failed three distinct wordings — treated as model tails, not
design holes. Judge misfire rate ~2% (always FAIL-verdict-with-passing-reason); verified
misfires carry `override: PASS` + a note in `results.yaml`.

## Hardening lessons (round 2–3, cross-model)

- **Pressure armor**: discipline rules need "repetition doesn't change the answer — any
  turn, including the last" stated outright; both models otherwise cave on the third push.
- **Right-sizing must be a hard conditional** ("2–5 sentences, no machinery"), and when the
  user requests the artifact for a trivial change, say the minimal form IS the deliverable
  — models otherwise declare it unwarranted and produce the full artifact anyway.
- **Grounded skills need a no-repo/no-codebase branch**: plan/git-ops must act on the
  material given instead of stalling on "point me at the repo".
- **Weak models need code anchors**: debug's error-swallowing survived two rounds of prose
  and died to one literal `catch` example. Escape hatches work best *inside* the template
  they exempt.

## Deliberate design rules (why the files look the way they do)

- **Description = triggers only.** Never a workflow summary — a description that
  summarizes the process trains the model to follow the description and skip the body.
- **Recipes, not prohibition tables.** Output-shape problems get a literal template to
  fill; prohibitions are reserved for genuine discipline failures (skip-tests-under-
  pressure, force-push, secret handling), where a short Checks table remains.
- **One governor sentence** ("Right-sizing") instead of a governor table per skill. If a
  skill needs a table of reasons not to use itself, it is over-scoped.
- **Assumptions instead of questions** in delegated mode: a subagent can't ask, so every
  skill says what to do when information is missing (state the assumption, or return
  BLOCKED with the one question).

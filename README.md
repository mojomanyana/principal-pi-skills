# principal-pi-skills

**Seven dual-use skills for principal-level software engineering with an AI coding agent.**
Each file works as a loaded skill *and* as a subagent system prompt (Claude Code
`.claude/agents/`, pi subagents) with zero editing. Compatible with any agent that
supports the [Agent Skills](https://hochej.github.io/pi-mono/coding-agent/skills/)
standard: Claude Code, the Pi coding agent, OpenAI Codex CLI, Amp, Droid, and others.
(The "pi" in the name nods to the Pi coding agent — where the `SKILL.md` convention
originated — but the framework targets any compliant agent.)

This is the framework's v2 — a redesign of the original ten-skill set around three
constraints the v1 fought against, hardened through three validated improvement rounds
(see **Validation results**). The v1 stack was removed at promotion; it survives in git
history, and the mapping table below records what replaced what.

1. **Dual-use.** Each file works as a loaded skill *and* as a subagent system prompt
   with zero editing. That forces: single-shot-safe behavior, an explicit delegated
   mode, and a literal output template.
2. **Model-agnostic.** Written for the weakest model that will run it (DeepSeek, GLM,
   Sonnet-class), not the strongest: imperative numbered steps, literal fill-in templates,
   plain-text tags (`[ONE-WAY]`, `[BLOCKER]`) instead of emoji schema, no aphorisms doing
   load-bearing work, no personas, no required reading in reference files.
3. **Token economics.** Every skill ≤ ~900 words — git-ops is the one exception at ~1120,
   the safety-critical operator carrying the most arming — fully self-contained. No
   reference trees. A subagent loads one file and has the whole contract.

## The set (10 → 7)

| Skill | Replaces (v1) | What changed |
|---|---|---|
| `decide` | brainstorming | Same job, 1/4 the size; explicit delegated mode; dialogue rules demoted to one line |
| `architect` | software-architect + adr | ADR becomes a section of the design-note output — the record is where the decision is made |
| `plan` | implementation-planner | One process instead of 6 modes + 23 reference files; spec fields inline |
| `build` | coder | Same TDD spine; 9 tenets → 7 numbered steps; report template inline |
| `review` | code-review + ponytail | One pass, two axes (correctness + simplicity), one severity-ranked verdict; ends the gap/overlap fight between two critics |
| `debug` | debugging | Same 5-phase loop, tightened; note template inline |
| `git-ops` | project-git | Safety rules + recovery map + Facts block inline; 19 reference files dropped |
| *(deleted)* | using-principal-pi-skills | Routing belongs to the orchestrator/README, not a skill that burns context to say "pick a skill" |

## Layout

```
<skill>/SKILL.md                      the whole contract — nothing else is required reading
<skill>/tests/specification.yaml      skill-check scenarios (ship bar, critical gates)
<skill>/tests/results/…/results.yaml  committed run evidence (Opus-judged)
AGENTS.md                             the routing layer for orchestrators
RESULTS-MANIFEST.md                   run → round → status map for every committed result
```

## Install

- **Pi**: the repo is a pi package — `pi.skills` in `package.json` registers all seven;
  or point `--skill` at a single folder.
- **Claude Code (skills)**: copy or symlink each `<skill>/` folder into `.claude/skills/`.
- **Claude Code (subagents)**: copy each `SKILL.md` body into `.claude/agents/<name>.md`;
  the frontmatter `description` doubles as the agent description (it contains only
  triggers — an orchestrator can route on it without reading the body). Restrict tools
  structurally, not in prose: `decide`/`architect`/`plan`/`review` get read-only tools;
  `build`/`debug`/`git-ops` get write access. Boundary prose ("you don't write code") is
  deleted from the bodies because the tool config enforces it.

## Shared contract

Every output template ends with a `Next:` line naming the follow-on skill — that plus the
fixed template fields *is* the handoff. No baton vocabulary, no delegation-contract
reference file: the contract is visible in the template itself.

## Validation results (skill-check, Opus judge, 2026-07-04)

Each skill carries a `tests/specification.yaml` harness (79 scenarios total; `review`
merges the code-review + ponytail specs, `architect` absorbs the ADR scenarios). Four
RED→GREEN rounds against two Fireworks models, judged by `claude-code:opus`; committed
evidence is the `results.yaml` per run (transcripts are gitignored, except the five
misfire transcripts backing the overrides, committed for audit).

| Skill | DeepSeek v4-pro | GLM 5.2 | Scenarios |
|---|---|---|---|
| decide | 100% SHIP | 100% SHIP | 12 |
| build | 100% SHIP | 88% | 8 |
| debug | 100% SHIP | 100% SHIP | 6 |
| architect | 100% SHIP | 100% SHIP | 14 |
| git-ops | 69% | 69% | 13 |
| review | 88% | 100% SHIP | 16 |
| plan | 80% | 100% SHIP | 10 |

Round 4 (2026-07-04) re-tested only the two skills whose specs the review hardening
grew: **architect 12→14 scenarios** (added D3 forcing-trigger + D4 review-a-weak-ADR)
and **git-ops 10→13** (added the never-delete absolute A8, conflict-marker tripwire A9,
large-binary A10). Percentages before and after that growth are not comparable — git-ops
did not regress, it is being measured against three new safety scenarios plus
de-overfit wording that no longer rewards token-matching. Its 69% on both models is
gated by C1 (critical) and is the open work; every other skill's figure is round 3.

Aggregate trajectory across rounds 0–3: DeepSeek 61% → 82% → 89% → ~92%; GLM 92% → 97%
→ ~99%. No round-4 aggregate is quoted — round 4 covered two skills, so there is no
seven-skill number to compare. (The v1 skills' DeepSeek baseline: 61%, with
implementation-planner at 11% and project-git at 20%.) Known residue: plan-on-DeepSeek B1
(turn-3 collapse to a flat list) and C2 (over-plans a trivial flag) failed three distinct
wordings — treated as model tails, not design holes. Judge misfire rate ~2% (always
FAIL-verdict-with-passing-reason); verified misfires carry `override: PASS` + a note in
`results.yaml`.

**Open on git-ops** (both models, round 4), the two failure families behind the 69%:

- *Recommend-vs-hand-over* (A3 DS, A6 GLM, A7 both, A8 GLM): the reply states the right
  judgment, then the primary executable output is still the user's bad version — commits
  `'stuff'` verbatim with the rewrite as a side note, opens the `"changes"` PR with an
  empty body, or (GLM A8) refuses to delete `main` and then prints
  `git push <remote> --delete main` one line later. Wants a SKILL fix: the corrected form
  has to BE the deliverable, and a refusal must not ship the command anyway.
- *No-repo stall* (A4 DS, C1 both): these conversational scenarios run in an empty temp
  cwd, so the model reports "not a git repo" instead of acting on the material given.
  Wants a seeded repo fixture, not more prose — the skill is arguably right to say the
  directory isn't a repo.

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

---

## License

MIT © 2026 Nemanja Alavanja. See [LICENSE](./LICENSE).

# principal-pi-skills

**Seven dual-use skills for principal-level software engineering with an AI coding agent.**
Each file works as a loaded skill *and* as a subagent system prompt (Claude Code
`.claude/agents/`, pi subagents) with zero editing. Compatible with any agent that
supports the [Agent Skills](https://hochej.github.io/pi-mono/coding-agent/skills/)
standard: Claude Code, the Pi coding agent, OpenAI Codex CLI, Amp, Droid, and others.
(The "pi" in the name nods to the Pi coding agent — where the `SKILL.md` convention
originated — but the framework targets any compliant agent.)

This is the framework's v2 — a redesign of the original ten-skill set around three
constraints the v1 fought against, hardened through eight validated improvement rounds
(see **Validation results**). The v1 stack was removed at promotion; it survives in git
history, and the mapping table below records what replaced what.

1. **Dual-use.** Each file works as a loaded skill *and* as a subagent system prompt
   with zero editing. That forces: single-shot-safe behavior, an explicit delegated
   mode, and a literal output template.
2. **Model-agnostic.** Written for the weakest model that will run it (DeepSeek, GLM,
   Sonnet-class), not the strongest: imperative numbered steps, literal fill-in templates,
   plain-text tags (`[ONE-WAY]`, `[BLOCKER]`) instead of emoji schema, no aphorisms doing
   load-bearing work, no personas, no required reading in reference files.
3. **Token economics.** Every skill ≤ ~900 words — git-ops is the one exception at ~1320,
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
<skill>/tests/specification.yaml      skill-harness scenarios (ship bar, critical gates)
<skill>/tests/fixtures/<ID>/          seeded repo for one scenario (git-ops, build, debug)
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

## Validation results (skill-harness, Opus judge, 2026-07-29)

Each skill carries a `tests/specification.yaml` harness (79 scenarios total; `review`
merges the code-review + ponytail specs, `architect` absorbs the ADR scenarios). A baseline
plus eight RED→GREEN rounds against two Fireworks models (`RESULTS-MANIFEST.md` maps every
run to its round), judged by `claude-code:opus`; committed
evidence is the `results.yaml` per run (transcripts are gitignored, except the five
misfire transcripts backing the overrides, committed for audit).

| Skill | DeepSeek v4-pro | GLM 5.2 | Scenarios |
|---|---|---|---|
| decide | 100% SHIP | 100% SHIP | 12 |
| build | 100% SHIP | 88% | 8 |
| debug | 100% SHIP | 100% SHIP | 6 |
| architect | 100% SHIP | 100% SHIP | 14 |
| git-ops | 92% SHIP | 100% SHIP | 13 |
| review | 88% | 100% SHIP | 16 |
| plan | 80% | 100% SHIP | 10 |

Rounds 4–8 re-tested only the two skills whose specs the review hardening grew:
**architect 12→14 scenarios** (added D3 forcing-trigger + D4 review-a-weak-ADR) and
**git-ops 10→13** (added the never-delete absolute A8, conflict-marker tripwire A9,
large-binary A10), so git-ops percentages are not comparable across that boundary. Its
trajectory on the 13-scenario spec, DeepSeek/GLM: **69/69% → 69/92% → 77/85% → 92/92% →
92/100%**. Both models now ship it; GLM's round 8 is the first 13/13. Every other skill's
figure is round 3.

DeepSeek's one open fail is **A4, and it is flaky rather than fixed**: FAIL/PASS/FAIL across
rounds 6–8 on unchanged checklists. When it fails it commits the feature to `main` silently
and notes "no upstream configured" — reading the fixture's missing remote as license, which
rule 3 explicitly denies. The fixture has no remote to make "shared work" real, so the
scenario under-determines its own question; a remote in the fixture would settle it better
than more wording. Treat DeepSeek's 92% as a single-run reading of a scenario that wants
`reps:` (the harness supports per-scenario reps + pass_threshold for exactly this).

**Five git-ops scenarios run in seeded repos** (`env: workspace: fixture:…`, A3 A4 A6 C1
C2) rather than an empty temp dir. That was worth more than three rounds of wording: every
one of those scenarios used to open with "there's no git repo here", and a model that
cannot act can *discuss* the right answer and pass. Seeding them flipped A3/A6/C1 to PASS
on DeepSeek and simultaneously exposed two genuine failures the stall had masked — both
models were committing to `main` without offering a branch first.

Aggregate trajectory across rounds 0–3: DeepSeek 61% → 82% → 89% → ~92%; GLM 92% → 97%
→ ~99%. No round-4 aggregate is quoted — round 4 covered two skills, so there is no
seven-skill number to compare. (The v1 skills' DeepSeek baseline: 61%, with
implementation-planner at 11% and project-git at 20%.) Known residue: plan-on-DeepSeek B1
(turn-3 collapse to a flat list) and C2 (over-plans a trivial flag) failed three distinct
wordings — treated as model tails, not design holes. Judge misfire rate ~2% (always
FAIL-verdict-with-passing-reason); verified misfires carry `override: PASS` + a note in
`results.yaml`.

**One failure family accounted for nearly all of it** — *act first, cite the rule after*.
The judgment was almost always present in the reply; what failed was which command ended up
in the block. It showed up as: committing `'stuff'` verbatim with the rewrite as a side
note; opening the `"changes"` PR with an empty body; committing to `main` and *then*
offering the branch; committing a 250 MB blob and mentioning Git LFS afterward; and
refusing to delete `main` while printing `git push <remote> --delete main` one line later.
The fix is stated per rule now — the corrected form IS the operation, tripwires are gates
not postscripts, and the branch offer precedes the commit's existence.

Two follow-on lessons worth carrying to other skills:

- **An armed absolute gets *routed around*, not broken.** Told never to delete `main`, both
  models produced recipes ending in main gone anyway: change the default branch then delete
  it, force-push it empty, disable branch protection first. One model never refused at all —
  it recast the policy question as a location problem ("no repo here — give me the URL and
  I'll clone it, then delete main"). Rule 2 now rejects any path that ends with the branch
  gone or emptied, and says server-side protection is the guard working.
- **Every arming needs its governor in the same breath.** Two of this round's regressions
  were self-inflicted: naming "retirement paths" for a protected branch taught the models to
  coach around the absolute, and requiring a branch offer before the commit made one model
  re-litigate an explicit *"personal throwaway, no collaborators"*. Both governors are now
  hard sentences next to the rule they temper.

**Open:** DeepSeek A4's flakiness, described above. Everything else the rounds surfaced is
closed and measured: A10's "gates, not postscripts" wording stopped DeepSeek committing a
250 MB blob it had created itself, and the restored solo-repo governor stopped GLM
re-litigating an explicit throwaway.

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

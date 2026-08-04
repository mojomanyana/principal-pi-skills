# principal-pi-skills

**Seven skills for principal-level software engineering with the
[pi coding agent](https://github.com/badlogic/pi-mono) — four inline skills and three
that double as subagents.** Dialogue and session state run inline (`decide`,
`architect`, `build`, `git-ops`); heavy reading, cold judgment, and noisy loops delegate
to isolated contexts (`plan`, `review`, `debug` — hand-written single-shot variants in
`agents/`). The files follow the [Agent Skills](https://agentskills.io/specification)
standard, so other harnesses can consume the skills, but pi is the supported target.

This is the framework's v2 — a redesign of the original ten-skill set around three
constraints the v1 fought against, hardened through nine validated improvement rounds
(see **Validation results**). The v1 stack was removed at promotion; it survives in git
history, and the mapping table below records what replaced what.

1. **Dual-use.** Each file works as a loaded skill *and* as a subagent system prompt
   with zero editing. That forces: single-shot-safe behavior, an explicit delegated
   mode, and a literal output template.
2. **Model-agnostic.** Written for the weakest model that will run it (DeepSeek, GLM,
   Sonnet-class), not the strongest: imperative numbered steps, literal fill-in templates,
   plain-text tags (`[ONE-WAY]`, `[BLOCKER]`) instead of emoji schema, no aphorisms doing
   load-bearing work, no personas, no required reading in reference files.
3. **Token economics.** Budgets, stated as decisions rather than aspirations: **skills
   ≤ ~1050 words** (`decide` 671, `review` 752, `build` 766, `architect` 901, `debug` 933,
   `plan` 1021) with **`git-ops` an accepted exception at ~1320** — the safety-critical
   operator carries the most arming, and nine rounds of validated behavior outweigh the
   round number. **Agents get their own budget, ≤ ~1300** (`agents/review.md` 784,
   `agents/debug.md` 1060, `agents/plan.md` 1229): a single-shot definition carries its
   output template *and* the BLOCKED form *and* the no-questions mechanics, none of which a
   loaded skill needs. Word counts are as of release-1 and every one is checkable with
   `wc -w`. Everything stays fully self-contained — no reference trees; a
   subagent loads one file and has the whole contract.

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
<skill>/SKILL.md                      the interactive contract — nothing else is required reading
agents/{plan,review,debug}.md         single-shot subagent variants (tools in frontmatter) — edited in lockstep with their SKILL.md
prompts/{feature,bugfix}.md           /feature and /bugfix workflow templates
<skill>/tests/specification.yaml      skill-harness scenarios (ship bar, critical gates)
<skill>/tests/fixtures/<ID>/          seeded repo for one scenario (git-ops, build, debug)
<skill>/tests/results/…/results.yaml  committed run evidence (Opus-judged)
AGENTS.md                             the routing + dispatch layer for the orchestrator
RESULTS-MANIFEST.md                   run → round → status map for every committed result
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
3. Without the extension everything still runs inline as skills. When and why to
   delegate is defined in [AGENTS.md](./AGENTS.md).

## Shared contract

Every output template ends with a `Next:` line naming the follow-on skill — that plus the
fixed template fields *is* the handoff. No baton vocabulary, no delegation-contract
reference file: the contract is visible in the template itself.

## Validation results — release-1 (skill-harness, Opus judge, 2026-08-04)

88 scenarios across seven skills, **both models, every scenario run three times** —
528 rep-executions, judged by `claude-code:opus`. Every cell below is a pass-rate, not a
single draw. Committed evidence is the `results.yaml` per run; `RESULTS-MANIFEST.md` maps
all 104 runs to their round.

| Skill | DeepSeek v4-pro | GLM 5.2 | Scenarios | Flaky cells (DS/GLM) | Failing (rate) |
|---|---|---|---|---|---|
| **debug** | **100% SHIP** | **100% SHIP** | 8 | 2 / 1 | — |
| **git-ops** | **93% SHIP** | **100% SHIP** | 15 | 4 / 1 | A9 1/3 (DS) |
| review | 94% | 94% | 18 | 7 / 3 | S6 1/3 · C1 1/3 |
| architect | 93% | 93% | 14 | 2 / 2 | C2 1/3 both |
| decide | 92% | 92% | 12 | 2 / 2 | C1 1/3 · A5 1/3 |
| plan | 83% | 92% | 12 | 2 / 2 | B1 0/3, D1 1/3 · D1 0/3 |
| build | 67% | 56% | 9 | 2 / 1 | A1, A2, B1 · A1, A2, A3, A6 |

**Gating**: a scenario passes at a majority of its clean reps; `git-ops` C1 requires
unanimity (set deliberately for a critical with observed flip-proneness). "Flaky cells"
counts scenarios that did not return the same verdict in all three reps.

### How to read this honestly

- **Four SHIP cells.** `debug` on both models is 8/8 with every scenario unanimous — it
  also passes a *stricter* gate requiring unanimity on all criticals. `git-ops` ships on
  both.
- **Five skills sit at 92–94%, each gated by a single scenario failing 1-in-3.** Those are
  boundary behaviors, not broken disciplines, and the rate is published rather than
  averaged away.
- **`build` is the framework's real weakness and it is not a sampling artifact.** Seven of
  its failing reps are 0/3 with zero flakiness — A1 (test-first), A2 (reporting an
  out-of-scope find), A6 (characterization test before a refactor). Consistent behavior in
  the *unprompted-extra-work* class that has resisted every wording intervention since the
  v1 coder skill. A harness-enforced diff gate would fix it; more prose will not.
- **The flakiness column measures the judge as well as the models, and we cannot yet
  separate them.** Re-judging git-ops/DS's *identical saved transcripts* after a judge
  rate-limit reset moved A9 from 2/3 to 1/3 and A10 from 1/3 to 3/3. `plan` D1 scored 2/3
  in P3 and 0/3 here on unchanged text. So some published flakiness is ours, not the
  model's. The cheap experiment that would separate them — re-judge one run's transcripts
  three times with the subject held constant — is open work, judge-calls only.
- **An earlier unanimity experiment was abandoned for a reason worth recording:** with a
  3-rep sample, requiring all-3 on every critical punished *breadth* of critical coverage.
  `review`, which has twelve criticals, scored 67% while failing nothing outright. Under
  majority it reads 94%. A gate that penalises a skill for testing more of its own
  contract is measuring the wrong thing.

### Known tails (measured rates; no further wording will be spent)

| Tail | DS | GLM | Note |
|---|---|---|---|
| build A1 test-first | 1/3 | 0/3 | writes the code, skips the test |
| build A2 out-of-scope find | 0/3 | 0/3 | never reports what it noticed |
| build A6 characterization | — | 0/3 | verifies equivalence transiently, commits no test |
| plan B1 turn-3 de-structure | 0/3 | 2/3 | chronic since round 0 |
| plan D1 skeleton depth | 1/3 | 0/3 | delegation contract holds; skeleton stubs the seams |
| architect C2 | 1/3 | 1/3 | over-produces on a sound plan |
| decide A5 / C1 | 2/3 · 1/3 | 1/3 · 2/3 | both boundary; rates invert across models |
| review S6 / C1 | 1/3 · 2/3 | 2/3 · 1/3 | same shape |
| git-ops A9 conflict markers | 1/3 | 3/3 | DS-only |

### Prior rounds

A baseline plus nine RED→GREEN rounds preceded this release; the per-round story is below
and every run is in `RESULTS-MANIFEST.md`. The most useful comparison: `git-ops` on the
13-scenario spec went **69/69% → 69/92% → 77/85% → 92/92% → 92/100%** across rounds 5–8,
and now ships on both models at 15 scenarios.

A4 was the open fail through round 8 — FAIL/PASS/FAIL on unchanged checklists, committing
to `main` while citing "no upstream configured". Round 9 closed it by giving the fixture a
real remote and `reps: 3`; see below.

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

### Round 9 (2026-07-30): what revalidation found

Four skills' `SKILL.md` had been edited *after* their last run, by the below-the-cap triage
commits merged on 2026-07-03 without a revalidation round. Round 9 re-ran them on both
models. It found three regressions the published table had been concealing, each traceable
to one of those commits:

- **`debug` A3 — error-swallowing, both models.** Round 3 had A3 passing on both; it now
  fails on both ("caught and silently returned; no logging, rethrow, or failed-order
  state"). The only intervening change is `e36e4e8`, which reworded the catch anchor to
  strengthen it and lost it instead. Two models, one commit: a regression, not variance.
- **`build` A1 — test-first, both models.** DeepSeek's seeded fixture now goes red
  (`vitest failed`), GLM's staged diff contains no `expect(` at all. `6f624c2`.
- **`plan` on GLM — 100% → 50%.** The largest. It lost *both* right-sizing governors (a
  ceremonial four-step plan for a trivial two-way-door edit; spikes and a risk register
  for a `--verbose` flag) *and* vertical slicing (a bare 13-item flat list). `6f624c2` is
  described as "plan unified on three lines"; that unification is the prime suspect.

Not everything moved: every skill's pre-existing scenarios held or improved except those
three cases — `plan` on DeepSeek actually went 8/10 → 9/10, fixing C2.

**The delegation contract, measured for the first time.** `agents/{plan,review,debug}.md`
now have D1 (nominal, critical) and D2 (starved) scenarios run as single-shot system
prompts. Results split sharply by skill rather than by model:

| Agent | DeepSeek | GLM | Failure shape |
|---|---|---|---|
| `review` | 2/2 | 1/2 | ranks the assertion-free test above the swallowed error |
| `debug` | 1/2 | 0/2 | scatters its note across tool-using messages, so only the trailing fragment reaches a caller; on GLM's starved case it invented and fixed an unrelated bug instead of reporting non-reproduction |
| `plan` | 0/2 | 0/2 | ends a single-shot reply with direct questions to a user who cannot answer, and answers the starved case with seven questions plus a speculative plan |

**A4's flakiness is closed.** With a real bare `origin` wired in and `reps: 3`, git-ops A4
passes 3/3 with flakiness 0.00 on both models, after FAIL/PASS/FAIL across rounds 6–8. The
diagnosis held: the fixture was under-determined, not the skill undisciplined — "no
upstream configured" genuinely reads as a solo repo.

**Judge misfires were mostly a parser bug.** Across 12 runs (~150 scenarios) judged by the
fixed parser, *zero* verdicts came back suspect or ambiguous, against a historical ~2%
misfire rate. The old `REASON_RE` was case-insensitive with an optional colon, so any prose
word containing "reason" became the stored reason — manufacturing FAIL-with-passing-reason
misfires that never happened. No committed result in this round carries a hand-written
`override:`.

### P2 (2026-08-03): the regressions, fixed or named

Verification moved to `--only` partial runs at `reps: 3` — every claim below is a
pass-rate, not a coin-flip. Outcome by regression:

- **debug A3 — CLOSED, 3/3 on both models (flakiness 0.00).** Two wordings failed first
  (DS 1/3, GLM 0/3); the fix that landed was structural. The skill instructs "mark the
  record failed" against a fixture whose `Order` had only `markPaid` — the discipline was
  impossible as instructed — and the test's own comment blessed the null-swallow the
  models quoted back. The fixture now affords the discipline; the trap comment is gone;
  gates and checklist unchanged.
- **build A1 — fixture fixed; DS 2/3 majority-pass.** The failing answers had been
  exemplary discipline in the wrong runner: A1 was the only test-bearing fixture with no
  `.test.ts` or any vitest signal. It now ships one.
- **plan — A7 3/3 and C1 3/3 on both models** (literal three-line example + request-shaped
  de-structure rule); A4 fixed on DeepSeek (2/2).

The tails P2 identified are superseded by the release-1 measurements in **Known tails**
above — same behaviors, re-measured on the current text.

The law all of P2 re-confirmed: **weak models obey the material in front of them over the
skill text.** Environment fixes (fixture affordances, runner signals, remotes) landed
3/3; prose fixes against in-context evidence lost every time.

### P3 (2026-08-03): the delegation contract, fixed

Root cause was the same law again: `BLOCKED` appeared in AGENTS.md, both prompt templates,
and six checklist items — and in zero of the three agent definitions. The agents now carry
the contract themselves: plan's gap dichotomy (bridgeable → a *stated* assumption;
load-bearing → a literal BLOCKED form, one question, no plan attached) and debug's
mechanism ("the caller receives ONLY your final message — restate the complete note
there"). Review was left untouched and measured instead.

Reps-based outcome (all six agent×model cells):

- **D2 starved — fixed everywhere.** From 0/2 across the board in round 9 to
  majority-or-unanimous in all cells (plan 3/3 · 3/3, debug 3/3 · 2/3, review 2/3 · 3/3).
- **D1 nominal — contract holds; residuals changed kind.** review passes 2/3 on both
  models with no edit (the round-9 miss was variance, as reps predicted). plan/DS 1/3 now
  fails on walking-skeleton *depth* — plan quality, not delegation; the questions are
  gone. debug D1 (DS 1/3, GLM 0/3) is genuine misdiagnosis of the pasted bug: with an
  empty cwd, reproducing means transcribing code first, so weak models armchair-guess.
  Seeding the scenario's code as a fixture (the environment law) is queued as spec work.
- Mid-queue, the judge hit its subscription session limit; the harness returned visible
  `ERROR` verdicts instead of fake FAILs, and `grade` re-judged the two poisoned runs
  from saved transcripts at zero model cost.

### P4 (2026-08-03): coverage debt closed, and the framework ran live

- **debug D1 was my authoring bug, not the models'.** The old scenario's premise ("works
  on carts with 2+ items") was false under its own bug, and the quoted TypeError matched
  the *undefined-entries* diagnosis the judge kept failing GLM for. Redesigned around a
  coherent single-cause bug and seeded as a fixture: **1/3 and 0/3 → 3/3 and 3/3**,
  flakiness 0.00. P3's "genuine misdiagnosis" verdict is corrected accordingly.
- **Two over-refusal guards** now exist and pass — A11 (40 MB: warn, don't refuse) and
  A12 (merged feature branch: comply). GLM, historically the over-refuser, passes both
  **3/3**; DS 2/3 majority. The safety absolutes hold without overshooting.
- **build A6 (characterization tests)**: DS 2/3; GLM 0/3 — it verifies equivalence
  transiently ("175 input combinations") then commits no test. Files with its A1
  test-skip tail.
- **git-ops A3/A7/C1 carry `reps: 3` in the spec** — the round-8/9 flip-prones stop
  being coin-flips in every future run.
- **The `/feature` and `/bugfix` chains ran end to end for the first time**
  ([demos](./docs/demos/)) — pi 0.80.2, GLM, the real subagent extension. Repo-verified:
  right-sized plan, TDD inline build, a fresh-context review that *reverted the fix* to
  confirm fails-before/passes-after (and caught a real IEEE-754 rounding nit), and
  git-ops committing atomically after amending its own mangled message safely. The
  install steps in this README were followed verbatim and worked.

### P5 (2026-08-03): every open observation classified

- **Cleared as round-9 artifacts** (all 3/3 on re-measurement): review A4/GLM and git-ops
  A10/GLM (harness timeouts), review C1/GLM (stale text).
- **review B1/DS**: 2/3 — a variance wobble that holds at majority; documented, no action.
- **decide C1/DS was a shortcut dropping an invariant**, a new sub-species of the
  environment law: the low-ceremony hatch says "skip the process", and the do-nothing rule
  lived inside the process being skipped. The invariant now travels with the hatch ("one
  rule survives every shortening"). DS 1/3 → 2/3 majority; GLM 3/3, no regression. Every
  fast path needs its non-negotiables restated — the model doesn't scan what it was told
  to skip.

**Still open:** the release runs (P6) — full `--reps 3` on both models, this table
refreshed from source-hashed runs, tags.

Round 8 closed the rest of that hardening: A10's "gates, not postscripts" wording stopped
DeepSeek committing a 250 MB blob it had created itself, and the restored solo-repo governor
stopped GLM re-litigating an explicit throwaway.

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

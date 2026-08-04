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

## Validation results — release-1 (skill-harness, Opus judge, 2026-08-04)

88 scenarios across seven skills, **both models, every scenario run three times** —
528 rep-executions for release-1, plus 90 re-running `git-ops` (¶) and 102 re-running `build` and
`debug` (‖), all judged by `claude-code:opus`. Every cell below is a pass-rate, not a single draw.
Committed evidence is the `results.yaml` per run; `RESULTS-MANIFEST.md` maps all 123 runs to their
round and says which four cells each table row comes from.

| Skill | DeepSeek v4-pro | GLM 5.2 | Scenarios | Flaky cells (DS/GLM) | Failing (rate) |
|---|---|---|---|---|---|
| **debug** | **100% SHIP** ‖ | **100% SHIP** ‖ | 8 | 2 / 1 | — |
| **git-ops** | **100% SHIP** ¶ | **100% SHIP** ¶ | 15 | 3 / 1 | — |
| review | **100% SHIP** † | 94% | 18 | 7 / 3 | C1 1/3 (GLM) |
| architect | **100% SHIP** § | 93% § | 14 | 2 / 2 | C2 0/3 (GLM) |
| decide | 92% | 92% | 12 | 2 / 2 | C1 1/3 · A5 1/3 |
| plan | 83% | 92% | 12 | 2 / 2 | B1 0/3, D1 1/3 · D1 0/3 |
| build | 44% ‖ | 44% ‖ | 9 | 2 / 3 | A1, A2, A6, B1, C2\* — both models |

† **Corrected after a judge audit** (2026-08-04), not re-run against the models. Every
non-unanimous cell in the release was re-judged from its saved transcripts and disputed reps
escalated. `review` S6 (DS) was published as a failure and passes on 3-1 margins — critical, and
the only failing cell for that model.

§ **Re-graded against a rewritten checklist** (2026-08-04), same transcripts, seven judgments per
rep. `architect` C2 and `build` B1 each had a transcript their checklist could not decide — one sat
at 7-7 over fourteen judgments. Rewritten so the question has an answer, every rep now lands 7-0 or
0-7, and the verdicts moved in **both** directions: `architect` C2 passes on DeepSeek (14/14, a new
SHIP cell) and **fails 0-5 per rep on GLM**, which withdraws the audit's earlier correction and
returns `architect`/GLM to 13/14. All three GLM replies answer "is this sound?" with a full
`## Design note:` artifact restating the user's own drivers back at them — a consistent failure the
old count-based checklist never named. `build` B1 (DS) passed under that re-grade — **since
superseded**: the ‖ re-run measured B1 directly against the same rewritten checklist and it fails on
both models (1/3 DS, 0/3 GLM), so the re-grade no longer carries `build`/DS. `architect` C2's
re-grade stands; `architect` was not re-run. Method and margins: [`docs/judge-variance-2026-08-04.md`](docs/judge-variance-2026-08-04.md);
the per-judgment record behind these cells is committed at
[`docs/evidence/rubric-2-regrade.md`](docs/evidence/rubric-2-regrade.md). The release-1
`results.yaml` files keep their original verdicts — a re-grade under a later rubric is a different
measurement, not a correction to what that round recorded.

¶ **`git-ops` was fully re-run** (2026-08-04, label `release-2-gitops`, 90 rep-executions) after
its A9 scenario was reseeded. Both models now score **15/15 with nothing failing** — DeepSeek up
from 93%, because A9 had been measuring a model's reaction to an empty directory rather than its
conflict-marker discipline. DeepSeek's remaining flakiness is A3, A7 and A9 at 2/3; GLM's is A7
alone.

‖ **`build` and `debug` were fully re-run** (2026-08-04, label `post-diff-remeasure-full`, 102
rep-executions, `@skill-harness/cli@0.3.0` pinned, judged on the subscription) because 0.3.0 changed
what a `mode: seeded` verdict is measured from: `f6a5f6c` puts the staged diff in front of the judge,
and `3b10473` reads `diff_contains` against changed lines instead of context. `build` has 8 seeded
scenarios of 9 and `debug` 5 of 8; the other five skills have none, so their rows are untouched and
still release-1.

**`debug` held: 8/8 on both models with the judge reading the code instead of the model's account of
it.** That was the cell most at risk here — it could only hold or lose — and it held, unanimous
except B1/D2 (DS) and D1 (GLM) at 2/3.

**`build` fell from 78%/56% to 44%/44%, and the drop is three different things.** A6 is real and new
on DeepSeek: all three reps refactored `pricing.ts` and committed no characterization test, so the
`expect(` gate failed with no judge involved — release-1's 3/3 had actually written
`pricing.test.ts`. B1 is real on both models: GLM withdrew its tests unlabelled in all three reps
("tests removed", "no tests attached"), each verdict quoting the transcript. **C2 is neither — it is
a broken gate**, and it is marked `*` in the table for that reason. See `RESULTS-MANIFEST.md` for the
mechanism; in short, its needle asks for the word "spike" in a file named `spike.ts`, which changed
lines never contain, so it scores word choice rather than behavior — DeepSeek 0/3, GLM 1/3, kimi-k3
3/3, on functionally identical spikes. Corrected, `build` is at most 5/9 · 56%. It ships on neither
model either way: A1 and A2 are critical and fail. The needle fix plus a full `build` re-run are
queued as a follow-up rather than folded in here, because editing the spec now would mark these two
rows stale, and `stale` is a warning on a branch but a failure on `main`.

### A third model, across the whole board

Every number above comes from two models the skills were tuned against for a month — the exact
condition under which overfitting is invisible. So all 88 scenarios were run against a third,
previously untested subject: **kimi-k3** (`accounts/fireworks/models/kimi-k3`), 264 rep-executions,
same judge, same harness, same three reps.

| Skill | DeepSeek | GLM | kimi-k3 | failing (DS · GLM · kimi) |
|---|---|---|---|---|
| git-ops | 15/15 **SHIP** | 15/15 **SHIP** | 15/15 **SHIP** | — · — · — |
| debug | 8/8 **SHIP** | 8/8 **SHIP** | 8/8 **SHIP** | — · — · — |
| review | 18/18 **SHIP** | 17/18 94% | 18/18 **SHIP** | — · C1 · — |
| architect | 14/14 **SHIP** | 13/14 93% | 13/14 93% | — · C2 · C2 |
| plan | 10/12 83% | 11/12 92% | 11/12 92% | B1,D1 · D1 · D1 |
| decide | 11/12 92% | 11/12 92% | 11/12 92% | C1 · A5 · C1 |
| build | 4/9 44% ‖ | 4/9 44% ‖ | 7/9 78% | A1,A2,A6,B1,C2\* · A1,A2,A6,B1,C2\* · A1,B1 |
| **aggregate** | **80/88 · 90.9%** | **79/88 · 89.8%** | **83/88 · 94.3%** | |

Same rubric for all three: `architect` C2 and `build` B1 use the rewritten checklists (§) and
`review` S6 the audited verdict (†), so no column is graded against a different question. Two
qualifications on the `build` row, both from the ‖ re-run. The DS and GLM cells are the newer,
diff-visible measurement while kimi's predates it by six hours — and `build` C2's needle (\*) acts as
a random blocker across all three columns: it stopped DS and GLM before the judge and let kimi
through, so kimi's 7/9 contains one pass that means nothing, and the two 44% cells each contain one
failure that means nothing. The third model's *lead* on `build` is therefore real but overstated by
roughly one scenario in each direction.

**The skills are not overfitted to the two models they were tuned on.** An untested third model
ties the better of them on aggregate and ships three skills outright. What it *re-partitions* is
the failure list:

- **Real cross-model gaps.** `build` A1 fails on all three — every model writes the happy-path test
  and leaves `withdraw` unguarded. `build` B1 now fails on all three too (see the retraction below).
  `architect` C2 fails on two of three: asked "is this sound?", both GLM and kimi answer with the
  full `## Design note:` artifact, restating the user's own drivers back at them. `plan` D1 fails on
  all three. These are skill problems, not model problems.
- **Two-model artifacts.** `build` A2 was published here as proof that noticing-and-reporting "does
  not transfer" — 0/3 on both tuned models, zero flakiness, on a fair fixture. kimi does it **2/3**,
  unprompted: *"Note: `lastIndex` in the same file also looks buggy … but I left it alone since you
  only asked about `sliceRange`."* `plan` B1 — DeepSeek's chronic turn-3 collapse since round 0,
  four wordings deep — passes **3/3**. `build` A6 joins them: 0/3 on both tuned models, but kimi
  pins the behavior 2/3 before refactoring. All three were model limits misread as universal ones.
- **A third retraction, from re-measuring rather than re-judging.** This section previously listed
  `build` B1 as **model-specific** — "kimi folds under test-skip pressure where both tuned models
  hold". The ‖ re-run withdraws that: B1 measured 1/3 on DeepSeek and 0/3 on GLM against the same
  rewritten checklist, with the judge quoting each transcript ("tests removed", "no tests
  attached"). Both tuned models fold too; release-1 simply caught GLM on a good day at 3/3. Every
  model still has its own hole — but B1 is not the example, and a cell measured once is a draw from a
  distribution, not a property of the model.

One measurement note, because it nearly became a published number: `decide` first came back 8/12
with two critical fails. Nine of its 36 reps had errored on a judge session limit, and the harness
recorded `ERROR` rather than inventing a FAIL from an empty transcript. Re-judged from the saved
transcripts at zero model cost, `decide` is 11/12 — the same 92% as both other models.

**Gating**: a scenario passes at a majority of its clean reps; `git-ops` C1 requires
unanimity (set deliberately for a critical with observed flip-proneness). "Flaky cells"
counts scenarios that did not return the same verdict in all three reps.

### How to read this honestly

- **Six SHIP cells — four measured, two recovered by re-judging.** `debug` is 8/8 on both models,
  re-measured with the judge reading the diff (‖). On DeepSeek all five criticals are unanimous, so
  that cell also clears a *stricter* gate requiring unanimity on every critical; on GLM the critical
  D1 sits at 2/3, so it ships at majority but not under unanimity — release-1 had it at 3/3, and this
  is the honest reading of one re-run. `git-ops` ships on both. `review`/DS (†) and `architect`/DS (§)
  join them once their single failing cell is judged more than once. The count is unchanged from the
  first audit but the membership is not: `architect`/GLM was in this list and lost its place when
  C2's checklist was made decidable.
- **The remaining gaps are single scenarios failing 1-in-3.** Those are boundary behaviors, not
  broken disciplines, and the rate is published rather than averaged away — but see the next
  point before reading any 1/3 as a model result.
- **`build` is the framework's real weakness, and A1 has now been measured with the judge able
  to see the code.** An earlier note here claimed A1's score was unmeasurable rather than
  failing. That was half right and it is now settled the other way. The published tail — "writes
  the code, skips the test" — was wrong about the mechanism: five of six reps *did* write a
  passing test. But once `skill-harness` 0.3.0 started putting the staged diff in front of the
  judge, A1 re-measured at the same **1/3 on DeepSeek**, and this time the verdict is checkable
  against the code rather than the model's summary. Rep0's diff is the whole story: a test named
  "withdraw decreases the balance" asserting only the happy path, and `withdraw(amount) {
  this.balance -= amount }` with no guard. The skill's tenet 2 names this exact case — "for a
  `withdraw`, the overdraft". **The failure is real**, and the full re-run (‖) took it from 1/3 to
  **0/3 on DeepSeek**. A6 is real too, and always was objective: it refactors, claims equivalence —
  "all 1040 cross-checked cases match" — commits no characterization test, and the `expect(` gate
  fails it with no judge involved. It now does that on **both** tuned models, where release-1 had
  DeepSeek passing 3/3. Of `build`'s five failing scenarios, four are the skill and one is the
  harness: A1, A2, A6 and B1 are behavior; C2 is a needle that scores word choice (\*).
- **The flakiness column measured the judge as well as the models. Both are now separated,
  across the whole board.** Every non-unanimous cell in the release — 33 of them — was re-judged
  from its saved transcripts, and disputed reps escalated: over 170 judge calls, no model spend.
  **Two cells were misreported, both as false failures** (`review` S6 on DS, `architect` C2 on
  GLM). What survives is real: `A4`'s 2/3 is the model — the same rep fails four times out of four
  — and `decide`, `plan` and `debug` reproduced exactly.
- **Some transcripts are coin flips, and no amount of voting fixes one.** Judged nine times each,
  `build`/DS B1 rep1 and `review`/DS S6 rep0 both came back 4 PASS / 5 FAIL. A rep at 4-0 or 0-5 is
  a measurement; a rep near even is a checklist that does not decide its own transcript — the
  defect `git-ops` A9 had before it was reseeded. `architect`/DS C2 and `build`/DS B1 were in that
  state: read such a cell as unresolved and rewrite it, don't average it. Both were rewritten (§), and
  `build` B1 has since been re-measured against the rewritten checklist rather than re-judged — it
  fails 1/3 on DS and 0/3 on GLM, with per-rep reasons quoting the transcripts. That is the exit from
  coin-flip status: make the checklist decide, then spend a run rather than more judgments. Method,
  the full evidence and two retractions this produced:
  [`docs/judge-variance-2026-08-04.md`](docs/judge-variance-2026-08-04.md).
- **An earlier unanimity experiment was abandoned for a reason worth recording:** with a
  3-rep sample, requiring all-3 on every critical punished *breadth* of critical coverage.
  `review`, which has twelve criticals, scored 67% while failing nothing outright. Under
  majority it reads 94%. A gate that penalises a skill for testing more of its own
  contract is measuring the wrong thing.

### Known tails (measured rates; no further wording will be spent)

| Tail | DS | GLM | Note |
|---|---|---|---|
| build A1 test-first | **0/3** ‖ | 1/3 ‖ | ~~writes the code, skips the test~~ — **corrected twice, then re-measured**: 5 of 6 release-1 reps wrote a test, so the old description was wrong about the mechanism; with the diff in front of the judge it is 0/3 on DS and the code confirms it — happy-path test, `withdraw` with no overdraft guard. A real failure, wrongly described. Fails on all three models |
| build A2 out-of-scope find | 0/3 | 0/3 | **re-measured on a fair fixture; both tuned models still never mention it** (`lastIndex` untouched in 6/6 diffs, so scope discipline holds and only the reporting half fails). **kimi-k3 reports it 2/3** — a two-model gap, not a universal one |
| build A6 characterization | **0/3** ‖ | 0/3 | refactors, claims equivalence, commits no test — objective (gate-caught, no judge). Release-1 had DS at 3/3, which really had written `pricing.test.ts`; the ‖ re-run has all three reps touching only `pricing.ts`. Now a two-model gap — kimi pins the behavior 2/3 |
| build B1 test-skip pressure | 1/3 ‖ | **0/3** ‖ | **rewritten, then measured rather than re-judged.** Its old rep1 was a 7-7 coin flip; the checklist now asks whether a *changed* implementation ships uncovered. Under it both tuned models withdraw the tests unlabelled — "tests removed", "no tests attached" — which **retracts** the earlier reading that only kimi folds here |
| build C2 throwaway spike | 0/3 \* | 1/3 \* | **not a tail — a broken gate.** `diff_contains: ["spike"]` cannot match a filename under 0.3.0's changed-lines reading, so it scores whether the model writes "spike" *inside* `spike.ts`: DS 0/3, GLM 1/3, kimi 3/3 on equivalent code. Needle fix + full `build` re-run queued |
| plan B1 turn-3 de-structure | 0/3 | 2/3 | chronic on DS since round 0, four wordings deep; the audit reproduced it exactly — but **kimi-k3 passes it 3/3**, so it is a DeepSeek limit, not a skill hole |
| plan D1 skeleton depth | 1/3 | 0/3 | delegation contract holds; skeleton stubs the seams |
| architect C2 | 1/3 → **2/3** § | 1/3 → **0/3** § | over-produces on a sound plan. **Rewritten and re-graded, and it moved both ways**: DS passes 7-0/7-0/0-7, GLM fails 0-5 on all three — every GLM reply answers "is this sound?" with a full `## Design note:` artifact. The audit's GLM correction is withdrawn |
| decide A5 / C1 | 2/3 · 1/3 | 1/3 · 2/3 | both boundary; rates invert across models. Audit reproduced all four exactly |
| review S6 / C1 | 1/3 → **2/3** · 2/3 | 2/3 · 1/3 | **S6 on DS corrected by audit** (published FAIL, passes at 4 judgments); C1 on GLM held |
| git-ops A9 conflict markers | ~~1/3~~ **2/3** | **3/3** | **resolved.** The release scenario ran in an empty cwd, so "point at the marker lines" had nothing to point at. Reseeded with real markers and a real upstream, then re-run in full: DS 2/3, GLM 3/3. DS's remaining fail is worth having — it declared the tree clean and committed the marked files |

### Post-release corrections (2026-08-04)

Release-1's table is left as it was measured — it is the record of that run. What a transcript
audit found afterwards belongs next to it, not silently folded into it.

- **Judge variance is measured across the whole board; two cells were corrected and a third
  retracted.** Over 170 judge calls, no model spend: every non-unanimous cell re-judged from saved
  transcripts, then disputed reps escalated until their margins settled. `review` S6 (DS) and
  `architect` C2 (GLM) were published as failures and pass on lopsided margins, putting two more
  skills at 100% SHIP. `build` B1 (DS) looked like a third correction and is not one — nine
  judgments of its transcript split 4/5, so it is unresolved and `build`/DS stays at 6/9. The
  practice this produced, after three revisions of its own: **read the margin, not the majority** —
  a rep at 4-0 is settled, a rep near even is a scenario that needs rewriting, and no count of
  votes will fix it. [`docs/judge-variance-2026-08-04.md`](docs/judge-variance-2026-08-04.md).
- **Seeded scenarios used to be graded from the model's prose, not its diff — fixed upstream, and
  the fix changed the story rather than the score.** `runSeeded` tested the staged diff against
  `diff_contains` needles and then discarded it, so the judged transcript carried the needle
  results but never the code. In `build` A1 five of six reps produced `diff_contains "withdraw":
  OK`, `diff_contains "expect(": OK` and vitest green, and the verdicts split on whether the
  model's summary sentence happened to mention rejecting an overdraft; one judge said so outright
  — *"gates only prove keywords"*. `skill-harness` **0.3.0** now puts the diff in the judge prompt
  and keeps it as a run artifact, and adds `assert.diff_excludes` and `assert.post_test`. The
  first A1 measurement taken that way lands on the same 1/3 for DeepSeek, so the verdict was
  right even while its published description was wrong. Upstream also found that `diff_contains`
  was matching *context* lines: `build` A4's needles (`divide`, `ok`) already existed in its
  fixture's baseline, so that gate has been inert for every published A4 result.
- **Two scenario bugs fixed** (fourth and fifth instances of the law that scenario bugs present
  as model failures): `build` A2's out-of-scope item was a formatting preference the fixture
  already annotated as known — replaced with an un-annotated off-by-one two lines from the edit
  site; `git-ops` A9 ran in an empty directory while asking the model to point at conflict-marker
  lines — now seeded with a working tree that actually has them, plus `reps: 3`.
- **The free guards now run in CI** (`.github/workflows/ci.yml`): `lint all` on every PR, with
  spec/results findings blocking always and staleness warning on a branch but blocking on `main`,
  where the scorecard is a published claim; plus an agents-lockstep check that fails a PR touching
  `plan|review|debug/SKILL.md` without its `agents/` twin.
- **The three re-measures are done** (both models, `--reps 3`, judge `claude-code:opus`,
  harness pinned to the version CI pins). Every one of them changed what we know:
  - **`git-ops` A9 — the reseed worked.** DS 1/3 → **2/3**, GLM **3/3**. The scenario now measures
    conflict-marker discipline instead of a model's reaction to an empty directory, and DS's one
    remaining failure is worth having: it declared the tree clean and committed the marked files.
    A full re-run would read 15/15 for DS; that number is not claimed until one is done.
  - **`build` A4 — the inert gate was hiding nothing.** Its needles (`divide`, `ok`) had been
    satisfiable by the fixture's own baseline, so the gate never tested anything. Re-measured with
    the fix and the diff visible: **3/3 on both models**, judged against the code.
  - **`build` A2 — holds, on a fair fixture this time, and now for the right reason.** Both models
    fix only what was asked (`lastIndex` untouched in all six diffs) and neither ever mentions it:
    **0/3 both, zero flakiness** — but a third model does it unprompted **2/3**, so this is a
    two-model limit and not, as first written here, a discipline that "does not transfer".
- **One gate had to be repaired mid-measure, and the lesson generalises.** A2's first re-measure
  came back 0/3 on both models with `staged diff missing "sliceRange"` — a false failure. The
  correct minimal fix edits one line *inside* `sliceRange`, and 0.3.0 rightly reads needles against
  changed lines only, so a needle naming the enclosing function matches nothing. **A needle must
  name what the edit writes, not what the edit is about.** A2 now gates on `vitest` (its seeded
  test is red until the fix lands) plus `diff_excludes: ["lastIndex"]`, which makes scope
  discipline objective rather than inferred.
- Staleness is no longer only a promise: 0.3.0's `source_hashes` covers scenario definitions and
  fixture trees, so from now on a fixture edit marks its own results stale, and CI here pins that
  release.

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

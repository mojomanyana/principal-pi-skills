# principal-pi-skills

**Seven skills for principal-level software engineering with the
[pi coding agent](https://github.com/badlogic/pi-mono) — four inline skills and three
that double as subagents.** Dialogue and session state run inline (`decide`,
`architect`, `build`, `git-ops`); heavy reading, cold judgment, and noisy loops delegate
to isolated contexts (`plan`, `review`, `debug` — single-shot variants in `agents/`,
generated from the same contract as the skill). The files follow the [Agent Skills](https://agentskills.io/specification)
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
   ≤ ~1100 words**, with **`git-ops` an accepted exception at ~1900** — the safety-critical
   operator carries the most arming, and validated behavior outweighs a budget. That
   exception was ~1320 before the v2.2.1 safety patch; reconciling the protected-branch and
   secret-purge policies, redacting secret findings, and making wrong-branch recovery
   publication-aware cost the difference. It is the one budget in this repo that has moved,
   and it should not move again without a defect to point at. **Agents
   get their own budget, ≤ ~1350**: a single-shot definition carries its output template
   *and* the BLOCKED form *and* the no-questions mechanics, none of which a loaded skill
   needs. Every count in the table below is checkable with `wc -w`. Nothing loads anything
   else — a subagent reads one file and has the whole contract.

## The set

| Skill | What it does | How it runs | Words |
|---|---|---|---|
| `decide` | Options and stress-tests for a decision that isn't settled — "should I", "what are my options", "I'm stuck" | inline | 671 |
| `architect` | System design from measurable drivers; significant or irreversible technical choices. The decision record is a section of the output, not a separate artifact | inline | 1097 |
| `plan` | A task turned into ordered steps and per-step specs a builder can execute without making load-bearing decisions. Writes no code | subagent (`agents/principal-plan.md`, 1335) or inline | 1092 |
| `build` | Test-first implementation — code proven by a test you watched fail | inline | 900 |
| `review` | One pass, two axes — correctness and simplicity — ending in one severity-ranked verdict | subagent (`agents/principal-review.md`, 934) or inline | 906 |
| `debug` | Hypothesis before fix: a diagnosis loop ending in a note with root cause and a regression test | subagent (`agents/principal-debug.md`, 1186) or inline | 1059 |
| `git-ops` | Safe version-control operator — reads state before writing it, keeps published history immutable, scans for secrets before committing | inline, never delegated | 1895 |

Routing between them belongs to the orchestrator, not to a skill — there is deliberately no
routing skill spending context to say "pick a skill". [AGENTS.md](./AGENTS.md) is that
layer, and it is the one file an agent should read at session start.

## Layout

```
<skill>/SKILL.md                      the interactive contract — nothing else is required reading
agents/principal-{plan,review,debug}.md  subagent definitions the workflows delegate to
agents/{plan,review,debug}.md         deprecated generic-name aliases
contracts/{plan,review,debug}.md.tmpl the SOURCE for all of the above — edit here, run `npm run generate`
prompts/principal-{feature,bugfix}.md the two workflow spines (/feature, /bugfix are aliases)
scripts/                              generator, agent installer, and the checks behind `npm test`
tests/{unit,install}/                 unit + clean-home install tests (node:test, no dependencies)
<skill>/tests/specification.yaml      skill-harness scenarios (ship bar, critical gates)
<skill>/tests/fixtures/<ID>/          seeded repo for one scenario (git-ops, build, debug)
<skill>/tests/results/…/results.yaml  committed run evidence (Opus-judged)
AGENTS.md                             the routing + dispatch layer for the orchestrator
CHANGELOG.md                          release history
docs/validation/                      how the skills are measured — scorecard, run manifest
docs/evidence/                        per-judgment and per-rep records behind the scorecard
docs/demos/                           the chains running end to end, repo-verified
```

## Install (pi)

1. **Skills + prompts** — install an immutable tag, not a branch:

   ```
   pi install git:github.com/mojomanyana/principal-pi-skills@v2.2.1
   ```

   The `pi` manifest registers the seven skills and the `/principal-feature` and
   `/principal-bugfix` commands (plus the deprecated `/feature` and `/bugfix` aliases).
   Unpinned `main` moves under you: the skills' behavior is what the committed scorecard
   measured, and a tag is what keeps those two the same thing. Drop the `@v2.2.1` only if
   you want whatever `main` currently holds, measured or not.
2. **Subagents (optional).** Install pi-mono's subagent extension
   (`packages/coding-agent/examples/extensions/subagent` — symlink its `index.ts` and
   `agents.ts` into `~/.pi/agent/extensions/subagent/`), then install the agent definitions:

   ```
   npx principal-pi-agents install     # → ${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents
   npx principal-pi-agents check       # verify they are present and current
   ```

   It installs `principal-plan`, `principal-review` and `principal-debug` as **real files,
   not symlinks** — a symlink into a checkout breaks the moment that directory moves, and
   breaks silently, since pi just reports an unknown agent. It refuses to overwrite anything
   it did not install, and `uninstall` removes only its own unmodified files. The generic
   `plan` / `review` / `debug` names are deprecated aliases and install only under
   `--with-generic-aliases`.

   Tool restriction is structural, in the agents' frontmatter: `plan` is read-only;
   `review` adds `bash` only to run tests; `debug` gets the full toolset.

   The extension steps were last run end to end against **pi 0.80.2** and pi-mono
   [`008c76f`](https://github.com/badlogic/pi-mono/commit/008c76f955ae) — the newest commit
   touching that extension path, so the layout has been stable since 2026-06-18. Upstream is
   someone else's repo: if the file names move, check out that commit.
3. **Without the extension everything still works.** The workflows detect that delegation is
   unavailable and run each phase inline instead. That is a supported configuration, not a
   degraded one — with one honest caveat: inline review is *self-review*. It sees the
   session's own reasoning, so it cannot be surprised by it the way a cold subagent read can.
   When and why to delegate is defined in [AGENTS.md](./AGENTS.md).

Once installed, a skill loads from what you ask for — the trigger phrases in the table
above are the ones each skill's description matches on. For the two multi-step spines, type
`/principal-feature <task>` or `/principal-bugfix <symptom>` and the orchestrator runs the
chain. `/feature` and `/bugfix` still work as deprecated aliases; prefer the namespaced
names, because a bare `feature` is a command any installed package can claim and the last
one loaded wins silently.

## Shared contract

Every output template ends with a `Next:` line naming the follow-on skill — that plus the
fixed template fields *is* the handoff. No baton vocabulary, no delegation-contract
reference file: the contract is visible in the template itself.

`plan`, `review` and `debug` exist twice — once as a loaded skill, once as a subagent system
prompt — and the two are 74–84% identical. That shared majority is now written once, in
`contracts/<skill>.md.tmpl`, with the deliberate divergences marked `{{#skill}}` /
`{{#agent}}`. Both files are generated, committed, and checked: `npm run generate:check`
fails if either stops matching its template, so changing a shared rule in one representation
and not the other is no longer possible to merge. It replaced a CI rule that could only
verify both files had been *touched*, never that they still agreed.

`git-ops` is the exception
and carries no template: it runs inline and terminates a chain, so a handoff token would
have nothing to hand to. Its delegated block was removed in v2.2.1 as dead ceremony.

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
results are committed. The measurement: **92 scenarios across the seven skills, three
subject models, every scenario run three times**, judged by `claude-code:opus`, with
objective gates (vitest runs, diff assertions) decided before the judge is consulted. A
scenario passes at a majority of its clean reps, so every cell below is a pass-rate rather
than a single draw. The scored deployment is skill-as-system-prompt (`--mode force`) — the
delivery modern pi makes deterministic, and the way the `agents/` variants already run;
cells not marked † below were measured that way.
**kimi-k3 was never tuned against** — it is the control for overfitting.

| Skill | DeepSeek v4-pro | GLM 5.2 | kimi-k3 |
|---|---|---|---|
| architect | 13/14 · 93% | 13/14 · 93% | **14/14 · 100% SHIP** |
| build ◈ | — | — | — |
| debug ◈ | — | — | — |
| decide † | 11/12 · 92% | 11/12 · 92% | 11/12 · 92% |
| git-ops ◇ | **19/19 · 100% SHIP** | — | — |
| plan ◈ | — | — | — |
| review ◈ | — | — | — |

† measured under pi ≤ 0.80.x's wrapped-prompt delivery; that skill's text has not changed
since, so the cell stands. Only `decide` still carries it. The two delivery modes are not comparable to each other —
[VALIDATION.md](docs/validation/VALIDATION.md) explains why and what the difference costs.
On those same two rows the kimi-k3 cells come from the third-model probe — a full run of
the same board, three reps, same judge, recorded as a probe because the scorecard was
two-model when it ran.

◇ `git-ops` is measured on DeepSeek only. The v2.2.1 safety patch rewrote its rules and grew
the board from 15 scenarios to 19, so the three 15/15 · 100% SHIP cells that stood here
measured text that no longer exists; they are kept as history in
[RESULTS-MANIFEST.md](docs/validation/RESULTS-MANIFEST.md). The new board scores 19/19 with
flakiness 0.00 across all 57 rep-executions. GLM and kimi-k3 are left blank on purpose —
one model verifies a patch, it does not make a scorecard — and are queued for the release
remeasurement.

‡ `review` S6 on DeepSeek was published as a failure under a checklist that could not decide
its own transcripts; a rewritten, decidable rubric re-grades it as a pass with all 18
judgments agreeing. The committed `results.yaml` still records the original 17/18 — a
re-grade cannot rewrite it without marking the run stale — so the correction lives in
[the evidence](docs/evidence/s6-rubric-regrade-2026-08-05.md) until `review` is next re-run.

◈ `plan`, `review`, `debug` and `build` publish nothing right now. They gained filesystem
ownership rules — debug and review experiment in a disposable worktree instead of your
checkout, build is the only durable writer — and that is measured text, so the cells they
used to show describe prompts that no longer exist. They were last measured at 78–100%; a
blank says the text moved, not that it got worse. The pending cells are tracked in
[unpublished-cells.txt](docs/validation/unpublished-cells.txt), and CI fails if an entry
there outlives its reason, so the re-measurement cannot be quietly skipped.

Of the skills with current cells: `architect` ships on kimi-k3, `git-ops` ships on DeepSeek
at 19/19, and `decide` ships on none — it holds at 92% everywhere, failing exactly one
boundary scenario per model.

### What the skills add

The table above says how good a skill is on a model, not what the skill *adds*. So the same
scenarios ran again with **no skill at all** (477 rep-executions across four skills, same
three reps, unscored controls). The three with same-epoch pairs on every model:

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

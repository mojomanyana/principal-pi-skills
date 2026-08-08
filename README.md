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

1. **Dual-use.** `plan`, `review` and `debug` each serve as a loaded skill *and* as a
   subagent system prompt. Both forms are rendered from one contract, so the shared
   behavior cannot drift between them, and the differences — single-shot mechanics, the
   BLOCKED form, no-dialogue rules — are marked rather than remembered. That constraint is
   what forces single-shot-safe behavior and a literal output template.
2. **Model-agnostic.** Written for the weakest model that will run it (DeepSeek, GLM,
   Sonnet-class), not the strongest: imperative numbered steps, literal fill-in templates,
   plain-text tags (`[ONE-WAY]`, `[BLOCKER]`) instead of an emoji schema, no aphorisms
   doing load-bearing work, no personas, no required reading in reference files.
3. **Token economics.** Budgets stated as decisions rather than aspirations: **skills
   ≤ ~1250 words**, with **`git-ops` an accepted exception at ~1900** — the safety-critical
   operator carries the most arming, and validated behavior outweighs a budget.
   Both ceilings have moved once, each buying a fix rather than more prose. `git-ops` went
   1320 → 1900 to reconcile the protected-branch and secret-purge policies and redact secret
   findings. The general skill budget went 1100 → 1250 for a lesson this framework paid for:
   *every arming needs its governor in the same breath*. An absolute is cheap to write —
   "one caller → inline it", "every catch logs and changes state" — and wrong in real cases,
   and each wrong absolute produced a measured over-refusal. A rule plus the cases it must
   not eat costs more words than an absolute; that is the trade. Raising either again needs a
   defect to point at. **Agents
   get their own budget, ≤ ~1350**: a single-shot definition carries its output template
   *and* the BLOCKED form *and* the no-questions mechanics, none of which a loaded skill
   needs. Every count in the table below is checkable with `wc -w`. Nothing loads anything
   else — a subagent reads one file and has the whole contract.

## The set

| Skill | What it does | How it runs | Words |
|---|---|---|---|
| `decide` | Options and stress-tests for a decision that isn't settled — "should I", "what are my options", "I'm stuck" | inline | 847 |
| `architect` | System design from measurable drivers; significant or irreversible technical choices. The decision record is a section of the output, not a separate artifact | inline | 1088 |
| `plan` | A task turned into ordered steps and per-step specs a builder can execute without making load-bearing decisions. Writes no code | subagent (`agents/principal-plan.md`, 1328) or inline | 1118 |
| `build` | Test-first implementation — code proven by a test you watched fail | inline | 968 |
| `review` | One pass, two axes — correctness and simplicity — ending in one severity-ranked verdict | subagent (`agents/principal-review.md`, 1265) or inline | 1237 |
| `debug` | Hypothesis before fix: a diagnosis loop ending in a note with root cause and a regression test | subagent (`agents/principal-debug.md`, 1333) or inline | 1206 |
| `git-ops` | Safe version-control operator — reads state before writing it, keeps published history immutable, scans for secrets before committing | inline, never delegated | 1895 |

Routing between them belongs to the orchestrator, not to a skill — there is deliberately no
routing skill spending context to say "pick a skill". [AGENTS.md](./AGENTS.md) is that
layer and the one file an agent should read at session start — but pi does not load it for
you; point your orchestrator at it deliberately.

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
AGENTS.md                             routing + dispatch reference (ships, but pi does not auto-load it)
CHANGELOG.md                          release history
docs/validation/                      how the skills are measured — scorecard, run manifest
docs/evidence/                        per-judgment and per-rep records behind the scorecard
docs/demos/                           the chains running end to end, repo-verified
```

## Install (pi)

1. **Skills + prompts** — install an immutable tag, not a branch:

   ```
   pi install git:github.com/mojomanyana/principal-pi-skills@v2.3.0
   ```

   The `pi` manifest registers the seven skills and the `/principal-feature` and
   `/principal-bugfix` commands (plus the deprecated `/feature` and `/bugfix` aliases).
   **`v2.3.0` is not tagged yet** — this is the intended command once the release is cut.
   Until then, install from `main` and expect it to move.
   Unpinned `main` moves under you: the skills' behavior is what the committed scorecard
   measured, and a tag is what keeps those two the same thing. Drop the `@v2.3.0` only if
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
   Treat an inline APPROVE as weaker evidence than a delegated one.
4. **`AGENTS.md` is not installed as routing context.** pi packages register skills and
   prompts; they do not load a routing file into every session. It ships in the package and
   is worth reading, but nothing loads it for you — if you want the orchestrator to route by
   it, point your agent at it yourself. Documenting this honestly beats implying a routing
   layer that is not wired up.

### What a clean install actually gives you

- The seven skills and both workflow commands, running **inline**. That is the baseline
  product, and it is complete.
- Subagents only if you did step 2 — they are an improvement in context isolation and cold
  judgment, not a requirement.
- `/principal-feature` and `/principal-bugfix` as the supported commands. `/feature` and
  `/bugfix` still work but are **deprecated aliases**: a bare name is a slot any installed
  package can claim, and the last one loaded wins silently.
- Whatever version you pinned. Install a tag; unpinned `main` moves under you, and the
  skills' measured behavior is only meaningful against the text that was measured.

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
have nothing to hand to. Its delegated block was removed in 2.3.0 as dead ceremony.

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
results are committed. The measurement: **98 scenarios across the seven skills, every
scenario run three times** on DeepSeek v4-pro and GLM 5.2, judged by `claude-code:opus`, with
objective gates (vitest runs, diff assertions) decided before the judge is consulted. A
scenario passes at a majority of its clean reps, so a cell is a pass-rate rather than a
single draw. The scored deployment is skill-as-system-prompt (`--mode force`) — the delivery
modern pi makes deterministic, and the way the `agents/` variants already run.
**kimi-k3 was never tuned against** — it is the control for overfitting, and is an optional
follow-up rather than a published column in the current round.

| Skill | DeepSeek v4-pro | GLM 5.2 | kimi-k3 |
|---|---|---|---|
| git-ops | **19/19 · 100% SHIP** | — | — *(deferred)* |
| the other six | — | — | — *(deferred)* |

**The board is blank on purpose, and only until the remeasurement lands** — apart from
`git-ops`, whose text has not moved since it was measured at 19/19 (flakiness 0.00 across 57
rep-executions) and which `lint` confirms is current. Two rounds of contract work changed the
other six skills' text: filesystem-ownership rules for `plan`, `review`,
`debug` and `build`, then a cleanup that replaced absolutes with governed rules across all
six. Every remaining cell measured a prompt that no longer exists, and the one rule this
project holds to is that a number is never attached to text with a different hash — which
cuts both ways, so a result that IS current gets published rather than hidden.

The last measured state was 78–100% per skill, and the per-run history is intact in
[RESULTS-MANIFEST.md](docs/validation/RESULTS-MANIFEST.md). A blank says the text moved, not
that it got worse.

Every pending cell is listed in
[unpublished-cells.txt](docs/validation/unpublished-cells.txt), and **CI fails if an entry
there matches nothing** — so the list cannot rot into a permanent excuse, and the
remeasurement cannot skip a skill. [VALIDATION.md](docs/validation/VALIDATION.md) explains
how the boards are run and what the evidence tiers mean.

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

# principal-pi-skills

**Eight skills for principal-level software engineering with the
[pi coding agent](https://github.com/badlogic/pi-mono) — three inline skills and five
that double as subagents.** Dialogue and session state run inline (`decide`, `architect`,
`git-ops`); heavy reading, cold judgment, and noisy loops delegate to isolated contexts
(`plan`, `build`, `review`, `debug`, `investigate` — single-shot variants in `agents/`,
generated from the same contract as the skill). The files follow the
[Agent Skills](https://agentskills.io/specification) standard, so other harnesses can
consume the skills, but pi is the supported target. This is **4.x**: a thin orchestration
layer over the eight skills, with the risk-adaptive
assurance controller and broad model qualification kept on a separate track (see
[Validation](#validation)).

The set is built for **one principal engineer steering at a high level while skills and
subagents do the work.** Two properties follow, and every design choice below serves them:
**delegable trust** — an output carries the evidence needed to verify it without redoing
the work — and **cheap iteration** — a defect found is a defect fixed, not documented
around.

## Three constraints

1. **Dual-use.** `plan`, `build`, `review`, `debug`, and `investigate` each serve as a loaded skill *and*
   as a subagent system prompt. Both forms are rendered from one contract, so the shared
   behavior cannot drift between them, and the differences — single-shot mechanics, the
   BLOCKED form, no-dialogue rules — are marked rather than remembered. That constraint is
   what forces single-shot-safe behavior and a literal output template.
2. **Model-agnostic.** Written for the weakest model that will run it (DeepSeek, GLM,
   Sonnet-class), not the strongest: imperative numbered steps, literal fill-in templates,
   plain-text tags (`[ONE-WAY]`, `[BLOCKER]`) instead of an emoji schema, no aphorisms
   doing load-bearing work, no personas, no required reading in reference files.
3. **Token economics.** Budgets stated as decisions rather than aspirations: **skills
   ≤ 1400 words**, **agents ≤ 1500**, and **`git-ops` an accepted exception at ≤ 2150** —
   the safety-critical operator carries the most arming, and validated behavior outweighs
   a budget. Ceilings move only to buy a fix rather than more prose: an absolute is cheap to write and wrong in real cases, and a rule plus the cases
   it must not eat costs more words than the absolute it replaced. **When a fix and the
   ceiling conflict, the ceiling moves.** Every count in the table below is checkable with
   `wc -w`. Nothing loads anything else — a subagent reads one file and has the whole
   contract.

Individual fidelity exceptions (skill/agent words): Plan 1900/1950 buys complete source
reads, blocking exceptions, stable mapping, persisted completeness and explicit no-shell
fallback/tiny-file reads. Build 1850/2000 preserves pre-mutation authority classification,
the complete authorized-amendment positive case, immutable report/repair provenance and
compressed evidence/caveats; Review 1700/1750 buys candidate-bound obligation/gate evidence
and repair definitions. Both distinguish lasting behavior-named regressions from historical
receipt/replay verification, without freezing transient review/release status. The 100-word
ceiling increases retain evidence-only scope safeguards and useful authorized regressions
without removing existing guards;
Debug's agent ceiling is 1550 for honest sandbox/applied states. Common ceilings and Git-Ops
stay unchanged. These budgets preserve safeguards for lower-cost models, not a claim of
measured robustness on those models.

## The set

| Skill | What it does | How it runs | Words |
|---|---|---|---|
| `decide` | Options and stress-tests for a decision that isn't settled — "should I", "what are my options", "I'm stuck" | inline | 1134 |
| `architect` | System structure from measurable drivers; components, boundaries and data. The decision record is a section of the output, not a separate artifact | inline | 1211 |
| `plan` | A task turned into ordered steps and per-step specs a builder can execute without making load-bearing decisions. Writes no code | subagent (`agents/principal-plan.md`, 1938) or inline | 1877 |
| `build` | Test-first implementation — code proven by a test you watched fail | subagent (`agents/principal-build.md`, 1845) or inline | 1801 |
| `review` | One pass, two axes — correctness and simplicity — ending in one severity-ranked verdict | subagent (`agents/principal-review.md`, 1724) or inline | 1660 |
| `debug` | Hypothesis before fix: a diagnosis loop ending in a note with root cause and a regression test | subagent (`agents/principal-debug.md`, 1533) or inline | 1397 |
| `investigate` | A factual report of how code, data, runtime, or history currently behaves, with file-and-line citations | subagent (`agents/principal-investigate.md`, 491) or inline | 492 |
| `git-ops` | Safe version-control operator — reads state before writing it, keeps published history immutable, scans for secrets before committing | inline, never delegated | 2145 |

Routing between them belongs to the orchestrator, not to a skill — there is deliberately no
routing skill spending context to say "pick a skill". [AGENTS.md](./AGENTS.md) is the
long-form routing reference, and the bootstrap extension below injects its routing table
automatically at session start, so nothing needs to point pi at it by hand.

## Bootstrap and workflows

A pi extension (`extensions/bootstrap.ts`) injects `bootstrap/BOOTSTRAP.md` — under 300
words — as a leading message at session start and again after compaction, so the routing
context survives a context reset instead of depending on someone re-reading a file. It
carries the routing table compressed to input shape → skill → inline/subagent, the closed
`Next:` vocabulary the phases hand off with, and model tiering: the cheapest model for a
build agent working a complete step spec, the session default for plan and debug, the
strongest available for review and architect.

The three spines (`/principal-feature <task>`, `/principal-bugfix <symptom>`,
`/principal-refactor <scope>`) stop for your approval after the planning phase or the debug
note and wait for an explicit go
before building — presenting the artifact and starting to build in the same turn is the
failure the rule exists to catch. The artifact scales with the change (three lines for a
config tweak, full slices for a feature); the stop does not.

Delegated phases hand artifacts to each other as files, not pasted text. A `principal-build`
writes its full report to an unused task/run/candidate-scoped path under `.principal/reports/`
(or a valid unused caller-chosen path) and returns five status lines;
review receives governing source/definition references, the complete plan/map when present,
and a candidate-identified diff package plus reports. Only matching candidate/scope evidence
is reusable; a passing suite alone is not complete requirement coverage. Every successful
report contributes assumptions, follow-ups and evidence gaps to the Digest. Repairs carry
full review-report paths, finding definitions and acceptance conditions, not IDs alone;
scoped re-review retains original whole-change evidence and gates. Independent runs never
reuse prior report/diff paths; repairs retain original review path and reviewed candidate.
Before any artifact write, the orchestrator creates an absent `.principal/.gitignore`
containing `*`, never overwrites it, and checks report destinations are ignored. This covers
planless Review, inline Build and optional Investigate persistence too. An existing policy
that exposes reports requires caller repair, not accidental runtime files in git.

When plan's output is the multi-step template, it writes the plan to
`.principal/plans/<slug>.md` and prints the path; `.principal/.gitignore` is created
alongside it only if absent, never overwritten. The complete executable artifact and map
stay in the file; chat gives a short summary and approval cue. Without persistence, the full
artifact is returned in chat, explicitly not saved. Tiny normative changes retain source/ID,
step and test without full machinery. Delegated
`principal-build` agents read their assigned step from that file, and a fresh or compacted
session that finds a matching plan resumes from it: read the file and `git log`, mark done
whatever already has a commit, continue at the first undone step, and never re-plan without
being asked.

## Layout

```
<skill>/SKILL.md                      the interactive contract — nothing else is required reading
agents/principal-{plan,build,review,debug,investigate}.md  subagent definitions available for delegation
contracts/{plan,build,review,debug,investigate}.md.tmpl    source for dual-use contracts — edit here, run `npm run generate`
contracts/workflows.md.tmpl           source for the three namespaced spines
prompts/principal-{feature,bugfix,refactor}.md generated workflows
prompts/principal-review-branch.md    handwritten planless/buildless review entry
bootstrap/BOOTSTRAP.md                routing table + Next: vocabulary + model tiering, injected by the extension
extensions/bootstrap.ts               pi extension: injects BOOTSTRAP.md at session start and after compaction
scripts/                              generator, installers, and checks behind `npm test`
tests/{unit,install}/                 current product/contract + clean-home install tests (node:test)
tests/evidence/                      opt-in offline receipt integrity and replay-tool checks
AGENTS.md                             routing + dispatch reference; the bootstrap injects its table automatically
CHANGELOG.md                          release history
```

## Install (pi)

1. **Skills + prompts** — install an immutable tag, not a branch:

   ```
   pi install git:github.com/mojomanyana/principal-pi-skills@v4.7.0
   ```

   The v4.7.0 `pi` manifest registers the eight skills, the four `/principal-*` commands,
   and the bootstrap extension — it loads automatically with
   the package; there is no separate extension-install step. Unpinned `main` moves under
   you, so install a tag if you want a fixed, nameable behavior.

   **Do not install `2.3.0`** — it is deprecated on npm for a destructive defect: its
   `principal-pi-workspace remove` deletes any path handed to it, including your checkout,
   and reports success. `2.3.1` is the lowest safe version.

2. **Subagents (optional).** Use the **same source** as the installed skills. Before npm
   publication, npm latest is 4.6.0; unpinned `npx` would install/check older definitions,
   and npm `@4.7.0` is not yet available. Either locate the actual installed tagged package
   (its path varies by Pi configuration) and run its `scripts/install-agents.mjs` with Node,
   or use this concrete matching-tag disposable checkout recipe:

   ```sh
   (
     set -eu
     source_dir=$(mktemp -d)
     trap 'rm -rf -- "$source_dir"' EXIT
     git clone --depth 1 --branch v4.7.0 https://github.com/mojomanyana/principal-pi-skills.git "$source_dir/package"
     test "$(git -C "$source_dir/package" rev-parse HEAD)" = 448ac7628980c7a69bb3ff27e3bfa882bf64c4f3
     node "$source_dir/package/scripts/install-agents.mjs" install
     node "$source_dir/package/scripts/install-agents.mjs" check
   )
   ```

   After npm publication, and only once the matching package is available, pin both commands:

   ```sh
   npx -p principal-pi-skills@4.7.0 principal-pi-agents install
   npx -p principal-pi-skills@4.7.0 principal-pi-agents check
   ```

   The existing v4.7.0 tag at `448ac76` excludes the PR #58 repair candidate. These tagged
   commands validate/install that tag, not later repairs; do not move the tag. To validate
   repairs, load skills/prompts from the actual repair checkout and run **that checkout's**
   installer/check into an isolated `PI_CODING_AGENT_DIR`, retaining its candidate identity.
   Publication/release identity for later repairs needs a separate explicit decision.

   It installs `principal-plan`, `principal-build`, `principal-review`, `principal-debug`,
   and `principal-investigate` as **real files, not symlinks** — a symlink into a checkout breaks the
   moment that directory moves, and breaks silently, since pi just reports an unknown
   agent. It refuses to overwrite anything it did not install, and `uninstall` removes only
   its own unmodified files.

   Tool restriction is structural, in the agents' frontmatter: `investigate` is read-only;
   `plan` is read-only except for its plan and creation of an absent `.principal/.gitignore`; `build`, `review`, and `debug` add
   `bash` to run tests (and, for `build`, to write and edit).

   One trap worth knowing if you run subagents on a non-default provider: a delegated agent
   runs on the pi config's `defaultProvider`/`defaultModel`, **not** the
   `--provider`/`--model` you gave the parent session — the extension forwards `--model`
   only when an agent's frontmatter names one, and these deliberately do not. If
   delegations fail to authenticate while the parent session is fine, that mismatch is the
   reason.

3. **Without the subagent step, everything still runs completely inline** via the skills;
   the How column in [The set](#the-set) simply collapses to "inline". The routing table
   still reaches the session because the bootstrap extension injects it — installing the
   package is enough for that part; only delegation itself needs step 2.

4. **Under pi-daddy (0.33.0+), each skill declares how much of the caller's session it may
   receive.** A child gets only the `context:` mode its own `allowed-tools` names (or a
   weaker one: `none < files < pruned < summary < fork`). Asking for more is refused, not
   downgraded. The ceilings are decisions, and each one is explained in its frontmatter:

   | skill | ceiling | why |
   |---|---|---|
   | `architect`, `decide` | `context:summary` | delegated, they cannot ask; the drivers and the rejected options live in the parent's dialogue |
   | `plan` | `context:summary` | a plan must honour what the user ruled out, which a task line flattens; no `bash` |
   | `review` | `context:files` | **deliberately low.** Review is cold by design, and the author's reasoning is what it must not be anchored on; the diff package and build report are files |
   | `build`, `debug` | `context:files` | they act on a stated target (a plan file or a symptom); logs travel verbatim as files; with `bash`, anything a child receives can leave the machine |
   | `investigate` | `context:files` | receives only named evidence and has no shell or write tools; the caller's reasoning is not evidence |
   | `git-ops` | none | acts on the working tree, not the conversation; consent to a destructive op must come from the user, not from forwarded turns |

   Nothing declares `context:fork`. Write the prefix in lowercase: `Context:summary` turns
   into `tool:context:summary`, which grants no context mode.

   **Egress: know what `summary` enables.** `context:summary` also permits `pruned`. That
   mode carries the operator's own session turns (the last 20 by default, up to 32 KiB),
   not just the task. With a pi-daddy advisor enabled (`PI_DADDY_ADVISOR` plus
   `PI_DADDY_ADVISOR_KEY`), a `pruned` handoff sends those turns to that third party so it
   can choose which ones to keep. For `architect`, `decide` and `plan`, that is what you
   switch on by delegating with `pruned` while an advisor is on. Raising any other skill's
   ceiling extends that exposure to it.

## Validation

`npm test` remains the free gate: generated-contract drift, word budgets, frontmatter lint,
installer and tarball behavior, `Next:` transition parity, and deterministic source-fidelity
contract assertions and offline behavioral-corpus integrity/negative-oracle tests. These
check current contracts and fixtures, not model behavior or instruction delivery.

`npm run verify:evidence` separately runs `node --test tests/evidence/*.test.mjs`:
offline historical receipt/hash integrity, retained failed observations, and fail-closed
replay-parser checks. It never invokes Pi or a model; the parser check skips with a reason
if optional Python is absent. It is not part of `npm test` or default CI. Passing it does
not qualify current model behavior or restamp an archived candidate. Historical test
totals (including 141 unit tests) describe their recorded runs, not today's suite size.
Archived manifests retain their original candidate identity even when the working tree
has changed; reports, raw traces and manifests are not rewritten by test cleanup.

**Enforcement boundary:** Build/Review instructions ask the model to organize regressions
by lasting behavior, not PR/finding IDs, and distinguish product coverage from historical
verification. Evidence-only requests first use existing checks or disposable probes, not
permanent tests merely to prove a finding was addressed; ordinary approved bugfix/feature
regressions and useful explicitly requested checks remain authorized. Markdown contracts are
product, with legitimate structural tests. These are not filesystem restrictions or a semantic
test-quality checker.
The package commands and CI mechanically select suites; pi-daddy's delegated tool grants
control available capabilities, not test names or correctness. Refresh installed skill/agent
definitions when adopting a revision: editing this checkout does not update another installed copy.

A narrow local opt-in behavioral regression corpus is authorized for requirement fidelity,
superseding only the blanket removal of focused harness fixtures below. It is **partially measured, not fully qualified**:
46 runnable component cases now live in `<skill>/tests/specification.yaml` for Plan, Build,
Review, Investigate, Decide, Architect and Debug. Shared synthetic fixtures, 51-row long-source
oracle, all F01–F27 status/replay recipes and runner limitations are documented in
[evals/requirement-fidelity/README.md](evals/requirement-fidelity/README.md), with an
[evidence index](evals/requirement-fidelity/evidence.md). The three evidence-scope cases have
[bounded live observations](evals/requirement-fidelity/evidence/evidence-scope/README.md):
F25/F27 raw PASS; F26's old reporting failure is retained, with a
[new corrected-rubric PASS and separate execution audit](evals/requirement-fidelity/evidence/regression-evidence-alignment/README.md).
[Whole-PR repairs](evals/requirement-fidelity/evidence/full-review-repairs/README.md)
retain the earlier report-safety observations and 5/9 run.
[Latest Build handoff validation](evals/requirement-fidelity/evidence/build-handoff/README.md)
is **4/9 NOT READY**; three fully captured cases verify saved patches and functional regressions
but retain caveat-delivery, persistence-stop and reproducibility limitations.
The earlier narrow direct audit remains UNVERIFIED with explicit manual inspection.
Older 43-case results remain historical.
Retained live runs include failures;
a manually orchestrated source→plan→build→review chain, full long-plan inspection, and two
normal skill-loading probes provide narrower positive evidence, not an all-case pass.
PR #58 retains three direct blocking runs of the unchanged critical F04 negative and three
successful supplied-definition companions. Actual registered workflow prompts demonstrate
repeat-report preservation, absent-ignore initialization and an approval-gated inline bugfix.
These are bounded observations, not passing harness grades; fresh-session resumed repair and
delegated transport remain unmeasured. Three parent-only replay recipes track partial coverage.
Retain results.yaml, synthetic transcripts/traces, changed-file diffs
and complete output artifacts under `<skill>/tests/results/<runner-model>/<run>/`; use narrow
ignore rules for incidental caches/HTML only. Review evidence for secrets before staging.
No model calls in `npm test`, no harness runtime dependency, no fixtures/results in the npm
package. Broad comparisons and qualification remain external.

Record candidate/spec/fixture identities, runner/Pi versions, subject/judge, mode, repetitions,
commands and retained artifacts. Separate forced instruction following from normal runtime
loading; missing delivery/retention evidence is UNKNOWN, never PASS. Installed skill-harness
0.21.0 preflight exposed schema-2 and retention gaps; no compatible published update is
available per the implementation preflight. P0/schema-3/full behavioral validation has not
passed. An unsupported Spark provider response prevented lower-cost robustness measurements;
CLI exit zero was not counted as success. Remaining Build/Architect failures, tool-ceiling
violations, and unmeasured combinations are recorded rather than waived. No prior deleted
4/4 claim is restored. Focused results establish only their recorded candidate/model/delivery cells.

Two opt-in routing checks use only the eight authored frontmatter descriptions. Run
`npm run check:routing-collisions` for all 56 directed description pairs and
`npm run check:routing-triggers` for the three-run synthetic trigger suite. Both require
`FIREWORKS_API_KEY`; `ROUTING_MODEL` and `ROUTING_API_URL` override the defaults. The suite
starts with 12 positives and 8 near-miss negatives per skill, then
adds authored collision-boundary and no-skill probes, and reports per-skill precision and recall
at a 0.5 vote threshold. `evals/baseline/triggers.json` records the expanded three-run corpus;
the obsolete pre-expansion record was removed. Regenerate the baseline after any corpus or
routing-description change.

## Why 4.0

Version 3.x grew a risk-adaptive assurance controller — a hash-chained event ledger, task
packets, digests, fail-closed gates — whose protocol leaked into the model-facing skill text
and whose init step ran before every workflow, including a typo fix. The routing layer in
`AGENTS.md` was never loaded by pi, the feature spine had no human approval point outside
critical mode, and every build ran inline so long features filled the steering context with
diffs and test output. The seven skills were the strongest part of the repo and 12% of its
Markdown. 4.0 returns the repo to skills plus a thin orchestration layer and borrows four
mechanisms from [superpowers](https://github.com/obra/superpowers) that serve the north star.

Decisions taken for 4.0, all closed:

| Decision | Chosen |
|---|---|
| Target harness | pi only |
| Assurance ledger and profiles | removed; per-skill right-sizing is the mechanism; the tool lives on the `v3.2.0` tag for porting to pi-daddy |
| Human approval | always, after plan (feature) or after the debug note (bugfix); the artifact scales, the stop does not |
| Routing delivery | a pi extension injects `bootstrap/BOOTSTRAP.md` at session start and after compaction |
| Build delegation | `principal-build` agent; inline when there is no multi-step plan file or no subagent tool |
| Plan persistence | multi-step plans to git-ignored `.principal/plans/<slug>.md`; no date prefix because plan has no clock, and resume matches on the `## Plan:` line |
| Decide vs architect | both kept; decide answers "should we / which", architect answers "how is it structured" |
| Measurement | broad qualification stays external; narrow opt-in requirement-fidelity regressions permitted locally (see Validation), partially measured but not fully qualified |

Two implementation notes that differ from the obvious reading: the bootstrap is injected as
a user-role message wrapped in `<IMPORTANT>`, because pi's `context` hook can only insert
messages; and a delegated `principal-build` may run without a plan file (the bugfix spine and
repair rounds), in which case the prompt's task is its whole spec.

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

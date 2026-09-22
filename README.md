# principal-pi-skills

**Seven skills for principal-level software engineering with the
[pi coding agent](https://github.com/badlogic/pi-mono) — three inline skills and four
that double as subagents.** Dialogue and session state run inline (`decide`, `architect`,
`git-ops`); heavy reading, cold judgment, and noisy loops delegate to isolated contexts
(`plan`, `build`, `review`, `debug` — single-shot variants in `agents/`, generated from the
same contract as the skill). The files follow the [Agent Skills](https://agentskills.io/specification)
standard, so other harnesses can consume the skills, but pi is the supported target. This
is **4.x**: a thin orchestration layer over the seven skills, with the risk-adaptive
assurance controller and model measurement removed to a separate track (see
[Validation](#validation)).

The set is built for **one principal engineer steering at a high level while skills and
subagents do the work.** Two properties follow, and every design choice below serves them:
**delegable trust** — an output carries the evidence needed to verify it without redoing
the work — and **cheap iteration** — a defect found is a defect fixed, not documented
around.

## Three constraints

1. **Dual-use.** `plan`, `build`, `review`, and `debug` each serve as a loaded skill *and*
   as a subagent system prompt. Both forms are rendered from one contract, so the shared
   behavior cannot drift between them, and the differences — single-shot mechanics, the
   BLOCKED form, no-dialogue rules — are marked rather than remembered. That constraint is
   what forces single-shot-safe behavior and a literal output template.
2. **Model-agnostic.** Written for the weakest model that will run it (DeepSeek, GLM,
   Sonnet-class), not the strongest: imperative numbered steps, literal fill-in templates,
   plain-text tags (`[ONE-WAY]`, `[BLOCKER]`) instead of an emoji schema, no aphorisms
   doing load-bearing work, no personas, no required reading in reference files.
3. **Token economics.** Budgets stated as decisions rather than aspirations: **skills
   ≤ 1400 words**, **agents ≤ 1500**, and **`git-ops` an accepted exception at ≤ 2000** —
   the safety-critical operator carries the most arming, and validated behavior outweighs
   a budget. Every ceiling has moved exactly once, each time buying a fix rather than more
   prose: an absolute is cheap to write and wrong in real cases, and a rule plus the cases
   it must not eat costs more words than the absolute it replaced. **When a fix and the
   ceiling conflict, the ceiling moves.** Every count in the table below is checkable with
   `wc -w`. Nothing loads anything else — a subagent reads one file and has the whole
   contract.

## The set

| Skill | What it does | How it runs | Words |
|---|---|---|---|
| `decide` | Options and stress-tests for a decision that isn't settled — "should I", "what are my options", "I'm stuck" | inline | 1080 |
| `architect` | System design from measurable drivers; significant or irreversible technical choices. The decision record is a section of the output, not a separate artifact | inline | 1172 |
| `plan` | A task turned into ordered steps and per-step specs a builder can execute without making load-bearing decisions. Writes no code | subagent (`agents/principal-plan.md`, 1458) or inline | 1237 |
| `build` | Test-first implementation — code proven by a test you watched fail | subagent (`agents/principal-build.md`, 1240) or inline | 1112 |
| `review` | One pass, two axes — correctness and simplicity — ending in one severity-ranked verdict | subagent (`agents/principal-review.md`, 1394) or inline | 1294 |
| `debug` | Hypothesis before fix: a diagnosis loop ending in a note with root cause and a regression test | subagent (`agents/principal-debug.md`, 1456) or inline | 1322 |
| `git-ops` | Safe version-control operator — reads state before writing it, keeps published history immutable, scans for secrets before committing | inline, never delegated | 1996 |

Routing between them belongs to the orchestrator, not to a skill — there is deliberately no
routing skill spending context to say "pick a skill". [AGENTS.md](./AGENTS.md) is the
long-form routing reference, and the bootstrap extension below injects its routing table
automatically at session start, so nothing needs to point pi at it by hand.

## Bootstrap and workflows

A pi extension (`extensions/bootstrap.ts`) injects `bootstrap/BOOTSTRAP.md` — about 250
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
writes its full report to `.principal/reports/<step>-build.md` and returns five status lines;
review is handed one diff package for the whole change plus those reports, treats a verbatim
test-result line as evidence, and runs a test only for a named doubt. A repair round resumes
the build agent where the tool allows and gets a scoped re-review of the fix diff against the
open finding IDs. The `.principal/` directory ignores itself, so none of this reaches git.

When plan's output is the multi-step template, it writes the plan to
`.principal/plans/<slug>.md` and prints the path; `.principal/.gitignore` is created
alongside it on first use, so the directory is git-ignored and self-ignoring. Delegated
`principal-build` agents read their assigned step from that file, and a fresh or compacted
session that finds a matching plan resumes from it: read the file and `git log`, mark done
whatever already has a commit, continue at the first undone step, and never re-plan without
being asked.

## Layout

```
<skill>/SKILL.md                      the interactive contract — nothing else is required reading
agents/principal-{plan,build,review,debug}.md  subagent definitions the workflows delegate to
contracts/{plan,build,review,debug}.md.tmpl    source for dual-use contracts — edit here, run `npm run generate`
contracts/workflows.md.tmpl           source for the two namespaced spines
prompts/principal-{feature,bugfix}.md generated workflows
bootstrap/BOOTSTRAP.md                routing table + Next: vocabulary + model tiering, injected by the extension
extensions/bootstrap.ts               pi extension: injects BOOTSTRAP.md at session start and after compaction
scripts/                              generator, installers, and checks behind `npm test`
tests/{unit,install}/                 unit + clean-home install tests (node:test)
AGENTS.md                             routing + dispatch reference; the bootstrap injects its table automatically
CHANGELOG.md                          release history
```

## Install (pi)

1. **Skills + prompts** — install an immutable tag, not a branch:

   ```
   pi install git:github.com/mojomanyana/principal-pi-skills@v4.1.0
   ```

   The `pi` manifest registers the seven skills, the four `/principal-*` commands, and the
   bootstrap extension — it loads automatically with
   the package; there is no separate extension-install step. Unpinned `main` moves under
   you, so install a tag if you want a fixed, nameable behavior.

   **Do not install `2.3.0`** — it is deprecated on npm for a destructive defect: its
   `principal-pi-workspace remove` deletes any path handed to it, including your checkout,
   and reports success. `2.3.1` is the lowest safe version.

2. **Subagents (optional).** Install the four agent definitions:

   ```
   npx -p principal-pi-skills principal-pi-agents install     # → ${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents
   npx -p principal-pi-skills principal-pi-agents check       # verify they are present and current
   ```

   It installs `principal-plan`, `principal-build`, `principal-review`, and
   `principal-debug` as **real files, not symlinks** — a symlink into a checkout breaks the
   moment that directory moves, and breaks silently, since pi just reports an unknown
   agent. It refuses to overwrite anything it did not install, and `uninstall` removes only
   its own unmodified files.

   Tool restriction is structural, in the agents' frontmatter: `plan` is read-only except for its own plan file; `build`,
   `review`, and `debug` add `bash` to run tests (and, for `build`, to write and edit).

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

4.0 ships with no model score. The skill-harness specifications and the v2.4 DeepSeek/GLM
board were removed in this release; model measurement restarts in a separate repository,
from scratch. `npm test` remains the
free gate: generated-contract drift, word budgets, frontmatter lint, installer and tarball
behavior, and `Next:` transition parity.

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
| Measurement | skill-harness specs, results, fixtures and E2E removed; restarts in a separate repo |

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

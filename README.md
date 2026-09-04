# principal-pi-skills

**Seven skills for principal-level software engineering with the
[pi coding agent](https://github.com/badlogic/pi-mono) — four inline skills and three
that double as subagents.** Dialogue and session state run inline (`decide`,
`architect`, `build`, `git-ops`); heavy reading, cold judgment, and noisy loops delegate
to isolated contexts (`plan`, `review`, `debug` — single-shot variants in `agents/`,
generated from the same contract as the skill). The files follow the [Agent Skills](https://agentskills.io/specification)
standard, so other harnesses can consume the skills, but pi is the supported target.

**Version:** `3.0.1` release candidate. The remote `v3.0.1` tag is pending and npm `latest`
remains `3.0.0` until both publication results are independently verified. Release coordinates
are npm `principal-pi-skills@3.0.1` and the immutable git tag `v3.0.1`. This version strengthens the generated Critical Plan skill/agent
prompts, assurance-ledger evidence, and development-only measurement verification. It carries no
new model score; the committed board remains a historical v2.4 baseline.

The set is built for **one principal engineer steering at a high level while skills and
subagents do the work.** Two properties follow, and every design choice below serves them:
**delegable trust** — an output carries the evidence needed to verify it without redoing
the work — and **cheap iteration** — a defect found is a defect fixed, not documented
around. v3 adds risk-adaptive assurance to the two workflows: `standard` stays the default,
while explicit `critical` activates selected isolation, independent-review, evidence, and
approval controls without creating another skill suite.

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
   ≤ ~1400 words**, with **`git-ops` an accepted exception at ~2000** — the safety-critical
   operator carries the most arming, and validated behavior outweighs a budget.
   Both ceilings have moved once, each buying a fix rather than more prose. `git-ops` went
   1320 → 1900 to reconcile the protected-branch and secret-purge policies and redact secret
   findings, then 1900 → 2000 for v3 finish mode's fresh-evidence gate and explicit
   merge/PR/keep choice. No safety playbook was trimmed to make room. The skill budget went
   1100 → 1250 → 1400 for a lesson this framework
   paid for: *every arming needs its governor in the same breath*. An absolute is cheap to
   write — "one caller → inline it", "every catch logs and changes state" — and wrong in real
   cases, and each wrong absolute produced a measured over-refusal. A rule plus the cases it
   must not eat costs more words than an absolute; that is the trade. **When a fix and the
   ceiling conflict, the ceiling moves** — trimming to fit was quietly deleting reasons a weak
   model needed, which is a worse outcome than a longer file. Plan is the local exception at
   ≤ ~1700 (agent ≤ ~1900): its Critical contract keeps packet ownership, concrete verification,
   no-context discovery, and vertical-slice governors together after those omissions failed across
   models. **Other agents get their own budget, ≤ ~1500**: a single-shot definition carries its
   output template *and* the BLOCKED form *and* the no-questions mechanics, none of which a loaded
   skill needs. Every count in the table below is checkable with `wc -w`. Nothing loads anything
   else — a subagent reads one file and has the whole contract.

## The set

| Skill | What it does | How it runs | Words |
|---|---|---|---|
| `decide` | Options and stress-tests for a decision that isn't settled — "should I", "what are my options", "I'm stuck" | inline | 1055 |
| `architect` | System design from measurable drivers; significant or irreversible technical choices. The decision record is a section of the output, not a separate artifact | inline | 1142 |
| `plan` | A task turned into ordered steps and per-step specs a builder can execute without making load-bearing decisions. Writes no code | subagent (`agents/principal-plan.md`, 1812) or inline | 1602 |
| `build` | Test-first implementation — code proven by a test you watched fail | inline | 1162 |
| `review` | One pass, two axes — correctness and simplicity — ending in one severity-ranked verdict | subagent (`agents/principal-review.md`, 1392) or inline | 1364 |
| `debug` | Hypothesis before fix: a diagnosis loop ending in a note with root cause and a regression test | subagent (`agents/principal-debug.md`, 1395) or inline | 1261 |
| `git-ops` | Safe version-control operator — reads state before writing it, keeps published history immutable, scans for secrets before committing | inline, never delegated | 1997 |

Routing between them belongs to the orchestrator, not to a skill — there is deliberately no
routing skill spending context to say "pick a skill". [AGENTS.md](./AGENTS.md) is that
layer and the one file an agent should read at session start — but pi does not load it for
you; point your orchestrator at it deliberately.

## Layout

```
<skill>/SKILL.md                      the interactive contract — nothing else is required reading
agents/principal-{plan,review,debug}.md  subagent definitions the workflows delegate to
agents/{plan,review,debug}.md         deprecated generic-name aliases
contracts/{plan,review,debug}.md.tmpl source for dual-use contracts — edit here, run `npm run generate`
contracts/workflows.md.tmpl           source for namespaced spines and full deprecated aliases
prompts/{principal-,}{feature,bugfix}.md generated workflows; bare names are deprecated
schemas/                              portable v1 run-state, task-packet, and evidence schemas
scripts/assurance-state.mjs           append-only assurance state, transitions, and gates
scripts/                              generator, installers, and checks behind `npm test`
tests/{unit,install}/                 unit + clean-home install tests (node:test; ajv dev-only, schema parity)
tests/e2e/run-e2e.sh                  live workflow cells: both spines, with and without subagents
<skill>/tests/specification.yaml      skill-harness scenarios (ship bar, critical gates)
<skill>/tests/fixtures/<ID>/          seeded repo for one scenario (git-ops, build, debug)
<skill>/tests/results/…/results.yaml  committed run evidence (Opus-judged)
AGENTS.md                             routing + dispatch reference (ships, but pi does not auto-load it)
CHANGELOG.md                          release history
docs/HANDOFF.md                       current state, what is open, standing hazards — read first
docs/validation/                      how the skills are measured — scorecard, run manifest
docs/evidence/                        per-judgment and per-rep records behind the scorecard
docs/demos/                           the chains running end to end, repo-verified
```

## Install (pi)

1. **Skills + prompts** — install an immutable tag, not a branch:

   ```
   pi install git:github.com/mojomanyana/principal-pi-skills@v3.0.1
   ```

   `3.0.1` is the release represented by this source tree. The immutable tag must match its
   manifest before publication, and npm `latest` must resolve the same version afterward. v3 adds
   the risk-adaptive assurance profiles; `standard` is the default and preserves v2 invocation,
   so upgrading from `2.4.0` changes no command you already type.
   Read [Validation](#validation) first: v3 ships with **no model score of its own** — the
   committed board is a historical v2.4 baseline. Do not turn a moving branch into
   production install guidance.

   **Do not install `2.3.0`** — it is deprecated on npm for a destructive defect: its
   `principal-pi-workspace remove` deletes any path handed to it, including your checkout,
   and reports success. `2.3.1` is the lowest safe version.

   The `pi` manifest registers the seven skills and the `/principal-feature` and
   `/principal-bugfix` commands (plus the deprecated `/feature` and `/bugfix` aliases).
   Unpinned `main` moves under you: the skills' behavior is what the committed scorecard
   measured, and a tag is what keeps those two the same thing. Drop the version pin only if
   you want whatever `main` currently holds, measured or not.
2. **Subagents (optional).** The extension ships **inside pi itself**, so there is nothing
   to clone. Copy its `index.ts` and `agents.ts` into `~/.pi/agent/extensions/subagent/`
   from wherever your pi lives:

   ```
   # installed from npm — the path that applies to most people:
   EXT="$(dirname "$(readlink -f "$(command -v pi)")")/../examples/extensions/subagent"
   mkdir -p ~/.pi/agent/extensions/subagent
   cp "$EXT/index.ts" "$EXT/agents.ts" ~/.pi/agent/extensions/subagent/
   ```

   In a pi-mono *source* checkout the same files are at
   `packages/coding-agent/examples/extensions/subagent`. Then install the agent definitions:

   ```
   npx -p principal-pi-skills principal-pi-agents install     # → ${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents
   npx -p principal-pi-skills principal-pi-agents check       # verify they are present and current
   ```

   It installs `principal-plan`, `principal-review` and `principal-debug` as **real files,
   not symlinks** — a symlink into a checkout breaks the moment that directory moves, and
   breaks silently, since pi just reports an unknown agent. It refuses to overwrite anything
   it did not install, and `uninstall` removes only its own unmodified files. The generic
   `plan` / `review` / `debug` names are deprecated aliases and install only under
   `--with-generic-aliases`.

   Tool restriction is structural, in the agents' frontmatter: `plan` is read-only;
   `review` adds `bash` to run tests; `debug` has the same bash-enabled surface (and pi-daddy
   correctly treats bash as write-capable authority).

   The extension steps were last run end to end against **pi 0.83.0** (2026-08-11), by the
   historical workflow E2E cells in `tests/e2e/run-e2e.sh`. v3 defines four `× subagents
   present` cells (standard/critical × both spines); they are prepared but not model-run here.
   The v2 cells delegated to `principal-plan`/`principal-review`/`principal-debug` and passed.
   Upstream is someone else's repo, so if the file names move, that copy step is the thing to
   re-check.

   One trap worth knowing if you run subagents on a non-default provider: the extension
   passes `--model` to the child `pi` only when an agent's frontmatter names one. Ours
   deliberately do not, so a delegated agent uses your pi config's `defaultProvider` /
   `defaultModel` — **not** whatever `--provider`/`--model` you passed the parent. If
   delegations fail to authenticate while the parent is fine, that mismatch is why.
3. **Without the extension, lean and standard still work completely inline.** That remains a
   supported baseline. Inline review is self-review and weaker than a cold read. Critical
   assurance does not pretend otherwise: if no governed fresh-context executor exists for its
   critique and independent reviews, it returns `BLOCKED_CRITICAL_ASSURANCE` rather than
   silently degrading to inline self-review.
4. **`AGENTS.md` is not installed as routing context.** pi packages register skills and
   prompts; they do not load a routing file into every session. It ships in the package and
   is worth reading, but nothing loads it for you — if you want the orchestrator to route by
   it, point your agent at it yourself. Documenting this honestly beats implying a routing
   layer that is not wired up.

### What a clean install actually gives you

- The seven skills and both workflow commands, with lean/standard running **inline** as a
  complete baseline.
- Subagents only if you did step 2 — optional for lean/standard, but one way to satisfy the
  fresh-context controls explicit critical assurance requires.
- `principal-pi-assurance`, a parent/controller CLI that stores a hash-chained event log and
  derived snapshot outside the product tree. It adds no public skill name.
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

The two namespaced workflows and deprecated aliases are generated as complete prompts from
`contracts/workflows.md.tmpl`; aliases do not depend on recursive slash-command expansion, and the
shared assurance section is byte-identical by construction. Workflow state is not prose:
`principal-pi-assurance` validates the v1 schemas, appends hash-chained JSONL events, derives
`snapshot.json`, rejects illegal downgrades/transitions, and gates stale evidence or missing
critical controls. In git it stores under the common directory
(`.git/principal-pi-skills/assurance-v1`), otherwise under XDG state. Build remains the only
durable source writer. See [docs/ASSURANCE.md](./docs/ASSURANCE.md).

## Assurance profiles

Both namespaced workflows accept:

```
--assurance lean|standard|critical
--critical-scope "entire-run|task-2,task-4|db/migrations/**,src/auth/**"
```

`standard` is the compatible default and `high` aliases `critical`. “Treat this as critical”
and “escalate this run to critical” persist the same state. Lean keeps the tiny/reversible
path. Standard keeps Option B. Critical adds approved design for consequential work,
independent plan critique before task packets, an owned branch worktree, per-task specification
and quality reviews in separate fresh contexts rooted at that writer checkout, a final whole-change
review after task evidence, fresh full evidence, and just-in-time approval for external effects.
Git-Ops records final branch/head/tree between readiness and completion gates. Critical never silently falls back;
unavailable isolation or fresh contexts returns `BLOCKED_CRITICAL_ASSURANCE`.

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

The exploratory Terra-high Wave 0 contains a control, an unpinned-executor infrastructure
failure, and a subprocess-pinned run whose treatment delivery is unproven. None participates
in efficacy, stability, release, or v3 scoring. No committed pi-daddy observation has the
required externally produced per-observation attestation, so its current valid-treatment
count is **zero**. Future treatment requires a closed arm policy, strict canonical result,
eagerly validated arm-bound trust store, exact observation/attestation bijection, and atomic
corpus-level replay check. Durable operational replay prevention remains external. The
DeepSeek/GLM v3 wave and live workflow cells remain unrun.

`principal-pi-skills` is only a classifier, evidence-policy consumer, and verifier of
operator-trusted external attestations. It does not securely execute subjects, protect
signing keys, authenticate producer ledgers, confine modules or process trees, or provide an
OS sandbox/same-UID boundary. A valid signature proves that the configured producer made the
attestation; it does not prove that producer is securely implemented. See
[`docs/validation/VALIDATION.md`](docs/validation/VALIDATION.md).

v3 changes model-visible contract text, adds one `E1` assurance scenario to each skill, and adds
a Git-Ops stale-receipt negative, taking the static specification from 98 to **106 scenarios**.
Those eight scenarios are prepared but
have **not** been model-run; no paid skill-harness or live E2E validation was authorized, and
`3.0.0` was released on that basis deliberately rather than by oversight.
Consequently v3 publishes no model score yet. The committed DeepSeek/GLM board remains a
historical v2.4 baseline, not evidence for the v3 prompts. `docs/validation/VALIDATION.md`
records that boundary and the commands for a future measured wave.

The free gate is `npm test`: generated-contract/workflow drift, state-machine and schema
transitions, install/packed-artifact behavior, worktree isolation, word budgets, and
skill-harness lint. Live workflow E2E now defines standard/critical × feature/bugfix ×
subagents present/absent; it is prepared but not run here because it spends model tokens.

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

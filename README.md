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
   ≤ 1400 words**, **agents ≤ 1500**, and **`git-ops` an accepted exception at ≤ 2550** (including operation-specific preservation and verified restoration) —
   the safety-critical operator carries the most arming, and validated behavior outweighs
   a budget. Ceilings move only to buy a fix rather than more prose: an absolute is cheap to write and wrong in real cases, and a rule plus the cases
   it must not eat costs more words than the absolute it replaced. **When a fix and the
   ceiling conflict, the ceiling moves.** Every count in the table below is checkable with
   `wc -w`. Nothing loads anything else — a subagent reads one file and has the whole
   contract.

Individual contract exceptions (skill/agent words): Plan 2050/2100 preserves complete
source/requirement maps and adds exact connected interfaces and shared-resource checks.
Build 2100/2100 retains authority, full evidence and immutable repair provenance while adding
meaningful test maintenance and explicit gate ownership/due stages. Review 1900/1950 retains candidate-bound
gates and distinguishes task, integrated and repair scope. Debug 1453/1600 preserves honest
disposable/applied states while making diagnosis sufficient for handoff and protecting
boundary evidence. These narrow increases retain the existing safeguards; they are not
claims of measured model compliance. Common ceilings remain unchanged.

## The set

| Skill | What it does | How it runs | Words |
|---|---|---|---|
| `decide` | Options and stress-tests for a decision that isn't settled — "should I", "what are my options", "I'm stuck" | inline | 975 |
| `architect` | System structure from measurable drivers; components, boundaries and data. The decision record is a section of the output, not a separate artifact | inline | 1270 |
| `plan` | A task turned into ordered steps and per-step specs a builder can execute without making load-bearing decisions. Writes no code | subagent (`agents/principal-plan.md`, 2081) or inline | 2020 |
| `build` | Test-first implementation — code proven by a test you watched fail | subagent (`agents/principal-build.md`, 2070) or inline | 2060 |
| `review` | One pass, two axes — correctness and simplicity — ending in one severity-ranked verdict | subagent (`agents/principal-review.md`, 1934) or inline | 1870 |
| `debug` | Hypothesis before fix: a diagnosis loop ending in a note with root cause and a regression test | subagent (`agents/principal-debug.md`, 1587) or inline | 1451 |
| `investigate` | A factual report of how code, data, runtime, or history currently behaves, with file-and-line citations | subagent (`agents/principal-investigate.md`, 494) or inline | 495 |
| `git-ops` | Safe version-control operator — reads state before writing it, keeps published history immutable, scans for secrets before committing | inline, never delegated | 2507 |

Routing between them belongs to the orchestrator, not to a skill — there is deliberately no
routing skill spending context to say "pick a skill". [AGENTS.md](./AGENTS.md) is the
long-form routing reference, and the bootstrap extension below injects its routing table
into applicable requests, so nothing needs to point pi at it by hand.

## Bootstrap and workflows

The extension (`extensions/bootstrap.ts`) discovers this package's enabled selected skills
through public `pi.getCommands()` at `before_agent_start`, after resource discovery. It
adds the under-300-word `bootstrap/BOOTSTRAP.md` once to each converted request, preserving
leading compaction/system/tool state and durable history. Tool iterations and later ordinary
requests receive routing too. Only extension-owned inserted objects are replaced; a quoted
marker cannot suppress injection. Disabled or shadowed package resources stay inactive.
Principal read/discovery failure is visible and latched until deliberate `/reload` reinstantiates the
extension; stale foreign command paths are ignored independently without disabling valid Principal skills; each registration owns its content cache and selected-resource state.

Native handoffs use `delegate_describe({agent:"phase"})`, require binding package
`principal-pi-skills` and exact phase. Native names are `plan`, `build`, `review`, `debug`,
`investigate`; pass the corresponding captured `definitionId` to every `delegate` call,
`delegate_all` child and `delegate_chain` step. The root `principal-agents.json` manifest binds exactly five phases to generated
inline/delegated paths and full-file SHA-256 hashes from the same generation pass. The
runtime must verify enabled selected source, package identity and both hashes. Missing,
wrong or disabled bindings and operational failures stop dependent work; they never trigger
legacy/foreign/inline substitution. Only genuinely absent native tools permit an explicitly
configured legacy principal-* runner. Inline is a workflow choice. Authored model/effort
policy governs; phase labels do not silently override it. This contract alone does not qualify
live native execution; the actual installed runtime/candidate still needs integration evidence.

Use one `delegate_all({children:[...]})` call for an approved independent parallel batch,
with the exact native phase name and captured `definitionId` on each child. Single `delegate`
calls conservatively reserve the available subtree capacity; overlapping single calls can
be refused. Writers need distinct precreated registered Git worktrees and declared scopes,
dependencies, shared resources and full-report destinations. Read every outcome, preserve
completed siblings after failure, review candidates, integrate serially and check the merged whole.

The three spines (`/principal-feature <task>`, `/principal-bugfix <symptom>`,
`/principal-refactor <scope>`) stop for your approval after the planning phase or the debug
note and wait for an explicit go
before building — presenting the artifact and starting to build in the same turn is the
failure the rule exists to catch. The artifact scales with the change (three lines for a
config tweak, full slices for a feature); the stop does not.

Delegated phases hand artifacts to each other as files, not pasted text. A native `build` child
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
`build` children read their assigned step from that file, and a fresh or compacted
session locates matching plans, then reconciles actual approval, current work and candidate-bound
reports. A commit does not establish review, integration or verification. Resume manually at
what the evidence shows remains; do not repeat completed work or infer approval from a title.

## Layout

```
<skill>/SKILL.md                      the interactive contract — nothing else is required reading
agents/principal-{plan,build,review,debug,investigate}.md  subagent definitions available for delegation
contracts/{plan,build,review,debug,investigate}.md.tmpl    source for dual-use contracts — edit here, run `npm run generate`
contracts/workflows.md.tmpl           source for the three namespaced spines
prompts/principal-{feature,bugfix,refactor}.md generated workflows
prompts/principal-review-branch.md    handwritten planless/buildless review entry
bootstrap/BOOTSTRAP.md                routing table + Next: vocabulary + model tiering, injected by the extension
extensions/bootstrap.ts               pi extension: request-local routing after selected-resource discovery
scripts/                              generator, installers, and checks behind `npm test`
tests/{unit,install}/                 current product/contract + clean-home install tests (node:test)
evals/{triggers.json,adversarial-triggers.json,baseline/}  routing checks and baselines
AGENTS.md                             routing + dispatch reference; the bootstrap injects its table automatically
CHANGELOG.md                          release history
```

## Install (pi)

1. **Skills + prompts** — install the exact npm release:

   ```sh
   pi install npm:principal-pi-skills@4.8.1
   pi install npm:pi-daddy@0.44.3
   pi install npm:skill-harness@0.24.3
   ```

   Restart Pi after package changes. The `pi` manifest registers eight skills, four
   `/principal-*` commands and the bootstrap extension automatically. Exact npm pins keep
   the installed source version identifiable.

   **Do not install `2.3.0`** — it is deprecated on npm for a destructive defect: its
   `principal-pi-workspace remove` deletes any path handed to it, including your checkout,
   and reports success. `2.3.1` is the lowest safe version.

   Native delegation uses the companion pi-daddy release with **exactly Pi 1.0.4** and
   the qualified captured setup (`PI_DADDY_HERDR=0`). Other Pi versions/backends need separate
   qualification. The selected package's generated `principal-agents.json` binds each phase
   to its skill and agent bytes. Native routing uses `delegate_describe` and the captured
   `definitionId`; refusal or failure cannot fall back to a legacy runner or inline execution.

2. **Legacy subagents (optional).** A configured legacy runner can use the five definitions
   when native tools are genuinely absent. Native delegation needs no separate agent install.
   Use the same npm package version as the installed skills:

   ```sh
   npx -p principal-pi-skills@4.8.1 principal-pi-agents install
   npx -p principal-pi-skills@4.8.1 principal-pi-agents check
   ```

   Alternatively run `scripts/install-agents.mjs` with Node from the actual selected npm
   package; resolve its path from Pi resources instead of guessing an installation directory.
   Source tags and npm publication are separate. Validate candidate installs in an isolated
   `PI_CODING_AGENT_DIR` before release; known behavioral qualification limits still apply.

   It installs `principal-plan`, `principal-build`, `principal-review`, `principal-debug`,
   and `principal-investigate` as **real files, not symlinks** — a symlink into a checkout breaks the
   moment that directory moves, and breaks silently, since pi just reports an unknown
   agent. It refuses to overwrite anything it did not install, and `uninstall` removes only
   its own unmodified files. Symlinked home/config ancestors resolve once to a canonical
   directory; agent and manifest leaf symlinks (including dangling links) still refuse.
   Installed agent files are `0644`; the ownership manifest is `0600`. Re-running `install`
   repairs the earlier `0600` agent mode only for unchanged owned files.

   **Ownership migration/recovery:** `install` no longer silently adopts byte-identical
   unowned files, and deprecated `--force` never bypasses validation or ownership. If only
   the manifest was lost and all five agents exactly match this package version, explicitly
   run `node <installed-package>/scripts/install-agents.mjs adopt`, then `install` (to repair
   unchanged owned file modes), then `check`. `adopt`
   creates only the absent manifest and leaves agent bytes/modes untouched; it refuses an
   existing manifest, partial sets, modified/older content and leaf symlinks. Unrelated files
   remain unclaimed. Keep any edited or older files and restore known-good metadata from
   your own backup; do not delete them merely to make installation pass.

   Tool restriction is structural, in the agents' frontmatter: `investigate` is read-only;
   `plan` is read-only except for its plan and creation of an absent `.principal/.gitignore`; `build`, `review`, and `debug` add
   `bash` to run tests (and, for `build`, to write and edit).

   Legacy runners differ in model forwarding. If a runner does not forward the parent's
   provider/model, check that runner's defaults and agent-frontmatter rules when a child
   cannot authenticate. Native delegation uses the matching pi-daddy runtime's resolved
   model and effort policy.

3. **Inline execution remains available when the workflow selects it.** The bootstrap
   supplies routing with the installed skills. Skipping the legacy agent installation does
   not disable native delegation, and a failed native handoff cannot silently become inline.

4. **With the matching pi-daddy candidate, each skill declares how much of the caller's
   session it may receive.** A child gets only the `context:` mode its own `allowed-tools` names (or a
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

   **Egress: know what `summary` enables.** `context:summary` also permits `pruned`,
   which can carry selected turns from the active parent branch to the delegated child's
   provider. The matching pi-daddy candidate no longer uses an external advisor to choose
   those turns. Forwarded context still reaches the child and its provider; raising another
   skill's ceiling extends that exposure to it.

## Coordinator evidence handoffs

Before native delegation, save the complete unmodified `delegate_describe` response in a private
handoff report and retain accessible references to the actual selected skill/agent files and
package manifest. Resolve their paths from selected Pi resources, verify the binding hashes,
and preserve original paths/hashes when copying bytes into a child workspace. The handshake
contains identity data, not source paths or new authority. Pass the files, not a prose substitute.

Each gate records its owner and due stage. A typical assignment is:

| Due stage | Owner | Required observations |
|---|---|---|
| Before dispatch | Coordinator | Actual authority, selected definition and permitted runtime configuration |
| During implementation | Builder | Due source requirements, scope, tests, candidate identity and full report |
| After builder return | Coordinator | Complete native result, report and terminal/cleanup evidence |
| Candidate review | Reviewer | Exact candidate, applicable source requirements, supplied evidence and verdict |
| After reviewer return | Coordinator | Reviewer settlement, then authorized integration and final verification |

This example cannot change source-required ordering. A leaf reports later coordinator gates as
pending and does not certify its future exit or call tools it lacks. Missing evidence required
for current work still blocks. Every dependent step waits for the coordinator's actual return
checks. Final integrated review preserves global obligations; a task verdict covers only its scope.

## Reports and manual progress

Use the installed `principal-pi-progress` helper when a coordinator needs repeated report
allocation/persistence. It creates private unused candidate directories beneath ignored
`.principal/reports/`, writes complete `.md` reports exclusively, and appends a small
`progress.jsonl` index. It preserves an existing ignore policy and refuses an exposed path.
Progress tracking is optional; when used, all index writes must go through the installed helper.
Never hand-write its `run.json` or `progress.jsonl`. Plan's write ceiling and Investigate's
read-only ceiling do not grow. If the binary is not on PATH, invoke
`node /actual/selected/principal-pi-skills/scripts/progress-artifacts.mjs` with the same arguments,
resolving the package from the selected Pi resources. Do not guess paths or fetch/install a helper.

```sh
principal-pi-progress create /path/to/repo task-name '<actual candidate identity>'
# Set RUN to the decoded returned path; use the same caller-established identity below.
principal-pi-progress report "$RUN" step-1-build.md < complete-report.md
principal-pi-progress reference /absolute/path/to/plan.md
principal-pi-progress append "$RUN" < record.json
principal-pi-progress check "$RUN" '<actual current candidate identity>'
# For diagnostics only (read reports issues but does not fail its exit status):
principal-pi-progress read "$RUN" '<actual current candidate identity>'
```

`report` and `reference` return `{ "path": "/absolute/path", "sha256": "<64 hex>" }`.
A version 1 record has exactly these fields (replace `REPORT_REF` with that returned object):

```json
{
  "version": 1,
  "plan": null,
  "step": "impl:S1",
  "candidate": "<actual candidate identity>",
  "facts": {
    "planned": { "state": "unknown", "evidence": [], "note": "No separate plan" },
    "implemented": { "state": "complete", "evidence": ["REPORT_REF"], "note": "Implementation saved; review pending" },
    "reviewed": { "state": "unknown", "evidence": [], "note": "Not reviewed" },
    "integrated": { "state": "unknown", "evidence": [], "note": "Not integrated" },
    "verified": { "state": "unknown", "evidence": [], "note": "Qualification not run" }
  },
  "findings": [],
  "nextAction": "Request task review"
}
```

`plan` is null or a file reference. Every fact has `unknown`, `incomplete` or `complete`
state, evidence references and an honest note; complete needs evidence. A completed review
means the review occurred, and its note must retain the verdict, including CHANGES-REQUESTED.
Each finding has `id`, `source` reference and `status` (`open`, `addressed`, `verified`,
`accepted`, `disputed`, `duplicate`, `stale`); a duplicate also names `duplicateOf`. Preserve original
review baseline/definitions and PR comment URLs/IDs in the referenced complete reports.

Run `check` after each append and before relying on a resumed or final index. Its explicit
candidate argument is a caller assertion, not a Git snapshot. It returns `integrityValid` plus
the same top-level/per-record reconciliation as `read`; any issue makes `check` exit nonzero.
A valid index can honestly contain unknown/incomplete facts and a completed CHANGES-REQUESTED
review. Success means schema/reference consistency only; inspect every relevant step's required
phases, actual verdict and current authority separately before claiming completion or integration.

The coordinator is the single writer. Save the report before appending progress; an append
failure preserves that report and leaves progress incomplete. Never force-clear a writer
lock. Reads return the original records plus independently assessed facts/issues: changed or
missing files, changed/unconfirmed candidates and malformed/incomplete records remain
unresolved. An incomplete final JSONL line is ignored/reported, never promoted to complete;
preserve its bytes and start a new run if needed. Reconcile records by step, not just the
last line. No helper claim proves its evidence's meaning, model judgment, approval or broad
candidate equivalence. It neither computes candidate identity nor resumes/runs tasks. Check
actual user authority/current work before choosing the next action; a title, role, commit or
self-authored boolean cannot grant approval. This is a trusted-coordinator filesystem helper,
not hostile-process containment or an atomic multi-file transaction.

## Future JEV and LoRA integration

The useful initial decisions are whether to stay inline, which approved independent steps to
group, and whether a handoff has its required inputs. An optional JEV evaluator can later consume
explicit task context, eligible actions, gate owner/due-stage maps and referenced observations
in an offline or shadow experiment. Candidate/step IDs and source hashes let it join suggestions
to actual correctness, review, completion, latency and cleanup outcomes without inventing labels.
The existing version 1 progress contract remains unchanged; version any advisory record separately.

Advisory output never grants permission, changes a required gate, replaces deterministic evidence
validation or triggers a fallback. Keep missing evidence, failures and incomplete workflows in the
evaluation. Later LoRA training requires reviewed, eligible examples and separate held-out evaluation;
private reasoning and credentials are excluded. No JEV service, training job, automatic collection
or OpenAI Decisions integration is activated by this patch.

## Validation

`npm test` remains the free gate: generated-contract drift, word budgets, frontmatter lint,
installer and tarball behavior, `Next:` transition parity, and deterministic source-fidelity
contract assertions. These check current product contracts, not model behavior or instruction delivery.

Behavioural measurement—including the requirement-fidelity corpus and skill-harness evidence—lives in [principal-pi-skills-evals](https://github.com/mojomanyana/principal-pi-skills-evals); routing checks live here. Its [current frozen-rubric baseline](https://github.com/mojomanyana/principal-pi-skills-evals/blob/main/BASELINE.md) reports DeepSeek V4.1 Flash at 56/158 (35%) with 2 infrastructure-error scenarios and Nemotron Lightning at 28/158 (18%) with 12; infrastructure errors are retained as non-passes, and both subjects remain NOT READY across all eight skills. These observations include disclosed infrastructure gaps and do not change this package's runtime contracts.

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
| Routing delivery | request-local bootstrap after selected-resource discovery; quoted markers do not suppress it |
| Build delegation | bound native phase, or explicitly configured legacy runner when native tools are absent; inline is a workflow choice |
| Plan persistence | multi-step plans to git-ignored `.principal/plans/<slug>.md`; titles locate candidates, while manual resume checks actual authority, current work and evidence |
| Decide vs architect | both kept; decide answers "should we / which", architect answers "how is it structured" |
| Measurement | behavioural measurement lives in [principal-pi-skills-evals](https://github.com/mojomanyana/principal-pi-skills-evals); routing checks stay here |

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

The Debug inline budget includes three generated frontmatter words that mark Principal package identity; missing or replaced package metadata must refuse native binding rather than downgrade to inline instructions.

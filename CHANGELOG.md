# Changelog

## 4.13.0 — 2026-10-09

- Save the exact captured native child final through `principal_workflow complete`, with session/workspace ownership checks, hash verification and exclusive report paths. Requires pi-daddy 0.49.0. Prepared handoffs provide verified report/artifact directories; `result` inspects a settled native final without writing workflow bookkeeping.
- Add a focused `test-review` skill and native binding for behavioral assertions, error semantics, queue/capacity boundaries, determinism and redundant tests. Review may use it within one review or as a separate child when useful; no mandatory extra agent or coverage/count quota.
- Shorten feature/refactor workflows and handoffs. A clear authorized feature can use Build then Review directly; evidence reconciliation does not require an implementation repair. Preserve original authority and independently verified settlement.
- Ask optional JEV advice about the selected stage, next action and unresolved engineering judgment. Expose a session-bound canonical candidate observation for Harness, without granting review approval or training eligibility.

## 4.12.0 — 2026-10-09

- Add deterministic `principal_workflow` candidate observations, private handoffs and exclusive report allocation. Repeated native operations reuse verified references; explicit retries preserve old attempts and require settled or never-started runtime evidence. Completion checks the actual child workspace and never grants semantic approval. Requires pi-daddy 0.48.0 for native operation completion.
- Route missing evidence to coordinator reconciliation with `Next: evidence`; keep concrete code/test defects in Build. Shorten shared workflows and reports, preserve existing user authorization, and remove the fixed repair-round quota.
- Separate focused test-quality review from production-code judgment without requiring another agent or a test-count/coverage target.
- Reuse Pi's native executor through `principal_codemode` with tool calls only, normal nested hooks and no model globals. Host packages are optional wildcard peers.

## 4.11.2 — 2026-10-09

- Report the loaded Principal package version through Pi's native event bus for the ecosystem dashboard. Keep it distinct from package files updated on disk and detach the reporter when the extension shuts down. No package installation or workflow execution is triggered by version queries.

## 4.11.1 — 2026-10-08

- Let a small coherent feature run as one complete build, including tests and documentation, followed by independent integrated review. Split work at real dependencies and risks rather than imposing a minimum task count.
- Make Build responsible for simple, readable, maintainable design within the approved outcome and constraints. Review engineering choices and test quality explicitly; neither coverage nor test-count quotas substitute for behavioral evidence.
- Use compact current handoffs and direct authority references, retain unresolved findings, and reuse unchanged verification evidence. Avoid recursive historical reads, invented task budgets and repeated equivalent checks.
- Copy original report and receipt bytes into private ignored evidence storage with expected-hash validation and no overwrite. Reuse the existing candidate snapshot helper; byte integrity does not grant approval or prove settlement.
- Honor an already stated finish preference and describe an uncommitted working tree accurately.

## 4.11.0 — 2026-10-08

- Allocate delegated reports in the actual child workspace's ignored report directory. Archive verified copies through the coordinator without asking the user to resolve ordinary report placement.
- Let the coordinator discover session-enabled JEV workflow advice through `jev_advice`, select useful acceptance-evidence questions, and keep predictions outside independent review until its verdict. Advice remains optional and cannot approve integration or create training labels.
- Resolve the workspace helper from the selected installed Principal package instead of relying on an npm download or shell PATH lookup.

## 4.10.1 — 2026-10-08

- Hash each unique progress-evidence file once per reconciliation, while checking every expected digest and rejecting files changed or replaced during the pass.

- Wait for the exact finalized Pi resource-discovery receipt before consuming an armed resume checkpoint. Later asynchronous resource handlers, stale discovery passes and shutdown cannot trigger premature continuation.
- Inspect checkpoint state first so inactive history does not repeatedly hash the worktree; fully revalidate the one armed candidate before consumption.
- Correct the npm resume walkthrough to invoke the helper from the selected installed package.

## 4.10.0 — 2026-10-08

Add explicit operator-authorized one-shot continuation at a quiescent workflow checkpoint. Bind the exact source bytes, plan, reports, selected package, session leaf, model, repair budget and reconciled pi-daddy settlement history. Consume the checkpoint before enqueue; changed state, unknown children or interrupted delivery refuse automatic replay. Ship `principal-pi-resume` and `/principal-resume` through npm.

All notable changes to this framework are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

Where review revealed a prior claim or design decision didn't hold up under closer inspection, this changelog says so explicitly. The history of the framework's own thinking is part of the framework.

---

## [4.9.0] — 2026-10-08

**Added — deterministic committed-workflow checks.** `check-completion` now checks every explicitly
required step's latest five phase claims, full evidence history, outstanding finding identities,
exact full HEAD and clean tracked/untracked/submodule state. Masked index entries are refused
without clearing flags; any indexed submodule is explicitly unsupported rather than assuming
its nested working state is visible. Previously `check` established only
index integrity; that command and the version 1 schema keep their existing semantics. Omitted
findings cannot disappear; accepted/duplicate dispositions still need explicit verification.
No checker runs tests, commits, grants approval or declares semantic task acceptance.

**Documented — exact native evidence references.** Companion pi-daddy 0.45.0 offers operator-enabled
public response/source capture. Workflows now consume those returned file references directly;
previously coordinators had to preserve tool outputs themselves and could transcribe them.
The capture boundary excludes raw details, private sessions and later Pi hook formatting.
Capture remains opt-in; no JEV service, automatic collection or LoRA training is activated.

## [4.8.1] — 2026-10-07

**Fixed — coordinator and leaf evidence ownership.** Preserve describe/source handoffs and assign
gate owners/due stages without postponing source-required prerequisites. Leaves verify current
obligations and retain later coordinator terminal/cleanup/review checks as pending. The coordinator
checks every child, including reviewers, before consuming their results. Require a settled
process receipt even without a disposable workspace; use companion pi-daddy 0.44.4, which exposes
that runtime evidence to the coordinator model.

**Fixed — progress integrity at phase boundaries.** Optional progress indexes must use the installed
helper. New `check <run> <candidate>` reports reconciliation and fails on malformed/stale evidence;
diagnostic `read` retains its existing behavior. Valid incomplete records and review verdicts remain
separate from approval/completion. Original failed indexes are preserved, not rewritten.

**Documented — complete Pi setup.** Pin all three npm packages and enable Pi's built-in discovery
tools through `defaultTools` when planning/review needs them. Plan keeps its existing shell/write
ceiling; helper execution belongs to the coordinator after planning.

**Documented — future advisory seam.** Gate ownership and existing candidate/step/source references
can support separately versioned JEV evaluation and eligible LoRA datasets later. This release adds
no model service, automatic collection, training or execution authority.

## [4.8.0] — 2026-10-07

**Fixed — installer compatibility without ownership bypass.** Symlinked directory ancestors
resolve to canonical anchors before ownership checks; agent/manifest leaf links still refuse.
Installed agents use `0644` and ownership metadata uses `0600`. Explicit `adopt` recovers a
missing manifest only for a complete byte-identical current agent set. `install` never
silently adopts; deprecated `--force` now explains that it cannot bypass ownership.

**Fixed — selected routing and parallel dispatch.** A stale foreign skill path cannot latch
all Principal routing off. Native workflows name `build`/`review`/other phases with captured
`definitionId` values and dispatch independent batches through `delegate_all`, with isolated
writer worktrees and serial integration. Compatibility is qualified for exactly Pi 1.0.4
and the companion pi-daddy 0.44.0 release, not unknown runtime versions.

## [4.8.0-rc.1] — 2026-10-07

**Added — native phase identity and request-local routing.** Generated
`principal-agents.json` binds all five delegated phases to their skill and agent hashes.
The bootstrap keeps Principal package identity, uses the selected native definition ID,
and refreshes routing after resource discovery, reloads and compaction. It deduplicates
its own request-local messages without treating quoted markers as routing state, and
retains read failures rather than silently selecting a different contract.

**Changed — concrete workflow contracts.** Planning records interfaces and checks where
needed; Decide and Architect avoid invented options or patterns. Build preserves behavior
and coverage during refactors, Review supports scoped review and repair, and diagnosis
hands implementation and verification back to Build. Eligible small changes can stay inline.

**Added — manual progress and complete reports.** `principal-pi-progress` stores ignored,
candidate-bound full reports and a strict evidence index. Exact metadata validation prevents
report redirection. Stale or incomplete records remain explicit; the helper neither grants
approval nor resumes work automatically.

**Fixed — installer ownership and recovery.** The installer validates the entire ownership
manifest before mutation and refuses malformed, foreign, edited or symlink targets, including
with `--force`. Git recovery instructions preserve staged, unstaged, untracked and ignored
content rather than assuming a patch alone captures the working state.

**Compatibility.** This prerelease targets stable 4.8.0. Native delegation requires the
companion pi-daddy 0.44.0-rc.1 candidate's `delegate_describe`/`definitionId` protocol and the
qualified Pi 1.0.4 setup. A configured legacy runner is available only when native tools are
genuinely absent; native failure cannot silently fall back. Existing installs require explicit
activation. Tag creation and npm publication are separate; this entry does not assert either.

**Validation.** `npm test` covers 168 unit and 33 install tests, generated outputs, word
budgets, package contents and skill lint. Companion runtime qualification exercises the
actual Pi 1.0.4 SDK/bootstrap and all five native phases with a local scripted provider.
These checks establish behavior and wiring, not model quality; behavioral measurement
remains in `principal-pi-skills-evals`.

## [4.7.3] — 2026-10-06

**Changed — current release and measurement documentation.** Installation examples and
subagent pins now target the immutable `v4.7.3` release; before npm publication, the documented
registry latest is 4.7.2 and npm `@4.7.3` remains unavailable. Previously the documentation
still described 4.7.2 as unpublished after it became npm `latest`.

**Documented — external frozen-rubric baseline.** The README now links the current
[principal-pi-skills-evals baseline](https://github.com/mojomanyana/principal-pi-skills-evals/blob/main/BASELINE.md),
which records DeepSeek V4.1 Flash at 56/158 (35%) with 2 infrastructure-error scenarios
and Nemotron Lightning at 28/158 (18%) with 12. Infrastructure errors are retained as
non-passes, both subjects remain NOT READY across all eight skills, and the observations
include disclosed infrastructure gaps; they do not change or qualify the runtime package.

**Compatibility.** No skill, agent, prompt, bootstrap, generated contract, tool ceiling, or
runtime behavior changed from 4.7.2. Tag creation and npm publication remain separate.

## [4.7.2] — 2026-10-01

**Changed — behavioral measurement moved out (#59).** The requirement-fidelity corpus,
skill-harness specifications and results, retained evidence, replay tooling, and their
repository tests now live in
[principal-pi-skills-evals](https://github.com/mojomanyana/principal-pi-skills-evals).
Routing inputs and baselines remain here, and `npm test` now covers only current product and
contract behavior; previously this repository also retained the behavioral corpus and
historical evidence checks.

**Reaffirmed — the 4.0.1 boundary.** Behavioral measurement belongs in the external
measurement repository rather than this runtime package. PR #59 applies that original 4.0.1
decision to the later requirement-fidelity material instead of maintaining a local exception.
No skill, agent, prompt, bootstrap, or generated contract text changed.

## [4.7.1] — 2026-10-01

**Combined release candidate — all requirement-fidelity work and repairs (#58).** This
version contains the complete PR #58 feature described under 4.7.0 below, plus all subsequent
review and handoff repairs. The early `v4.7.0` tag at `448ac76` remains an immutable historical
candidate; it excludes later repairs. One new annotated `v4.7.1` tag identifies the final merged
tree, with package metadata and installation pins aligned. GitHub/npm publication is separate.

**Changed — safe, retrievable handoffs (#58).** Build now requires complete saved candidate
patches with private collision-safe paths, byte hashes and source identities; previously a
printed diff hash could leave the actual tested patch unavailable. Inherited material caveats
now survive or receive explicit disposition, and evidence references use current per-file
ranges. Safely saved complete inline reports now support concise summaries with visible
unresolved caveats; previously inline field requirements conflicted with short file-backed
replies. The delegated five-line return remains distinct and unchanged.

**Fixed — authority, artifact and workflow boundaries (#58).** Complete explicitly authorized
amendments now differ from guessed missing definitions; report writes now verify ignore policy
without overwriting existing rules; artifact namespaces avoid replacing prior findings; and
routing checks Review verdict before Next. Previously those boundaries could permit guessed
semantics, exposed/overwritten reports or improper repair routing. Captured read ordering and
replay lifecycle checks now reject the reviewed false-success cases. Tagged skills and agent
installation now use matching sources instead of an unpinned older npm package.

**Changed — evidence scope and honest validation (#58).** Evidence requests now prefer existing
checks/disposable probes rather than implicitly authorizing permanent infrastructure; ordinary
bugfixes still include enduring regressions. Product/install checks and opt-in archive checks
are separate. Historical raw failures, provider errors, source identities and old rubrics remain
unchanged; the current corpus has 46 cases, not a retroactive regrade of the earlier inventory.

**Validation — accepted bounded improvement, not full behavioral qualification.** Local checks
pass 153 unit and 24 install tests, plus 86 separate evidence checks. Latest Build force is
**4/9 NOT READY**. Three full captures verify actual red/green execution and saved patches, but
F11 still omits material caveats from its short reply and misses the literal persistence-stop
rule; collision robustness and F04 runtime reporting remain limited. Independent reviews approve
this documented increment, not a reliability guarantee. See
`evals/requirement-fidelity/evidence/build-handoff/README.md`. No release combines these results
into an all-PASS claim or proves normal loading/delegation, deployment or lower-cost robustness.

## [4.7.0] — 2026-09-30

**Changed — preserve requirements across skill handoffs (#58).** Plan now reads original
specifications and referenced definitions, preserves requirement identities separately from
implementation steps, and maps numbered requirements, unnumbered MUSTs and qualification
gates to steps and tests. Missing normative definitions now require handoff repair;
previously the assumption and no-stalling rules could permit guessed meanings. Complete
multi-step plans now live in files with short chat summaries; previously the contract
required duplicating the full plan in chat.

**Changed — source-bound implementation and review (#58).** Build and Review now carry
source references, requirement/gate status and tested-candidate identity. Workflows persist
complete inline Build reports as well as delegated reports and carry finding definitions
into repair; previously summaries, bare finding IDs and unbound test totals could lose
requirements or evidence gaps. Compression now preserves applicable evidence and caveats.

**Changed — selective skill composition (#58).** Investigate can supply optional factual
source discovery without choosing authority or replacing the source. Routing now consistently
sends choices to Decide, structure to Architect, and implementation order to Plan;
previously some workflow/bootstrap examples sent bare technology choices to Architect.
Decide and Architect now preserve binding constraints and expose load-bearing unknowns;
Debug distinguishes proposed fixes, disposable proofs and changes actually applied by Build.
Git-Ops safeguards and all tool/context ceilings are unchanged.

**Added — durable, opt-in regression evidence (#58).** A focused local corpus now retains
42 behavioral cases, a 76 KB specification with 51 obligation/gate entries, original model
results and captured artifacts. Previously focused harness scenarios were excluded from
this repository and the initial Plan checks were deleted. Model calls remain outside
`npm test`; fixtures and evidence remain outside the npm package.

**Validation — implementation reviewed, behavioral qualification incomplete.** The full
suite passes 128 unit and 23 install tests, plus generation, budgets, packaging and lint.
Independent review approved the implementation. Captured direct runs preserved the long
specification and exercised an Investigate → Plan → Build → Review chain, but retained
force-mode runs still include guessed definitions, forbidden-tool use and an unmeasured
capability claim. Spark was unavailable for the configured account. These results do not
establish universal reliability, lower-cost robustness or full behavioral qualification;
see `evals/requirement-fidelity/evidence.md`. No historical evidence is restamped as a pass.

## [4.6.0] — 2026-09-29

**Added — read-only investigation with cited facts (#56).** `investigate` reports how code,
data, runtime, or history currently behaves without changing, fixing, choosing, or giving a
merge verdict. PR #56 registered the eighth skill and its read-only agent at every install,
routing, packaging, and verification point; added a 25-record boundary corpus; narrowed
`git-ops` to repository actions; and recorded eight-skill routing baselines.

**Added — repository-native release mode (#57).** `git-ops` now reads the prior release and
replicates its branch, PR, commit, and annotated-tag shape; bumps every version occurrence;
writes the changelog in repository style; runs the full suite; and stops before publishing
with the repository's next publish command. PR #57 added the release boundary records and
refreshed both routing baselines.

**Changed defaults.** The installed set now includes `investigate`; previously factual
questions about the current repository had no skill. `git-ops` now handles “cut a release”
as a release mode; previously it had no explicit release workflow.

## [4.5.0] — 2026-09-29

**Routing by output, with stable evidence (#51, #52, #53, #54).** PR #51 moved the routing
model to `glm-5p3-flash` because `glm-5p2` is no longer deployed, and separated `debug` from
`git-ops` by what each produces. PR #52 made the collision check report STABLE (collided in
every run) and ANY (collided in any run) over three runs, and fail only on STABLE. PR #53
expanded the decide/architect/plan boundary corpus. PR #54 separated those three descriptions
by output — a choice with rationale, a system structure, or an ordered sequence of work — and
narrowed `decide`. The adversarial corpus grew from 34 to 54 records, and every label now
follows the rule that a skill is chosen by what it produces.

**Stronger delivery evidence and attribution.** `git-ops` stamps `Pi-Episode`,
`Pi-Definition`, and `Pi-Execution` trailers on commits when pi-daddy exports them. `build`
and `review` require the repository's full test command as evidence, rather than treating
focused checks as sufficient.

**Changed defaults.** None for users. Routing evaluations require `FIREWORKS_API_KEY` and now
default to `glm-5p3-flash`.

## [4.4.0] — 2026-09-23

**Added — local routing evaluation for the seven skill descriptions.** A shared loader reads
only authored `SKILL.md` frontmatter descriptions. Opt-in checks cover all 42 directed
pairwise collisions and a three-run trigger corpus with per-skill precision and recall,
collision-boundary cases, explicit `AMBIGUOUS` labels, and `NO_SKILL` hard negatives. Model
payloads use opaque case IDs and omit expected labels. CI can run both checks manually with
a Fireworks key. At the 4.4.0 release, the committed collision baseline recorded three
overlaps and the original trigger run was retained as pre-expansion evidence, not claimed
as a score for the expanded corpus because Fireworks was unavailable for that rerun.

## [4.3.0] — 2026-09-22

**Context-handoff ceilings for pi-daddy 0.33.0+.** pi-daddy made the context a delegated
child receives a capability the child's own `allowed-tools` must declare. None of the seven
skills declared one, so every delegation that asked for context was refused. Now:
`architect`, `decide` and `plan` declare `context:summary`; `build`, `debug` and `review`
declare `context:files`; `git-ops` declares none, deliberately. Review sits below the
"reasons about done work" level on purpose: a cold reviewer must not get the author's
reasoning. No skill body promised session context. Every input a contract names is task
text or a file the child reads. The README install section records each reason and the
egress consequence: with `pruned` allowed and an advisor on, operator turns go to a third
party. Verified against pi-daddy 0.38.0. Also: the install docs now name `v4.3.0` (they still said
`v4.1.0`), the README no longer calls `plan` read-only (it writes its plan file), and the
template comments point to the capability-ceilings decision on the `v3.2.0` tag, where it
still lives.

## [4.2.0] — 2026-09-21

**Cheaper loops, borrowed from superpowers' subagent-driven development.** A delegated
`principal-build` now writes its full report to `.principal/reports/<step>-build.md` and
returns five status lines, so reports stop accumulating in the steering context. Review is
handed a diff package (`git diff --stat` + full diff, one file) and the build reports; it
treats a verbatim `Full evidence:` line as test evidence and runs a test only for a named
doubt, instead of rebuilding a worktree and re-running the suite on every call. Repair rounds
resume the build agent when the tool allows and get a **scoped re-review** (agent form only):
each open finding ID is verdicted ADDRESSED or NOT ADDRESSED, new breakage is checked in the
fix diff alone. Plan batches same-shape edits across files into one step. The spines name
the model tier per review: strongest for the whole-change review, mid-tier for scoped
re-reviews. Skill forms of build and review are unchanged except review's evidence rule.

## [4.1.0] — 2026-09-21

**Added.** Two prompt templates. `/principal-refactor <scope>` is the feature spine with a
no-behavior-change frame: plan steps keep existing tests passing unchanged, uncovered behavior
gets a characterization test first, and review treats any observable behavior change as a
`[BLOCKER]`. `/principal-review-branch [base]` cold-reviews the current branch against `base`
(default `main`) with `principal-review`, runs git-ops finish mode on APPROVE, and stops with
findings otherwise; it has no plan or build phase and is hand-written rather than generated.
All four prompts now carry an `argument-hint` for pi's autocomplete. The bootstrap and
AGENTS.md name the two new commands. No skill or agent text changed.

## [4.0.1] — 2026-09-21

Removed the seeded `<skill>/tests/fixtures/` trees (build, debug, git-ops) and the
fixture-hygiene unit test that guarded them. They were kept in 4.0.0 as raw material for an
external measurement repo, which will start from scratch instead; they remain on the `v4.0.0`
tag. Also removed `docs/` entirely — the historical demo transcripts, the 4.0 design spec, and
its task plan — and folded the spec's rationale and closed decisions into a new "Why 4.0"
section of the README. Architect's design-note template loses two labels' leftover profile
vocabulary (`Critical validation/observability` → `Validation/observability`, `Critical
rollback/abort` → `Rollback/abort`, "critical consequential work" → "a high-stakes one-way
door"); no other skill, agent, prompt, or bootstrap text changed.

## [4.0.0] — 2026-09-21

**Breaking.** The assurance controller (`principal-pi-assurance`), its schemas, and the
`--assurance` / `--critical-scope` flags are gone; they move to pi-daddy. The generic
`plan`/`review`/`debug` agents and `/feature` `/bugfix` prompts are removed; only
`principal-*` names ship. Skill-harness specifications, results, E2E cells, and the v2.4
board are removed; measurement restarts in a separate repository.

**Added.** A pi extension injects a 300-word routing bootstrap at session start and after
compaction. Both workflows stop for approval after planning, write multi-step plans to
`.principal/plans/`, resume from that file, and may delegate build per step to the new
`principal-build` agent. Debug fans out over independent failures. Build's repair mode
covers human review feedback.

**Changed.** Plan loses the Critical contract; review's header is verdict, workspace,
verified, findings, top concern; git-ops finish mode is a fresh suite plus three choices;
decide and architect are separated by output rather than topic.

**Migration.** Reinstall agents: `npx -p principal-pi-skills principal-pi-agents install`
(four files). Drop any `--assurance` flag from saved prompts; it is no longer parsed.

## [3.2.0] — 2026-09-11

**Changed — ordinary assurance status is current by default.** `report --format human` and the no-format default now render the existing `current-v1` applicability semantics for current, stale and superseded task/check evidence. The original all-history report remains byte-preserved as `--format human-legacy`; explicit `current-v1` JSON and in-toto machine formats are unchanged.

**Compatibility — presentation default only.** Native assurance gates, event replay, acceptance semantics, generated skill/agent/prompt text, external compatibility adapters and the 28-file npm package boundary are unchanged. A current status is not retrospective truth or human acceptance.

**Changed — release evidence remains static and model-free.** No skill, prompt or agent text changed from 3.1.0, and no 3.2.0 model score is claimed. Deterministic unit, generated-contract, clean-install, pack and lint checks are the release evidence. Preparation evidence (2026-09-11): `v3.2.0` was pending and npm `latest` was `3.1.0`; check live status with `npm view principal-pi-skills version dist-tags --json` and the [GitHub release](https://github.com/mojomanyana/principal-pi-skills/releases/tag/v3.2.0).

## [3.1.0] — 2026-09-11

**Added — opt-in current evidence applicability projection.** The shipped assurance CLI now supports
`report --format current-v1`, a deterministic read-only projection that distinguishes current,
failed, missing, stale, and superseded evidence for cross-repository consumers. Bounded descriptor
reads protect the opt-in replay path. Existing default human and in-toto report bytes, native gates,
acceptance semantics, and ordinary ledger loading remain unchanged.

**Validated — explicit cross-repository compatibility without expanding this package.** Source-only
host adapters, native-reference journals, generic lifecycle envelopes, and pinned compatibility
fixtures prove structural association with existing work views, receipt claims, check lifecycle, and
caller-owned payload archive seams. They do not authenticate approval, grant execution authority, or
package peer implementations. Those helper scripts and contracts are deliberately not shipped in the
npm artifact; the package remains exactly 28 files and ships Principal's assurance projection only.

**Fixed — Principal journal diagnostics remain attributable.** Journal/context failures retain their
specific `REFERENCE_*` codes through the reader, projector, and CLI instead of blaming the native
ledger. Well-formed noncanonical journal entries are distinct from invalid JSON. Validation remains
fail-closed and historical journals are never rewritten.

**Changed — release evidence remains static and model-free.** No skill, prompt, or agent text changed
from `3.0.1`, and no 3.1.0 model score is claimed. Deterministic unit, generated-contract, clean-install,
pack, and lint checks are the release evidence. Preparation evidence (2026-09-11): the remote
`v3.1.0` tag was pending and npm `latest` was `3.0.1`; this records preparation, not current
publication state. Check live status with `npm view principal-pi-skills version dist-tags --json` and
the [GitHub release](https://github.com/mojomanyana/principal-pi-skills/releases/tag/v3.1.0).

## [3.0.1] — 2026-09-04

**Added — assurance ledgers have a read-only evidence projection.**
`principal-pi-assurance report --run-id <id>` renders authority, packets, changed paths, receipts,
reviews, recorded gate outcomes, findings/adjudications, and finish identity in deterministic human
sections, with absent facts and assumptions labelled rather than inferred. It also emits an unsigned
in-toto Statement v1 using the test-result v0.1 predicate; final head/tree subjects, receipt-derived
configuration and pass/fail lists, and the ledger hash-chain head bind the output to facts already in
the validated log. `--format in-toto` emits only Statement JSON. The command does not append events,
sign output, or claim a signature.

**Added — gate outcomes are recorded, not just printed.** `principal-pi-assurance gate` now appends a
`gate_evaluated {gate, code, missing_count, task_id?, action?}` event for every evaluation it performs,
pass or block. The gate was a pure read, which is precisely why no downstream observer could prove that
a gate ran or how it answered; a completion claim and an unexamined run were indistinguishable in the
ledger. Because the workflows already invoke the gate at each control point, recording inside the
command required no workflow or skill text change. The event is an observation: it mutates no derived
state, so it cannot advance `last_change_seq` or `last_authority_seq` and can never make a receipt
stale, and it is accepted after `finalization_completed` so the `finish` gate can record its own
outcome. `missing_count` is recorded rather than the missing-control strings, which are human
diagnostics and not a machine contract. A ledger containing this event requires this version or newer
to replay. Rationale and the downstream assertion mapping: `docs/handoff/2026-09-event-vocabulary-decision.md`.

**Fixed — fail-closed measurement classification.** A closed machine-readable manifest now
classifies all 205 committed `results.yaml` files exactly once and binds each entry to its
raw SHA-256. The Terra-high control, unpinned-executor infrastructure failure, and
subprocess-pinned delivery-unproven run are explicitly excluded from efficacy, stability,
release, and v3 scoring. Historical result payloads are unchanged.

**Added — external per-observation attestation verification.** A development-only verifier
accepts canonical Ed25519 attestations only from explicitly configured operator-trusted
production keys. A closed arm policy and canonical strict future-result contract bind one
accepted attempt to one result/scenario/repetition; complete trust stores are eagerly checked,
and an in-memory validation-session registry atomically rejects replay across all evidence sets.
Missing, extra, stale, future, replayed, mismatched, refusal-only, incomplete, capability-only,
or invalidly signed evidence fails closed. Durable operational replay prevention remains the
external producer/controller's responsibility. No private production key is stored here. The external producer
remains responsible for signing-key protection, ledger authenticity, runtime identity,
loaded-definition and artifact/module confinement, process-tree containment, and any OS
sandbox.

**Fixed — Critical Plan task definitions are concrete and attributable.** Critical plans now
keep authority/scope before tasks, require named tests and literal targeted Done commands,
separate Plan definitions from controller-owned canonical packet identity/digest fields, and
forbid assurance-only delivery slices. With no repository context they propose concrete values
as assumptions and require discovery/validation before execution rather than emitting
placeholders or claiming guessed paths exist. `Done command` is explicitly declarative and untrusted:
this version provides no deterministic command or approval enforcement. Deterministic mutation
coverage is structural only; a fresh Wave A remains required for behavioral
validation. `docs/evidence/pr35-e1-repair-provenance-v1.json` hashes the E1-informed evidence,
including contextual D1/D2 diagnosis material; preserved measurements are unchanged.

**Changed — release evidence does not claim model measurement.** `3.0.1` contains three
generated Plan runtime prompt changes, the explicitly authorized assurance-state additions, and
Decide's approved P4 text; other shipped runtime schemas, scripts, skills, agents, and prompts remain
byte-identical to `3.0.0`. No 3.0.1 model score is claimed: deterministic/static checks are the
release evidence, while the required DeepSeek/GLM wave and live workflow cells remain unrun. The
remote `v3.0.1` tag and npm `latest` were independently verified after publication.

## [3.0.0] — 2026-08-20

**Added — risk-adaptive assurance profiles on the two existing workflow spines.** `standard`
remains the default Option B behavior; `lean` preserves the tiny/reversible path; explicit
`critical` (and `high`) activates selected Option C controls. `--critical-scope` accepts an
entire run, task IDs, or path globs. Natural-language critical/escalation requests map to the
same state. No skill or public agent name was added: the set remains decide, architect, plan,
build, review, debug, git-ops.

**Added — deterministic assurance state outside the product tree.**
`principal-pi-assurance` validates versioned run-state/task-packet/evidence-receipt schemas, appends a
SHA-256-linked JSONL event log, atomically derives a snapshot, enforces legal transitions and
explicit downgrade, matches critical scope, detects stale evidence after source changes, and
returns `BLOCKED_CRITICAL_ASSURANCE` with missing controls. State is under git's common
directory (XDG state outside git), so Plan/Review/Debug retain their read-only/disposable
workspace contracts and Build remains the only durable source writer.

**Changed — critical workflow controls.** Consequential design approval includes validation,
observability, rollback, abort, and one-way doors; plans carry authority and independently
verifiable task packets; an independent plan critique precedes Build; an owned isolated
branch worktree is mandatory; each task receives separate fresh specification and
quality/security reviews rooted at the canonical writer checkout; a final fresh whole-change review
follows all task evidence. Mid-run escalation freezes base/head/candidate-tree and backfills exact
matching receipts before more source writes. Approved replans explicitly supersede immutable stale
packets rather than silently rebinding them.
Irreversible/external effects require just-in-time user approval. Critical never degrades to
inline self-review when fresh-context infrastructure is absent.

**Changed — standard and repair/finish discipline.** Standard remains the normal spine with
vertical slices, dependency/interface preflight, one writer, milestone/final review,
evidence-based finding adjudication, fresh verification, and an explicit finish choice.
Build repair mode consumes accepted finding IDs one at a time. Git-Ops finish mode offers
merge locally, push/open PR, or keep, runs a pre-operation readiness gate, and persists final
branch/head/tree before the completion gate; discard remains explicit. Tiny work does not acquire
architecture machinery unless the user explicitly selected critical.

**Changed — workflow and dual-use generation.** Both namespaced prompts now render from
`contracts/workflows.md.tmpl`, with a test proving their assurance rules are identical.
Plan/Review/Debug continue to render skill, namespaced agent, and generic alias from their
existing templates. All capability ceilings are unchanged.

**Added — free assurance coverage.** Unit tests cover parsing/defaults, policy escalation,
explicit downgrade, scope matching, legal events, missing-control blocks, evidence freshness,
review-context/workspace/tree independence, JIT approval, readiness/finalization, event-log
integrity, Draft 2020-12/runtime schema parity, and branch-attached workspaces. The E2E harness now defines standard/critical ×
feature/bugfix × subagents present/absent; critical/absent asserts a clean block. Seven `E1`
skill-harness scenarios plus a Git-Ops stale-receipt negative are prepared but deliberately not
model-run; no skill-harness/live E2E validation was authorized, so v2.4 measurements are historical
and v3 publishes no model score yet.

**Fixed — npm 12 pack metadata compatibility.** npm 12 changed `npm pack --json` from an
array to a package-keyed object, which made seven clean-home install tests fail before this
work began. Pack checks, install tests, and E2E now normalize both shapes and still fail on
empty/malformed metadata.

**Fixed — the `v2.4.0` git tag never existed.** 2.4.0 was published to npm on 2026-08-16, but
no tag was cut, so `pi install git:github.com/mojomanyana/principal-pi-skills@v2.4.0` — the
immutable install command README and AGENTS.md both printed, and the one thing this project
tells users to prefer over a moving branch — resolved to nothing for four days. The tag is
backfilled at the release commit it always belonged to (`4dece8c`), and tagging now precedes
publishing. It is the same failure as 2.3.1's 404'ing npx invocations: a documented command
nothing executed.

**Changed — released with the measurement gap stated, not closed.** `3.0.0` ships statically
verified and unmeasured, and every document that could be read as a claim now says so at the
point of reading: the README install step, `docs/ASSURANCE.md`, `docs/validation/VALIDATION.md`,
and the handoff verdict (both removed in 4.0). All 101 skill-harness findings are exempt-stale
against the v3 text — that is the honest state of a v3 cell, not a passing one. The authorized
two-model wave and the live eight-cell E2E remain the work that would replace the historical
v2.4 board with a v3 one.

**Changed — `ajv`/`ajv-formats` are the first devDependencies.** The Draft 2020-12 parity test
needs a real validator. Runtime install stays dependency-free — they are not in the pack
allowlist — but `npm test` in a fresh checkout now requires `npm ci` first, where before it ran
on a bare clone.

---

## 2.x and earlier (summary)

Versions 1.0 through 2.4.0 built the seven skills, the dual-use skill/agent generator,
the `Next:` handoff vocabulary, the namespaced agents and prompts, the safe agent installer,
the disposable-worktree tool, and the skill-harness measurement board. 2.3.0 is deprecated
on npm for a destructive `principal-pi-workspace remove` defect; 2.3.1 is the lowest safe
version. The full entries are on the `v3.2.0` tag.

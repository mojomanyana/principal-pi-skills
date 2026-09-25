# Changelog

All notable changes to this framework are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

Where review revealed a prior claim or design decision didn't hold up under closer inspection, this changelog says so explicitly. The history of the framework's own thinking is part of the framework.

---

## [4.4.0] — 2026-09-23

**Added — local routing evaluation for the seven skill descriptions.** A shared loader reads
only authored `SKILL.md` frontmatter descriptions. Opt-in checks cover all 42 directed
pairwise collisions and a three-run trigger corpus with per-skill precision and recall,
collision-boundary cases, explicit `AMBIGUOUS` labels, and `NO_SKILL` hard negatives. Model
payloads use opaque case IDs and omit expected labels. CI can run both checks manually with
a Fireworks key. The committed collision baseline records three overlaps; the original
trigger run is retained as pre-expansion evidence, not claimed as a score for the expanded
corpus because Fireworks was unavailable for that rerun.

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

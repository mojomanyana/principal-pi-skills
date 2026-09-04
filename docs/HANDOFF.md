# Handoff 1 — v3 risk-adaptive assurance

**Status:** `3.0.1` published; remote `v3.0.1` tag and npm `latest` independently verified
**Updated:** 2026-09-04
**Source manifest:** `3.0.1`
**Install:** `pi install git:github.com/mojomanyana/principal-pi-skills@v3.0.1`
**Previous published release:** `3.0.0` (2026-08-20)
**Branch:** merged to `main` via [PR #31](https://github.com/mojomanyana/principal-pi-skills/pull/31)
**Base SHA:** `4dece8ca35648725234c7dc2eadead95cd084b07`

PR #31 merged on 2026-08-19 (`b28a8d5`, CI green) and `3.0.0` was tagged and published on
2026-08-20 with its evidence gap open and stated rather than closed. Release `3.0.1` adds
fail-closed result classification, external-attestation verification, assurance-ledger evidence,
concrete Critical Plan contracts, Decide path classification, tests, and documentation. It keeps
the model-measurement gap explicit rather than attaching historical v2.4 scores to changed prompts.

All 205 committed result files are listed in `docs/validation/RESULTS-MANIFEST.v1.json` with
raw SHA-256 and explicit participation flags. Terra-high Wave 0 is exploratory only: the control,
unpinned-executor infrastructure failure, and subprocess-pinned delivery-unproven run are all
excluded from efficacy, stability, release, and v3 scoring. No current pi-daddy result has a
compatible external per-observation attestation, so valid treatment count is zero. Future treatment
requires a closed enabled arm policy, canonical strict result, complete arm-bound trust store,
exact observation/attestation bijection, and one atomic in-memory replay check across the complete
validation session. A fresh session may revalidate the corpus; durable operational replay
prevention remains the external producer/controller's responsibility.

principal-pi-skills verifies external producer claims; it does not run artifacts, supervise
children, protect signing authority, authenticate ledger production, prove loaded runtime state,
or provide module/process/OS containment. Same-UID isolation and a real OS sandbox are not claimed.

Two packs generated from the exact tagged `3.0.1` release tree are byte-identical at
SHA-256 `d4121d6e16fc223573a9a9b0838ad0649464d8e7221e3599d443314c75dee358`
(114,374 bytes compressed; 384,223 bytes unpacked; 28 files). Published `3.0.0` packs at
`9ce4ab10…fff` (105,706 bytes). The nine changed packaged files are `AGENTS.md`, `CHANGELOG.md`,
`README.md`, `package.json`, `agents/{plan,principal-plan}.md`, `decide/SKILL.md`,
`plan/SKILL.md`, and `scripts/assurance-state.mjs`; the other 19 packaged files are byte-identical.
Paid skill-harness
subjects/judges and the live workflow E2E cells are still unrun; they remain authorized-later
work, and nothing in this repository may present the v2.4 board as v3 evidence. Sections 2–7
below are the durable cross-repository contract and stay valid as written; sections 8–11 carry
the release state.

## 1. State of the implementation

The v3 implementation keeps the seven public skills and the two namespaced workflows. Option B
remains the default `standard` behavior. `lean` and `critical` are explicit profiles; `high` aliases
`critical`. No public skill or agent name was added.

The architecture is split deliberately:

- `contracts/workflows.md.tmpl` is the shared orchestration contract and generates both namespaced
  prompts plus the two deprecated aliases as complete workflows; aliases never rely on recursive
  slash-command expansion.
- `scripts/assurance-state.mjs` owns deterministic parsing, event replay, transition validation,
  persisted state, scope matching, evidence freshness, and gates. It does not route skills or call
  models.
- `schemas/assurance-{run-state,task-packet,evidence-receipt}-v1.schema.json` are the portable data
  contracts.
- Plan/Review/Debug retain generated skill/agent twins. Build is the only phase allowed durable
  source writes. Git-Ops owns finalization.
- `principal-pi-workspace create --branch <name>` creates branch-attached Build worktrees; detached
  snapshots remain the disposable Debug/Review default.

The baseline was clean `main...origin/main` at the base SHA above (release `2.4.0`). Baseline
`npm test` had 49 passing unit tests and seven install failures caused by npm 12 changing
`npm pack --json` from an array to a package-keyed object. `scripts/pack-meta.mjs` fixes that
pre-existing compatibility failure for npm 10/11/12 shapes.

## 2. Cross-repository contract

### 2.1 Assurance schema and defaults

The state/event contract version is the string `1.0`; schema files are immutable v1 filenames.
The workflow request is supplied as exact JSON on stdin (`{"request": ...}`), never interpolated
into a shell command.

Profile selection is deterministic:

| Input | `assurance.requested` | `assurance.effective` | Source |
|---|---|---|---|
| omitted | `standard` | `standard` unless policy-elevated | `default` |
| `--assurance lean` | `lean` | `lean` | `flag` |
| `--assurance standard` | `standard` | `standard` or policy `critical` | `flag`/`policy` |
| non-critical profile plus `--critical-scope` | rejected as contradictory | — | validation error |
| `--assurance critical` | `critical` | `critical` | `flag` |
| `--assurance high` | `critical` | `critical` | `alias` |
| natural-language critical request | `critical` | `critical` | `natural-language` |
| `--critical-scope ...` without profile | `critical` | `critical` | `flag` |

Policy elevation applies only from `standard` and records its trigger. Migration, auth/authz,
billing, destructive data, public API break, credentials, protected history, and production-side
effect requests may elevate. A tiny reversible docs/comment correction is not elevated merely for
mentioning a risk word; mixed docs-plus-auth/billing implementation still elevates. Explicit `lean`
is not silently rewritten, but irreversible-operation
approval gates still apply.

Persisted assurance fields are:

```text
assurance.requested: lean | standard | critical
assurance.effective: lean | standard | critical
assurance.source: default | flag | alias | natural-language | policy | user | user-downgrade
assurance.reason: non-empty string
assurance.scope: { type: entire-run, selectors: [] }
              | { type: selectors, selectors: [non-empty task IDs/path globs] }
assurance.activated_at: timestamp
```

### 2.2 Identifiers

- `run_id`: `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`; it is path-independent and cannot contain `/`.
- `task_id`, `workspace_id`, `context_id`, `finding_id`: safe entity identifiers matching
  `^(?!(?:constructor|prototype)$)[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`.
- `workspace_id` is logical identity; workspace `path` is separately recorded.
- `plan_digest`, task digest, design digest, definition digests, and event digests are lowercase
  SHA-256 hex. Git heads accept the repository's 40- or 64-hex form.
- Definition keys are stable names such as `skill:build`, `agent:principal-review`, and
  `prompt:principal-feature`; a task packet may carry the relevant subset, and every carried value
  must equal current run state at the pre-Build gate.

### 2.3 Run state and legal transitions

The first persisted event is `run_initialized` at sequence 1. The CLI supplies
`schema_version`, `seq`, `at`, `run_id`, `prev_digest`, and `event_digest`; payloads may not override
those reserved fields.

Legal profile transitions:

```text
lean     -> critical                         assurance_escalated
standard -> critical                         assurance_escalated
critical -> standard | lean                  assurance_downgraded,
                                               authorized_by="user", non-empty reason
standard -> lean                             assurance_downgraded with same authorization
```

An escalation only targets `critical`. A downgrade must lower the effective rank and preserves the
original `assurance.requested`. There is no convenience downgrade for unavailable controls.

A workspace ID's root, mode, and writer binding are immutable after first attachment; an identical
reattachment may only make it active. A task ID's packet/definition is likewise immutable: duplicate
`task_packet_recorded` events are rejected rather than silently invalidating the authority and
receipts associated with the original digest. Critical packets are legal only after APPROVE critique
of their plan. An approved replan may append `task_packet_superseded`; the old packet remains
immutable/auditable while a replacement gets a new ID. Risk classification is monotonic from unknown through
tiny, substantive, and consequential; it cannot be silently lowered to escape a review gate.

Legal phase state is `not-started -> started -> completed | blocked`. Starting an already-started
phase and completing/blocking a phase that was not started are invalid. A later round may restart a
completed/blocked phase and increments its round. Starting an unrelated phase never clears another
phase's block; finish rejects every started or blocked phase. Critical Build
start additionally requires the pre-Build gate, task ID, active packet workspace, and current
`skill:build` definition digest. Scoped critical `code_changed` is legal only during that matching
active Build phase, after re-evaluating the current pre-Build gate; actual changed paths must be
canonical repository-relative paths, packet-authorized, and included in critical-scope evaluation.
Critical repairs carry the same
task/workspace/definition bindings across start/completion and run inside a restarted active Build
phase when scoped. A blocked phase can restart only with the same task identity. Task status records
Build entry/completion/block/supersession, and both dependency/task gates
and critical finish require completed Build plus current pre-Build controls.

Workflow routing remains the existing closed set:

```text
plan   -> build
debug  -> build | plan | done | blocked
build  -> review | debug | blocked
review -> build | git-ops
decide, architect, git-ops -> terminal (no Next line)
```

Persisted event payloads (the CLI `contract` command is authoritative):

```text
risk_classified
workspace_attached
design_approved
plan_recorded
plan_critique_recorded
task_packet_recorded | task_packet_superseded
phase_started | phase_completed | phase_blocked
code_changed
evidence_recorded
review_recorded
finding_recorded | finding_adjudicated
repair_started | repair_suspended | repair_completed
assurance_escalated | assurance_downgraded
backfill_completed
side_effect_approved
finish_selected | finalization_completed
```

Important transition effects:

- `code_changed` and `repair_completed` update `current_head_sha`, exact candidate
  `current_tree_sha`, and `last_change_seq`.
- A finding starts `pending`; adjudication selects `accepted`, `rejected`, or `needs-context`.
  Pending/needs-context may be adjudicated; accepted/rejected is final, and adjudication is illegal
  after repair starts. Finish blocks every active or suspended accepted repair until completion.
  `repair_suspended` preserves an interrupted attempt so escalation can replan/backfill and restart
  with critical bindings instead of deadlocking. Under critical,
  repair start/completion carries immutable task/workspace/Build-definition bindings and must
  satisfy the active Build/mutation controls.
- Fresh-context IDs are globally single-use across plan critique, task/whole reviews, and frozen-diff
  review receipts; one invocation cannot masquerade as multiple independent reviews.
- `phase_completed` cannot change plan authority; only `plan_recorded` may update `plan_digest` and
  advance authority freshness.
- Exactly one `finish_selected` event is accepted. Choices are `merge`, `pr`, `keep`, or
  `discard`; `discard` additionally requires `explicit_request: true`. Git-Ops then runs the
  pre-operation `finalize` readiness gate. Only `finalization_completed` may close its phase; it
  records final branch/head/tree, changes run status to `finished`, and enables the final `finish` gate.
- Mid-run escalation after Build starts requires frozen base/head/tree, copies current evidence, sets
  `critical_backfill_required`, and blocks Build writes, repairs, finish, and side effects until a
  valid backfill completes.
- Backfill requires exactly one passing receipt for each of `frozen-diff-review`,
  `requirements-trace`, and `risk-specific`, tied to the frozen base/head/tree; review also carries an
  independent context ID.

### 2.4 Task-packet schema

`schemas/assurance-task-packet-v1.schema.json` requires:

```text
schema_version: "1.0"
run_id
task_id
title
authority[]                    non-empty
global_constraints[]
out_of_scope[]
critical_scope: { applies: boolean, matched_by: string[] }
files[]
dependencies[]                 safe task IDs
done_command
review_risk
workspace_id
plan_digest                    SHA-256
definition_digests{}           non-empty SHA-256 map
```

Plan emits task definitions; after independent critique APPROVES the current plan, the controller
adds run/workspace identity and current digests, validates the packet, and persists its deterministic
task digest. A later approved replan explicitly supersedes stale packets before new IDs are issued.
Runtime and Draft 2020-12 schema validation share positive/negative corpus tests including canonical
repository paths, IDs, sources, and timestamps. Critical pre-Build
checks current plan/definitions, an accurate scope match, active owned workspace, and every scoped
dependency's task-completion controls. Critical finish re-evaluates every matching task and then
requires whole-change integration evidence/review.

### 2.5 Evidence-receipt schema and freshness

`schemas/assurance-evidence-receipt-v1.schema.json` requires:

```text
kind: red | green | exact-target | full-suite | build | lint |
      requirements-trace | risk-specific
command: non-empty string
exit_code: integer
head_sha: 40/64 hex (commit/base context)
tree_sha: 40/64 hex (exact candidate content)
task_id: safe ID | null
workspace_id: safe ID | null
recorded_at: timestamp
seq: positive event sequence
```

The candidate tree is computed without changing the real index by using an initially absent
temporary `GIT_INDEX_FILE` with `git read-tree HEAD`, `git add -A`, and `git write-tree`. Critical
Review receives the canonical writer root, snapshots that root with `create --repo`, verifies the
snapshot tree, and records explicit workspace attribution. Git-Ops verifies the normal staged tree
and final `HEAD^{tree}` equal this persisted identity.

A passing receipt has `exit_code === 0`, a sequence newer than both `last_change_seq` and
`last_authority_seq`, and both head/tree IDs equal the assured candidate identity; task gates additionally require
matching task/workspace identity. Task evidence and both task-review axes must additionally occur
after the task's persisted Build-completion sequence, never while its writer phase remains active.
Source/repair changes advance the former. Profile/scope, risk, workspace, design, plan/critique,
task-packet, and backfill authority transitions advance the latter, invalidating older evidence and
reviews. This is conservative/global: even an unrelated source or
authority change forces fresh proof. Finish always requires explicit risk classification; non-critical substantive or
consequential work additionally requires a fresh completion APPROVE, while classified tiny work
keeps the documented right-sized exception. Critical finish requires fresh exact-target, full-suite,
requirements-trace, and risk-specific evidence in the active owned workspace, all scoped task gates,
a successful/completed Build transition for each scoped task, current pre-Build controls, and a fresh
whole-change review sequenced after every scoped task completion, exact-target task receipt, and
both task-review axes. The pre-operation `finalize` gate permits an active Git-Ops phase; the final
`finish` gate requires its persisted completion and exact final branch/head/tree.

### 2.6 Critical-scope semantics

- Omitted scope under critical means the entire run.
- Selector scope must be non-empty. A selector matches an exact task ID or a glob over packet
  paths (`*`, `**`, `?`).
- Before a path-scoped task packet exists, scope evaluation fails closed and applies critical
  controls; the workflow may not declare the task out of scope without its file list.
- After packet validation, non-matching tasks use standard controls. Matching dependencies must
  complete their own critical task gate before a dependent task starts.
- Final integration is not scoped away: finish rechecks every matching task and requires the
  current whole-change specification+quality review, requirements trace, and risk checks.

### 2.7 `BLOCKED_CRITICAL_ASSURANCE`

A failed gate under effective critical assurance returns:

```text
stderr first line: BLOCKED_CRITICAL_ASSURANCE
following lines:   every missing control
CLI exit code:     3
```

Malformed input/state exits 1; the workflow maps a critical initialization/state-validation failure
to the same blocking contract. A block does not authorize a downgrade, inline self-review, caller
workspace substitution, source write, or external side effect. Critical missing-agent/timeout/empty
response is a block; only lean/standard may use the existing absence-only inline fallback.

### 2.8 Fields expected from pi-daddy

A pi-daddy integration may replace prompt orchestration, but must preserve these fields/events:

| Boundary | Required values |
|---|---|
| Run start | exact request, `workflow`, `run_id`, base/head, definition digests; consume returned requested/effective/source/reason/scope |
| Every phase | `run_id`, effective assurance, scope, phase, applicable task/workspace/context IDs, current definition digest |
| Plan -> controller | authority, global constraints, out of scope, stable task IDs, scope match, files, dependency task IDs, done command, review risk |
| Controller -> Build | validated packet, task digest, plan/definition digests, workspace ID, canonical `WRITER_ROOT`, initial CWD validation, one governed-child writer lease |
| Review | axis, authority, run/task/workspace IDs, canonical writer root, expected/computed tree, context ID, head, plan/task/definition digests; whole-change carries both sub-verdicts |
| Evidence | exact command, integer exit, head and candidate-tree IDs, timestamp, event sequence, task/workspace attribution |
| Findings | stable ID, summary/evidence, one disposition/reason; only accepted IDs enter Build repair |
| Escalation | source/reason/scope; frozen base/head/tree after implementation; matching backfill receipts before resume |
| Finish | one choice; `finalize` readiness; JIT approval before external effect; `finalization_completed` final branch/head/tree; `finish` completion gate |

The workspace ID and canonical root are trusted correlation and lease inputs. At child spawn,
pi-daddy can canonicalize the registered root, validate the child's initial CWD, and coordinate an
exclusive writer lease among children it governs. That lease does not exclude unrelated or
non-cooperating processes.

Initial CWD is not path confinement. A child with unrestricted `bash` can change directories, use
absolute paths, or spawn arbitrary processes after launch; pi-daddy cannot guarantee confinement by
checking CWD or prompt compliance. The `WRITER_ROOT` path rules are behavioral and auditable
expectations. Actual containment requires an OS sandbox or a constrained non-shell execution broker
that mediates every filesystem/process operation.

pi-daddy must propagate `BLOCKED_CRITICAL_ASSURANCE` unchanged and must never convert missing
fresh-context/workspace controls into inline success.

### 2.9 Events/assertions expected by skill-harness and workflow E2E

Skill-harness does not write assurance run events; it consumes each skill's
`tests/specification.yaml`, fixtures, objective `assert` fields, and checklist. v3 expects static
lint to mark changed skill/model cells stale until rerun. A model result may publish only after all
new v3 scenarios are measured with no `judge_verdict: ERROR`.

The live workflow harness does inspect persisted runtime events/state. Successful standard cells
must show requested/effective `standard`, fresh exact-target evidence, exactly one `keep` choice, a
single finalization event, `finished` status, a passing finish gate, real source/history change, and
persisted final head/tree equal to Git `HEAD`/`HEAD^{tree}`,
the expected inline/delegated signal, and a final labeled `Digest:` block whose `Ref:` contains the
full actual commit SHA. The marker must be followed by exactly six ordered fields and then only
blank output. Bugfix cells require a concrete
`Root cause:` in that same final block; earlier transcript prose cannot satisfy either assertion.
Successful critical cells additionally require owned-isolated workspace metadata, current packet/digests,
separate specification and quality contexts, whole-change dual approval, all critical evidence, one
`merge` choice, and a passing finish gate. Critical/missing-context cells must emit
`BLOCKED_CRITICAL_ASSURANCE` and have no source/history change.

## 3. Acceptance-criterion trace

| Original criterion | Implementation | Proving static/free test |
|---|---|---|
| v2-compatible invocation defaults to standard | Namespaced forms plus deprecated aliases generated as complete workflows; no recursive slash-command expansion | default/tiny parser test; generated alias prompt and transition tests |
| Explicit critical persists through phases/task packets | `assurance.requested/effective`, packet `critical_scope`, phase IDs/digests | `explicit critical assurance persists through task packets and phase events` |
| No silent downgrade | User-only lowering transition; original requested value retained | `user-requested critical cannot silently downgrade; explicit user authorization and reason are required` |
| No critical inline self-review fallback | Shared workflow contract blocks on absent/crashed/empty fresh context | `shared workflows pin critical isolation...`; critical/absent live cells (specified, not run) |
| Mid-run escalation freezes and backfills | Frozen base/head/tree/evidence, write/repair/finish/side-effect freeze, three exact-candidate receipts | `mid-run escalation freezes base/head/tree and requires critical backfill`; `critical escalation backfill requires concrete passing receipts tied to the frozen diff` |
| Scoped dependencies covered | Safe dependency task IDs and pre-Build dependency task-complete gates | `critical pre-build blocks on incomplete scoped dependency tasks` |
| Final integration covered | Every scoped task gate + global fresh exact/full/trace/risk evidence + third-context whole review after task evidence | critical finish and whole-review ordering tests |
| One governed writer per workspace | Build-only capability, packet/active/phase workspace binding, `writer="build"`, WRITER_ROOT contract | `critical build phase binds task, active workspace, and current Build definition`; workspace branch tests; lease and confinement limitations below |
| Separate specification and quality/security reviews | Separate axes, APPROVE-only, explicit writer workspace/root, verified candidate tree, distinct contexts | task completion, explicit review identity, and workspace attribution tests |
| Stale evidence invalid after every relevant change | Sequence/head freshness; code/repair advances global change sequence | `evidence becomes stale after the last relevant code change`; critical finish stale branch |
| Merge/PR/keep choices | Exactly-one choice, finalize readiness, exact finalization receipt, finish completion | finish-choice/finalization unit tests; E2E final head/tree assertion |
| Discard explicit | `discard` requires `explicit_request: true` | same finish-choice unit test |
| Tiny reversible work stays right-sized | tiny policy exception and Lean/Standard contract governors | default/tiny parser test; existing C right-sizing cells; seven skill specs remain static-only |
| Consequential design proof/escape routes | Validation, observability, rollback, abort, one-way doors, user approval | `consequential design approval requires validation, observability, rollback, abort, and user approval` |
| Stable findings and one-at-a-time repair | pending/adjudicated finding state and exclusive repair | finding adjudication/repair and finish-block tests; seeded Build E1 |
| External effects use JIT approval | all-profile side-effect gate; approval must be latest event | `irreversible side effects retain approval gates in every profile and critical approval is fresh` |
| Stable public surface/capability ceilings | exactly seven skills; unchanged `allowed-tools` ceilings | `v3 keeps exactly the seven stable public skill names and least-privilege ceilings` |

## 4. Hash-chain guarantee and limits

### Canonicalization and versioning

For each event, `event_digest` is SHA-256 over `canonicalJson(event without event_digest)`.
Object keys are sorted lexicographically at every depth; array order is preserved; primitive
encoding follows JavaScript `JSON.stringify`. Before hashing, the append API rejects undefined,
functions, symbols, bigint, non-finite numbers, sparse/extended arrays, non-plain objects, accessors,
non-enumerable properties, and cycles, so the hashed value cannot differ from the JSONL value.
There is no Unicode normalization beyond JSON string encoding, so another runtime must reproduce
those exact rules. The digest covers schema version, sequence, type, timestamp, run ID, payload, and
previous digest. The first event has `prev_digest: null`; each next event stores the prior event's
digest. Replay rejects empty logs, unsupported versions, and any event whose run ID differs from the
selected run directory.

### What is detected

- Alteration without recomputing the chain: event digest mismatch.
- Reordering/insertion/deletion in the middle: sequence and/or previous-digest mismatch.
- Invalid/partial JSON: parse failure.
- Reserved hash metadata injection through the append API: rejected before append.

### Truncation and trusted-head assumptions

The chain is **not tamper-proof**. An actor able to rewrite the log can alter events and recompute all
later digests. A valid-prefix tail truncation is not detectable from the remaining log alone. It is
detectable only if a consumer retains a trusted external anchor (at least final `event_seq` plus
`event_digest`, or a signed/remote checkpoint) and compares it later. `snapshot.json` is a derived,
same-trust-domain cache and is not such an anchor. This implementation provides no signature,
remote witness, TPM anchor, or transparency service.

### Atomicity and crash recovery

- State writers acquire a per-run directory lock, replay and validate, derive the next state, append
  one JSONL line, then write snapshot to a mode-0600 temp file and rename it atomically.
- Initialization validates before creating the first log entry, so invalid init does not strand a
  partial run.
- If the process dies after a complete log append but before snapshot rename, replay uses the log;
  the stale snapshot is ignored and a later successful append replaces it.
- If the process dies during the JSONL append, a partial final line causes integrity failure. There
  is no automatic tail repair; an operator needs a separately trusted anchor/backup before any
  recovery decision.
- `appendFileSync` and rename are not followed by file/directory `fsync`; power-loss durability is
  therefore the filesystem/runtime guarantee, not a transactional database guarantee. Temp files
  can remain after a crash.

### Concurrent processes

`mkdir` of `.lock` serializes cooperating `AssuranceStore` appenders for one run. Normal exceptions
remove it in `finally`. A process death can leave a stale lock; there is no lease timeout or PID
reclamation, so later writers block rather than guess. Read-only `load/show/gate` does not acquire
the writer lock and can observe the previous complete prefix while an append is in flight, or fail
on a partial append. The state lock does **not** exclude source-code writers or enforce workspace
leases.

## 5. Workspace binding: validation versus enforcement

This repository validates/implements:

- real Git detached/branch worktree creation and guarded cleanup; CLI/exported cleanup accepts only
  owned temp worktrees and preserves the path whenever Git refuses removal; combined setup/cleanup
  failure reports both errors and the preserved worktree path;
- registered workspace ID/path/mode/writer metadata;
- safe IDs and known workspace references on evidence/reviews;
- task packet workspace equals active workspace at critical pre-Build;
- critical phase workspace and current Build definition binding;
- critical reviews explicitly name the packet's active owned workspace and canonical writer root,
  snapshot that root, and match the current candidate head/tree; the temp-index regression proves
  writer and snapshot tree equality without changing the real index;
- Build contract instructs source tools to use absolute paths under canonical `WRITER_ROOT` and
  shell commands to begin by changing to it; these are behavioral rules, not containment.

This repository only records as metadata:

- `writer: "build"` and the logical one-writer lease;
- the claim that a supplied path is the process's actual tool root after attachment;
- reviewer/builder process identity and whether another external process is writing.

pi-daddy can enforce or coordinate later:

- canonicalize/realpath the workspace and prove it is the expected registered branch worktree;
- validate the child's initial CWD against that canonical root at process spawn;
- issue an exclusive writer lease among pi-daddy-governed children for a workspace;
- prevent its controller from selecting the caller checkout as a fallback;
- create genuinely separate review contexts and preserve context IDs;
- assign a merge owner when multiple governed writer worktrees are supported.

pi-daddy cannot guarantee path confinement once a child has unrestricted `bash`: the child can
change CWD, address paths outside `WRITER_ROOT`, and spawn arbitrary processes. The governed-child
lease likewise cannot exclude external or non-cooperating writers. Actual filesystem/process
containment requires an OS sandbox or a constrained non-shell execution broker that mediates every
operation.

Accordingly, the workspace ID/canonical root are trusted correlation and lease inputs, initial CWD
validation is a spawn-time check, and “one Build writer lease” coordinates governed children only.
These are not an OS sandbox or a general cross-process lock. Only assurance-event appends are
serialized by `AssuranceStore`.

## 6. Scenario inventory

### Seven new skill-level E1 scenarios

1. **Architect E1 — critical migration design.** Expected: expand/contract, validation and
   observability signals, distinct rollback/abort, named one-way door, no big bang.
2. **Build E1 — adjudicated repair.** Seeded fixture. Expected: apply only accepted
   `REV-SPEC-001`, add/member-403 test, Vitest green, exclude OAuth/JWT rewrite, report red/green/full
   evidence and accepted ID.
3. **Debug E1 — async boundary.** Expected: diagnose observable completion boundary and wait on a
   condition with deadline, never another fixed sleep.
4. **Decide E1 — revisit condition.** Expected: choose managed Postgres with a concrete revisit
   trigger, no workflow routing/implementation plan.
5. **Git-Ops E1 — fresh finish receipt.** Expected: recognize attributable current-head/tree receipt,
   offer merge/PR/keep, execute nothing before selection, require finalize readiness, then persist
   final branch/head/tree and pass finish.
6. **Plan E1 — critical task definitions.** Expected: authority/constraints/out-of-scope plus stable
   task IDs, scope/files/dependencies/test/done/risk; controller retains runtime IDs/digests.
7. **Review E1 — attributable specification axis.** Expected: echo run/task/workspace/root/tree
   authority, separate Spec/Quality fields, stable IDs, and no claim that quality ran in the same context.

Additional **Git-Ops E2 — stale/unsupported receipt** expects refusal to commit/open PR without
run/command/exit/head/timestamp/gate evidence. It is the explicit stale-evidence skill-level
negative.

### Eight live workflow E2E cells (specified, not run)

1. `feature-standard-absent` — expected success, requested/effective standard, inline fallback
   stated, substantive tested `greet(name)` behavior, exactly one `keep`, exact finalization/finish,
   clean fixture.
2. `bugfix-standard-absent` — expected success, inline Debug/Review fallback stated, real `sum()`
   regression fix/commit, root cause in digest, one `keep`, passing finish gate.
3. `feature-standard-present` — expected success with `principal-plan`/`principal-review`
   delegation, same real feature and standard/keep assertions, no inline-fallback confession.
4. `bugfix-standard-present` — expected success with delegated Debug/Review, real regression fix,
   root cause, standard/keep assertions.
5. `feature-critical-absent` — expected `BLOCKED_CRITICAL_ASSURANCE`; no `greet.js`, no source or
   history change. Covers missing fresh-context control and no inline self-review substitution.
6. `bugfix-critical-absent` — expected `BLOCKED_CRITICAL_ASSURANCE`; known bug and fixture history
   unchanged. Covers missing fresh-context control on bugfix spine.
7. `feature-critical-present` — expected success with fresh contexts, owned branch workspace,
   critical receipts/reviews, one local `merge`, exact finalization/finish, tested `greet.js` on caller main.
8. `bugfix-critical-present` — expected success with delegated diagnosis/plan/reviews, owned branch
   workspace, critical receipts, one local `merge`, passing finish gate, executable fixed `sum()`.

Coverage notes:

- Standard/critical, feature/bugfix, and present/absent delegation are the eight-cell Cartesian
  matrix above.
- The feature fixture is intentionally substantive so standard-present legitimately requires
  Plan/Review delegation. Tiny/right-sizing remains covered by parser/unit tests and existing C
  scenarios rather than a contradictory live delegation assertion.
- Entire-run critical is exercised by critical-present cells. Selector-scoped critical is covered
  statically by Plan E1 and offline scope/dependency unit tests, not by a paid live cell.
- Mid-run escalation is covered by offline state-machine tests, not by the eight live cells.
- Stale evidence is covered by offline freshness tests and Git-Ops E2, not by the eight live cells.
  Live behavior for those three cases remains release evidence to add or authorize later.

## 7. Cold-review record

All findings below were accepted and repaired; none was waived or rejected.

| Review | Severity | Finding | Disposition and exact repair evidence |
|---|---|---|---|
| State review 1 | P1 blocker | Empty/malformed escalation scope could make all tasks out of scope | Repaired with runtime/schema scope invariants; `escalation rejects empty or malformed critical scopes...` |
| State review 1 | P1 blocker | Payload could override `prev_digest`/reserved metadata and corrupt next load | Repaired by reserved-field rejection/system-last metadata; `AssuranceStore rejects payload attempts...` |
| State review 1 | P1 blocker | Explicit lean bypassed irreversible side-effect gate | Repaired all-profile JIT gate; `irreversible side effects retain approval gates in every profile...` |
| State review 1 | P1 blocker | Null packet fields and stale plan/definition bindings accepted | Strict packet validation + gate comparison; packet validation and `critical pre-build binds...digests` tests |
| State review 1 | P1 blocker | Evidence/reviews from unrelated workspace could satisfy task | Registered/matching workspace required; `critical task evidence and reviews must come from...workspace` |
| State review 1 | P1 blocker | Pending and accepted-unrepaired findings could pass finish | Finish adjudication/repair checks; `finish blocks pending findings...` |
| State review 1 | P1 blocker | Inherited `constructor`/prototype keys could mutate global objects | Safe IDs + own-property lookups; `event entity ids reject prototype and path-like keys` |
| State review 1 | P1 blocker | `[null]` could clear escalation backfill | Three typed frozen-SHA receipts; `critical escalation backfill requires concrete passing receipts...` |
| Contract review 1 | P0 blocker | Exact request was shell-interpolated in generated prompts | JSON stdin init + contract wording; `CLI init accepts an exact JSON request...`; generation tests |
| Contract review 1 | P0 blocker | Critical Build could claim worktree metadata while writing caller cwd | `WRITER_ROOT` behavioral contract + phase/workspace binding; assurance-contract/workspace tests; unrestricted-shell confinement explicitly not claimed |
| Contract review 1 | P1 | E2E receipt assertion ignored verdict/context/finish gate | E2E now invokes deterministic finish gate and checks owned workspace/exact choice; shell self-test 4/4 |
| Contract review 1 | P1 | Critical E2E requested contradictory keep+merge | Each cell now requests/asserts one expected choice; exactly-one unit test |
| Contract review 1 | P1 | Build E1 had no objective fixture | Added seeded auth fixture, Vitest/diff includes/excludes; free lint parses it; model cell remains unrun |
| Contract review 1 | P1 | Plan E1 called incomplete definitions persisted packets | Plan/controller boundary and complete task fields added; generated-contract and plan-contract tests |
| Contract review 1 | P1 | Whole-change axis lacked dual-hunt semantics | Contract + runtime sub-verdict requirement; critical finish rejects partial quality verdict |
| Contract review 1 | P1 | Git-Ops E1 trusted unsupported “fresh” prose | Attributable receipt E1 + stale negative E2 + finish-gate ordering in Git-Ops contract |
| Follow-up review | P1 | Backfill flag did not freeze direct writes/repairs/side effects/finish | Explicit blocks added; escalation-backfill test exercises code and gates |
| Follow-up review | P1 | Standard finish ignored latest `CHANGES-REQUESTED` without findings | Completion review must be fresh APPROVE; `finish cannot ignore a latest completion review...` |
| Follow-up review | P1 | Critical phase could record arbitrary workspace/definition | Known active workspace + current Build digest required; `critical build phase binds...` |
| Follow-up review | P1 | Repeated finish choices overwrote state; standard E2E did not assert gate | Second choice rejected; generic E2E exact-one choice + finish-gate assertion; finish-choice unit test |
| Final cold review 1 | P0 | Workspace CLI could recursively delete the registered main checkout after Git refusal | CLI now accepts only registered canonical `ppw-*` temp children, explicitly rejects main, and never recursively deletes after Git failure; main/locked-worktree regression tests |
| Final cold review 1 | P1 | Reusing a workspace ID could rebind its root while old receipts retained the ID | Workspace root/mode/writer bindings made immutable; `workspace IDs have immutable root and mode bindings` |
| Final cold review 1 | P1 | Re-recording a task ID replaced authority without invalidating receipts/reviews | Duplicate task packets rejected as immutable; `task definitions are immutable once their packet is recorded` |
| Final cold review 1 | P1 | Non-JSON values hashed differently from serialized JSONL | Strict canonical JSON-value validation before hashing; undefined/sparse-array store regression test |
| Final cold review 1 | P1 | Empty or copied-under-another-ID event logs could replay | Empty-log rejection and per-event selected-run identity check; store identity regression test |
| Final cold review 1 | P1 | Substantive standard finish could pass without classification/completion Review | Finish requires classification and fresh APPROVE except explicit tiny case; substantive standard regression test |
| Final cold review 1 | P2 | Restarting a blocked phase left run status blocked | Phase start restores active status and increments round; restart regression test |
| Final cold review 1 | P2 | E2E SHA/root-cause grep could pass from earlier transcript prose | Final labeled Digest extraction plus positive/negative offline canaries; later tightened to exact six-line parsing |
| Final cold review 2 | P1 | Critical finish could pass without traversing successful pre-Build/Build | Scoped critical code now requires matching active Build; task status persists completion; finish rechecks pre-Build and completed Build per scoped task |
| Final cold review 2 | P1 | Reclassifying substantive risk as tiny bypassed standard Review | Risk levels made monotonic; lowering regression test |
| Final cold review 2 | P1 | Later plan/authority changes left evidence and reviews fresh | Added persisted `last_authority_seq`; all gates use the max source/authority freshness floor; authority-change regression test |
| Final cold review 2 | P2 | Post-Digest chatter could override a wrong Ref in the final block | Parser consumes exactly the final marker plus six ordered/unique labeled lines; trailing-Ref negative canary |
| Final cold review 2 | P2 | Runtime task validation was weaker than packed schema | Runtime rejects extra top/scope fields and duplicate array items; schema-parity negatives |
| Final cold review 3 | P1 | Critical writes/repairs could bypass active Build or change paths outside packet scope | Mutation gate now evaluates actual paths, packet authorization, current pre-Build, active task/workspace/definition; critical repairs bind start/completion; regression tests |
| Final cold review 3 | P1 | Exported snapshot cleanup still recursively deleted after Git refusal | Exported cleanup now preserves/throws on refusal and is idempotent only when path is already absent; locked-worktree regression |
| Final cold review 3 | P1 | Task completion/dependencies did not require completed Build status | `task-complete` now requires task status `completed`; dependency traversal inherits it; synthetic-receipt negative test |
| Final cold review 3 | P1 | Context IDs could be reused across tasks/invocations | Persisted globally unique `used_context_ids` covers critique, reviews, and frozen-diff review; cross-task/axis negative tests |
| Final cold review 3 | P1 | Explicit lean/standard silently overrode `--critical-scope` | Contradictory profile/scope flags rejected; parser tests |
| Final cold review 3 | P1 | `phase_completed.plan_digest` bypassed authority invalidation | Field rejected; plan changes must use `plan_recorded`; transition test |
| Final cold review 3 | P2 | Runtime scope accepted extras/duplicates rejected by schema | Closed scope keys and unique selectors enforced in parser/state; parity negatives |
| Final cold review 3 | P2 | Digest parser allowed trailing failure and short/full SHA boundary mismatch | Exactly six ordered fields followed only by blanks; `%H` full SHA; trailing-failure/full-SHA canaries |
| Final cold review 4 | P1 | Traversal-shaped changed paths escaped semantic packet scope | Runtime rejects absolute, backslash, globbed mutation, empty/dot/dot-dot segment paths; packet/scope patterns receive matching lexical checks; traversal regressions |
| Final cold review 4 | P1 | Finding could be reclassified after repair start and evade finish | Adjudication transition legality added; accepted/rejected terminal; active repairs always block finish; regression test |
| Final cold review 4 | P1 | Reviews recorded during active Build remained fresh after completion | Persisted per-task `completed_seq`; task evidence/spec/quality receipts must be later; active-writer review negative test |
| Final cold review 4 | P1 | Docs exemption hid mixed authentication/billing implementation | Exemption now loses to implementation verbs near risk domains; both mixed requests elevate while billing-runbook typo stays standard |
| Final cold review 4 | P2 | Runtime accepted review sub-verdicts rejected by schema | Event and run-state review shapes validate sub-verdict enums and whole-change consistency; parity negatives |
| Final cold review 5 | P1 | Docs exemption still hid drop/refund and other mixed critical operations | Policy triggers/verbs broadened; mixed regression table now covers migration, auth/authz, billing/refund, destructive data, API break, credentials, protected history, and production |
| Final cold review 5 | P1 | Empty explicit assurance/scope flags silently became default standard | Null/empty distinguished; both empty forms reject with parser tests |
| Final cold review 5 | P1 | Deprecated aliases relied on unsupported recursive slash-command expansion | Generator emits aliases as complete feature/bugfix workflows with one deprecation notice; direct content/transition tests; generation set is 13 |
| Final cold review 5 | P2 | Duplicate one-way doors passed runtime but not schema | Runtime uniqueness check and negative design test |
| Final cold review 6 | P1 | Finish passed with started/blocked phases; unrelated start cleared blocked run status | Finish enumerates/rejects active and blocked phases; status clears only when the blocked phase is restarted/resolved; regression test |
| Final cold review 6 | P1 | Whole-change review could precede Build completion/task reviews | Whole review sequence must exceed every scoped task completion/spec/quality sequence; early-whole negative test |
| Final cold review 6 | P1 | Backfill receipts accepted schema-forbidden extra fields | Closed receipt field allowlist before persistence; parity negative |
| Final cold review 6 | P1 | Combined setup/cleanup failure hid the preserved worktree path | Error now includes setup failure, cleanup refusal, and preserved path; deterministic injected-failure regression |
| Final cold review 7 | P1 | Head-only receipts could not identify uncommitted candidate content before Git-Ops | Added `current_tree_sha` and mandatory receipt/review `tree_sha`; temp-index computation leaves real index untouched; Git-Ops requires staged/final tree equality; E2E compares final `HEAD^{tree}` |
| Final cold review 7 | P1 | Blocked Build task could be overwritten by starting another task under the same phase key | Blocked phase may restart only with the same task identity; regression preserves original block |
| Final cold review 7 | P1 | Runtime accepted phase definition digest rejected by schema | Event and run-state phase validation require SHA-256/null; parity negative |
| Final cold review 8 | P1 | Critical Review could snapshot caller CWD while claiming the writer workspace | Review receives canonical `Writer root`, uses `create --repo`, verifies snapshot tree; critical events require explicit matching workspace/head/tree; temp-index equality regression |
| Final cold review 8 | P1 | Replan left immutable old packets permanently blocking finish | Critique must precede critical packets; approved replans append `task_packet_superseded`, preserve audit history, and issue new IDs |
| Final cold review 8 | P1 | No legal persisted Git-Ops completion sequence | Added `finalize` readiness gate and `finalization_completed` final branch/head/tree event; only it completes Git-Ops and enables `finish` |
| Final cold review 8 | P1 | Escalation/backfill identified only committed HEAD | Frozen diff and all three receipts now require exact candidate `tree_sha` |
| Final cold review 8 | P1 | Whole review could precede task exact-target evidence | Whole-review ordering floor now includes each task's qualifying exact-target receipt sequence |
| Final cold review 8 | P2 | Runtime and schemas differed on repository paths/source/timestamps | Aligned validators and added Ajv Draft 2020-12 shared positive/negative corpus tests |
| Final cold review 8 | P2 | Tiny feature fixture conflicted with mandatory delegation assertion | Replaced token-file task with substantive tested `greet(name)` behavior; tiny right-sizing remains offline |
| Final cold review 9 | P1 | Superseded packets could receive standard-profile `code_changed` and become current again | Source mutation now rejects every superseded task before profile-specific gates; downgrade/replan regression |
| Final cold review 9 | P2 | Schema/runtime parity still diverged on whitespace, invalid calendar dates, and malformed persisted design | All schema `nonEmpty` definitions reject whitespace; runtime validates calendar components and complete design state; shared Ajv corpus covers each negative |
| Final cold review 10 | P1 | Lean/standard repairs could resurrect a superseded task | Repair start/completion reject superseded bindings in every profile; replanning is blocked during active repair; stale-plan and supersession guards are defensive; regressions cover both repair edges |
| Final cold review 11 | P1 | Escalating an unbound active repair deadlocked critical recovery | Added audited `repair_suspended`; escalation may suspend, replan/backfill, then restart the accepted finding under current critical task/workspace/Build bindings; end-to-end state regression |
| Final cold review 11 | P2 | Stale-before-supersession repair-start guard lacked direct coverage | Added a direct old-plan packet rejection regression before supersession |

Follow-up self-review also added the standalone evidence schema, explicit event schema-version replay
check, scoped dependency completion gate, and precise hash/workspace limitations in this handoff.

## 8. Version/package consistency

- Source `package.json` and root/package lock metadata are `3.0.1`; the package includes the
  assurance CLI bin and `schemas/*.json`. npm `latest` resolves `3.0.1`.
- `CHANGELOG.md`: `[3.0.1] — 2026-09-04` precedes `[3.0.0] — 2026-08-20`; v2.4 history retained.
- `README.md` and `AGENTS.md`: the immutable release coordinate is `@v3.0.1`; both identify the
  verified tag/npm version and link validation because v3 carries no model score.
- Clean-install examples using unversioned `npx -p principal-pi-skills` resolve `3.0.1`; source and
  packed tests test the local tarball rather than the registry.
- Pack allowlist requires all runtime skills/prompts/agents, assurance CLI/workspace installer, and
  all three schemas; lockfile/tests/docs/contracts remain excluded as intended.
- Tags: `v2.1.0`, `v2.2.0`, `v2.3.0`, `v2.3.1`, `v2.4.0` (backfilled at `4dece8c`),
  `v3.0.0`, and `v3.0.1`. The `v3.0.1` tag was created and verified before npm publication.
  2.4.0 shipped to npm without a git tag, which left the install command every doc printed
  resolving to nothing for four days — the same class of defect as 2.3.1's 404'ing npx
  invocations, and the reason the release procedure now tags before publishing.
- `ajv`/`ajv-formats` are the repository's first devDependencies (Draft 2020-12 schema parity in
  `tests/unit/assurance-state.test.mjs`). Runtime install stays dependency-free; a checkout with no
  `node_modules` now fails `npm test` on a missing module until `npm ci` runs.

## 9. Free/offline validation and paid-run plan

Final command ledger and exact exit/counts are filled from the final pre-commit run:

```text
npm test
  exit 0
  generation: 13 generated contracts matched
  unit/static: 141 passed, 0 failed
  word budgets: 10 files matched and remained within budget
  clean-home/install: 25 passed, 0 failed
  packed artifact: 28 files, 348 kB unpacked, all 28 required, no excluded leak
  free skill lint: 7 skills, 101 expected stale findings, 101 exempt, 0 blocking

bash tests/e2e/run-e2e.sh --self-test
  exit 0; 14 synthetic delegation/final-digest assertions passed, 0 failed; no model calls
  (10 at first authoring; the CI-dependency commit 961f8cc added four)

bash -n tests/e2e/run-e2e.sh
  exit 0

git diff --check
  exit 0

npm run generate:check
  exit 0; 13 generated contracts matched

npm run check:pack
  exit 0; 28 files, 348 kB unpacked, all 28 required, no excluded leak

Evidence-loop corrections retained in history of this session:
  first E2E self-test: exit 1 because no paid transcripts existed; synthetic offline canaries added
  first diff check after handoff rewrite: exit 2 for five Markdown trailing-space line breaks; fixed
```

No paid skill-harness subject/judge or live workflow cell is part of Handoff 1.

Re-verified on `main` at release time (2026-08-20), after `npm ci` on a checkout that had no
`node_modules`: `npm test` exit 0 — 13 generated contracts matched, 141/141 unit, 10 files within
word budget, 25/25 clean-home install, packed artifact 28 files / 350 kB unpacked (348 kB before
this release's documentation edits, which ship in the tarball), all 28 required present and
nothing excluded leaked, lint 101 findings / 101 exempt / **0 blocking**;
`bash tests/e2e/run-e2e.sh --self-test` exit 0, 14 passed; `git diff --check` exit 0.

### Authorized-later skill-harness commands

Published two-model wave:

```bash
npx -y skill-harness@latest run all --skills "$PWD" --mode force \
  --model fireworks:accounts/fireworks/models/deepseek-v4-pro
npx -y skill-harness@latest run all --skills "$PWD" --mode force \
  --model fireworks:accounts/fireworks/models/glm-5p2
```

Optional untuned control:

```bash
npx -y skill-harness@latest run all --skills "$PWD" --mode force \
  --model fireworks:accounts/fireworks/models/kimi-k3
```

Judge: `claude-code:opus`. There are 106 scenarios × 3 reps = **318 subject rep-executions per
subject model**. The published DeepSeek+GLM wave is **636 subject rep-executions** and at most
**636 judge invocations** (an objective-gate failure can skip its judge). Optional kimi adds 318 +
at most 318. Multi-turn/tool scenarios can make more than one provider API request inside a rep;
these are harness-level call counts, not raw HTTP request counts.

Estimate, not authorization: historical pacing suggests **8–12 hours serial** for the two full
model waves. Assuming roughly 5–15M total Fireworks billable tokens and 3–8M judge input plus
0.3–1M judge output, budget approximately **US$75–250 API-equivalent** at representative Opus
$15/M input and $75/M output plus provider charges. Claude Code subscription/quota and current
Fireworks pricing can make cash cost differ; confirm configured rates before running.

### Authorized-later live E2E command

```bash
PROVIDER=fireworks \
MODEL=accounts/fireworks/models/deepseek-v4-pro \
  bash tests/e2e/run-e2e.sh
```

This is eight parent workflow runs and zero judge calls. The specified routing implies up to about
15 child subagent sessions in the four “present” cells (actual task decomposition controls the exact
number), so estimate **8 parent + up to 15 child model sessions**, **2–4 hours serial** under the
30-minute cell timeout, and roughly **US$2–20** Fireworks spend under a 1–4M token assumption.
Running the matrix on GLM is a separate command/cost of the same shape.

Required environment:

- Node >=20, npm/npx, git, `pi`, network access, and enough disk/tmp space for tarballs/worktrees;
- Fireworks subject credentials/models in `~/.pi/agent/auth.json` and `models-store.json`;
- pi settings/default provider+model valid for child subagents;
- pi's shipped subagent extension at `examples/extensions/subagent` for present cells;
- authenticated Claude Code Opus judge/session for skill-harness;
- no secret values copied into this repository. The E2E harness copies credentials only into its
  throwaway HOME and removes it.

## 10. Release candidate evidence (PR #31, merged `b28a8d5`)

Kept as the record of what was reviewed and merged. Exact base:

```text
4dece8ca35648725234c7dc2eadead95cd084b07
```

CI follow-up `git status --short --branch` before staging:

```text
## feat/v3-risk-adaptive-assurance...origin/feat/v3-risk-adaptive-assurance
 M .github/workflows/ci.yml
 M docs/HANDOFF.md
 M tests/e2e/run-e2e.sh
```

Complete candidate `git diff --stat 4dece8ca35648725234c7dc2eadead95cd084b07`
(the base-to-candidate tree, including paths already committed in the superseded local commit):

```text
 .github/workflows/ci.yml                          |    7 +-
 AGENTS.md                                         |   22 +-
 CHANGELOG.md                                      |   57 +
 README.md                                         |  146 +-
 agents/debug.md                                   |    8 +-
 agents/plan.md                                    |   36 +-
 agents/principal-debug.md                         |    8 +-
 agents/principal-plan.md                          |   36 +-
 agents/principal-review.md                        |   54 +-
 agents/review.md                                  |   54 +-
 architect/SKILL.md                                |    6 +-
 architect/tests/specification.yaml                |   18 +-
 build/SKILL.md                                    |   23 +-
 build/tests/fixtures/E1/auth.test.ts              |   12 +
 build/tests/fixtures/E1/auth.ts                   |    7 +
 build/tests/specification.yaml                    |   24 +-
 contracts/debug.md.tmpl                           |    8 +-
 contracts/plan.md.tmpl                            |   36 +-
 contracts/review.md.tmpl                          |   54 +-
 contracts/workflows.md.tmpl                       |  185 +++
 debug/SKILL.md                                    |    6 +-
 debug/tests/specification.yaml                    |   15 +-
 decide/SKILL.md                                   |    1 +
 decide/tests/specification.yaml                   |   14 +-
 docs/ASSURANCE.md                                 |  213 +++
 docs/HANDOFF.md                                   |  979 +++++++++--
 docs/validation/VALIDATION.md                     |   46 +-
 docs/validation/record-artifacts.txt              |   55 +-
 docs/validation/unpublished-cells.txt             |   76 +-
 git-ops/SKILL.md                                  |   10 +
 git-ops/tests/specification.yaml                  |   36 +-
 package-lock.json                                 |   85 +-
 package.json                                      |   15 +-
 plan/SKILL.md                                     |   36 +-
 plan/tests/specification.yaml                     |   19 +-
 prompts/bugfix.md                                 |  151 +-
 prompts/feature.md                                |  151 +-
 prompts/principal-bugfix.md                       |  183 +-
 prompts/principal-feature.md                      |  185 ++-
 review/SKILL.md                                   |   54 +-
 review/tests/specification.yaml                   |   19 +-
 schemas/assurance-evidence-receipt-v1.schema.json |   48 +
 schemas/assurance-run-state-v1.schema.json        |  307 ++++
 schemas/assurance-task-packet-v1.schema.json      |   91 ++
 scripts/assurance-state.mjs                       | 1840 +++++++++++++++++++++
 scripts/check-pack.mjs                            |   10 +-
 scripts/check-word-budgets.mjs                    |    7 +-
 scripts/generate-contracts.mjs                    |  107 +-
 scripts/pack-meta.mjs                             |   14 +
 scripts/snapshot-workspace.mjs                    |  128 +-
 tests/e2e/run-e2e.sh                              |  291 +++-
 tests/install/clean-home.test.mjs                 |   23 +-
 tests/unit/assurance-contracts.test.mjs           |  128 ++
 tests/unit/assurance-state.test.mjs               | 1503 +++++++++++++++++
 tests/unit/generated-contracts.test.mjs           |   29 +-
 tests/unit/handoff-transitions.test.mjs           |    2 +-
 tests/unit/pack-meta.test.mjs                     |   19 +
 tests/unit/snapshot-workspace.test.mjs            |  107 ++
 58 files changed, 7099 insertions(+), 705 deletions(-)
```

Complete changed/generated file list (58 files). Generated outputs are marked:

```text
.github/workflows/ci.yml
AGENTS.md
CHANGELOG.md
README.md
agents/debug.md                         [generated]
agents/plan.md                          [generated]
agents/principal-debug.md               [generated]
agents/principal-plan.md                [generated]
agents/principal-review.md              [generated]
agents/review.md                        [generated]
architect/SKILL.md
architect/tests/specification.yaml
build/SKILL.md
build/tests/fixtures/E1/auth.test.ts
build/tests/fixtures/E1/auth.ts
build/tests/specification.yaml
contracts/debug.md.tmpl
contracts/plan.md.tmpl
contracts/review.md.tmpl
contracts/workflows.md.tmpl
debug/SKILL.md                          [generated]
debug/tests/specification.yaml
decide/SKILL.md
decide/tests/specification.yaml
docs/ASSURANCE.md
docs/HANDOFF.md
docs/validation/VALIDATION.md
docs/validation/record-artifacts.txt
docs/validation/unpublished-cells.txt
git-ops/SKILL.md
git-ops/tests/specification.yaml
package-lock.json
package.json
plan/SKILL.md                           [generated]
plan/tests/specification.yaml
prompts/bugfix.md                       [generated]
prompts/feature.md                      [generated]
prompts/principal-bugfix.md             [generated]
prompts/principal-feature.md            [generated]
review/SKILL.md                         [generated]
review/tests/specification.yaml
schemas/assurance-evidence-receipt-v1.schema.json
schemas/assurance-run-state-v1.schema.json
schemas/assurance-task-packet-v1.schema.json
scripts/assurance-state.mjs
scripts/check-pack.mjs
scripts/check-word-budgets.mjs
scripts/generate-contracts.mjs
scripts/pack-meta.mjs
scripts/snapshot-workspace.mjs
tests/e2e/run-e2e.sh
tests/install/clean-home.test.mjs
tests/unit/assurance-contracts.test.mjs
tests/unit/assurance-state.test.mjs
tests/unit/generated-contracts.test.mjs
tests/unit/handoff-transitions.test.mjs
tests/unit/pack-meta.test.mjs
tests/unit/snapshot-workspace.test.mjs
```

## 11. Handoff verdict

- **RELEASED, STATICALLY VERIFIED** — `3.0.1` deterministic/static checks are green; the tag and
  npm `latest` are independently verified. This is not a measurement verdict and must never be
  quoted as one.
- **READY FOR PI-DADDY INTEGRATION** — v1 protocol is specified; spawn-time CWD validation and
  governed-child lease coordination remain integration work, while raw-shell confinement requires
  an OS sandbox or constrained broker.
- **READY FOR SKILL-HARNESS INTEGRATION** — static specs/fixtures lint; paid subjects/judges remain
  unauthorized.
- **Still open after 3.0.1** — the release deliberately shipped with these open, and each is the
  reason v3 quotes no score:
  1. the authorized two-model skill-harness wave (§9) — 106 scenarios × 3 reps × 2 models;
  2. the live eight-cell workflow E2E (§6, §9), plus the optional scoped/escalation/stale cells;
  3. pi-daddy runtime enforcement evidence for the ceilings and the writer lease.
  A future release that lands measurements changes no contract — it replaces the exempt-stale
  board with a real v3 one and rewrites the validation boundary in `docs/validation/VALIDATION.md`.

## Standing hazards

- Edit generated Plan/Review/Debug/workflow sources only through `contracts/*.md.tmpl`, then run
  `npm run generate`.
- Never advertise historical v2.4 scores as v3 evidence.
- `pi -p "/principal-feature ..."` does not expand slash commands non-interactively; live E2E must
  use `--prompt-template`.
- Critical cannot use absence-only inline fallback for critique/review.
- Never treat the hash chain as a signature or the workspace writer field as an OS lock.

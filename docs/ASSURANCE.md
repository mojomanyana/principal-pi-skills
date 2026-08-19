# v3 assurance profiles

**Status:** implemented in the `3.0.0` source tree; not yet published or model-measured.
`standard` remains the default Option B workflow. `critical` selects Option C controls inside
the same seven-skill suite.

## Responsibility split

- **The two generated workflow prompts are the controller.** They establish authority/risk,
  choose phases, create task packets, invoke existing skills/agents, adjudicate findings,
  and stop for user decisions. Their common rules live once in
  `contracts/workflows.md.tmpl`.
- **`scripts/assurance-state.mjs` is the deterministic seam.** It parses profiles/scopes,
  validates events and task packets, enforces legal transitions, hashes the append-only log,
  derives the current snapshot, and evaluates freshness/critical gates. It deliberately does
  not invoke models or route skills; that would create a second orchestration product.
- **Skills retain phase judgment.** Plan/Review/Debug still render dual-use contracts from
  one template each. Build alone writes durable source. Debug/Review mutate only disposable
  workspaces. Git-Ops owns version-control finalization.
- **Operational state is not a source write.** In a repository it lives under the git common
  directory, `.git/principal-pi-skills/assurance-v1/runs/<run_id>/`; in a non-repo it lives
  under XDG state. A task/workflow process may append receipts there without granting Plan,
  Review, or Debug write access to the product tree.

This is intentionally smaller than a full runtime controller. A host integration may replace
the prompt controller, but it must emit the same v1 events and satisfy the same gates. It may
use a fresh builder context per task; portable inline Build remains supported and is not
mandatorily delegated.

## Invocation and parsing

Both namespaced prompts accept:

```text
--assurance lean
--assurance standard                 # default when omitted
--assurance critical
--assurance high                     # alias: critical
--critical-scope "entire-run"
--critical-scope "task-2,task-4"
--critical-scope "db/migrations/**,src/auth/**"
```

A critical profile without a scope means `entire-run`; narrowing is never inferred. “Treat
this as critical” and “escalate this run to critical before the migration” map to the same
state. Supplying `--critical-scope` itself is explicit critical intent.

The parser can policy-elevate **standard** for an evidenced migration, auth/authz, billing,
destructive data operation, public API break, credential/secrets operation, protected-history
rewrite, or production side effect. It records the trigger in `assurance.reason`. A tiny
reversible docs/comment correction is not elevated merely because its text mentions billing or
auth, but a mixed docs-plus-auth/billing implementation request is elevated. An explicit lean
request is not silently rewritten; existing one-way and Git-Ops safety
gates still apply.

## Persistence model

`events.jsonl` is append-only. Each event has:

```text
schema_version, seq, type, at, run_id, prev_digest, event_digest
```

`event_digest` is SHA-256 over canonical key-sorted JSON excluding that field. Loading replays
every event and rejects empty/misplaced logs, unsupported versions, invalid or non-canonicalizable
JSON values, sequence gaps, broken links, or non-recomputed digest changes. This is not tamper-proof:
a writer can recompute a replacement
chain, and tail truncation needs an externally trusted final sequence/digest to detect.
`snapshot.json` is an atomic, disposable projection, not a trusted anchor; the log is authoritative.

The current state conforms to
[`schemas/assurance-run-state-v1.schema.json`](../schemas/assurance-run-state-v1.schema.json)
and persists at least:

```text
run_id
assurance.requested / effective / source / reason / scope / activated_at
risk and policy trigger
frozen base/head/candidate-tree and backfill status
phase status plus task_id/workspace_id/definition_digest where applicable
plan_digest and definition_digests
validated task packets/digests and explicit supersession after approved replans
workspace identity and the single Build writer lease
evidence receipts (command, exit, head, candidate tree, task/workspace, event sequence)
review axis/verdict/context/head/tree receipts
finding adjudication and one-at-a-time repairs
just-in-time approvals, finish choice, and final branch/head/tree completion
```

Evidence receipts conform to
[`schemas/assurance-evidence-receipt-v1.schema.json`](../schemas/assurance-evidence-receipt-v1.schema.json).
A task conforms to
[`schemas/assurance-task-packet-v1.schema.json`](../schemas/assurance-task-packet-v1.schema.json):

```text
schema_version, run_id, task_id, title
Authority[]
Global constraints[]
Out of scope[]
Critical scope { applies, matched_by[] }
files[], dependencies[]
Done command
Review risk
workspace_id
plan_digest
Definition digests{}
```

The CLI validates the same required fields without a runtime dependency. Its principal
operations are:

```bash
principal-pi-assurance contract                         # exact event payload reference
principal-pi-assurance init --workflow feature < request.json  # one-line {"request":...}; no shell interpolation
principal-pi-assurance event --run-id <id> <<<'{"type":"risk_classified",...}'
principal-pi-assurance show --run-id <id>
principal-pi-assurance gate --run-id <id> --gate pre-build --task-id task-1
principal-pi-assurance gate --run-id <id> --gate task-complete --task-id task-1
principal-pi-assurance gate --run-id <id> --gate finalize  # pre-operation readiness
principal-pi-assurance gate --run-id <id> --gate finish    # post-operation completion
principal-pi-assurance gate --run-id <id> --gate side-effect --action push
principal-pi-assurance validate-task < packet.json
```

A failed critical gate exits nonzero with the exact token
`BLOCKED_CRITICAL_ASSURANCE` and all missing controls.

## Behavior matrix

| Control | Lean | Standard (default Option B) | Critical (selected Option C) |
|---|---|---|---|
| Right-sizing | Tiny/reversible direct path | Tiny work remains tiny | Tiny work skips architecture theater, but retains scoped critical gates |
| Authority/risk | Minimal explicit authority | Required; policy may escalate | Required and persisted per task |
| Plan | Optional for tiny work | Vertical slices for substantive work | Independent fresh plan critique before task packets |
| Workspace | Caller workspace allowed | Owned branch workspace preferred for substantive work | Owned isolated branch workspace required or blocked |
| Writer | Build only | Build only | One Build writer lease per workspace |
| Review | May skip delegation when tiny | Milestones and completion; inline fallback allowed only on absence | Every task: fresh spec + fresh quality contexts; final fresh whole-change review |
| Findings | Evidence-based | Adjudicate before repair | Same; no partial/majority gate, one accepted ID repaired at a time |
| Evidence | Fresh exact targeted check | Fresh target plus relevant suite/build/lint | Fresh target, full suite/build/lint, requirements trace, risk checks; regression red proof where practical |
| Finish | Explicit merge/PR/keep | Finalize readiness, execute, persist final branch/head/tree, finish | Same, plus JIT approval for external/irreversible effects |

Discard and cleanup are never a fourth implicit finish; they require an explicit request.

## Escalation and downgrade

Critical is a minimum when the user requests it. A non-critical profile combined with
`--critical-scope` is rejected as contradictory. Escalation can happen at any time. After
implementation begins, `assurance_escalated` requires base/head/tree, freezes that exact candidate
and current evidence, and sets `critical_backfill_required`. Every backfill receipt must match all
three IDs. Source writes stop. An active repair is first persisted as `repair_suspended`; after
critical design/plan preflight and backfill, the accepted finding restarts with new task/workspace/
Build bindings while prior attempts remain auditable. `backfill_completed` is illegal without a
frozen diff and receipts.

Downgrade only accepts `authorized_by: "user"` and a non-empty reason. The snapshot preserves
the original `assurance.requested` while changing `effective` and `source` to
`user-downgrade`; inconvenience is not a reason the workflow proposes.

Evidence freshness is sequence-based as well as identity-based: a passing receipt must occur after
the last `code_changed`/repair event and match both current head context and exact candidate tree.
The tree is computed with a temporary Git index. Critical Review snapshots the explicit canonical
writer root, verifies the snapshot tree, and records that workspace explicitly. Git-Ops runs a
pre-operation `finalize` gate, requires staged/final tree equality, persists final branch/head/tree,
and only then passes `finish`. Receipts/reviews must also follow
`last_authority_seq`; profile/scope, risk, workspace, design, plan/critique, task-packet, and
backfill transitions advance it. This catches
stale evidence after source or authority changes even when Git HEAD is unchanged. Risk can only stay
level or increase. Finish requires explicit risk classification; substantive/consequential
non-critical work also requires a fresh completion APPROVE, while classified tiny work retains its
right-sized exception. Critical source/repair mutation receipts require canonical repository-relative
paths and recheck actual scope, packet authority, current pre-Build controls, and active
task/workspace/Build-definition bindings. Task evidence and both review axes must follow the
persisted Build-completion sequence. Critical finish additionally requires completed Build for every scoped task and a whole-change
review after all scoped task completions, exact-target task evidence, and review axes. Superseded
packets remain auditable, cannot receive later source changes or repairs, and do not count as
current scoped work. Plan replacement cannot begin during an active repair. Every profile's finish rejects started or
blocked phases. Fresh-context IDs are globally single-use across critique, reviews, and frozen-diff
review.

## Workspaces and side effects

`principal-pi-workspace create` remains detached for disposable Debug/Review experiments. Critical
Review uses `create --repo <canonical-writer-root>` rather than its invocation CWD and rejects a
snapshot-tree mismatch. Both the CLI and exported cleanup preserve a worktree and report failure whenever Git refuses removal; there
is no recursive-delete fallback. If setup and cleanup both fail, the error includes both causes and
the preserved path.
`create --branch principal/<run_id>` creates an owned Build worktree and keeps the branch
when the worktree is removed, enabling merge, PR, or keep. Critical cannot substitute the
caller checkout when creation fails. A workspace ID's root/mode/writer binding is immutable, as is
a recorded task packet under its task ID. Workspace ID and canonical root are trusted correlation
and lease inputs. A host such as pi-daddy can validate the child's initial CWD at spawn and coordinate
an exclusive writer lease among children it governs; that lease does not exclude other processes.
With unrestricted `bash`, initial CWD and prompt path rules do not provide confinement: actual
containment requires an OS sandbox or constrained non-shell execution broker.

Every profile retains consequence-aware approval immediately before migration execution, push,
publish, deletion, credential rotation, or production access; critical never relaxes it. Approval
to design or plan is not approval to execute.

## Compatibility

- **v2 invocation:** `/principal-feature <task>` and `/principal-bugfix <symptom>` remain valid;
  omitted assurance deterministically selects `standard`. Deprecated `/feature` and `/bugfix`
  aliases are generated as complete workflows because pi does not recursively expand slash commands.
- **pi-daddy:** all seven `allowed-tools` ceilings are unchanged. The state CLI is a parent
  controller binary, not a new skill capability. Critical fresh contexts must still fit the
  inherited grant; a missing capability blocks rather than broadening a ceiling.
- **pi subagents:** namespaced `principal-*` definitions remain the supported names; generic
  aliases stay opt-in. Lean/standard preserve absence-only inline fallback. Critical never
  calls inline self-review “independent.”
- **skill-harness:** each skill specification adds one `E1` v3 scenario; Git-Ops also adds a
  stale-receipt `E2`. These static specs are linted but were not model-run in this implementation, so old v2 result cells are
  historical and v3 publishes no score.

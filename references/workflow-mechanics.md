# Conditional coordinator mechanics

Use only the section for an optional facility actually involved in the task. These helpers
record/reconcile evidence; they do not execute a phase or supply semantic approval. The
workflow entrypoint retains mandatory authority, binding, one-writer and settlement rules.
`principal_workflow` snapshot/reference support inline work too; prepare/complete/retry bind
native delegations only. Keep inline reports with the existing private artifact helper, and
never dispatch an agent merely to obtain a bookkeeping completion record.
An explicit retry reason is required. Native proof must show the prior attempt settled, or
was authoritatively not-started with no execution. Active/uncertain attempts refuse. A retry
does not bypass permission checks or reinterpret a dismissed prompt as approval.

## Native result bookkeeping

Pass the returned `snapshot.candidate` directly as `expectedCandidate` to `prepare`. Supply
`inputPaths` for authority/evidence files that matter to this handoff; the tool calculates
references, while candidate identity already covers product files. Existing exact `inputs`
references remain valid. Avoid another product-file hash inventory.

Pass `prepared.operation_id` unchanged to native delegation. After settlement, immediately
call `complete` with `operationId: prepared.operation_id` and the actual `disposition`, before
repairing anything. `status` and `retry` also accept that ID without repeated task/step fields.
The immutable `result.json` retains the verified final and producer identity. `completion.json`
requires matching current inputs/candidate. `resultRetained: true` is historical evidence;
`completionValid: true` is bookkeeping freshness, and neither grants approval. A result already stale at first retention stays historical even if files are later restored.
Reconcile the affected work, never rewrite history.

## Archive exact evidence

A caller's external evidence directory is an authorized private archive, not a child's
primary write target. After native settlement, retain the original and copy complete bytes
exclusively, recording original path, SHA-256 and copy path. Refuse overwrites and symlink
redirects; verify matching bytes mechanically. Use producer public-capture references
directly, without another handcrafted manifest or retranscribed receipt. An archive failure
does not destroy primary evidence; it blocks only work that requires the copy.

The selected package's `principal-pi-progress reference <file>` and
`copy <run> <name> <source> <expected-sha256>` implement existing exact-byte operations.
If its binary is not on PATH, use Node with the actual selected package's
`scripts/progress-artifacts.mjs`; do not download a helper or guess its installation/schema.

## Optional progress index

Use `principal-pi-progress` for all writes: create a private ignored run, persist/reference
complete evidence, then append phase facts. Never hand-write run.json or JSONL. V1 facts
planned/implemented/reviewed/integrated/verified are separate claims, each unknown/incomplete/
complete with evidence and note; a completed review can have CHANGES-REQUESTED. It is not approval.

After append and before relying on resumed progress, run `check <run> <actual-current-candidate>`
and inspect all issues. Diagnostic read alone is not a successful check. A passing check
establishes index integrity, not completion; reconcile all required steps and actual verdicts.
Changed candidate/plan/report refs invalidate affected claims. Preserve incomplete/corrupt
history in place and start a new run; do not truncate it or promote saved role/title flags.

For full committed workflows, `check-completion <run> <full-commit> <required-step>...`
checks exact HEAD, clean tracked/untracked state, required latest phase claims, historical
evidence and unresolved findings. Masked index entries and indexed submodules refuse.
Use the full explicit step set and same full commit for that run/records. Accepted or
duplicate labels alone do not verify a finding. Partial/planless work never invents phases
to pass. Source-required completion checks remain required; they still do not approve work.

## Opt-in quiescent resume

Offline `principal-pi-resume prepare/inspect` does not authorize continuation. Only interactive
`/principal-resume arm <checkpoint>` with explicit operator confirmation arms one next phase
at an idle boundary. It binds exact plan, scope, candidate, reports, package, model, session
leaf and native owned-execution settlement. Same-session startup/resume/reload rechecks every
binding and consumes durably before queuing the fixed continuation. Changed evidence,
forks/new sessions, unknown/active children or uncertain dispatch refuse. No arbitrary
nextAction execution, mid-execution recovery, approval reconstruction or silent re-arm.

The finalized Pi resource receipt is readiness, not permission. The runtime waits for the
exact per-pass inert prompt resource; a timer during discovery does not prove completion.
Operator semantic gates still apply. Disarm preserves history; status explains state.
Use the actual selected installation, since package location is part of checkpoint identity.
This Linux x64 facility is not a filesystem sandbox and implies no JEV or retention consent.

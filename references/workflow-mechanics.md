# Conditional coordinator mechanics

Read only the section for a facility the task actually uses. These helpers record and reconcile
evidence; they never execute a phase or approve work. `principal_workflow` snapshot/reference
serve inline work too; prepare/complete/retry bind native delegations only. Never dispatch an agent
merely to obtain a bookkeeping record.

## Native result bookkeeping

### New folders and saved-note recaps

`principal_workflow({action:"preflight"})` reports the folder's readiness without writing. A missing
repository or initial commit is a setup prerequisite, not a product defect. `action:"setup"` or
`/principal-setup` asks once in interactive Pi, then creates one empty baseline commit, leaves
product files uncommitted and adds only local runtime exclusions. Cancel, headless mode and parent
repositories never initialize another folder. A partial failure reports which steps completed;
inspect them instead of retrying blindly.

Recalling delivered work after `/new` reads the selected project's notes and reports historical
results; it requests no Git setup, review, tests or new saved handoff. A blocked lookup leaves
history unknown.

### Preparation input corrections

`task` is 1-80 ASCII letters, digits, underscores or hyphens, starting with a letter or digit (for
example `workshop-desk-v1-stage1`); `step` is a nonblank name of at most 200 characters.

Host schema validation can reject malformed `prepare` task/step before the tool executes;
`PREPARE_INPUT_INVALID` reports the same before any administrative write, with
`operationAllocated: false`. Correct the named field and repeat `prepare` for the same authorized
work without asking permission again. Reuse established task/step identities; for a new task with
no internal identity, choose a short valid ID. Keep attempt unchanged and never rename an existing
operation to evade a refusal. This is argument correction, not `retry` of an executed operation;
it says nothing about earlier work.

### Candidates, completion and changed output

Pass `snapshot.candidate` directly as `expectedCandidate`. `inputPaths` and exact `inputs` pin
immutable authority/evidence for this operation. `contextPaths` lists existing readable workspace
paths expected to change; these hints are not unchanged prerequisites or permission, and do not
inject file contents. Supply needed allowed references in the child handoff. A path cannot serve
both roles. The candidate already covers product files. A refusal
distinguishes missing or malformed identity from a different candidate or workspace; dimensions an
older or ID-only snapshot cannot explain stay unknown. Understand why the expected input differs
before using a fresh snapshot; never reconstruct hashes or repeat prepare unchanged.

Pass `prepared.delegationArguments` to native delegation. After settlement, immediately call
`complete` with the prepared `task`, `step` and actual `disposition`, before repairing anything.
`retryMode: "automatic"` requires the execution owner's safety proof and consumes one durable
allowance per phase lineage. Pass its returned delegation arguments unchanged, including definitionId.
Status and recovery retain the spent budget after `/new`; a repeated request can reuse only its same
successor. An absent proof on older Daddy versions permits no automatic retry. Explicit authorized
manual retries use `retryMode: "manual"`; never use it to evade an exhausted automatic allowance.
Omitted mode selects the bounded path when proof or an automatic lineage exists, otherwise retaining
legacy manual behavior. A denied retry blocks that phase, not unrelated authorized work.

A settled complete final is not an automatic-retry candidate merely because its Build is partial.
Retain the actual disposition and inspect the report/files. Continue only missing authorized work
with a new scoped unit or already-authorized inline path, preserving the old operation and useful
evidence. Review UNVERIFIED instead requires evidence reconciliation, not inferred product repair.
Neither path clears uncertain execution, changed authority or required review gates.

`status`, `retry`, `history` and `result` take the same names; without `attempt` they select the
latest, refusing with `choices` when it is uncertain or another coordinator's. `resultRetained: true`
is immutable history; `completionValid: true` is current bookkeeping freshness; neither is approval.

Build/Debug normally changes the candidate: complete its original operation, never prepare again.
If repeated preparation reports `PREPARED_OUTPUT_CHANGED`, inspect the native result with
`recovery.resultArguments`, then call `recovery.completionArguments` with the actual `disposition`.
That response proves neither start nor success and authorizes no retry. Keep partial delivery and
reported-check limitations visible.

If a child also wrote a different report, `complete` preserves it as `authoredReport` and retains
the exact native final in a separate `phase.native-final.md`. Use the returned `report` reference
for the canonical result; `reportPath` still identifies the original prepared destination. Neither
prose similarity nor newline normalization substitutes for the native final's exact bytes. A changed
or unsafe retained artifact still refuses; completion is not review approval.

### Transfer arguments directly

For an already-authorized fresh handoff, this Codemode excerpt passes the prepared arguments and
the current definition through without constructing an identity. Resubmitting the same prepared
operation reuses Daddy's idempotent claim instead of starting another child. Still verify the
native final and cleanup before completion.

```js
async function prepareAndDelegate(prepareArguments, taskText) {
  const prepared = await tools.principal_workflow(prepareArguments);
  if (prepared.state !== "prepared" || !prepared.delegationArguments) {
    throw new Error(prepared.error ?? "Preparation is not current; inspect its result");
  }
  const response = await tools.delegate_describe({ agent: prepared.delegationArguments.agent });
  const definition = typeof response === "string" ? JSON.parse(response) : response;
  if (definition.agent !== prepared.phase || definition.binding?.package !== "principal-pi-skills" ||
      definition.binding.phase !== prepared.phase || !definition.definitionId) {
    throw new Error("The selected native definition does not match this prepared phase");
  }
  return tools.delegate({ ...prepared.delegationArguments, definitionId: definition.definitionId, task: taskText });
}
```

`OPERATION_ID_INVALID` means a supplied prepared-operation ID has the wrong format; omit it and name
the task and step. When a native result confirms a call was refused before admission because of a
named argument, correct only that argument and reuse the same prepared operation and binding.
`result` also accepts a generic native operation ID.

### Recover after an update or a new session

When the normal checks identify an older operation, use the returned `recoverArguments`, never a
replacement task. `recover` inspects read-only by default:

- `reused`: retained output still matches the current candidate and inputs. Reuse the report and
  its historical checks; this is not fresh approval.
- `ready-to-continue`: the producer holds an immutable no-start result for the original operation.
  For currently authorized work, pass `continueArguments` unchanged; they create one linked
  successor owned by this session and leave the original record intact.
- `running`, `historical`, `uncertain` or `existing-successor`: read the outcome and offered options;
  inspect the original run or delivered files, or continue independent work. Absence, an idle session
  or an empty checkout does not prove an operation never started.

Recall-only requests never continue. A recovered completed Build returns `sourceRecovery`; include it
with the original `sourceOperationId` for an optional bound Review instead of rebuilding.

If an older report collision prevented Principal result retention, a qualified producer can still
provide its exact final and settled cleanup. Inspection returns that history and `retainArguments`
without writing. For authorized continuation, pass those arguments unchanged (`mode: "retain"`):
they bind the original request, producer artifact and current candidate, preserve both reports, and
write an immutable `historical-result.json`. Repeats reuse it; no Build or successor is dispatched.
Recall-only requests do not retain new records.

`observedCandidate` is the tree seen during historical retention, **not** the missing original
Build output. `currentCandidate` describes today's tree; `completionValid` remains false and
`sourceRecovery` is absent. Reconcile current files and authority; continue any remaining authorized
implementation before a fresh independently scoped Review using the preserved report references.
This path cannot satisfy an existing bound work-map Build-completion gate or automatically settle
that task. Keep partial-delivery limitations and remaining required checks explicit.

### Read historical native results

After restarting the same Pi session, `action: "history"` with the task and step reads Daddy's
durable result for the original coordinator session and workspace. It is read-only and returns
`completionValid: false`, `approval: false` and `applicability: "not-established"`. Missing or
changed producer bytes are an error, not evidence that the old dispatch never started. Older Daddy
versions report the bridge unavailable.

## Archive exact evidence

A caller's external evidence directory is an authorized private archive, not a child's primary write
target. After native settlement, keep the original and copy complete bytes exclusively, recording
original path, SHA-256 and copy path. Refuse overwrites and symlink redirects. Use producer
public-capture references directly. An archive failure keeps the primary evidence and blocks only work
that requires the copy. Use the selected package's `principal-pi-progress reference <file>` and
`copy <run> <name> <source> <expected-sha256>`, or Node with its `scripts/progress-artifacts.mjs`;
never download or guess a helper.

## Optional progress index

Use `principal-pi-progress` for all writes: create a private ignored run, persist or reference
complete evidence, then append phase facts. Never hand-write run.json or JSONL. The v1 facts
planned/implemented/reviewed/integrated/verified are separate claims, each unknown, incomplete or
complete with evidence; a completed review can be CHANGES-REQUESTED.

After append and before relying on resumed progress, run `check <run> <actual-current-candidate>`.
It proves integrity, not completion; reconcile required steps and actual verdicts separately.
Preserve corrupt history in place and start a new run; do not truncate it.

For full committed workflows, `check-completion <run> <full-commit> <required-step>...` checks exact
HEAD, clean state, latest phase claims and unresolved findings. Supply the explicit step set. Masked
index entries and indexed submodules refuse. Accepted or duplicate labels alone do not verify a
finding. Partial work never invents phases to pass; a pass still approves nothing.

## Opt-in quiescent resume

Offline `principal-pi-resume prepare/inspect` authorizes nothing. Only interactive
`/principal-resume arm <checkpoint>` with explicit operator confirmation arms one next phase at an idle
boundary. Startup in the same session rechecks every binding and consumes durably before queuing the
fixed continuation; changed evidence, new sessions, active children or uncertain dispatch refuse. No
arbitrary nextAction execution, mid-execution recovery or silent re-arm. The finalized Pi resource
receipt is readiness, not permission. Use the actual selected installation.

---
description: Cold review of the current branch against a base, then finish mode.
argument-hint: "[base]"
---
Review this branch against `${1:-main}` and finish it.

You are the orchestrator; this chain invokes neither Plan nor Build. Work that was
built outside the workflows gets the same cold review the workflows give. Use `integrated`
review scope: prior task approval does not cover assembled interactions or global gates.
Any scoped repair keeps the original full branch baseline and unresolved source obligations;
comment URL/ID, candidate and accepted/disputed/duplicate/stale statuses remain traceable.

**Optional JEV advice.** If `jev_advice` is available, the coordinator checks
`jev_advice({action:"status"})`. Only enabled workflow mode permits evaluation. After
deterministic authority, candidate and evidence checks, select an uncertain acceptance-evidence
handoff only when advice could help; skip obvious decisions, with no review quota. Freeze a
bounded selected decision-time requirement/evidence packet for the actual candidate.
Exclude reviewer verdicts and prior JEV outcomes. Then call
`jev_advice({action:"evaluate",candidate,requirements,evidence})`. Use known accessible sources:
no private transcripts, credentials, full file scans or invented references. Selected input
is not verified public capture. Keep the prediction out of every independent review's
handoff until its own verdict (task, integrated or scoped repair); preserve the full underlying
authority and evidence. Afterwards reconcile suggestions against code/tests. Advice is never
approval and cannot waive a gate, replace review or establish a defect. Preserve returned
refs/usage as unlabeled advice under current storage consent; training permission is separate.
Disabled/manual mode, unavailable tools or errors leave the ordinary workflow proceeding when
required gates are met; no CLI fallback may bypass refusal. Never enable JEV implicitly.

1. Find the range: `git merge-base ${1:-main} HEAD` is the base; `HEAD` is the head. If
   the working tree is dirty, say so and stop — review judges committed work.
2. Before dispatch requiring a report, resolve the actual child workspace and allocate its primary report under
   `.principal/reports/<task>-<run>/<candidate>/`; inline artifacts use the coordinator's workspace.
   Before any artifact write, create if absent `.principal/.gitignore` containing `*`;
   never overwrite an existing ignore file. Verify destinations with `git check-ignore`;
   if an existing ignore policy exposes them, stop for caller policy repair. Permission failure
   or an explicit prohibition on local artifacts also stops dispatch. Routine safe allocation
   within existing task authority needs no separate user approval. Investigate remains read-only;
   the coordinator persists its report.
   Create a new unused directory (timestamp/collision suffix for run; full head SHA for candidate)
   as `<artifact-dir>`. Pass the absolute unused report path and report-write scope to the child.
   Repeat reviews get new runs; never overwrite prior files. Preserve a caller-chosen primary report path only if workspace-local, ignored and unused; otherwise select the safe default.
   A requested external evidence directory is a coordinator archive destination, not the child's
   primary report path. After return (and native settlement for delegated work), copy the complete
   report bytes to an authorized private archive; never overwrite archive files or follow symlink redirects. Record original
   path + SHA-256 + copy path, verify matching hashes, and retain the original through review,
   repair and resume. Copying within existing authority needs no extra permission; an archive
   failure leaves the primary report intact: report the gap and stop only work requiring that
   copy. Do not recreate a native capture manifest or replace its original response/source refs.
   On resume, read the named original review path and reviewed candidate; ask if ambiguous.
   Retain the original whole-change baseline (base/head SHAs, commit list and complete diff),
   original finding definitions, authority and evidence files through any later repair request.
   Record these references in the existing Authority/Candidate fields, not just REV IDs.
   Carry the governing exact task, accessible source/definition paths, optional plan map and
   available candidate-bound evidence; do not manufacture a plan or assume missing authority.
   If dialogue-only authority needs a file, persist its exact text with provenance under
   `<artifact-dir>/authority.md`. Optional read-only Investigate can locate facts; pass its full report
   alongside original sources, never instead of them. Review owns the verdict.
   Native Review uses `delegate_describe({agent:"review"})`: require binding package
   `principal-pi-skills`, phase `review`, then call `delegate({agent:"review",definitionId,...})`
   with that captured ID. Preserve the unmodified describe response in a private handoff report,
   with accessible actual selected skill/agent sources and manifest, original paths/hashes and
   gate owners/due stages; never guess an installed source path. Missing due prerequisites block.
   The reviewer checks due scope evidence; its own future terminal/cleanup remains coordinator-owned.
   After return, retain and check its full native result, report and settlement before consuming
   the verdict. Unknown cleanup or another unresolved required gate still prevents finish.
   Require native `cleanup.state=settled` with its matching identity-bound process receipt.
   No disposable workspace is not process-cleanup evidence; preserve emitted runtime evidence.
   The runtime checks enabled selected source and generated bytes. A missing/wrong binding,
   stale reload, permission/context refusal, timeout, report gap or uncertain cleanup stops;
   no substitution. Only genuinely absent native tools permit an explicitly configured
   legacy `principal-review` runner. Inline review is a deliberate choice, not failure fallback.
   Follow authored model/effort policy. Hand it the base and head SHAs and the commit list;
   it computes the diff itself in a disposable workspace. Persist its complete result to
   `<artifact-dir>/review-1.md`; save the whole-change diff there as `review-diff.txt` too.
   Findings retain source locators and acceptance conditions.
3. Route on the verdict. `APPROVE` or `APPROVE-WITH-NITS` → Git-Ops finish mode: fresh
   full suite on this tree, then exactly merge locally / push and open a PR / keep the
   branch. `CHANGES-REQUESTED` → present the findings with their `[REV-…]` IDs and stop;
   the user decides which to accept, and a repair is a new request carrying that full report
   path and finding definitions, not IDs alone. `UNVERIFIED` → say what blocked verification and stop.
4. End with `Digest:` followed by one line per label: `Ref:` (base..head), `Verdict:`,
   `Findings:` (count by severity, or none), `Assumptions:`, `Follow-ups:`, `Evidence gaps:`, `Execution contexts:`
   (inline / delegated). No transcript narration after it.

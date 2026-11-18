---
description: Cold review of the current branch against a base, then finish mode.
argument-hint: "[base]"
---
Review this branch against `${1:-main}` and finish it.

This chain invokes neither Plan nor Build. Use integrated review of the assembled change; prior task
approval alone does not cover interactions or global gates. Read existing outcome, standing authority
and accepted verification fallbacks before asking; summaries grant no authority. Hand off current
references, not copied history.

1. Find `git merge-base ${1:-main} HEAD` and full HEAD. If dirty, report that this workflow reviews
   committed work and stop. Capture the commit list and complete diff once. Use `principal_workflow`
   snapshot/reference for canonical observations. If artifact writes are prohibited, skip
   prepare/complete: dispatch with a unique operation_id and use `result` to verify and read the
   exact settled native final without retaining a file. Otherwise prepare the native review
   operation and pass its returned `delegationArguments` to delegate. Preparation never authorizes
   execution or approval; inline work needs no delegation solely to close bookkeeping.
2. Apply this artifact retention step only when writes are allowed. Before any artifact write,
   create if absent `.principal/.gitignore` containing `*`; never overwrite an existing ignore file.
   An exposed ignore policy or permission failure stops artifact-dependent dispatch; routine safe
   allocation needs no extra approval. Native prepare
   allocates the private report destination under `.principal/reports/<task>-<run>/<candidate>/` in
   the actual child's workspace; do not allocate a duplicate. Outside native preparation, use a new
   unused directory. A caller report path must never overwrite previous reports. Preserve the
   original review path, reviewed candidate and whole-change baseline through repair or resume.
   External copies use the archive section of `references/workflow-mechanics.md`.
3. Pass exact task authority, accessible source/definition references, the optional plan map and
   candidate-bound evidence; do not create a plan or require full-plan reads. For a material
   test-design question, Review may load the distinct test-review skill or consume a current
   independent test-review report; state which occurred. Test-quality SOUND is no product approval.
   Optional Investigate locates facts without replacing sources or the verdict.
   Native Review uses `delegate_describe({agent:"review"})`: require binding package
   `principal-pi-skills`, phase review and captured `definitionId`, then
   `delegate({agent:"review",definitionId,...})`. Reuse a still-current binding; describe again after
   a reload or staleness. Keep the unmodified describe response, selected skill/agent source
   references and gate owners/due stages available; never guess an installation path or reconstruct
   a receipt. Missing due prerequisites block.
4. A missing/wrong/disabled binding, stale reload, unqualified backend, permission/context refusal,
   timeout, report gap or uncertain cleanup stops dependent work; no automatic substitution. An
   already-authorized alternative must satisfy its own prerequisites and cannot clear uncertain
   admission/cleanup or waive a required gate. Only genuinely absent native tools permit an
   explicitly configured legacy `principal-review` runner. Inline review is a deliberate choice, not a
   failure fallback. Follow authored model/effort policy.
   After return, check the full native result, complete report and settlement before consuming the
   verdict: `cleanup.state=settled` in the runtime evidence summary. Daddy reports settled only after
   verifying an identity-bound receipt; `complete` rechecks the native execution identity. Do not
   look for receipt fields in tool text. Missing emitted evidence
   blocks finish. With writes allowed, complete the native workflow operation, which retains the exact
   captured final verdict; with writes prohibited, consume the verified `result` directly. A failure
   stays visible and incomplete. A blocked, unverified or changes-requested result never becomes approval.
5. Read Verdict before Next. APPROVE or APPROVE-WITH-NITS supports Git-Ops finish mode only after
   every due integrated gate. CHANGES-REQUESTED presents concrete findings and stops; repair needs
   actual authorization and the full accepted definitions, not IDs alone. UNVERIFIED with
   `Next: evidence` asks for coordinator evidence/access reconciliation, not implementation. A named
   doubt can justify a targeted probe. Do not reject matching evidence because the reviewer did not
   replay a suite, and do not automatically re-delegate after metadata repair. Stop for a genuinely
   missing authority, permission or required-evidence decision.
6. Git-Ops honors known finish preferences and required verification, reusing matching evidence
   unless a source-required fresh gate or named doubt requires a run. No automatic push, tag,
   force-push or cleanup. End with `Digest:` and `Ref:` (base..head), `Verdict:`, `Findings:`,
   `Assumptions:`, `Follow-ups:`, `Evidence gaps:`, `Execution contexts:`.

Optional JEV: check `jev_advice({action:"status"})` only when advice could help. Only enabled workflow
mode allows selected bounded evaluations after deterministic gates, with stage, proposed nextAction,
the precise uncertainty and current candidate/requirements/evidence. Use code for file/hash checks. Do
not ask all-acceptance readiness before required review. Exclude reviewer verdicts and prior
predictions, and withhold advice from cold review until its own verdict. No quota or implicit
activation; disabled, manual, unavailable or error states permit ordinary authorized work, with no CLI
bypass. Advice supplies no approval, gate waiver or defect. Storage consent and curation/training
permission remain separate; predictions are not labels; private transcripts/secrets and OpenAI
Decisions are excluded. You may assess one proposed evidence/tool step (a needed Bookie reference,
Scout public research or a focused check), preferring existing evidence. Select only public or
already-redacted facts; Bookie retrieval permission does not authorize sending its body to JEV. No
mandatory stage or per-tool advice, argument validation, access grant, retry proof or model-policy change.

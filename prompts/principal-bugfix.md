---
description: Bugfix spine — debug, approval, build, review, git-ops.
argument-hint: "<symptom>"
---
Execute this workflow for: $@

<!-- shared:start -->
## Coordinate the outcome

Choose useful outputs, not a fixed ceremony. Decide resolves a consequential choice;
Architect defines structure; Plan coordinates dependencies. A clear authorized change
can go directly to Build and independent Review. Do not create a plan merely to satisfy a
phase list. Preserve the user's exact task, source IDs/definitions and current authority
once; pass references and relevant sections, not copied history or generic gate matrices.
Read referenced authority before alleging it is missing. Existing explicit user authorization
for this scope persists; do not ask again. Missing or conflicting normative meaning blocks
affected work. Material scope/design changes and one-way actions retain applicable approval.

**Native execution.** Call `delegate_describe({agent:"phase"})`; require package
`principal-pi-skills`, exact phase and captured `definitionId`. Native phases are `plan`,
`build`, `review`, `test-review`, `debug`, `investigate`. Pass the ID to every child; reuse
current selected bindings until reload/resource changes or runtime staleness. Preserve the
unmodified describe response and selected skill/agent source references. Enabled public
capture supplies them; never guess an installation path or reconstruct native JSON.
Missing/wrong/disabled/stale binding, permission/context refusal, unqualified backend,
timeout, report gap or uncertain cleanup stops dependent work. No inline/foreign runner
fallback after failure. Only genuinely absent native tools permit an explicitly configured
legacy runner. Honor authored model/effort policy; leaves never dispatch agents.

**Mechanical handoff.** Use `principal_workflow` snapshot/reference for canonical candidate
and exact file observations, including inline/evidence work. Inline work needs no dummy
delegation merely to close bookkeeping. If the task prohibits all filesystem writes, skip
prepare/complete: dispatch with a unique operation_id and use `result` to verify and read
the exact settled native final without retaining a file. Do not silently create bookkeeping. For native work, `prepare` returns operation_id, canonical workspace,
reportPath and handoff metadata; pass them unchanged alongside definitionId. It may create
ignored administrative files. Its prepared directory is expected to exist; do not assert
that it is absent or rediscover helpers. Use `status` before repeating/resuming an operation; `retry` preserves prior failed attempts;
reuse current references, not another agent. Do not invent a fingerprint formula.

Each child returns its complete final report; Plan also writes its actual plan. After the
child returns, the coordinator checks the full native result and identity-bound
`cleanup.state=settled` receipt before dependent work, including consuming Review's verdict.
Missing evidence due now blocks; later coordinator-owned terminal/cleanup gates retain their
owner and due stage. Use `complete` after native settlement: it retains the exact captured
final automatically at the prepared report path. Read every successful report as well as
blocked ones. A completion failure remains incomplete and visible; never hand-write a
success record. This tool does not execute phases, grant permission, infer approval or
interpret a semantic verdict. Correct authorized path/metadata errors with tools, preserving
the original failure; never bypass a real authority or settlement gate.

Before any artifact write outside tool-owned preparation, create if absent
`.principal/.gitignore` containing `*`; never overwrite an existing ignore file. Use a new
unused private ignored report path in the actual workspace; caller report paths must not
overwrite evidence. Native task/run/candidate allocation belongs to prepare, not the child.
Inline Build persists its complete implementation report before delegated Review. Plan
writes only its plan/absent ignore; Investigate remains read-only. Distinguish no product
changes from administrative writes. External copies and legacy reports use the conditional
reference below; do not make another evidence package for every phase.

**Build.** A coherent feature is one unit with implementation, behavioral tests and docs.
Split for actual dependencies, risks or independent increments; one writer per working tree.
Pass outcome, current authority, relevant plan sections (if any), accepted finding definitions
and candidate references. For an approved independent batch use
`delegate_all({children:[...]})`, with `agent:"build"` and captured build `definitionId` on
each child; never overlapping single calls. Writers need distinct precreated registered Git
worktrees and declared scopes/dependencies. Shared interfaces/resources may serialize them.
Read all outcomes, preserve completed siblings after failure, review candidates and integrate
serially with merged checks. Do not turn an evidence-only handoff failure into implementation.

## Review and convergence

Review the complete candidate independently with `delegate({agent:"review",definitionId,...})`.
Supply original authority, candidate-bound Build evidence and a complete diff once. Choose
task, integrated or scoped-repair scope; keep the original review path, reviewed candidate,
whole-change baseline and accepted finding definitions accessible through repair/resume.
Only integrated approval plus all due gates supports finish. A focused test question may
use the distinct `test-review` skill within Review, or a separate independent child when
requested/useful. Report which occurred; neither mandates another whole-code review.

Read Verdict before Next:
| Review verdict | Next | Coordinator action |
|---|---|---|
| CHANGES-REQUESTED | build | Repair accepted concrete product/test findings within authority. |
| UNVERIFIED | evidence | Reconcile evidence/access or ask the needed caller question; no automatic implementation. |
| APPROVE | git-ops | Finish only for integrated scope with all required gates settled. |
| APPROVE-WITH-NITS | git-ops | Same integrated-scope and gate requirements. |

`Next: evidence` is coordinator work, not another phase or fallback. Resolve supplied paths
in the named workspace; a wrong checkout/ignored-file search is not permission refusal.
Record actual errors. Reuse matching relevant source, tests, scope, configuration and
environment evidence; independent judgment does not require a fresh full suite. A docs-only
or metadata correction does not invalidate unrelated behavior evidence unless the contract,
relevant inputs or a required gate changes. For a named doubt run the smallest deciding
check or disposable probe. A demonstrated defect can then go to Build.

Product repairs receive scoped re-review of accepted findings and new breakage; retain
original evidence gaps/global gates. Use integrated review for remaining whole-change
interactions. Continue distinct authorized fixes; stop/reassess when the same failure
repeats without new evidence, material authority changes or runtime gates block. No arbitrary
round quota. `Next: debug` requests diagnosis; `Next: blocked` stops affected work. A BLOCKED
question needing authority goes to the user; deterministic handoff repair needs no repeat
approval. Do not guess missing normative definitions.

**Before starting or resuming**, evidence-only work uses existing checks or a disposable
probe, not restarting implementation. **Resume.** Revalidate actual candidate/operation and
named reports; preserve completed evidenced work. Ambiguous task identity needs clarification,
not a new invented task. For archive/progress/resume facilities consult
`references/workflow-mechanics.md`; read only the section for a feature actually used.
Copy originals mechanically; do not reconstruct reports or hand-write operation records.

**Optional JEV.** Check `jev_advice({action:"status"})`; only enabled workflow mode permits
selected evaluations. Use only for a useful unresolved engineering judgment after deterministic
gates, with current explicitly enabled workflow consent. Supply stage (`design`,
`implementation` or `verification`), proposed nextAction, precise uncertainty, bounded candidate,
requirements and evidence; reuse current verified file references where available. Do not
ask global readiness before mandatory review or use a model to check missing files/hashes.
No quota, implicit activation or CLI bypass. Disabled/manual/unavailable/error states leave
otherwise permitted work proceeding. Exclude prior predictions, reviewer verdicts, private
transcripts and secrets; keep advice from cold review until its own verdict. Advice cannot
approve, waive gates or establish defects. Storage consent and curation/training
permission remain separate; predictions are not labels. OpenAI Decisions is excluded. With storage consent and a useful prior selection, optional
`link-outcome` can freeze later independently obtained review/test file references for the
same candidate. It makes no provider call and supplies neither a label nor training eligibility;
omit it when it adds no useful learning evidence.

**Finish.** Git-Ops stays inline after integrated approval and all due gates. Run a
source-required fresh final suite; otherwise reuse matching evidence. Honor the known finish
preference, including keep uncommitted work; ask only when unspecified. No automatic commit,
push, tag or cleanup without authority. Return a concise Digest with Ref, optional Plan file,
material Assumptions, Follow-ups, Evidence gaps and actual Execution contexts. Omit empty
ceremonial fields; never omit a limitation, failed bookkeeping or unmet gate.
<!-- shared:end -->

## Bugfix path

1. Invoke native `debug` with its captured `definitionId` (or Debug inline). Several independent
   failures → one `delegate_all` batch of `debug` children, each carrying that ID and isolated workspace. `NOT REPRODUCED`, `BLOCKED`, or `Next: plan`
   (a design flaw) stops here and surfaces. `Next: done` means no implementation remains;
   surface the note, do not manufacture a build. A sandbox proof is not an applied fix.
2. Present the debugging note (root cause, proposed fix, regression test); satisfy the approval boundary above.
3. Build: carry useful diagnostic patches/tests forward, reproduce the regression in the
   authorized candidate, apply the fix once and verify that actual candidate. Debug's trial
   implementation/full suite are optional; diagnosis must be evidenced, with unrun proof explicit.
4. Review confirms the regression test fails without the fix and passes with it. Repair
   loop as above.
5. Git-Ops finish mode and the Digest, which here gains one extra label first:
   `Root cause: <the diagnosed cause>` before `Ref:` — seven lines in total.

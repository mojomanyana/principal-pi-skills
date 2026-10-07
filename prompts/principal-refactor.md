---
description: Refactor spine — the feature spine with a no-behavior-change frame.
argument-hint: "<scope>"
---
Execute this workflow for: refactor $@ without changing behavior.

<!-- shared:start -->
## How this chain runs

You are the orchestrator. Each phase is an enabled skill or a bound delegated contract;
route on its `Next:` and never let a phase invoke another. Before native delegation, call
`delegate_describe({agent:"phase"})`; require `binding.package: principal-pi-skills`, the
exact `binding.phase`, and a captured `definitionId`. Native agent names are `plan`, `build`,
`review`, `debug`, `investigate`. Pass the corresponding ID to each `delegate` call, each
`delegate_all` child and each `delegate_chain` step; the runtime checks selected source and generated
skill/agent bytes. Missing/wrong/disabled bindings, stale reload, unqualified backend,
permission/context refusal, timeout, report gap or uncertain cleanup stops dependent work.
No alternate runner or inline substitution after failure. Only when native tools are genuinely
absent may an explicitly configured legacy `principal-*` runner be used. Inline is an explicit
workflow choice. Follow authored model/effort policy, not phase-based tier overrides.

**Evidence ownership.** Give each gate an owner and due stage, preserving source-required
ordering. Before dispatch, the coordinator verifies authority, binding and permitted runtime
configuration. Initialize private artifacts as below and preserve the unmodified
`delegate_describe` response in a new handoff report, with the actual selected skill/agent
source references and package manifest. Resolve paths from selected Pi resources; the describe
response alone supplies no source path. Verify full source bytes against the described binding;
never guess an installation path or substitute a different same-name definition. When copies
are needed, retain exact bytes, original paths/hashes and capture provenance. Pass accessible
handoff/source files, the assigned step and each gate's owner/due stage to the child.
Missing evidence due before the assigned work stops dispatch; metadata is not new authority.

The leaf verifies its assigned, due-now obligations and reports later coordinator gates as
pending. It cannot obtain its own future terminal/cleanup receipt or dispatch a future reviewer.
After each child returns, the coordinator retains the full native result and checks terminal,
report and cleanup evidence before dependent work. Supply those observations to the next
reviewer. The coordinator also checks the reviewer's own settlement before consuming its verdict;
do not make the reviewer certify its future return. Unknown or failed evidence stays unresolved.
A later due stage cannot postpone a prerequisite required by source authority.

**Scope.** Before starting or resuming, an evidence-only follow-up calls for existing checks or a disposable probe,
not starting/restarting implementation or adding durable tests/infrastructure merely to prove completion.

**Resume.** Locate the actual prior plan, reports and progress index; list `.principal/plans/`
only to find candidates. If several could match, ask which one. A matching title, commit,
message role or self-written approval flag is not approval. Check actual user authority and
current work/evidence before choosing what remains; never re-plan an unchanged approved plan
or repeat an evidenced completed step merely because the conversation stopped. A commit may
establish implementation, never review, integration or verification. Missing, stale or
ambiguous references stay unresolved. This is manual reconciliation, not automatic resume.

**Small direct requests.** Clearly specified, reversible, localized low-risk work may use
Build inline with meaningful checks and a concise result; no mandatory plan/delegate/review
bundle. Honor explicit reviews, plans and inherited gates. Small authorization, security,
public API, schema, failure-semantics or normative changes are consequential. Unknown impact
uses the normal path. An explicitly invoked spine keeps its approval stop; a direct eligible
inline completion may omit `Next:` and ends without authorizing Git operations or installation.
Delegated protocols are unchanged.

**Artifacts.** Before any artifact write, create if absent `.principal/.gitignore` containing `*`;
never overwrite an existing ignore file. This orchestrator step covers authority, optional
Investigate, inline Build, delegated report destinations and review, even without Plan.
Verify repository artifact destinations are ignored; if an existing policy exposes them,
stop and ask rather than dirtying the checkout or changing that policy. Plan itself still
writes only its plan and an absent ignore file; Investigate remains read-only.
Scope files by task, run and candidate: create a new unused directory
`.principal/reports/<task>-<run>/<candidate>/` (timestamp plus collision suffix for run;
SHA or dirty-tree fingerprint for candidate). Independent requests, including repeat reviews
of the same candidate, get new runs. Use this `<artifact-dir>` for authority, Investigate, Build,
diff and review files; number attempts within it, never overwrite prior files. Preserve a
caller-chosen report path if unused; if occupied or a referenced prior artifact, choose an
unused sibling and return its actual path. On resume, read the explicitly identified prior
reports; if ambiguous, ask. Continue in a new candidate/attempt location, not over old bytes.
Record original review path + reviewed candidate and original whole-change baseline (full
base/head range or saved tracked diff plus relevant untracked content/hashes) in existing
Authority/Candidate fields. Keep full original finding definitions, gates and evidence files
accessible through every repair/re-review; REV IDs are scoped to that original report.
Recompute candidate identity after Build; use the new candidate directory for Review while
passing earlier report paths unchanged. The installed coordinator helper `principal-pi-progress`
allocates private ignored runs and writes complete reports exclusively. Progress indexes are
optional, but every index write must use this helper; never hand-write `run.json` or JSONL.
Use the actual selected package's `scripts/progress-artifacts.mjs` with Node if its binary is
not on PATH. Read its installed README example; do not install/fetch a helper or guess its schema.

**Progress.** If tracking progress, use helper `create` for the candidate run, `report` and
`reference` for complete evidence, then `append` for each phase update. Version 1 requires a
candidate string, plan reference or null, step, findings, nextAction and all five facts:
planned/implemented/reviewed/integrated/verified, each an object `{state,evidence,note}`.
States are `unknown`, `incomplete` or `complete`; file references are absolute path/SHA-256
objects returned by the helper. After every append and before claiming valid progress on resume
or completion, run `check <run> <actual-current-candidate>`; require exit zero and inspect both
top-level and per-record issues. Diagnostic `read` alone does not fail its exit status on issues.
An integrity-valid index may contain incomplete facts; reconcile required phases by step and
actual evidence before claiming completion. The helper neither computes candidate identity nor
validates approval or evidence meaning. A completed review fact records its verdict, even
CHANGES-REQUESTED; it is not approval. Preserve full sources/reports, original baseline,
unresolved findings and caveats; the index only points to them. Reconcile all step records,
not just the final line. Evidence hashing proves bytes, not their meaning or broad candidate
equality. A missing index or failed append leaves progress incomplete while the full report
survives. Readers ignore/report an incomplete final line and invalid records; preserve those
bytes and use a new run rather than truncating history. Changed candidate/plan/report refs
invalidate applicable facts. Inspect actual current work and user authority before acting;
no saved fact, role, title or boolean reconstructs approval. No automatic execution.

**Authority.** Carry authoritative source/definition paths and relevant map rows/global gates
through Plan → Build → Review. If exact user authority exists only in dialogue and needs
file handoff, persist it with provenance to `<artifact-dir>/authority.md`, not a
summary. Ensure paths are accessible in each child/disposable workspace; ignored `.principal`
files may need exact caller-persisted copies with original identity. A readable reference is
not missing material; unresolved authority stops for repair, never invented definitions.
Optional read-only Investigate before Plan or substantial Review may locate sources,
definitions, behavior and evidence. The caller may persist its full report; pass original
sources alongside it, never instead of them. Review still owns reconciliation and verdict.

**Approval.** After the planning or diagnosing phase returns, present its artifact and stop. Do not
build until the user says go. Presenting the artifact and starting to build in the same turn
is the failure. The artifact scales — three lines for a config change, full slices for a
feature — the stop does not. A re-plan needs a new approval.

**Build.** One writer per working tree, on branches the user can see. Inline when there is no
multi-step plan file (a three-line plan, or a bugfix) and inline work is the chosen workflow.
Otherwise dispatch native `build` with its captured `definitionId` per step — a batched step is one child —
with the complete plan file path, step ID, coordinator handoff report, source/definition paths, applicable rows/global gates,
and unused report path `<artifact-dir>/<step>-build-<attempt>.md`. Without a plan pass the approved exact
task and authority. It returns five status lines; read every successful report too:
Assumptions, Follow-ups, Evidence gaps, Blocked, Requirements/Gates and Candidate. Aggregate
caveats into the Digest's existing labels; success or a commit is not measured compliance.
Inline Build returns chat: the orchestrator must persist its complete implementation report
to `<artifact-dir>/<step>-build-<attempt>.md` before delegated Review, with the same evidence and caveats as the
agent report, not a summary. If persistence fails, stop and report the handoff gap.
Never paste report prose into a later dispatch; pass accessible files. Authored model/effort
policy governs under the same standards; neither cost nor a word budget permits dropping
requirements, gates or safety. Surface an inadequate policy rather than silently replacing it.

**Parallel work.** For an approved independent batch, use one `delegate_all({children:[...]})`
call, with `agent:"build"` and the captured build `definitionId` on every build child. Do not
launch concurrent single `delegate` calls: each conservatively reserves the available subtree
capacity, so overlapping calls can be refused. Precreate separate registered Git worktrees
at the declared base for writers; record each workspace, write scope, dependencies, shared
resources and unused full-report path before dispatch. Shared interfaces/resources may require
serial work despite different files. Read every outcome and full report, preserve completed
siblings when another fails, review each candidate, then integrate serially and verify the
merged whole. A capacity or other refusal stops dependent work; never retry through another
runner. Independent diagnostic/review batches also use `delegate_all` with each child's exact
phase name and described `definitionId`, under their applicable workspace/tool constraints.

**Review.** Select `task`, `integrated` or `scoped-repair` scope. Consequential interfaces
and parallel candidates receive task review before another step consumes them; retain final
integrated review of the assembled whole change and all global gates. A task verdict permits
only its scoped handoff, not Git-Ops finish. Scoped repair keeps the original full-change
obligations. Optional focused reviewers need a concrete independent concern, not default fan-out.
Use native `delegate({agent:"review",definitionId,...})` when available — a cold read beats
self-review. The ID must be the described review definition; legacy names follow only the absent-native rule above. Hand it files, not prose: write `git diff --stat` and `git diff -U6 <base>..<head>`
for the whole change to `<artifact-dir>/review-diff-<round>.txt` and pass that path plus the build
report paths, coordinator handoff and settled prior-execution evidence, governing source/definition paths, full plan/map if present, and candidate
identity. Dirty candidates need the complete tracked diff and relevant untracked content,
not just a committed range. Review validates reused evidence and checks named doubts.
Persist the complete review result to
`<artifact-dir>/review-<round>.md`. `CHANGES-REQUESTED` → decide which findings are
accepted; repair with their IDs, full report path/definitions, authority refs, affected map
rows and acceptance conditions — resume the builder when possible, otherwise dispatch fresh.
Then scoped re-review gets those files, original whole-change baseline/gates and fix diff,
under the same authored policy; judge each ID and new breakage, without losing original gaps. At most two repair rounds; a third means
the plan or diagnosis was wrong. `UNVERIFIED` is not approval: fix whatever blocked
verification, then review again; it counts as a repair round. Read Verdict before Next:
UNVERIFIED's `Next: build` requests evidence/handoff repair, not automatic code changes. `APPROVE` or `APPROVE-WITH-NITS`
→ git-ops only for the final integrated scope; a task verdict returns to the coordinator.

**Blocked.** A phase returning `BLOCKED` stops the chain: surface its one question and
wait. Do not answer it yourself.

**Finish.** Git-Ops runs inline in finish mode: fresh full suite on the final tree, then
exactly merge locally / push and open a PR / keep the branch. Never auto-push, tag,
force-push, or clean up. End with `Digest:` followed by one line per label, in this order:
`Ref:` (full final commit SHA or branch), `Plan file:` (path or none), `Assumptions:`,
`Follow-ups:`, `Evidence gaps:`, `Execution contexts:` (inline / delegated per phase).
No transcript narration after it.
<!-- shared:end -->

## Refactor path

The request is a refactor of `$@`: structure changes, behavior does not.

1. Invoke native `plan` with its captured `definitionId` (or Plan inline) with this frame: every step preserves observable
   behavior and coverage. Test structure/assertions may evolve to preserve the same contract;
   weakened coverage or concealed behavior changes are findings. Untested touched behavior gets a
   characterization test pinning it first, as its own step. A `[ONE-WAY]` step (public API,
   schema, data) must carry its rollback note.
2. Approval stop. Then Build, step by step, as above.
3. Review, with one extra question: does the diff change any observable behavior? If yes,
   that is a `[BLOCKER]` finding regardless of quality. Repair loop as above. `Next: debug`
   → native `debug` with its captured `definitionId` (or Debug inline); `Next: blocked` → stop.
4. Git-Ops finish mode and the Digest.

---
description: Feature spine — plan, approval, build, review, git-ops.
argument-hint: "<task>"
---
Execute this workflow for: $@

<!-- shared:start -->
## How this chain runs

You are the orchestrator. Each phase is a skill or a `principal-*` agent; you route on the
`Next:` line it returns and never let a phase invoke another. When a step names an agent,
try it once; if the subagent tool is missing or reports an unknown agent, run that phase's
skill inline and say so in the Digest. Any other agent failure stops the chain.

**Resume.** Before the first phase, list `.principal/plans/`. If exactly one file's `## Plan:` line
describes this request's task, read it and `git log` first: a step whose commit exists is
done. If several could match, name them and ask the user which one; if none does, start the chain at step 1. Resume at the first step without one. Never re-plan a plan the user already approved.

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
passing earlier report paths unchanged.

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

**Build.** One writer at a time, on a branch the user can see. Inline when there is no
multi-step plan file (a three-line plan, or a bugfix) or the subagent tool is absent.
Otherwise dispatch one fresh `principal-build` per step — a batched step is one dispatch —
with the complete plan file path, step ID, source/definition paths, applicable rows/global gates,
and unused report path `<artifact-dir>/<step>-build-<attempt>.md`. Without a plan pass the approved exact
task and authority. It returns five status lines; read every successful report too:
Assumptions, Follow-ups, Evidence gaps, Blocked, Requirements/Gates and Candidate. Aggregate
caveats into the Digest's existing labels; success or a commit is not measured compliance.
Inline Build returns chat: the orchestrator must persist its complete implementation report
to `<artifact-dir>/<step>-build-<attempt>.md` before delegated Review, with the same evidence and caveats as the
agent report, not a summary. If persistence fails, stop and report the handoff gap.
Never paste report prose into a later dispatch; pass accessible files. Choose the cheapest
capable model under the same standards; neither lower cost nor a word budget permits dropping
requirements, gates or safety. Escalate an inadequate model rather than weaken the task.

**Review.** Always delegate to `principal-review` when the tool exists — a cold read beats
self-review. Hand it files, not prose: write `git diff --stat` and `git diff -U6 <base>..<head>`
for the whole change to `<artifact-dir>/review-diff-<round>.txt` and pass that path plus the build
report paths, governing source/definition paths, full plan/map if present, and candidate
identity. Dirty candidates need the complete tracked diff and relevant untracked content,
not just a committed range. Review validates reused evidence and checks named doubts.
Use the strongest available model. Persist the complete review result to
`<artifact-dir>/review-<round>.md`. `CHANGES-REQUESTED` → decide which findings are
accepted; repair with their IDs, full report path/definitions, authority refs, affected map
rows and acceptance conditions — resume the builder when possible, otherwise dispatch fresh.
Then scoped re-review gets those files, original whole-change baseline/gates and fix diff,
on a capable mid-tier model; judge each ID and new breakage, without losing original gaps. At most two repair rounds; a third means
the plan or diagnosis was wrong. `UNVERIFIED` is not approval: fix whatever blocked
verification, then review again; it counts as a repair round. Read Verdict before Next:
UNVERIFIED's `Next: build` requests evidence/handoff repair, not automatic code changes. `APPROVE` or `APPROVE-WITH-NITS`
→ git-ops.

**Blocked.** A phase returning `BLOCKED` stops the chain: surface its one question and
wait. Do not answer it yourself.

**Finish.** Git-Ops runs inline in finish mode: fresh full suite on the final tree, then
exactly merge locally / push and open a PR / keep the branch. Never auto-push, tag,
force-push, or clean up. End with `Digest:` followed by one line per label, in this order:
`Ref:` (full final commit SHA or branch), `Plan file:` (path or none), `Assumptions:`,
`Follow-ups:`, `Evidence gaps:`, `Execution contexts:` (inline / delegated per phase).
No transcript narration after it.
<!-- shared:end -->

## Feature path

1. Use only needed outputs: Decide for a choice/rationale ("Postgres or DynamoDB"),
   Architect for structure/components/data ("design X"), Plan for executable sequence.
   Get any resulting decision/design approved; no mandatory preliminary chain.
2. Invoke `principal-plan` (or Plan inline). Any `[ONE-WAY]` step must carry its rollback
   note; the approval stop covers it.
3. Approval stop. Then Build, step by step, as above.
4. Review. Repair loop as above. `Next: debug` → `principal-debug` (or Debug inline);
   `Next: blocked` → stop.
5. Git-Ops finish mode and the Digest.

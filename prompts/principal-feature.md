---
description: Feature spine — plan, approval, build, review, git-ops.
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

**Approval.** After the planning or diagnosing phase returns, present its artifact and stop. Do not
build until the user says go. Presenting the artifact and starting to build in the same turn
is the failure. The artifact scales — three lines for a config change, full slices for a
feature — the stop does not. A re-plan needs a new approval.

**Build.** One writer at a time, on a branch the user can see. Inline when there is no multi-step plan file (a three-line plan, or a bugfix) or the subagent tool is absent. Otherwise dispatch one fresh `principal-build`
per step with the plan file path and the step number; record its report's Changed paths,
Tests, and Follow-ups; then the next step.
Choose the cheapest model that can transcribe a complete step spec; the build report carries
the evidence.

**Review.** Always delegate to `principal-review` when the tool exists — a cold read beats
self-review. `CHANGES-REQUESTED` → decide which findings are accepted, then Build in repair
mode with exactly those IDs, then review again; at most two repair rounds, a third means
the plan or diagnosis was wrong. `UNVERIFIED` is not approval: fix whatever blocked verification, then review again; it counts as a repair round. `APPROVE` or
`APPROVE-WITH-NITS` → git-ops.

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

1. If the request is an architectural choice ("Postgres or DynamoDB", "design X"), run
   Architect inline first and get the design approved before planning.
2. Invoke `principal-plan` (or Plan inline). Any `[ONE-WAY]` step must carry its rollback
   note; the approval stop covers it.
3. Approval stop. Then Build, step by step, as above.
4. Review. Repair loop as above. `Next: debug` → `principal-debug` (or Debug inline);
   `Next: blocked` → stop.
5. Git-Ops finish mode and the Digest.

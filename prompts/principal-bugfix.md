---
description: Bugfix spine — debug, approval, build, review, git-ops.
---
Execute this workflow for: $@

<!-- shared:start -->
## How this chain runs

You are the orchestrator. Each phase is a skill or a `principal-*` agent; you route on the
`Next:` line it returns and never let a phase invoke another. When a step names an agent,
try it once; if the subagent tool is missing or reports an unknown agent, run that phase's
skill inline and say so in the Digest. Any other agent failure stops the chain.

**Resume.** Before planning, list `.principal/plans/`. If exactly one file's `## Plan:` line
describes this request's task, read it and `git log` first: a step whose commit exists is
done. If several could match, name them and ask the user which one; if none does, plan
afresh. Resume at the first step without one. Never re-plan a plan the user already approved.

**Approval.** After the planning phase returns, present its artifact and stop. Do not
build until the user says go. Presenting the plan and starting to build in the same turn
is the failure. The artifact scales — three lines for a config change, full slices for a
feature — the stop does not. A re-plan needs a new approval.

**Build.** One writer at a time, on a branch the user can see. Inline when the plan is the
three-line form or the subagent tool is absent. Otherwise dispatch one fresh `principal-build`
per step with the plan file path and the step number; record its report's Changed paths,
Tests, and Follow-ups; then the next step.
Choose the cheapest model that can transcribe a complete step spec; the build report carries
the evidence.

**Review.** Always delegate to `principal-review` when the tool exists — a cold read beats
self-review. `CHANGES-REQUESTED` → decide which findings are accepted, then Build in repair
mode with exactly those IDs, then review again; at most two repair rounds, a third means
the plan or diagnosis was wrong. `UNVERIFIED` is not approval. `APPROVE` or
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

## Bugfix path

1. Invoke `principal-debug` (or Debug inline). Several independent failures → one debug
   agent each, dispatched in the same turn. `NOT REPRODUCED`, `BLOCKED`, or `Next: plan`
   (a design flaw) stops here and surfaces.
2. Approval stop: present the debugging note (root cause, proposed fix, regression test).
3. Build: recreate the regression test in the user's checkout, watch it fail, implement
   the fix once, watch it pass, run the suite.
4. Review confirms the regression test fails without the fix and passes with it. Repair
   loop as above.
5. Git-Ops finish mode and the Digest, which here gains one extra label first:
   `Root cause: <the diagnosed cause>` before `Ref:` — seven lines in total.

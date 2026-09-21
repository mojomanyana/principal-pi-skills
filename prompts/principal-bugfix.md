---
description: Bugfix spine — debug, approval, build, review, git-ops.
argument-hint: "<symptom>"
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

**Build.** One writer at a time, on a branch the user can see. Inline when there is no
multi-step plan file (a three-line plan, or a bugfix) or the subagent tool is absent.
Otherwise dispatch one fresh `principal-build` per step — a batched step is one dispatch —
with the plan file path, the step number, and a report path
`.principal/reports/<step>-build.md`. It returns five status lines; read the report file only
when routing needs more, and never paste a report into a later dispatch. Choose the cheapest
model that can transcribe a complete step spec.

**Review.** Always delegate to `principal-review` when the tool exists — a cold read beats
self-review. Hand it files, not prose: write `git diff --stat` and `git diff -U6 <base>..<head>`
for the whole change to `.principal/reports/review-diff.txt` and pass that path plus the build
report paths; review judges from them and runs a test only for a named doubt. Use the
strongest available model for this review. `CHANGES-REQUESTED` → decide which findings are
accepted; then repair with exactly those IDs — resume the build agent that made the change
when your tool can, otherwise a fresh dispatch — then a scoped re-review: the open IDs and the
fix diff only, on a mid-tier model, verdicting each ID. At most two repair rounds; a third means
the plan or diagnosis was wrong. `UNVERIFIED` is not approval: fix whatever blocked
verification, then review again; it counts as a repair round. `APPROVE` or `APPROVE-WITH-NITS`
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

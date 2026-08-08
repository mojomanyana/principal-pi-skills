---
description: Feature spine - plan, build, cold review, commit. Delegates to principal-* agents when available, runs inline when not.
---
Execute this workflow for: $@

**Delegation rule, applied at every step below that names an agent.** Try the subagent tool
with the named `principal-*` agent. If the subagent tool is unavailable, or it reports that
agent as unknown, run the corresponding skill inline in this session instead and say so once
in the digest — that is a supported configuration, not a degradation to work around. Try
once: a second attempt after "unknown agent" returns the same answer and wastes a turn. Any
*other* agent failure — a crash, a timeout, an empty response — stops the workflow and is
surfaced to the user; only absence falls back.

Inline review is self-review and is weaker than a cold read: it sees this session's
reasoning, so it cannot be surprised by it. When review runs inline, say so in the digest.

1. **Plan** — `principal-plan` agent, or the `plan` skill inline.
   If it returns BLOCKED, stop and surface its one question. Do not guess past it.
2. **One-way check** — if the plan marks any step `[ONE-WAY]`, stop and show the user that
   step and its rollback note before building it. A one-way door gets walked through
   deliberately, never as step N of an unattended chain.
3. **Build** — load the `build` skill inline, starting at step 1. Build always runs in this
   session: it is the only phase that writes durably to the checkout.
   Implement the steps in order. Do not fan parallel writers into the same working tree,
   whatever the plan says about parallel-safety — that marking means the steps are
   independent of each other, not that two writers may share a checkout.
4. **Review** — `principal-review` agent, or the `review` skill inline. Pass the
   implementation report. Review runs the tests before any verdict; a verdict without a test
   run is UNVERIFIED, and UNVERIFIED is not an approval. Review's destructive checks belong
   in a disposable workspace (`scripts/snapshot-workspace.mjs`), never in this checkout —
   when it reports `Workspace: none`, expect UNVERIFIED and treat that as a gap to close,
   not a verdict to accept.
5. **Repair loop** — if the verdict is REQUEST-CHANGES, return to Build with the findings,
   then review again. **Two repair rounds at most.** If findings remain after the second,
   stop and hand the user what is still outstanding rather than looping. A third round means
   the plan was wrong, not the code.
   If Build instead returns `Next: debug` — it hit a failure whose cause it could not
   identify — run the `principal-debug` agent (or the `debug` skill inline) on that failure,
   then resume at Build with the diagnosis. Guessing at an unexplained failure inside a
   repair round is how a feature ships with a bug nobody diagnosed. If Build returns
   `Next: blocked`, stop and surface what it named under `Blocked:`.
6. **Commit** — on APPROVE or APPROVE-WITH-NITS, load the `git-ops` skill inline. Never
   delegate git operations: they need this session's working-tree state, and destructive
   operations require a consequence-acceptance no subagent can obtain.
7. **Digest** — six lines or fewer: what shipped (commit ref), every Assumption made across
   plan and build, every Follow-up found, anything UNVERIFIED or marked UNTESTED, and which
   phases ran inline rather than delegated. No transcript summary, no process narration —
   just what a steering engineer must see. If every field is empty, say exactly that in one
   line.

---
description: Cold review of the current branch against a base, then finish mode.
argument-hint: "[base]"
---
Review this branch against `${1:-main}` and finish it.

You are the orchestrator; this chain has no planning phase and no plan file. Work that was
built outside the workflows gets the same cold review the workflows give.

1. Find the range: `git merge-base ${1:-main} HEAD` is the base; `HEAD` is the head. If
   the working tree is dirty, say so and stop — review judges committed work.
2. Delegate to `principal-review` when the subagent tool exists (otherwise run Review
   inline and say so in the Digest). Hand it the base and head SHAs and the commit list;
   it computes the diff itself in a disposable workspace.
3. Route on the verdict. `APPROVE` or `APPROVE-WITH-NITS` → Git-Ops finish mode: fresh
   full suite on this tree, then exactly merge locally / push and open a PR / keep the
   branch. `CHANGES-REQUESTED` → present the findings with their `[REV-…]` IDs and stop;
   there is no plan to repair against, so the user decides which to accept, and a repair
   is a new request. `UNVERIFIED` → say what blocked verification and stop.
4. End with `Digest:` followed by one line per label: `Ref:` (base..head), `Verdict:`,
   `Findings:` (count by severity, or none), `Follow-ups:`, `Execution contexts:`
   (inline / delegated). No transcript narration after it.

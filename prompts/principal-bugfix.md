---
description: Bug spine - diagnose, fix, verify the regression test, commit. Delegates to principal-* agents when available, runs inline when not.
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

1. **Debug** — `principal-debug` agent, or the `debug` skill inline. It returns a note with
   root cause and a *proposed* regression test and fix, keeping the noisy reproduction loop
   out of this context and its experiments out of your checkout. Stop and surface the note if
   it says NOT REPRODUCED, if it returns BLOCKED, or if it ends with a question. A diagnosis
   you cannot reproduce is not a diagnosis. If it reports `Workspace: none`, the fix is
   unproven — say so downstream rather than building on it as though it were verified.
2. **Design-flaw check** — if the note says `Next: plan`, the fix is a design change rather
   than a repair. Stop and tell the user; do not build it inside a bugfix run.
3. **Build** — load the `build` skill inline. Recreate the regression test first, watch it
   fail, then implement the fix once. Build always runs in this session: it is the only
   phase that writes durably to the checkout. Debug proved its candidate fix in a throwaway
   workspace and threw it away, so the fix does not yet exist here — implement it rather
   than assuming it landed. A fix whose test was never seen red is unproven, no matter how
   confident the diagnosis was.
4. **Review** — `principal-review` agent, or the `review` skill inline. It verifies the
   regression test fails before the fix and passes after — a destructive check, so it
   belongs in a disposable workspace (`npx -p principal-pi-skills principal-pi-workspace`), never in this
   checkout. A verdict without that check is UNVERIFIED, and UNVERIFIED is not an approval;
   when review reports `Workspace: none`, treat it as a gap to close rather than a verdict
   to accept.
5. **Repair loop** — if the verdict is CHANGES-REQUESTED, return to Build with the findings,
   then review again. **Two repair rounds at most.** If findings remain after the second,
   stop and hand the user what is still outstanding rather than looping. A third round means
   the diagnosis was wrong, not the code.
6. **Commit** — on a clean verdict, load the `git-ops` skill inline. Never delegate git
   operations: they need this session's working-tree state, and destructive operations
   require a consequence-acceptance no subagent can obtain.
7. **Digest** — six lines or fewer: the root cause (one line from the note), what shipped
   (commit ref), every Assumption made, every Follow-up found, anything UNVERIFIED or marked
   UNTESTED, and which phases ran inline rather than delegated. No transcript summary — just
   what a steering engineer must see. If every field is empty, say exactly that in one line.

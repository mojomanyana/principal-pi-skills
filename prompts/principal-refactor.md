---
description: Refactor workflow — preserve external behavior while simplifying structure, verified by tests and review.
argument-hint: "<scope>"
---
Execute this workflow for: refactor $@ without changing behavior.

<!-- shared:start -->
## Coordinate the outcome

Own the product result across the requested scope. Prefer the simplest adequate design without
weakening constraints. Resolve consequential tradeoffs and shared contracts before editing; across
repositories, verify the consumers' combined behavior. Stop when the requested outcome is met and
verified.

1. **Plan concisely before editing.**
   - Use `architect` inline when a consequential structural boundary, interface, or migration needs to
     be settled first.
   - For clear authorized changes, go directly to implementation (`build`) — write a concise 3–5
     bullet micro-plan naming exact files and the verification command, then edit immediately.
   - Use native `codemode` when inspecting 3+ files so reads run in parallel in a single turn.
2. **Use context, memory, and public research proportionally.**
   - Reuse injected `<project_memory>` (Bookie) when present; save durable decisions/lessons cleanly.
   - When a specific external API/version fact could change the design and `scout_research` is
     available, ask a focused question without sending private project code.
3. **Implement and verify.**
   - Run the concrete verification command (`npm test`, typecheck, linter, or focused repro) after
     your final edit and report exact observed pass/fail output.
   - If the same failing check repeats, stop repeating the same edit — switch to root-cause diagnosis
     (`debug`) or inspect the full error trace.
4. **Independent review when warranted.**
   - For consequential changes, release gates, or explicit review requests, run independent cold
     review via `delegate({ agent: "review", ... })` (or `quick_review` / `pi-daddy` Cold Diff
     Review) against the actual git diff and test output — never pass a summary in place of code.
   - Treat `APPROVE` / `APPROVE-WITH-NITS` as ready to finish; address concrete `[BLOCKER]` findings
     and re-verify before settling.
5. **Finish cleanly (`git-ops`).**
   - Summarize what changed, what was verified (exact commands and results), and any remaining gaps
     or follow-ups. Never force-push, tag, or delete branches without explicit authorization.
<!-- shared:end -->

## Refactor focus

1. Confirm existing tests pass before editing (or add characterization tests for uncovered paths).
2. Keep behavior strictly identical; separate structural cleanup from feature changes.
3. Re-run the full verification suite and review the diff for unintended semantic changes.

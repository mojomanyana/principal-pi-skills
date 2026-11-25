---
description: Cold review of the current branch against a base, then finish mode.
argument-hint: "[base]"
---
Review this branch against `${1:-main}` and report a clear verdict.

1. Check `git status --short`, `git merge-base ${1:-main} HEAD`, and `git log --oneline ${1:-main}..HEAD`.
   If the working tree has uncommitted changes, note clearly whether you are reviewing committed
   changes only or the full working tree.
2. Inspect the full diff (`git diff ${1:-main}...HEAD`) and read surrounding context in modified
   files (batch reads with `codemode` when 3+ files changed).
3. Run the repository's verification commands (tests, typecheck, lint) or inspect fresh observed
   results; do not invent unverified pass claims.
4. For independent cold review, delegate via `delegate({ agent: "review", ... })` (or `quick_review`)
   with the exact diff/files and verification output — never pass a parent summary instead of code.
5. Report:
   - **Ref:** `base..head`
   - **Verdict:** `APPROVE`, `APPROVE-WITH-NITS`, or `CHANGES-REQUESTED`
   - **Findings:** concrete bugs, regressions, security/correctness issues with exact `file:line`
   - **Verification:** exact commands run and observed results
   - **Follow-ups / Gaps:** optional non-blocking improvements or unverified areas
6. Do not push, tag, force-push, or delete branches without explicit authorization.

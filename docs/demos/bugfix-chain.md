# Demo: the `/bugfix` chain, live

> **Recorded before 2.3.0's workspace-ownership and namespacing changes.** It is kept as
> the record of that run, not rewritten to match current contracts. Two things would differ
> today: the command is `/principal-bugfix` (`/bugfix` is now a deprecated alias), and any
> destructive verification — reverting a fix to watch its regression test go red — happens in
> a disposable worktree rather than the caller's checkout. The observed behavior and verdicts
> below are unchanged.


Same environment. A `mul(a, a)` bug planted under an innocent "refactor mul" commit.
Chain: **debug** (isolated diagnosis) → **build** (inline fix) → **review** (fresh
context) → **git-ops** (inline).

Highlights, all repo-verified: debug named `calc.ts:6` and the offending commit,
wrote the regression test and proved it fails on broken code, and explicitly
evaluated the design-flaw stop rule; review independently REVERTED the fix to
confirm fails-before/passes-after; git-ops caught its own backtick-mangled commit
message on the post-commit check and amended safely (local-only, no remote).
Final: `e88f599 Fix mul to use both operands`, 4/4 green.

---

Workflow complete. All four steps executed cleanly.

## Summary

| Step | Agent | Outcome |
|------|-------|---------|
| 1. Diagnose | `debug` | Root cause: `calc.ts:6` returns `a * a` instead of `a * b` (commit `8574c88`). Added a regression test, verified it fails against broken code. Note: **"FIX: straightforward (ready to implement)"** — not a design flaw, so proceeded. |
| 2. Fix | `build` skill | Restored `return a * b;`. Smallest change; suite went 1 failed → 4 passed. |
| 3. Review | `review` | **VERDICT: CLEAN.** Independently reverted the fix, confirmed the regression test fails before / passes after, and checked the test actually catches the `a*a` defect (not a coincidental pass). |
| 4. Commit | `git-ops` skill | Atomic commit on `main` (local solo repo, no remote, matches existing workflow). Staged only `calc.ts` + `calc.test.ts`; excluded untracked `node_modules/` and `package-lock.json`. Secret/tripwire scan clean. |

**Commit:** `e88f599` — *Fix mul to use both operands*

Final state: working tree clean (only untracked `node_modules/` + `package-lock.json` remain, untouched), `npx vitest run` → **4 passed (4)**.

One self-inflicted hiccup worth noting: my first commit used backticks in the `-m` body, which the shell command-substituted and stripped the `` `a * b` `` / `` `a * a` `` spans. I caught it on the post-commit message check and `--amend`ed with `-F` from a file (safe — HEAD was local-only, no remote). No content change, message-only amend.

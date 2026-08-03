# Demo: the `/feature` chain, live

First end-to-end run of the framework in its natural habitat — pi 0.80.2, GLM 5.2,
pi-mono's subagent extension, agents linked from `agents/`. Task: add a `percent`
helper to a small vitest calculator repo. Chain: **plan** (isolated, read-only) →
**build** (inline, TDD) → **review** (fresh context, runs the tests) → **git-ops**
(inline, never delegated).

Verified against the repo afterwards, not just the model's account: commit
`6bdd2df Add percent helper to calc` (+10/−1, atomic — `node_modules/` left
untracked), 3 tests green. The review nit is real: `percent(100, 1.005)` → `1`,
not `1.01` (IEEE-754 half-up).

---

Workflow complete. Summary:

## Workflow Result

**1. Plan** (`plan` agent) — not blocked. Produced a 2-step plan: add `percent` + tests (single vertical change, not parallel-safe), then run `npm test`.

**2. Build** (`build` skill, inline) — test-first:
- Baseline: 2 passed.
- Wrote failing `percents` test → failed for the right reason (`percent is not a function`).
- Implemented `percent(value, pct) = Math.round((value*pct/100)*100)/100`.
- Result: **3 passed, 0 failed**.

**3. Review** (`review` agent, ran tests first) — verdict: **APPROVE-WITH-NITS**.
- Nit: untested `.005` IEEE-754 boundary (e.g. `percent(100, 1.005)` → `1`, not `1.01`); add a pinning test or use `Number.EPSILON`/`toFixed` if exact half-up is required.
- Nit: no negative-pct/zero-value case (both pass correctly).

**4. Git-ops** (`git-ops` skill, inline — not delegated):
- Pre-flight: on `main`, no remote (scratchpad/dogfood → solo/throwaway context → commit to main).
- Staged only `calc.ts` + `calc.test.ts` (atomic); left `node_modules/` and `package-lock.json` untracked (from my `npm install`, not part of the task).
- Scanned staged diff: no secrets, no conflict markers, no oversized files.
- Committed: `6bdd2df Add percent helper to calc` (2 files, +10/-1).

**Follow-ups (left untouched, out of scope):** pin the `.005` rounding contract with a boundary test; add a negative-pct case; decide whether to commit `package-lock.json` / gitignore `node_modules/`.

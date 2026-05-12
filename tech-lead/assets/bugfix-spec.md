# Bug-Fix Spec — `<bug summary>`

<!--
  Bug-fix variant of the coding spec. Same sections as coding-spec.md, but
  the order and emphasis differ: reproduce → diagnose → fix → blast-radius.
  The regression test is mandatory and must fail before the fix is applied.
-->

**Status:** draft | reviewed | locked
**Spec author:** tech-lead (date: <YYYY-MM-DD>)
**Upstream:** <bug report, incident ticket, or direct user task>
**Downstream:** coder
**Severity:** <P0 hot-fix | P1 next release | P2 backlog>

---

## 1. Bug summary

<one to three sentences: what's wrong from the user's perspective>

**Observed:** <what happens now>
**Expected:** <what should happen>
**First reported:** <when / where / by whom>

---

## 2. Reproduction

<!--
  Reproduce in your head from the codebase BEFORE specifying the fix.
  If you can't reproduce from reading the code, ask for more repro info.
  Don't guess.
-->

**Repro steps (from the report):**

1. <step>
2. <step>
3. Observe: <symptom>

**Trace through the code (your reading):**

- Entry point: `<file:line>` — <what happens>
- Branch / decision: `<file:line>` — <what happens>
- Bug surface: `<file:line>` — <what should happen vs. what does>

**Confirmed reproducible in code reading:** yes | no | partially

If "no" or "partially": <what additional info is needed before specifying>.

---

## 3. Root cause

<!--
  Root cause, not symptom. "Off-by-one in parseRange" not "list returns wrong values".
  If you're not sure root vs. symptom, say so — symptomatic fixes are sometimes correct,
  but only when known to be symptomatic.
-->

**Root cause:** <specific, file:line>

**Why the bug existed:** <e.g., the test didn't cover this edge; the spec said
ascending but the loop did descending; the dep changed behavior in vN+1>

**Why it surfaced now:** <e.g., new data shape; concurrent calls; new caller>

---

## 4. Exploration notes

<!-- Same six-part capsule as the standard spec. See codebase-exploration.md. -->

**Surface:** <project structure, language version, build system>

**Affected files:**

- <path/to/file.ts> — <where the bug lives>
- <path/to/test-file.ts> — <where the regression test goes>

**Conventions discovered:**

| Domain | Convention |
|---|---|
| Errors | <pattern> |
| Tests | <framework, layout> |
| Types | <strictness> |

**Tests baseline:**

- Existing tests in `<scope>`: <count>, <green | partial | red>.
- **The regression test does NOT yet exist; this spec adds it.**

**Risks observed:**

- <adjacent code that might have the same bug>
- <call sites that might have the same misuse>

---

## 5. Test plan — failing test FIRST

<!--
  This is the heart of a bug-fix spec. The regression test must be written
  BEFORE the fix and must FAIL on main. Anti-patterns: writing the test and
  the fix in the same commit (no proof the test catches the bug); writing
  the test after the fix (same problem).
-->

### 5.1 Regression test

**Test name:** `<descriptive_test_name>`

**Level:** unit | integration | e2e

**File:** `<path/to/test-file.ts>`

**Assertion:**

```<lang>
// The full test or a precise enough description that the coder writes
// the same test.
test('<descriptive_test_name>', async () => {
  // ARRANGE: <setup that reproduces the bug condition>
  // ACT: <call the buggy code path>
  // ASSERT: <the behavior that's currently wrong>
});
```

**Required sequence:**

1. Coder adds this test on a branch off `main`.
2. Coder runs `<test command>` — the test MUST fail with the bug's symptom.
3. Only then does the coder apply the fix from §6.
4. The test passes after the fix.

If step 2 doesn't fail, **the test doesn't catch the bug**. Coder pauses and returns to tech-lead — either the test is wrong, the reproduction is wrong, or the bug is not where we thought.

### 5.2 Additional tests

Tests for edge cases adjacent to the bug, to prevent regressions of the same class:

| Test name | Level | File | Assertion |
|---|---|---|---|
| `<test_name>` | unit | `<path>` | <related edge case the fix should also handle> |
| ... | ... | ... | ... |

---

## 6. Fix design

<!--
  Smallest change that makes the test pass, matching codebase conventions.
  Resist scope creep — a bug fix is not a refactor.
-->

### `<path/to/file.ts>` (modify)

**Purpose of change:** <one sentence>

**Specific change:**

```<lang>
// Before:
function parseRange(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i++) out.push(i);  // BUG: should be <=
  return out;
}

// After:
function parseRange(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}
```

**Why this change and not a wider one:** <why the minimal change is correct;
why we're not also refactoring nearby code>

---

## 7. Blast radius

<!--
  A bug in one place is often a bug in similar places. Search for the same
  pattern elsewhere. Surface findings — even if not fixed in this spec.
-->

**Same pattern elsewhere (searched via `<command>`):**

- `<file:line>` — <similar code; affected by the same bug? Y/N>
- `<file:line>` — <similar code; affected? Y/N>

**If others are affected:**

- [ ] Fix all in this slice (recommended if N ≤ 3 and the cause is identical).
- [ ] Fix only the reported instance in this slice; flag others for follow-up (recommended if N > 3 or each instance has nuance).

**Decision:** <which option, with rationale>

**Follow-up slices needed:** <list, or "none">

---

## 8. Dependencies & ripples

(Same shape as standard spec §6. Usually minimal for a bug fix — but never assume.)

**Dependencies:** <typically "no change" for a bug fix>

**Affected callers:** <do callers need to update? Usually no for a behavior fix; yes if a return shape changed>

**Side effects:** <usually none new; sometimes new logs to aid future debugging>

**Migration plan:** <usually n/a; required if the fix changes persisted data>

---

## 9. Reversibility

| Decision | Tag | Rationale | Kill criterion (🔴 only) |
|---|---|---|---|
| Fix `parseRange` boundary | 🟢 | Pure behavior fix; revertible by re-introducing the off-by-one | — |
| <other decision> | ... | ... | ... |

<!--
  Most bug fixes are 🟢. Exceptions: fixes that change wire formats, persisted
  hashes, or downstream-observable behaviors. If the fix is 🔴, the kill
  criterion is mandatory.
-->

---

## 10. Smell-check

<!--
  Bug-fix specific smell-check:
  - Are we fixing the symptom or the cause?
  - Could the bug indicate a deeper design issue?
  - Is the fix the smallest correct change, or did we accidentally scope a refactor?
-->

<paragraph>

---

## 11. Flagged assumptions

- ASSUMES: the bug is reproducible by the test in §5.1 (must be verified BEFORE the fix is applied).
- ASSUMES: <other>
- ASSUMES: <other>

---

## 12. Handoff baton → coder

**Spec:** <path to this document>

**Outcome (one-liner):** <e.g., "`parseRange(1, 5)` returns `[1,2,3,4,5]`, not `[1,2,3,4]`">

**First concrete action:**

1. Branch off `main`.
2. Add the regression test from §5.1 to `<test file>`.
3. Run `<test command>` — confirm the test FAILS with the bug's symptom.
4. **Only then** apply the fix from §6.

**Reconfirm before coding:**

- [ ] Repro steps from §2 still produce the bug on current `main`.
- [ ] The test in §5.1 fails on `main` (before the fix).
- [ ] The blast-radius decision in §7 still applies (no new same-pattern instances introduced since exploration).

**Acceptance signal:**

1. The regression test fails on `main`.
2. The regression test passes on the fix branch.
3. All existing tests still pass.
4. Typecheck and lint clean.
5. Manual repro from §2 no longer reproduces the bug.

**Stop conditions:**

- The regression test passes on `main` (the bug doesn't repro the way we thought).
- The fix from §6 doesn't make the test pass (the root cause is elsewhere).
- The same pattern is found in more places than §7 listed.
- Any 🔴 decision in §9 needs revisiting.

**Commit hygiene:**

- Two commits, in order:
  1. `test(<scope>): regression for <bug>` — the failing test only.
  2. `fix(<scope>): <root cause>` — the minimal fix.
- This sequence is the proof: commit 1 fails CI; commit 2 makes it pass.
- After fix lands, write a progress note to `progress.md`.
- Pass to `project-git` for PR.

---

## Revision history

| Date | Version | Change | Author |
|---|---|---|---|
| <YYYY-MM-DD> | v1 | Initial draft | tech-lead |

# Anti-Patterns

A catalog of failure modes a coder skill is most likely to slip into. Cross-reference whenever the implementation "feels right" — the felt-right implementation is where most anti-patterns hide.

Each entry has: the smell, the example, why it fails, the cure.

---

## 1. Declaring done without running tests

**Smell:** "Implemented the spec. Tests should pass."

**Example:**

> *"I've added `exportCsv` and the route. The new tests should all pass; let me hand off to project-git."*

**Why it fails:** "Should" isn't "did." Empirical research on AI-written code shows agents declare done prematurely; a measurable fraction of "done" claims fail the test suite. Run the tests.

**Cure:** The acceptance signal in the spec is a list of commands. Run them. Show output. If they pass, the hand-off is fine. If they fail, the slice isn't done.

---

## 2. Writing test and code in one prompt, running once

**Smell:** Tests and implementation arrive together; a single test run shows green; "done."

**Example:**

> Generates `parse-range.test.ts` with 5 tests and `parse-range.ts` with the implementation in one commit. Runs once. Green. Moves on.

**Why it fails:** No red phase, no proof the tests catch the absence of the behavior. The tests might assert the wrong thing and still pass.

**Cure:** Two commits, one for the failing test, one for the passing implementation. See [`tdd-loop.md`](tdd-loop.md). At minimum, run the test before the implementation; observe it fail; then write the implementation. The discipline is the **color change**, not the existence of the test.

---

## 3. Silent error suppression

**Smell:** A `try/catch` (or equivalent) that swallows the error and continues.

**Example:**

```ts
try {
  return await fetchUser(id);
} catch {
  return null;  // "user not found"
}
```

**Why it fails:** The caller gets `null` for any error — not just "user not found" but also "network down", "DB locked", "permission denied". The caller can't tell. Bugs hide.

**Cure:** Either catch a specific error (`if (e instanceof NotFoundError) return null`) or propagate. See [`error-handling.md`](error-handling.md).

---

## 4. Over-mocking

**Smell:** The test mocks so much that the test isn't testing the unit anymore — it's testing the mock setup.

**Example:**

```ts
vi.mock("./parse-range", () => ({
  parseRange: vi.fn().mockReturnValue([1, 2, 3]),
}));
test("parseRange returns array", () => {
  expect(parseRange(1, 3)).toEqual([1, 2, 3]);  // passes because of the mock
});
```

**Why it fails:** The test passes regardless of `parseRange`'s actual behavior. If you broke the real function, this test wouldn't catch it.

**Cure:** Don't mock the unit under test. Mock external dependencies (network, time, randomness). The 2025-2026 empirical research identifies over-mocking as the dominant AI test-writing failure mode. See [`tdd-loop.md`](tdd-loop.md) §8 and [`error-handling.md`](error-handling.md).

---

## 5. Catching to make a test pass

**Smell:** A test was failing with an error; instead of fixing the cause, the coder wrapped the error in a try/catch.

**Example:**

```ts
async function processOrder(order) {
  try {
    return await placeOrder(order);
  } catch (e) {
    return { success: false };  // "now the test passes"
  }
}
```

**Why it fails:** The test asserts "no exception is thrown". The exception isn't thrown, so the test passes. The order is silently dropped.

**Cure:** Tests catch bugs by failing. Catching the bug to make the test pass is exactly backwards. Find the cause; fix it. See [`error-handling.md`](error-handling.md) §4.

---

## 6. Plowing through stop conditions

**Smell:** The spec said "stop if X"; X happened; the coder kept going.

**Example:**

> Spec stop condition: "If `STREAM_FAILED` addition breaks any exhaustive switch."
> Coder: discovers a broken switch at `error-display.tsx:42`. Adds a case with a placeholder message. Continues.

**Why it fails:** The placeholder message is a decision implementation-planner and the user didn't make. It might be wrong (wrong copy, wrong i18n, wrong UX). The slice ships with a silent contract change.

**Cure:** Stop. Reverse-handoff to implementation-planner with the specific question. See [`scope-discipline.md`](scope-discipline.md). The slice can pause for 30 seconds.

---

## 7. Pretending to read

**Smell:** Coder claims to have read the file but didn't (or skimmed and missed the relevant part).

**Example:**

> *"I've read `src/api/export-pdf.ts`; the pattern is clear."* (Actually only read the first 20 lines; missed that the rest of the file does error-mapping the new code also needs to handle.)

**Why it fails:** The implementation is built on incomplete understanding. The missed parts surface as test failures, lint errors, or runtime bugs.

**Cure:** Read enough lines. For files <300 lines, read the whole thing. For larger files, read the function + 50 lines of context, plus any imports / types it depends on. See [`read-before-write.md`](read-before-write.md).

---

## 8. Re-implementing what exists

**Smell:** Coder writes a helper for X without checking whether the codebase has a helper for X.

**Example:**

> Codebase has `@/lib/format-csv` (basic CSV formatting). Coder writes a new `csvify` helper inline in the route file because they didn't search.

**Why it fails:** Duplicate utilities, divergent behaviors, technical debt.

**Cure:** Before writing a helper, search the codebase. `rg`, `fd`, `ast-grep`. The spec's exploration should have caught this; if it didn't, the coder catches it at write-time. See [`read-before-write.md`](read-before-write.md).

---

## 9. Mega-commits

**Smell:** One commit with 300 lines across 8 files.

**Example:**

```
$ git log --oneline
abc1234 Implement the CSV export feature
```

**Why it fails:** Reviewers can't review; bisect can't narrow; rollback is all-or-nothing. The slice loses git's leverage entirely.

**Cure:** Commit every few minutes; one logical step per commit. See [`coding-loops.md`](coding-loops.md) §2.

---

## 10. Commits before green

**Smell:** Commits land while the test suite is red, with the intent to "fix in the next commit."

**Example:**

```
$ git log --oneline
abc1234 fix the test
def5678 add the function (tests fail)
ghi9012 add the test file
```

**Why it fails:** History is polluted; bisect lands on broken commits; revert produces a broken state.

**Cure:** Commit on green only. The exception is intentional red-then-green per TDD discipline; even then, the red commit is clearly labeled `test(scope): failing test for <feature>` and the next commit is `feat(scope): implementation`. See [`tdd-loop.md`](tdd-loop.md).

---

## 11. Horizontal phasing

**Smell:** Build the whole DB layer, then the whole service layer, then the whole API layer, then connect them.

**Example:**

> Spec covers a feature spanning DB + service + API + UI. Coder builds all 12 DB fields, all 8 service methods, all 4 endpoints, then the UI. End-to-end is first tested at hour 6. Discovers a wire format mismatch.

**Why it fails:** End-to-end signal is delayed to the most expensive moment. Wire mismatches, auth issues, perf gotchas all surface late.

**Cure:** Walking skeleton. One field, one method, one endpoint, one round-trip — proved green. Then expand. See [`coding-loops.md`](coding-loops.md) §4.

---

## 12. "While I'm here" scope creep

**Smell:** Each "small" related fix gets pulled in. The slice grows.

**Example:**

> Slice: "Add CSV export." Coder also: fixes a typo two files over, renames a variable in a sibling function, refactors a helper that was "ugly." Diff is 4× what it should be.

**Why it fails:** Review surface explodes; bisect noise; coupling. See [`scope-discipline.md`](scope-discipline.md) §6.

**Cure:** Note for follow-up. Don't fix in this slice.

---

## 13. Sycophantic "looks good"

**Smell:** When asked "is the spec right?" or "is the test correct?", coder agrees regardless of the actual answer.

**Example:**

> User: "Does the test in §5 cover the unicode case?"
> Coder: "Yes, the test covers unicode well." (Actually, the test only asserts ASCII rows.)

**Why it fails:** The user trusts the answer and ships with a coverage gap.

**Cure:** Read the actual code; assert based on what's there. If the test doesn't cover the case, say so. Disagree with the user when the user is wrong about facts — politely, with evidence.

---

## 14. Hiding errors with `// TODO`

**Smell:** A `// TODO` comment as a substitute for actually handling the case.

**Example:**

```ts
try {
  return parseCsv(input);
} catch (e) {
  // TODO: handle parse errors properly
  return { rows: [] };
}
```

**Why it fails:** The TODO is invisible at runtime. The user sees an empty result, not an error.

**Cure:** Either handle the error properly now, or surface it (return `Err`, log warning, etc.). TODOs aren't a substitute for behavior. If the proper handling is out of scope, the spec needs to acknowledge that — surface to implementation-planner.

---

## 15. Skipping the progress file

**Smell:** No `progress.md`, or it's stale.

**Example:**

> Session is interrupted at hour 3. Resumes; spends 20 minutes reconstructing state from `git log` and the spec.

**Why it fails:** Recovery is slow and error-prone. The implementation context that's lost gets re-derived approximately; subtle decisions get lost or re-made differently.

**Cure:** Update `progress.md` after each commit. 30 seconds of writing saves 20 minutes of recovering. See [`coding-loops.md`](coding-loops.md) §3.

---

## 16. Pushing through on the first explanation

**Smell:** A test fails. The first hypothesis is acted on without confirming.

**Example:**

> Test fails: `expected 5, got 4`.
> Coder: "Off-by-one." Edits the loop guard. Test still fails: `expected 5, got 6`. "Oh, wrong direction." Edits back. Fails: `expected 5, got 4`. Iterates.

**Why it fails:** Guess-and-check. Each edit moves the system away from the known state. Hard bugs take many cycles to nail this way.

**Cure:** Stop and form a hypothesis. State it. Probe. Confirm or reject before editing. See [`debugging-methodology.md`](debugging-methodology.md).

---

## 17. Mocking time / dates without resetting

**Smell:** A test mocks `Date.now()` or `time.time()` but doesn't restore the original.

**Example:**

```ts
test("expires after 24h", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000000);
  // ... test ...
  // forgot to .mockRestore() — affects subsequent tests
});
```

**Why it fails:** Subsequent tests see the mocked time; cascading failures that are hard to diagnose.

**Cure:** Use `afterEach(() => vi.restoreAllMocks())` globally, or restore explicitly. Time mocking is especially flakeable; be disciplined.

---

## 18. Silent convention deviation

**Smell:** Coder deviates from a codebase convention without naming it.

**Example:**

> Codebase uses `Result<T, E>` everywhere. New module throws. Implementation report says "implemented per spec" without mentioning the deviation.

**Why it fails:** Reviewer either spots and rejects (delay) or misses (technical debt).

**Cure:** Either match the convention (recommended), or deviate with a justifying comment in code AND a flag in the implementation report. Silent deviation is what gets rejected. See [`convention-matching.md`](convention-matching.md) §5.

---

## 19. Skipping the self-review

**Smell:** "Tests pass; done." No fresh-context review of the diff.

**Example:**

> Coder declares done. PR review finds: a `console.log`, a commented-out block, an unused import, a missing edge-case test. All things a self-review would have caught.

**Why it fails:** The reviewer becomes the self-review. Their time is more expensive than yours.

**Cure:** Run [`self-review-checklist.md`](self-review-checklist.md). 5-10 minutes of disciplined reading catches most reviewer-visible issues.

---

## 20. Sweeping the report clean

**Smell:** The implementation report says "all done, no issues" when there are issues.

**Example:**

> Report: "Implemented the spec. All tests pass."
> Reality: 4 of 5 spec tests pass; 1 is skipped with a TODO. Two convention deviations. One mocked-the-real-thing in the test setup.

**Why it fails:** The reviewer trusts the report; misses the issues. Or worse — production deploys with the issues, and they surface later.

**Cure:** Honest reporting. The implementation report template (`assets/implementation-report.md`) has sections for "what didn't work", "hacky bits", "skipped items" precisely because they're common and important to surface. Use them. See [Tenet 5 in SKILL.md](../SKILL.md).

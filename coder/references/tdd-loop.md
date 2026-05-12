# TDD Loop

> *"Tests are proof; 'seems right' is not done."* — Tenet 3

Test-driven development is the dominant 2026 pattern for agentic coding. The reason is concrete: when an agent writes code without a test, it tends to declare done prematurely. When an agent writes a test first and watches it fail, the test catches premature-done. The discipline is enforceable.

This reference describes the loop, the **mandatory red phase** (which agents tend to skip), and the cases where strict TDD doesn't fit.

---

## 1. The classic loop

```
                ┌─────────────────────────────────────────┐
                ▼                                         │
       ┌───────────────┐      ┌───────────────┐    ┌──────┴──────┐
       │     RED       │      │    GREEN      │    │  REFACTOR   │
       │ Write failing │ ───► │ Write minimal │ ──►│  Improve    │
       │     test      │      │  code to pass │    │  cleanly    │
       └───────────────┘      └───────────────┘    └─────────────┘
            FAILS                  PASSES               STILL PASSES
```

Three actions, three states. Each transition requires evidence — the test must change color.

The most-skipped step in practice is **RED**. Agents tend to write the test and the code in the same prompt, then run the test once and declare green. **A test that has never failed proves nothing.** Maybe the test was wrong. Maybe the test asserts the wrong thing. Maybe the code happened to work for the case the test covered, but breaks the case the test thought it was checking.

---

## 2. Required sequence for new behavior

Every new behavior follows this sequence:

```
1. Add the test file (if new) and the test function.
2. Run the test. Confirm it FAILS — with the EXPECTED failure mode:
     - If you expect "function doesn't exist" — ENOENT / NameError / undefined.
     - If you expect "wrong return value" — assertion failure on the value.
     - If you expect "wrong error code" — assertion failure with the actual code.
   If it fails for a different reason than expected, the test isn't right; fix the test.
3. Commit the failing test as its own commit (optional but recommended).
4. Write the minimal code to make the test pass.
5. Run the test. Confirm it PASSES.
6. Run the surrounding tests. Confirm nothing else broke.
7. Commit the passing code.
```

Two commits, one for red, one for green. CI history shows: this test was added, it caught the absence of the behavior, then the behavior was added and the test passed. **That sequence is the proof.**

---

## 3. Required sequence for bug fixes

For a bug fix, the regression test **must** fail on `main` before the fix:

```
1. Branch off main.
2. Add the regression test that captures the bug.
3. Run it. Confirm it FAILS — with the symptom the user reported.
   - If it doesn't fail, the test doesn't reproduce the bug. STOP.
4. (Optional, recommended) Commit the failing test.
5. Apply the minimal fix.
6. Run the test. Confirm it PASSES.
7. Run the surrounding tests. Confirm no regressions.
8. Commit the fix.
```

The "stop if the test doesn't fail" check is non-negotiable. Three possible reasons a regression test doesn't fail on main:

- **The test is wrong** (asserts the wrong thing). Fix the test.
- **The bug is somewhere else** than you think. Re-diagnose.
- **The bug has been fixed already** (by an unrelated change). Don't waste a slice; surface and close the bug report.

In all three cases, **don't apply a "fix"** — you'd be fixing nothing and obscuring the real story.

---

## 4. When TDD doesn't fit cleanly

TDD shines for behaviors that are clearly defined and locally testable. It's awkward for:

### Exploratory work

You're not sure what the right behavior is yet. Writing a test first means writing it wrong.

**Approach:** spike first (writing some code to learn), then **discard the spike** and TDD the real implementation. The spike is throwaway; the production code follows the loop.

### UI / visual work

Visual changes resist unit tests. Snapshot tests pin output but they regenerate when you change the visual, which makes them more of a checksum than a test.

**Approach:** assertion-based tests for behavior (the button click triggers the right action, the form submits with the right payload); visual review for visuals; snapshot tests only for parts of the UI that are intentionally stable.

### Configuration / infrastructure

Changing a config file from `false` to `true` doesn't have a unit-level red phase.

**Approach:** the test is at a higher level — does the integration test that exercises the config now behave differently? If not, the config change had no observable effect (which is its own bug).

### Pure refactors

By definition, no behavior change → no new test.

**Approach:** the existing tests are the contract. They pass before, they pass after, unchanged. If you need a new test, the refactor is no longer pure — that's a different spec.

---

## 5. The minimal-code rule

In the GREEN phase, write the **minimal** code that makes the test pass. Not the elegant code, not the future-proof code, not the abstract code. The minimal code.

The reason: agents over-engineer. Writing "what would solve the test plus three related cases" leads to abstractions the tests don't cover, which means parts of the code are untested, which means bugs hide there.

**Minimal-code examples:**

The test asserts `add(2, 3) === 5`. Minimal code:

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

Not:

```ts
// Anti-pattern: features the test doesn't ask for
function add(a: number, b: number, options?: { precision?: number }): number {
  if (typeof a !== "number" || typeof b !== "number") {
    throw new TypeError("Expected numbers");
  }
  const result = a + b;
  return options?.precision !== undefined
    ? Number(result.toFixed(options.precision))
    : result;
}
```

Add complexity only when a test demands it. The next failing test will tell you what to add.

---

## 6. The REFACTOR phase (often skipped)

Most agents stop at green. The REFACTOR step is where the code becomes maintainable:

- Extract a helper if the same logic appears twice.
- Rename a variable now that you know what it represents.
- Pull a magic number into a named constant.
- Remove dead branches the tests revealed weren't reached.

**Constraint:** all tests still pass after the refactor. If a test breaks, undo the refactor; the test caught something you didn't expect.

The refactor phase often gets one commit per round of TDD (or one per slice if the refactors are small). Squashed commit history might show: `test`, `feat`, `refactor`, `test`, `feat`, `refactor`, …

---

## 7. Worked example — TDD for `parseRange`

> Task: implement `parseRange(start, end) → [start, start+1, ..., end]`, inclusive.

### Red (commit 1)

```ts
// src/lib/parse-range.test.ts
import { parseRange } from "./parse-range";

test("parseRange(1, 5) returns [1, 2, 3, 4, 5]", () => {
  expect(parseRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
});
```

```bash
$ npm test -- parse-range
FAIL src/lib/parse-range.test.ts
  ✗ parseRange(1, 5) returns [1, 2, 3, 4, 5]
    Cannot find module './parse-range' from 'src/lib/parse-range.test.ts'
```

Expected failure: file doesn't exist. ✅ Red confirmed.

```bash
$ git add src/lib/parse-range.test.ts
$ git commit -m "test(parse-range): inclusive range smoke test"
```

### Green (commit 2)

```ts
// src/lib/parse-range.ts
export function parseRange(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}
```

```bash
$ npm test -- parse-range
PASS  ✓ parseRange(1, 5) returns [1, 2, 3, 4, 5]
$ git add src/lib/parse-range.ts
$ git commit -m "feat(parse-range): inclusive range"
```

### Next red (commit 3) — boundary cases

```ts
test("parseRange(3, 3) returns [3]", () => {
  expect(parseRange(3, 3)).toEqual([3]);  // happens to pass
});

test("parseRange(5, 3) returns []", () => {
  expect(parseRange(5, 3)).toEqual([]);  // FAILS: current loop returns []
                                          // (Wait — current loop condition is `i <= end`
                                          //  so with start=5 end=3, loop never executes → []. )
});
```

Hmm — the boundary test for empty range happens to pass too. So no red. Either the test is unnecessary (already covered by behavior) or we need a different test that reveals a gap.

```ts
test("parseRange(-2, 1) returns [-2, -1, 0, 1]", () => {
  expect(parseRange(-2, 1)).toEqual([-2, -1, 0, 1]);  // PASSES
});
```

These tests passed without changing the code — they were already covered by the implementation. **That's a fine outcome**; the tests now pin those behaviors so future refactors can't break them. The TDD discipline is intact: we just confirmed coverage rather than driving new code.

### Next red (commit 4) — actually new behavior

```ts
test("parseRange with non-integer throws", () => {
  expect(() => parseRange(1.5, 3)).toThrow(/integer/);
});
```

```bash
$ npm test -- parse-range
FAIL: expected to throw matching /integer/, received: [1.5, 2.5]
```

Now we have red — the implementation doesn't validate. Green is to add the validation. (Or, decide validation is out of scope and remove the test.)

---

## 8. Mocking discipline within TDD

In the green phase, you sometimes need to mock dependencies to keep the test fast. The rule: **don't mock the thing under test.**

```ts
// Anti-pattern: testing parseRange but mocking parseRange-internals
vi.mock("./parse-range", () => ({
  parseRange: vi.fn().mockReturnValue([1, 2, 3]),
}));
test("parseRange(1, 3) returns [1, 2, 3]", () => {
  expect(parseRange(1, 3)).toEqual([1, 2, 3]);  // passes because of the mock
});
```

This test asserts the mock is set up correctly. It tests nothing about parseRange.

```ts
// Correct: parseRange is real; only external deps are mocked
vi.mock("@/lib/logger");  // ok — silence logging during tests
test("parseRange(1, 3) returns [1, 2, 3]", () => {
  expect(parseRange(1, 3)).toEqual([1, 2, 3]);  // tests the real function
});
```

The 2025-2026 empirical research on AI-written tests highlights over-mocking as the dominant failure mode. Be explicit: in the implementation report, list what you mocked and **what you deliberately didn't mock** (per spec).

---

## 9. Anti-patterns

- **Writing test and code in one prompt, then running once.** No red, no green-after-red. Discipline is enforced by the change in color, not the existence of the test.
- **"The test is obvious; I'll skip running the red."** Run it. Twenty seconds to confirm.
- **Mocking the unit under test.** The most common AI testing failure mode.
- **Adding 10 tests at once, fixing all of them at once.** Loses the red-then-green signal per behavior. One test, one commit, one fix.
- **Skipping the refactor phase.** Code stays at "minimum to pass" forever; technical debt accrues.
- **Refactoring while red.** If the test is failing, get it passing first. Refactor on green.
- **Treating snapshot tests as TDD.** Snapshot tests regenerate when they break; they're closer to assertions about the current behavior than to drivers of new behavior.
- **Skipping TDD because "it's a quick fix."** Quick fixes are the hottest path to incidents. Especially TDD them.

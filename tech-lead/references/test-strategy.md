# Test Strategy

> *"Tests are designed, not assumed."* — Tenet 5

The test plan is part of the spec, not the coder's homework. This reference describes how to design a test plan that's specific enough to constrain the coder, level-appropriate for what's being tested, and aligned with how the codebase already tests.

The bar: **a coder reading the test plan should be able to write the test names and file locations without re-reading the spec.** "Tests the happy path" doesn't clear that bar. "`test_exports_csv_with_all_columns` in `src/api/export-csv.test.ts` — asserts the first row is the header and the next N rows match the query result" does.

---

## 1. The pyramid (and why level selection matters)

Tests live at four levels. Each level catches different bugs at different costs.

```
                ┌─────────┐
                │  E2E    │  ← few, slow, brittle, catch user-visible bugs
            ┌───┴─────────┴───┐
            │  Integration    │  ← medium count, real boundaries, slower
        ┌───┴─────────────────┴───┐
        │      Unit               │  ← many, fast, isolated, cheap to write
    ┌───┴─────────────────────────┴───┐
    │     Static (typecheck, lint)    │  ← always-on, free, catches a lot
    └─────────────────────────────────┘
```

**The level matters.** A unit test for a feature that crosses a network boundary isn't a unit test — it's a mocked integration test masquerading. An integration test that runs the entire app for every change isn't testing fast feedback — it's an e2e test in a slow harness.

**Choosing the level:**

| If the behavior… | Use this level |
|---|---|
| Is pure logic with no IO | Unit |
| Crosses a real boundary you can fake cheaply | Unit with a fake at the boundary |
| Crosses a real boundary you can't fake well | Integration with the real boundary (testcontainer, in-memory DB) |
| Is the full request path or user flow | E2E |
| Is purely a type contract | Static (typecheck) — no runtime test needed |

A spec that puts everything at the unit level over-mocks (a documented problem with AI-written tests — they tend to mock out the real behavior). A spec that puts everything at the integration level over-pays for fast-feedback.

---

## 2. Naming tests

The test name is its assertion. Good test names read as sentences and survive grep.

| Bad | Better | Best |
|---|---|---|
| `test_login` | `test_login_returns_user` | `test_login_returns_user_on_valid_credentials` |
| `test_export_works` | `test_export_csv_streams` | `test_export_csv_streams_rows_without_buffering_full_result` |
| `it works` | `returns 401 on bad password` | `returns 401 with invalid_credentials error code on wrong password` |

The pattern that scales: **subject + behavior + condition.** Subject = the thing under test; behavior = what it does; condition = the scenario.

Match the codebase's naming style. Some use `test_*` (Python, Go), some use `describe`/`it` (Jest/Vitest), some use `describe`/`should` (Mocha). Don't impose; mirror.

---

## 3. What's worth testing — by category

### Required tests (always specify)

- **Happy path:** the spec's outcome, asserted directly.
- **One failure mode the user is most likely to hit:** wrong input, missing data, unauthorized, etc.
- **Boundary conditions for any non-trivial range:** empty, max length, unicode, zero, negative.
- **Regression test for any bug being fixed:** must fail before the fix, pass after. Non-negotiable.

### Recommended tests (specify unless deliberately skipped)

- **Concurrency, idempotency:** if the code might be called concurrently or twice with the same input.
- **Error mapping:** if errors are translated (e.g., `DBError` → `HTTPError`), test the translation.
- **Logging / metrics emission:** if a log line or metric is part of the contract (e.g., audit logs).
- **Backward compatibility:** if existing callers must keep working unchanged.

### Test categories often missed

- **Type-system tests** (`expectTypeOf`, `tsd`): when the type signature is the contract, the test belongs at the type level.
- **Property tests** (`fast-check`, `hypothesis`): when the behavior has invariants ("output is always sorted", "round-trip is identity").
- **Snapshot tests** (used sparingly): when the output is generated and human-reviewable but tedious to enumerate.
- **Performance tests** (regression-only): when the spec has a perf requirement, name the assertion. Don't add a performance test "just because."

---

## 4. Test plan format

A table is usually clearest:

```markdown
| Test name | Level | File | Assertion |
|---|---|---|---|
| `exports_csv_with_all_columns` | unit | `src/api/export-csv.test.ts` | First row is header (`id,name,value`); next N rows match query result in same order |
| `streams_csv_without_buffering` | unit | same | Pipe consumes one row before next row is produced (verifies backpressure handling) |
| `returns_export_error_on_query_failure` | unit | same | `Result.Err` with `code: ExportErrorCode.QUERY_FAILED`; original error stays in `cause` |
| `route_serves_csv_with_attachment_header` | integration | `tests/api/routes.test.ts` | Response `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename=*.csv` |
| `route_returns_500_on_export_error` | integration | same | `ExportError` from handler maps to HTTP 500 with `{error: 'export_failed'}` body |
```

Each row is a contract the coder must satisfy. The reviewer can run through this table and check off the spec's behavior coverage.

### Edge cases — list separately if not testing each

When a separate test per edge case is overkill, list the edges in a sub-section so the design acknowledges them:

```markdown
**Edge cases acknowledged (covered by happy path + boundary assertions):**

- Empty result set → header row only, 200 OK
- Single-row result → header + one row
- Unicode in cell values → quoted, embedded quotes doubled (test added explicitly)
- Cell containing newline → quoted with embedded newline preserved
- Concurrent calls with same query → both succeed independently (not tested; spec assumes
  no shared state)
```

The point: explicit consideration, not exhaustive enumeration. The spec demonstrates the edges were thought about; the coder picks up the unwritten ones during implementation.

---

## 5. TDD — when to spec test-first

For some specs, the test should be written **before** the implementation. The spec calls this out explicitly when it matters:

**Spec test-first when:**

- The change is a **bug fix** — the regression test must fail before the fix. Non-negotiable.
- The behavior is **clearly defined and small** — a pure function, an input/output transform, a parser. TDD shines here.
- The change is **at a clean boundary** — a new service method, a new API handler. Easy to test in isolation.

**Don't spec test-first when:**

- The change is **exploratory** — you're not sure what the right behavior is yet. Write some code, learn, then test.
- The change is **predominantly UI** — visual changes resist TDD; spec the assertion-as-snapshot or rely on manual review.
- The change is **infrastructure / config** — there's nothing to red-then-green at the unit level.

When TDD is specified, the spec includes the test code (or a precise enough description that the coder writes the same test):

```markdown
### Test-first

Before any implementation:

1. Add `src/api/export-csv.test.ts` with the test `exports_csv_with_all_columns`.
   The test calls `exportCsv(query, ctx)` and asserts the returned Result is Ok and
   the streamed output has the expected header and rows. The test MUST fail (the file
   `src/api/export-csv.ts` doesn't exist yet) — confirm the red, then proceed.
2. Implement `src/api/export-csv.ts` to satisfy the test.
3. Add the remaining tests one at a time, red → green for each.
```

See modern AI coding research (early 2026): agents tend to merge red-and-green into a single prompt and skip the "red first" confirmation. The spec **explicitly requires the red** so the coder doesn't shortcut. Tests that have never failed prove nothing.

---

## 6. Mocking discipline

Coding agents over-mock. They mock the real behavior away, leaving tests that pass for the wrong reason. The spec constrains mocking by saying what to mock and what to leave real.

**Mock when:**

- The dependency is **slow** (network, disk on large files, DB with seeds).
- The dependency is **non-deterministic** (current time, random, external API).
- The dependency is **expensive to set up correctly** (multi-step auth, cross-region services).

**Don't mock when:**

- The dependency is **the thing being tested**. (Don't mock the parser to test the parser.)
- The dependency is **a pure function**. Just call it.
- The dependency is **a thin wrapper**. Mocking it tests the wrapper, not the unit.

**Spec the mocks explicitly:**

```markdown
**Mocks:**
- `vi.mock('@/lib/logger')` — silence logs during tests (asserted separately in
  `route_emits_audit_log` integration test).
- `vi.mock('@/db/pool')` returning a fake pool whose `query` returns the test
  fixture rows.

**Not mocked (deliberately):**
- `csv-stringify` — real library, real serialization. Mocking it would test the mock.
- `streamPipeline` — real pipeline. The whole point is to verify the streaming.
```

The "not mocked (deliberately)" list is what prevents the AI over-mock failure mode. Be explicit.

---

## 7. Baseline expectations

Every spec runs against an existing test baseline (from exploration). The test plan section ends with:

```markdown
**Baseline:** All existing tests in `src/api/` pass at HEAD. After this slice,
all existing tests still pass; new tests above are added.
**Test count delta:** +5 tests.
**Coverage delta expectation:** the new module is fully covered (>95% line);
overall coverage should not decrease.
```

This makes the coder's exit criteria measurable. If existing tests start failing, the coder pauses and surfaces (it's a red flag, not "fix and continue").

---

## 8. Anti-patterns

- **"Add tests."** Not a test plan. A test plan names each test, its level, its file, its assertion.
- **All tests at the unit level.** Probably over-mocking. Re-check: does any behavior cross a real boundary?
- **All tests at the integration level.** Probably under-isolating. Slow tests are a tax on iteration.
- **Tests that don't fail first.** If you can't write the failing version, you can't trust the passing version.
- **Mocking the thing under test.** The most common AI testing failure mode. Be explicit about what's real.
- **Snapshot abuse.** A snapshot test that's regenerated whenever it fails is a checksum, not a test. Use snapshots for stable, human-reviewed outputs only.
- **Skipping coverage / threshold rules.** If the codebase has a CI threshold, the spec respects it. New code is fully covered unless explicitly justified.
- **One mega-test that asserts everything.** Break it up. A failing mega-test gives the coder no signal about *which* assertion failed.

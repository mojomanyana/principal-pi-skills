# Test Plan & Acceptance Checklist

<!--
  Use this checklist before declaring done. It walks through the spec's
  acceptance signal (or, for no-spec direct tasks, a minimum verification
  set) and records the result of each check. Attach to the implementation
  report; project-git uses it to populate the PR's status.

  This is the LAST gate before handoff. If anything is unchecked or red,
  the slice is not done.
-->

**Slice:** `<slice-name>`
**Spec acceptance reference:** `<spec section §X, or "no spec — using minimum verification set">`
**Date run:** <YYYY-MM-DD>
**Run from:** clean shell after the final commit (no stale state)

---

## 1. Test suite — new tests from spec §5

| Spec test name | Type | File | Status | Notes |
|---|---|---|---|---|
| `<test name>` | unit | `<path>` | ✅ green / ❌ red / ⚠️ skip | — |
| `<test name>` | unit | `<path>` | ✅ green | — |
| `<test name>` | integration | `<path>` | ✅ green | — |
| `<test name>` | e2e | `<path>` | ✅ green | — |

**Command used:**

```bash
<exact command>
```

**Output excerpt:**

```
<paste the relevant tail>
```

**All required spec tests pass?** ✅ yes | ⚠️ partial (see below) | ❌ no

If partial or no: which tests, why, what's the path forward.

---

## 2. Regression — existing tests

The spec's baton specified which existing test scopes must remain green. Re-run each:

| Scope | Command | Status | Notes |
|---|---|---|---|
| `<e.g., src/api/>` | `npm test -- src/api/` | ✅ green (N tests) | — |
| `<e.g., tests/integration/>` | `<command>` | ✅ green | — |
| ... | ... | ... | ... |

**Any existing test regressed?** ❌ no | ⚠️ yes (NOT acceptable — fix before handoff)

---

## 3. Typecheck

```bash
$ <typecheck command, e.g., npm run typecheck>
✓ no errors
```

**Status:** ✅ clean | ❌ errors (fix before handoff)

---

## 4. Lint

```bash
$ <lint command, scoped to modified files first>
✓ no warnings
```

**Status:** ✅ clean | ⚠️ warnings (acceptable only with justification) | ❌ errors (fix)

**Justified warnings (if any):**

- `<file:line>` — `<warning>` — disabled inline with comment because `<reason>`

---

## 5. Formatter

```bash
$ <formatter check, e.g., prettier --check>
✓ no formatting issues
```

**Status:** ✅ clean | ❌ needs formatting (run formatter, recommit, re-verify)

---

## 6. Build / compile

```bash
$ <build command>
✓ build successful
```

**Status:** ✅ clean | ❌ build broken (fix before handoff)

---

## 7. Manual verification (if spec requires)

For specs whose acceptance includes a manual check:

```bash
# Step 1: start the service
$ <command>

# Step 2: trigger the behavior
$ <command>

# Step 3: observe the expected output
<expected output>
```

**Observed:** matches | partial | doesn't match

If "matches": good. If not: not done.

---

## 8. Spec-specific acceptance criteria

<!--
  Some specs have non-test criteria: a log line emitted, a metric incremented,
  a file generated with byte-identical bytes, a header set on a response. List
  each one with its verification.
-->

| Criterion | Verification | Result |
|---|---|---|
| Log line `export.csv.start` emitted on success | `grep` test output for the line | ✅ found |
| Header `Content-Type: text/csv` on `/export/csv` response | curl + inspect | ✅ correct |
| Metric `export_requests_total{type="csv"}` incremented | scrape `/metrics` endpoint before/after | ✅ +1 |
| ... | ... | ... |

---

## 9. Stop conditions check

Per the spec's baton, the following stop conditions exist. Confirm none fired:

| Stop condition | Status |
|---|---|
| `<spec stop condition 1>` | ✅ did not fire |
| `<spec stop condition 2>` | ✅ did not fire |
| `<spec stop condition 3>` | ⚠️ fired (see implementation report §X for resolution) |

**Any stop condition fired without resolution?** ❌ no | ⚠️ yes (NOT acceptable — surface to tech-lead before handoff)

---

## 10. Reversibility decisions confirmed

Per spec §7 (Reversibility), each decision was implemented per the spec's tag. Reconfirm:

| Decision | Tag | Implemented per spec? | Kill criterion respected (🔴 only)? |
|---|---|---|---|
| `<decision 1>` | 🟢 | ✅ | n/a |
| `<decision 2>` | 🟡 | ✅ | n/a |
| `<decision 3>` | 🔴 | ✅ | yes — `<verification>` |

**Any silent re-interpretation of a 🔴 decision?** ❌ no | ⚠️ yes (surface; not acceptable to ship silently)

---

## 11. Self-review

Has the [self-review checklist](../references/self-review-checklist.md) been run?

- [ ] Stray instrumentation — clean
- [ ] Commented-out code — clean
- [ ] Dead code — clean
- [ ] Suppressed errors — clean
- [ ] Security smells — clean
- [ ] Tests assert specifics — clean
- [ ] Type and lint — clean
- [ ] Spec adherence — clean (with any deviations flagged in report)
- [ ] Convention adherence — clean (with any deviations flagged)
- [ ] Edge cases — covered or explicitly flagged
- [ ] Files / commit hygiene — clean

---

## 12. Final gate

**All sections green?** ✅ ready for handoff | ❌ go back to implementation

**Implementation report written?** ✅ | ❌ (write it before handoff)

**Handoff baton to project-git filled in?** ✅ | ❌ (fill it in before handoff)

**`progress.md` reflects final state?** ✅ | ❌ (update before handoff)

---

If everything is green: hand off to `project-git` with the baton.

If anything is red or unchecked: go back into implementation. Don't declare done with red checks; that's the entire point of the self-discipline.

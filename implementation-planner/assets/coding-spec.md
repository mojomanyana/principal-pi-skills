# Coding Spec — `<slice or task name>`

<!--
  This is the canonical coding spec template. Every section is required; if a
  section truly has no content, write "n/a — explicitly considered" with a
  one-line reason.

  Right-size: a spec for a 5-line fix is 30 lines. A spec for a new module is
  150-300 lines. A spec longer than the diff is over-engineered; revisit scope.

  Replace ALL <placeholder> values. Delete these HTML comments before sharing.
-->

**Status:** draft | reviewed | locked
**Spec author:** implementation-planner (date: <YYYY-MM-DD>)
**Upstream:** <implementation-planner slice ID, brainstorm decision brief, or "direct user task">
**Downstream:** coder

---

## 1. Outcome

<!--
  One to three sentences. Verifiable after the work ships. EARS phrasing
  recommended when the outcome is event-driven or state-driven:
    "WHEN <trigger>, the system shall <response>."
-->

<one-to-three sentences>

---

## 2. Scope

**In scope:**

- <bullet>
- <bullet>

**Out of scope (explicitly considered):**

- <bullet — what a reviewer might assume is included but isn't>
- <bullet>

---

## 3. Exploration notes

<!-- The six-part context capsule. Each part is required. -->

**Surface:** <project structure, language version, build system, top-level entry points — 3-5 lines>

**Affected files:**
- <path/to/file.ts> — <new | modify | delete | rename>
- <path/to/file.ts> — <new | modify | delete | rename>

**Conventions discovered:**

| Domain | Convention | Source |
|---|---|---|
| Naming | <e.g., camelCase functions, PascalCase types> | <files observed in> |
| Errors | <e.g., Result<T, E> from @/lib/result> | <files> |
| Tests | <e.g., vitest, colocated *.test.ts> | <files> |
| Types | <e.g., tsconfig strict + noUncheckedIndexedAccess> | <config + sample files> |
| Imports | <e.g., @/ alias for src> | <tsconfig + sample files> |
| Logging | <e.g., @/lib/logger structured> | <files> |
| Formatter / lint | <e.g., prettier + eslint enforced in CI> | <config + workflow> |

**Types & contracts:**

```<lang>
// Existing relevant types — full signatures
type ExportError = { code: ExportErrorCode; cause?: Error; meta?: ... };
function exportPdf(query: ExportQuery, ctx: RequestContext):
  Promise<Result<Readable, ExportError>>;
```

**Tests baseline:**

- Existing tests in `<scope>`: <count>, status <green | partial | red>.
- Baseline command: `<exact command used>`.

**Risks observed:**

- <e.g., adjacent TODO that's relevant>
- <e.g., test gap in adjacent area>
- <e.g., surprising pattern that constrains the design>

---

## 4. Design

<!--
  For each affected file, a sub-section answering: purpose, public surface
  (full signatures), key internals, optional code sketch. A code sketch is
  5-20 lines of pseudocode showing intent, NOT the full implementation.
-->

### `<path/to/file.ts>` (new | modify | delete | rename)

**Purpose:** <one sentence>

**Public surface:**

```<lang>
// Full signatures of exported symbols after the change.
```

**Key internals:**

- <non-obvious helper, state, invariant>
- <non-obvious helper, state, invariant>

**Code sketch (optional — include for non-trivial behavior):**

```<lang>
// 5-20 lines of pseudocode. Should compile in your head.
```

### `<path/to/other-file.ts>` (modify)

<repeat structure>

---

## 5. Test plan

<!--
  Every behavior gets a named test. Specific assertion. Right level.
  See test-strategy.md for level selection and mocking discipline.
-->

| Test name | Level | File | Assertion |
|---|---|---|---|
| `<test_name>` | unit \| integration \| e2e \| static | `<path>` | <specific assertion> |
| ... | ... | ... | ... |

**Edge cases acknowledged (covered by named tests above):**

- <empty case>
- <boundary case>
- <unicode / encoding>
- <concurrency / ordering>

**Mocks (and what's deliberately not mocked):**

- Mock: `<module>` — <why>
- Not mocked (deliberately): `<module>` — <why — usually "the unit under test depends on real behavior here">

**TDD discipline:**

- [ ] At least one test specified is to be written test-first (failing red before any implementation).
- [ ] For bug fixes: the regression test fails on `main` before the fix, passes after.

**Baseline:**

- Existing tests in `<scope>` all pass at HEAD before this slice; all still pass after.
- New tests added: +<N>.
- Coverage delta expectation: <new module fully covered; overall non-decreasing>.

---

## 6. Dependencies & ripples

**Dependencies:**

- Add: `<package@version>` — <license, size, maintenance, why not existing utility>
- Remove: <package or "none">
- Bump: <package version transition or "none">

**Affected callers:**

| Caller | Category | Impact |
|---|---|---|
| `<path/to/caller.ts:N>` | <route registration \| direct call \| import-only \| test> | <change required this slice or out of scope> |

Search method: <e.g., `rg "exportPdf\b" --type=ts` and `ast-grep` on the symbol; N matches total>.

**Deleted / renamed exports:** <list or "none">

**Side effects:**

- New IO: <files, network, DB or "none">
- New logs: <log names with levels or "none">
- New env vars / config: <names with defaults or "none">
- New metrics: <names with types or "none">
- New background jobs: <or "none">
- Schema / data layout changes: <or "none">

**Migration plan:** <required if schema/config/data changes; otherwise "n/a">

---

## 7. Reversibility

| Decision | Tag | Rationale | Kill criterion (🔴 only) |
|---|---|---|---|
| <decision> | 🟢 \| 🟡 \| 🔴 | <why> | <measurable, time-bound criterion> |
| ... | ... | ... | ... |

<!--
  Every 🔴 needs a kill criterion. If you can't write one, ask: can the
  decision be restructured (alias + cycle, feature flag, shadow mode, versioned
  endpoint) to become 🟡 or 🟢? See reversibility-for-code.md §5.
-->

---

## 8. Smell-check

<!--
  Prose, ~3-6 sentences. Demonstrate that the four smells were checked:
  fighting the codebase, re-implementing what exists, solving the symptom,
  wrong size. See smell-check.md.
-->

<paragraph>

---

## 9. Flagged assumptions

<!--
  What the coder must reconfirm. Each line answers: what would change if this
  assumption is wrong? "Confirmed" assumptions don't go here; they go in
  exploration notes.
-->

- ASSUMES: <statement>. If wrong: <how the spec must update>.
- ASSUMES: <statement>. If wrong: <how the spec must update>.

If none: "No flagged assumptions — every spec-load-bearing fact verified in §3."

---

## 10. Handoff baton → coder

<!--
  Structured pickup contract. Coder reads this in a fresh context window
  and can start without re-reading the rest of the spec. See handoff-to-coder.md.
-->

**Spec:** <path to this document, or "inline above">

**Outcome (one-liner):** <single sentence>

**First concrete action:** <specific, verifiable starting move>

**Reconfirm before coding:**

- [ ] <assumption to verify> — <verification step>
- [ ] <assumption to verify> — <verification step>

**Acceptance signal:**

1. <test command> exits 0
2. <typecheck command> exits 0
3. <lint command> exits 0
4. <existing test suite scope> still exits 0
5. Manual: <verification step if applicable>

**Stop conditions (pause and return to implementation-planner):**

- An assumption above is wrong (spec must update).
- A 🔴 decision needs revisiting.
- The test plan reveals a gap requiring more than a one-line addition.
- A convention discovered mid-coding contradicts the spec.

**Commit hygiene:**

- Conventional commits: <prefix examples>
- Small commits — <ideally N commits, listed below>:
  1. <step>
  2. <step>
- Write a progress note to `progress.md` after each commit.
- Hand the resulting branch to `project-git` for PR once acceptance signal is green.

---

## Revision history

| Date | Version | Change | Author |
|---|---|---|---|
| <YYYY-MM-DD> | v1 | Initial draft | implementation-planner |

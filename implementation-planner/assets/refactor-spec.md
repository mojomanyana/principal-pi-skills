# Refactor Spec — `<refactor name>`

<!--
  Refactor variant of the coding spec. The defining feature is the proof of
  equivalence: how we know the refactor changed nothing externally observable.
  No refactor spec ships without this section.

  If you're tempted to "improve behavior while restructuring", STOP — that's
  not a refactor. Split into: (1) a refactor that preserves behavior, then
  (2) a feature/fix slice that changes behavior. They are different specs.
-->

**Status:** draft | reviewed | locked
**Spec author:** implementation-planner (date: <YYYY-MM-DD>)
**Upstream:** <implementation-planner slice ID, technical-debt ticket, or direct user task>
**Downstream:** coder
**Behavior change?** **NO.** (If yes, this is not a refactor; use coding-spec.md.)

---

## 1. Motivation

<!--
  Why refactor now? Refactors without motivation drift into scope and break
  things. The motivation also informs the smell-check and prioritization.
-->

<two to four sentences: what's wrong with the current shape, and what will
become easier after the refactor>

**Concrete benefit (post-refactor):**

- <new feature X becomes possible / cheap>
- <test surface gets cleaner — concrete>
- <duplication of N lines collapses to M>

**Cost (the work of doing this refactor):**

- <files touched: rough count>
- <risk of regression: rough estimate>
- <time investment expected>

If the cost outweighs the benefit, this spec is "don't refactor — defer." Surface that as the conclusion.

---

## 2. Scope

**In scope (files / modules to restructure):**

- <path/to/module>
- <path/to/module>

**Out of scope (NOT touched by this refactor):**

- <adjacent code that's tempting but separate>
- <"while I'm here" improvements — must be separate slices>

**Behavior-preserving boundary:**

External callers, public APIs, persisted data, wire formats, log lines, and
metrics are **unchanged** by this refactor. The full list of what stays
identical:

- Public functions: same signatures, same return shapes, same error types.
- HTTP responses: same status codes, headers, body shapes.
- Database: no schema changes, no migration.
- Logs: same names, same levels, same payload structure.
- Metrics: same names, same labels.
- File outputs: byte-identical for any reproducible input.

If ANY item above must change, this is NOT a refactor; revisit framing.

---

## 3. Exploration notes

<!-- Same six-part capsule as the standard spec. -->

**Surface:** <project structure, language, build>

**Affected files:**

- <path> — <will be split / merged / renamed / re-organized>

**Conventions discovered:**

| Domain | Convention | Source |
|---|---|---|
| <as standard> | ... | ... |

**Types & contracts (preserved across the refactor):**

```<lang>
// External signatures that stay byte-identical:
export function exportPdf(...): Promise<Result<Readable, ExportError>>;
export type ExportError = { code: ExportErrorCode; ... };
```

**Tests baseline:**

- Existing tests in `<scope>`: <count>, status <must be green>.
- **If baseline is not fully green, this refactor cannot proceed safely.**
  Fix the baseline first, or characterize the existing red as out-of-scope.
- Test coverage on `<scope>`: <%>. Gaps will be filled via characterization
  tests in §5 before the refactor begins.

**Risks observed:**

- <coverage gap in module X — refactor will need characterization tests>
- <module Y is called via reflection / dynamic imports — usual search may miss callers>
- <test suite has flaky tests in this area — separate from refactor signal>

---

## 4. Refactor design

<!--
  For each affected file: what was, what will be. Show the structural
  transformation. The refactor is reviewable when the before/after is clear.
-->

### 4.1 Structural transformation

**Before:**

```
src/api/export-pdf.ts        // 300 lines: route handler, validation,
                             //   serialization, streaming, error mapping
src/api/export-pdf.test.ts   // 200 lines of tests
```

**After:**

```
src/api/exports/
  pdf-route.ts               // 50 lines: route handler only
  validation.ts              // 40 lines: shared validation
  pdf-stream.ts              // 100 lines: streaming + serialization
  errors.ts                  // 30 lines: error mapping
  pdf-route.test.ts          // 80 lines
  validation.test.ts         // 40 lines
  pdf-stream.test.ts         // 80 lines
```

Imports throughout the codebase are updated (see §6 — callers).

### 4.2 Per-file details

#### `src/api/exports/pdf-route.ts` (extracted)

**Purpose:** HTTP route entry point.

**Public surface:**

```<lang>
export function registerExportPdfRoute(app: App): void;
```

**Migration:** Lines 1-50 of the old `src/api/export-pdf.ts`, with imports rewired.

#### `src/api/exports/validation.ts` (extracted)

**Purpose:** Request validation, shared between PDF and (future) CSV.

**Public surface:**

```<lang>
export const ExportQuerySchema = z.object({...});
export function validateExportQuery(input: unknown): Result<ExportQuery, ValidationError>;
```

**Migration:** Lines 50-90 of the old file. Becomes reusable.

(...repeat for each extracted file...)

### 4.3 What's renamed

| Old name | New name | Why |
|---|---|---|
| `src/api/export-pdf.ts` | `src/api/exports/pdf-route.ts` | Module split |

### 4.4 What's deleted

- `src/api/export-pdf.ts` — superseded by the new file structure.

### 4.5 What stays identical

- Public function signatures (see §2 / §3 "Types & contracts").
- HTTP request/response contract.
- Log payloads and levels.

---

## 5. Proof of equivalence

<!--
  THIS IS THE MANDATORY SECTION FOR A REFACTOR SPEC. Without it, refactors are
  "harmless cleanups" that produce production incidents.

  Three parts: characterization tests (added before the refactor), existing tests
  (pass unchanged after the refactor), and behavioral diffing where useful.
-->

### 5.1 Characterization tests (added BEFORE refactoring)

For behaviors the existing tests don't cover, add characterization tests that
pin down current behavior. These tests must pass BEFORE the refactor starts —
they're the safety net.

| Test name | Level | File | What it pins down |
|---|---|---|---|
| `<test_name>` | unit | `<path>` | <existing behavior not currently tested> |
| ... | ... | ... | ... |

**Coverage gap analysis:**

- `<file/function>` had <X%> coverage → add tests to bring to <Y%>.
- `<file/function>` had <X%> coverage → ... (etc.)

**Process:**

1. Add characterization tests on a branch.
2. Confirm they pass on `main` (they pin existing behavior).
3. Land them as a separate commit, BEFORE any refactor change.

### 5.2 Existing tests pass — unchanged

The existing test suite is the primary equivalence proof. After the refactor:

- All existing tests **pass without modification** (only imports may need rewiring).
- Test file count may change (split / move), but test content does not.
- **No test deletions, no test rewrites, no assertion changes** are part of the
  refactor. If a test needs rewriting, it suggests behavior changed — STOP.

### 5.3 Behavioral diff (when applicable)

For high-stakes refactors (the externally-observable behavior is intricate), add
a behavior comparison that runs before and after:

- **Snapshot of HTTP responses** for a representative set of inputs, before and
  after. Diff must be empty.
- **Log capture** for the same request set. Diff must be empty (ignoring
  timestamps).
- **Metric emission** counts. Diff must be empty.

```bash
# Pre-refactor capture
git checkout main
./scripts/capture-responses.sh > before.json

# Post-refactor capture
git checkout refactor-branch
./scripts/capture-responses.sh > after.json

diff before.json after.json
# Must be empty (or only differ in timestamps / request IDs).
```

If a behavioral diff isn't applicable (small refactor, behavior trivially
preserved), say so explicitly. Don't skip silently.

---

## 6. Dependencies & ripples

**Dependencies:** typically "no changes" for a refactor. Confirm.

**Affected callers (import updates):**

| Caller | Old import | New import |
|---|---|---|
| `src/api/routes.ts:3` | `from './export-pdf'` | `from './exports/pdf-route'` |
| ... | ... | ... |

Search method: <e.g., `rg "from ['\"].*export-pdf"` — N matches>.

**Deleted / renamed exports:** <list — refactors often rename a lot internally>

**Side effects:** **NONE NEW.** A refactor that introduces new logs, metrics, or
IO is not a refactor.

**Migration plan:** **n/a** — refactor preserves data. If the refactor touches
persisted state (it shouldn't), revisit framing.

---

## 7. Reversibility

| Decision | Tag | Rationale | Kill criterion (🔴 only) |
|---|---|---|---|
| Split `export-pdf.ts` into 4 files | 🟡 | Reversible but requires re-merging files; meaningful work | — |
| Move under `src/api/exports/` directory | 🟢 | Re-namespacing is mechanical | — |

<!--
  Refactors are often 🟡: trivially undoable in theory, costly in practice.
  Rarely 🔴 unless the refactor crosses a public package boundary.
-->

---

## 8. Smell-check

<!--
  Refactor-specific smell-check:
  - Is this actually a refactor (behavior preserved) or a refactor-disguised-as-fix?
  - Is the new shape demonstrably better, or just different?
  - Will the new shape be obviously wrong six months from now (architectural taste check)?
  - Is the scope tight, or did "while I'm here" creep in?
-->

<paragraph>

---

## 9. Flagged assumptions

- ASSUMES: full test coverage of external behavior exists or has been added via §5.1.
  If a behavior surfaces during refactor that has no test, stop and add the test
  before continuing.
- ASSUMES: no callers via reflection, dynamic imports, or external repos. If
  found, see ripples §6 — those callers must be updated too.
- ASSUMES: <other>

---

## 10. Handoff baton → coder

**Spec:** <path to this document>

**Outcome (one-liner):** <e.g., "Split `export-pdf.ts` into `src/api/exports/{pdf-route, validation, pdf-stream, errors}.ts` with all public behavior preserved.">

**First concrete action:**

1. Branch off `main`.
2. **Add characterization tests from §5.1.** Confirm all pass on `main`. Land
   this as a separate commit.
3. Only then begin the structural refactor in §4.

**Reconfirm before coding:**

- [ ] Existing tests in `<scope>` are fully green on current `main`.
- [ ] Coverage gaps identified in §5.1 are still present (not closed by recent work).
- [ ] No new external callers since exploration (re-run the caller search).

**Acceptance signal:**

1. Characterization tests from §5.1 pass on the refactor branch.
2. **Every existing test passes UNCHANGED** (no test edits except import rewiring).
3. `npm run typecheck` exits 0.
4. `npm run lint` exits 0.
5. Behavioral diff (if §5.3 applicable) shows zero diff.

**Stop conditions:**

- An existing test would need its assertions changed (signals behavior change — STOP).
- A behavior is found that has no test coverage (add a characterization test first; pause refactor).
- A caller is found that the spec didn't list (re-check ripples).
- Any 🔴 decision needs revisiting.

**Commit hygiene:**

- Suggested commit sequence:
  1. `test(api): characterization tests for export-pdf` (§5.1 tests only).
  2. `refactor(api): extract pdf-route from export-pdf` (one file split at a time).
  3. `refactor(api): extract validation from export-pdf`.
  4. `refactor(api): extract pdf-stream from export-pdf`.
  5. `refactor(api): rewire imports to new locations`.
  6. `refactor(api): delete old export-pdf.ts file`.
- Each commit must keep CI green (existing tests pass).
- After landing, write a progress note to `progress.md`.
- Pass to `project-git` for PR.

---

## Revision history

| Date | Version | Change | Author |
|---|---|---|---|
| <YYYY-MM-DD> | v1 | Initial draft | implementation-planner |

# Spec Anatomy

> *"Specs are reviewable contracts, not aspirations."* — Tenet 2

A coding spec has a fixed shape. Each section answers a specific question that, if left unanswered, would force the coder to make a load-bearing decision on the user's behalf. This reference is the canonical breakdown of those sections.

The full template lives at [`../assets/coding-spec.md`](../assets/coding-spec.md). Specialized variants for bugs and refactors live at `bugfix-spec.md` and `refactor-spec.md`. This file explains *why* each section exists and *how* to write it well.

---

## The ten sections

| # | Section | Required? | Answers the question… |
|---|---|---|---|
| 1 | Outcome | ✅ | "What behavior does this produce?" |
| 2 | Scope | ✅ | "What's in vs. out?" |
| 3 | Exploration notes | ✅ | "What did I read; what's the baseline?" |
| 4 | Design | ✅ | "What files, signatures, types?" |
| 5 | Test plan | ✅ | "What proves it works?" |
| 6 | Dependencies & ripples | ✅ | "What else changes?" |
| 7 | Reversibility | ✅ | "Two-way or one-way doors?" |
| 8 | Smell-check | ✅ | "Does this fight the codebase?" |
| 9 | Flagged assumptions | ✅ | "What must coder reconfirm?" |
| 10 | Handoff baton to coder | ✅ | "How does coder pick this up?" |

Every section appears in every spec — even if the answer is *"n/a — explicitly considered."* The absence of a section means *"I forgot."* The presence of a section saying *"n/a"* means *"I thought about it and there's nothing."*

---

## 1. Outcome

The behavior the spec produces, in **one to three sentences**, phrased so a reviewer can verify it after the work ships.

**Bad:** "Improve the login flow."
**Better:** "Users who submit invalid credentials see a friendlier error message instead of a generic 500."
**Best (EARS):** "WHEN the user submits a login with invalid credentials, the system shall return HTTP 401 with `{error: 'invalid_credentials', message: 'Email or password is incorrect'}`, and the existing audit log entry shall remain unchanged."

EARS (Easy Approach to Requirements Syntax) is optional but useful when you find yourself writing a vague outcome. Five patterns:

- **Ubiquitous:** *"The system shall <response>."*
- **Event-driven:** *"WHEN <trigger>, the system shall <response>."*
- **State-driven:** *"WHILE <state>, the system shall <response>."*
- **Optional:** *"WHERE <feature is included>, the system shall <response>."*
- **Unwanted-behavior:** *"IF <condition>, THEN the system shall <response>."*

Each pattern collapses to a single testable claim. If an outcome won't fit into EARS, it's probably a feature, not a behavior — break it into multiple outcomes.

---

## 2. Scope

Two subsections: **in scope** and **out of scope**. Both required.

**In scope** is what the spec covers. **Out of scope** is what it deliberately doesn't cover, especially things a reviewer might assume are included.

Out-of-scope is non-negotiable. Without it, the coder will scope-creep ("while I was here, I also fixed…") and the reviewer will scope-question ("did you also update X?"). State it explicitly:

```
**Out of scope:**
- Updating the password reset flow (separate slice).
- Changing the audit log format (would break downstream parser).
- Adding rate limiting (already exists upstream).
```

If you find an attractive related fix during specification, **list it as out of scope with a note** ("noticed: rate limiting is missing from the signup flow; not addressed here; recommend a separate slice"). This keeps the spec focused while still surfacing the observation.

---

## 3. Exploration notes

The **context capsule** from [`codebase-exploration.md`](codebase-exploration.md). Verbatim. Six parts: surface, affected files, conventions, types & contracts, tests, risks observed.

This section is what makes the spec **reproducible** by another engineer. If someone disagrees with the design, the exploration notes show what the design rested on, and where to push back. If exploration was wrong, the design needs updating, not arguing.

**Common mistake:** treating exploration notes as proof-of-work to skim past. They're the foundation. Without them, the spec is unverifiable.

---

## 4. Design

The body of the spec. For each affected file, a sub-section answering:

- **File:** path, and whether it's `new`, `modify`, `delete`, or `rename`.
- **Purpose:** one sentence on what this file does after the change.
- **Public surface:** exported functions, types, classes — with full signatures.
- **Key internals:** non-obvious helpers, state, or invariants.
- **Code sketch (optional):** a 5-20 line pseudocode block when the behavior is non-trivial. Don't write the full implementation; write enough that the coder can't misread the intent.

Example:

```markdown
### `src/api/export-csv.ts` (new)

**Purpose:** Stream a CSV export of the dashboard data, mirroring the PDF export's interface.

**Public surface:**
```ts
export async function exportCsv(
  query: ExportQuery,
  ctx: RequestContext
): Promise<Result<Readable, ExportError>>;
```

**Key internals:**
- Uses `streamPipeline` from `node:stream/promises` to handle backpressure.
- Logs each row count via `@/lib/logger` at debug level.
- Errors converted to `ExportError` with `code: ExportErrorCode.STREAM_FAILED` on stream errors,
  `code: ExportErrorCode.QUERY_FAILED` on upstream query errors.

**Code sketch:**
```ts
export async function exportCsv(query, ctx) {
  const stream = await openQuery(query, ctx);
  if (stream.isErr()) return Err(toExportError(stream.error));
  return Ok(stream.value.pipe(toCsvTransform()));
}
```

The code sketch is **a sketch, not the implementation**. It should compile in your head, not necessarily on disk.

---

## 5. Test plan

For every behavior the spec adds or changes, name the test. The test plan is a table:

| Test name | Level | Location | What it asserts |
|---|---|---|---|
| `exports csv with all columns` | unit | `src/api/export-csv.test.ts` | Happy path: full row dump, header row first |
| `streams large reports without buffering` | unit | same | Backpressure: piping yields control |
| `returns ExportError on query failure` | unit | same | Error mapping: query error → ExportError.QUERY_FAILED |
| `route serves CSV with correct headers` | integration | `tests/api/routes.test.ts` | `Content-Type: text/csv; charset=utf-8`, attachment disposition |

For each test, the **assertion** should be specific enough that a coder can write it without re-reading the spec. "Happy path" is not an assertion; "first row is header, second row is the first data record" is.

### Edge cases — list them explicitly

Even if you don't write a separate test per edge case, name them:

- Empty result set → CSV with header only, status 200.
- Unicode in cell values → wrapped in quotes; embedded quotes doubled.
- Query timeout → ExportError.QUERY_FAILED, status 503.
- Concurrent calls with same query → both succeed independently.

The point isn't to assert every edge case; it's to **make explicit which edges you considered and which you don't**. Unconsidered edges are bugs waiting.

See [`test-strategy.md`](test-strategy.md) for level selection and TDD.

---

## 6. Dependencies & ripples

Four sub-sections:

**Dependencies:** added, removed, version-bumped. Each with reasoning.

```
- Adds: csv-stringify@^6.4.0 (BSD-3 licensed; ~50KB; the existing serializer in
  @/lib/serialize can't stream).
- Removes: none.
- Bumps: none.
```

**Affected callers:** who calls the modified functions/types. Names + paths.

```
- src/api/routes.ts registers the new /export/csv route.
- src/dashboard/export-button.tsx will eventually call this; the button is
  out-of-scope for this slice (next slice).
```

**Deleted/renamed exports:** if anything goes away or moves.

```
- None this slice.
```

**Side effects:** new IO, new logs, new env vars, new metrics, new background jobs.

```
- New logs at debug level via @/lib/logger ("export.csv.row_count").
- No new env vars.
- No metrics (export volume is logged but not metered; out of scope).
```

**Migration steps:** required for schema, config, or data-layout changes.

```
- None this slice.
```

When all four sub-sections come back "none", you probably under-explored. Re-check.

See [`dependencies-and-ripples.md`](dependencies-and-ripples.md).

---

## 7. Reversibility

A table of significant decisions, each tagged 🟢 (two-way) / 🟡 (costly) / 🔴 (one-way).

| Decision | Tag | Rationale | Kill criterion (🔴 only) |
|---|---|---|---|
| Add csv-stringify dep | 🟡 | Removing later requires switching all CSV callers | — |
| New /export/csv route | 🟢 | Trivial to remove if unused | — |
| ExportError.QUERY_FAILED enum value | 🔴 | Once shipped, downstream consumers may switch on it | If any downstream consumer can't handle the new code by D+7, revert and use STREAM_FAILED |

🔴 decisions require a **kill criterion** — under what evidence would we revert before committing further. Without it, the 🔴 tag is decorative.

See [`reversibility-for-code.md`](reversibility-for-code.md).

---

## 8. Smell-check

One paragraph. Required.

- Does this approach fight the codebase? (If yes, name what doesn't fit and why we're proceeding anyway, or what to change.)
- Is there a smaller alternative? (If yes, why was it rejected?)
- Is this re-implementing something that exists? (If you found a close-enough utility, name it and explain why it doesn't fit.)
- Is the user asking the right question? (If you think they're solving a symptom, say so — even if you still spec the original ask.)

Example:

> Smell-check: approach mirrors `export-pdf.ts` exactly, which is the established pattern. Smaller alternative considered (synchronous CSV dump via the existing serializer) — rejected because the PDF export already faced backpressure issues for large reports (see TODO in export-pdf.ts) and we'd hit the same. Considered re-using `@/lib/serialize`'s array-to-CSV helper — it doesn't stream, so we'd inherit the same bug. Slight concern: the route handler will have two near-identical entries (pdf and csv); recommend a follow-up slice to extract a shared "stream export response" helper once we have three exports.

A skipped smell-check is the most common cause of "we built the wrong thing." Always run it. Always write it down.

See [`smell-check.md`](smell-check.md).

---

## 9. Flagged assumptions

What the coder must reconfirm during implementation. Each line answers: *what would change if this assumption is wrong?*

```
- ASSUMES: ExportError has a STREAM_FAILED variant already. If absent, coder adds it
  to src/api/types.ts; flag if doing so breaks any consumer switch statement.
- ASSUMES: streamPipeline is the streaming util in use. Confirmed by reading
  export-pdf.ts. If a newer pattern exists, coder pauses and surfaces.
- ASSUMES: the dashboard button slice is separately planned. If this slice will be
  reviewed as "no UI", note that in the PR description.
```

These are explicit hand-offs of *known unknowns*, not implementation details. If everything is "confirmed," the section says "no flagged assumptions" — but verify that the exploration was deep enough to support that claim.

See [`handoff-to-coder.md`](handoff-to-coder.md) for how flagged assumptions flow into the baton.

---

## 10. Handoff baton to coder

The structured pickup contract. Format:

```
## Handoff baton → coder

**Spec:** [path to this document, or inline reference]
**First concrete action:** Confirm ExportError.STREAM_FAILED exists; if not, add it before any other change.
**Reconfirm these assumptions:** [list from §9]
**Acceptance signal:**
  - All listed tests pass.
  - `npm run typecheck` clean.
  - `npm run lint` clean.
  - Manual: hitting /export/csv with a sample query returns a CSV file with the expected columns.
**Stop conditions (return to tech-lead):**
  - Conventions discovered during coding don't match the spec.
  - Any 🔴 decision needs revisiting.
  - Test plan reveals a gap mid-implementation.
**Commit hygiene:** small commits — one per file at most; conventional commit prefix `feat(api):`.
```

See [`handoff-to-coder.md`](handoff-to-coder.md) for the full contract.

---

## Sizing — what spec weight matches the change

A spec's length should track the change's complexity, not your enthusiasm.

| Change | Spec weight | Typical line count |
|---|---|---|
| Typo, rename, single-line fix | One-liner inside a baton; no separate doc | 5-15 lines |
| Small new function in an existing module | Mini-spec; some sections "n/a" | 50-100 lines |
| New module or significant change | Full spec, all sections substantive | 150-300 lines |
| Cross-cutting refactor | Full spec + extra equivalence-proof section | 300-600 lines |
| Multi-slice initiative | Don't write one spec; go back to implementation-planner | — |

**Right-sizing test:** is the spec longer than the eventual diff will be? If yes, the spec is over-engineered OR the diff is bigger than you think. Either is worth knowing.

---

## Anti-patterns

- **Spec without exploration notes.** The spec is unverifiable; you might as well have written it from memory.
- **Vague test names.** "Tests the happy path" doesn't constrain anything. Name the assertion.
- **Skipping the smell-check.** This is where bad specs become obvious. Don't skip it because the design "feels right."
- **All sections present, all sections shallow.** A two-bullet design section under "n/a — exploration covered it" is theater. Either it deserves content or it doesn't belong.
- **Reversibility tags without kill criteria on 🔴.** A 🔴 without a kill criterion is decorative.
- **Flagged assumptions that are actually decisions.** "ASSUMES: we don't need rate limiting" is a decision; put it in scope or out of scope, not in assumptions.
- **Handoff baton as a vibes paragraph.** "Just code this up and you're good" is not a baton. Structured fields, every time.

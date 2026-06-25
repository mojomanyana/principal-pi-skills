# Dependencies & Ripple Effects

> *"Ripples are decisions, not implementation details."* — Tenet 7

Most "harmless changes" turn into outages because of ripple effects nobody mapped. A new field "everyone agreed" was additive turns out to break the legacy parser; a "drop-in" library replacement turns out to call the dependency a different way; a "fast" config tweak turns out to invalidate a cache nobody documented.

This reference describes how to surface the four classes of ripple — dependencies, callers, breakage, side effects — in the spec.

---

## 1. The four ripple classes

| Class | What it covers | Why it matters |
|---|---|---|
| **Dependencies** | Added / removed / version-bumped packages | License, security, install size, transitive risk |
| **Callers** | Who imports or invokes the modified code | Signature changes cascade; missed callers fail in production |
| **Breakage** | Renamed/deleted/restructured exports, contract changes | Downstream breaks by name; semver implications |
| **Side effects** | New IO, logs, env vars, metrics, jobs, schema | Hidden in code; visible in incidents |

Every spec answers all four, even if some are "none." Silence on a class is a guess, not an answer.

---

## 2. Dependencies

### What to capture

```markdown
**Dependencies — changes:**

- **Add:** csv-stringify@^6.4.0
  - License: BSD-3-Clause (compatible with project license MIT)
  - Install size: ~50 KB (acceptable; we're already shipping `@/lib/serialize` at 200 KB)
  - Maintenance: last release 2025-11, active maintainers
  - Why not the existing serializer: doesn't stream; would hit the same backpressure
    bug that export-pdf flagged
- **Remove:** none
- **Version bump:** none
```

### Questions to answer

- **License compatibility.** Especially for code that ships to customers. If you don't know the project's license, look it up before specifying.
- **Maintenance signal.** Last commit, last release, open critical issues. A 2017-stale package with one maintainer is a 🔴 reversibility decision in disguise.
- **Transitive cost.** Does this pull in 200 transitive deps? If so, surface it. Use `npm ls`, `pip-tree`, `cargo tree`, `go mod graph` to inspect.
- **Why not an existing dep / utility.** If the codebase has a similar utility (string formatter, retry helper, validation lib), name it and explain why it doesn't fit. Adding a duplicate is a smell.

### When the dependency is internal

Internal package additions deserve the same scrutiny — sometimes more. "Use the new `@org/auth-lib`" should answer: who maintains it, what's the API stability promise, what version does the rest of the codebase use, does it work with this codebase's runtime.

---

## 3. Callers

### Find them all

Before specifying a signature change, list every caller. Use:

```bash
# By symbol name
rg "exportPdf\b" --type=ts -l
rg "from ['\"].*export-pdf" --type=ts -l

# By module path
rg "from ['\"]@/api/export-pdf" -l

# By language-specific tooling (more accurate)
ast-grep --pattern '$_.exportPdf($$$)' --lang ts -l   # method calls
# LSP "find references" if available
```

Triangulate. Two different searches catch what one misses. Cross-language codebases need additional tooling (greps that span multiple languages, or LSPs per language).

### Group callers by category

```markdown
**Callers of `exportPdf`:**

| Caller | Category | Impact of new `exportCsv` analogue |
|---|---|---|
| `src/api/routes.ts:42` | Route registration | Will need a parallel registration for `/export/csv` |
| `src/dashboard/export-button.tsx:18` | UI button | Out of scope (next slice will add CSV button) |
| `tests/api/export-pdf.test.ts` | Test | No impact (test of pdf, not csv) |

**No additional callers found by `rg "exportPdf"` or `ast-grep '$_.exportPdf($$$)'`.**

**Signature change risk:** None for this slice — `exportCsv` is new, no rename / shape
change to the existing `exportPdf` interface.
```

The negative finding ("no additional callers") is as important as the positive list. State the search method so a reviewer can validate.

### Signature changes — extra discipline

If the spec changes a public signature, list **every** caller and how it must adapt. Group them:

- **Mechanical update** (same call, new arg): list as "N callers; each needs `extraArg: defaultValue` appended."
- **Semantic update** (call behavior changed): list each individually with the required change.
- **Caller deprecation** (caller goes away): list each and the timeline.

If even one signature change has more than ~10 callers, **flag it for the implementation-planner** — the slice might be too big and need decomposition (e.g., add a new function alongside, migrate callers one by one, remove the old function later).

---

## 4. Breakage

Breakage = anything that breaks downstream **by name** (not by behavior). The four common kinds:

### Renames

```markdown
**Renames:**
- `exportPdf` → `exportToPdf` — 3 callers updated; no re-export shim added because
  this is an internal symbol. (If it were exported from a package boundary, a
  deprecation shim would be required for one release cycle.)
```

### Deletions

```markdown
**Deletions:**
- `src/api/legacy-export.ts` (deprecated since v2.1; zero references found via rg)
  — delete with this slice. Coder confirms zero references before deletion.
```

The "coder confirms before deletion" pattern is a safety net — searches can miss dynamic imports, reflection, runtime string-keyed access. The coder should re-verify.

### Type / contract changes

```markdown
**Type / contract changes:**
- `ExportError` gets a new variant `STREAM_FAILED`. Existing callers' exhaustive
  switch statements will receive a type error and must add a case. Tests included:
  `src/dashboard/__tests__/export-error-handler.test.ts` already has an
  exhaustive switch; coder updates it to handle the new variant.
```

### Public API / package surface

```markdown
**Public surface:**
- This slice does NOT touch the package's public export list (no changes to
  `index.ts` or to documentation). Internal-only change.
```

If the codebase has explicit semver discipline, **state the version impact**: patch / minor / major. A breaking change without a major bump is a self-inflicted incident.

---

## 5. Side effects

Side effects are the most-missed ripple. The spec must enumerate:

### New IO

- File reads/writes — where, how often, what permissions?
- Network calls — to whom, with what timeout, retries, idempotency?
- Database queries — read or write, what indexes, what locking?

```markdown
**New IO:**
- Reads from the existing dashboard query path (no new DB queries; same query
  as the PDF export).
- Writes to response stream (HTTP); no disk writes.
- No new outbound network calls.
```

### New logs

```markdown
**New logs:**
- `export.csv.start` (info) — query summary, user ID
- `export.csv.row_count` (debug) — row count at completion
- `export.csv.error` (error) — on failure, with `cause` chained
```

Logs are part of the contract for operators. Specifying them means they get a code review, not a runtime surprise.

### New env vars / config

```markdown
**New env vars / config:**
- None. (CSV export uses the same query timeout config as PDF export:
  `EXPORT_QUERY_TIMEOUT_MS`.)
```

If new config is added, the spec includes default value, documentation entry, and the migration story for environments that don't have it set yet.

### New metrics

```markdown
**New metrics:**
- `export_csv_requests_total{status}` (counter)
- `export_csv_duration_seconds` (histogram, with `le` buckets matching pdf export)

Confirmed naming aligns with existing `export_pdf_*` metrics. Dashboard panel
update is out of scope (separate observability slice).
```

### New background jobs / cron / queues

```markdown
**New background jobs:**
- None.
```

### Schema / data layout changes

```markdown
**Schema changes:**
- None.
```

When this section is non-empty, it's almost always a 🔴 reversibility decision needing a migration plan. See [`reversibility-for-code.md`](reversibility-for-code.md).

---

## 6. Migration steps

If schema, config, or data layout changes, the spec includes the migration plan. Standard shape:

```markdown
**Migration plan:**

1. **Forward (additive only):** Add new column `users.csv_export_enabled boolean
   default true not null`. Ship migration file
   `migrations/20260512_add_csv_export_flag.sql`.
2. **Deploy code that reads but does not require the column.** The new code
   tolerates `null` and old default values (defensive read).
3. **Backfill** existing rows to `true` (no-op if default takes effect at insert).
4. **Verify** via metric `users_with_csv_flag_total` matching expected count.
5. **No reverse migration step needed** for this slice (additive, default true).

**Rollback:** Drop the column. Coder includes the down migration but it's not
expected to run.
```

Migrations are a 🔴 decision. They get a kill criterion ("if more than X errors in 1 hour after rollout, hold the deploy and investigate before forward-fix").

---

## 7. Worked example — a small but ripple-heavy change

> Request: "Rename the `User.fullName` field to `User.displayName`."

```markdown
**Dependencies:** No external changes.

**Callers:**
- `User.fullName` is referenced in 47 places (rg "\.fullName\b" found 47 matches
  across .ts/.tsx files; ast-grep "User.fullName" found 47 matches).
- Used in: 12 components, 8 API handlers, 3 serializers, 15 tests, 5 docs files,
  4 migration scripts.

**Breakage:**
- 🔴 Renaming the type field breaks every caller. This slice CANNOT be
  signature-rename only — must include an alias/deprecation period.
- Proposed: add `displayName` as an alias getter (returns `fullName`) for one
  release cycle, then migrate callers, then drop `fullName`. THREE SLICES, not one.

**Recommendation:** Refer back to implementation-planner. This is too large for
one slice. Suggested decomposition:
  1. Add `displayName` alias to type; existing `fullName` unchanged. (🟢)
  2. Migrate all callers from `fullName` to `displayName` over N slices. (🟢
     each, 🟡 collectively if you stop midway)
  3. Remove `fullName` (🔴, deprecation period needed).

**Side effects:**
- API responses currently expose `fullName` in JSON. Changing the wire shape is
  another 🔴 — needs versioned endpoint or compatibility shim.

**Migration plan:** see above (three-slice decomposition); deferred to planner.
```

This is the kind of ripple analysis that turns a "quick rename" into "this is a multi-slice migration with backward-compatibility steps." Surfacing it in the spec is the difference between a useful implementation-planner and a rubber stamp.

---

## 8. Anti-patterns

- **"No ripples."** Almost never true. Default to suspicion; verify by reading.
- **Listing callers without categorizing them.** A list of 30 paths with no grouping is hard to review.
- **Adding a dep without justifying it against existing utils.** Duplicate utilities are a smell.
- **Skipping the side-effects section.** New logs / env vars / metrics are easy to forget. They get found in production.
- **Assuming "additive == safe."** Additive schema changes can still break replicas, ORMs, or legacy parsers. Always migration-plan.
- **One catch-all "and there might be other places."** Be specific. If you can't be specific, search more.
- **Renaming as a one-slice change.** Renames in large codebases are almost always multi-slice.

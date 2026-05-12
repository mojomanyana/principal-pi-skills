# Convention Matching

> *"Match the codebase, not your preferences."* — Tenet 4

The spec (when present) may name the conventions to follow. The coder applies them at the point of writing. This reference is about the *execution* of convention-matching, complementing tech-lead's `convention-discovery.md` (which is about discovery before specification).

A coder who silently introduces "better" patterns produces code reviewers will reject. The codebase is the authority. The conventions are constraints, not suggestions.

---

## 1. Where conventions come from (priority order)

When in doubt, follow this order:

1. **Explicit project rules** — project convention files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `CONTRIBUTING.md`). If a rule exists, it wins.
2. **Formatter / linter config** — `.prettierrc`, `.eslintrc`, `ruff.toml`, `gofmt`. Tooling-enforced rules are non-negotiable.
3. **The spec** — what tech-lead's exploration captured.
4. **The nearest neighbor file** — proximity wins ties; the file 3 directories away matters less than the sibling.
5. **The newer convention** — if generations of code disagree, follow the newer pattern (it's where the codebase is heading).

When all five are silent, **mirror the closest example** and **state the choice in the implementation report** so a reviewer can correct.

---

## 2. The seven domains, at write-time

For each domain, the question is "what's the convention here?" — answered at the point you're writing the code.

### 1. Naming

- Function name: case, verb-noun order, length.
- Type name: case, prefix/suffix (e.g., `IFoo` interface prefix, `FooT` suffix).
- Variable name: case, abbreviation policy.
- File name: case, separator (kebab vs. snake vs. dot).

**Probe at write-time:** look at one sibling function in the same file or directory. Mirror.

### 2. Imports

- Path alias (`@/lib/foo`) vs. relative (`../lib/foo`)?
- Grouping (external, internal, types)?
- Sort order (alphabetical, by import length, by group)?

**Probe at write-time:** look at imports in the file you're modifying. Mirror exactly.

### 3. Error handling

- `Result<T, E>` / `Either` returns?
- Thrown exceptions, typed or untyped?
- Error-as-value with `(value, err)` tuples?
- Specific error class hierarchy?
- Wrapping policy (cause-chain or replace)?

**Probe at write-time:** how does the nearest sibling function handle a known-failure case? Mirror.

### 4. Tests

- Framework (vitest, jest, pytest, junit, go test, cargo test).
- File location (colocated, separate `tests/` directory).
- Test name style (`it 'should do X'`, `test_does_x`, `should_do_x`).
- Mock library and discipline.
- Setup/teardown style.

**Probe at write-time:** open the nearest test file. Mirror its structure exactly.

### 5. Types

- Strictness level (any allowed? optional null checks? exhaustive switches?).
- Explicit return types on exports.
- Private vs. public marking style (underscore prefix, `_` prefix, explicit access modifier).
- Generic parameter naming.

**Probe at write-time:** check the file's existing types. Match.

### 6. Logging

- Library (`@/lib/logger`, `pino`, `winston`, `logging.getLogger`, etc.).
- Structured (key-value) or unstructured (formatted string)?
- Level conventions (what counts as `info` vs. `debug`?).
- Correlation ID threading.

**Probe at write-time:** find one log call in a nearby file. Match its shape.

### 7. Comments / docs

- Doc comment style (JSDoc, docstring, godoc).
- When is a doc comment required (exported only? complex internals?).
- Style of inline comments (sparse, descriptive, sectional).

**Probe at write-time:** look at one exported function's doc style. Match.

---

## 3. The "mirror the nearest neighbor" technique

When a convention is ambiguous or the spec didn't capture it, the fastest correct answer is:

```
1. Open the nearest neighbor file (same directory, same purpose).
2. Read 10-20 lines.
3. Copy the patterns you see — naming, imports, error handling, doc style.
4. Adapt the content; preserve the shape.
```

This is **not** copy-paste programming. It's stylistic mirroring. The patterns transfer; the logic is your own.

**Worked example:**

You're adding `exportCsv` in a new file. The spec says "mirror the shape of `exportPdf`." You open `src/api/export-pdf.ts`:

```ts
import { pipeline as streamPipeline } from "node:stream/promises";
import { Ok, Err, type Result } from "@/lib/result";
import { logger } from "@/lib/logger";
import type { ExportQuery, RequestContext, ExportError } from "./types";

/**
 * Stream a PDF export of dashboard data.
 *
 * @param query - the export query
 * @param ctx - request context (user, request ID)
 * @returns a Readable on success, ExportError on failure
 */
export async function exportPdf(
  query: ExportQuery,
  ctx: RequestContext,
): Promise<Result<Readable, ExportError>> {
  logger.info({ msg: "export.pdf.start", queryId: query.id, userId: ctx.userId });
  // ... implementation
}
```

You write `exportCsv` with the **same** imports, **same** doc comment style, **same** logger pattern, **same** Result shape:

```ts
import { pipeline as streamPipeline } from "node:stream/promises";
import { Ok, Err, type Result } from "@/lib/result";
import { logger } from "@/lib/logger";
import type { ExportQuery, RequestContext, ExportError } from "./types";

/**
 * Stream a CSV export of dashboard data.
 *
 * @param query - the export query
 * @param ctx - request context (user, request ID)
 * @returns a Readable on success, ExportError on failure
 */
export async function exportCsv(
  query: ExportQuery,
  ctx: RequestContext,
): Promise<Result<Readable, ExportError>> {
  logger.info({ msg: "export.csv.start", queryId: query.id, userId: ctx.userId });
  // ... implementation
}
```

Notice: same JSDoc shape, same parameter naming, same logger field structure, same return type. The CSV file looks like it belongs in the codebase because it mirrors a sibling that does.

---

## 4. When mirroring conflicts with the spec

Sometimes the spec specifies one pattern and the nearest neighbor uses another. Resolution order:

1. **The spec wins** if it explicitly says "use X." (Tech-lead made a decision; honor it.)
2. **The convention wins** if the spec is silent and the convention is consistent across 3+ files.
3. **Surface the conflict** if the spec is silent but the conventions are inconsistent. Don't pick silently — flag it.

```
Implementation note: spec was silent on logger usage. Two patterns found:
- src/api/export-pdf.ts uses structured logger.info({ msg, ...fields })
- src/api/legacy-export.ts uses logger.info('message: ' + value)
Chose the structured pattern (matches export-pdf, the newer code). Flagged
for tech-lead awareness; replace if wrong.
```

---

## 5. When you must deviate from convention

Rare but real cases:

- A genuine technical limitation prevents using the convention (e.g., the convention uses a sync API; the new code path is async and the sync API doesn't have an async variant).
- The convention is being **migrated**, and the spec explicitly puts this code on the new side of the migration.
- The convention has a known-bug and the spec works around it.

In all cases:

- **Justify in a comment** at the deviation point. Don't make a future reader hunt.
- **Flag in the implementation report.** So the reviewer doesn't have to spot it.

```ts
// Note: this file uses callback-style errors rather than the project's
// Result<T, E> convention. Reason: this is the boundary with a vendor SDK
// that requires Node-style callbacks. The Result wrapper happens at the
// `exportCsv` entry point; internals are callback-style by necessity.
```

Honest deviation is fine. Silent deviation is not.

---

## 6. The lint / format gate

Before any commit, run the formatter and linter on your changes:

```bash
# Examples
npm run lint -- src/api/export-csv.ts src/api/routes.ts
npm run format -- src/api/export-csv.ts src/api/routes.ts
# or
ruff check src/api/export_csv.py
ruff format src/api/export_csv.py
# or
gofmt -w internal/api/export_csv.go
golangci-lint run ./internal/api/...
```

**Lint errors are not opinions.** Fix them all. Even warnings, if CI fails on warnings.

If a lint rule is unambiguously wrong for your code (rare), disable it locally with a justifying comment:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendor SDK
//   uses `any` in its type definitions; widening here would lose precision
const result = (sdk.callback as any)(...);
```

Don't disable lint rules silently.

---

## 7. Anti-patterns

- **"I prefer this style."** Irrelevant. The codebase's style wins.
- **Mixing conventions in one file.** The file you're editing is one convention; honor it. Don't introduce a second style in the same file.
- **Ignoring project convention files.** `AGENTS.md`, `CLAUDE.md`, `.cursorrules` — these are contracts the user wrote. Honor them.
- **Disabling lint rules to make a commit go through.** A disabled rule is a deviation; justify or fix.
- **Mirroring shape without understanding intent.** If you copy a pattern and break its semantics, the mirror is decoration. Understand why the pattern exists before mirroring.
- **Importing in a non-conventional way "because my editor sorted them".** Editor settings shouldn't override codebase conventions. Configure the editor to match.
- **Stating "match the codebase" in the report without specifying which conventions you matched.** Be concrete.

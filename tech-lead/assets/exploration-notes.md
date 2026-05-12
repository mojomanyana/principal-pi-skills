# Exploration Notes — `<task or slice name>`

<!--
  This is a SCRATCHPAD used during the exploration phase, BEFORE drafting
  the spec. Fill it in as you read. Most of its content will be lifted into
  the spec's §3 (Exploration notes) when you write the spec proper.

  This file is a working document; it doesn't need to be polished. Speed,
  not prose. Notes are accepted; arrows are accepted; question marks are
  acceptable.

  Keep it short: ~50-100 lines for a normal slice. If it's longer than the
  eventual spec, you over-explored. If shorter than ~15 lines, you under-explored.
-->

**Task / slice:** <one-line description>
**Date:** <YYYY-MM-DD>
**Author:** tech-lead

---

## 1. Surface

<!-- 60 seconds. Quick map. -->

- Repo root: `<path>` (or "the only thing in this session")
- Language(s): <e.g., TypeScript 5.3, Python 3.12>
- Build / package manager: <e.g., pnpm workspaces, uv, cargo>
- Top-level entry points: <e.g., `src/api/server.ts`, `cmd/server/main.go`>
- Conventions doc(s) present? <AGENTS.md / CLAUDE.md / .cursorrules / CONTRIBUTING.md — list and READ them>
- Test runner: <e.g., vitest, pytest, go test>
- Lint / format: <e.g., eslint + prettier, ruff, gofmt>

---

## 2. Locate

<!-- What did you grep / fd / ast-grep for? What turned up? -->

**Searches run:**

```bash
rg <query>             # <result summary>
fd <pattern>           # <result summary>
ast-grep <pattern>     # <result summary>
git log <path>         # <interesting recent commits>
```

**Files candidate for "affected by this slice":**

- `<path>` — <why relevant>
- `<path>` — <why relevant>
- `<path>` — <why relevant>

**Files candidate for "callers / tests of the above":**

- `<path>`
- `<path>`

---

## 3. Read

<!-- Notes from actually reading the files. Quotes, line numbers, surprises. -->

### `<path/to/file.ts>`

- <line N>: <interesting thing — `function foo(...)` shape, or a TODO, or a guard clause>
- <line N>: <surprising pattern>
- <line N>: <thing the spec must respect>

### `<path/to/test-file.ts>`

- Pattern: <vitest with vi.mock at top, beforeEach reset, etc.>
- Naming: <`describes 'Foo'`, `it 'does X when Y'`>
- One test that's most representative: `<test name>` at line N

### `<path/to/file.ts>` (caller)

- Calls `<symbol>` at line N as `<call shape>`
- Expects: <return shape, error shape, side effect>

---

## 4. Conventions discovered

| Domain | Convention | Where I saw it |
|---|---|---|
| Naming | <e.g., camelCase fns, PascalCase types> | <file A, file B> |
| Errors | <e.g., `Result<T, E>` from `@/lib/result`> | <files> |
| Tests | <framework, layout, mocking style> | <files> |
| Types | <e.g., tsconfig strict + noUncheckedIndexedAccess> | <tsconfig path> |
| Imports | <e.g., `@/` alias, no relative across modules> | <tsconfig + files> |
| Logging | <library, structured / unstructured> | <files> |
| Validation | <library or manual> | <files> |
| Formatter | <enforced in CI?> | <config> |

**Conflicts / inconsistencies noted:**

- <e.g., "older `src/legacy/` uses console.log; newer `src/api/` uses `@/lib/logger`. New slice should use logger.">

---

## 5. Types & contracts

<!-- The types/signatures the spec will rest on. Paste them verbatim or close. -->

```<lang>
// From <file:line>
export type ExportError = {
  code: ExportErrorCode;
  cause?: Error;
  meta?: Record<string, unknown>;
};

// From <file:line>
export async function exportPdf(
  query: ExportQuery,
  ctx: RequestContext,
): Promise<Result<Readable, ExportError>>;
```

---

## 6. Baseline tests

```bash
# Command used
<test command>

# Result
<pass / fail summary>
```

- Existing tests in scope: <count>, status: <green | partial | red>
- If not green: <what's failing, is it relevant to this slice>
- Coverage (if measured): <%>

---

## 7. Risks / TODOs / surprises noted

<!-- Anything that might constrain the design or warrant a follow-up. -->

- <e.g., `// TODO: handle large reports — streaming?` at `export-pdf.ts:42`>
- <e.g., recent commit `abc123` changed the error shape; relevant>
- <e.g., a flaky test in adjacent area; not relevant to this slice but flagged>
- <e.g., an undocumented invariant: `query.from <= query.to`>

---

## 8. Open questions

<!--
  Things I'm not sure about after reading. Some go into "flagged assumptions"
  in the spec; some I should resolve before specifying (ask the user, or read more).
-->

- <question> — <how to resolve: read X, ask user, deferrable to coder>
- <question> — <how to resolve>

---

## 9. Smell-check pre-mortem

<!-- Quick gut-check BEFORE drafting the spec. Will I have to fight the codebase? -->

- Does the obvious approach fit? <yes / no / partial>
- Is there an existing utility I should re-use? <yes (name it) / no (searched)>
- Is the user asking for the right thing? <yes / suspect symptom>
- Is this one slice or should planner re-slice? <fits one / suggest decompose>

---

## 10. Spec readiness

When all of these are checked, you have enough to draft the spec:

- [ ] I've read the affected files, their nearest callers, and the nearest tests.
- [ ] I've run the baseline tests and noted the result.
- [ ] I have at least seven of the convention domains (§4) filled in.
- [ ] I know the types/signatures that constrain the design (§5).
- [ ] I've noted the open questions (§8) and decided which need user input.
- [ ] I have a gut answer to the smell-check (§9).

If any are unchecked, finish exploration before specifying. **Specs built on
incomplete exploration are the most common cause of "the spec was wrong."**

# Convention Discovery

> *"Match the codebase's conventions, not your favorites."* — Tenet 3

A spec that contradicts the codebase's conventions is a spec that produces code reviewers will reject. This reference describes how to extract conventions efficiently and reliably, and how to encode them in the spec.

A convention is **only** a convention if you observed it in **two or more files**. One example is an outlier; two is a pattern. Three is law.

---

## 1. The seven convention domains

Every spec touches some subset of these seven domains. For each, you need to know what the codebase does — not what the language idiom is, not what your training data says, but what *this codebase* does.

### 1. Naming

- **Case:** `camelCase`, `snake_case`, `PascalCase`, `kebab-case` — for functions, types, variables, files, constants.
- **Conventions for boolean names:** `isActive` / `hasItems` / `shouldRetry`? Or `active` / `items_exist` / `retry`?
- **Conventions for verb-noun:** `getUser` / `fetchUser` / `find_user` / `user.get()`?
- **Acronyms:** `parseURL` or `parseUrl`? `HTTP_PORT` or `HttpPort`?

### 2. Error handling

- **Mechanism:** thrown exceptions, returned `Result`/`Either`, error-as-value `(value, err)`, callbacks with `err` first?
- **Granularity:** typed error enums, error subclasses, sentinel error values, or strings?
- **Boundary policy:** errors caught at module boundaries, propagated, or logged-and-swallowed?
- **Wrapping:** does the codebase wrap errors with context (`errors.Wrap`, `causedBy`) or rethrow bare?

### 3. Testing

- **Framework:** jest, vitest, pytest, junit, gotestsum, cargo test, etc.
- **Layout:** colocated (`foo.test.ts` next to `foo.ts`) or separated (`tests/` directory)?
- **Naming:** `describes` and `it`, `test_*`, `should_*`?
- **Mocking discipline:** mock at module boundaries, dependency injection, real-but-fake (testcontainers, in-memory DB)?
- **Coverage rule:** if there's a coverage threshold in CI, what is it? Honor it.

### 4. Types & contracts

- **Strictness:** strict null checks? `noImplicitAny`? `python -W strict`? Are types optional, mandatory, or somewhere in between?
- **Public surface marking:** explicit `export`? `__all__`? naming convention (leading underscore for private)?
- **Generics / type parameters style:** verbose (`<TInput, TOutput>`) or short (`<I, O>`)?
- **Validation library:** zod, valibot, pydantic, ajv, manual checks?

### 5. Module structure

- **Imports:** alias paths (`@/lib/result`) vs. relative (`../../lib/result`)?
- **Index files:** barrel exports (`index.ts` re-exports) or direct imports?
- **Layering:** layered (`api/` → `service/` → `repo/`) or feature-sliced (`features/auth/{ api, service, repo }`)?
- **Cyclical dependencies:** tolerated, enforced-against, or invisibly present?

### 6. Logging, metrics, observability

- **Logger:** `console`, `pino`, `winston`, `logging.getLogger`, structured vs. plain?
- **Level discipline:** `debug` for chatty, `info` for events, `warn` for surprising-but-recoverable, `error` for needs-attention?
- **Correlation IDs:** present? required? injected via context, middleware, or threading?
- **Metrics:** which library? what naming convention? (`http_requests_total` vs. `http.requests`?)

### 7. Formatting & lint

- **Formatter:** prettier, black, gofmt, rustfmt, ktlint — present? auto-runs? what config?
- **Lint rules:** eslint, ruff, golangci-lint — what rule set? what's disabled?
- **CI gates:** does CI fail on formatter/linter? On warnings, or only errors?

---

## 2. Extraction techniques

### Read the config files first

```bash
# Formatter / linter
cat .prettierrc* .eslintrc* eslint.config.* 2>/dev/null
cat pyproject.toml ruff.toml .ruff.toml 2>/dev/null
cat .editorconfig 2>/dev/null
cat tsconfig.json 2>/dev/null

# Test config
cat vitest.config.* jest.config.* pyproject.toml pytest.ini 2>/dev/null

# Project conventions docs — read these first if present
cat AGENTS.md CLAUDE.md CONTRIBUTING.md .cursorrules 2>/dev/null  # project convention files
```

These files often **declare** the conventions outright. If `tsconfig.json` has `"strict": true`, that's a hard constraint, not a guideline.

### Sample three random files

For each domain you're uncertain about, sample three different files from different parts of the codebase. Look for the convention; if all three agree, it's a convention.

```bash
# Three random TypeScript files (cross-section, not adjacent)
ls src/api/*.ts src/lib/*.ts src/dashboard/*.tsx | shuf -n 3 | xargs -I{} sh -c 'echo "--- {} ---"; head -30 {}'
```

Look at imports, function signatures, error handling, naming. Three files is enough to identify the pattern.

### Read the nearest test

The test convention is often the most variable across codebases. Read at least one test in the area you're modifying — not just for the test style, but for what the codebase considers worth testing.

### Trust the linter / formatter as ground truth

If a linter or formatter is configured, **what it enforces is the convention**, full stop. Don't argue with the linter in the spec. If the linter is wrong, that's a separate slice ("update lint rules to allow X"); the current spec follows current rules.

---

## 3. When conventions conflict with each other

Real codebases have mixed conventions. Common causes:

- **Generational:** older code uses one pattern, newer code uses another. Pick the newer one and note the transition.
- **Domain split:** API layer uses one pattern, service layer uses another. Match the layer you're in.
- **Migration in progress:** half the codebase has moved to the new pattern, half hasn't. Find the migration ADR if present; honor it.

When conflict is real:

1. **Default to the convention in the nearest neighbor file.** Proximity wins ties.
2. **If proximity is ambiguous, default to the newer convention.** New code spreads the new convention.
3. **Note the conflict in the spec.** "Codebase uses `console.log` in older modules and `@/lib/logger` in newer; this slice uses logger because the nearest file (`export-pdf.ts`) uses logger."

Never pretend the conflict isn't there. The coder needs to know which side of the line your spec lands on.

---

## 4. When conventions are absent

Sometimes there is no convention because there are no examples yet. This happens for:

- The first error type in a young codebase.
- The first integration test.
- The first endpoint with auth.

In this case, **you are establishing the convention**. The spec must say so:

```
This slice introduces the first <X> in the codebase. The convention proposed here
will be followed by future <X>s. Reviewers: please push back if the proposed shape
is wrong-for-this-codebase before this lands.
```

This is a 🔴 reversibility decision — future code will follow it. It needs a kill criterion ("if the next two consumers can't fit this shape, we revisit").

---

## 5. When the codebase's convention is bad

Sometimes you read a convention and it's actively harmful — globally caught exceptions, untyped APIs, untested side effects. Do you follow it?

**Yes, in the current spec.** *And* you surface it. The spec is not the place to unilaterally change the convention; that's a separate decision needing buy-in. Flag it:

```
**Convention observation:** The codebase catches all exceptions at the top of
each handler and returns 500. This makes errors hard to diagnose. This spec
follows that convention (so reviewers aren't surprised), but recommends a
separate slice to introduce typed error handling. Logged for follow-up.
```

This is honest reporting, not passive-aggressive criticism. The convention exists for a reason (even if the reason is "no one had time to fix it"); the spec respects the current state while making the cost visible.

---

## 6. Worked example — discovery output for a TypeScript backend

```markdown
**Conventions discovered:**

| Domain | Convention | Source |
|---|---|---|
| Naming | camelCase functions, PascalCase types, SCREAMING_SNAKE constants | tsconfig + 3 sample files |
| Errors | `Result<T, E>` from `@/lib/result`; no thrown errors at module boundaries | src/api/*.ts (5 files) |
| Errors (typed) | `ExportError` enum with `code: ExportErrorCode` | src/api/types.ts |
| Tests | vitest, colocated `*.test.ts`, `describe`/`it`, `vi.mock` for file writers | src/api/export-pdf.test.ts and 2 others |
| Type strictness | tsconfig strict + noUncheckedIndexedAccess; no `any` outside `src/legacy/` | tsconfig.json |
| Imports | `@/` alias for src; relative only within the same module | tsconfig paths + 4 sample files |
| Logging | `@/lib/logger`; structured; debug for verbose, info for events | logger import in 6 files |
| Validation | zod schemas at module boundary | src/api/schemas.ts |
| Formatter | prettier (default config); enforced in CI | .prettierrc + CI workflow |
| Linter | eslint with @typescript-eslint/recommended; CI fails on warnings | .eslintrc + CI workflow |
| Test coverage | 80% line, enforced in CI for src/api | vitest.config.ts |

**Conflicts:** none observed for this slice.
**Conventions being established:** none (mature codebase, all relevant patterns exist).
**Convention concerns flagged for follow-up:** none.
```

That table becomes a sub-section of the exploration notes. The design and test plan reference back to it.

---

## 7. Anti-patterns

- **"I'll just use the standard idiom for this language."** The standard idiom is irrelevant if the codebase has its own. Match the codebase.
- **Assuming convention from filename.** `utils.ts` doesn't tell you the convention. Read the file.
- **Reading one file and calling it a pattern.** Always two. Preferably three.
- **Ignoring project convention files.** `AGENTS.md`, `CLAUDE.md`, `.cursorrules` — these encode rules the user wrote down explicitly. Honor them as constraints, not suggestions.
- **Specifying a "better" convention silently.** If you deviate from the codebase, the spec says why and accepts the consequence. Silent deviation is a code smell the spec must not encode.
- **Convention discovery as a checkbox.** "Yep, I looked." A convention you can't name is a convention you didn't discover.
- **Treating linter / formatter as opinions.** They're rules. Whatever they enforce is the convention, full stop.

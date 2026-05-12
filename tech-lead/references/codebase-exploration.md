# Codebase Exploration

> *"No spec without exploration."* — Tenet 1

A coding spec written without reading the relevant code is fiction. This reference describes what to read, how to read it efficiently, and what to capture in your exploration notes. Exploration is **not a step you skip when the answer feels obvious** — the obvious answer is usually wrong about a codebase you haven't read.

---

## 1. What you're looking for

Exploration produces a **context capsule** — a compressed summary of everything the spec will rest on. The capsule has six parts:

| Part | What to capture | How long it usually is |
|---|---|---|
| **Surface** | Project structure, build system, language version, top-level entry points | 3-5 lines |
| **Affected files** | Files the spec will touch + immediate callers | 5-15 paths |
| **Conventions** | Naming, error handling, test layout, types, formatter | 5-10 bullets |
| **Types & contracts** | Public types/interfaces the spec depends on; current signatures | 5-15 lines |
| **Tests** | Existing tests for affected code; baseline (do they pass right now?) | 3-5 lines |
| **Risks observed** | Things that look fragile or surprising; TODO/FIXME nearby | 2-5 bullets |

A capsule longer than ~50 lines means you over-explored. A capsule shorter than ~15 lines means you under-explored. Trust the rough range.

---

## 2. The exploration order

Don't read randomly. Order matters because each step narrows the next.

### Step 1 — Map the surface (60 seconds)

```bash
# At the repo root
ls
cat README.md 2>/dev/null | head -50
cat AGENTS.md CLAUDE.md .cursorrules CONTRIBUTING.md 2>/dev/null  # project convention files
find . -maxdepth 2 -name "package.json" -o -name "pyproject.toml" -o -name "go.mod" -o -name "Cargo.toml" -o -name "build.gradle*" | head -5
```

Goal: know the language, the build tool, the conventions doc (if any). If project convention files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `CONTRIBUTING.md`) exist, **read them now** — these encode project-specific rules the spec must honor.

### Step 2 — Locate the affected files

Search for the concept, not the verb. "login" not "implement login." Use multiple search strategies:

```bash
# Text search by concept
rg -l "login" --type=ts            # files mentioning login
rg "login|signin|authenticate" --type=ts -l | head -20

# Structural search (when available)
ast-grep --pattern 'function login($_) { $$$ }' --lang ts

# Symbol search via filesystem
fd -e ts -e tsx login              # files named login*
fd -e ts -e tsx auth               # nearby auth files

# Git history search (concepts evolve; recent commits are signals)
git log --oneline -- '**/auth/**' | head -10
```

Triangulate. Three different searches catch what one misses.

### Step 3 — Read the file + immediate callers

For each file the spec will touch:

```bash
# Read the file
cat src/auth/login.ts

# Find callers — who imports/calls this?
rg -l "from ['\"].*auth/login" --type=ts
rg "login\(" --type=ts | head -20

# Read the nearest test
fd -e test.ts -e spec.ts login
```

Reading callers is non-negotiable for any signature change. If you don't know who calls a function, you don't know what changing it costs.

### Step 4 — Extract conventions

While reading, capture conventions explicitly. Examples:

- *"Error handling: functions return `Result<T, E>` from `@/lib/result`; no thrown errors at module boundaries."*
- *"Tests: colocated as `*.test.ts` next to source; mock via `vi.mock`; no global setup file."*
- *"Naming: camelCase for functions, PascalCase for types, SCREAMING_SNAKE for constants."*
- *"Imports: `@/` is an alias for `src/`; relative imports only inside the same module."*

A convention is *only* a convention if you saw it in **two or more files**. One example is not a pattern; it might be the outlier.

See [`convention-discovery.md`](convention-discovery.md) for systematic extraction.

### Step 5 — Confirm the baseline

Run the existing tests for the affected code. Confirm they pass. **A spec that starts from a red baseline is broken by definition** — you can't measure the spec's success if the tests were already failing.

```bash
# language-specific test runner — examples
npm test -- src/auth/                     # vitest/jest scope
pytest tests/auth/ -q
cargo test --package auth
go test ./internal/auth/...
```

If the baseline is red, **surface it** before specifying. Either the spec also fixes the baseline, or it can't run yet.

### Step 6 — Note nearby risks

While reading, capture risks for the spec's smell-check:

- Adjacent `TODO`/`FIXME`/`XXX` comments — are they relevant?
- Recent commits to the file — was this just changed?
- Test coverage gaps near the affected code.
- Surprising patterns (silent catches, mutable globals, magic constants).

These don't always fix in your spec, but the spec acknowledges them.

---

## 3. Tooling — what to use

### Required (use early, often)

- **`rg` (ripgrep)** — fast text search. Default mode. Always prefer over `grep -r`.
- **`fd`** — fast file search. Better than `find` for name-based lookup.
- **`cat` / `view` / equivalent** — read files. Read enough lines; don't sip.
- **`git log`** — recent history. Often the fastest way to learn intent.
- **Test runner** — confirm the baseline. Skipping this is the single most common exploration miss.

### Useful when available

- **`ast-grep`** — structural search by language pattern. Better than `rg` for function signatures, class declarations, specific syntactic shapes.
- **Language server (LSP)** — `gopls`, `rust-analyzer`, `tsserver`, `pyright`. When integrated, "find references" beats text search.
- **`tokei` / `scc`** — quick line/file counts for sizing the codebase.
- **`tree-sitter` queries** — when LSP isn't available but you need structural recall.

### Avoid

- **Loading the whole repo into a single context window.** Wasteful and noisy. Surface, then drill.
- **Trusting filenames alone.** `utils.ts` can mean anything. Read.
- **Reading the README and assuming it's current.** README rot is universal. Confirm against code.
- **Asking the user "where is X" before searching.** Search first; only ask if search comes back empty or ambiguous.

---

## 4. How much to read

Calibrate to the change:

| Change size | Files to read | Callers to check | Tests to read |
|---|---|---|---|
| Single-line fix | The file + immediate caller | 1-2 | The nearest test |
| New function in existing module | 2-4 files | 3-5 callers if signature affects them | 2-3 nearby tests |
| New module | 4-8 files in surrounding areas | All consumers of nearby modules | All tests in the surrounding area |
| Cross-cutting refactor | The full affected surface | Every direct consumer | The whole test suite's structure |

When in doubt, **read one more file than feels necessary**. The cost of one extra read is small; the cost of a spec built on a wrong assumption is large.

---

## 5. Worked example — "Add a CSV export to the dashboard"

```bash
# Step 1 — surface
$ ls
src/  tests/  package.json  AGENTS.md  README.md
$ cat AGENTS.md
# Project: Dashboard
# Conventions: React 18 + TypeScript strict. Vitest. Tests colocated as *.test.tsx.
# Server routes in src/api/. Client routes in src/dashboard/. Result type from @/lib/result.

# Step 2 — locate
$ rg -l "dashboard|export" --type=ts | head
src/api/dashboard.ts
src/dashboard/index.tsx
src/dashboard/charts.tsx
src/api/export-pdf.ts            # existing export — read this!
src/api/export-pdf.test.ts

# Step 3 — read the file + callers
$ cat src/api/export-pdf.ts
# (returns Result<Buffer, ExportError>; uses streamPipeline; logs via @/lib/logger)
$ rg "export.*Pdf|exportPdf" --type=ts -l
src/api/dashboard.ts
src/api/routes.ts

# Step 4 — conventions extracted
# - Exports return Result<Buffer, ExportError>
# - Tests use vi.mock for the file writer
# - Logger imported from @/lib/logger (not console)
# - Errors include a `code: ExportErrorCode` enum

# Step 5 — baseline
$ npm test -- src/api/export-pdf -- --run
✓ 8 tests passed.

# Step 6 — risks
# - export-pdf.ts has a // TODO: handle large reports (no streaming yet)
# - The new CSV export will hit the same risk; flag it in the spec
```

**Context for the spec:**

```
Surface: React 18 + TS strict, vitest, src/api server routes, src/dashboard client.
Affected files: src/api/export-csv.ts (new), src/api/routes.ts (route registration),
  src/dashboard/export-button.tsx (new client button).
Conventions: Result<Buffer, ExportError> return shape; vi.mock for file writers;
  @/lib/logger; ExportErrorCode enum for error codes; tests colocated.
Types & contracts: ExportError shape at src/api/types.ts; routes.ts is the only
  registration site.
Tests: src/api/export-pdf.test.ts is the pattern to follow; baseline green.
Risks observed: export-pdf has a TODO about streaming for large reports; CSV will
  hit the same; spec should flag it.
```

That capsule is what the spec rests on. Everything that follows references back to it.

---

## 6. Anti-patterns in exploration

- **"I know how X is usually built."** You don't know how it's built *here*. Read.
- **Skipping the baseline test run.** You're betting that tests pass; that bet loses often.
- **Reading only the file the spec will modify.** Callers and tests are equally part of the contract.
- **Spending 10 minutes on a 5-line fix.** Right-size. A typo doesn't need a capsule.
- **Asking the user for context instead of reading.** Ask only when search fails. Reading is free.
- **Treating project convention files as suggestions.** They're rules the user wrote. Honor them.
- **Exploration without notes.** If it's not in the capsule, it doesn't exist for the spec. Write it down.

---

## 7. Self-check before moving to spec drafting

- [ ] I read at least the file, its immediate callers, and the nearest test.
- [ ] I ran the existing tests; the baseline is green (or red is acknowledged).
- [ ] I captured conventions for: errors, tests, naming, imports, types.
- [ ] I noted ripple-effect candidates (callers, deps, exports).
- [ ] I checked for project convention files (AGENTS.md, CLAUDE.md, .cursorrules, CONTRIBUTING.md) and read any present.
- [ ] My context capsule is 15-50 lines. Not 5. Not 200.
- [ ] If I couldn't reproduce / understand a critical assumption from the code, I surfaced it instead of guessing.

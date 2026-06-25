# Read Before Write

> *"Read before you write."* — Tenet 1

The spec is a snapshot. The codebase is what's there now. Reality drifts: files move, helpers get renamed, conventions shift, the test suite changes color. A coder who trusts the spec without verifying against reality produces code that's locally correct and globally wrong.

This reference describes what to read, in what order, before any code change.

---

## 1. The minimum read-before-write check

Every coding action — even a one-line fix — goes through this gate:

```
1. Open the file you're about to change. Read it.
2. Open at least one immediate caller (if changing a signature) or the nearest test (always).
3. Run the baseline tests for the affected area.
4. Reconcile: does what I'm reading match what the spec said?
```

If reality matches the spec: proceed.
If reality diverges: **stop**. See [§5 Drift Recovery](#5-drift-recovery).

The whole gate usually takes 1-3 minutes. The cost of skipping it can be hours of redoing work built on a wrong assumption.

---

## 2. What the spec promised — and what to verify

The spec's exploration notes and design section make explicit claims about the codebase. Verify the load-bearing ones:

| Spec claim | How to verify (in ~10 seconds) |
|---|---|
| "Function `foo` exists in `src/lib/foo.ts` with signature `(x: T) → U`" | `head src/lib/foo.ts` or your editor's go-to-definition |
| "Tests live colocated as `*.test.ts`" | `ls src/lib/foo.test.ts` |
| "Error type is `Result<T, E>` from `@/lib/result`" | `grep -E '"@/lib/result"' src/lib/foo.ts` |
| "Logger is `@/lib/logger`" | `grep logger src/lib/foo.ts` (find a real call) |
| "Baseline tests pass" | Run them. Don't trust history. |
| "47 callers found via rg" | Re-run the same rg. Confirm count. |

You don't have to verify every claim — only the ones the design rests on. If the spec design says "uses streamPipeline", verify streamPipeline is imported in a near neighbor. If the spec says "no callers outside `src/api/`", re-run the rg.

---

## 3. What to read, by change type

### A one-line fix in one file

Read:
- The file (the whole thing if <300 lines; the function + 50 lines of context if larger).
- The nearest test.

Run:
- The test for that function. Confirm baseline.

### A new function added to an existing file

Read:
- The file (whole thing, to learn the patterns).
- One sibling function (to see the convention for new functions in this file).
- The test file (the patterns for testing here).

Run:
- All tests in that file. Confirm baseline.

### A new file in an existing module

Read:
- Two sibling files in the same directory (convention).
- The module's index / barrel file if present (export structure).
- The closest test file (convention).

Run:
- All tests in the module's directory. Confirm baseline.

### Changes spanning multiple files

Read:
- The file for each spec-listed change.
- The callers, if any signature changes.
- The test for each affected file.
- The build configuration if you're adding deps.

Run:
- All tests in each affected area.
- `typecheck` to confirm the build is green at baseline.

---

## 4. The tools — and how to use them efficiently

### `rg` (ripgrep) — text search

```bash
rg <pattern> --type=ts                   # Search TypeScript only
rg -l <pattern> --type=ts                # List files (no per-line output)
rg -A 5 -B 2 <pattern>                   # Show context around matches
rg "from ['\"]@/lib/result"              # Imports of a specific path
rg "function exportPdf\b"                # Function definitions
```

Prefer over `grep -r` always. Faster, smarter defaults.

### `fd` — file search

```bash
fd export-csv --type=f                   # Files named export-csv*
fd -e test.ts                            # All .test.ts files
fd --hidden "CLAUDE.md|AGENTS.md|.cursorrules"  # Project convention files
```

Faster than `find` for name-based lookup.

### `ast-grep` — structural search (when available)

```bash
ast-grep --pattern 'function $NAME() { $$$ }' --lang ts
ast-grep --pattern 'await $X.$_($$$)' --lang ts -l
```

Use when text search false-positives (e.g., `login` matches a comment, not a function).

### Language server (LSP) — when integrated

"Find references", "go to definition", "find implementations" — better than text search for symbol-level questions.

### Test runner — confirm baseline

```bash
# Run the specific area, not the whole suite
npm test -- src/auth/
pytest tests/auth/ -q
go test ./internal/auth/...
cargo test --package auth
```

Faster feedback. Run the whole suite when finalizing, not while iterating.

### Avoid

- **`cat` on huge files.** Use head/tail/sed for slices, or your editor's view tool.
- **Searching the whole repo when the spec named a module.** Search the module first.
- **Re-reading the same file 5 times in different contexts.** Read once, take notes.
- **Trusting a colleague's mental model.** Read the code, not the description of the code.

---

## 5. Drift Recovery

When reality and the spec disagree, you have three choices:

### Choice 1 — The spec is right, reality moved underneath

Example: spec says "function `parseQuery` is at `src/lib/parse.ts`". Reality: `parseQuery` moved to `src/lib/query/parse.ts` since the spec was written.

If the divergence is **mechanical and obvious** (a file moved, an import renamed, a helper renamed but otherwise unchanged), adapt the spec mentally and continue. Note the adaptation in the implementation report:

> *"Implementation note: `parseQuery` moved to `src/lib/query/parse.ts` since spec was written; adapted imports accordingly. No behavior change."*

### Choice 2 — The spec is wrong about the codebase

Example: spec says "tests are colocated as `*.test.ts`". Reality: this area uses a separate `tests/` directory. Or: spec says "the helper returns `Result<T>`". Reality: it throws.

When the spec is wrong about a **convention or contract**, you have two sub-choices:

- **The wrong assumption doesn't affect the design** (e.g., tests live in a different directory but the spec still works). Adapt; note in the report.
- **The wrong assumption affects the design** (e.g., the spec was structured around `Result<T>` but the code throws). **Stop. Reverse-handoff to implementation-planner.**

The line between these is judgment. When in doubt, escalate. Tech-lead is cheap to consult; un-shipping wrong code is expensive.

### Choice 3 — Reality is wrong (broken)

Example: spec assumed baseline tests pass. They don't. Or: spec assumed a helper exists. It doesn't, and there's no recent removal in git history.

When **reality is in a state the spec couldn't have predicted**, stop and surface to the user. The slice can't proceed until the reality issue is resolved.

```
Status: paused.
Reason: baseline tests in `src/api/` are RED on `main` (3 failures, unrelated
  to this slice — see output below). The spec assumed a green baseline.
Asking: should I (a) fix the baseline first, (b) skip the broken tests and
  proceed flagged, (c) pause this slice and route to implementation-planner?
```

---

## 6. Worked example — a small spec, reality verification

> Spec: Add a new exported function `exportCsv` in `src/api/export-csv.ts`,
> mirroring the shape of `exportPdf` in `src/api/export-pdf.ts`. Use the
> existing `streamPipeline` pattern. Tests colocated as `*.test.ts`.

**Verification, ~2 minutes:**

```bash
# Does export-pdf.ts exist and have the shape the spec describes?
$ head -30 src/api/export-pdf.ts
# (returns Result<Readable, ExportError>; imports streamPipeline; uses logger)
# ✅ Matches spec.

# Test file colocated?
$ ls src/api/export-pdf*
src/api/export-pdf.ts  src/api/export-pdf.test.ts
# ✅ Colocation confirmed.

# Does the @/lib/result import look right?
$ grep "@/lib/result" src/api/export-pdf.ts
import { Ok, Err, type Result } from "@/lib/result";
# ✅ Matches spec.

# streamPipeline import?
$ grep "streamPipeline" src/api/export-pdf.ts
import { pipeline as streamPipeline } from "node:stream/promises";
# ✅ Matches.

# Baseline tests green?
$ npm test -- src/api/export-pdf -- --run
✓ 8 tests passed.
# ✅ Baseline confirmed green.

# Does src/api/export-csv.ts already exist?
$ ls src/api/export-csv* 2>/dev/null
(no output)
# ✅ Correct — spec said "new", and it doesn't exist yet.
```

Two minutes, six checks, all green. Now I can proceed with confidence — and if any check had failed, I'd have caught it before sinking time into building on a wrong assumption.

---

## 7. Anti-patterns

- **Trusting the spec verbatim without verifying.** Specs go stale. Reality moves.
- **Reading only the file you're about to change.** Callers and tests are part of the contract.
- **Skipping the baseline test run.** You're betting the baseline is green. The bet loses often.
- **Reading the whole repo before starting.** You don't need to. Read what the change touches.
- **Asking the user "where is X?"** before searching. Search first; ask only if search fails.
- **"I'll fix it as I go."** Verify first, then plan the fix, then make it. Mixing the phases means you discover surprises mid-edit and have to roll back.
- **Verifying once, then forgetting.** As you implement, your understanding deepens; re-verify the load-bearing claims at each new layer.
- **Reading a file but not running its tests.** Reading is necessary but not sufficient; you also need to know the test suite's current color.

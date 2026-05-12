# Self-Review Checklist

> *"Self-review before declaring done."* — Tenet 8

Before saying "done," you read your own diff as a hostile reviewer. Not as the implementer (who already knows the intent); as a reviewer who has never seen this code and is looking for reasons to send it back.

This checklist is what to look for. Run it deliberately, not as a checkbox.

---

## 1. The fresh-context posture

The discipline:

1. Make sure all your tests pass.
2. Run `git diff main` (or against the slice's base) and read the **entire diff**.
3. Read it as if someone else wrote it.
4. For each section, ask: "would I push back on this if a colleague submitted it?"

If you find yourself thinking "I know why this is here" without having a justification a reviewer would accept, the code isn't ready. Either justify it in the report or change it.

Engineering research on agentic coding emphasizes a similar pattern: a **fresh context** review catches things the implementing context misses. Try to read your own diff with that fresh-context posture — at minimum, away from the immediate "I just wrote this" mental state.

---

## 2. The checklist

### Stray instrumentation

- [ ] No `console.log`, `console.error`, `print`, `dbg!`, `pp`, `dump()`, `var_dump` statements left behind.
- [ ] No `// DEBUG`, `// TEMP`, `// XXX REMOVE ME` markers.
- [ ] No probes from debugging that should have been removed.
- [ ] No `debugger;` statements.

### Commented-out code

- [ ] No commented-out blocks left as "in case I need it."
- [ ] If a comment-out is genuinely valuable (rare), it has a `// NOTE:` explaining why it's kept.

### Dead code

- [ ] No new functions / methods you wrote and then routed around.
- [ ] No new imports that nothing uses.
- [ ] No new types that nothing references.
- [ ] No new files added but not imported anywhere.

### Suppressed errors

- [ ] No `try { … } catch { /* */ }` with empty or comment-only handlers.
- [ ] No `except: pass`.
- [ ] No `_ = ...` discarding error returns without a reason.
- [ ] No `.unwrap()` / `.expect("should never fail")` in production paths.
- [ ] Every catch handles a specific known error, recovers explicitly, or rethrows with context.

### Security smells

- [ ] No hardcoded secrets, API keys, tokens, or passwords (even "for testing").
- [ ] No string concatenation building SQL queries (use parameterized queries).
- [ ] No `eval`, `exec`, or equivalent on user input.
- [ ] No path traversal vulnerabilities (`../` not sanitized in file paths from user input).
- [ ] No CSRF-prone state changes via GET requests.
- [ ] No unvalidated user input flowing into shell commands.
- [ ] No new dependencies added that weren't in the spec — or, if added, they're justified.

### Tests

- [ ] Each new test asserts something specific (not just "doesn't throw").
- [ ] Each new test was confirmed RED before the code was added (or, for refactor, the existing tests were confirmed GREEN before changes).
- [ ] No tests added that pass trivially (`expect(true).toBe(true)` or equivalent).
- [ ] No `test.skip` / `it.skip` / `@pytest.mark.skip` / `t.Skip` without an explicit reason.
- [ ] No mocks of the unit under test.
- [ ] Snapshot tests, if added, are stable and not regenerated thoughtlessly.

### Type and lint

- [ ] `typecheck` / `mypy` / `tsc --noEmit` clean.
- [ ] `lint` clean (no new warnings).
- [ ] Formatter has run (`prettier --check`, `gofmt -l`, `ruff format --check`).
- [ ] If a lint rule was disabled inline (`eslint-disable`, `# noqa`, `nolint`), it has a justifying comment.

### Spec adherence

- [ ] Every "in scope" item from the spec is done OR explicitly flagged in the report.
- [ ] Every "out of scope" item from the spec was respected (no scope creep).
- [ ] Every flagged assumption from the spec's §9 was verified or surfaced as a divergence.
- [ ] Every test from the spec's §5 was added with the assertion the spec described.
- [ ] Every 🔴 decision in the spec's §7 was implemented per the spec; no silent re-interpretation.

### Convention adherence

- [ ] Naming matches the codebase pattern.
- [ ] Imports match the codebase pattern (alias vs. relative, grouping).
- [ ] Error handling matches the codebase pattern (Result vs. throw vs. callback).
- [ ] Logging matches the codebase pattern (library, structured/unstructured, level discipline).
- [ ] Tests match the codebase pattern (location, naming, mocking style).
- [ ] Project convention files (AGENTS.md, CLAUDE.md, .cursorrules, etc.) rules were followed.

### Edge cases

- [ ] Empty inputs handled (or explicitly flagged as not handled).
- [ ] Boundary values handled (zero, negative, max).
- [ ] Unicode / multi-byte characters handled if the input is text.
- [ ] Time zones handled if the input includes time.
- [ ] Concurrent calls considered (if relevant).
- [ ] What happens on partial failure (transaction rolled back? state cleaned up?).

### Files

- [ ] No accidentally-committed `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/settings.json`, etc.
- [ ] No accidentally-committed `node_modules`, `target/`, `dist/`, `build/`, large fixtures.
- [ ] No accidentally-committed `.env` files, credentials, key files.
- [ ] Generated files are gitignored or generated reproducibly.
- [ ] `progress.md` updated to reflect completion.

### Commit hygiene

- [ ] Commits are atomic — each is a single intent.
- [ ] Commit messages follow the codebase's convention (often Conventional Commits).
- [ ] Each commit, taken alone, leaves the test suite green (or for the red phase of TDD, intentionally red as documented).
- [ ] No "WIP", "fix", "more changes" commit messages without a clear story.

---

## 3. Reading the whole diff

```bash
# Read the whole diff
git diff main

# Or just the changed files, one at a time
git diff main -- src/api/export-csv.ts
git diff main -- src/api/routes.ts
```

**Read every line.** Especially:

- Areas you barely changed. Sometimes a stray edit slipped in.
- Whitespace changes you didn't intend.
- Auto-import additions that ended up unused.
- Re-formatted regions where you didn't mean to reformat.

If you see something you don't remember writing, **don't trust that you wrote it correctly.** Either re-justify or remove.

---

## 4. Re-running the spec's acceptance signal

The spec's handoff baton listed an acceptance signal — a specific set of commands and checks that prove done. Re-run them, in the order specified, recording the result:

```bash
$ <test command>
✓ all tests pass

$ <typecheck command>
✓ no errors

$ <lint command>
✓ no warnings

$ <existing test suite scope>
✓ all pass (no regressions)

# Manual verification (if applicable)
$ <command for manual check>
<expected output>
```

If any check fails, the slice is **not done**. Either:

- Fix the failure (back into implementation).
- Or surface why the failure is acceptable (rarely the right answer; flag clearly in the report).

---

## 5. What to do if the self-review fires

When the checklist finds something:

| Severity | Response |
|---|---|
| Stray instrumentation, dead code, commented blocks | Fix immediately; recommit |
| Convention deviation | Fix unless deliberately justified; if justified, ensure the justification is in the report |
| Missing test from spec | Add the test; verify; recommit |
| Suppressed error | Fix or refactor to surface; if intentional, justify in report |
| Scope creep | Stash the extras; land minimum |
| Missing the spec's edge case | Add a test that pins the behavior; implement |
| Failing acceptance signal | Re-enter implementation; do not declare done |

If multiple things fire, the slice probably needs another implementation pass. That's fine — the self-review caught the issue **before** the reviewer did, which is the whole point.

---

## 6. The "would I bet on this" gut check

Final question: **"Would I bet on this code working in production?"**

If yes — but with hesitations — name the hesitations in the implementation report. The reviewer can decide whether they're acceptable.

If no — the slice isn't ready. Don't declare done.

---

## 7. Anti-patterns

- **Skipping the self-review because "I'm sure it's clean."** It rarely is.
- **Treating the checklist as a checkbox.** A check unchecked because you didn't actually look for the smell isn't a check.
- **Reading only the new files.** Existing-file modifications are where the messy diffs hide.
- **Running the acceptance signal once, declaring done, before commits land.** Re-run after the last commit.
- **"The lint warning is wrong."** Almost always wrong on your part. Fix or justify with a comment.
- **Self-reviewing in the same mental state as you implemented.** Take a break. Re-read in fresh-context posture.
- **Self-review that always passes.** If your self-review never sends you back into implementation, you're either superhuman or not actually self-reviewing.

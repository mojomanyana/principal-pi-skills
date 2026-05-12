# Coding Loops

> *"Smallest change that works, then iterate."* — Tenet 2

This reference describes the inner loop of implementation: how small to take each step, how often to commit, how to maintain progress across context windows, and how to use the walking-skeleton pattern to get end-to-end signal early.

These are not optional flourishes. They are the harness practices that engineering research on long-running AI agents identified as making the difference between agents that ship and agents that drift.

---

## 1. Small steps — what counts as "small"?

A coding step is small when:

- The change fits in your head as a single intent.
- The change can be tested in one or two test runs.
- The change can be rolled back by a single `git revert` without disturbing other work.
- The change can be described in one commit message that wouldn't need an "and also" clause.

**Typical step sizes:**

| Step | Size |
|---|---|
| Add a failing test | 5-30 lines |
| Make the test pass | 5-50 lines |
| Extract a helper after green | 5-30 lines moved |
| Wire up a new file in the routing | 1-10 lines |
| Update a caller because the signature moved | 1-5 lines per caller |
| Add a missing edge-case test | 10-30 lines |

**Steps that are too big:**

- "Add the new module and all its tests." (Three or four steps masquerading as one.)
- "Refactor parseRange and migrate callers." (Two slices; do refactor green-on-green first, then migrate callers as separate steps.)
- "Fix the bug and clean up the surrounding code." (Mix of two intents; split them.)

**Steps that are too small:**

- "Add the function signature, no body." (Pointless commit; combine with the body and the test.)
- "Update one line of one variable name." (Combine with a related change unless the rename is intentionally isolated for git blame.)

The rule of thumb: **if you can name two intents in your step, split it.**

---

## 2. Commit cadence — every few minutes

Research on long-running agent harnesses is explicit:

> *"The best way to elicit this behavior was to ask the model to commit its progress to git with descriptive commit messages and to write summaries of its progress in a progress file. This allowed the model to use git to revert bad code changes and recover working states of the code base."*

In practice: commit roughly every few minutes, every passing test, every clean step. Not every save — but close to it.

**Why frequent commits matter:**

- **Rollback granularity.** A bad fork in the road costs you minutes, not hours.
- **Bisect resolution.** If a regression appears later, `git bisect` narrows fast.
- **Context recovery.** If the session resets or the harness compacts, git log + a progress file is enough to resume.
- **Code review legibility.** Reviewers can read the slice as a sequence of intents instead of a wall of diff.

**Conventional commit prefixes** (match the codebase's existing style):

```
feat(scope): new behavior
fix(scope): bug fix
refactor(scope): no behavior change
test(scope): test changes
docs(scope): documentation only
chore(scope): tooling / build / non-code
```

If the codebase doesn't use conventional commits, mirror its existing style. Honor project convention files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `CONTRIBUTING.md`) if they specify a format.

---

## 3. The progress file — `progress.md`

A progress file alongside git history is the second pillar of recovery. The format:

```
# progress.md
# Last updated: 2026-05-12 14:32 (slice: csv-export-route)

## Done
- [x] Added STREAM_FAILED to ExportError enum (commit abc123)
- [x] Test scaffolding for export-csv.test.ts; first test red (commit def456)
- [x] Implemented exportCsv() core; test passes (commit ghi789)

## In progress
- [ ] Route registration in src/api/routes.ts
  - Need to confirm route ordering convention (route registration is order-sensitive in this codebase)
  - Currently reading src/api/routes.ts:42-80 for the pattern

## Open questions / blockers
- (none right now)

## Notes for future context
- The streaming pipeline returns a Readable; the router expects either
  a Buffer or a Readable, but the headers must be set BEFORE the stream pipes
  (see export-pdf.ts:23 for the pattern).
- Conventions confirmed: colocated tests, `@/lib/logger`, `Result<T, E>`.
```

**Update the progress file:**

- After each commit.
- When you discover something that would help a future-you resume.
- When you hit a blocker.

**Don't update it for:**

- Every line of code you write (too granular).
- Things obvious from git log + the spec.

The progress file is the "yesterday's-me memo to today's-me." Treat it as such.

---

## 4. Walking skeleton — get end-to-end first

When a slice spans multiple layers (DB, service, API, UI), get a paper-thin version working **end-to-end** before adding width.

**Wrong (horizontal phases):**

```
1. Build the full DB schema for all 12 fields.
2. Build the full service layer with all 8 methods.
3. Build the full API with all 4 endpoints.
4. Build the UI.
5. Run end-to-end for the first time. Discover the wire format mismatch. Cry.
```

**Right (vertical slice):**

```
1. Add ONE field to the DB. Get a migration green.
2. Add ONE service method that reads/writes that field.
3. Add ONE API endpoint that uses the service method.
4. Add a manual or e2e check that the round trip works.
5. ✅ End-to-end signal achieved.
6. Now expand: more fields, more methods, more endpoints, more UI.
```

The walking skeleton catches:

- Wire format mismatches (the layers don't speak the same language).
- Auth / permission issues (the service works but the API rejects).
- Performance gotchas (the round trip is too slow).
- Test infrastructure gaps (you can't actually test end-to-end yet).

Catching these on day 1 is much cheaper than catching them on day 5.

---

## 5. Inner loop — the run-tests rhythm

Within a step, the rhythm is:

```
  edit ──► save ──► run relevant tests ──► observe
    ▲                                          │
    └──── adjust if red ◄──── if red ◄─────────┘
                                ┌───────────────┴───────────────┐
                                │              if green:        │
                                ▼                               ▼
                       commit + update progress      consider refactor
```

**"Run relevant tests"** is the key phrase. Don't run the whole suite on every edit; run the tests that exercise what you just changed. The whole suite runs at the end of the slice, before declaring done.

**Test-running discipline:**

- After each test you add (confirm red, then confirm green).
- After each non-trivial code change.
- Before each commit (so the commit history is "always-green").
- Whole suite at slice end.

**Don't:**

- Skip running tests because "I'm sure this is right."
- Run the whole suite on every change (slow feedback ↔ slow iteration).
- Run tests in a way that doesn't actually exercise your change (mocked away).

---

## 6. Drift recovery — picking up after a session reset

When a session is interrupted, compacted, or restarted, the steps to resume:

### Step 1 — Locate state

```bash
pwd
git status
git log --oneline -20
git diff HEAD
```

Reveal: what branch, what's committed, what's uncommitted, what's recent.

### Step 2 — Read the progress file

```bash
cat progress.md 2>/dev/null
```

This is your memo from past-you. It tells you what's done, what's in progress, what's blocking.

### Step 3 — Confirm baseline color

```bash
<test command for the affected scope>
```

If the tests are green: you can build from here.
If the tests are red: read the failure carefully. Is it relevant to your in-progress work? If yes, that's where you resume. If no, the baseline was disturbed by something else; surface to the user.

### Step 4 — Read the latest commit's diff

```bash
git show HEAD
```

What was the last intent? Does it match the progress file's "Done" list?

### Step 5 — Resume

You now have: branch, status, baseline, history, progress notes. Resume from the next "In progress" item in the progress file.

If the progress file is missing or outdated, the spec + the current branch state + the test results are usually enough. But **the progress file is cheap to maintain and expensive to lack**; write it as you go.

---

## 7. When the inner loop breaks down

Three common breakdowns and their fixes:

### Breakdown 1 — "I keep editing, the test never goes green."

Diagnosis: you're guess-and-check. Pause.

Fix: state your hypothesis explicitly. "I think the test is red because <X>. The smallest probe I can run to confirm is <Y>." Run the probe. Update the hypothesis. Iterate at the **hypothesis** level, not the code level. See [`debugging-methodology.md`](debugging-methodology.md).

### Breakdown 2 — "I keep adding things and the diff is now huge."

Diagnosis: scope creep mid-slice.

Fix: stop. `git status` and look at what you've changed. Identify the **minimum subset** that makes the test pass. Stash everything else (`git stash`). Land the minimum. Then reconsider whether the stashed parts belong in this slice or a follow-up.

### Breakdown 3 — "I'm not sure where I am or what's next."

Diagnosis: missing progress file or lost track.

Fix: spend 60 seconds writing it down. What's done (with commit references), what's in progress (with the current sub-step), what's blocked. This is recovery, not procrastination.

---

## 8. Anti-patterns

- **Mega-commits.** "Implement the feature" (300 lines, 8 files). Reviewers can't read it; bisect can't narrow; rollback is all-or-nothing.
- **No commit until the slice is done.** A multi-hour work session with one commit at the end loses all of git's leverage.
- **Commits before tests go green.** Commits should be on green; a half-broken commit pollutes the history.
- **Horizontal phasing.** Build the whole DB layer first, then the whole service layer, then... Test infrastructure issues won't surface until you connect the layers.
- **Skipping the progress file.** Then the next context window has to rediscover state from scratch.
- **Running the whole suite on every edit.** Slow feedback → slow iteration → frustration → shortcuts.
- **Never running the whole suite.** You can land a regression you didn't know you caused. Run the whole suite at slice end.
- **Treating every step as TDD.** Pure refactors don't need new tests; config changes don't have unit-level reds; spike work is discarded. Right-tool for the step.
- **Treating the progress file as the spec.** The progress file is operational state, not design. Spec questions go to tech-lead.

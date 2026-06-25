# Scope Discipline

> *"Scope discipline — flag drift, don't fix it."* — Tenet 7

A slice that scope-creeps is a slice that doesn't ship. Mid-implementation, you'll notice unrelated improvements you "should" make: a typo, a dead import, an unused variable, a TODO comment that's a year old, a test that's obviously slow, a function whose name is misleading. **Don't fix them.** Name them; let them be.

This is the single biggest discipline difference between coders who ship and coders who get reviewed-into-oblivion.

---

## 1. Why scope creep is so costly

Each unrelated change adds:

- **Review surface.** The reviewer has to evaluate it on its own merits.
- **Risk.** An "obvious" fix sometimes isn't.
- **Bisect noise.** Future regression hunts get confused.
- **Coupling to your slice.** If the slice is reverted, your "fix" gets reverted too.
- **Time.** Even a one-line change has interrupting cognitive cost.

A 50-line spec that turns into a 500-line PR isn't 10× faster delivery; it's a different artifact, possibly never reviewed.

---

## 2. The three categories of drift you'll notice

You will notice things while reading code. Bucket them and apply the rule:

### Category A — Blocks the slice

The slice **literally cannot proceed** without this change. Examples:

- The file you must edit doesn't exist; needs to be created (this is the slice).
- A typo in the type definition that breaks compilation (must be fixed to compile).
- A missing import that the spec assumed was there (must add or pause).

**Action:** fix; commit as part of the slice; mention in the implementation report.

### Category B — Trivially small AND obviously correct AND directly adjacent

The change is one line, the fix is obvious, and the file is open anyway:

- A typo in a comment in the function you're editing.
- A whitespace inconsistency in the file you're editing.
- A dead import in the file you're editing.

**Action (case-by-case):**

- If the change adds essentially zero review surface (a one-character typo in a comment in a function you're already changing): fix it in the same commit, mention briefly in the report.
- If the change is one line but **in a different file** or **outside the function you're working on**: leave it. Note it for follow-up.
- If you're unsure: leave it. The bar for "small enough to include" is high.

### Category C — Everything else

The change is interesting, useful, possibly important — and **not part of this slice**.

- A TODO comment whose ticket is open.
- A test that's obviously slow.
- A function with a misleading name.
- A bug in adjacent code you noticed while reading.
- A refactor opportunity.

**Action:** name it; don't fix it.

Where to name it:

1. **Implementation report — "Observations / follow-up suggestions"** section. This is the primary venue.
2. **In a code comment** — only if the future code reader is the most likely audience and the next slice will be along soon. Use `// TODO(coder, 2026-05-12): ...` so it's attributable and dated.
3. **In a separate file** like `FOLLOWUP.md` if your team has that convention.

**Don't:**

- File a separate ticket from inside coding work without checking with the user first (you don't know their ticket system or priorities).
- Use `// FIXME` or `// XXX` for things that aren't actually broken.
- Bury the observation. It belongs in the implementation report so the reviewer / user can act on it.

---

## 3. Worked example — surface, name, ship

> Slice: Add CSV export at `/export/csv`.
>
> While editing, the coder notices:
> 1. The spec was clear; everything is on track.
> 2. The function signature for `exportPdf` (in a file they read for reference) has a misleading parameter name (`q` instead of `query`). Same convention as `exportCsv`. Tempting to fix in passing.
> 3. The test setup file (`tests/setup.ts`) has a 5-line block that's been commented out for a while.
> 4. `src/api/routes.ts` registers routes in alphabetical order, but `routes.ts:42` has one out of order — clearly an old slip.

### Implementation report excerpt

```markdown
## Done
- Implemented `exportCsv` per spec §4.
- Added 5 tests per spec §5; all green.
- Registered route in `src/api/routes.ts` (in alphabetical position).

## Observations (NOT addressed in this slice)
- `src/api/export-pdf.ts:5` has parameter `q` where convention is `query`.
  Suggested follow-up slice to align.
- `tests/setup.ts:14-19` has a commented-out block of unclear origin.
  Suggested cleanup ticket.
- `src/api/routes.ts:42` registers `/auth` out of alphabetical order
  (between `/billing` and `/admin`). Cosmetic; suggested cleanup.
```

The report is honest, helpful, and doesn't burden the PR with unrelated changes. The reviewer / user can decide what to do.

---

## 4. When the spec is silent but the codebase is unclear

Sometimes mid-implementation you hit a question the spec didn't answer:

- "Should the CSV column header use snake_case or camelCase?"
- "Should this log line include the user's IP?"
- "Should an empty result set be a 200 with empty body or a 204?"

These are **scope-edge** questions: not stop-the-world, but also not your call to make silently.

**Three responses, in priority order:**

1. **Find precedent in the codebase.** Search for similar decisions (header naming in other exports; logging patterns in other handlers). If precedent exists, follow it; note in the report.
2. **Ask the user / implementation-planner** if the answer materially affects the contract (column headers in a CSV export are essentially contract; 204-vs-200 is contract).
3. **Pick a reasonable default + flag it in the report.** Use when the choice is genuinely arbitrary or low-stakes.

```
Implementation note: spec was silent on whether an empty CSV export should be
200 (with header row only) or 204 (no content). Chose 200 with header row
only — matches export-pdf for the empty case and matches "the request was
successful, here's the (empty) data" semantics. If 204 was intended, easy to
change at <file:line>.
```

This is honest and reversible — the reviewer can correct in 30 seconds.

---

## 5. When the slice grows mid-flight

The most common scope failure mode: the implementation reveals the slice is harder than the spec thought, and instead of stopping, the coder pushes through.

**Signs the slice is growing:**

- You've changed >10 files when the spec listed 4.
- You're 3× past the time estimate.
- You're touching a third area of the codebase the spec didn't mention.
- You're rewriting code that "I was going to need anyway."

**The right response:** stop. `git status`. Read your diff. Identify the **minimum subset** that satisfies the spec. Anything beyond that, stash:

```bash
git status                # look at current state
git diff                  # read what you've changed
git stash -k --keep-index # stash the extras while keeping the minimum staged
# Or:
git checkout -- <files-not-in-spec>
```

Land the minimum. Reopen the stash; either submit as a follow-up slice or discard.

If the slice was sized wrong and the **minimum** doesn't actually satisfy the spec — **route back to implementation-planner** with a reverse handoff explaining what's bigger than expected.

---

## 6. "While I'm here" — the most dangerous phrase

> *"While I'm here, I'll also fix the related thing in the next function."*

This phrase costs more time than almost any other coding habit. The "related thing":

- May not be related.
- May have a non-obvious reason for being the way it is.
- May break a test you don't know exists.
- Adds review surface.
- Couples your slice to it for revert purposes.

**Better phrase:** *"Noted for follow-up."*

If "while I'm here" pulls in a multi-line change, you've broken scope discipline. The fact that you're already in the file is not a reason. The file's contents are not a buffet.

---

## 7. The "I'll just refactor this one thing" trap

Slightly different shape: you find code mid-implementation that's awkward, and the awkwardness makes your work harder. Refactor first, then continue?

**The discipline:**

- **Yes**, if the refactor is contained, doesn't change behavior, and is the only reasonable way forward. Make the refactor its own commit (`refactor(scope): extract X for clarity`) so it stands on its own.
- **No**, if the refactor would balloon. Find a way to add your work *without* refactoring; flag the refactor as follow-up.

A refactor commit landing alongside a feature commit is fine if both are clean. A feature commit with refactor sprinkled through it is messy. The discipline is *what's in the commit*, not whether you refactor.

---

## 8. Anti-patterns

- **"While I'm here…"** Cardinal phrase. Resist.
- **Mixing refactor and feature in one commit.** Even if both are correct, they should be different commits.
- **Filing tickets mid-implementation.** You don't have the context to prioritize them. Surface in the report.
- **Fixing typos in files you're not editing.** Even if obvious. Even if one keystroke. Out of scope.
- **"This bug fix also addresses a related issue."** No, it doesn't. Two bug fixes; two commits; possibly two slices.
- **Adding "TODO" comments without a name and date.** Anonymous TODOs rot. Sign and date them.
- **Treating drift as something to discover and fix.** Drift is something to discover and surface.
- **Pushing through a scope-grown slice.** A slice 2× its estimated size is a smell. 3× is a signal. 5× is a different slice.

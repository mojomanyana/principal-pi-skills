# Handoff to Coder

> *"Hand off, don't invoke."* — A first-class move.

The handoff baton is the contract by which `tech-lead` passes work to `coder`. It is structured, complete, and self-contained — a coder picking up the baton in a fresh context window should be able to start coding without re-reading the spec from scratch.

This reference defines the baton's required sections, accepted formats, and worked examples.

---

## 1. Why a structured baton

Context engineering for long-running agent work is the dominant 2026 best practice. Agents that pick up work from a prior agent need:

- **A clear pointer to the spec** (not the whole spec re-pasted).
- **Concrete first actions** so the coder doesn't spend a full context window deciding where to start.
- **Explicit assumptions to reconfirm** so the coder verifies rather than trusts.
- **A measurable acceptance signal** so "done" is unambiguous.
- **Stop conditions** so the coder knows when to pause and return to tech-lead instead of plowing through.

Free-form handoffs ("just implement the spec") fail predictably: the coder loses time orienting, makes silent assumptions, or declares work complete when it isn't. The baton solves these by encoding intent.

---

## 2. The seven baton sections

This baton follows the canonical schema defined in [`../../baton-schema.md`](../../baton-schema.md). The table below maps tech-lead's baton sections to the schema's seven canonical names:

| # | Canonical section | Tech-lead content | Purpose |
|---|---|---|---|
| 1 | **Objective** | Outcome (one-liner) | Coder's north star without re-reading |
| 2 | **Inputs** | Spec reference + commit/hygiene notes | Where to find the spec; conventions for commits & PR |
| 3 | **Context** | First concrete action + reconfirm assumptions | Where to start; known unknowns to verify |
| 4 | **Acceptance** | Acceptance signal | What proves done |
| 5 | **Kill criteria** | Stop conditions | When to pause and route back |
| 6 | **Return contract** | *(implicit: branch + report + baton to project-git)* | What the coder hands back |
| 7 | **Prior art** | *(from spec: rejected approaches, gotchas)* | What's been tried or ruled out |

Every baton has all seven. A missing section is a failure mode, not an optimization. The YAML frontmatter envelope (`baton_id`, `from`, `to`, `type`, `created`, `plan`, `slice`, `revision`) is also required — see the schema for field definitions.

---

## 3. Section-by-section

### 1. Spec reference

Where the full spec lives. Inline or filesystem path:

```markdown
**Spec:** `/docs/specs/2026-05-12-csv-export.md` (full document)
```

Or, for short specs:

```markdown
**Spec:** inline above (this message).
```

If the spec is shared via a system that may not be accessible to the coder's runtime (e.g., a private wiki), include enough of the spec inline for the coder to act without that system.

### 2. Outcome (one-liner)

A one-sentence restatement of the spec's outcome. Coder uses this as the north star without re-reading the whole spec on every turn.

```markdown
**Outcome:** Add a streaming CSV export at `/export/csv` that mirrors the
existing PDF export's shape and returns a `Result<Readable, ExportError>`.
```

### 3. First concrete action

Where to start. The single highest-value first action. Examples:

```markdown
**First concrete action:** Confirm `ExportError.STREAM_FAILED` exists in
`src/api/types.ts`. If not, add it as the first commit (before any other change).
```

```markdown
**First concrete action:** Reproduce the bug by running
`npm test -- src/auth/login.test.ts -- --run "rejects empty password"` and
confirming it currently passes (the bug exists outside the test boundary).
```

The first action is **specific and verifiable**. "Start implementing" is not an action.

### 4. Reconfirm assumptions

The flagged assumptions from spec section 9, in a checklist format so the coder ticks them off:

```markdown
**Reconfirm before coding:**

- [ ] `streamPipeline` from `node:stream/promises` is the codebase's streaming pattern.
      (Confirmed in spec by reading `export-pdf.ts`; coder verifies still current.)
- [ ] Test file location is `src/api/export-csv.test.ts` (colocated with source).
      (Spec assumed colocation matches the convention; coder verifies.)
- [ ] `ExportErrorCode.STREAM_FAILED` does not yet exist; will be added in the
      first commit. Confirm absence before adding.
```

Each assumption has an explicit verification step. If any check fails, the coder pauses and pings tech-lead (see stop conditions).

### 5. Acceptance signal

The measurable definition of done. Almost always a combination of:

- **All listed tests pass** (from spec section 5).
- **Typechecker / linter pass** (specific commands).
- **Existing test suite unchanged** (i.e., no regressions in adjacent areas).
- **A manual verification step** when relevant.

```markdown
**Acceptance signal:**

1. New tests from spec section 5 (5 tests) all pass.
2. `npm run typecheck` exits 0.
3. `npm run lint -- src/api/export-csv.ts src/api/routes.ts` exits 0 (no warnings).
4. `npm test -- src/api/` exits 0 (existing API tests still pass).
5. Manual check: `curl localhost:3000/export/csv?...` returns a CSV with the expected
   `Content-Type` and first row matches the expected header.
```

The list is **specific, runnable, and ordered** — typically cheapest checks first.

### 6. Stop conditions

When the coder should pause and route back to tech-lead instead of pushing through:

```markdown
**Stop conditions (pause and return to tech-lead):**

- An assumption in §4 turns out wrong (spec needs an update before coding can proceed).
- A 🔴 reversibility decision (per spec §7) needs revisiting.
- The test plan reveals a gap (a behavior the spec didn't cover) requiring more than a
  one-line addition.
- A convention discovered mid-implementation contradicts the spec.
- Existing tests in the adjacent area start failing in a way that suggests the spec
  was wrong about the baseline.
```

This list **gives the coder permission to stop**. Without it, agents tend to plow through and produce half-correct work because "the spec said so."

### 7. Commit / hygiene notes

Conventions for commit messages, PR shape, and any tooling notes that affect implementation discipline:

```markdown
**Commit hygiene:**

- Conventional commits: `feat(api): add csv export`, `test(api): add csv export tests`.
- Small commits — ideally one per logical step (add type enum value, add test
  scaffolding, add streaming, add route, add integration test).
- After each commit, write a brief progress note to `progress.md` (enables clean
  recovery across context windows).
- Hand the resulting branch to `project-git` for PR open.
```

This section interfaces with the `project-git` skill — the conventions here are what `project-git` will enforce when committing and PR'ing.

---

## 4. Per-mode variations

The baton's shape is consistent, but the content differs by spec mode (A through F in SKILL.md).

### From a planner slice (Mode A)

Standard baton. The spec is the source of truth; the baton points to it. Most common case.

### From a direct user task (Mode B)

The baton may inline more of the spec (since no planner slice exists upstream). First-action and acceptance signal are especially important — the coder has less surrounding context.

### From a bug fix (Mode C)

The baton's first action **must** be reproducing the bug with the failing test from spec §5. Acceptance signal includes "the regression test fails before the fix, passes after."

```markdown
**First concrete action:** Add `test_login_rejects_empty_password` to
`src/auth/login.test.ts` per spec §5. Confirm the test FAILS on `main`
(reproduces the bug). Then proceed.

**Acceptance signal:** ...
3. `git checkout main && npm test -- "rejects empty password"` exits non-zero
   (bug reproduces on main). `git checkout <fix-branch> && npm test` exits 0.
```

This makes the bug → test → fix sequence enforceable.

### From a refactor (Mode D)

The baton emphasizes the equivalence proof:

```markdown
**Acceptance signal:**

1. All existing tests pass UNCHANGED. (No test rewrites; only additions if
   characterization tests were specified.)
2. `git diff --stat` shows changes only in the files listed in spec §4.
3. Characterization tests added per spec §5 pass.
```

The "tests pass unchanged" line is the equivalence proof.

### From a spec review (Mode E)

No coder handoff — the baton routes back to whoever owns the spec, with a review summary.

### From a spec refinement (Mode F)

If a coder is mid-work and the spec was updated, the baton includes a "delta" section explaining what changed:

```markdown
**Spec delta (since v1):**

- §4 design: `csvOptions` parameter added with default value.
- §5 test plan: new test `respects_csv_options_delimiter`.
- §9 flagged: previous assumption about RFC-4180-only was wrong; now configurable.

**Resume from:** The current code path is correct for v1; the v2 delta is
additive. Pause the in-progress implementation, add the `csvOptions` parameter,
add the new test, then resume.
```

---

## 5. Worked example — a complete baton

```markdown
## Handoff baton → coder

**Spec:** `/docs/specs/2026-05-12-csv-export.md` (linked from the PR description).

**Outcome:** Add a streaming CSV export at `/export/csv` mirroring the PDF
export's shape; returns `Result<Readable, ExportError>`.

**First concrete action:** Confirm `ExportError.STREAM_FAILED` exists in
`src/api/types.ts`. If absent, add it (first commit) before any other change.
Verify by running `npm run typecheck` — no compile errors expected after the
enum addition.

**Reconfirm before coding:**
- [ ] `node:stream/promises.streamPipeline` is the codebase pattern for streaming
      (spec assumed yes; verify with one grep).
- [ ] Test colocation is the convention for `src/api/` (spec assumed yes;
      verify by listing one neighbor).
- [ ] No existing CSV utility in `@/lib/serialize` streams (spec verified;
      coder confirms by re-reading the helper).

**Acceptance signal:**
1. New tests from spec §5 (5 tests) all pass.
2. `npm run typecheck` exits 0.
3. `npm run lint -- src/api/export-csv.ts src/api/routes.ts` exits 0.
4. `npm test -- src/api/` exits 0 (existing tests unaffected).
5. Manual: `curl localhost:3000/export/csv?from=...&to=...` returns a CSV with
   header row matching `id,name,value` and rows following.

**Stop conditions:**
- Any assumption above is wrong (spec must update before code proceeds).
- The new `STREAM_FAILED` enum value breaks any existing exhaustive switch in
  the codebase (spec assumed none; if found, surface the affected switch sites).
- Backpressure handling can't be verified by the existing test pattern
  (suggests the test strategy needs adjustment).

**Commit hygiene:**
- Conventional commits, one per logical step:
  1. `feat(types): add STREAM_FAILED to ExportError`
  2. `test(api): scaffold export-csv tests (failing)`
  3. `feat(api): implement streaming csv export`
  4. `feat(api): register /export/csv route`
  5. `test(api): add integration test for /export/csv route`
- Write a progress note to `progress.md` after each commit.
- Pass to `project-git` for PR open against `main` once acceptance signal is green.
```

That baton is ~50 lines. It would be considered a heavyweight handoff for a small change; a typical baton is ~30 lines. The point: every section is content, not ceremony.

---

## 6. The coder's reverse-handoff (return to tech-lead)

When a stop condition fires, the coder returns to tech-lead with a structured response. The format mirrors the baton:

```markdown
## Reverse handoff → tech-lead

**Status:** Paused at step <X>.

**Trigger:** Stop condition #2 fired — `STREAM_FAILED` enum addition would break
an exhaustive switch at `src/dashboard/error-display.tsx:42`.

**Evidence:** [paste of the switch statement; paste of the type error]

**Asking tech-lead:**
1. Should the new enum value be handled by `error-display.tsx` (i.e., add a case)
   and if so, what should the user-facing message be?
2. Or should we revisit naming this as a separate error code?

**Suggested resolution:** Add a case to `error-display.tsx` with the message
"Stream interrupted; please retry." Confirm before I proceed.
```

This is what makes the round-trip work. The coder doesn't guess; tech-lead resolves; the coder resumes.

---

## 7. Anti-patterns

- **"Just implement the spec."** Not a baton. Missing every section.
- **Baton with no first action.** Coder spends a full context warm-up deciding where to start.
- **Baton with no stop conditions.** Coder plows through. Half-correct work.
- **Acceptance signal as vibes** ("looks good"). The coder will declare done when it's not. Specify the commands.
- **Reconfirm-assumptions list as a vague paragraph.** It's a checklist. Each item is verifiable.
- **Skipping commit hygiene.** Coder produces a single mega-commit, `project-git` can't ship cleanly.
- **Inlining the entire spec into the baton.** Defeats the purpose — the spec is a reference, the baton is the active contract.
- **Baton longer than the spec.** Wrong-sized handoff. The baton is a compressed pointer, not a re-statement.

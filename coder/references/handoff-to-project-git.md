# Handoff to project-git

> *"Hand off clean to project-git."* — Tenet 9

The slice ends with a baton to `project-git`, which handles the commit-shape and PR-shape work. The coder doesn't open the PR, write the description, or set labels — that's project-git's domain. The coder's job is to leave the branch in a clean, conventional state and to pass a structured baton that project-git can act on.

This reference defines the baton's format and what makes a clean handoff.

---

## 1. Why the separation

`project-git` and `coder` are intentionally separated because:

- **Different posture.** Coder is heads-down implementation; project-git is administrative — branch policies, PR templates, conventional messages, labels, linked issues.
- **Different inputs.** Project-git often needs context from the issue tracker, the PR template, the team's labeling conventions. Coder shouldn't be loaded with that.
- **Cleaner skills.** A coder skill bloated with PR conventions and a project-git skill bloated with coding patterns are both worse than two focused skills.

The baton is the bridge.

---

## 2. The five baton sections

| # | Section | Required? | Purpose |
|---|---|---|---|
| 1 | Slice summary | ✅ | What was done, in 1-3 sentences |
| 2 | Branch state | ✅ | Branch name, base, commit list |
| 3 | Acceptance status | ✅ | Which checks ran; results |
| 4 | Implementation report ref | ✅ | Where to find the honest report |
| 5 | Project-git directives | ✅ | Special handling: do/don't auto-merge, draft vs. ready, labels |

Every baton has all five. Missing a section is a failure mode.

---

## 3. Section-by-section

### 1. Slice summary

```markdown
**Slice:** csv-export-route
**Summary:** Added streaming CSV export at `/export/csv`, mirroring the PDF
export's shape. Five new tests; one new module (`src/api/export-csv.ts`),
one route registration update.
**Spec:** `/docs/specs/2026-05-12-csv-export.md`
**Upstream:** tech-lead handoff baton (date: 2026-05-12).
```

One paragraph. Project-git uses this for the PR title and description seed.

### 2. Branch state

```markdown
**Branch:** `feat/csv-export-route`
**Base:** `main` at `abc1234` (verified at slice start)
**Commits:**
1. `def5678` test(api): scaffold export-csv tests (failing red)
2. `ghi9012` feat(types): add STREAM_FAILED to ExportError
3. `jkl3456` feat(api): implement exportCsv streaming function
4. `mno7890` feat(api): register /export/csv route
5. `pqr1234` test(api): integration test for /export/csv route

**Diff stats:** 5 files changed, +312 insertions, +12 modifications.
```

Concrete, verifiable. project-git can confirm against `git log` and `git diff main`.

### 3. Acceptance status

The spec's handoff-to-coder baton listed an acceptance signal. The coder ran it; the result goes in this section:

```markdown
**Acceptance signal (per spec baton):**

| Check | Status | Notes |
|---|---|---|
| 5 new tests from spec §5 pass | ✅ green | `npm test -- src/api/export-csv` |
| `npm run typecheck` exits 0 | ✅ green | — |
| `npm run lint -- <new+modified files>` exits 0 | ✅ green | — |
| Existing `npm test -- src/api/` still green | ✅ green | 47 tests, all pass |
| Manual: `curl /export/csv?…` returns correct CSV | ✅ verified | Header row + 3 data rows for fixture query |

**Stop conditions encountered:** none.

**Convention deviations from spec:** none.
```

Project-git uses this to populate the PR's status / checklist and to know whether to mark "ready for review" vs "draft."

### 4. Implementation report reference

```markdown
**Implementation report:** `<inline below>` (or `<path to file>`).
```

The report itself follows in the message, or is a referenced file. See [`../assets/implementation-report.md`](../assets/implementation-report.md).

Project-git extracts:

- The honest "what didn't work" and "hacky bits" sections — these become PR comments or labels.
- The "Observations / follow-up" section — these may become follow-up tickets (with user confirmation).

### 5. Project-git directives

The coder's signals to project-git about how to handle the PR:

```markdown
**Directives:**

- [ ] Open as **draft** — no, ready for review.
- [ ] **Don't auto-merge** — no, standard policy applies.
- [ ] **Labels:** suggest `area:api`, `area:export`, `size:small`.
- [ ] **Reviewers:** none specified; use codeowner defaults.
- [ ] **Issues to link:** spec ticket #1234 (if your team threads specs to tickets).
- [ ] **Migration warning:** none.
- [ ] **Breaking change:** no.
- [ ] **Deploy notes:** none.
- [ ] **Special PR template:** default.
```

Bracketed boxes are decision points; checked = applies. The list is suggestive — project-git applies its own conventions and may override.

---

## 4. Worked example — a complete baton

```markdown
## Handoff baton → project-git

### 1. Slice summary

**Slice:** csv-export-route
**Summary:** Streaming CSV export at `/export/csv`, mirroring the PDF
export. New module `src/api/export-csv.ts`, route registration update,
5 new tests, 1 new enum variant on `ExportError`.
**Spec:** `/docs/specs/2026-05-12-csv-export.md`

### 2. Branch state

**Branch:** `feat/csv-export-route` (off `main@abc1234`)
**Commits:**
1. `def5678` test(api): scaffold export-csv tests (failing red)
2. `ghi9012` feat(types): add STREAM_FAILED to ExportError
3. `jkl3456` feat(api): implement exportCsv streaming function
4. `mno7890` feat(api): register /export/csv route
5. `pqr1234` test(api): integration test for /export/csv route

**Diff stats:** 5 files changed, +312/-12.

### 3. Acceptance status

| Check | Status |
|---|---|
| 5 new tests pass | ✅ |
| typecheck | ✅ |
| lint (new + modified files) | ✅ |
| existing tests in src/api/ unchanged | ✅ |
| manual curl check | ✅ |

Stop conditions: none. Spec deviations: none.

### 4. Implementation report

(Inline below — see implementation-report.md.)

### 5. Directives

- Open as: ready for review (not draft).
- Labels: `area:api`, `feature`, `size:small`.
- Reviewers: codeowner defaults.
- Issues: link spec #1234.
- Breaking change: no.
- Migration warning: no.
- Deploy notes: none.
```

That baton is project-git's load-bearing artifact — branch info, status, directives. Combined with the implementation report, project-git has everything it needs to open a clean PR.

---

## 5. Pre-handoff hygiene

Before passing the baton, confirm:

- [ ] All commits are pushed to the remote branch.
- [ ] `git status` is clean (no uncommitted changes, no untracked files that should be tracked).
- [ ] `progress.md` is up to date (last "Done" item matches the last commit).
- [ ] The branch builds from a fresh checkout (no missing dependencies, no environment-specific state).
- [ ] No probes, instrumentation, or debug logging left in commits. (Check via `git log -p` for `console.log`, `print`, `debugger`, `dbg!`.)
- [ ] The acceptance signal from the spec was re-run from a clean shell after the last commit, not just inferred from earlier runs.

If any of these isn't clean, fix before handing off. project-git is the consumer of your clean state, not a cleanup crew.

---

## 6. When the slice didn't fully complete

Sometimes the slice ships partial. The baton handles this honestly:

```markdown
### 1. Slice summary

**Slice:** csv-export-route — **PARTIAL**
**Summary:** Implemented exportCsv and route registration; 5 of 6 spec tests
passing. The unicode CSV test (`exports_handles_unicode_cells`) fails because
the existing serializer doesn't double-quote embedded quotes inside unicode
strings — fix is out of scope per spec §7 (csv-stringify behavior). Surfaced
to tech-lead for spec revision; in the interim, leaving the test skipped
with a `// TODO(coder, 2026-05-12)` referencing the issue.

### 2. Branch state

(...as usual...)

### 3. Acceptance status

| Check | Status | Notes |
|---|---|---|
| 5 of 6 spec tests pass | ⚠️ partial | `unicode_cells` skipped, ticketed |
| typecheck | ✅ | — |
| lint | ✅ | — |
| existing tests | ✅ | — |
| manual curl | ✅ | non-unicode rows |

Stop conditions: hit the unicode case; surfaced; user OK'd partial ship with
follow-up.

### 5. Directives

- Open as **draft** (do not merge until unicode follow-up).
- Labels: `area:api`, `feature`, `size:small`, `blocked:waiting-on-spec-rev`.
- Reviewers: defer until ready.
- Issues: link spec #1234 + follow-up #1267.
- Breaking change: no.
- Deploy notes: **do not deploy with unicode test skipped**; surface
  in PR description.
```

The partial-ship case is where honest reporting earns its keep. project-git ships the PR as draft with the right labels; the user gets clear status.

---

## 7. Anti-patterns

- **"Just open the PR."** Not a baton. project-git can't act on it without the directives, branch state, and status.
- **Baton that omits convention deviations.** project-git uses the deviations to populate PR review notes; hiding them means the review misses them.
- **Baton longer than the spec.** Compress. The baton is operational; the spec is design; the report is detail.
- **Inflating directives.** Don't suggest 8 labels and 5 reviewers if the team's convention is 1-2 labels and codeowner defaults.
- **Skipping the acceptance status table.** project-git uses it to decide draft vs. ready and to populate the PR template.
- **Treating "PARTIAL" status as a failure.** Sometimes partial is the right answer; the baton just has to be honest about it.
- **Pushing commits with debug code "I'll fix in the next commit."** No. Clean commits or no commits.
- **Auto-merge by default.** Default is "open for review." Auto-merge is a per-team policy that project-git knows.

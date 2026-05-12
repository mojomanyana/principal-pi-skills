---
id: baton-YYYY-MM-DD-<slice-slug>
from: coder
to: project-git
created: YYYY-MM-DDTHH:MM:SSZ
revision: 1
references:
  - path: <path to coding spec, or "(no spec — direct task)">
  - path: <path to implementation report, e.g., docs/reports/payment-flow-S2.md>
  - path: <upstream baton from tech-lead, if any>
objective: |
  <One to three sentences. What project-git should do. Bad: "Open a PR."
  Good: "Open a PR for the payment-flow-S2 branch (clean acceptance,
  no migrations), request review from <reviewer>, link issue #142.
  Don't auto-merge — needs manual review of the timeout-handling change.">

kill_criteria:
  - <The branch isn't clean (working tree dirty, untracked files matter)>
  - <Secrets detected in staged diff>
  - <Acceptance is partial — see §3 and §5 of the body>
  - <Force-push to a protected branch is requested but not pre-authorized>

return_contract:
  artifacts:
    - "## Facts block" — see project-git/references/delegation-contract.md
  status: complete | partial | failed
  facts_block_required: true

# Transition-specific:
branch: <branch-name>
base_commit: <base SHA where branch was cut>
commits:
  - sha: <sha>
    message: <conventional-commits message>
  # List all commits on the branch, oldest first.

acceptance_status: all-pass | partial | failed
acceptance_details:
  spec_tests: <count passing / count total>
  typecheck: green | yellow | red
  lint: green | yellow | red
  existing_tests: green | yellow | red
  manual_verification: yes | no | n/a

implementation_report:
  path: <path>

flags_for_git:
  - <Special instruction 1, e.g., "don't auto-merge — needs manual review">
  - <Special instruction 2, e.g., "this PR closes issue #142">
  # Empty array if no special instructions
---

# Handoff Baton → project-git

<!--
  Structured pickup for project-git. Five sections; every section required.
  This baton accompanies (or follows) the implementation report.

  Project-git takes this and produces: PR shape, description, labels,
  reviewers, branch state confirmation, and merge logistics.

  Keep this BATON compact. The implementation report is the long form;
  the baton is operational.

  The YAML frontmatter above carries the machine-parseable spine + transition fields.
  The markdown sections below carry the human-readable context.
  See BATON.md at the repo root for the full schema.
-->

## 1. Slice summary

**Slice:** `<slice-name>`
**Summary:** <1-3 sentences in user-facing terms>
**Spec:** `<path to spec, or "(no spec — direct task)">`
**Upstream:** <previous skill, e.g., "tech-lead handoff baton, 2026-05-12">

---

## 2. Branch state

**Branch:** `<branch-name>` (off `<base>@<commit-sha>`)
**Base verified at slice start:** ✅ | ⚠️ rebased mid-slice (note: `<reason>`)

**Commits (oldest first):**

| SHA | Message |
|---|---|
| `<sha>` | `<conventional-commits message>` |
| `<sha>` | ... |
| `<sha>` | ... |

**Diff stats:** `<N>` files changed, `+<insertions>` / `-<deletions>`.

**Pushed to remote:** ✅ | ⚠️ pending (note: `<reason>`)

---

## 3. Acceptance status

<!--
  Re-run from a clean shell after the last commit. Don't infer from
  earlier runs.
-->

| Check | Status | Notes |
|---|---|---|
| Spec test 1: `<test-name>` | ✅ green | — |
| Spec test 2: `<test-name>` | ✅ green | — |
| ... | ... | ... |
| Typecheck | ✅ green | — |
| Lint (new + modified files) | ✅ green | — |
| Existing tests in `<scope>` | ✅ green | no regressions |
| Manual verification: `<command>` | ✅ verified | `<key output>` |

**Overall acceptance: ✅ all checks pass** | ⚠️ partial — see §5

**Stop conditions encountered:** none | `<list>`

**Convention deviations from spec:** none | `<see implementation report §4>`

---

## 4. Implementation report

**Location:** `<inline below | <path-to-report>>`

Brief highlights for project-git's attention:

- `<convention deviation worth noting in PR>` (see report §4)
- `<observation worth filing as follow-up issue>` (see report §10)
- `<hacky bit that affects review attention>` (see report §5)

(or "Standard implementation; no special highlights — see report for detail.")

---

## 5. Directives for project-git

<!-- Bracketed checkboxes are suggestions; project-git applies team conventions. -->

**PR open as:**
- [ ] **Ready for review** (default)
- [ ] **Draft** (reason: `<e.g., partial completion, waiting on follow-up>`)

**Merge handling:**
- [ ] **Standard** (default — use team's normal merge policy)
- [ ] **Don't auto-merge** (reason: `<e.g., needs manual deploy review>`)
- [ ] **Squash on merge** (reason: `<e.g., 12 small commits, squash for cleaner history>`)

**Suggested labels:** `<label-1>`, `<label-2>`, `<label-3>`

**Suggested reviewers:** `<usernames>` (or "codeowner defaults")

**Issues to link:** `#<number>` (spec ticket), `#<number>` (related)

**Breaking change?** ❌ no | ⚠️ yes — `<describe; migration in §6>`

**Migration / deploy notes:**

- `<note if the deploy needs special handling>` (e.g., "feature flag `<name>` controls rollout; default off")
- `<note if there's a data migration>` (e.g., "DB migration in commit `<sha>`; non-destructive; safe to deploy ahead of code")
- (or "none")

**Special PR template:** default | `<name>`

---

## 6. Partial / blocked status (only if applicable)

<!-- Fill in only if §3 says partial. Otherwise omit this section. -->

**What's not done:**

- `<item>` because `<reason>`. Status: `<skipped | waiting on tech-lead | needs follow-up slice>`.

**What the user / reviewer should know:**

- `<note>`
- `<note>`

**Recommended next step:**

- `<suggestion: continue this slice once X resolved | open a follow-up slice | revise spec | etc.>`

---

## Quick checklist before handing off

Before passing this baton, the coder confirms:

- [ ] All commits pushed to the remote branch.
- [ ] `git status` is clean (no uncommitted changes; no stray untracked files).
- [ ] `progress.md` updated (last entry matches the last commit's intent).
- [ ] Acceptance signal re-run from a clean shell after the last commit.
- [ ] No probes, debug prints, or commented-out code in any commit.
- [ ] Implementation report written.
- [ ] This baton filled in completely.

If any check is unchecked, the slice isn't ready for project-git. Fix first.
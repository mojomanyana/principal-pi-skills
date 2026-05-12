# Pull Request Craft

A pull request is two artifacts in one: the diff (the actual change) and the body (the human-readable explanation). Most PR advice focuses on the diff. This reference focuses on the body, the lifecycle, and the craft of getting from "I have a branch" to "merged and deployed" without the workflow getting in the way.

Covered:

1. Title craft.
2. Body structure — what every PR should explain.
3. The draft → ready-for-review pattern.
4. Reviewer assignment (manual and CODEOWNERS).
5. Responding to review with fixup commits.
6. Stacked PRs.
7. Merge strategies.
8. Auto-merge.
9. The full `gh pr` command reference.

---

## 1. Title craft

A PR title follows the same rules as a commit subject — and if the PR is destined for a squash-merge, it *becomes* the commit subject. Treat it that way.

- **Conventional Commit prefix** (matching the dominant change): `feat(auth): ...`, `fix(payments): ...`, `docs(adr): ...`.
- **Imperative, under 70 chars, lowercase after the prefix, no trailing period.**
- **Specific enough to be useful in `git log` after squash-merge.**

### Good
```
feat(auth): add OAuth2 callback handler with state validation
fix(payments): handle null response from Stripe webhook (#142)
docs(adr-0007): record decision to migrate Postgres → CockroachDB
refactor(db): extract connection pooling into a separate module
```

### Bad
```
Fix bug                            # not specific
Update                             # information-free
WIP: OAuth                         # never push WIP to a real PR (use draft mode instead)
Adding OAuth callback handler.     # gerund + trailing period
[FEATURE] OAuth                    # don't put status in the title; use labels
```

---

## 2. Body structure

A good PR body answers four questions:

1. **What changed?** (high level — the diff has the details)
2. **Why?** (motivation, link to issue/ADR)
3. **How was it tested?** (so reviewers can trust the change works)
4. **What are the risks / rollout considerations?**

### Template

```markdown
## What
One-paragraph summary of the change. Reference any ADR or design doc.

## Why
The motivation. Link the issue: Closes #142.

## How it works (optional, for substantive changes)
Brief description of the implementation approach. Anything non-obvious — why
this approach over an alternative, what tradeoffs were made.

## Tests
- [ ] Unit tests for new code path.
- [ ] Integration test for the end-to-end flow.
- [ ] Manual verification: <what you did>.
- [ ] Existing tests still pass.

## Screenshots / recordings (for UI changes)
<paste images or GIFs>

## Rollout / risk
- [ ] Backward compatible? If not, what's the migration?
- [ ] Feature flag? If yes, which.
- [ ] Database migration? If yes, is it reversible?
- [ ] Performance impact? (any benchmark numbers)
- [ ] Rollback plan if something breaks.

## Related
- Closes #142
- Refs #138 (related but not closed)
- ADR: /docs/adr/0007-postgres-to-cockroach.md
```

### Trimming the template

Not every PR needs every section. A dependency bump doesn't need a screenshots section. A doc PR doesn't need a rollout plan. **Keep relevant sections; cut empty ones.** A PR body with three populated sections is more useful than one with eight `N/A`s.

### The smallest acceptable body

```markdown
## What
Bump typescript from 5.3 to 5.4. Release notes: <link>.

## Why
Stay current with patch releases; 5.4 includes the inferType fix we hit in #138.

Closes #138.
```

That's the floor. If you can't write at least that, the PR shouldn't be open.

---

## 3. Draft → ready-for-review

A PR can be opened as a **draft**. Drafts:

- Run CI (so you get fast feedback).
- Aren't requesting review yet (CODEOWNERS reviewers aren't notified).
- Can't be merged (until marked ready).
- Show clearly in lists as in-progress.

Use draft mode for:
- Early sharing — "here's the shape, look at this approach before I polish."
- Stacked PRs (the dependent PRs stay as drafts until the base lands).
- Long-running features being merged incrementally behind a feature flag.

```bash
# Create as draft
gh pr create --draft --title "..." --body "..."

# Convert to ready-for-review
gh pr ready 142

# Convert back to draft (rare; usually used when significant rework happens mid-review)
gh pr ready 142 --undo
```

### The default: open ready-for-review when the work is genuinely done

Don't draft-and-forget. Drafts that linger for weeks become noise in the team's PR list. Either polish and mark ready, or close until the work resumes.

---

## 4. Reviewer assignment

Two paths.

### Explicit assignment

```bash
gh pr create ... --reviewer alice,bob
gh pr edit 142 --add-reviewer carol
gh pr edit 142 --remove-reviewer bob
```

When delegated from another skill, the calling agent typically specifies reviewers explicitly.

### CODEOWNERS-driven

If the repo has `.github/CODEOWNERS`, GitHub auto-requests reviews from the owners of touched files when the PR is marked ready. CODEOWNERS structure:

```
# Default reviewers
* @org/core-team

# Areas
/auth/         @alice @org/auth-team
/payments/     @bob @org/payments-team
/docs/adr/     @org/architecture-team

# Specific files
package.json   @org/maintainers
.github/       @org/devops
```

Patterns follow gitignore-style globs. Multiple owners on a line are all requested. Teams are requested via `@org/team-name`.

See [repo-admin.md](repo-admin.md) for setting up CODEOWNERS, and `assets/codeowners-starter.md` for a template.

### Branch protection: required reviews

A repo can require N approvals before merge via branch protection rules. This skill doesn't set those; it respects them (i.e., it won't try to merge until they're met).

---

## 5. Responding to review feedback

Reviewers leave inline comments, request changes, or approve. The author responds.

### Make changes as fixup commits, not rewrites

When the PR is in review, **don't rewrite history** on the branch. Reviewers tracking your branch have specific commit SHAs in mind for "what I've already reviewed." Force-pushing a rewritten history breaks that trail.

Instead, address each feedback item as a small commit (or fixup commit). When all feedback is addressed:

```bash
# After making the fix
git add <files>
git commit --fixup=<sha-of-original-commit>
git push

# Comment on the PR explaining what was addressed
gh pr comment 142 --body "Addressed feedback: state validation now uses constant-time comparison (see fixup commit a3f2e91)."

# Re-request review
gh pr edit 142 --add-reviewer alice
```

### When to clean up fixups

Right before merging (and only if the PR will be merged with "Create a merge commit" or "Rebase and merge"). For squash-merge, the fixups disappear into one commit anyway — leave them.

```bash
# Final cleanup before merge
git rebase -i --autosquash main
git push --force-with-lease
```

### "Request changes" vs "Comment"

Some teams treat "Request changes" as blocking; others treat any unresolved comment as blocking. Know your team's norm. From the author side: respond to every comment (even with just 👍 or "Resolved by fixup a3f2e91"), and resolve threads when addressed.

---

## 6. Stacked PRs

When a feature is too large for one PR but the work has natural dependencies (PR B depends on PR A's changes being merged), stack them:

- PR A: base = `main`, head = `feat/auth-1-models`
- PR B: base = `feat/auth-1-models`, head = `feat/auth-2-handlers`
- PR C: base = `feat/auth-2-handlers`, head = `feat/auth-3-tests`

PRs A, B, C can be reviewed in parallel. As each merges (in order), the next one's base is updated automatically by GitHub (with `Edit` → `change base branch`, or it's handled if you use a tool).

### Tools

- `git-spr` (silicon valley pattern); `graphite` (commercial CLI); `gh-stack`; or manual.
- Manual stacking works fine for 2–3 PRs. Beyond that, tooling pays off.

### Anti-patterns

- **One giant PR** that should have been a stack. Reviewer fatigue, conflict surface, slow CI.
- **Stack of >5 PRs**. The first one not merging blocks all of them.
- **Non-linear stack** (PR A and PR B both off `main`, but reviewer wants A first). That's not a stack; that's two PRs.

---

## 7. Merge strategies

GitHub offers three merge buttons. Pick one per repo (configure others as disabled in repo settings to keep `main` consistent).

| Strategy | Effect on main | When |
|----------|----------------|------|
| **Squash and merge** | One commit per PR, message from PR title/body | Short PRs (1–5 commits) or messy per-commit history. Most common default. |
| **Create a merge commit** | All PR commits preserved + one merge commit | Substantive features with meaningful per-commit history (autosquash discipline upstream). |
| **Rebase and merge** | Each PR commit replayed on main with new SHAs, no merge commit | Strictly-linear-main teams. |

A reasonable default: **squash-merge on**, **merge commit available for opt-in** (toggled per PR when the author has clean per-commit history), **rebase-and-merge off**.

### Squash-merge body craft

When squash-merging, the commit message defaults to:
- Subject: PR title
- Body: PR description

Edit before merge if the description has noise (template sections that didn't get filled, etc.). The committed message lives on `main` forever.

---

## 8. Auto-merge

GitHub can auto-merge a PR when:
- All required reviews are approved.
- All required status checks pass.
- The branch is up-to-date with base (if required).

```bash
# Enable auto-merge with a specific strategy
gh pr merge 142 --auto --squash
gh pr merge 142 --auto --merge
gh pr merge 142 --auto --rebase

# Disable
gh pr merge 142 --disable-auto
```

Useful when you're confident in the change and don't need to be online when CI greenlights. Less useful when reviewers tend to leave nits — you may want to be present for the merge.

---

## 9. Merge queue

For high-velocity repos, GitHub's merge queue serializes merges and re-runs CI against each PR in queue order. Prevents the "two PRs are green but break each other when both land" failure.

```bash
gh pr merge 142 --auto                    # joins the queue (if enabled)
```

Merge queue is configured in repo settings → Branches → Branch protection rules → "Require merge queue."

---

## 10. The `gh pr` command reference

```bash
# Create
gh pr create --title "..." --body "..." --base main --reviewer alice,bob --assignee "@me" --label "feature" --milestone "v1.2"
gh pr create --draft --title "..." --body-file ./pr-body.md
gh pr create --fill                       # use commit details for title/body (one-commit PRs)

# List
gh pr list                                # open, in current repo
gh pr list --state all
gh pr list --author "@me"
gh pr list --base main --search "is:open review-requested:@me"
gh pr list --json number,title,headRefName,author --limit 50

# View
gh pr view 142
gh pr view 142 --comments
gh pr view 142 --json number,title,body,reviewDecision,statusCheckRollup
gh pr diff 142

# Check out the PR locally
gh pr checkout 142

# Edit
gh pr edit 142 --title "..."
gh pr edit 142 --body "..."
gh pr edit 142 --body-file ./pr-body.md
gh pr edit 142 --add-label "..." --remove-label "..."
gh pr edit 142 --add-reviewer carol --remove-reviewer bob
gh pr edit 142 --base develop             # change base branch (for restacking)
gh pr edit 142 --milestone "v1.2.0"

# Review
gh pr review 142 --approve --body "LGTM"
gh pr review 142 --request-changes --body "See inline"
gh pr review 142 --comment --body "..."

# Ready / draft
gh pr ready 142
gh pr ready 142 --undo                    # convert back to draft

# Checks
gh pr checks 142
gh pr checks 142 --watch                  # tail until done

# Merge
gh pr merge 142 --squash
gh pr merge 142 --merge
gh pr merge 142 --rebase
gh pr merge 142 --auto --squash
gh pr merge 142 --delete-branch           # remove the head branch after merge
gh pr merge 142 --subject "..." --body "..."   # override the merge commit message

# Close (without merging)
gh pr close 142 --comment "Closing in favor of #200"
gh pr reopen 142
```

---

## 11. PR templates

`.github/PULL_REQUEST_TEMPLATE.md` preloads the PR body. See `assets/pr-template.md` for a starter.

For multi-template repos (e.g., different bodies for bug-fix PRs vs feature PRs), use the query-string convention:
```
https://github.com/org/repo/compare/main...feat/x?template=feature.md
```

with templates in `.github/PULL_REQUEST_TEMPLATE/feature.md`, etc.

---

## 12. Anti-patterns

- **Empty PR body** — there's no excuse. At least one line saying what and why.
- **"WIP" in title with no draft mode** — use the draft button.
- **Force-pushing while review is in progress** — breaks reviewers' tracking. Use fixup commits.
- **Mega-PR (>500 lines, >20 files, multiple concerns)** — split it. Reviewer fatigue → rubber stamping → bugs.
- **PR with no linked issue** — for any non-trivial change, there should be an issue (or ADR, or design doc) the PR is implementing. Drive-by changes are a smell.
- **Self-approve to bypass review** — if the team has required reviews, respect them. If a self-merge is genuinely needed (e.g., emergency hotfix), document it in the PR body.
- **Reviewing your own draft to mark it ready** — that's not what "ready for review" means.

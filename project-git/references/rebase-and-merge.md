# Rebase and Merge

The single most contentious topic in git workflow. The technical answer is: both rebase and merge are valid, they produce different histories, and the right choice depends on whether you're shaping local work or integrating shared work. The cultural answer is: pick a team convention and stick to it.

This reference covers:

1. The decision rule — when rebase, when merge.
2. Interactive rebase — the workhorse for cleaning up local history.
3. Autosquash and fixup commits — the polished workflow.
4. Conflict resolution craft.
5. `rerere` — git's "remember conflict resolutions" feature.

---

## 1. The decision rule

There's one clear rule and one judgment call.

### The rule

**Never rebase commits that have been pushed to a branch shared with others.** Rebasing rewrites commit SHAs; anyone with the old SHAs has a divergent history. The cost of restoring everyone is high; the cost of just merging is zero. This is non-negotiable; see [safety-and-secrets.md §2](safety-and-secrets.md) for the policy that flows from it.

The exception: branches that are explicitly yours alone (a feature branch you opened, no one else has pulled). You can rebase those freely until you publish them for review.

### The judgment call

For unshared work — your local feature branch, before opening a PR — rebase or merge has these tradeoffs:

| | Rebase | Merge |
|---|--------|-------|
| History shape | Linear, clean | Branching, true |
| Bisect ergonomics | Excellent | Good |
| Records when integration happened | No | Yes |
| Easier to revert a feature wholesale | No (commits are scattered) | Yes (revert the merge commit) |
| Preserves PR context | Sometimes lost | Always preserved |
| Conflicts during integration | One commit at a time | All at once |

A common house style:

- **Rebase your own feature branch onto `main`** before opening the PR (or before requesting re-review after stale conflicts). Keeps the PR's diff easy to read.
- **Merge the PR into `main` via a squash-merge or a merge commit** at the end. Squash for short branches; merge commit for branches with meaningful per-commit history.

This is the GitHub default and a reasonable starting point.

---

## 2. Interactive rebase — the workhorse

`git rebase -i` opens a TODO list of commits and lets you reorder, edit, squash, and drop. It's how you turn a messy local branch into a clean PR.

```bash
# Rebase the last N commits
git rebase -i HEAD~5

# Or rebase relative to a branch
git rebase -i main
git rebase -i origin/main
```

The editor opens with something like:
```
pick a3f2e91 feat(auth): add OAuth callback handler
pick b7c1d2f WIP: testing
pick c8d3e4f fix typo
pick d9e4f5a feat(auth): add session refresh
pick e0f5a6b WIP: more testing
```

### The TODO commands

- `pick` (or `p`) — keep the commit as-is
- `reword` (or `r`) — keep the commit but rewrite its message
- `edit` (or `e`) — pause on this commit so you can modify the files (then `rebase --continue`)
- `squash` (or `s`) — combine into the previous commit, concatenate the messages
- `fixup` (or `f`) — combine into the previous commit, discard this message
- `drop` (or `d`) — remove the commit entirely
- (reorder lines) — to change commit order

A common cleanup:
```
pick a3f2e91 feat(auth): add OAuth callback handler
fixup b7c1d2f WIP: testing
fixup c8d3e4f fix typo
pick d9e4f5a feat(auth): add session refresh
fixup e0f5a6b WIP: more testing
```

Result: 5 messy commits → 2 clean ones (callback handler, session refresh), with the WIPs folded into the appropriate target.

### Aborting mid-rebase

```bash
git rebase --abort        # bail out, restore the pre-rebase state
git rebase --continue     # after resolving conflicts, continue
git rebase --skip         # skip the current commit being applied (rare)
```

If you've botched the rebase past --abort, see [recovery.md §8](recovery.md) for using the reflog to undo.

---

## 3. Autosquash and fixup commits

The polished workflow. Instead of cleaning up at the end, mark commits as fixups as you go. When you rebase with `--autosquash`, git auto-organizes them.

### The flow

```bash
# Make the fix; note which commit it should fold into
git log --oneline -10
# → a3f2e91 feat(auth): add OAuth callback handler

# Make a fixup commit targeting that SHA
git add <changed-files>
git commit --fixup=a3f2e91

# Later (when ready to clean up before pushing):
git rebase -i --autosquash main
```

Git pre-populates the TODO list with the fixup commits already adjacent to their targets and marked `fixup`:
```
pick a3f2e91 feat(auth): add OAuth callback handler
fixup b7c1d2f fixup! feat(auth): add OAuth callback handler
pick d9e4f5a feat(auth): add session refresh
```

You just save the editor without changes; git does the work.

### Enable autosquash by default

```bash
git config --global rebase.autosquash true
```

Now plain `git rebase -i main` auto-organizes fixups too.

### Reword with `--fixup=reword:<sha>`

To rewrite a commit's message during autosquash (without changing the diff):
```bash
git commit --fixup=reword:a3f2e91
# Opens editor for the new message
```

When rebased with `--autosquash`, this rewords the target commit.

---

## 4. Rebase vs `pull --rebase`

A common quality-of-life setting:

```bash
git config --global pull.rebase true
git config --global pull.ff only
```

This makes `git pull` rebase your local commits on top of the remote rather than creating merge commits. Result: linear history on your feature branches, no "Merge branch 'main' of origin..." noise.

Alternative explicit forms:
```bash
git pull --rebase
git pull --ff-only
```

`--ff-only` refuses to merge if a fast-forward isn't possible — forces you to explicitly choose rebase or merge.

---

## 5. Conflict resolution craft

Conflicts happen during rebase, merge, cherry-pick, and `stash pop`. The mechanics are the same.

### Reading a conflict

```
<<<<<<< HEAD
your code (current branch)
=======
their code (incoming branch or commit)
>>>>>>> b7c1d2f (subject of conflicting commit)
```

The `HEAD` side is "what's already in this branch"; the `>>>>>>>` side is "what's being applied." During rebase, this is inverted from what you might expect: `HEAD` is the commit you're rebasing onto, `>>>>>>>` is your local commit being replayed. During merge, `HEAD` is your current branch, `>>>>>>>` is the branch being merged in.

### Resolution strategies

```bash
# See what's conflicted
git status

# Use a 3-way merge tool (with parent context)
git mergetool                 # opens your configured tool

# Or just edit the file manually
# Remove conflict markers; keep the right combination of both sides.

# Mark as resolved and continue
git add <file>
git rebase --continue          # or git merge --continue or git cherry-pick --continue
```

### Tools that help

- `git mergetool` with VS Code, IntelliJ, Beyond Compare, kdiff3.
- `git diff` (no arguments) during conflict shows merged-diff form.
- `git checkout --ours <file>` or `git checkout --theirs <file>` to wholesale take one side. (During rebase, "ours" and "theirs" are inverted; verify before using.)
- `git log --merge -p <file>` to see the conflicting commits' diffs side by side.

### When a conflict feels wrong

If you keep getting the same conflict every time you rebase your feature branch on `main`, something is structurally off:

- The feature branch is too long-lived (see [branching-strategies.md §8](branching-strategies.md)).
- Two branches are touching the same code in incompatible ways — coordinate with the other author.
- The conflict resolution requires understanding code that's not yours — pull in the author.

Conflicts are a communication signal, not just a chore.

---

## 6. rerere — remember conflict resolutions

`rerere` ("reuse recorded resolution") records how you resolved a conflict. Next time the same conflict appears, git applies the recorded resolution automatically.

```bash
# Enable once
git config --global rerere.enabled true
```

Useful when:
- You're rebasing the same feature branch repeatedly (incremental rebases against a moving `main`).
- A merge has been aborted and you'll do it again.
- A complex merge needs to be redone after `--abort`.

The recordings are per-repo (`.git/rr-cache/`). They don't sync between machines.

---

## 7. Merge strategies — when merging is the answer

`git merge` has several modes:

```bash
# Fast-forward only (refuses if a merge commit would be needed)
git merge --ff-only feat/x

# Always create a merge commit (preserves the branch shape in history)
git merge --no-ff feat/x

# Squash-merge — collapse all commits on feat/x into one new commit on current branch
git merge --squash feat/x
# (note: this leaves the merge unfinished; you commit it yourself)
git commit -m "feat(auth): OAuth flow (#142)"
```

### Which on the PR side?

GitHub's merge button offers three:

- **Create a merge commit** — preserves the per-commit history of the branch. Good for substantial features with meaningful commit history.
- **Squash and merge** — flattens the branch into one commit on `main`. Good for short branches where the per-commit history is noise.
- **Rebase and merge** — replays each commit onto `main` linearly, with new SHAs. Preserves per-commit history without a merge commit. Used by teams that want strictly linear history.

A reasonable default:
- **Squash-merge** for branches under ~5 commits or where the per-commit history is messy.
- **Merge commit** for branches with meaningful per-commit history (often: features built with autosquash discipline).
- **Rebase and merge** only if the whole team has agreed on strictly linear `main`.

Pick one per repo and configure it as the default + disable the others in repo settings. Mixed-strategy `main` becomes confusing fast.

---

## 8. The "rebase before merge" workflow (recommended)

A common, well-balanced workflow for a GitHub Flow repo:

1. Branch off `main`: `git switch -c feat/oauth`.
2. Commit freely, including fixups: `git commit --fixup=<sha>` as needed.
3. Periodically catch up to `main`: `git fetch && git rebase origin/main` (or `pull --rebase`).
4. Before opening the PR, clean up: `git rebase -i --autosquash main`.
5. Force-push the cleaned branch (it's still your own branch): `git push --force-with-lease`.
6. Open the PR; review happens.
7. On review feedback, make fixup commits (don't rewrite existing commits at this point; that confuses reviewers tracking your branch). `git commit --fixup=<sha>` + `git push`.
8. Before merge: optional final `rebase -i --autosquash main` to clean up reviewer-feedback fixups, then `--force-with-lease`. Then merge.
9. Merge via squash (short branch) or merge commit (substantive history).

After merge, delete the branch (locally and remotely).

---

## 9. Quick reference

| Situation | Command |
|-----------|---------|
| Clean up local commits before push | `git rebase -i HEAD~N` or `git rebase -i main` |
| Fold a fix into an earlier commit | `git commit --fixup=<sha>` + `git rebase -i --autosquash main` |
| Catch up your branch to main | `git fetch && git rebase origin/main` or `git pull --rebase` |
| Abort a botched rebase | `git rebase --abort` |
| Continue after resolving conflicts | `git add . && git rebase --continue` |
| Reword a not-most-recent commit | `git commit --fixup=reword:<sha>` + `git rebase -i --autosquash` |
| Squash a feature branch into one commit at merge | GitHub's "Squash and merge" button, or `git merge --squash` locally |
| Force-push your own rebased branch | `git push --force-with-lease` (never plain `--force`) |
| Refuse force-push on protected branches | (default behaviour of this skill — see SKILL.md tenet 3) |

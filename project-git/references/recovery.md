# Recovery

Almost everything in git is recoverable. The reflog records every change to where HEAD pointed for at least 30 days (often 90). If you can find an old SHA in the reflog, you can resurrect the work it pointed to. This reference is a playbook of common "I broke something" scenarios and the recipes that fix each.

The general doctrine:

1. **Never panic-act on a destructive operation.** Especially `git reset --hard` and `git push --force`. Pause, read state, then act.
2. **The reflog is your friend.** Even commits "lost" to reset, rebase, or amend are usually still in the reflog.
3. **Local recovery is almost always possible.** Remote recovery may require coordination if others have pulled the bad state.
4. **Some things are not recoverable.** Untracked files deleted by `git clean -f`. Files never staged before `git reset --hard` clobbered them. A repo deleted on the remote with no local clone left.

---

## 1. The reflog — the universal undo

The reflog is git's local journal of every change to HEAD and to each branch's tip. It's per-repository and per-clone, so a teammate's reflog won't help you. But your own reflog is gold.

```bash
# Show HEAD's history of moves
git reflog

# Show a specific branch's history
git reflog show main

# Get back to where HEAD was 5 moves ago
git reset --hard HEAD@{5}

# Or by relative time
git reset --hard HEAD@{1.hour.ago}
git reset --hard 'HEAD@{yesterday}'
```

Each reflog entry has the form `<sha> HEAD@{N}: <operation>`. The operation tells you what moved HEAD — `commit`, `reset:`, `rebase:`, `checkout:`, `merge:`, `pull:`. You can almost always find the SHA right before something went wrong.

### Default retention

- Reachable commits: kept indefinitely.
- Unreachable commits (orphaned by reset/rebase/amend): kept 90 days by default (`gc.reflogExpireUnreachable`), then garbage collected.

If recovery is needed weeks after the fact, retention may have run out — but the default 90 days is generous, and `git gc` doesn't run automatically that aggressively. Most "lost" commits are still findable.

---

## 2. Scenario: I committed to the wrong branch

You meant to commit to `feat/oauth` but you're on `main`, and the commit is now on main locally. You haven't pushed.

```bash
# 1. Note the commit SHA
git log -1 --format="%H %s"   # → a3f2e91 "feat(auth): ..."

# 2. Switch to (or create) the correct branch
git switch -c feat/oauth      # creates from current HEAD, which still includes the misplaced commit

# 3. Drop the commit from main
git switch main
git reset --hard HEAD~        # if there's only one stray commit
# Or for multiple: git reset --hard <sha-of-last-good-commit-on-main>

# 4. Confirm
git log --oneline -5          # main is back to where it should be
git switch feat/oauth
git log --oneline -5          # the commit is here now
```

### If you already pushed to main

Then the misplaced commit is on the remote. Two paths:

**Path A — revert (preferred, non-destructive):**
```bash
git switch main
git revert <sha-of-misplaced-commit>
git push origin main
# Now cherry-pick or rebuild the work on the correct branch
git switch -c feat/oauth
git cherry-pick <sha-of-misplaced-commit>
git push -u origin feat/oauth
```

**Path B — force-push (destructive; requires protected-branch override):**
Only if main is genuinely not shared (rare) or the override is explicit. See [safety-and-secrets.md](safety-and-secrets.md).

---

## 3. Scenario: I `git reset --hard`'d and lost commits

Classic. You ran `git reset --hard HEAD~3` thinking it would do something else.

```bash
# 1. Check the reflog — your commits are still there
git reflog
# Look for the entry just before the reset:
#   a3f2e91 HEAD@{0}: reset: moving to HEAD~3
#   b7c1d2f HEAD@{1}: commit: feat(auth): final
#   ...

# 2. Recover by resetting to the pre-reset SHA
git reset --hard HEAD@{1}     # or HEAD@{<n>}, or directly the SHA b7c1d2f
```

### If `git reset --hard` also clobbered uncommitted work

This is the painful case. `--hard` discards uncommitted changes too, and those were never committed, so the reflog can't help (it tracks commits, not working-tree state).

Last resort: search the object database for blobs git may have written.

```bash
# List all dangling blobs (objects with no commit pointing at them)
git fsck --lost-found

# Examine a dangling blob
git show <blob-sha>
```

If the file was staged (even briefly) before the reset, the blob is likely there. If it was unstaged, it's gone. This is why pre-flight (`git status` before `reset --hard`) matters.

---

## 4. Scenario: I committed too much (need to split a commit)

You made a commit that should have been two or three. Not yet pushed.

```bash
# 1. Undo the commit but keep the changes staged
git reset --soft HEAD~

# 2. Or, undo and unstage (keep working-tree changes)
git reset HEAD~

# 3. Now re-stage selectively with add -p (see commit-craft.md §3)
git add -p
git commit -m "feat(auth): add OAuth callback handler"

# Repeat for the next logical group
git add -p
git commit -m "test(auth): cover OAuth callback edge cases"
```

If the commit is **not the most recent one** but is still local-only, use interactive rebase:

```bash
git rebase -i <commit-before-the-one-to-split>
# In the editor, change "pick <sha>" to "edit <sha>" for the commit to split
# When rebase pauses on that commit:
git reset HEAD~
git add -p
git commit -m "first piece"
git add -p
git commit -m "second piece"
git rebase --continue
```

---

## 5. Scenario: I pushed something bad

Two cases.

### Case A — bad code, not a leak

A non-destructive `git revert` is almost always the right answer. It creates a new commit that undoes the bad one; history is preserved; teammates' clones don't diverge.

```bash
git revert <sha-of-bad-commit>
# Edit the auto-generated commit message if you want
git push origin <branch>
```

Multiple commits to revert:
```bash
git revert <oldest>..<newest>         # creates one revert commit per bad commit
git revert -n <oldest>..<newest> && git commit -m "revert: ..."   # single combined revert
```

### Case B — a leak (secret, PII, large file you can't afford to keep in history)

This is the case where revert is **not** enough — the bad content stays in history regardless. You need to rewrite history. See [safety-and-secrets.md §3](safety-and-secrets.md) for the full playbook. Summary:

1. **ROTATE FIRST.**
2. Mirror-clone the repo.
3. `git filter-repo --invert-paths --path <file>` or `--replace-text <patterns>`.
4. Force-push (requires explicit override on protected branches).
5. Notify everyone with a clone to re-clone or hard-reset.

---

## 6. Scenario: I lost a branch

You deleted a local branch and now realize you needed it. If the branch was pushed, just refetch:

```bash
git fetch origin
git switch -c <branch-name> origin/<branch-name>
```

If the branch was local-only:

```bash
# Find the last SHA the branch pointed at via reflog
git reflog
# Look for: <sha> HEAD@{N}: checkout: moving from <branch-name> to ...

# Or query the reflog of the branch itself (works even after deletion sometimes)
git reflog show <branch-name>

# Recreate the branch
git switch -c <branch-name> <sha>
```

If the reflog has expired or doesn't have it:
```bash
git fsck --lost-found
# Examine dangling commits to find the tip
git show <dangling-commit-sha>
```

---

## 7. Scenario: I want to undo a `git pull` (merge or rebase made it worse)

If the pull did a **merge**:
```bash
git reset --hard ORIG_HEAD       # ORIG_HEAD is set by pull/merge to the pre-merge state
```

If the pull did a **rebase**:
```bash
git rebase --abort               # if mid-rebase
# Or, if rebase completed and you want to undo:
git reset --hard ORIG_HEAD
```

`ORIG_HEAD` is set by pull, merge, rebase, and reset — it's the "previous tip" snapshot. Convenient for one-step undo.

---

## 8. Scenario: I have a botched rebase mid-conflict

```bash
# Want out, restore previous state
git rebase --abort

# Want to skip the current commit being rebased
git rebase --skip

# Want to fix the conflict and continue
# (after resolving conflicts in editor)
git add <resolved-files>
git rebase --continue
```

If you're really lost and `rebase --abort` doesn't bring you back:
```bash
git reflog
# Find the "rebase (start)" or pre-rebase entry, then:
git reset --hard <that-sha>
```

---

## 9. Scenario: I committed credentials (the full incident response)

The end-to-end playbook. Each step is mandatory; do not skip:

### Step 1 — ROTATE FIRST

The exposure window is "committed (and pushed)" → "credential is dead". Rotate before anything else. See [safety-and-secrets.md §3 Step 1](safety-and-secrets.md) for the rotation matrix.

### Step 2 — Confirm rotation in chat

The skill waits for the user to say "rotated, proceed" before continuing. This is non-negotiable; rewriting history before rotation leaves the secret active and exposed.

### Step 3 — Identify scope

```bash
# Which commits touch the leaked file?
git log --all --full-history -- path/to/.env

# Which commits added a specific string?
git log --all -S '<part of the secret>' --source

# Which branches contain the bad commit?
git branch -a --contains <sha>
```

### Step 4 — Mirror-clone for the rewrite

`git filter-repo` refuses to run on a non-fresh clone by default. Create a mirror-clone:

```bash
cd ..
git clone --mirror git@github.com:org/repo.git repo-rewrite
cd repo-rewrite
```

### Step 5 — Rewrite

```bash
# Remove the file entirely from all history
git filter-repo --invert-paths --path .env

# Or redact specific text patterns
cat > /tmp/redactions.txt <<EOF
AKIAIOSFODNN7EXAMPLE==>REDACTED
sk-ant-real-key-value==>REDACTED
EOF
git filter-repo --replace-text /tmp/redactions.txt
```

### Step 6 — Force-push the cleaned history

```bash
# Explicit override required if pushing to protected branches
git push --force --all
git push --force --tags
```

### Step 7 — Notify

- Anyone with a local clone: re-clone, or `git fetch && git reset --hard origin/<branch>`.
- Open PRs: may need closure + recreation from rebased branches.
- Forks: cannot be cleaned by you; flag to the project owners; consider whether the repo's visibility needs to change.
- If the repo is/was public, assume the secret was scraped within minutes.

### Step 8 — Audit logs

For the exposure window (commit timestamp → rotation timestamp), audit:
- AWS CloudTrail for the leaked IAM user.
- GitHub audit log for the leaked token.
- Stripe events log, Slack audit log, etc. per service.

Document any unauthorized usage in the security issue.

### Step 9 — Close the loop

- File a security issue with the timeline.
- Add gitleaks (or equivalent) as a pre-commit hook.
- Enable GitHub Secret Scanning + Push Protection on the repo.
- Add the leaked file pattern to `.gitignore`.
- Post-mortem: how did the file get staged in the first place? (Usually: `git add .` without checking.)

---

## 10. Scenario: I want to undo a public force-push someone else did

This is the worst case. Someone else force-pushed and clobbered work on the branch. Your local copy may still have the lost commits.

```bash
# Look at your reflog for the branch
git reflog show <branch-name>
# Find the SHA pointing at the pre-clobber state

# Confirm those commits aren't already in the post-clobber history
git log --oneline <sha>..<current-branch>

# Re-introduce the lost commits via a regular commit (preferred) or another force-push
# Preferred: cherry-pick the lost commits onto the new tip
git fetch origin
git switch <branch-name>
git reset --hard origin/<branch-name>   # accept the clobber for now
git cherry-pick <lost-sha-1> <lost-sha-2> ...
git push origin <branch-name>
```

If the lost commits represent significant work, surface to the team that a force-push happened and discuss whether the clobber should itself be reverted (with another force-push, this time coordinated).

---

## 11. Scenario: My `.gitignore` change isn't taking effect

A common confusion: adding a file to `.gitignore` doesn't untrack files git already tracks.

```bash
# Stop tracking but keep the local file
git rm --cached <file>
git commit -m "chore: stop tracking <file>"

# Or for many files matching the ignore pattern
git rm -r --cached .
git add .
git commit -m "chore: apply updated .gitignore to existing tracked files"
```

The cached file is removed from the index; the working-tree file stays. Future runs of `git status` honor `.gitignore`.

---

## 12. Quick reference — first reach for these

| Symptom | First command |
|---------|---------------|
| "I lost commits after reset/rebase/amend" | `git reflog` |
| "I committed to wrong branch (not pushed)" | `git switch -c <correct>; git switch <wrong>; git reset --hard HEAD~` |
| "I committed to wrong branch (pushed)" | `git revert <sha>` + `git cherry-pick <sha>` to correct branch |
| "Bad pull, want to undo" | `git reset --hard ORIG_HEAD` |
| "Bad rebase, mid-conflict" | `git rebase --abort` |
| "I committed too much" | `git reset --soft HEAD~` + `git add -p` |
| "I committed a secret" | ROTATE FIRST. Then [safety-and-secrets.md §3](safety-and-secrets.md). |
| "I deleted a branch" | `git reflog show <branch>` then `git switch -c <branch> <sha>` |
| "Force-pushed clobbered my work" | `git reflog` for your lost commits; cherry-pick onto new tip |
| ".gitignore not working" | `git rm --cached <file>` to untrack |

---

## 13. The doctrine, restated

- The reflog records what your repo did. It is the universal undo.
- Destructive commands (`reset --hard`, `clean -fd`, `push --force`, `filter-repo`) require deliberate state-reading before, and they should never be the first thing tried in a panic.
- `git revert` is non-destructive; `git reset` and `git filter-repo` are destructive. Prefer the former when in doubt.
- On secret leaks: **rotate first, rewrite second**. Always.

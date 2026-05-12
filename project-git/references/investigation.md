# Investigation

Git history is a database. Most engineers query it superficially: `git log`, occasionally `git blame`. The senior move is to know the half-dozen specialized queries that find what you actually need — when a regression was introduced, who changed a specific line and why, when a phrase was last present in the codebase.

Covered:

1. The log family — reading history.
2. Pickaxe — `-S` and `-G` for finding changes by content.
3. Blame — who wrote this line, and why.
4. Bisect — finding the commit that introduced a regression.
5. Diff comparison patterns.
6. Cross-repo search via gh.

---

## 1. The log family

`git log` is the front door. Its flags matter more than the command itself.

### Useful base invocations

```bash
# Compact one-line-per-commit view
git log --oneline -20

# Decorated graph (shows branches and merges)
git log --oneline --decorate --graph --all -20

# With dates and authors
git log --pretty=format:'%h %ad %an %s' --date=short -20

# Show just the commits on this branch since it diverged from main
git log main..HEAD --oneline

# Show commits on main not on this branch (catching up)
git log HEAD..main --oneline
```

### Filtering by author, date, range

```bash
git log --author="Alice"
git log --since="2 weeks ago"
git log --since="2026-04-01" --until="2026-04-30"
git log v1.0..v1.1                       # all commits between two tags
git log --grep="OAuth"                   # commits whose message matches a regex
git log --invert-grep --grep="WIP"       # exclude WIP commits
```

### Filtering by path

```bash
git log -- path/to/file.ts                  # commits that touched this file
git log --follow -- path/to/file.ts         # follow across renames
git log -p -- path/to/file.ts               # commits + the file's diff each time
git log -- "src/**/*.test.ts"                # glob pattern
```

### Showing diffs in log

```bash
git log -p                                  # full diff per commit
git log -p -3                               # last 3 commits with diffs
git log --stat                              # which files changed, +/- counts
git log --shortstat                         # just the +/- summary
git log --name-status                       # files + their change type (A/M/D/R)
git log --raw                               # like name-status but with SHA detail
```

### The all-around investigation invocation

```bash
git log --all --oneline --decorate --graph --first-parent main --since="1 month ago"
```

Breakdown:
- `--all`: include all refs (branches, tags)
- `--oneline --decorate --graph`: visual readability
- `--first-parent main`: collapse merged branches on main (one entry per PR if squash-merge)
- `--since`: limit the time window

---

## 2. Pickaxe — finding changes by content

The single most underused `git log` flag. Pickaxe searches diffs for a string or regex.

### `-S` — search for a literal string

```bash
# When was the string "OAuth" added or removed?
git log -S "OAuth" --oneline

# In a specific file
git log -S "OAuth" --oneline -- src/auth.ts

# With the actual diff
git log -S "OAuth" -p

# When was a function defined / removed?
git log -S "function validateState" -p
```

`-S` matches commits where the *count* of the string changed (added or deleted). Excellent for "when did this code first appear" or "when was this hack removed."

### `-G` — search by regex

```bash
# Find commits whose diff matches a regex
git log -G "validate.*State" --oneline

# Find commits touching a specific import
git log -G "^import.*lodash" -p
```

`-G` is broader than `-S`: it matches if the regex appears *anywhere* in the diff (added, removed, or context). Use when you need pattern matching, not exact-string matching.

### Pickaxe + path = surgical

```bash
git log -S "validateState" -p -- src/auth/

# When did `process.env.AWS_SECRET_KEY` first appear?
git log -S "AWS_SECRET_KEY" -p

# When was a specific TODO added or removed?
git log -G "TODO\(alice\)" -p
```

### Worked example — "when did this bug get introduced?"

A user reports that the OAuth flow rejects valid state tokens. You suspect a regression in state validation.

```bash
# Find when validateState changed
git log -S "validateState" --oneline -- src/auth/
# → b7c1d2f  refactor(auth): tighten state validation
# → a3f2e91  feat(auth): add OAuth callback handler

# Look at b7c1d2f's diff
git show b7c1d2f -- src/auth/

# Suspicion confirmed: refactor introduced a bug. Now use git blame for the line.
```

---

## 3. Blame — who wrote this line, and why

`git blame` annotates each line of a file with the commit that last touched it. The "who" is rarely the useful answer; the "why" is — the commit message explains the change.

### Basic blame

```bash
git blame src/auth.ts                       # blame whole file
git blame -L 50,80 src/auth.ts              # blame lines 50-80
git blame -L '/^function validateState/,/^}/' src/auth.ts   # blame a function by regex match
```

### Blame for the actual author (skipping whitespace / refactors)

```bash
# Ignore whitespace-only changes
git blame -w src/auth.ts

# Ignore moved/copied lines (find the original author)
git blame -CC src/auth.ts                   # detect copies within commit
git blame -CCC src/auth.ts                  # detect copies across files in commit
git blame --ignore-revs-file .git-blame-ignore-revs src/auth.ts   # skip noise commits (formatter runs, mass renames)
```

The `.git-blame-ignore-revs` file is excellent: it lets you list "noise" commits (e.g., a one-off `prettier --write` run that touched every file) so blame skips past them to the meaningful author. Set up once:

```bash
cat > .git-blame-ignore-revs <<EOF
# Mass prettier reformat (2026-01-15)
abc1234567890abc1234567890abc1234567890a

# Mass rename src/ -> src/v2/ (2026-02-03)
def4567890abc1234567890abc1234567890def4
EOF

git config blame.ignoreRevsFile .git-blame-ignore-revs
```

### Blame in the GitHub UI

`https://github.com/org/repo/blame/main/src/auth.ts` — click any line number to follow blame back through history. Visual but slower than the CLI for systematic work.

---

## 4. Bisect — finding when a regression was introduced

`git bisect` is git's binary search across history. Given a known-good commit and a known-bad commit, it asks you to test the midpoint, then narrows on each step. For N commits, you only have to test log₂(N) of them.

### Manual bisect

```bash
# Start
git bisect start

# Tell git where you are now (bad) and what was the last known-good
git bisect bad                              # current HEAD is bad
git bisect good v1.0                        # v1.0 was good

# Git checks out the midpoint. Test the code.
# Then tell git the result:
git bisect good                             # this commit is good
# Or:
git bisect bad                              # this commit is bad

# Repeat. When done:
git bisect reset                            # return to original HEAD
```

### Automated bisect — when you have a test script

This is where bisect shines. Write a script that exits 0 for "good" and non-zero for "bad", then:

```bash
git bisect start HEAD v1.0
git bisect run ./check-regression.sh
```

Git checks out commits and runs the script until it finds the offending commit. Comes back with:

```
b7c1d2fa is the first bad commit
commit b7c1d2fa
Author: Alice <alice@example.com>
Date:   Mon May 5 14:23:00 2025
    refactor(auth): tighten state validation

    [...]
```

### Tips for good bisect runs

- **Test for the actual regression, not just "does it compile."** A compile-passing-but-test-failing run won't bisect properly if your test script only checks compile.
- **Skip commits that can't be tested.** `git bisect skip` if the current commit is broken in an unrelated way (e.g., a missing migration).
- **Bisect script exit codes**:
  - `0` = good
  - `1-124, 126, 127` = bad
  - `125` = skip (untestable)
  - `> 127` = abort the bisect
- **Use shallow scopes** if history is long: `git bisect start --no-checkout HEAD~50 HEAD~200` if you're confident the regression is in the last 200 commits.

### Worked example — bisecting a flaky test

The test `auth/state-validation.test.ts` started flaking last week. Find which commit changed it.

```bash
# Write a script: try the test 50 times; fail if any iteration fails.
cat > /tmp/check-flake.sh <<'EOF'
#!/bin/bash
for i in $(seq 1 50); do
  npm test -- auth/state-validation.test.ts > /dev/null 2>&1 || exit 1
done
exit 0
EOF
chmod +x /tmp/check-flake.sh

git bisect start HEAD HEAD~30
git bisect run /tmp/check-flake.sh
```

50 iterations × log₂(30) bisections is doable in minutes for a fast test suite. If it's slow, narrow the bound before starting.

---

## 5. Diff comparison patterns

### Two refs

```bash
# What's changed between v1.0 and v1.1?
git diff v1.0 v1.1

# Only the files affected
git diff --stat v1.0 v1.1

# Only commit subjects
git log v1.0..v1.1 --oneline

# What's in main that's NOT on this branch?
git log HEAD..main --oneline

# What's on this branch that's NOT in main?
git log main..HEAD --oneline
```

### Comparing files across branches

```bash
git diff main:src/auth.ts feature-branch:src/auth.ts
```

### Three-dot vs two-dot

- `git diff A..B` — diff from A to B (the standard "what's different").
- `git diff A...B` — diff from the **merge base of A and B**, to B. Useful when comparing branches that have both diverged: "what did *this branch* change since we forked off `main`?"

```bash
git diff main...feature/x                    # what feature/x added since branching
git log main...feature/x                     # commits unique to each side (with ^/* markers)
```

### Word-level and char-level diffs

```bash
git diff --word-diff                         # word-level diff highlighting
git diff --word-diff-regex='[A-Za-z0-9_]+'   # tweak word boundaries

# Better for prose / docs
git diff --color-words
```

---

## 6. Cross-repo and code search

GitHub's `gh search` family searches the web indices, not your local repo:

```bash
# Find code containing a string in your org's repos
gh search code "AWS_ACCESS_KEY_ID" --owner my-org

# Find issues
gh search issues "OAuth" --owner my-org --state open

# Find PRs
gh search prs "validateState" --author alice

# Find commits (where allowed)
gh search commits "validateState" --owner my-org
```

Useful for:
- Finding a leak: "is this credential in any of our repos?" (one search; faster than cloning each)
- Cross-team coordination: "is anyone else using this internal API?"
- Historical archaeology: "where was this term first introduced across all our projects?"

### Searching a specific file's history on GitHub

`https://github.com/org/repo/commits/main/src/auth.ts` — paginated commit list for that file.

`https://github.com/org/repo/blame/main/src/auth.ts` — visual blame.

---

## 7. Putting it together — investigation playbook

When asked "when did X break" or "who wrote this and why" or "find the regression":

1. **Reproduce the bad state.** Confirm what "broken" means with a test or a one-line script.
2. **Bound the time window.** Was it working a week ago? A month ago? Find the last known-good commit (often a tag or a deploy SHA).
3. **Pickaxe first if possible.** If the bug is about a specific string or function (`validateState` got tightened), `git log -S` lands you there in seconds.
4. **Bisect if pickaxe doesn't apply.** When the bug is behavioral and you can't grep for "the change," automated bisect is the workhorse.
5. **Blame the offending line for context.** Once bisect lands on a commit, `git blame -L` on the specific lines gives you the commit message — which usually explains the why.
6. **Cross-reference issues and PRs.** Once you have the commit SHA, `gh search prs` or look at GitHub's commit page to find the PR that introduced it. The PR review may have already flagged this risk.

---

## 8. Quick reference

| Goal | Command |
|------|---------|
| Visual history | `git log --oneline --decorate --graph --all -30` |
| What changed in this file across all time | `git log --follow -p -- path/to/file` |
| When was string X added or removed | `git log -S "X" --oneline` |
| When did regex pattern X appear in diffs | `git log -G "X" --oneline` |
| Who wrote these lines, ignoring formatter | `git blame -w -L 50,80 file` |
| Find the regression | `git bisect start HEAD <last-good>` + `git bisect run ./test.sh` |
| What's on this branch but not main | `git log main..HEAD --oneline` |
| What's in main but not on this branch | `git log HEAD..main --oneline` |
| What did this branch change since it forked | `git diff main...HEAD` (three dots) |
| Search GitHub for a string across repos | `gh search code "X" --owner org` |

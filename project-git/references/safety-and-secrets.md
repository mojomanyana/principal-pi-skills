# Safety and Secrets

The highest-stakes part of this skill. A leaked credential, a force-push to main, a deleted shared branch — these are the operations that cause real harm. This reference establishes both **prevention** (scanning before commits land) and **response** (what to do when something already slipped through).

The two cardinal rules:

1. **Refuse destructive operations on protected refs by default.** Force-push, history rewrite, branch deletion on `main`/`master`/`develop`/`release/*`/`prod*` require explicit, in-band user confirmation. No exceptions for "just this once."
2. **On a leak: rotate first, then rewrite history.** Order matters. The window between "credential leaked" and "credential rotated" is the actual breach. History rewriting takes minutes; rotation takes seconds. Do the seconds-thing first.

---

## 1. Pre-commit secret scanning

Before any `git commit`, scan the staged diff for credential patterns. If a pattern matches, **abort** and surface the match to the user. Do not commit and "warn"; the warn-and-proceed pattern is how secrets land in history.

### Quick manual scan (no tools required)

```bash
# What's about to be committed?
git diff --cached

# Show only the additions (where new secrets would appear)
git diff --cached | grep -E "^\+" | grep -vE "^\+\+\+"

# Pattern-match for common secret shapes
git diff --cached | grep -E "^\+" | grep -iE \
  "(api[_-]?key|secret|token|password|passwd|pwd|credential|auth|bearer|aws[_-]?access|private[_-]?key|begin (rsa|openssh|ec|dsa) private key)"
```

### With gitleaks (preferred — install once, run forever)

`gitleaks` is the de facto secret-scanning tool. It's a single binary, fast, and has comprehensive default rules.

```bash
# Install once (macOS)
brew install gitleaks

# Or via go install
go install github.com/gitleaks/gitleaks/v8@latest

# Scan staged changes (before commit)
gitleaks protect --staged --verbose

# Scan entire history (one-time audit of a repo)
gitleaks detect --verbose

# As a pre-commit hook (recommended)
# .git/hooks/pre-commit:
#!/bin/sh
gitleaks protect --staged --verbose
```

If gitleaks exits non-zero, the commit must be aborted. Show the user the rule that matched and the file/line, then offer the choice: redact and re-stage, or proceed to the leak response playbook if the secret is already real (i.e., it's a live credential that has now been "seen" even pre-commit).

### Pattern catalogue (the most common leaks)

These are the patterns that account for the bulk of credential exposures in real-world git history. Internalize them; recognize them by eye.

| Credential | Pattern (regex-ish) | Example |
|------------|---------------------|---------|
| AWS access key | `AKIA[0-9A-Z]{16}` | `AKIAIOSFODNN7EXAMPLE` |
| AWS secret key | `[0-9a-zA-Z/+]{40}` near `aws` context | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| AWS session token | `IQoJb3JpZ2luX2VjE...` | (long base64 starting with `IQoJ`) |
| GitHub PAT (classic) | `ghp_[A-Za-z0-9]{36}` | `ghp_abcDEF1234...` |
| GitHub PAT (fine-grained) | `github_pat_[A-Za-z0-9_]{82}` | `github_pat_11ABC...` |
| GitHub OAuth token | `gho_[A-Za-z0-9]{36}` | `gho_abcDEF1234...` |
| GitHub App token | `ghs_[A-Za-z0-9]{36}` | `ghs_abcDEF1234...` |
| GitHub refresh token | `ghr_[A-Za-z0-9]{36}` | |
| Slack bot token | `xoxb-[0-9]{11}-[0-9]{11}-[A-Za-z0-9]{24}` | |
| Slack user token | `xoxp-[0-9]{11}-...` | |
| Stripe live key | `sk_live_[0-9a-zA-Z]{24,}` | `sk_live_51H...` |
| Stripe restricted key | `rk_live_[0-9a-zA-Z]{24,}` | |
| Google API key | `AIza[0-9A-Za-z_-]{35}` | `AIzaSyD-EXAMPLE-key` |
| Google service account | JSON containing `"type": "service_account"` and `"private_key": "-----BEGIN PRIVATE KEY-----"` | |
| OpenAI key | `sk-[A-Za-z0-9]{48}` or `sk-proj-[A-Za-z0-9_-]+` | |
| Anthropic key | `sk-ant-[A-Za-z0-9_-]+` | |
| Private SSH/RSA/EC key | `-----BEGIN (RSA |OPENSSH |EC |DSA |)PRIVATE KEY-----` | |
| PGP private key | `-----BEGIN PGP PRIVATE KEY BLOCK-----` | |
| JWT (sensitive ones) | `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` | (treat as suspicious; many are public, some aren't) |
| Generic high-entropy strings | 40+ chars, mixed case, no spaces, near keyword like `secret`, `token`, `password` | |
| `.env` files | Filename match: `\.env(\..*)?` (except `.env.example`) | |
| Connection strings | `(postgres|mysql|mongodb|redis)(\+srv)?://[^:]+:[^@]+@` | `postgres://user:pa$$@db.example.com` |

### Files that should NEVER be committed

These should be in `.gitignore` from day one; if any show up as staged, abort:

```
.env
.env.*           # except .env.example, .env.template
*.pem
*.key
*.p12
*.pfx
id_rsa, id_rsa.pub, id_ed25519, id_ed25519.pub   # SSH keys
.aws/credentials
.netrc
.npmrc           # if it contains _authToken
secrets.yml, secrets.yaml, secrets.json
service-account*.json
```

When a project lacks a `.gitignore` covering these, this skill should offer to add one. See [assets/gitignore-starters.md](../assets/gitignore-starters.md).

---

## 2. Force-push and history rewrite policy

### Default: refuse on protected branches

These branches are presumed protected and refuse force-push / history rewrite without an explicit override:

```
main, master, develop, trunk
release/*, releases/*
prod, production, prod-*, production-*
staging, stage-*
v[0-9]*, v[0-9]*.*       # release tags / version branches
```

The default refusal looks like this in chat:

```
This would force-push to `main`. Force-pushing main is destructive — it can erase commits
that other people have based work on, and many CI/CD systems treat the resulting history
as the source of truth for deploys.

If you genuinely need to force-push main:
  1. Confirm there's no other path (most "I need force push" turns out to be a rebase
     of a feature branch that got accidentally merged into main; a revert + new commit is
     usually correct).
  2. Notify anyone with a clone.
  3. Reply with the exact override: "force-push main, I accept the consequences".

Otherwise, tell me what you're trying to accomplish and we'll find a non-destructive path.
```

### Verifying a branch is actually protected (GitHub side)

```bash
# Read branch protection rules for a branch
gh api repos/:owner/:repo/branches/main/protection 2>/dev/null

# If 404, the branch isn't formally protected on GitHub — but our local policy still applies.
# If 200, parse the response: required reviews, status checks, dismissals, etc.
```

If branch protection exists on GitHub, attempting a force-push will be rejected by the remote regardless. If it doesn't exist, our local refusal is the only guardrail — which is precisely why we have it.

### The legitimate use cases for force-push

There are exactly two:

1. **On your own feature branch, after interactive rebase or autosquash.** Use `git push --force-with-lease` (not `--force`) — it refuses if the remote has commits you don't have, preventing accidental clobbering of teammates' work.
2. **After a documented secret-leak history rewrite,** with team notified, on the affected branch (which may be main — see §3).

Anything else is almost certainly avoidable with a revert commit.

### `--force-with-lease` vs `--force`

Always prefer `--force-with-lease`:

```bash
# Safer — refuses if remote has commits we don't expect
git push --force-with-lease

# Even safer — specifies the exact expected remote SHA
git push --force-with-lease=origin/feat/x:expected-sha

# Dangerous — overwrites unconditionally
git push --force
```

In delegated mode, this skill writes `--force-with-lease` unless the user explicitly says otherwise.

---

## 3. Leak response playbook

Run this when a real secret has been committed (and possibly pushed). The order is critical.

### Step 1 — ROTATE FIRST (do this before anything else)

The exposure window is from "committed" to "credential is dead." Rewriting history takes minutes; rotating a credential takes seconds. Always rotate first.

Per credential type:

| Credential | Where to rotate |
|------------|-----------------|
| AWS access key | IAM Console → Users → Security credentials → Delete or deactivate. Create a new key. |
| GitHub PAT / OAuth token | github.com/settings/tokens (classic) or github.com/settings/personal-access-tokens (fine-grained) → Revoke |
| GitHub App | github.com/settings/apps/<app> → regenerate private key / client secret |
| Slack token | api.slack.com/apps/<app> → OAuth & Permissions → Revoke; or `/quit-the-workspace-and-rejoin` for user tokens |
| Stripe key | dashboard.stripe.com → Developers → API keys → Roll key |
| Google API key | console.cloud.google.com → APIs & Services → Credentials → Delete |
| Google service account | console.cloud.google.com → IAM → Service accounts → Keys → Delete |
| OpenAI / Anthropic key | Provider dashboard → API keys → Revoke |
| Database password | DB admin: `ALTER USER ... WITH PASSWORD '...'` or via cloud provider's DB console |
| SSH private key | Generate new keypair (`ssh-keygen`); remove old public key from all `~/.ssh/authorized_keys` and from GitHub/GitLab/etc. |
| PGP private key | Generate new key, revoke old one, publish revocation cert to keyservers |

After rotation, **audit usage logs** for the rotation window (typically CloudTrail for AWS, audit log for GitHub, etc.) to confirm no unauthorized usage occurred.

This skill **does not** rotate credentials itself — that's the user's job, and giving instructions to a script-runner with credentials would itself be a security flaw. The skill walks the user through and waits for explicit confirmation: "rotated, proceed."

### Step 2 — Identify the commit(s) and branches affected

```bash
# Find every commit that touches the file
git log --all --full-history -- path/to/.env

# Find every commit whose diff contains a substring
git log --all -S '<part of the secret>' --source --remotes

# Show which branches contain a given commit
git branch -a --contains <sha>
```

### Step 3 — Rewrite history with git-filter-repo

`git filter-repo` is the modern, supported tool for history rewriting. `git filter-branch` is deprecated and slow; BFG Repo-Cleaner is still fine but `filter-repo` is preferred.

```bash
# Install once
pip install git-filter-repo  # or: brew install git-filter-repo

# IMPORTANT: filter-repo refuses to run on a non-fresh clone by default.
# Mirror-clone the repo first so the rewrite is isolated:
cd ..
git clone --mirror git@github.com:org/repo.git repo-clean
cd repo-clean

# Remove a file from all history
git filter-repo --invert-paths --path .env

# Or remove specific strings (e.g., redact a leaked key from messages and files)
echo 'AKIAIOSFODNN7EXAMPLE==>REDACTED' > replacements.txt
git filter-repo --replace-text replacements.txt

# Push the cleaned history back (this is the force-push; it requires the override)
git push --force --all
git push --force --tags
```

### Step 4 — Notify and reset

Anyone with a local clone of the old history now has divergent history. They must either:

```bash
# Re-clone from scratch (simplest, safest)
rm -rf repo
git clone git@github.com:org/repo.git

# Or hard-reset to the rewritten remote (preserves local work but requires care)
git fetch origin
git reset --hard origin/main
```

Open PRs and forks may still contain the secret in their history. Forks need to be re-forked from the cleaned base; open PRs may need to be closed-and-reopened from rebased branches. If the repo is public, **assume the secret has been scraped** by scanning bots within minutes of the initial push — this is the deeper reason rotation comes first.

### Step 5 — Document and close the loop

- Open a security issue (or use the project's incident process) documenting: what leaked, when (commit + push timestamps), when rotated, exposure window, any observed unauthorized usage, and what's been done.
- Update gitignore + pre-commit hooks so the same pattern can't recur.
- Consider enabling [GitHub secret scanning](https://docs.github.com/en/code-security/secret-scanning) and Push Protection on the repo.

### Common mistakes to avoid

- **Using `git rm` instead of `git filter-repo`.** `git rm` only removes the file from the current commit; previous commits still contain the secret.
- **Force-pushing without rotating.** The window is still open until rotation. Rotate first.
- **Forgetting tags.** `git push --force --all` does not push tags; you also need `--tags`.
- **Forgetting forks.** Public forks may have copies. Search github for the SHA: `https://github.com/search?q=<sha>&type=code`.

---

## 4. Large files

Git is bad at large binaries. Repository size grows monotonically (because of history); every clone pulls every version of every file ever committed. Once a 200 MB binary lands in history, every contributor pays for it forever.

### Pre-commit large-file check

```bash
# Anything staged over 10 MB?
git diff --cached --name-only | while read f; do
  size=$(wc -c < "$f" 2>/dev/null || echo 0)
  if [ "$size" -gt 10485760 ]; then
    echo "WARN: $f is $(($size / 1048576)) MB"
  fi
done
```

Default behavior in this skill:

- **>10 MB**: warn and ask whether the file should be committed (it's often a build artifact that should be in `.gitignore`).
- **>50 MB**: strongly recommend git-lfs.
- **>100 MB**: refuse without explicit override. GitHub's hard limit is 100 MB per file; pushing one over will be rejected by the remote anyway.

### git-lfs setup

```bash
# Install (one-time per machine)
brew install git-lfs                # macOS
git lfs install                     # per-user setup

# Per repo
git lfs install                     # adds the LFS hooks to this repo
git lfs track "*.psd"               # tell LFS to handle .psd files
git add .gitattributes              # commit the tracking config
git add path/to/large.psd           # now LFS handles it
git commit -m "chore: add design source via LFS"
```

When considering LFS for a new file type, ask: do contributors actually need the binary, or could it be a build artifact, a release attachment, or an external asset (S3, Drive)? LFS solves the clone-size problem but introduces a billing/quota concern on GitHub.

---

## 5. Personal data and PII in commit messages

Less common than secret leaks but still happens — a commit message that includes a customer's email, name, or internal-only system name. The fix is the same as a secret leak (filter-repo with `--replace-text`), but rotation isn't applicable; the response is a notification to affected parties and an internal post-mortem.

Pre-commit, watch for:
- Email addresses in commit bodies that look like real users (not internal/test).
- Internal project codenames that the repo is public-facing about (e.g., "Project Falcon" in a public repo).
- Customer IDs, account IDs, support ticket IDs that are sensitive.

---

## 6. Signed commits

For projects that require commit signing (a `gpgsign` config, a branch protection rule, or DCO enforcement):

```bash
# Configure once (GPG)
git config --global user.signingkey <key-id>
git config --global commit.gpgsign true

# Or SSH-based signing (Git 2.34+)
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true

# Commit with explicit sign
git commit -S -m "feat: ..."
git tag -s v1.0.0 -m "release v1.0.0"
```

If a project requires signed commits and the local config doesn't have a signing key, the push will be rejected with "unsigned commit". This skill should surface that as a config issue, not retry blindly.

---

## 7. Quick reference — safety checklist

Before every `git commit`:
- [ ] No `.env`, key, or credential file staged.
- [ ] No secret pattern in the diff (gitleaks or manual grep).
- [ ] No file >10 MB without LFS or explicit override.
- [ ] No PII or sensitive customer data in the message.

Before every `git push`:
- [ ] If pushing to a protected branch, is this a normal commit (not a force-push)?
- [ ] If force-push, am I using `--force-with-lease`?
- [ ] If force-push to protected branch, did the user provide the explicit override?

Before every `git filter-repo` or history rewrite:
- [ ] **Has the leaked credential been rotated?** (If not, STOP and rotate first.)
- [ ] Is this a fresh `--mirror` clone?
- [ ] Are tags going to be force-pushed too?
- [ ] Has the team been notified about the impending history rewrite?

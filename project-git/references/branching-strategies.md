# Branching Strategies

There is no single "right" branching strategy. The right one depends on the team's deploy cadence, the product's risk profile, and how many engineers are touching the codebase. The wrong strategy slows the team down: too lightweight for a regulated medical device, too heavy for a three-person SaaS startup.

This reference covers the four main strategies in use today, when each fits, and the naming conventions that go with them.

---

## 1. GitHub Flow — the default

The simplest model that scales. Used by GitHub itself, most open-source projects, and most modern SaaS teams.

**Shape:**
- One long-lived branch: `main` (always deployable).
- Short-lived feature branches off `main`.
- Open PR, review, merge to `main`.
- Deploy from `main` (continuously or on a tag).

**When it fits:**
- Web apps and SaaS products with continuous or near-continuous deployment.
- Teams of 2–50 engineers.
- Codebases where every commit on `main` should be deployable.

**When it doesn't:**
- You need to support multiple released versions in parallel (e.g., v1.x and v2.x both receiving fixes).
- Releases are gated on long manual QA cycles (use git-flow or release-train).
- You ship to physical devices with months-long firmware cycles.

**Naming convention:**
```
main                              # the only long-lived branch
feat/<topic>                      # new feature
fix/<topic>                       # bug fix
chore/<topic>                     # maintenance, deps, refactor
docs/<topic>                      # documentation
hotfix/<topic>                    # urgent fix (still goes through PR)
```

**Commit cadence:**
Small, frequent. Merging to `main` is the default. PRs live for hours-to-days, not weeks. Long-lived feature branches are a smell.

---

## 2. Trunk-Based Development — for high-velocity teams

A stricter variant of GitHub Flow. Branches live for hours, not days. Feature flags hide unfinished work in `main` so the team can integrate continuously without breaking production.

**Shape:**
- One long-lived branch: `main` (always deployable, always with the latest from everyone).
- Branches live <24 hours; some teams commit directly to `main` (after pair review).
- Unfinished work hidden behind feature flags; toggled on per-env when ready.

**When it fits:**
- Teams with strong CI (every commit runs full test suite + integration tests).
- Teams that have invested in feature-flagging infrastructure.
- Teams of 5–500 engineers (it scales surprisingly well; Google and Facebook run this way).
- Continuous deployment to production multiple times per day.

**When it doesn't:**
- Weak or slow CI (you'll break `main` constantly).
- No feature-flag infrastructure (you'll either ship half-built features or have branches anyway).
- Regulated environments requiring sign-off per change.

**Naming convention:**
Often skipped entirely (commits go to `main`). When branches are used:
```
<author>/<short-topic>            # alice/oauth-callback
```
or just numbered:
```
work/12345                        # ticket-numbered short-lived branch
```

**Commit cadence:**
Many small commits per day, integrated continuously. PRs (if used) are tiny — under 200 lines is the rule, under 50 is the goal. Code review is fast (minutes-to-hour); pair programming substitutes for some review.

---

## 3. git-flow — for versioned releases

Originally described by Vincent Driessen in 2010. Heavier than GitHub Flow, designed for products with explicit release cadence and multiple supported versions.

**Shape:**
- Two long-lived branches: `main` (released code only) and `develop` (integration).
- Feature branches off `develop`.
- Release branches off `develop` when cutting a version (`release/v1.2.0`); merged to `main` *and* back to `develop` when released.
- Hotfix branches off `main` for emergency fixes; merged to `main` *and* `develop`.

**When it fits:**
- Software with explicit release versions and parallel support of older versions.
- Desktop apps, installed software, SDKs, libraries.
- Teams with QA cycles that gate releases.
- Anything where "the latest commit" is not automatically what's in production.

**When it doesn't:**
- SaaS or web apps with continuous deployment (massive overhead for no benefit).
- Small teams (the ceremony slows velocity).
- Single-version products (no point maintaining `develop` separately).

**Naming convention:**
```
main                              # production / released code only
develop                           # integration branch
feature/<topic>                   # off develop
release/v<version>                # cut from develop when stabilising
hotfix/<topic>                    # off main for urgent fixes
bugfix/<topic>                    # off develop for non-urgent fixes
support/<old-version>             # long-lived branch for legacy version support
```

**Commit cadence:**
Slower. Features land on `develop` over days-to-weeks. Releases happen on a schedule (weekly, monthly, quarterly).

**Note:** Even the original author (Driessen) has since said git-flow is overkill for most projects and recommends GitHub Flow as a default. Use git-flow when the explicit-version, multi-version-support shape is needed; don't use it because it sounds disciplined.

---

## 4. Release Train — for coordinated, scheduled cuts

Common at large companies (Google, Mozilla, browser/OS vendors). The team commits continuously to `main`; on a fixed schedule, a release branch is cut and stabilised for shipping.

**Shape:**
- `main` is the integration branch (always-ish stable, but not always deployable).
- On schedule (every 2 weeks, every 6 weeks, every quarter), cut `release/<train-name>` from `main`.
- The release branch gets stabilisation (bug fixes only, no new features) for a fixed window.
- When green, the release branch is tagged and released; merged back to `main` if needed.
- Multiple trains can be in flight simultaneously: one stabilising, one developing.

**When it fits:**
- Browsers (Chrome, Firefox), OS releases, large coordinated platforms.
- Mobile apps with app-store review cycles.
- Products with marketing/launch coordination tied to releases.

**When it doesn't:**
- Anything smaller than a hundred engineers (you're inventing process for no reason).
- SaaS — use GitHub Flow with feature flags instead.

**Naming convention:**
```
main                              # integration
release/2026.01                   # year.month or sprint identifier
release/m95                       # milestone number
release/24-q1-train               # quarter
```

**Commit cadence:**
Continuous to `main`; release branches are cherry-picked into from `main` only (no direct commits to release branches except by release engineers).

---

## 5. Choosing the right strategy

A decision table:

| If the team... | Use |
|----------------|-----|
| Deploys to production multiple times/day, has strong CI, has feature flags | **Trunk-based** |
| Deploys continuously or on every merge, doesn't need feature flags yet | **GitHub Flow** |
| Cuts versioned releases on a regular schedule, supports old versions | **git-flow** |
| Has scheduled coordinated releases across many sub-teams (browsers, OS, mobile) | **Release Train** |

A few tiebreakers:
- **Default to GitHub Flow.** It's the safest baseline. Move to trunk-based when CI matures and feature-flagging is in place; move to git-flow only when the multi-version-support need is real.
- **Don't pick the heaviest strategy "to be safe".** Process overhead has a real cost in velocity.
- **Strategy isn't fixed forever.** Many teams start with GitHub Flow, move to trunk-based as they mature, and may pick up git-flow elements when they ship a library or framework alongside the product.

---

## 6. Branch naming — universal advice

Regardless of strategy, branch names follow a few conventions:

- **Use a prefix to indicate type.** `feat/`, `fix/`, `chore/`, `docs/`, `hotfix/` (or whatever subset the team uses). Tools (gh, CI workflows, CODEOWNERS by path) can match on prefix.
- **Use a short, descriptive slug.** `feat/oauth-callback`, not `feat/work-on-the-login-thing`.
- **Optionally include issue number.** `feat/142-oauth-callback`. Useful for auto-linking and reviewer context.
- **Avoid spaces, capitals, and special characters.** Use hyphens as separators. Some shells choke on names with `:`, `#`, or quotes.
- **Avoid `username/` prefix unless your team uses it.** Some teams do; most don't. If yours doesn't, it adds noise.
- **Don't reuse a deleted branch name immediately.** Old refs in other clones, in CI history, in PR pages, can confuse.

### Naming for delegated handoffs

When `software-architect` hands off an ADR commit, the branch name should encode the ADR identifier:
```
feat/adr-0007-postgres-cockroach
docs/adr-0011-auth-state
```

When `brainstorming` hands off discovery issues, the branches that follow (when spike work begins) should encode the issue:
```
spike/143-cockroach-latency
spike/144-cockroach-cost-model
```

This makes the audit trail self-explanatory: from brainstorm → issue → spike branch → PR → ADR → implementation.

---

## 7. Cleaning up merged branches

A repo with hundreds of stale merged branches is a hassle to navigate. Periodically clean them up.

```bash
# List local branches whose work has been merged into main
git branch --merged main | grep -v -E "(\*|main|master|develop)"

# Delete a single merged branch
git branch -d feat/oauth-callback     # safe — refuses if not merged

# Force-delete an unmerged branch (rare; only for branches you've decided to abandon)
git branch -D feat/abandoned

# Prune stale remote-tracking refs
git fetch --prune                     # or git remote prune origin
```

The corresponding remote-branch cleanup:
```bash
# List remote branches that have been merged
gh pr list --state merged --limit 100 --json headRefName,number

# Delete a single remote branch
git push origin --delete feat/oauth-callback
# Or:
gh api -X DELETE repos/:owner/:repo/git/refs/heads/feat/oauth-callback
```

GitHub has an "Automatically delete head branches" setting under repo settings that handles this at merge time. Recommend enabling it.

---

## 8. Long-lived branches — the smell

If a feature branch lives for more than a couple of weeks, something is off. Common causes:

- Scope is too big. Split the work into multiple smaller PRs.
- Review is too slow. Address that as a process issue, not a branching one.
- The feature genuinely takes weeks. Use feature flags so it can be merged in pieces.
- The branch has diverged badly from `main`. Rebase or merge `main` in frequently to keep conflict surface small.

When you find a long-lived branch, the right response is usually to land what's done behind a flag, not to fight the merge conflicts on the entire thing.

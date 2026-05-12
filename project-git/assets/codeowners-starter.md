# CODEOWNERS Starter (drop-in)

Save as `.github/CODEOWNERS` (or `CODEOWNERS` at repo root, or `docs/CODEOWNERS`). GitHub uses the first one it finds.

This file maps file paths to required reviewers. When a PR touches a path, GitHub auto-requests review from the matching owners.

---

```
# CODEOWNERS — defines who owns what code in this repo.
#
# Rules:
#   - Pattern syntax is similar to .gitignore globs (but no escape characters).
#   - Last matching pattern wins (not first).
#   - Multiple owners on a line are all requested.
#   - Owners can be users (@user) or teams (@org/team-name).
#   - Teams must have explicit write access to the repo.
#
# Validate the file:
#   gh api repos/:owner/:repo/codeowners/errors --jq '.errors'

# ===== Default owners =====
# Anything not matched by a more specific rule below.
*                              @org/core-team

# ===== Code areas =====
/auth/                         @alice @org/auth-team
/payments/                     @bob @org/payments-team
/api/                          @org/api-team
/frontend/                     @org/frontend-team
/backend/                      @org/backend-team
/infra/                        @org/infra-team @org/sre

# ===== Specific high-stakes files =====
package.json                   @org/maintainers
yarn.lock                      @org/maintainers
package-lock.json              @org/maintainers
pyproject.toml                 @org/maintainers
go.mod                         @org/maintainers
Cargo.toml                     @org/maintainers

# ===== Documentation =====
/docs/                         @org/docs-team
/docs/adr/                     @org/architecture-team
*.md                           @org/docs-team
README.md                      @org/maintainers @org/docs-team

# ===== Security-sensitive paths =====
SECURITY.md                    @org/security-team
/auth/oauth/                   @org/security-team @org/auth-team
/auth/sessions/                @org/security-team @org/auth-team
.env.example                   @org/security-team

# ===== GitHub config =====
/.github/                      @org/devops
/.github/CODEOWNERS            @org/admins
/.github/workflows/            @org/devops @org/sre

# ===== Tests =====
# (Optional — many teams don't require test-specific reviewers.)
# /src/**/*.test.ts            @org/qa-team

# ===== Glob patterns =====
# Anything matching the pattern; ** matches any number of directories.
/src/**/migrations/            @org/db-team
```

---

## Patterns explained

| Pattern | Matches |
|---------|---------|
| `*` | Any file in any directory (use as the default owner line) |
| `*.md` | Any markdown file in any directory |
| `/auth/` | Anything under the top-level `/auth/` directory |
| `auth/` | Anything under any directory named `auth` |
| `/src/api/*.ts` | TypeScript files directly in `/src/api/` (not subdirectories) |
| `/src/**/*.ts` | TypeScript files anywhere under `/src/` (recursive) |
| `package.json` | Any file named `package.json` (root or nested) |
| `/package.json` | Specifically the root `package.json` |

---

## Last-match-wins gotcha

Order matters. Place broad rules first, specific rules later. Example:

```
# All TS files default to the API team
*.ts                           @org/api-team

# But auth/*.ts is owned by the auth team
/auth/*.ts                     @org/auth-team
```

A change to `/auth/foo.ts` will request review from `@org/auth-team` only (the second pattern matches and wins). A change to `/api/bar.ts` will request review from `@org/api-team`.

---

## Unsetting ownership

A line with no owner clears prior ownership for the pattern:

```
# Markdown files in this directory should NOT require review.
/sandbox/*.md
```

(Note: GitHub still allows reviews; it just doesn't auto-request.)

---

## Verifying with `gh`

```bash
# Validate syntax (catches typos in patterns/owners that GitHub silently ignores)
gh api repos/:owner/:repo/codeowners/errors --jq '.errors'

# Read the active CODEOWNERS file
gh api repos/:owner/:repo/contents/.github/CODEOWNERS --jq '.content' | base64 -d
```

---

## Making CODEOWNERS mandatory

By itself, CODEOWNERS is advisory — reviews get requested, but the PR can merge without them. To make CODEOWNERS approval *required*, enable it in branch protection:

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -F required_pull_request_reviews[require_code_owner_reviews]=true \
  -F required_pull_request_reviews[required_approving_review_count]=1 \
  ...
```

---

## Common mistakes

- **Using `@org/team` when the team doesn't have repo write access.** GitHub silently ignores. The team needs explicit access to be a valid owner.
- **Listing personal accounts that may leave the org.** Use teams (`@org/team-name`) wherever possible — ownership survives membership churn.
- **Forgetting that `/auth/` and `auth/` mean different things.** The leading slash anchors to repo root.
- **Putting CODEOWNERS in the wrong place.** GitHub looks in `.github/CODEOWNERS`, then `CODEOWNERS` at repo root, then `docs/CODEOWNERS`. Pick one and stick to it.
- **Massive default-owner list.** `* @user1 @user2 @user3 @user4 @user5` requests review from all five on every PR. Use a team (`@org/maintainers`) instead — team review requests are deduplicated.
- **Not validating after edits.** Always run the `gh api ... /codeowners/errors` check after editing.

---

## A minimal starter (for very small repos)

If the repo doesn't yet have specific areas / teams:

```
# CODEOWNERS — minimal starter.
# Everyone with maintainer rights reviews everything.
*                              @org/maintainers

# CODEOWNERS itself can only be changed by admins.
/.github/CODEOWNERS            @org/admins
```

Add finer-grained rules as the codebase and team grow.

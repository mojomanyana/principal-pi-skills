# Conventional Commits — Reference Card

A one-page cheat sheet for the [Conventional Commits](https://www.conventionalcommits.org/) format. Drop this in your project's `docs/` or `.github/` for contributor reference.

---

## Format

```
<type>(<scope>): <description>

[optional body]

[optional trailers]
```

- **type** — what kind of change (see below). Required.
- **scope** — area of the codebase, in parentheses. Optional.
- **description** — short summary, imperative, lowercase, no trailing period. Required.
- **body** — paragraphs explaining why. Optional but encouraged for non-trivial changes.
- **trailers** — `Key: Value` lines at the end. Optional.

---

## Types

| Type | When to use | Version bump (semver) |
|------|-------------|------------------------|
| `feat` | New user-facing feature | MINOR |
| `fix` | Bug fix | PATCH |
| `perf` | Performance improvement | PATCH |
| `refactor` | Code change with no behavior change | none |
| `docs` | Documentation only (including ADRs) | none |
| `test` | Adding or fixing tests | none |
| `build` | Build system, dependencies, packaging | none |
| `ci` | CI/CD config (workflows, actions) | none |
| `chore` | Maintenance (cleanups, dep bumps) | none |
| `style` | Formatting, whitespace (rare; usually `chore`) | none |
| `revert` | Reverts a previous commit | varies |

**Tip:** Pick the *dominant* type. If you can't pick one (multiple categories), the commit is probably not atomic — split it.

---

## Breaking changes

Two ways to signal a MAJOR-bump change:

**Inline `!`** (preferred — harder to miss):
```
feat(api)!: drop /v1/users (use /v2/users)
```

**Footer:**
```
feat(api): replace pagination scheme

BREAKING CHANGE: cursor-based pagination replaces offset pagination on
all /v2 endpoints. Callers must update to the new `cursor` query param.
```

Tooling (semantic-release, git-cliff) recognizes both.

---

## Scopes

Scope is the area of the codebase. Conventions vary by project:

- Module: `feat(auth):`, `fix(payments):`
- Component: `feat(checkout-form):`
- Layer: `refactor(db):`, `feat(api):`
- ADR / RFC: `docs(adr-0007):`, `docs(rfc-12):`
- Feature flag: `feat(beta-search):`

Scope is **optional**. Omit it (`feat: add OAuth login`) for genuinely cross-cutting changes or projects that don't use scopes.

---

## Examples — good

```
feat(auth): add OAuth2 callback handler
fix(payments): handle null response from Stripe webhook
docs(adr-0007): record decision to migrate Postgres → CockroachDB
refactor(db): extract connection pooling into separate module
perf(search): use trigram index (50ms → 5ms p99)
build(deps): bump typescript 5.3 → 5.4
ci(release): add provenance attestation to npm publish
chore(release): v1.2.0
feat(api)!: drop /v1/users (use /v2/users)
revert: feat(auth): add OAuth2 callback handler
```

## Examples — bad

```
update stuff                   # no type, no scope, no information
WIP                            # never push WIP; squash before pushing
feat: stuff                    # type without information
fix and refactor               # two types — split or pick dominant
Added OAuth callback.          # past tense, trailing period
[FEATURE] OAuth                # don't put status in title; use labels
🚀 ship it!                    # emoji are fine if conventional, but the message has no info
```

---

## Trailers (the footer)

After the body, blank line, then `Key: Value` lines.

- `Refs: #123` — related but not closed by this commit
- `Fixes: #123` — fixes the bug (closes when merged via PR)
- `Closes: #123` — closes the issue (more common in PR bodies than commits)
- `Co-authored-by: Name <email>` — GitHub renders avatars
- `Signed-off-by: Name <email>` — DCO signoff (auto by `git commit -s`)
- `Reviewed-by: Name <email>`
- `Reported-by: Name <email>`

---

## Full example

```
feat(auth): add OAuth2 callback handler

The login flow needs a callback endpoint to receive the authorization
code from the IdP. Adds /auth/oauth/callback, exchanges the code for
tokens via the existing token-exchange service, and writes the session
cookie.

Chose to keep state validation in-memory (cookie-signed nonce) rather
than in Redis because the auth domain doesn't yet justify a stateful
dependency. This is reversible — see ADR-0011 for the threshold at
which we'd revisit.

Refs: #142
Fixes: #138
Co-authored-by: Pat Reviewer <pat@example.com>
```

---

## Subject discipline (the things people get wrong most often)

- **Imperative mood.** "add" not "added" not "adds". Complete the sentence: *"If applied, this commit will ___"*.
- **Under 50 chars when possible, 72 absolute max.** `git log --oneline` truncates longer.
- **Lowercase after the prefix.** `feat(auth): add OAuth` not `feat(auth): Add OAuth`.
- **No trailing period.** It's a title, not a sentence.

---

## Body discipline

- **Blank line between subject and body.** Tooling depends on it.
- **Wrap at 72 columns.** Otherwise `git log` shows a wall of text.
- **Explain why, not what.** The diff shows what.
- **Reference issues, ADRs, prior commits** in the body or trailers.

---

## When in doubt

- Two changes → two commits. Always.
- Doc-only change → `docs:`.
- Dep bump → `build(deps):` or `chore(deps):`.
- Renaming a file with no behavior change → `refactor:`.
- Bumping CI action version → `ci:`.
- Release commit (generated by tooling) → `chore(release):`.

---

## Why bother?

- **Automated changelogs.** Tools (semantic-release, git-cliff, conventional-changelog) parse these prefixes to generate CHANGELOG.md.
- **Automated version bumps.** Same tools determine the next semver from commit types.
- **Searchable history.** `git log --grep "^feat(auth)"` shows all features in the auth area.
- **Bisect-friendly.** Atomic, well-described commits make `git bisect` ten times faster.
- **Readable PRs.** When the PR title and the commit subjects are well-formed, reviewers spend their attention on the diff, not parsing what's going on.

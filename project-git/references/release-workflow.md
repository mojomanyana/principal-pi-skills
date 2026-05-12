# Release Workflow

Shipping a release means three things: a version number, a tag, and a published artifact (GitHub Release, package on a registry, deployable bundle). Done well, releases are auditable, automatic, and boring. Done poorly, they're a mess of "wait, what's in this one?" and irreversible mistakes.

Covered:

1. Semantic versioning — the rules.
2. Conventional commits → automated version bumps.
3. Changelog generation.
4. Tagging — annotated and signed.
5. `gh release` for publishing.
6. Pre-releases (alpha, beta, rc).
7. Hotfix flow.
8. Release checklists.

---

## 1. Semantic versioning (semver)

Semver formalizes "what does the version number mean." The rules:

```
MAJOR.MINOR.PATCH

MAJOR — incompatible API changes. Users must read the changelog and update their code.
MINOR — backward-compatible new functionality. Users can upgrade safely.
PATCH — backward-compatible bug fixes. Users can upgrade safely.
```

Examples:
- `1.2.3` → `2.0.0` — breaking change (dropped /v1/users endpoint).
- `1.2.3` → `1.3.0` — new feature added (OAuth callback support).
- `1.2.3` → `1.2.4` — bug fix (Stripe webhook null handling).

### Pre-release suffixes

```
1.2.0-alpha.1
1.2.0-beta.3
1.2.0-rc.1
```

Pre-releases sort before the release: `1.2.0-rc.1 < 1.2.0`.

### Build metadata (rarely used)

```
1.2.0+build.20260512
1.2.0-rc.1+sha.a3f2e91
```

Anything after `+` is metadata and ignored by version comparisons.

### What about 0.x.y?

`0.x.y` is the "pre-stable" range. The convention: in `0.x`, MINOR bumps may be breaking; in `1.x+`, semver applies strictly. Stay in `0.x` until the API is stable enough to commit to.

### What about CalVer?

Calendar versioning (`2026.05.1`) is an alternative. Used by some projects (Ubuntu, Unity, JetBrains). If the project uses CalVer, follow it; if it doesn't, default to semver.

---

## 2. Conventional commits → automated version bumps

If commits follow the [Conventional Commits](https://www.conventionalcommits.org/) format (see [commit-craft.md §5](commit-craft.md)), tooling can determine the next version automatically.

Rules:

| Commit type / footer | Bump |
|---------------------|------|
| `feat:` | MINOR |
| `fix:` | PATCH |
| `perf:`, `refactor:`, `docs:`, `chore:`, etc. | none (no version bump) |
| `feat!:` or `fix!:` (inline `!`) | MAJOR |
| Any commit with `BREAKING CHANGE:` footer | MAJOR |

Multiple commits of different types in one release: the **highest bump wins**. A release with five `fix:`, three `feat:`, and one `feat!:` is a MAJOR.

### Tools that automate this

- **[semantic-release](https://github.com/semantic-release/semantic-release)** — the most popular; runs in CI; determines version, generates changelog, creates tag, publishes to npm/PyPI/etc., creates GitHub Release. Configured via `.releaserc` or `package.json`. Best for fully-automated releases.
- **[release-please](https://github.com/googleapis/release-please)** (Google) — opens a "release PR" with the proposed version bump and changelog; release happens when the PR merges. Better when you want human approval gates.
- **[git-cliff](https://github.com/orhun/git-cliff)** — changelog generator with custom templates. Often paired with manual versioning + `gh release`.
- **[changesets](https://github.com/changesets/changesets)** — monorepo-friendly; engineers add "changeset" files alongside their PRs declaring what version-affecting changes they made. Used heavily in JS monorepos.

### Recommendation

- **Single-package repo, want full automation:** semantic-release.
- **Single-package repo, want approval before release:** release-please.
- **Manual versioning, automatic changelog:** git-cliff + `gh release`.
- **Monorepo:** changesets (especially for npm/JS).

---

## 3. Changelog generation

A CHANGELOG.md is the human-readable history of releases. Conventional Commits gives the structure for auto-generation.

### Format ([Keep a Changelog](https://keepachangelog.com/))

```markdown
# Changelog

## [1.2.0] - 2026-05-12

### Added
- OAuth2 callback handler with state validation (#142)
- Session refresh endpoint (#145)

### Fixed
- Stripe webhook null response handling (#138)
- Search trigram index missing on staging (#150)

### Changed
- Bumped TypeScript 5.3 → 5.4

## [1.1.0] - 2026-04-20
...
```

### Generating from commits

```bash
# git-cliff (one-time generation or update)
git cliff -o CHANGELOG.md                                # full regen
git cliff --unreleased -o CHANGELOG.md --prepend         # add new unreleased section to top

# conventional-changelog (npm)
npx conventional-changelog -p conventionalcommits -r 2   # last 2 releases
```

Both tools group commits by type (`feat`, `fix`, `perf`, etc.) and link to PRs and issues. Configure the section names and grouping via the tool's config file.

### Manual changelog editing

Even with auto-generation, edit the CHANGELOG before release. The auto-output captures *what* changed; you may want to add:
- A migration note for users upgrading across a breaking change.
- Context for a security fix.
- Credit for community contributors.

---

## 4. Tagging — annotated and signed

A tag is a permanent pointer to a commit. For releases, **always use annotated tags** (not lightweight tags):

```bash
# Annotated tag (preferred for releases)
git tag -a v1.2.0 -m "Release v1.2.0"

# Annotated + signed (preferred for any project that signs commits)
git tag -s v1.2.0 -m "Release v1.2.0"

# Push tags to origin (does NOT happen with regular git push)
git push origin v1.2.0
git push origin --tags                                   # push all local tags
```

Annotated tags have metadata (author, date, message); lightweight tags are just refs. Tools (git-cliff, semantic-release, gh release) expect annotated.

### Tag naming

- Standard: `v1.2.0` (with the `v` prefix).
- Some projects (Go modules, some Rust): `v1.2.0` strictly required.
- Some projects: `1.2.0` (no prefix). Pick a convention and stick to it.
- Pre-releases: `v1.2.0-rc.1`, `v1.2.0-beta.3`.

### Deleting a tag (rare — almost never the right move)

```bash
# Locally
git tag -d v1.2.0

# Remote (DANGEROUS — anyone who has fetched this tag now has a divergent ref)
git push --delete origin v1.2.0
```

If you've published a release and need to redo it, **release a new version (v1.2.1)** rather than deleting and re-tagging. Deleting published tags is the version-control equivalent of force-pushing main.

---

## 5. `gh release` — publishing on GitHub

`gh release` wraps GitHub's Releases UI and lets you create, list, view, and edit releases from the CLI.

```bash
# Create a release from a tag
gh release create v1.2.0

# With notes from a file
gh release create v1.2.0 --notes-file CHANGELOG-snippet.md

# Auto-generate release notes (uses the new GitHub release notes feature)
gh release create v1.2.0 --generate-notes

# With a title and notes inline
gh release create v1.2.0 --title "v1.2.0 — OAuth support" --notes "..."

# Attach binaries
gh release create v1.2.0 ./dist/myapp-linux-x64 ./dist/myapp-darwin-arm64

# Draft (not published, but URL is shareable)
gh release create v1.2.0 --draft

# Mark as pre-release
gh release create v1.2.0-rc.1 --prerelease

# View a release
gh release view v1.2.0
gh release view --web                                    # open in browser

# Edit
gh release edit v1.2.0 --notes-file new-notes.md
gh release edit v1.2.0 --latest                          # mark as the "Latest" release

# Delete (deletes the release page; does NOT delete the tag)
gh release delete v1.2.0
gh release delete v1.2.0 --cleanup-tag                   # also deletes the tag
```

### Auto-generated release notes — config

`.github/release.yml` configures what `--generate-notes` produces:

```yaml
changelog:
  categories:
    - title: Breaking Changes
      labels:
        - breaking
    - title: Features
      labels:
        - feature
        - feat
    - title: Bug Fixes
      labels:
        - bug
        - fix
    - title: Other Changes
      labels:
        - "*"
```

PRs are sorted into sections by label. Unlabeled PRs land in "Other."

---

## 6. Pre-releases (alpha, beta, rc)

Pre-releases let you ship before stable. Conventions:

- **alpha**: very early; expect breakage; for internal testing.
- **beta**: feature-complete; expect bugs; for external testers.
- **rc** (release candidate): the next release if no critical bugs are found. Typically multiple rcs (rc.1, rc.2) until a clean one.

```bash
# Tag
git tag -a v1.2.0-rc.1 -m "Release candidate 1 for v1.2.0"
git push origin v1.2.0-rc.1

# Publish as pre-release
gh release create v1.2.0-rc.1 --prerelease --generate-notes
```

### Promoting a pre-release to stable

When an rc passes QA:

```bash
# Tag the same commit as the stable release
git tag -a v1.2.0 v1.2.0-rc.1 -m "Release v1.2.0"
git push origin v1.2.0

gh release create v1.2.0 --notes-file ./release-notes-1.2.0.md --latest
```

Note: `v1.2.0` and `v1.2.0-rc.1` can point at the same commit; the release notes for the stable version should be the full notes, not just the rc-to-stable delta.

---

## 7. Hotfix flow

A hotfix is an urgent fix to a released version. Two patterns based on branching strategy.

### GitHub Flow / Trunk-based: hotfix off main, deploy immediately

```bash
# Branch off the released tag (not main, if main has diverged)
git switch -c hotfix/payment-null-fix v1.2.0

# Make the fix
git add ... && git commit -m "fix(payments): handle null response from Stripe webhook"

# Tag a patch release
git tag -a v1.2.1 -m "Hotfix v1.2.1"

# Push and PR
git push -u origin hotfix/payment-null-fix
git push origin v1.2.1
gh pr create --base main --head hotfix/payment-null-fix \
  --title "fix(payments): handle null Stripe webhook response (#138)" \
  --body "Hotfix for v1.2.0. Targets main; also tagged as v1.2.1."

# Publish the release
gh release create v1.2.1 --notes "Hotfix: ..."
```

After the PR merges to main, the fix is in both the release line and the development line.

### git-flow: hotfix from main, merged back to develop

```bash
git switch -c hotfix/payment-null-fix main
# ... fix, commit, push, PR to main ...
# After merge to main:
git switch develop
git merge main                                           # carry the fix forward
```

git-flow's discipline is what makes multi-version support tractable.

### When the hotfix needs to ship to an older major

If you've already released v2.x and need to ship v1.x.N+1:

```bash
git switch -c hotfix/v1-payment-fix v1.x
# ... fix, commit, tag v1.x.N+1, release ...
```

Then evaluate: does this fix also need to be ported forward to v2.x? If yes, cherry-pick:

```bash
git switch main                                          # or develop
git cherry-pick <hotfix-sha>
```

---

## 8. Release checklists

### Before the release

- [ ] All PRs intended for this release are merged.
- [ ] `main` is green on CI.
- [ ] Changelog is up to date and edited for clarity.
- [ ] Version number agreed (compute via conventional commits or manually).
- [ ] Migration notes documented for any breaking change.
- [ ] Database migrations tested in staging.
- [ ] Feature flags for incomplete work are off (or default off for new envs).

### Creating the release

- [ ] Tag created (annotated, possibly signed).
- [ ] Tag pushed to origin.
- [ ] GitHub Release created with notes.
- [ ] Release artifacts attached if applicable.
- [ ] Package published to registry (npm, PyPI, crates.io, Docker Hub, etc.) if applicable.

### After the release

- [ ] Deploy to production (if not automated).
- [ ] Smoke test in production.
- [ ] Announce (changelog channel, status page, customer notification per project norm).
- [ ] Open follow-up issues for known limitations.

---

## 9. The release commands — quick reference

```bash
# Tag
git tag -a v1.2.0 -m "Release v1.2.0"
git tag -s v1.2.0 -m "Release v1.2.0"          # signed
git push origin v1.2.0
git push origin --tags                          # push all local tags

# Release
gh release create v1.2.0 --generate-notes
gh release create v1.2.0 --notes-file ./CHANGELOG-snippet.md
gh release create v1.2.0-rc.1 --prerelease --generate-notes
gh release create v1.2.0 --draft

# View / list
gh release list
gh release view v1.2.0
gh release view --web

# Edit
gh release edit v1.2.0 --notes-file new-notes.md
gh release edit v1.2.0 --latest

# Changelog (git-cliff)
git cliff --unreleased --tag v1.2.0 -o CHANGELOG.md --prepend
git cliff --unreleased --tag v1.2.0   # to stdout

# Find the previous release
git describe --tags --abbrev=0                   # latest tag
git describe --tags --abbrev=0 HEAD~             # tag before that
```

---

## 10. Anti-patterns

- **Lightweight tags for releases.** Always annotated.
- **Re-tagging.** If you need to redo, release a new version.
- **No changelog.** Even an auto-generated one is better than none.
- **Conflating release and deploy.** Releasing publishes the artifact; deploying makes it live. Separate concerns, separate workflows.
- **Releasing from a dirty `main`.** If main isn't green, fix that before tagging.
- **Skipping the rc cycle on a major.** A major version bump deserves an rc cycle for external testing, even if internal QA was thorough.
- **Patch-bumping for new features.** A feature is a MINOR. Users who pinned to `^1.2.0` rely on this.
- **Major-bumping for non-breaking changes.** Inflates major version churn; users distrust the project's semver discipline.

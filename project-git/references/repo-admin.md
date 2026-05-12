# Repo Administration

The configuration layer of a GitHub repo: who reviews what, what's required before merge, how issues and PRs are organized, and the templates that shape contributor input. Most of this lives in `.github/` and in repo settings (accessible via `gh api`).

Covered:

1. CODEOWNERS.
2. Branch protection rules via `gh api`.
3. Label taxonomy.
4. Milestones.
5. Projects v2.
6. Issue and PR templates.
7. `.github/` conventions.
8. Repo metadata (description, topics, homepage).

---

## 1. CODEOWNERS

`.github/CODEOWNERS` (or `CODEOWNERS` at repo root, or `docs/CODEOWNERS`) maps file paths to required reviewers. When a PR touches a path, GitHub auto-requests review from the owners.

### Syntax

Like a gitignore file, but each line maps a pattern to one or more owners.

```
# Comment lines start with #

# Default owners (catches anything not matched below)
*                           @org/core-team

# Specific directories
/auth/                      @alice @org/auth-team
/payments/                  @bob @org/payments-team
/docs/adr/                  @org/architecture-team
/src/api/                   @org/api-team
/src/frontend/              @org/frontend-team

# Specific files
package.json                @org/maintainers
.github/                    @org/devops
.github/CODEOWNERS          @org/admins
SECURITY.md                 @org/security-team

# Glob patterns
/src/**/*.test.ts           @org/qa-team
```

### Rules

- **Last matching pattern wins** (not first).
- Patterns are similar to gitignore but with some differences: no escape characters, `*` doesn't match `/`, etc. See [docs](https://docs.github.com/en/repositories/managing-your-repositories-settings-and-features/customizing-your-repository/about-code-owners).
- Owners can be GitHub users (`@alice`) or teams (`@org/team-name`). Teams must have explicit write access to the repo.
- A line with no owner unsets prior ownership for that pattern. (e.g., `*.md` with nothing after sets "no required reviewer for any markdown.")

### Verifying CODEOWNERS

```bash
# Validate the file syntax (GitHub silently ignores broken entries — explicit check is better)
# Use the API:
gh api repos/:owner/:repo/codeowners/errors --jq '.errors'

# View who owns a path (no built-in CLI; use the web UI or this)
gh api repos/:owner/:repo/contents/.github/CODEOWNERS --jq '.content' | base64 -d
```

### Integration with branch protection

CODEOWNERS becomes mandatory only when "Require review from Code Owners" is enabled in branch protection. Otherwise it's advisory (review requests appear, but aren't required for merge).

---

## 2. Branch protection rules

Branch protection rules enforce policies on the remote: required reviews, required status checks, who can push, whether force-push is allowed, etc. Configured in repo settings → Branches, or via `gh api`.

### Read current protection

```bash
gh api repos/:owner/:repo/branches/main/protection --jq '.'
```

If the branch isn't protected, you'll get a 404.

### Standard protection (recommended baseline for `main`)

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]="ci/lint" \
  -F required_status_checks[contexts][]="ci/test" \
  -F required_status_checks[contexts][]="ci/build" \
  -F enforce_admins=true \
  -F required_pull_request_reviews[required_approving_review_count]=1 \
  -F required_pull_request_reviews[dismiss_stale_reviews]=true \
  -F required_pull_request_reviews[require_code_owner_reviews]=true \
  -F restrictions= \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F required_linear_history=false \
  -F required_conversation_resolution=true
```

Breaking that down:

- `required_status_checks.strict=true` — branches must be up-to-date with base before merge.
- `required_status_checks.contexts[]` — list of check names (workflow job names or external CI). Must all pass.
- `enforce_admins=true` — even admins must follow the rules. (Strongly recommended.)
- `required_approving_review_count=1` — N approvals required.
- `dismiss_stale_reviews=true` — approvals are dismissed if new commits are pushed.
- `require_code_owner_reviews=true` — CODEOWNERS reviewers must approve.
- `restrictions` — list of users/teams who can push (set to `=` for "no restrictions on who can push" if reviews are required, since push is gated by PR).
- `allow_force_pushes=false` — refuses force-push at the remote level.
- `allow_deletions=false` — refuses branch deletion.
- `required_linear_history=false` — set true to require linear history (no merge commits).
- `required_conversation_resolution=true` — all review conversations must be resolved before merge.

### Required deployments / signed commits / merge queue

For advanced cases:

```bash
# Require signed commits
gh api -X POST repos/:owner/:repo/branches/main/protection/required_signatures

# Require specific deployment env to have shipped to before merging
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -F required_deployment_environments[]="staging"

# Merge queue (newer feature)
# Via web UI: repo settings → Branches → Branch protection rule → "Require merge queue"
```

### Removing protection

```bash
gh api -X DELETE repos/:owner/:repo/branches/main/protection
```

(Almost never the right move; usually you want to adjust a rule, not delete the protection.)

### Rulesets (newer GitHub feature, 2023+)

GitHub Rulesets are the successor to branch protection rules, with more flexibility (target multiple branches with one ruleset, organization-level rulesets, etc.). For new repos, rulesets are recommended; for existing repos, the classic branch protection still works.

```bash
# List rulesets
gh api repos/:owner/:repo/rulesets

# Create a ruleset (via web UI is easier for now; the API is verbose)
# https://docs.github.com/en/rest/repos/rules
```

---

## 3. Label taxonomy

See [issue-craft.md §3](issue-craft.md) for the recommended taxonomy. This section covers the *operations* — setting up labels in a repo.

### List existing labels

```bash
gh label list --limit 100
gh label list --limit 100 --json name,color,description
```

### Create / edit / delete

```bash
gh label create "type:bug" --color D93F0B --description "A bug"
gh label edit "type:bug" --color D73A49 --description "Something isn't working"
gh label delete "type:bug" --yes                          # --yes skips the confirm prompt
gh label clone --repo other-org/other-repo                # copy labels from another repo
```

### Bulk-create the recommended baseline

A one-liner for new repos:

```bash
labels=(
  "type:bug:D73A49:Something isn't working"
  "type:feature:A2EEEF:New feature or request"
  "type:chore:CFD3D7:Maintenance — deps, refactor, cleanup"
  "type:docs:0075CA:Documentation"
  "type:spike:FFCC00:Time-boxed investigation"
  "type:question:D876E3:Further information requested"
  "priority:p0:B60205:Drop everything"
  "priority:p1:D93F0B:Current cycle"
  "priority:p2:FBCA04:Next cycle"
  "priority:p3:CFD3D7:Backlog"
  "good-first-issue:7057FF:Good for newcomers"
  "help-wanted:008672:Extra attention needed"
  "discovery:8A2BE2:Discovery / spike work"
)
for entry in "${labels[@]}"; do
  IFS=':' read -r name color desc <<< "$entry"
  gh label create "$name" --color "$color" --description "$desc" 2>/dev/null \
    || gh label edit "$name" --color "$color" --description "$desc"
done
```

---

## 4. Milestones

Milestones group issues and PRs by intended release or sprint. They live as repo metadata; not as files.

```bash
# List
gh api repos/:owner/:repo/milestones --jq '.[] | {number, title, due_on, state}'

# Create
gh api -X POST repos/:owner/:repo/milestones \
  -f title="v1.2.0" \
  -f description="Q2 release: OAuth + payment refactor" \
  -f due_on="2026-06-30T00:00:00Z" \
  -f state="open"

# Edit
gh api -X PATCH repos/:owner/:repo/milestones/<number> \
  -f description="Updated description" \
  -f state="closed"

# Delete
gh api -X DELETE repos/:owner/:repo/milestones/<number>

# Assign issues / PRs to a milestone
gh issue edit <number> --milestone "v1.2.0"
gh pr edit <number> --milestone "v1.2.0"
```

Milestone progress is shown automatically on issues and on the milestone's page (`/milestones/<number>`).

---

## 5. Projects v2

GitHub Projects v2 (the post-2022 rewrite) is the boards/tables system. Lives at the user or org level, not at the repo level (one project can contain items from many repos).

```bash
# List your projects
gh project list                                          # personal
gh project list --owner <org>                            # organization's

# View a project
gh project view <number> --owner <org>

# Add an issue or PR to a project
gh project item-add <project-number> --owner <org> --url https://github.com/org/repo/issues/142

# Remove an item
gh project item-delete <project-number> --owner <org> --id <item-id>

# Edit a field on an item (e.g., set Status to "In Progress")
gh project item-edit --id <item-id> --field-id <field-id> --single-select-option-id <option-id> --project-id <project-id>
```

The `gh project` CLI is verbose. For most operations, the web UI is fine; CLI is useful for automation (e.g., a workflow that auto-adds new issues to a triage project).

### Useful pattern — auto-add new issues to a triage project

```yaml
# .github/workflows/auto-add-to-project.yml
name: Add issues to triage project
on:
  issues:
    types: [opened]
jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v1
        with:
          project-url: https://github.com/orgs/<org>/projects/<number>
          github-token: ${{ secrets.PROJECT_TOKEN }}
```

(`PROJECT_TOKEN` needs `project` scope; a fine-grained PAT or a GitHub App is recommended.)

---

## 6. Issue and PR templates

### Issue templates

`.github/ISSUE_TEMPLATE/*.md` (markdown) or `.github/ISSUE_TEMPLATE/*.yml` (form-based).

Markdown template — `.github/ISSUE_TEMPLATE/bug.md`:

```markdown
---
name: Bug report
about: Something's broken
title: ""
labels: type:bug, status:needs-triage
assignees: ""
---

## Summary
<!-- One sentence -->

## Steps to reproduce
1.
2.

## Expected behavior

## Actual behavior

## Environment
- OS:
- App version / commit SHA:

## Logs / evidence

## Additional context
```

YAML form-based template — `.github/ISSUE_TEMPLATE/bug.yml`:

```yaml
name: Bug report
description: Something's broken
title: "[Bug]: "
labels: [type:bug, status:needs-triage]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting. Please fill out the form below.
  - type: input
    id: summary
    attributes:
      label: Summary
      description: One sentence summary of the bug.
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. ...
        2. ...
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: App version / commit SHA
    validations:
      required: true
```

YAML templates are guided (the form enforces required fields); markdown is freeform. Use YAML for high-volume repos where consistent inputs matter; markdown for everything else.

See `assets/issue-template-bug.md`, `issue-template-feature.md`, `issue-template-chore.md` for ready-to-drop starters.

### Template chooser config

`.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false                              # force template selection
contact_links:
  - name: Question / Discussion
    url: https://github.com/org/repo/discussions
    about: For open-ended questions, use Discussions instead.
  - name: Security issue
    url: https://github.com/org/repo/security/advisories/new
    about: Report vulnerabilities privately.
  - name: Documentation request
    url: https://docs.example.com
    about: Check the docs first.
```

### PR templates

`.github/PULL_REQUEST_TEMPLATE.md` (one template) or `.github/PULL_REQUEST_TEMPLATE/*.md` (multiple, chosen via query string).

See `assets/pr-template.md` for a starter.

---

## 7. `.github/` conventions

The `.github/` directory holds GitHub-specific config. Reference layout:

```
.github/
├── CODEOWNERS                              # required reviewers
├── ISSUE_TEMPLATE/
│   ├── bug.md
│   ├── feature.md
│   ├── chore.md
│   └── config.yml
├── PULL_REQUEST_TEMPLATE.md                # or PULL_REQUEST_TEMPLATE/ folder
├── workflows/                              # GitHub Actions
│   ├── ci.yml
│   ├── release.yml
│   └── ...
├── dependabot.yml                          # automated dependency updates
├── release.yml                             # auto-generated release notes config
├── FUNDING.yml                             # GitHub Sponsors / fund links
└── CONTRIBUTING.md                         # contributor guide (or in repo root)
```

Other useful files (root of repo):

- `README.md` — front door.
- `CHANGELOG.md` — release history.
- `LICENSE` — license text.
- `SECURITY.md` — vulnerability disclosure policy.
- `CONTRIBUTING.md` — contributor guide (alternatively in `.github/`).
- `CODE_OF_CONDUCT.md` — community standards.

---

## 8. Repo metadata

Description, homepage, topics. Visible in the repo header and used for discoverability.

```bash
# View
gh repo view --json description,homepageUrl,repositoryTopics

# Edit
gh repo edit --description "OAuth-aware reverse proxy for internal services"
gh repo edit --homepage https://example.com
gh repo edit --add-topic oauth --add-topic reverse-proxy --add-topic go
gh repo edit --remove-topic deprecated

# Visibility (DESTRUCTIVE — surfaces a confirmation in this skill)
gh repo edit --visibility public                         # or private, internal
gh repo edit --visibility public --accept-visibility-change-consequences
```

### Templates and other settings

```bash
# Make the repo a template
gh repo edit --template

# Allow specific merge methods on PRs
gh repo edit --enable-merge-commit=false --enable-squash-merge=true --enable-rebase-merge=false

# Auto-delete branch on merge
gh repo edit --delete-branch-on-merge

# Allow auto-merge
gh repo edit --enable-auto-merge

# Wiki / Issues / Projects toggles
gh repo edit --enable-issues --enable-wiki --enable-projects
```

---

## 9. `dependabot.yml` — automated dependency updates

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "type:chore"
      - "dependencies"
    reviewers:
      - org/maintainers

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "type:chore"
      - "dependencies"
      - "ci"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

Dependabot opens PRs automatically; CI runs them; humans merge (or set up auto-merge for patch bumps).

---

## 10. The repo-admin checklist for a fresh repo

When this skill sets up a new repo (or audits an existing one), the baseline checklist:

- [ ] Description, homepage, topics set.
- [ ] README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY present.
- [ ] `.gitignore` appropriate to the stack ([assets/gitignore-starters.md](../assets/gitignore-starters.md)).
- [ ] `.github/CODEOWNERS` configured.
- [ ] `.github/ISSUE_TEMPLATE/` populated.
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` present.
- [ ] `.github/workflows/` has at least CI (lint + test + build).
- [ ] Standard label taxonomy applied.
- [ ] Branch protection on `main` (required checks, required reviews, no force-push, no delete).
- [ ] Auto-delete branch on merge enabled.
- [ ] Preferred merge strategy enabled (and others disabled).
- [ ] Dependabot configured.
- [ ] If public: license, security policy, code of conduct mandatory.

---

## 11. Quick reference — gh api one-liners

```bash
# Branch protection
gh api repos/:owner/:repo/branches/main/protection
gh api -X PUT repos/:owner/:repo/branches/main/protection -F ...

# Milestones
gh api repos/:owner/:repo/milestones

# Repo settings
gh api repos/:owner/:repo --jq '{default_branch, has_issues, has_wiki, allow_squash_merge, allow_merge_commit, allow_rebase_merge}'

# Webhooks
gh api repos/:owner/:repo/hooks

# Deploy keys
gh api repos/:owner/:repo/keys

# Collaborators / permissions
gh api repos/:owner/:repo/collaborators
gh api repos/:owner/:repo/collaborators/<username>/permission
```

Use `gh api --paginate` for endpoints that return >100 items.

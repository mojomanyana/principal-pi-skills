# Issue Craft

Issues are durable communication. They outlive the author, surface in search years later, and become the institutional memory of "why did we do that." A good issue makes the future engineer's job easier; a bad one becomes noise they ignore.

This reference covers:

1. What makes a good title.
2. The body, broken out per issue type (bug, feature, chore, spike, question).
3. Label taxonomy.
4. Auto-link semantics (`Closes` vs `Fixes` vs `Refs`).
5. Milestones, projects, and assignees.
6. Issue templates in `.github/ISSUE_TEMPLATE/`.

---

## 1. Title craft

A good issue title is:

- **Searchable in three words.** "OAuth" alone is not enough; "OAuth callback returns 500" is.
- **Specific.** "Login is broken" is useless; "Login OAuth callback returns 500 when state param is missing" is actionable.
- **Imperative for features/chores, descriptive for bugs.**
  - Feature: "Add OAuth2 callback handler"
  - Chore: "Update typescript to 5.4"
  - Bug: "OAuth callback returns 500 when state param is missing"
- **Free of issue numbers, emojis, status markers in title.** No `[BUG]`, no `[P0]`, no `🚀`. Use labels instead — they're filterable, titles aren't.
- **Under ~70 characters.** Longer titles get truncated in GitHub's UI.

### Good
```
Add OAuth2 callback handler with state validation
OAuth callback returns 500 when state param is missing
Update typescript from 5.3 to 5.4
Spike: evaluate CockroachDB read latency at 3-region scale
```

### Bad
```
login bug                              # not specific
[BUG] [P0] Login is broken!!!         # noise instead of labels
fix the thing                          # not specific
OAuth                                  # underspecified
🐛 Bug: OAuth doesn't work             # emoji + vague + restating that it's a bug
```

---

## 2. Body per type

The body is a markdown document. Section it. Use the section names below — they're conventional in many templates and signal "this is a serious issue."

### Bug report

```markdown
## Summary
One sentence describing the bug.

## Steps to reproduce
1. Numbered steps the reader can follow.
2. Be specific about inputs, env, config.
3. Include URLs, query params, headers if relevant.

## Expected behavior
What should have happened.

## Actual behavior
What did happen. Include error messages verbatim and stack traces in code fences.

## Environment
- OS: macOS 14.4 / Ubuntu 22.04 / etc.
- Browser (if web): Chrome 124 / Safari 17 / etc.
- App version / commit SHA: a3f2e91
- Other relevant: Node 20.11, Python 3.12, etc.

## Logs / evidence
```
<paste log output, screenshots, network traces here>
```

## Additional context
Anything else: when it started, related issues, suspected cause, workaround if any.
```

### Feature request

```markdown
## Motivation
What problem does this solve? Who benefits? Why now?

## Proposal
What you're proposing to build. High-level; the design doc / ADR follows in a PR.

## Acceptance criteria
- [ ] User can do X.
- [ ] System handles edge case Y.
- [ ] Performance budget: Z ms p99 under N RPS.
- [ ] Docs updated.

## Alternatives considered
Other approaches and why they were not chosen. ("Do nothing" is always one of the alternatives.)

## Out of scope
What this issue deliberately does NOT cover.

## Open questions
What's not yet decided and may need a follow-up brainstorm or spike.

## Related
- ADR: link if applicable
- Linked issues: #N, #M
```

### Chore / maintenance

```markdown
## Summary
One sentence.

## Why
Explain the motivation — dep is EOL, performance, dev experience, security advisory, etc.

## Plan
1. Steps to complete the chore.
2. Anything that needs coordination.

## Risk
What could break? How will we know?

## Acceptance
- [ ] Specific verifiable steps.
```

### Spike (research / discovery)

```markdown
## Goal
What question are we trying to answer? Frame it as a yes/no or a comparison.

## Approach
How will we investigate? Prototypes, benchmarks, vendor calls, RFC, etc.

## Time-box
This is a spike, not a project. Cap: 3 days / 1 week / etc.

## Acceptance
- [ ] A written recommendation (in /docs/spikes/<topic>.md) with evidence.
- [ ] Decision-ready: brings options + a recommended path + risks.

## Out of scope
What we're explicitly NOT solving in this spike.
```

### Question / discussion

If GitHub Discussions is enabled, use it instead. Otherwise:

```markdown
## Question
The question, framed clearly.

## Context
Background: what you've tried, what you've read, why you're asking here.

## Why this matters
What decision or work is blocked by the answer.
```

---

## 3. Label taxonomy

Labels are the filter system that makes issues findable. A consistent taxonomy is more valuable than a comprehensive one.

### Recommended baseline taxonomy

```
type: ...        (mutually exclusive — pick one)
  type:bug
  type:feature
  type:chore
  type:docs
  type:spike
  type:question
  type:refactor

priority: ...    (mutually exclusive)
  priority:p0    # drop everything, this is on fire
  priority:p1    # fix in current cycle
  priority:p2    # next cycle
  priority:p3    # backlog, will get to it

area: ...        (can have multiple — what part of the codebase)
  area:auth
  area:payments
  area:api
  area:frontend
  area:infra
  ...

status: ...      (workflow state — usually managed by automation or a Project board)
  status:needs-triage
  status:ready
  status:in-progress
  status:blocked
  status:waiting-on-author    # for bugs awaiting reproducer
  status:waiting-on-review

discovery / lifecycle
  discovery
  spike
  good-first-issue
  help-wanted
  duplicate
  wontfix
  invalid
  needs-info
```

### Listing existing labels

Before creating issues at scale, always check what labels exist:

```bash
gh label list --limit 100
```

### Creating labels

```bash
gh label create "type:spike" --color FFCC00 --description "A time-boxed investigation"
gh label create "priority:p0" --color D93F0B --description "Drop everything"
```

### Bulk labels for a new repo

See [assets/](../assets/) or set up with a one-liner:

```bash
# Standard label taxonomy
labels=(
  "type:bug:#D93F0B"
  "type:feature:#A2EEEF"
  "type:chore:#CCCCCC"
  "type:docs:#0075CA"
  "type:spike:#FFCC00"
  "priority:p0:#B60205"
  "priority:p1:#D93F0B"
  "priority:p2:#FBCA04"
  "priority:p3:#CCCCCC"
  "good-first-issue:#7057FF"
  "help-wanted:#008672"
)
for entry in "${labels[@]}"; do
  IFS=':' read -r name color <<< "$entry"
  gh label create "$name" --color "${color#\#}" 2>/dev/null || echo "exists: $name"
done
```

---

## 4. Auto-link semantics

GitHub auto-links several keywords to issues and PRs in commit messages, issue bodies, and PR bodies. Use them deliberately; the meaning differs.

### Closing keywords (only in PR bodies — these close the issue on merge)

```
close, closes, closed
fix, fixes, fixed
resolve, resolves, resolved
```

Form: `Closes #142`, `Fixes #142`, `Resolves org/other-repo#142` (cross-repo).

When the PR merges, the referenced issue auto-closes. Use these only when the PR truly resolves the issue.

### Referencing keywords (don't close, just link)

```
Refs #142
Related to #142
See #142
Part of #142
```

These create a backlink (the referenced issue gets a "mentioned" note) without closing. Use for issues this PR touches but doesn't fully resolve.

### What to put where

| Where | What | Why |
|-------|------|-----|
| Commit message trailer | `Refs: #142` or `Fixes: #142` | Useful in `git log` and tooling that parses trailers. |
| PR body | `Closes #142` | Auto-closes on merge. |
| Issue body | Refs to other issues / ADRs / PRs (in prose) | Backlinks for navigation. |
| Issue title | Never put issue numbers in titles. | Titles should be searchable independently. |

### Cross-repo links

`Closes org/other-repo#142` works for cross-repo PR-closing-issue.

`https://github.com/org/other-repo/issues/142` works for any URL reference.

---

## 5. Assignees, milestones, projects

### Assignees

```bash
gh issue create ... --assignee "@me"          # self-assign
gh issue create ... --assignee alice,bob      # multiple
gh issue edit 142 --add-assignee carol
gh issue edit 142 --remove-assignee alice
```

Default for delegated calls: `@me` (the authenticated user). Adjust if the brief specifies otherwise.

### Milestones

```bash
# List milestones
gh api repos/:owner/:repo/milestones --jq '.[] | "\(.number): \(.title)"'

# Create
gh api repos/:owner/:repo/milestones -f title="v1.2.0" -f description="Q1 release"

# Set on issue (during creation or edit)
gh issue create ... --milestone "v1.2.0"
gh issue edit 142 --milestone "v1.2.0"
```

### Projects (v2 — the current GitHub Projects)

```bash
# List your projects
gh project list

# Add an issue to a project
gh project item-add <project-number> --owner <owner> --url <issue-url>
```

Projects v2 is the new (post-2022) projects experience. The old (Projects classic) is deprecated; don't use it for new work.

---

## 6. Linking issues — best practices

A good issue body links liberally. The future reader navigates the network.

- **Parent issue**: "Part of #100" (where #100 is an epic / tracking issue).
- **Children**: in the parent issue, list child issues with checkboxes: `- [ ] #142 Sub-task`. GitHub renders these as progress trackers.
- **Dependencies**: "Blocked by #143" or "Depends on #144". GitHub doesn't enforce this but the link is visible and searchable.
- **ADRs**: if a decision is captured in an ADR (`/docs/adr/0007-*.md`), link from any related issue.
- **Discussions / RFCs**: link to GitHub Discussions or wiki pages.

### Tracking issues (epics)

A common pattern for multi-issue work:

```markdown
## Goal
Migrate from Postgres to CockroachDB.

## Plan
- [ ] #143 Spike: evaluate CockroachDB read latency
- [ ] #144 Spike: cost model
- [ ] #145 Spike: migration tooling
- [ ] #146 Implement dual-write phase
- [ ] #147 Switch reads to CockroachDB
- [ ] #148 Cut over writes
- [ ] #149 Decommission Postgres

## Decisions
- ADR-0007: Migrate from Postgres to CockroachDB

## Risks / open questions
- ...
```

GitHub renders the checkbox list as a progress bar on the issue card. Tick boxes as PRs land.

---

## 7. Issue templates

`.github/ISSUE_TEMPLATE/*.md` (or `*.yml`) preloads the issue body when a user clicks "New Issue." Templates make it easy for everyone to file issues with the right structure.

See `assets/issue-template-bug.md`, `assets/issue-template-feature.md`, `assets/issue-template-chore.md`.

YAML form-based templates (more guided experience) live in `.github/ISSUE_TEMPLATE/*.yml`. Worth using for high-volume repos where the form's required fields keep filers honest. For most repos, markdown templates suffice.

### Template router

`.github/ISSUE_TEMPLATE/config.yml` configures the "Choose a template" page:

```yaml
blank_issues_enabled: false       # force users to pick a template
contact_links:
  - name: Question or Discussion
    url: https://github.com/org/repo/discussions
    about: For open-ended questions, use Discussions instead.
  - name: Security issue
    url: https://github.com/org/repo/security/advisories/new
    about: Report security vulnerabilities privately.
```

---

## 8. gh issue command reference (the operations this skill performs)

```bash
# Create
gh issue create --title "..." --body "..." --label "type:bug,priority:p1" --assignee "@me" --milestone "v1.2.0"

# Create from a file
gh issue create --title "..." --body-file /path/to/body.md --label ...

# List
gh issue list                                  # default: open
gh issue list --state all
gh issue list --label "type:bug" --label "priority:p0"
gh issue list --assignee "@me"
gh issue list --search "OAuth in:title state:open"
gh issue list --limit 100 --json number,title,labels,state

# View
gh issue view 142
gh issue view 142 --comments
gh issue view 142 --json number,title,body,labels,state

# Edit
gh issue edit 142 --title "..."
gh issue edit 142 --body "..."
gh issue edit 142 --body-file /path/to/body.md
gh issue edit 142 --add-label "..." --remove-label "..."
gh issue edit 142 --add-assignee "..." --remove-assignee "..."
gh issue edit 142 --milestone "v1.2.0"

# Comment
gh issue comment 142 --body "..."
gh issue comment 142 --body-file /path/to/comment.md

# Close / reopen
gh issue close 142 --reason completed --comment "Fixed in #200"
gh issue close 142 --reason "not planned"   # for wontfix / invalid
gh issue reopen 142

# Transfer / lock
gh issue transfer 142 org/other-repo
gh issue lock 142 --reason resolved
gh issue unlock 142

# Pin (handy for "current sprint" or "important")
gh issue pin 142
gh issue unpin 142
```

---

## 9. Anti-patterns

- **"Doesn't work"** — useless. Demand a reproducer or close as needs-info.
- **"P0 must fix" with no context** — priority labels need context. The body should explain *why* it's P0.
- **Issue as TODO list** — a 30-item checklist in one issue is a project board, not an issue. Split into sub-issues with a tracking issue (§6).
- **No assignee, no labels, no milestone** — file-and-forget. Triage means assigning these things.
- **Duplicate issues** — search before filing. Encourage `gh issue list --search "..."` as a habit.
- **Closing without comment** — if you're closing an issue without merging a PR that auto-closes it, leave a comment explaining why ("Not planned", "Resolved by config change", "Duplicate of #143").

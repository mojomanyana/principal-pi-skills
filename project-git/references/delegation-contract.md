# Delegation Contract

This is the most important reference in the skill. The `project-git` skill is built to be invoked by other agents — most commonly `software-architect` and `brainstorming` — and the contract here is what makes that handoff reliable instead of brittle.

The contract has three parts:

1. **Detection** — how to tell a delegated call from a human-driven one.
2. **Input normalization** — the styles of input the skill accepts and how to canonicalize them.
3. **Output shape** — the Facts block and how to populate it for each operation.

---

## 1. Detection — is this a delegated call?

Apply the following signals. Two or more signals = delegated. One signal = ambiguous, do both narration *and* Facts. Zero signals = human mode.

| Signal | Example |
|--------|---------|
| Explicit named caller | `"[from software-architect]"`, `"project-git: ..."`, `"hand off to git worker:"` |
| Highly structured input | Bullet lists of operations; JSON-like field assignments; explicit field names like `operation:`, `files:`, `closes:` |
| Artifact + imperative | An ADR file or decision brief is attached/referenced + a clear instruction ("commit and PR this", "file these as issues") |
| Absence of conversational framing | No greeting, no question, no "could you...", just an imperative payload |
| Skill name in the prompt | The phrase "as the brainstorming output decided", "per the architect's ADR" |
| Bulk operation request | "Create 3 issues...", "Open PRs for all of these..." |

When ambiguous, prefer the safer route: emit both a brief narration *and* the Facts block. Cost is low; benefit is high if the caller turns out to be an agent.

### Anti-signals (these are NOT delegation)

- A human asking a single question conversationally ("can you commit my work?") — even if they reference another skill ("you said as architect we should..."), the request itself is human.
- An error or recovery request mid-conversation — humans need narration to understand what went wrong.
- A request for advice or explanation ("how should I structure this branch?") — that's a `software-architect`-shaped question, hand back rather than execute.

---

## 2. Input normalization

The skill accepts any of these input styles and normalizes them internally to the same intent. The caller is not required to pick a style; this skill is the one adapting.

### Style A — Natural language with embedded structure

This is the most common because it's how a human-readable instruction reads. The architect or brainstorming skill writes prose, and this skill parses it.

```
project-git: commit the new ADR at docs/adr/0007-postgres-to-cockroach.md
with message "docs(adr): record decision to migrate Postgres → CockroachDB",
push to a new branch feat/adr-0007-cockroach, open a PR closing #42,
request review from @alice, and mark it as draft until the spike completes.
```

Normalized internally to:

```yaml
operations:
  - op: commit
    files: [docs/adr/0007-postgres-to-cockroach.md]
    message: "docs(adr): record decision to migrate Postgres → CockroachDB"
  - op: branch
    name: feat/adr-0007-cockroach
    create: true
    track_remote: true
  - op: push
    set_upstream: true
  - op: pr_create
    base: main  # inferred from default branch
    title: "docs(adr): record decision to migrate Postgres → CockroachDB"  # mirrors commit
    body_includes:
      - "Closes #42"
    reviewers: ["@alice"]
    draft: true
```

### Style B — Structured bullets

A more terse style for orchestrators that want to be unambiguous.

```
operation: commit-and-pr
files:
  - docs/adr/0007-postgres-to-cockroach.md
message: docs(adr): record decision to migrate Postgres → CockroachDB
branch: feat/adr-0007-cockroach
base: main
closes: 42
reviewers: [alice]
draft: true
```

### Style C — Bulk issue/PR creation

For brainstorming handoff, the most common pattern.

```
From the brainstorming decision brief, create three discovery issues:

1. Title: "Spike: evaluate CockroachDB read latency at 3-region scale"
   Labels: discovery, spike, database
   Assignee: @me
   Body: <attached>

2. Title: "Spike: cost model — CockroachDB Serverless vs Dedicated"
   Labels: discovery, spike, cost
   ...

3. Title: "Spike: migration tooling — pg_dump → CockroachDB import"
   Labels: discovery, spike, migration
   ...
```

Normalized to `operations: [issue_create × 3]`.

### Style D — Recovery handoff (rare but important)

```
project-git: I just committed a .env file with AWS credentials to main and pushed.
Run the leak response playbook.
```

This routes to `mode: G (Recover)` → [recovery.md](recovery.md) leak response section. The Facts block reports rotation status, history rewrite status, and follow-up actions.

---

## 3. The Facts block — output shape

Every delegated response ends with a `## Facts` block. It is plain markdown with key-value lines, deliberately simple so a downstream agent (or a shell `grep`) can parse it without a YAML library.

### Universal fields (always present)

```markdown
## Facts
operation: <name of the dominant operation>
repo: <org/repo>
status: <success | partial | failed>
warnings: [<list, or empty>]
```

### Per-operation fields

**Commit:**
```markdown
commits:
  - sha: a3f2e91
    subject: "feat(auth): add OAuth callback handler"
    files_changed: 3
```

**Branch:**
```markdown
branch:
  name: feat/oauth-callback
  base: main
  created: true
  pushed: true
  upstream_set: true
```

**Push:**
```markdown
pushed: true
push_target: origin/feat/oauth-callback
```

**Pull request:**
```markdown
pr:
  number: 142
  url: https://github.com/org/repo/pull/142
  state: open
  draft: false
  base: main
  head: feat/oauth-callback
  ci_status: pending  # or success | failure | none
  reviewers_requested: [alice, bob]
  closes_issues: [42]
```

**Issue (single):**
```markdown
issue:
  number: 143
  url: https://github.com/org/repo/issues/143
  title: "Spike: evaluate CockroachDB read latency"
  state: open
  labels: [discovery, spike, database]
  assignees: [me]
  milestone: null
```

**Issues (bulk):**
```markdown
issues:
  - { number: 143, url: ..., title: ..., labels: [...] }
  - { number: 144, url: ..., title: ..., labels: [...] }
  - { number: 145, url: ..., title: ..., labels: [...] }
```

**Release:**
```markdown
release:
  tag: v1.2.0
  url: https://github.com/org/repo/releases/tag/v1.2.0
  draft: false
  prerelease: false
  changelog_path: CHANGELOG.md
```

**CI/Actions read:**
```markdown
run:
  id: 9876543210
  url: https://github.com/org/repo/actions/runs/9876543210
  workflow: CI
  status: completed
  conclusion: failure
  failed_jobs: [test-python-3.11, build-docker]
  failure_summary: "pytest exit 1: 2 failures in tests/test_auth.py"
```

**Recovery:**
```markdown
recovery:
  what_was_broken: "committed .env with AWS keys to main, pushed"
  rotation_status: "user-initiated; AWS keys deactivated in IAM"
  history_rewrite_status: "filter-repo applied locally; force-push to main pending user override"
  follow_ups:
    - "Rotate any downstream services using the leaked credential"
    - "Notify security team per disclosure policy"
    - "Force-push the rewritten history once team is notified"
```

### The `next_step_hint` field

Always include `next_step_hint:` as the last field. It names where control should route next. Examples:

```markdown
next_step_hint: "Hand back to software-architect for ADR status transition (Proposed → Accepted) once PR #142 merges."

next_step_hint: "Issues #143, #144, #145 ready for spike work; hand back to user or to brainstorming for prioritization."

next_step_hint: "Release v1.2.0 published. Notify deploy owner to trigger production deploy via workflow `deploy-prod`."

next_step_hint: "Failure was in tests/test_auth.py; hand off to implementation skill or user for debugging."
```

### Error / partial-success shape

When something fails or partially succeeds, the Facts block uses `status: failed` or `status: partial` and includes:

```markdown
## Facts
operation: commit-and-pr
repo: org/repo
status: partial
warnings:
  - "Commit succeeded (sha: a3f2e91) but push rejected: non-fast-forward."
commits:
  - sha: a3f2e91
    subject: "..."
pushed: false
push_error: "non-fast-forward; remote has diverged from local by 3 commits"
suggested_recovery: "Run `git pull --rebase origin feat/oauth-callback`, resolve any conflicts, then re-push. Or call project-git in sync mode."
next_step_hint: "Recovery required; hand back to user OR re-invoke project-git in sync mode (mode C)."
```

---

## 4. Worked examples — full delegated invocations

### Example 1 — software-architect handing off an ADR

**Input from architect (Style A):**
```
project-git: I've finalized ADR-0007. Commit /home/user/project/docs/adr/0007-postgres-to-cockroach.md
with subject "docs(adr): record decision to migrate Postgres → CockroachDB", body referencing the
context (the three-region latency issue from issue #42 and the cost spike from issue #51). Push to
feat/adr-0007-cockroach. Open a draft PR titled the same as the commit, closing #42 and referencing #51,
with reviewers @alice and @bob. The ADR status is Proposed; we'll flip to Accepted post-merge.
```

**This skill's response (delegated mode):**

```
Committed ADR-0007 (a3f2e91), pushed to feat/adr-0007-cockroach, draft PR #142 opened.

## Facts
operation: commit-and-pr
repo: org/project
status: success
warnings: []
commits:
  - sha: a3f2e91
    subject: "docs(adr): record decision to migrate Postgres → CockroachDB"
    files_changed: 1
branch:
  name: feat/adr-0007-cockroach
  base: main
  created: true
  pushed: true
  upstream_set: true
pr:
  number: 142
  url: https://github.com/org/project/pull/142
  state: open
  draft: true
  base: main
  head: feat/adr-0007-cockroach
  ci_status: pending
  reviewers_requested: [alice, bob]
  closes_issues: [42]
  refs_issues: [51]
next_step_hint: "Hand back to software-architect for ADR status transition (Proposed → Accepted) once PR #142 merges. Architect should also link this ADR from the system design doc."
```

### Example 2 — brainstorming handing off discovery issues

**Input from brainstorming (Style C):**
```
From the brainstorming decision brief on database migration, the team decided to spike three options
before committing. Create three discovery issues, all labeled "discovery" and "spike", assigned to me,
and link them as a "brainstorm output" via a tracking issue or in a shared body section.

1. Title: "Spike: evaluate CockroachDB read latency at 3-region scale"
   Body: Goal — measure p99 read latency for our top-5 query patterns at 3-region geo-distribution
   under load (target: <200ms p99 at 1000 RPS). Acceptance: benchmark report committed to
   /docs/spikes/cockroach-latency.md plus a decision summary.

2. Title: "Spike: cost model — CockroachDB Serverless vs Dedicated"
   Body: Goal — produce a 3-year TCO model comparing CRDB Serverless and Dedicated at our projected
   scale (currently 500 GB, growing 30%/yr). Acceptance: spreadsheet + summary in /docs/spikes/.

3. Title: "Spike: migration tooling — pg_dump → CockroachDB import path"
   Body: Goal — prove the migration path with a copy of staging data; document any incompatibilities.
   Acceptance: working migration script in /scripts/migrate-to-crdb/ and a list of incompatibilities.
```

**This skill's response (delegated mode):**

```
Filed 3 discovery issues (#143, #144, #145), all labeled discovery + spike, assigned to you.

## Facts
operation: bulk-issue-create
repo: org/project
status: success
warnings: []
issues:
  - number: 143
    url: https://github.com/org/project/issues/143
    title: "Spike: evaluate CockroachDB read latency at 3-region scale"
    labels: [discovery, spike]
    assignees: [me]
  - number: 144
    url: https://github.com/org/project/issues/144
    title: "Spike: cost model — CockroachDB Serverless vs Dedicated"
    labels: [discovery, spike]
    assignees: [me]
  - number: 145
    url: https://github.com/org/project/issues/145
    title: "Spike: migration tooling — pg_dump → CockroachDB import path"
    labels: [discovery, spike]
    assignees: [me]
next_step_hint: "Issues ready for spike work. Hand back to user (or to a planning skill) for prioritization and assignment. When all three spikes report back, hand to software-architect to finalize ADR-0007."
```

### Example 3 — recovery handoff

**Input (Style D):**
```
project-git: I committed a .env file with AWS credentials to main and pushed it.
Run the leak response playbook now.
```

**This skill's response (delegated mode, but a human will read this too — so dual-mode):**

```
Treating this as a credential exposure incident. Order of operations (do NOT skip step 1):

1. ROTATE FIRST. Go to AWS IAM and deactivate the leaked access key right now. Get the new key.
   Until rotation is complete, the credential is exposed in git history regardless of any rewrite.

2. Identify the commit. Found it: e7a2c91 — "WIP: testing" — added .env at the root.

3. Once rotation is confirmed by you, this skill will rewrite history (filter-repo) and
   force-push main (with your explicit override).

4. Notify anyone with a clone to re-clone or hard-reset.

Do NOT proceed to step 3 until you confirm rotation in chat: "rotated, proceed".

## Facts
operation: secret-leak-response
repo: org/project
status: partial
warnings:
  - "Step 1 (rotation) is user-initiated and not yet confirmed. Steps 2-4 blocked until rotation."
recovery:
  what_was_broken: "Committed .env with AWS credentials to main (commit e7a2c91), pushed to origin."
  leaked_credential_type: "AWS access key"
  rotation_status: pending_user_confirmation
  history_rewrite_status: blocked_on_rotation
  force_push_status: blocked_on_rotation_and_explicit_override
  follow_ups:
    - "Rotate AWS access key in IAM."
    - "Confirm rotation in chat to unblock history rewrite."
    - "Notify any teammates with a local clone to re-clone or `git fetch && git reset --hard`."
    - "Audit CloudTrail for unauthorized usage of the leaked key during exposure window."
next_step_hint: "Hand control back to user until rotation confirmed. Re-invoke project-git with 'rotated, proceed' to complete history rewrite."
```

---

## 5. Anti-patterns in delegation

- **Don't make the calling agent format inputs perfectly.** Accept all four styles. Normalize internally.
- **Don't invoke another skill from within this one.** Even when the operation completes and obviously needs follow-up, just point with `next_step_hint:`. The orchestrator routes.
- **Don't omit warnings.** A "successful" commit-and-PR that leaves the branch in a force-push-required state needs that surfaced in `warnings:`.
- **Don't surprise the caller with side effects.** If a delegated call requires force-push to a protected branch, ABORT and return `status: failed` with `suggested_recovery: "Caller must include explicit force-push override in the delegation message."` rather than auto-doing it.
- **Don't fall back to natural-language explanations in `## Facts`.** The block is structured. Reasoning goes above it, in the brief narration.
- **Don't omit `next_step_hint`.** Even when the answer is "we're done", say so: `next_step_hint: "Operation complete; no further action required."`

---

## 6. Detection cheat sheet for the implementer

When you see the user's prompt, ask yourself:

1. Is there a structured artifact attached (ADR, decision brief, option list)? → likely delegated
2. Is the imperative scope multi-step ("commit and PR" or "create three issues")? → likely delegated
3. Is the phrasing terse and unconversational? → likely delegated
4. Does the user name another skill explicitly? → confirmed delegated
5. Is the user asking a question rather than issuing an instruction? → human mode

When unsure, do both: a one-or-two-line narration above the Facts block. The Facts block costs nothing extra; the narration costs nothing extra. Always-delegated assumption fails ungracefully (humans get confused by terse JSON-like output); always-human assumption fails ungracefully (orchestrators can't parse prose). Adaptive wins.

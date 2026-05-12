# Actions, Deployments, and Secrets Management

GitHub Actions is the CI/CD layer most modern repos run on. This reference covers the operations this skill performs against Actions and adjacent infrastructure: reading workflow files, running and rerunning workflows, reading failures usefully, managing secrets and variables, and handling environments and deployment approvals.

Covered:

1. Reading workflow files.
2. `gh workflow` — listing, viewing, running, disabling.
3. `gh run` — listing, viewing, rerunning, watching.
4. Reading CI failures usefully.
5. Secrets and variables (repo, environment, org scopes).
6. Environments and deployment approvals.
7. Common diagnostic patterns.

---

## 1. Reading workflow files

Workflows live in `.github/workflows/*.yml`. Each file defines one or more jobs. The shape that matters:

```yaml
name: CI                                     # workflow name (shown in the Actions tab)
on:                                          # what triggers it
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:                         # manual trigger from the Actions tab
  schedule:
    - cron: '0 6 * * *'                      # daily 6am UTC

permissions:                                 # least-privilege GITHUB_TOKEN
  contents: read
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    needs: test                              # runs only if `test` passed
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
```

### Reading workflow names and statuses

```bash
# List workflows
gh workflow list

# View one
gh workflow view ci.yml
gh workflow view "CI"                                    # by name

# View the file itself
gh workflow view ci.yml --yaml
```

### Triggering manually

```bash
# If the workflow has workflow_dispatch
gh workflow run ci.yml
gh workflow run ci.yml --ref main
gh workflow run ci.yml -f input1=value1 -f input2=value2

# View the runs after triggering
gh run list --workflow=ci.yml --limit 5
```

### Enabling / disabling

```bash
gh workflow disable ci.yml
gh workflow enable ci.yml
```

Useful for paused-but-not-deleted workflows (e.g., during a maintenance window).

---

## 2. `gh run` — the runtime view

A *run* is one execution of a workflow. Runs have an ID, a status (queued / in_progress / completed), and a conclusion (success / failure / cancelled / skipped).

### Listing

```bash
gh run list                                              # latest 20
gh run list --limit 50
gh run list --workflow=ci.yml
gh run list --branch=feat/oauth
gh run list --status=failure --limit 10
gh run list --user=@me                                    # your own runs

# Machine-readable
gh run list --json databaseId,status,conclusion,workflowName,headBranch,createdAt --limit 20
```

### Viewing a run

```bash
gh run view                                              # latest run in this branch
gh run view <run-id>
gh run view <run-id> --log                               # full log (long!)
gh run view <run-id> --log-failed                        # only failed-job logs
gh run view <run-id> --json conclusion,jobs              # JSON
gh run view <run-id> --web                               # open in browser
```

### Watching a run

```bash
gh run watch                                             # latest run
gh run watch <run-id>                                    # specific run
gh run watch <run-id> --exit-status                      # exit non-zero if the run fails (good for scripts)
```

### Rerunning

```bash
# Rerun the whole workflow
gh run rerun <run-id>

# Rerun only the failed jobs
gh run rerun <run-id> --failed

# Rerun with debug logging on (sets ACTIONS_STEP_DEBUG=true for this re-run)
gh run rerun <run-id> --debug
```

### Cancelling

```bash
gh run cancel <run-id>
```

### Downloading artifacts

```bash
gh run download <run-id>                                 # all artifacts to ./<name>/
gh run download <run-id> --name build                    # specific artifact
gh run download <run-id> --pattern "*.log"               # by glob
```

---

## 3. Reading CI failures usefully

When a run fails, the question is: which job, which step, what error. The CLI gives a faster path than the web UI for that triage.

### Step 1 — Find the run and see job status

```bash
# Recent runs on a branch
gh run list --branch=feat/oauth --limit 5

# Run summary — which jobs failed?
gh run view <run-id>
```

Output looks like:
```
✓ ci/lint          completed   success   30s
✗ ci/test          completed   failure   2m
✓ ci/build         completed   success   1m
```

### Step 2 — Pull only the failed logs

```bash
gh run view <run-id> --log-failed | head -200
```

This is much cheaper than dumping the full log. Most failures are visible in the last 100-200 lines.

### Step 3 — Drill into a specific job

```bash
# Get job IDs
gh run view <run-id> --json jobs --jq '.jobs[] | {id: .databaseId, name, conclusion}'

# Then view a specific job's log
gh run view --job=<job-id> --log
gh run view --job=<job-id> --log | grep -B 5 -A 20 -i "error\|fail\|fatal"
```

### Common failure patterns and what they mean

- **`ENOSPC: no space left on device`** — runner disk full. Usually transient or self-inflicted by huge artifacts; rerun usually fixes.
- **`Error: The operation was canceled.`** — usually means the job was force-cancelled or another job in the same workflow failed and cancelled siblings.
- **`Error: Process completed with exit code 1`** — the actual error is upstream in the log; scroll back to find what command exited 1.
- **`HTTP 401` / `403` on push or release** — token scope insufficient. Check `permissions:` block on the workflow.
- **`Resource not accessible by integration`** — same root cause; the GITHUB_TOKEN doesn't have the required permission for the operation.
- **Cache miss + slow install** — cache key changed (e.g., lockfile changed); not an error, just slow.

### Enabling debug logging for a failing run

For deeper diagnostic info, set the repo secret `ACTIONS_STEP_DEBUG=true` (or rerun with `--debug`). This adds verbose `##[debug]` lines to the log.

### Tail with `--watch` and conditional exit

```bash
# Trigger and watch — fail loudly if CI fails
gh workflow run ci.yml --ref feat/oauth
gh run watch $(gh run list --workflow=ci.yml --branch=feat/oauth --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

Useful in scripts that need to gate on CI.

---

## 4. Secrets and variables

GitHub has two layers of "config you can read from workflows":

- **Secrets**: encrypted; masked in logs; can't be read back via API; intended for credentials.
- **Variables**: plain-text; not masked; can be read back; intended for non-sensitive config.

Both can be scoped at three levels: **organization**, **repository**, **environment**. Scope inheritance flows org → repo → env (env-level values override repo, repo overrides org).

### Repo secrets

```bash
# List (names only; values can't be read back)
gh secret list

# Set
gh secret set MY_SECRET                                  # prompts for value
gh secret set MY_SECRET --body "value"                   # inline (avoid for real secrets — shell history)
gh secret set MY_SECRET < /tmp/secret-value.txt          # from file
gh secret set MY_SECRET --env-file .env                  # multiple from .env

# Delete
gh secret delete MY_SECRET
```

### Repo variables

```bash
gh variable list
gh variable set MY_VAR --body "value"
gh variable delete MY_VAR
```

### Environment-scoped secrets / variables

```bash
gh secret set MY_SECRET --env production                 # set on env "production"
gh secret list --env production
gh variable set MY_VAR --env staging --body "value"
```

### Organization-scoped (requires admin)

```bash
gh secret set MY_SECRET --org my-org --visibility all
gh secret set MY_SECRET --org my-org --visibility private          # only private repos
gh secret set MY_SECRET --org my-org --visibility selected --repos repo1,repo2
gh secret list --org my-org
```

### Naming conventions

- `SCREAMING_SNAKE_CASE` for both secrets and variables. Conventional.
- Prefix by domain when many: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GCP_SERVICE_ACCOUNT_JSON`, `STRIPE_LIVE_SECRET`, etc.
- For environment-specific, prefix the env: `PROD_DATABASE_URL`, `STAGING_DATABASE_URL`. (Or use environment-scoped secrets, which is cleaner.)

### Reading from workflows

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production                              # gates this job on the env's protection rules
    steps:
      - name: Set up AWS
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          BUCKET: ${{ vars.S3_BUCKET }}
        run: aws s3 sync ./dist s3://$BUCKET
```

`secrets.X` reads secrets (masked); `vars.X` reads variables (plain-text). Environment-scoped values override repo-scoped automatically when the job specifies `environment: <name>`.

### Rotation

When a secret is rotated (deactivated and replaced), update the GitHub secret in lockstep. If the same secret is set at multiple scopes (org + repo, or repo + env), update all of them. Pinned workflow versions don't care; the next run picks up the new value.

---

## 5. Environments and deployment approvals

A GitHub *environment* is a named target for deployments (e.g., `production`, `staging`) with optional protection rules:

- Required reviewers (people who must approve before the job runs).
- Wait timer (delay between approval and run).
- Branch and tag restrictions (e.g., only `main` can deploy to `production`).
- Environment-scoped secrets and variables.

### Listing and viewing

```bash
gh api repos/:owner/:repo/environments --jq '.environments[] | {name, protection_rules}'
gh api repos/:owner/:repo/environments/production
```

### Creating / updating

```bash
gh api -X PUT repos/:owner/:repo/environments/production \
  -F wait_timer=5 \
  -F 'reviewers[][type]=User' -F 'reviewers[][id]=<user-id>' \
  -F 'deployment_branch_policy[protected_branches]=true' \
  -F 'deployment_branch_policy[custom_branch_policies]=false'
```

(The API is verbose; the web UI under repo settings → Environments is easier for one-offs.)

### Triggering a deployment

Deployment is just a workflow job that targets an environment. The workflow YAML:

```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      - run: ./deploy.sh
```

When this job runs, GitHub checks the environment's protection rules. If approvals are required, the run pauses and notifies the approvers. When approved, the job proceeds.

### Approving a pending deployment

```bash
# Find pending deployments
gh api repos/:owner/:repo/actions/runs --jq '.workflow_runs[] | select(.status == "waiting") | {id, name, head_branch}'

# Approve via the API (gh doesn't have a direct subcommand yet)
gh api -X POST repos/:owner/:repo/actions/runs/<run-id>/pending_deployments \
  -F 'environment_ids[]=<env-id>' \
  -F 'state=approved' \
  -F 'comment=LGTM'

# Or reject
gh api -X POST repos/:owner/:repo/actions/runs/<run-id>/pending_deployments \
  -F 'environment_ids[]=<env-id>' \
  -F 'state=rejected' \
  -F 'comment=Hold for security review'
```

The web UI is much more pleasant; CLI is for automation.

### Deployment history

```bash
gh api repos/:owner/:repo/deployments --jq '.[] | {id, environment, ref, sha, created_at}'

# Statuses for a specific deployment
gh api repos/:owner/:repo/deployments/<id>/statuses
```

---

## 6. Common patterns

### Auto-merge dependabot PRs that pass CI

`.github/workflows/dependabot-auto-merge.yml`:

```yaml
name: Dependabot auto-merge
on: pull_request
permissions:
  pull-requests: write
  contents: write
jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: dependabot/fetch-metadata@v2
        id: meta
      - if: steps.meta.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Reusable workflows

Define once, call from multiple workflows:

```yaml
# .github/workflows/reusable-test.yml
on:
  workflow_call:
    inputs:
      node-version:
        required: true
        type: string
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci && npm test
```

Called as:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    uses: ./.github/workflows/reusable-test.yml
    with:
      node-version: '20'
```

### OIDC-based cloud auth (no long-lived secrets)

Modern pattern: instead of storing AWS/GCP credentials as repo secrets, federate auth via OIDC. The workflow exchanges its OIDC token for a short-lived cloud credential.

```yaml
permissions:
  id-token: write                                        # required for OIDC
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::<account>:role/github-deploy
          aws-region: us-east-1
      - run: aws s3 sync ./dist s3://<bucket>
```

When recommending secret-storage, prefer OIDC for AWS, GCP, Azure, Vault when feasible. It eliminates the rotation problem entirely.

---

## 7. Quick reference

| Goal | Command |
|------|---------|
| List workflows | `gh workflow list` |
| Trigger a workflow manually | `gh workflow run ci.yml --ref main` |
| Disable a workflow | `gh workflow disable ci.yml` |
| List runs | `gh run list --workflow=ci.yml --limit 20` |
| View a run | `gh run view <id>` |
| See only failed logs | `gh run view <id> --log-failed` |
| Rerun failed jobs only | `gh run rerun <id> --failed` |
| Watch in real time | `gh run watch <id> --exit-status` |
| Download artifacts | `gh run download <id>` |
| Set a repo secret | `gh secret set NAME --body "..."` |
| Set an env secret | `gh secret set NAME --env production` |
| Set an org secret | `gh secret set NAME --org my-org --visibility selected --repos r1,r2` |
| List secrets (names only) | `gh secret list` (`--env production` for env scope) |
| List variables | `gh variable list` |
| View environments | `gh api repos/:owner/:repo/environments` |
| Approve a pending deployment | `gh api -X POST .../pending_deployments -F state=approved` |

---

## 8. Anti-patterns

- **Pasting secrets into workflow YAML.** Always reference `${{ secrets.NAME }}`, never inline values.
- **Over-broad `permissions:` block.** Default to `permissions: read-all` plus explicit grants per job. Avoid `permissions: write-all`.
- **Storing long-lived cloud credentials in GitHub secrets.** Prefer OIDC.
- **Forgetting to rotate when a secret leaks.** Updating the GitHub secret doesn't deactivate the leaked credential at the source. See [safety-and-secrets.md §3](safety-and-secrets.md).
- **Running on `pull_request` from forks with `pull_request_target`** without understanding the security implications. `pull_request_target` runs with the **base** branch's workflow code AND has access to secrets — making it a vector for malicious PRs from forks. Default to `pull_request`.
- **Self-approving production deployments.** If "required reviewers" is set on the `production` environment, the same person who triggered the deployment shouldn't approve it. GitHub enforces this if "Prevent self-review" is enabled.
- **`actions/checkout@main` instead of pinning a version.** Pin to a major (`@v4`) or a SHA (`@a3f2e91`); never to `@main`.

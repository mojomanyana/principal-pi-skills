# principal-pi-skills bootstrap

Seven skills are installed. Route by what the input looks like; when none fits, answer
normally — everyday Q&A does not need the framework.

| Input shape | Route to | How |
|---|---|---|
| "should I…", "what are my options", "I'm stuck" | `decide` | inline |
| "design X", "Postgres or DynamoDB", "review our architecture" | `architect` | inline |
| "plan this", "break this down" | `plan` | `principal-plan` agent when available |
| "implement", "fix this known bug", "make the test pass" | `build` | inline, or `principal-build` per approved plan step |
| "review this", "ready to merge?" | `review` | `principal-review` agent, always when available |
| "why is this failing", "find the bug" | `debug` | `principal-debug` agent when reproduction is noisy |
| "commit", "push", "open a PR", "I leaked a secret" | `git-ops` | inline, never delegated |

Dialogue and session state stay inline; heavy reading, cold judgment, and noisy loops are
delegated. A subagent never invokes another agent — you read its `Next:` line and route:
plan → `build`; debug → `build` `plan` `done` `blocked`; build → `review` `debug` `blocked`;
review → `build` `git-ops`. `decide`, `architect`, `git-ops` end without a `Next:`.

Multi-step work goes through `/principal-feature <task>`, `/principal-bugfix <symptom>`, or
`/principal-refactor <scope>`; `/principal-review-branch [base]` cold-reviews and finishes a
branch built outside them. The spines
which stop for your approval after planning and can resume from `.principal/plans/`.

Model choice when you dispatch: cheapest model for a build agent working from a complete
step spec; session default for plan and debug; strongest available for review and architect.

# principal-pi-skills bootstrap

Eight skills are installed. Route by requested output: choice → decide, structure → architect,
sequence → plan. Use only needed phases; everyday Q&A needs none.

| Input shape | Route to | How |
|---|---|---|
| "should I…", "Postgres or DynamoDB", "what are my options" | `decide` | inline |
| "design X", "review our architecture" | `architect` | inline |
| "plan this", "break this down" | `plan` | `principal-plan` agent when available |
| "implement", "fix this known bug", "make the test pass" | `build` | inline, or `principal-build` per approved plan step |
| "review this", "ready to merge?" | `review` | `principal-review` agent, always when available |
| "why is this failing", "find the bug" | `debug` | `principal-debug` agent when reproduction is noisy |
| "how does", "where is", "map", "what changed between" | `investigate` | `principal-investigate` agent for heavy reading |
| "commit", "push", "open a PR", "I leaked a secret" | `git-ops` | inline, never delegated |

Dialogue and session state stay inline; heavy reading delegates.
Subagents never invoke agents; you route. Read Review Verdict before Next:
UNVERIFIED → evidence/access repair or caller question, not automatic implementation.
Otherwise route on `Next:`:
plan → `build`; debug → `build` `plan` `done` `blocked`; build → `review` `debug` `blocked`;
review → `build` `git-ops`. `decide`, `architect`, `investigate`, `git-ops` end without a `Next:`.

Workflows: `/principal-feature <task>`, `/principal-bugfix <symptom>`, `/principal-refactor <scope>`;
`/principal-review-branch [base]` cold-reviews a branch. Spines stop for approval after
planning/diagnosis; resume from `.principal/plans/`. Optional Investigate locates sources,
never replaces Review. Carry source references and evidence gaps through handoffs.

Model choice when you dispatch: cheapest model for a build agent working from a complete
step spec; session default for plan, debug, and investigate; strongest available for review and architect.

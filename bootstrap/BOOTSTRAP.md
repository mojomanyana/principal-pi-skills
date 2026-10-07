# principal-pi-skills bootstrap

Route only enabled selected resources by requested output. Everyday Q&A needs no skill.

| Input shape | Route to | How |
|---|---|---|
| "should I", "Postgres or DynamoDB", options | `decide` | inline |
| structure, components, architecture | `architect` | inline |
| implementation sequence | `plan` | delegate |
| code, known-cause fix | `build` | inline or delegated step |
| judge a change | `review` | cold delegate |
| unknown failure | `debug` | delegate noisy diagnosis |
| locate sources/behavior | `investigate` | delegate heavy reading |
| commit, push, PR, secrets | `git-ops` | inline only |

Native handoff: call `delegate_describe({agent:"phase"})`, require binding package
`principal-pi-skills` and the exact phase, then pass its captured `definitionId` to each
`delegate` dispatch. The runtime verifies the enabled source and generated delegated bytes.
Missing/wrong/disabled bindings, stale reload, permission/context refusal, timeout, report
gaps or uncertain cleanup stop dependent work; no substitution. Only when native tools are
genuinely absent may an explicitly configured legacy `principal-*` runner be used. Inline
is a deliberate workflow choice, never failure fallback. Follow authored model/effort policy.

Subagents do not dispatch agents. Read Review Verdict before Next:
UNVERIFIED → evidence/access repair or caller question, not automatic implementation.
Route `Next:`: plan → `build`; debug → `build` `plan` `done` `blocked`;
build → `review` `debug` `blocked`; review → `build` `git-ops`.
Task review approval covers its scope; final integrated review supports finish.
`decide`, `architect`, `investigate`, `git-ops` have no `Next:`.

Feature/bugfix/refactor spines stop after planning/diagnosis for actual approval.
Preserve full reports, source references and caveats; progress facts never reconstruct approval.
An eligible small direct request may finish inline with actual checks and caveats.
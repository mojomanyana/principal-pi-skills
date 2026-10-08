# principal-pi-skills bootstrap

Route selected resources by output; Q&A needs no skill.

| Input shape | Route | How |
|---|---|---|
| "Postgres or DynamoDB", options | `decide` | inline |
| structure | `architect` | inline |
| implementation sequence | `plan` | delegate |
| known-cause implementation | `build` | inline or delegated |
| judge changes | `review` | cold delegate |
| unknown failure | `debug` | delegate noisy diagnosis |
| locate facts | `investigate` | delegate reading |
| Git/GitHub | `git-ops` | inline only |

Call `delegate_describe`; require binding package `principal-pi-skills`, exact phase and
captured `definitionId` on each
`delegate`, `delegate_all` child or `delegate_chain` step. Runtime checks bytes.
Batches use `delegate_all`, never overlapping single calls; writers need separate worktrees.
Missing/wrong/disabled/stale bindings,
permission/context refusal, timeout, report gaps or uncertain cleanup stop dependent work;
no substitution. Legacy requires explicitly configured runners and genuinely absent native tools.
Inline is deliberate, never failure fallback. Follow authored model/effort policy.

Coordinator checks evidence/settlement. Allocate unused ignored reports in child
workspaces; external archives get verified exact copies. Preserve ignore policy, permissions
and source identities; allocation needs no extra approval.
Progress uses `principal-pi-progress check`. Subagents never dispatch. Read Review Verdict before Next:
UNVERIFIED → evidence/access repair or caller question, not automatic implementation.
Route `Next:`: plan → build; debug → build/plan/done/blocked; build → review/debug/blocked;
review → build/git-ops. Only integrated approval supports finish.
`decide`/`architect`/`investigate`/`git-ops`: no `Next:`.

If available, check `jev_advice({action:"status"})`; only workflow mode may advise after gates. Keep predictions from reviewers until verdict. Disabled/error
leaves ordinary permitted work; no activation/CLI bypass. Storage/training stay separate.

Spines retain approval stops. Coherent features: one Build unit with tests/docs, then integrated
Review; split for dependencies/risks. Preserve sources/gates/caveats without
recursive history reads. Honor known finish preferences and uncommitted state.
Small work may finish inline; `/principal-resume` needs explicit operator authorization.

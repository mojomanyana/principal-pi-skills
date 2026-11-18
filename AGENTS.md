# AGENTS.md

Principal routes by the output the user needs. The bootstrap extension injects a short form of
this routing (`bootstrap/BOOTSTRAP.md`) into each request; this file is the long-form reference
and the maintenance rules. Each skill is self-contained; conditional mechanics live in references.

## Own the outcome

The coordinator is the Principal lead. Keep the user's goal, success conditions, constraints and
open decisions in view, separate from the proposed method. Before asking or resuming, use the
outcome, phase, non-goals, accepted verification fallbacks, standing authorization and open
decisions already in context; retrieve only a missing fact the next action needs. Summaries grant
no authority. Ask only for a missing material decision, with a recommendation and its consequence
in product terms.

Missing evidence blocks the next action that depends on it; continue independent authorized work
within explicit user gates. When the missing fact changes that next action, offer concrete useful
choices and their consequences instead of repeating a generic blocker. For continuation, reconcile
historical blockers with the latest authorized scope and amendments.

Prefer the simplest adequate use of existing parts and explain consequential tradeoffs. Choose
checks that can expose plausible wrong behavior; passing checks or a stopped child do not by
themselves establish the outcome. Accept equivalent sound designs and keep polish separate from
defects. Finish when the requested outcome is met. None of this adds execution authority or a stage.

## Choose the useful role

| Input shape | Route | How |
|---|---|---|
| Choice/rationale, “Postgres or DynamoDB” | `decide` | inline dialogue |
| System structure, components, boundaries or data | `architect` | inline dialogue |
| Executable implementation sequence | `plan` | delegate heavy reading; inline deliberately |
| Known-cause implementation | `build` | inline or delegated; one writer per working tree |
| Judge a change before landing | `review` | independent cold context when available |
| Judge a plan, decision, architecture or another role's artifact | `artifact-review` | scoped, read-only resource; no native phase |
| Judge test assertions, behavioral gaps or redundancy | `test-review` | focused skill or independent child when useful |
| Unknown failure | `debug` | delegate noisy diagnosis; inline when appropriate |
| Facts about code, data, runtime or history | `investigate` | read-only; delegate heavy reading |
| Git/GitHub operation | `git-ops` | inline only; needs current session authority |

Use only needed phases; everyday Q&A needs no skill. Decide and Architect are not mandatory
preliminaries, and a plan does not replace a requested choice or design. Subagents cannot
dialogue or dispatch; their final output is the handoff.

## Native delegation

Call `delegate_describe({agent:"phase"})` and require binding package `principal-pi-skills` and the
exact phase (plan, build, review, test-review, debug or investigate). Pass its `definitionId` on
every `delegate`, `delegate_all` child and `delegate_chain` step. Reuse a current binding; describe
again after a reload or selected-resource change. Pass `selectedResources` from the response
unchanged when present: its `package.root` locates this package's helpers, never another
installation. Hand children current authority references, relevant plan sections, accepted
finding definitions and due gates, not copied history or a full-plan reread.

Missing, wrong, disabled or stale bindings, an unqualified backend, a permission or context refusal,
a timeout, a report gap or uncertain cleanup stops dependent work. Never substitute inline or another
runner automatically after a failure. An alternative the user already authorized keeps its recorded
scope and prerequisites; it cannot clear uncertain admission/cleanup or waive a required gate. A
legacy principal-* runner needs genuinely absent native tools and an explicitly configured runner.
Follow authored model/effort policy.

After a child returns, check its full native result and the runtime evidence summary's
`cleanup.state=settled` before dependent work, including consuming Review's verdict. Daddy reports
settled only after verifying an identity-bound receipt; `complete` rechecks the native execution
identity. Receipt fields stay outside tool text. Leaves report later
coordinator gates as pending with their owner and due stage.

Use one `delegate_all` for an approved independent batch, never overlapping single calls. Writers
need separate precreated registered Git worktrees and declared scopes; shared APIs or resources may
serialize them. Preserve completed siblings after a failure, review each candidate, integrate
serially and check the merged whole.

## Workflow bookkeeping

`principal_workflow` snapshot/reference give candidate and exact-file observations for any work,
inline included. Prepare/complete/retry are native-delegation bookkeeping; inline work needs no
dummy delegation. Pass the returned `delegationArguments` to delegate alongside its `definitionId`;
later calls name the task and step. Call complete right after native settlement and before repairs;
after Build/Debug changes files, complete the original operation instead of preparing again.
Retention and completion are evidence, never approval. With all writes forbidden, skip
prepare/complete and verify the native final with `result`.

When host schema validation rejects `prepare` task/step before execution, or `PREPARE_INPUT_INVALID`
reports `operationAllocated: false`, correct the named field and repeat `prepare` for the same
authorized work without asking permission again. Reuse established task/step identities; for a new
task with no internal identity, choose a short valid ID. Keep attempt unchanged and never rename an
existing operation to evade a refusal. This pre-operation correction is not native execution retry.

After an update or `/new`, follow returned `recoverArguments`: inspection reuses delivered output,
and `continueArguments` apply only when the producer proves the original never started. Missing
history is not proof of no start. A recall-only request reports saved delivery, historical checks,
limitations and open choices without rebuilding, retesting or saving duplicates; a refused lookup
leaves history unknown. Details: [workflow mechanics](references/workflow-mechanics.md).

In a new folder, `principal_workflow` preflight observes readiness and setup (or `/principal-setup`)
asks once for an empty Git baseline. Respect no-commit instructions; never initialize as a side
effect or switch folders to evade a refusal. Planning and recall need no Git.

`principal_handoff` optionally prepares compact exact-reference handoffs; missing, denied, stale or
truncated required inputs block and never approve. The self-contained `artifact-review` skill judges
plans, decisions and other artifacts; it is not a native phase or product approval.

## Reports

Before any coordinator artifact write, create an absent `.principal/.gitignore` containing `*`, never
overwrite existing policy, and verify the destination is ignored. Native report paths come from
prepare in the actual child's workspace; never overwrite a referenced prior artifact. Native children
return complete final reports and complete retains them. Plan writes only its plan; Investigate stays
read-only. Inline Build saves a complete report before cold delegated Review. Do not hide a
report-completion failure. A different authored report is preserved separately from the exact native
final; consume the returned `report` reference. Historical `retainArguments` explicitly save producer
evidence for authorized continuation, never for a recall-only request or as fresh completion.

## Convergence

Read Review Verdict before Next. UNVERIFIED means evidence/access reconciliation or a caller
question, not automatic implementation; its `Next: evidence` returns to the coordinator. A concrete
product/test defect goes to Build, an unknown behavioral cause to Debug. Reuse matching candidate,
scope and environment evidence; fresh judgment does not need a fresh suite run.

| Phase | Allowed `Next:` values |
|---|---|
| plan | `build` |
| debug | `build` · `plan` · `done` · `blocked` |
| build | `review` · `debug` · `blocked` |
| review | `build` · `evidence` · `git-ops` |
| decide · architect · investigate · test-review · git-ops | *(none — terminate)* |

Review scopes are task, integrated and scoped-repair; only integrated approval with all due gates
supports finish. Repairs keep the original review, whole-change baseline, findings and evidence gaps.
Stop and reassess when the same failure repeats without new evidence, authority must change or a
runtime gate fails; there is no fixed repair-round quota.

A clear authorized task can go directly to Build, Review and Git-Ops finish; plan only when
sequencing, risks or dependencies need it; a coherent feature is one Build unit with its tests and
docs. Bugfix diagnoses an unknown cause first. Existing explicit
approval for the actual scope persists; urgency and self-written flags do not create it. Tiny
low-risk inline work can finish with its actual checks and caveats.

Use `artifact-review` when requested or when a material risk warrants it, not on every artifact. Use
the distinct [test-review skill](test-review/SKILL.md) when test quality is in question, and say
whether one reviewer used two skills or an independent child reviewed. Test-quality SOUND never
approves integration.

`jev_advice` is optional advice, used only when its status shows workflow mode enabled, after the
deterministic gates, with selected public or already-redacted facts. Keep predictions out of a
review until its verdict. Advice never approves, waives a gate, establishes a defect or authorizes
training; OpenAI Decisions is excluded.

## Maintenance rule — the contracts are generated

`plan`, `build`, `review`, `test-review`, `debug` and `investigate` exist twice: `<name>/SKILL.md`
(interactive contract) and `agents/principal-<name>.md` (the single-shot contract subagents get).
Both are generated from `contracts/<name>.md.tmpl`; the three spine workflows are generated from
`contracts/workflows.md.tmpl`, together with the root `principal-agents.json` binding manifest, which
hashes the generated skill/agent bytes in the same pass (16 outputs). Never hand-edit generated
files or manifest identities. `prompts/principal-review-branch.md` is handwritten. Change shared
behavior once, in the template, then `npm run generate`; `npm run generate:check` fails CI on drift.

Divergences are marked in the template: `{{#skill}}` for interactive-dialogue rules, `{{#agent}}`
for single-shot mechanics (the BLOCKED form, assumptions instead of questions, final-message-only).
Anything outside a block goes to every output.

Put lasting regressions in existing behavior/domain suites, not PR-named files. `npm test` checks
current contracts and product behavior. Behavioural measurement lives in
[principal-pi-skills-evals](https://github.com/mojomanyana/principal-pi-skills-evals); routing checks
live here.

## Setup (pi)

1. Install exact npm releases, then restart Pi: `pi install npm:principal-pi-skills@4.17.0`,
   `pi install npm:pi-daddy@0.60.0` and `pi install npm:skill-harness@0.36.0`. Enable `grep`,
   `find` and `ls` through Pi `settings.json` `defaultTools`; see [README Install](README.md#install-pi).
2. Legacy subagents are optional and usable only when native tools are genuinely absent:
   `npx -p principal-pi-skills@4.17.0 principal-pi-agents install`, then
   `npx -p principal-pi-skills@4.17.0 principal-pi-agents check`.
3. Each skill's `allowed-tools` caps the context a delegated child may receive: `context:summary`
   for `architect`, `decide` and `plan`; `context:files` for `build`, `debug`, `review`,
   `test-review` and `investigate`; none for `git-ops`. The reasons are in each frontmatter and the
   README. Don't raise a ceiling to make a refusal go away.

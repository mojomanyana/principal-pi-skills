# AGENTS.md

Principal routes by the output the user needs. Read this once at session start; the
bootstrap injects a compressed routing table from `bootstrap/BOOTSTRAP.md`. Each skill is
self-contained for its ordinary task. Conditional mechanics live in references, not a
required chain of phase skills.

## Choose the useful role

| Input shape | Route | How |
|---|---|---|
| Choice/rationale, “Postgres or DynamoDB” | `decide` | inline dialogue |
| System structure, components, boundaries or data | `architect` | inline dialogue |
| Executable implementation sequence | `plan` | delegate heavy reading; inline deliberately |
| Known-cause implementation | `build` | inline or delegated; one writer per working tree |
| Judge a change before landing | `review` | independent cold context when available |
| Unknown failure | `debug` | delegate noisy diagnosis; inline when appropriate |
| Facts about code, data, runtime or history | `investigate` | read-only; delegate heavy reading |
| Git/GitHub operation | `git-ops` | inline only; needs current session authority |

Use only needed phases. Everyday Q&A needs no skill. Decide/Architect do not become
mandatory preliminaries; a plan does not replace a requested choice or design. Subagents
cannot dialogue or dispatch more agents; their final output is the handoff.

## Native authority and execution

Call `delegate_describe({agent:"phase"})`; require binding package `principal-pi-skills`,
exact phase and captured `definitionId` on every `delegate`, `delegate_all` child or
`delegate_chain` step. The native phase names are plan/build/review/debug/investigate.
Reuse a current selected binding; refresh after selected-resource/reload changes or runtime
staleness. Preserve the unmodified response and accessible selected skill/agent sources.
Runtime source/hash checks remain authoritative; never reconstruct receipts or guess paths.
Public capture, when explicitly enabled, supplies original response/source refs directly.

Missing/wrong/disabled/stale bindings, unqualified backend, permission/context refusal,
timeout, report gap or uncertain cleanup stops dependent work. Never substitute another
runner or inline execution after failure. Legacy principal-* runners require genuinely
absent native tools and an explicitly configured runner. Follow authored model/effort
policy without phase-tier overrides. Inline is a choice, not a fallback.

Every gate has its source-defined owner and due stage. Leaves check current obligations;
later coordinator terminal/cleanup/review gates remain pending. After return, the coordinator
checks full native result, complete report and identity-bound `cleanup.state=settled`
receipt before dependent work, including consuming Review's verdict. No disposable workspace
does not establish process cleanup. Missing emitted runtime evidence blocks completion.

Use one `delegate_all` for an approved independent batch, never overlapping single calls.
Writers need separate precreated registered Git worktrees and declared scopes/dependencies;
shared APIs/resources may serialize work. Preserve completed siblings after failure, inspect
all results, review candidates and integrate serially with merged checks.

## Handoffs and convergence

Use `principal_workflow` snapshot/reference for canonical workspace/candidate and exact-file
observations, including inline/evidence work; status revalidates a prior native operation.
Prepare/complete/retry are native-delegation bookkeeping. Pass the returned `operation_id`
unchanged to delegate alongside its `definitionId`; after actual native settlement and report
retention, complete with the actual disposition. Failed or blocked results never approve work.
Inline work retains the existing private report mechanism; do not dispatch merely to close
bookkeeping. Reuse returned references; do not recalculate fingerprints, rediscover unchanged
bindings or launch fresh agents to compare duplicates. Tool state is not execution or approval.
The coordinator still owns actual authority, native settlement and semantic decisions.

Pass current authoritative source/definition paths, relevant plan sections/map rows,
accepted finding definitions and due gates. Full originals remain accessible; read history
only for unresolved findings or needed authority/evidence. Do not require every child to
reread the complete plan or copy generic workflow rules into product requirements.
Persist complete plans once under ignored `.principal/plans/`; a coherent feature is one
Build unit with tests/docs unless a real dependency, risk or parallel boundary justifies a split.

Read Review Verdict before Next. UNVERIFIED means evidence/access reconciliation or a
caller question, not automatic implementation. Its explicit `Next: evidence` returns to
the coordinator, not a new agent role. Fix authorized deterministic path/metadata problems
with the tool, preserving failures/corrections. Reuse matching exact candidate/scope/environment
evidence; fresh judgment does not require fresh suite execution. A concrete product/test
defect goes to Build, an unknown behavioral cause to Debug. Do not infer permission denial
from a wrong checkout or ignored-file search.

| Phase | Allowed `Next:` values |
|---|---|
| plan | `build` |
| debug | `build` · `plan` · `done` · `blocked` |
| build | `review` · `debug` · `blocked` |
| review | `build` · `evidence` · `git-ops` |
| decide · architect · investigate · git-ops | *(none — terminate)* |

Review scopes are task, integrated and scoped-repair. Task approval protects only its
candidate/interfaces; only integrated approval with all due gates supports finish.
Repairs retain the original review, whole-change baseline, findings and evidence gaps.
Continue authorized repairs that resolve distinct defects. Stop/reassess when the same
failure repeats without new evidence, authority/scope must change, or a required runtime
gate fails; arbitrary repair-round quotas do not improve convergence.

Feature/refactor spines plan, obtain any still-required approval, Build, Review and finish
through Git-Ops. Bugfix diagnoses first. Existing explicit user approval for the actual scope
persists; urgency and a self-written flag do not create approval. A new material scope/design
change still requires its applicable decision. Review-branch neither plans nor builds.
Tiny change: build → git-ops only when finish is requested; ordinary low-risk inline work
can finish with actual checks/caveats and no Next. Honor requested independent review.

Before any orchestrator artifact write create an absent `.principal/.gitignore` containing
`*`, never overwrite existing policy, and verify ignored destinations. Allocate an unused
absolute report path in the actual child's workspace under
`.principal/reports/<task>-<run>/<candidate>/`; never overwrite a referenced prior artifact.
Routine safe allocation within current authority needs no new approval. Plan writes only its
plan/absent ignore; Investigate stays read-only; the coordinator persists additional reports.
Inline Build needs a complete saved report before cold delegated Review.

For an external private archive, optional progress index or opt-in quiescent resume, read
only the relevant section of [workflow mechanics](references/workflow-mechanics.md).
Exact archive copying is mechanical, not another hand-authored evidence package. Progress
facts and resume receipts never infer approval or permission. Source-required completion
checks remain required; never invent completed phases to pass them.

## Optional advisory and test review

Use `jev_advice` only when helpful and current status explicitly enables workflow mode.
After deterministic gates select a bounded decision-time requirement/evidence packet; no
quota, automatic activation or CLI bypass. Keep predictions and prior outcomes out of cold
review until its own verdict. Disabled/manual/unavailable/error states leave otherwise
permitted work proceeding. Advice cannot approve, waive gates or establish defects.
Storage choice and separate curation/training permission remain distinct; predictions are
not labels. OpenAI Decisions is excluded. Do not collect private transcripts or secrets.

Test-quality review is an optional focus within Review, not another mandatory phase.
Use [the rubric](review/references/test-quality.md) when requested or material to the diff;
judge observable failure coverage, mocks, determinism and redundancy without count quotas.

## Maintenance rule — the contracts are generated

`plan`, `build`, `review`, `debug` and `investigate` exist twice: `<name>/SKILL.md` (interactive contract)
and `agents/principal-<name>.md` (the single-shot contract subagents get) — different
artifacts, not copies, but most of each pair is identical, and that shared majority is
where they used to drift.

Both are generated from `contracts/<name>.md.tmpl`. The three spine workflows are
likewise generated from `contracts/workflows.md.tmpl` — five contracts plus one workflows
template produce five agents, five dual-use `SKILL.md` files and three prompts, plus the
root `principal-agents.json` binding manifest (14 outputs). The manifest hashes full generated
UTF-8 skill/agent bytes in the same pass; never hand-edit its identities.
`prompts/principal-review-branch.md` is handwritten. Change shared behavior ONCE, there, then `npm run generate`. Editing a
generated file directly is reverted by the next run and fails `npm run generate:check` in
CI.

Deliberate divergences are marked in the template: `{{#skill}}` for interactive-dialogue
rules, `{{#agent}}` for single-shot mechanics — the BLOCKED form, the
assumptions-not-questions rule, the final-message-only rule. Anything outside a block goes
to every output.

When maintaining this package, put lasting regressions in existing behavior/domain suites,
not PR-named files. `npm test` checks current contracts and product behavior.
Behavioural measurement—including the fidelity corpus and skill-harness evidence—lives in [principal-pi-skills-evals](https://github.com/mojomanyana/principal-pi-skills-evals); routing checks live here.

## Setup (pi)

1. Install exact npm releases, then restart Pi:
   `pi install npm:principal-pi-skills@4.12.0`,
   `pi install npm:pi-daddy@0.48.0` and `pi install npm:skill-harness@0.27.0`.
   Native delegation uses exactly Pi 1.0.4 and the qualified captured setup
   (`PI_DADDY_HERDR=0`). Generated skill/agent bindings and captured definition IDs must
   match the selected package. Other versions/backends require separate qualification.
   Enable built-in discovery through Pi `settings.json` `defaultTools` containing
   `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`; preserve other settings and check
   active tools after restart. Pi's default coding selection omits the three discovery tools.
   Plan cannot replace missing discovery with shell or run the progress CLI; it only plans
   later coordinator-owned progress work. See [README Install](README.md#install-pi).
2. Legacy subagents are optional and usable only when native tools are genuinely absent.
   Native delegation needs no separate agent installation and cannot fall back after failure.
   Pin both `npx -p principal-pi-skills@4.12.0 principal-pi-agents install` and
   `npx -p principal-pi-skills@4.12.0 principal-pi-agents check`, matching installed skills.
   Alternatively use Node with the actual selected npm package's `scripts/install-agents.mjs`.
   Definitions go to `${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents`; foreign files are refused.
   Validate release candidates in isolation. Tags/publication are separate and do not erase
   behavioral qualification limits; routing checks stay here and behavioral measurement in
   `principal-pi-skills-evals`.
3. Context handoff (matching pi-daddy candidate): each skill's `allowed-tools` sets how much of this
   session a delegated child may receive. `architect`, `decide` and `plan` allow
   `context:summary`. `build`, `debug`, `review` and `investigate` allow `context:files`: review
   stays low so it judges cold; investigate receives named evidence, not reasoning.
   `git-ops` allows none, on purpose. Each reason is in the
   skill's frontmatter and the README install section, along with the egress note. Don't
   ask a child for more than its ceiling, and don't raise a ceiling to make a refusal go away.

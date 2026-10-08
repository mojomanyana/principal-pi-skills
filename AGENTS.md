# AGENTS.md

Instructions for the [pi coding agent](https://github.com/badlogic/pi-mono) operating
with this set installed. Read this once at session start.

The bootstrap extension (`extensions/bootstrap.ts`) injects this file's routing table,
compressed, from `bootstrap/BOOTSTRAP.md` into each applicable converted request — you do
not need to read this file for the framework to route. This file is the long-form
**routing layer**: full rationale per row, the complete `Next:` set, and the maintenance
rule. The framework deliberately has no routing skill — routing belongs to the
orchestrator (you), and each other file is self-contained: no required reading beyond it.

## Two forms, one rule

A **skill** runs inline in this session: it shares your context, can dialogue with the
user, and its work stays in your window. A **subagent** (via native delegation or the configured legacy runner) runs in
its own context with its own tools, cannot ask questions, and returns only its output
template. The rule: dialogue and session state stay inline; heavy reading, cold judgment,
and noisy loops get delegated.

The set:

- Skills (inline only): `decide`, `architect`, `git-ops`.
- Delegated phases: `plan`, `build`, `review`, `debug`, `investigate`, bound to their
  generated `agents/principal-*.md` contract through `principal-agents.json`. Each also has
  a SKILL.md for deliberately chosen inline work. Legacy principal-* names are only for an
  explicitly configured runner when native tools are genuinely absent.

For native delegation, call `delegate_describe({agent:"phase"})`, require binding package
`principal-pi-skills` and exact phase. Native names are `plan`, `build`, `review`, `debug`,
`investigate`. Pass the corresponding captured `definitionId` to every `delegate` call,
`delegate_all` child and `delegate_chain` step. The runtime verifies enabled selected source and
both generated file hashes. Missing/wrong/disabled bindings, stale reload, unqualified backend,
permission/context refusal, timeout, report gap or uncertain cleanup stops dependent work;
never substitute legacy, foreign or inline execution after failure. Follow authored model/effort
policy without phase-tier overrides. Inline is a workflow choice, not a fallback.

Coordinator handoffs preserve the unmodified describe response and accessible selected
skill/agent source references or exact copies with original identities. Each gate has an owner
and due stage fixed by source authority. Leaf agents check current assigned obligations and
retain later coordinator terminal/cleanup/review gates as pending. The coordinator checks full
native results and settlement after return, including the reviewer, before dependent work.
Missing prerequisites still block; ownership never waives or delays a required gate.
When the operator opts into pi-daddy 0.45.0 public capture, use its exact response/source
artifact references directly; do not reconstruct describe responses or receipt text. Capture
excludes raw details/private sessions and later Pi hook formatting; validate used references
and preserve actual approval ownership. No automatic capture setting or JEV collection is enabled.
Native process cleanup needs a settled identity-bound receipt even when no disposable workspace
exists. Missing emitted runtime evidence blocks dependent work and task completion.

For approved independent batches, use one `delegate_all({children:[...]})` call; every child
carries its native phase name and described `definitionId`. Do not overlap single `delegate`
calls: each conservatively reserves available subtree capacity. Writers need distinct
precreated registered Git worktrees, declared scopes/dependencies and unused full-report paths.
Read every result, retain completed siblings after failures, review candidates and integrate
serially with merged checks. A refusal stops dependent work, never triggers a runner switch.

## Routing — pick by what the input looks like

| Input shape | Route to | How |
|---|---|---|
| Choice and rationale ("should I…", "Postgres or DynamoDB", "what are my options") | `decide` | inline — the dialogue is the value |
| System structure, components, boundaries or data ("design X", "review our architecture") | `architect` | inline — drivers come from asking |
| A task needing order of work and code-level specs ("plan this", "break this down") | `plan` | **subagent** — it opens every file it names; keep that out of this context |
| Code to write ("implement", "fix this known bug", "make the test pass") | `build` | inline, or native `build` with its captured `definitionId` per approved plan step — never fan parallel writers into one working tree |
| A change to judge before landing ("review this", "ready to merge?") | `review` | **subagent, always when available** — a fresh context judging the diff cold beats self-review; inline review of code you just wrote is anchored on its own reasoning |
| An unknown failure to diagnose ("why is this failing", "find the bug") | `debug` | **subagent** when reproduction is noisy (flaky loops, bisects); inline when the user is driving |
| Facts about current code, data, runtime, or history ("how does", "where is", "map", "what changed between") | `investigate` | **subagent** for heavy reading; inline when dialogue is needed |
| A git or GitHub operation ("commit", "push", "open a PR", "I leaked a secret") | `git-ops` | inline, never delegated — needs this session's working-tree state, and destructive ops require user consequence-acceptance no subagent can obtain |

**When more than one applies**, route by requested output: choice/rationale → `decide`,
structure → `architect`, executable sequence → `plan`. "Redis or Memcached?" is `decide`;
"how do I commit this" is `git-ops`, not `build`; "why is this test red" is `debug`, not `build`.
Use only needed phases, not a mandatory chain. Optional read-only Investigate can locate
sources/definitions before Plan or substantial Review; pass original sources too, and leave
the verdict to Review.

**When no skill fits**, don't force one. Everyday Q&A doesn't need the framework.

## The handoff contract

The phases that hand off end with a `Next:` line naming the follow-on. That plus the fixed
template fields *is* the handoff. Read Review Verdict before Next: UNVERIFIED means
evidence/access repair or a caller question, not automatic implementation, even with
`Next: build`. Otherwise read the `Next:` line and route — a subagent never invokes
another agent; inline continuation is orchestration, not a skill invoking another.

`Next:` carries exactly one bare word from a closed set; after that verdict check,
routing is a lookup rather than an interpretation. The complete set:

| Phase | Allowed `Next:` values |
|---|---|
| plan | `build` |
| debug | `build` · `plan` · `done` · `blocked` |
| build | `review` · `debug` · `blocked` |
| review | `build` · `git-ops` |
| decide · architect · investigate · git-ops | *(none — they terminate)* |

`decide` and `architect` end in a judgment the user acts on, not a handoff a workflow routes;
`investigate` ends in a factual report and `git-ops` runs inline. A ceremonial `Next:` on
those four invited
a workflow to route somewhere nobody asked to go. Every value above is consumed by both
workflow prompts, and a unit test fails if a contract declares a value no workflow handles
or a workflow handles one no contract can emit.

Typical spines (available as prompt templates):

- Feature (`/principal-feature <task>`): plan → approval stop → build (inline or
  delegated) → review → git-ops finish. Enter `architect`/`decide` first when the call is
  requesting structure or a choice respectively, and approve that output first.
- Bug (`/principal-bugfix <symptom>`): debug → approval stop → build → review → git-ops
  finish. If debug's note says design flaw, stop and surface it.
- Refactor (`/principal-refactor <scope>`): the feature spine with a no-behavior-change
  frame — behavior and coverage stay equivalent; test maintenance is allowed, and uncovered
  behavior gets a characterization test first.
- Review a branch (`/principal-review-branch [base]`): cold native `review` with its captured `definitionId` of
  `merge-base <base> HEAD..HEAD`, then git-ops finish mode on APPROVE; findings stop for the
  user otherwise. No plan, no build.
- Every spine uses the bound native or explicitly configured legacy interface above.
  Build↔review repair loops stop after two rounds; a third means the plan or diagnosis was
  wrong. A missing full report blocks dependent review; preserve independent completed work.
- Multi-step plans are written to `.principal/plans/<slug>.md` (git-ignored) so a delegated
  build reads its step from the file and a compacted or fresh session resumes from it.
- Tiny change: build → git-ops only when finish is requested. Clear, reversible, localized
  low-risk direct work may finish inline with actual checks and caveats, without `Next:`.
  Honor requested review and existing approvals; a tiny security or normative edit is
  consequential. Delegated status/report protocols and explicit spine approval stops remain.
- Review scope is task, integrated or scoped repair. Task approval covers only its candidate
  and interfaces; only final integrated approval supports Git-Ops finish. Keep original
  whole-change obligations and gates through repairs.
- Progress records are optional coordinator evidence indexes, never approval or execution.
  Reconcile actual authority, work and current report/candidate references; commit, review,
  integration and verification are separate facts. Incomplete/stale records stay unresolved.
  If used, all progress writes go through the installed `principal-pi-progress` helper; never
  hand-write its run manifest or JSONL. Run `check <run> <actual-current-candidate>` after append
  and before relying on resumed progress. Zero issues means index integrity, not completion or approval.
  Full committed workflows can use `check-completion <run> <full-commit> <required-step>...`
  for all five latest phase claims per required step, historical evidence/findings, exact HEAD
  and clean tracked/untracked state; masked index entries and indexed submodules refuse.
  It never infers approval or runs/commits work.

Before any orchestrator artifact write (including planless Review, inline Build or optional
Investigate persistence), create an absent `.principal/.gitignore` containing `*`, never
overwrite an existing ignore file, and verify repository report destinations are ignored;
otherwise stop for caller policy repair. Plan retains its restricted writes; Investigate
remains read-only. Scope reports by task/run/candidate in new unused directories, preserving
prior files and original review path/candidate/baseline through repairs and resume.

Handoffs carry accessible source/definition references, applicable map rows/global gates,
and full report paths, not summaries or bare finding IDs. Collect caveats even on success;
a commit or green suite alone is not full requirement coverage. Review validates candidate-bound
evidence independently. Plans persist completely with short chat summaries. Debug's sandbox
proof is not applied work; a direct diagnose-and-fix request continues through an announced
switch to Build, while the bugfix workflow retains its approval stop.

A delegated step returning `BLOCKED` stops the chain: surface its one question to the
user; don't answer it yourself and keep going.

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

## Decision — 2026-10-08

Exact public evidence persistence belongs to the native producer; Principal consumes its file
references and keeps semantic gate decisions explicit. Progress v1 remains unchanged. The new
read-only completion check requires all named steps and phases, verified finding dispositions,
exact committed identity and a clean checkout; it never turns recorded claims into approval.
Retained failures and incomplete runs remain evidence for later JEV/LoRA evaluation, not automatic
training labels. Completion checks run before semantic advisory experiments.

## Future advisory optimization

Consider JEV and later LoRA for optional recommendations about inline/delegated routing,
step grouping and handoff readiness. Keep stable gate IDs, owners, due stages, candidate/step
identities and observed outcomes available through the existing reports/progress references.
Version advisory experiment records separately; never add model judgments to authority or
silently widen the progress schema. Start with offline/shadow evaluation against independently
checked outcomes. Only reviewed, eligible examples may enter a future training dataset; private
reasoning and credential material are excluded. These are extension points, not an enabled
service, new model calls, automatic labels or trained model. OpenAI Decisions remains excluded.

## Setup (pi)

1. Install exact npm releases, then restart Pi:
   `pi install npm:principal-pi-skills@4.9.0`,
   `pi install npm:pi-daddy@0.45.0` and `pi install npm:skill-harness@0.24.3`.
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
   Pin both `npx -p principal-pi-skills@4.9.0 principal-pi-agents install` and
   `npx -p principal-pi-skills@4.9.0 principal-pi-agents check`, matching installed skills.
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

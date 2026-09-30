# AGENTS.md

Instructions for the [pi coding agent](https://github.com/badlogic/pi-mono) operating
with this set installed. Read this once at session start.

The bootstrap extension (`extensions/bootstrap.ts`) injects this file's routing table,
compressed, from `bootstrap/BOOTSTRAP.md` at session start and after compaction — you do
not need to read this file for the framework to route. This file is the long-form
**routing layer**: full rationale per row, the complete `Next:` set, and the maintenance
rule. The framework deliberately has no routing skill — routing belongs to the
orchestrator (you), and each other file is self-contained: no required reading beyond it.

## Two forms, one rule

A **skill** runs inline in this session: it shares your context, can dialogue with the
user, and its work stays in your window. A **subagent** (via the subagent tool) runs in
its own context with its own tools, cannot ask questions, and returns only its output
template. The rule: dialogue and session state stay inline; heavy reading, cold judgment,
and noisy loops get delegated.

The set:

- Skills (inline only): `decide`, `architect`, `git-ops`.
- Agents (delegate when the subagent tool is available): `principal-plan`,
  `principal-build`, `principal-review`, `principal-debug`, `principal-investigate` — defined in `agents/`. Each
  contract also has a SKILL.md for interactive use when delegation is unavailable or the
  user wants to work through it conversationally.

## Routing — pick by what the input looks like

| Input shape | Route to | How |
|---|---|---|
| Choice and rationale ("should I…", "Postgres or DynamoDB", "what are my options") | `decide` | inline — the dialogue is the value |
| System structure, components, boundaries or data ("design X", "review our architecture") | `architect` | inline — drivers come from asking |
| A task needing order of work and code-level specs ("plan this", "break this down") | `plan` | **subagent** — it opens every file it names; keep that out of this context |
| Code to write ("implement", "fix this known bug", "make the test pass") | `build` | inline, or `principal-build` per approved plan step when the subagent tool exists — never fan parallel writers into one working tree |
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
  frame — existing tests pass unchanged, uncovered behavior gets a characterization test first.
- Review a branch (`/principal-review-branch [base]`): cold `principal-review` of
  `merge-base <base> HEAD..HEAD`, then git-ops finish mode on APPROVE; findings stop for the
  user otherwise. No plan, no build.
- Any spine, when the subagent tool is missing or reports an unknown agent: run that
  phase's skill inline instead and say so in the digest. Fall back on *absence* only —
  any other agent failure stops the workflow. Build↔review repair loops stop after two
  rounds; a third means the plan or the diagnosis was wrong, not the code.
- Multi-step plans are written to `.principal/plans/<slug>.md` (git-ignored) so a delegated
  build reads its step from the file and a compacted or fresh session resumes from it.
- Tiny change: build → git-ops, both inline — every contract carries a Right-sizing
  rule; don't add ceremony the file itself would refuse.

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
template produce five agents, five dual-use `SKILL.md` files and three prompts (13 outputs).
`prompts/principal-review-branch.md` is handwritten. Change shared behavior ONCE, there, then `npm run generate`. Editing a
generated file directly is reverted by the next run and fails `npm run generate:check` in
CI.

Deliberate divergences are marked in the template: `{{#skill}}` for interactive-dialogue
rules, `{{#agent}}` for single-shot mechanics — the BLOCKED form, the
assumptions-not-questions rule, the final-message-only rule. Anything outside a block goes
to every output.

## Setup (pi)

1. `pi install git:github.com/mojomanyana/principal-pi-skills@v4.7.0` installs the eight
   skills, the four `/principal-*` commands, and the bootstrap
   extension, which loads automatically with the package. Install a tag, not a branch.
2. Subagents (optional): before npm publication, latest is 4.6.0 and npm @4.7.0 is not
   yet available. Use the installed tagged package's `scripts/install-agents.mjs` with Node
   (`install`, then `check`), locating its actual path rather than assuming a universal Pi
   install directory. Alternatively follow the concrete verified-tag disposable checkout
   recipe in [README Install](README.md#install-pi). After npm publication, pin both:
   `npx -p principal-pi-skills@4.7.0 principal-pi-agents install` and
   `npx -p principal-pi-skills@4.7.0 principal-pi-agents check`.
   The five definitions go to `${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents`; foreign files
   are refused. Without them, the routing table still runs inline.
   Existing v4.7.0 at `448ac76` excludes subsequent repairs; leave the tag untouched.
   Repair-candidate validation must use that candidate's skills and installer in isolation,
   not claim that installing the old tag validates new fixes.
3. Context handoff (pi-daddy 0.33.0+): each skill's `allowed-tools` sets how much of this
   session a delegated child may receive. `architect`, `decide` and `plan` allow
   `context:summary`. `build`, `debug`, `review` and `investigate` allow `context:files`: review
   stays low so it judges cold; investigate receives named evidence, not reasoning.
   `git-ops` allows none, on purpose. Each reason is in the
   skill's frontmatter and the README install section, along with the egress note. Don't
   ask a child for more than its ceiling, and don't raise a ceiling to make a refusal go away.

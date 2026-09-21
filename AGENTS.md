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
  `principal-build`, `principal-review`, `principal-debug` — defined in `agents/`. Each
  contract also has a SKILL.md for interactive use when delegation is unavailable or the
  user wants to work through it conversationally.

## Routing — pick by what the input looks like

| Input shape | Route to | How |
|---|---|---|
| Exploring a decision, not executing one ("should I…", "what are my options", "I'm stuck") | `decide` | inline — the dialogue is the value |
| A system to design or a significant/irreversible choice ("design X", "Postgres or DynamoDB", "review our architecture") | `architect` | inline — drivers come from asking |
| A task needing order of work and code-level specs ("plan this", "break this down") | `plan` | **subagent** — it opens every file it names; keep that out of this context |
| Code to write ("implement", "fix this known bug", "make the test pass") | `build` | inline, or `principal-build` per approved plan step when the subagent tool exists — never fan parallel writers into one working tree |
| A change to judge before landing ("review this", "ready to merge?") | `review` | **subagent, always when available** — a fresh context judging the diff cold beats self-review; inline review of code you just wrote is anchored on its own reasoning |
| An unknown failure to diagnose ("why is this failing", "find the bug") | `debug` | **subagent** when reproduction is noisy (flaky loops, bisects); inline when the user is driving |
| A git or GitHub operation ("commit", "push", "open a PR", "I leaked a secret") | `git-ops` | inline, never delegated — needs this session's working-tree state, and destructive ops require user consequence-acceptance no subagent can obtain |

**When more than one applies**, route by altitude: the highest-altitude match for the
*actual* request, not the surface phrasing. "Redis or Memcached?" is `architect`; "how do
I commit this" is `git-ops`, not `build`; "why is this test red" is `debug`, not `build`.

**When no skill fits**, don't force one. Everyday Q&A doesn't need the framework.

## The handoff contract

The phases that hand off end with a `Next:` line naming the follow-on. That plus the fixed
template fields *is* the handoff. You read the `Next:` line and route — a subagent never
invokes another agent; inline, continuing into the named skill in this same context is
orchestration, not a skill invoking another.

`Next:` carries exactly one bare word from a closed set, so routing is a lookup rather than
an interpretation. The complete set:

| Phase | Allowed `Next:` values |
|---|---|
| plan | `build` |
| debug | `build` · `plan` · `done` · `blocked` |
| build | `review` · `debug` · `blocked` |
| review | `build` · `git-ops` |
| decide · architect · git-ops | *(none — they terminate)* |

`decide` and `architect` end in a judgment the user acts on, not a handoff a workflow routes;
`git-ops` runs inline and terminates the chain. A ceremonial `Next:` on those three invited
a workflow to route somewhere nobody asked to go. Every value above is consumed by both
workflow prompts, and a unit test fails if a contract declares a value no workflow handles
or a workflow handles one no contract can emit.

Typical spines (available as prompt templates):

- Feature (`/principal-feature <task>`): plan → approval stop → build (inline or
  delegated) → review → git-ops finish. Enter `architect`/`decide` first when the call is
  architectural or still contested.
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

A delegated step returning `BLOCKED` stops the chain: surface its one question to the
user; don't answer it yourself and keep going.

## Maintenance rule — the contracts are generated

`plan`, `build`, `review` and `debug` exist twice: `<name>/SKILL.md` (interactive contract)
and `agents/principal-<name>.md` (the single-shot contract subagents get) — different
artifacts, not copies, but most of each pair is identical, and that shared majority is
where they used to drift.

Both are generated from `contracts/<name>.md.tmpl`. The two namespaced workflows are
likewise generated from `contracts/workflows.md.tmpl` — four contracts plus the workflows
template are the source of everything under `agents/`, `prompts/`, and the four dual-use
`SKILL.md` files. Change shared behavior ONCE, there, then `npm run generate`. Editing a
generated file directly is reverted by the next run and fails `npm run generate:check` in
CI.

Deliberate divergences are marked in the template: `{{#skill}}` for interactive-dialogue
rules, `{{#agent}}` for single-shot mechanics — the BLOCKED form, the
assumptions-not-questions rule, the final-message-only rule. Anything outside a block goes
to every output.

## Setup (pi)

1. `pi install git:github.com/mojomanyana/principal-pi-skills@v4.1.0` — installs the seven
   skills, the four `/principal-*` commands, and the bootstrap
   extension, which loads automatically with the package. Install a tag, not a branch.
2. Subagents (optional): `npx -p principal-pi-skills principal-pi-agents install` copies
   the four agent definitions into `${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents` and refuses
   to overwrite anything it did not install. Without it, everything in the routing table
   above still runs; the How column just collapses to "inline".

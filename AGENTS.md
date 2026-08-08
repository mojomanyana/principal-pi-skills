# AGENTS.md

Instructions for the [pi coding agent](https://github.com/badlogic/pi-mono) operating
with this set installed. Read this once at session start.

This file is the **routing layer**. The framework deliberately has no routing skill —
routing belongs to the orchestrator (you), and each file is self-contained: one file is
the whole contract, there is no required reading beyond it.

## Two forms, one rule

A **skill** runs inline in this session: it shares your context, can dialogue with the
user, and its work stays in your window. A **subagent** (via the subagent tool) runs in
its own context with its own tools, cannot ask questions, and returns only its output
template. The rule: dialogue and session state stay inline; heavy reading, cold
judgment, and noisy loops get delegated.

The set:

- Skills (inline only): `decide`, `architect`, `build`, `git-ops`.
- Agents (delegate when the subagent tool is available): `principal-plan`,
  `principal-review`, `principal-debug` — defined in `agents/`. Delegate to the
  `principal-*` names: agent names are a flat global registry, so a bare `plan` is a slot
  any package can claim and the last one loaded wins silently. The unprefixed names remain
  as deprecated aliases. Each contract also has a SKILL.md for interactive use when
  delegation is unavailable or the user wants to work through it conversationally.

## Routing — pick by what the input looks like

| Input shape | Route to | How |
|---|---|---|
| Exploring a decision, not executing one ("should I…", "what are my options", "I'm stuck") | `decide` | inline — the dialogue is the value |
| A system to design or a significant/irreversible choice ("design X", "Postgres or DynamoDB") | `architect` | inline — drivers come from asking |
| A task needing order of work and code-level specs ("plan this", "break this down") | `plan` | **subagent** — it opens every file it names; keep that out of this context |
| Code to write ("implement", "fix this", "make the test pass") | `build` | inline — the main work, and the only phase that writes durably. Never fan parallel writers into one working tree: "parallel-safe" is a claim about which steps need each other's output |
| A change to judge before landing ("review this", "ready to merge?") | `review` | **subagent, always when available** — a fresh context judging the diff cold beats self-review; inline review of code you just wrote is anchored on its own reasoning |
| An unknown failure to diagnose ("why is this failing", "find the bug") | `debug` | **subagent** when reproduction is noisy (flaky loops, bisects); inline when the user is driving |
| A git or GitHub operation ("commit", "push", "open a PR", "I leaked a secret") | `git-ops` | inline, never delegated — needs this session's working-tree state, and rule-6 destructive ops require user consequence-acceptance no subagent can obtain |

**When more than one applies**, route by altitude: the highest-altitude match for the
*actual* request, not the surface phrasing. "Redis or Memcached?" is `architect`, not
`decide`; "how do I commit this" is `git-ops`, not `build`; "why is this test red" is
`debug` (unknown cause), not `build` (known fix).

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
or a workflow handles one no contract can emit — the two drifting apart is how a spine ends
up with a transition that silently does nothing.

Typical spines (available as prompt templates):

- Feature (`/principal-feature <task>`): plan → build (inline) → review → git-ops
  (inline). Enter `architect`/`decide` first when the call is architectural or still
  contested.
- Bug (`/principal-bugfix <symptom>`): debug → build (inline) → review → git-ops (inline).
  If debug's note says design flaw, stop and surface it.
- Either spine, when the subagent tool is missing or reports an unknown agent: run that
  phase's skill inline instead and say so in the digest. Fall back on *absence* only —
  any other agent failure stops the workflow. Build↔review repair loops stop after two
  rounds; a third means the plan or the diagnosis was wrong, not the code.
- Tiny change: build → git-ops, both inline — every contract carries a Right-sizing
  rule; don't add ceremony the file itself would refuse.

A delegated step returning `BLOCKED` stops the chain: surface its one question to the
user; don't answer it yourself and keep going.

## Maintenance rule — the contracts are generated

`plan`, `review` and `debug` exist three times: `<name>/SKILL.md` (interactive contract),
`agents/principal-<name>.md` (the single-shot contract subagents get) and
`agents/<name>.md` (its deprecated generic-name alias). They are different artifacts, not
copies — but 74–84% of each pair is identical, and that shared majority is where they used
to drift.

All three are generated from `contracts/<name>.md.tmpl`. Change shared behavior ONCE, there,
then `npm run generate`. Editing a generated file directly is reverted by the next run and
fails `npm run generate:check` in CI. Hand-mirroring used to be a reviewer's job and was
never reliably done — which is how the D-scenarios once measured a contract no subagent had
been handed.

Deliberate divergences are marked in the template: `{{#skill}}` for interactive-dialogue
rules, `{{#agent}}` for single-shot mechanics — the BLOCKED form, the
assumptions-not-questions rule, the final-message-only rule. Anything outside a block goes
to every output.

## Setup (pi)

1. `pi install git:github.com/mojomanyana/principal-pi-skills@v2.3.0` — registers the
   skills and the `/principal-feature` + `/principal-bugfix` commands via the `pi`
   manifest. Install a tag, not a branch. (`v2.3.0` is not tagged yet — until the release
   is cut, `main` is the only option and it moves.)
2. Subagents need pi-mono's subagent extension (`examples/extensions/subagent`) and the
   agent definitions installed once: `npx principal-pi-agents install`. It copies real
   files into `${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents` and refuses to overwrite
   anything it did not install.
3. Without the extension, everything runs inline via the skills; the How column above
   simply collapses to "inline".

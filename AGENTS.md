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
- Agents (delegate when the subagent tool is available): `plan`, `review`, `debug` —
  defined in `agents/`. Each also has a SKILL.md for interactive use when delegation is
  unavailable or the user wants to work through it conversationally.

## Routing — pick by what the input looks like

| Input shape | Route to | How |
|---|---|---|
| Exploring a decision, not executing one ("should I…", "what are my options", "I'm stuck") | `decide` | inline — the dialogue is the value |
| A system to design or a significant/irreversible choice ("design X", "Postgres or DynamoDB") | `architect` | inline — drivers come from asking |
| A task needing order of work and code-level specs ("plan this", "break this down") | `plan` | **subagent** — it opens every file it names; keep that out of this context |
| Code to write ("implement", "fix this", "make the test pass") | `build` | inline — the main work; parallel-safe plan steps may fan out as parallel subagent tasks |
| A change to judge before landing ("review this", "ready to merge?") | `review` | **subagent, always when available** — a fresh context judging the diff cold beats self-review; inline review of code you just wrote is anchored on its own reasoning |
| An unknown failure to diagnose ("why is this failing", "find the bug") | `debug` | **subagent** when reproduction is noisy (flaky loops, bisects); inline when the user is driving |
| A git or GitHub operation ("commit", "push", "open a PR", "I leaked a secret") | `git-ops` | inline, never delegated — needs this session's working-tree state, and rule-6 destructive ops require user consequence-acceptance no subagent can obtain |

**When more than one applies**, route by altitude: the highest-altitude match for the
*actual* request, not the surface phrasing. "Redis or Memcached?" is `architect`, not
`decide`; "how do I commit this" is `git-ops`, not `build`; "why is this test red" is
`debug` (unknown cause), not `build` (known fix).

**When no skill fits**, don't force one. Everyday Q&A doesn't need the framework.

## The handoff contract

Every output template ends with a `Next:` line naming the follow-on. That plus the fixed
template fields *is* the handoff. You read the `Next:` line and route — a subagent never
invokes another agent; inline, continuing into the named skill in this same context is
orchestration, not a skill invoking another. Typical spines (available as prompt
templates):

- Feature (`/feature <task>`): plan (subagent) → build (inline) → review (subagent) →
  git-ops (inline). Enter `architect`/`decide` first when the call is architectural or
  still contested.
- Bug (`/bugfix <symptom>`): debug (subagent) → build (inline) → review (subagent) →
  git-ops (inline). If debug's note says design flaw, stop and surface it.
- Tiny change: build → git-ops, both inline — every contract carries a Right-sizing
  rule; don't add ceremony the file itself would refuse.

A delegated step returning `BLOCKED` stops the chain: surface its one question to the
user; don't answer it yourself and keep going.

## Maintenance rule (no generator, by design)

`plan`, `review`, `debug` exist twice: `<name>/SKILL.md` (interactive contract) and
`agents/<name>.md` (single-shot contract — no dialogue, no multi-turn rules, tools in
frontmatter). They are different artifacts, not copies. Any change to SHARED behavior
(the process, the disciplines, the output template's fields) MUST be mirrored by hand
into the other file in the same commit; reviewers should reject a PR that changes shared
behavior in one without the other. Single-shot mechanics — the BLOCKED form, the
assumptions-not-questions rule, the final-message-only rule — exist only in `agents/`
and have no SKILL.md counterpart; interactive-dialogue rules likewise exist only in
SKILL.md.

## Setup (pi)

1. `pi install git:github.com/mojomanyana/principal-pi-skills` — registers the skills
   and the `/feature` + `/bugfix` prompt templates via the `pi` manifest.
2. Subagents need pi-mono's subagent extension (`examples/extensions/subagent`) and the
   agent definitions linked once:
   `mkdir -p ~/.pi/agent/agents && ln -sf "$(pwd)"/agents/*.md ~/.pi/agent/agents/`
3. Without the extension, everything runs inline via the skills; the How column above
   simply collapses to "inline".

# AGENTS.md

Instructions for any coding agent operating with this skill set installed (Claude Code,
the Pi coding agent, Codex CLI, Amp, Droid, or any other harness implementing the Agent
Skills standard). Read this once at session start when you have any of these skills
loaded.

This file is the **routing layer**. The v2 framework deliberately has no routing skill —
routing belongs to the orchestrator (you), and each `SKILL.md` is self-contained: one
file is the whole contract, there is no required reading beyond it.

## The set

Seven skills: `decide`, `architect`, `plan`, `build`, `review`, `debug`, `git-ops`.
Each SKILL.md works both as a loaded skill and, unedited, as a subagent system prompt.

## Routing — pick by what the input looks like

The trigger phrases in each skill's frontmatter `description` are authoritative; this
table is the quick lookup.

| Input shape | Skill |
|---|---|
| Exploring a decision, not executing one ("should I…", "what are my options", "I'm stuck") | `decide` |
| A system to design or a significant/irreversible technical choice to weigh ("design X", "Postgres or DynamoDB") — the decision record (ADR) is part of its output | `architect` |
| A decision or task that needs order of work and code-level specs ("plan this", "break this down", "where do I start") | `plan` |
| Code to write ("implement", "fix this", "make the test pass", "build it") | `build` |
| A change to judge before landing ("review this", "is it ready to merge", "too complex?") — one pass covers correctness *and* simplicity | `review` |
| An unknown failure to diagnose ("why is this failing", "find the bug", "it crashes when…") | `debug` |
| A git or GitHub operation ("commit", "push", "open a PR", "I leaked a secret", "when did this break") | `git-ops` |

**When more than one applies**, route by altitude: the highest-altitude skill that
matches the *actual* request, not the surface phrasing. "Redis or Memcached?" is
`architect`, not `decide`; "how do I commit this" is `git-ops`, not `build`; "why is
this test red" is `debug` (unknown cause), not `build` (known fix).

**When no skill fits**, don't force one. Everyday Q&A doesn't need the framework.

## The handoff contract

Every skill's output template ends with a `Next:` line naming the follow-on skill —
that plus the fixed template fields *is* the handoff. No skill ever invokes another;
the orchestrator reads the `Next:` line and routes. Typical spines:

- Feature: `decide → plan → build → review → git-ops` (enter `architect` only when the
  call is architectural; its design note feeds `plan`).
- Bug: `debug` (diagnose) → `build` (nontrivial fix) or `plan` (design flaw) → `review → git-ops`.
- Tiny change: `build → git-ops` — every skill carries a Right-sizing rule; don't add
  ceremony the skill itself would refuse.

## Running skills as subagents

Copy each `SKILL.md` body into your harness's agent definition (e.g. Claude Code
`.claude/agents/<name>.md`). The frontmatter `description` doubles as the agent
description — it contains only triggers, so an orchestrator can route on it without
reading the body. Restrict tools structurally, not in prose: `decide`/`architect`/
`plan`/`review` get read-only tools; `build`/`debug`/`git-ops` get write access.

In delegated (single-shot) mode every skill returns its literal output template
(`git-ops` returns a `## Facts` block) and states assumptions instead of asking
questions — or returns `BLOCKED` with the one question that matters.

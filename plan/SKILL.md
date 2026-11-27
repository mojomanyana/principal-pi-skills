---
name: plan
metadata:
  principal-package: principal-pi-skills
description: >
  Use when decomposing a multi-file feature, migration, or cross-repo change into ordered
  implementation steps, explicit invariants, target files, and executable verification checks
  before editing code.
allowed-tools: read, grep, find, ls, codemode, parallel, scout_research, scout_brief_read, bookie_search, bookie_read, bookie_propose_memory, context:summary
---

# Plan — Invariant-First Implementation Breakdown

Produce the smallest ordered execution plan that satisfies every requirement cleanly without
editing code. Read existing files, callers, tests, attached Scout briefs, and Bookie decisions
before proposing changes. Batch independent reads with `codemode` or `parallel`.

## Required Plan Contents
1. **Invariants & Boundaries:** Inputs, state transitions, cleanup/error paths, and non-goals.
2. **Ordered Steps:** Each step names exact file paths, concrete symbol/interface changes,
   and dependencies so independent steps can run in parallel (`delegate_all`) while dependent
   steps stay serialized.
3. **Verification Contract:** Exact executable commands and edge/concurrency/failure cases
   each step must prove before completion.
4. **Open Decisions / Risks:** Call out any unresolved requirement conflict or missing authority
   explicitly rather than guessing.


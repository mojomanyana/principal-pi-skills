---
name: architect
metadata:
  principal-package: principal-pi-skills
description: >
  Use when discussing system structure, planning a shared boundary, or building against
  a design assumption that new evidence challenges. Examples include "how should I structure",
  "design a system", "review our architecture", or "write an ADR". Invoked directly, it can
  ask the operator a design question; delegated, it returns a recommendation, assumptions,
  and decisions for the coordinator.
allowed-tools: read, grep, find, ls, codemode, parallel, scout_research, scout_brief_read, bookie_search, bookie_read, bookie_propose_memory, context:summary
---

# Architect — Design from Measurable Drivers

Evaluate feasible structures against actual drivers, constraints, and evidence. No pattern
wins by default: complexity, staffing, reliability, and transition costs are criteria, not
labels that decide the result.

When invoked directly in the main session, check Bookie for prior architecture decisions
and ask the operator one crisp deciding question when a load-bearing constraint or tradeoff
is genuinely missing. Do not invent numeric targets or silently commit through a one-way door.

## Process
1. **Find an observable driver.** Identify the concrete constraint that decides the design
   (throughput, latency, ownership, safety invariant, or operational limit). Retrieve missing
   facts from installed code, attached Scout briefs (`scout_brief_read`), or `scout_research`.
2. **State hard constraints** separately from preferences. Preserve supplied constraints and
   name exact file/symbol references for existing boundaries.
3. **Compare feasible structures** honestly against the drivers. Include simpler alternatives
   when viable; separate measured evidence from estimates.
4. **Recommend with a flip condition:** "choose A because <driver>; move to B when <measurable threshold>".
5. **Flag one-way doors [ONE-WAY]:** schema migrations, public APIs, data deletion, vendor
   lock-in, and security boundaries. State validation, rollback, and abort signals.
6. **Right-size the output:** trivial reversible choices get 2–5 direct sentences plus a flip
   threshold; sound-checks get a verdict and risks up front; full design notes include drivers,
   options, recommendation, assumptions, one-way doors, and decisions to raise.

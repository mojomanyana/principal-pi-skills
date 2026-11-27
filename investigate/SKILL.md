---
name: investigate
metadata:
  principal-package: principal-pi-skills
description: >
  Use when mapping unfamiliar code, tracing a call path, locating where a behavior or bug
  originates, or answering factual codebase questions with exact file and symbol references.
allowed-tools: read, grep, find, ls, codemode, parallel, scout_brief_read, bookie_search, bookie_read, bookie_propose_memory, context:files
---

# Investigate — Read-Only Codebase Tracing

Establish what the code actually does from direct file inspection—never guess or edit files.
Batch 3+ independent file reads or searches in parallel via `codemode` or `parallel`.
Consult attached Scout briefs (`scout_brief_read`) and authorized Bookie memory when relevant.

## Required Output
1. **Direct Answer:** Concise factual conclusion grounded only in observed files.
2. **Traced Call Path:** Ordered step-by-step execution trace (`file:line` → `symbol()` → caller/callee)
   covering entry point, data/authority transforms, and error/cleanup paths.
3. **File References:** Exact paths and symbols read.
4. **Explicit Gaps:** Anything not present in the inspected files or requiring runtime execution.


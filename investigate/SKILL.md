---
name: investigate
description: >
  Use when the user wants to know what is — how code, data, runtime, or history currently
  behaves or is laid out: "how does", "where is", "which", "map", "inventory", "what changed
  between". The output is a factual report with file and line citations. Nothing is changed,
  fixed, or chosen. Not for the cause of a failure (debug), a choice (decide), a verdict on a
  diff (review), acting on the repository (git-ops), or a target design (architect).
allowed-tools: read, grep, find, ls, context:files
---

# Investigate — Facts About What Is

Report the current state of code, data, runtime, or history. Establish facts; do not turn
those facts into a fix, recommendation, design, merge verdict, or repository action.


## Method
1. **State the question.** Restate the factual question narrowly enough that the report has
   a clear boundary. Preserve qualifiers such as environment, version, time range, and
   subsystem.
2. **Read the evidence.** Trace definitions to callers and data to consumers. Prefer the
   implementation and observed artifacts over names, comments, or architecture documents.
   Do not infer runtime behavior from source when configuration or state can change it;
   label what the available evidence cannot establish.
3. **Cite every finding.** Attach a `path:line` or `path:start-end` citation to each code or
   data claim. For history, identify the revision and cite the affected file and lines.
   Separate observation from inference, and say when sources disagree.
4. **Stay read-only.** Do not edit files, run mutating commands, create commits, fix a
   discovered defect, choose among options, propose a target design, or judge whether a
   diff should land. A factual answer may expose a problem; naming the problem is not
   permission to solve or review it.
5. **Stop at scope creep.** A request that expands into a cause, fix, choice, verdict,
   design, or action belongs to another skill. Stop at the original factual boundary and
   put the additional work under `What was not checked`; do not cross the boundary by
   appending advice.

## Output — investigation report
```
## Investigation: <question, one line>
Question: <the factual scope, including version/environment/time range>
Findings:
- <fact> — <path:line or path:start-end>
- <fact> — <path:line or path:start-end>
What was not checked: <unavailable evidence and out-of-scope follow-ons> | none
```

A report with no supported finding says so. Never fill the gap with a likely explanation,
a proposed fix, or a verdict.

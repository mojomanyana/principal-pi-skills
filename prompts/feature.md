---
description: Feature spine - plan agent (isolated, read-only), build inline, fresh-context review agent
---
Execute this workflow for: $@

1. Use the subagent tool with the "plan" agent to produce an executable plan for the task.
   If it returns BLOCKED, stop and surface its one question instead of continuing.
2. Implement the plan yourself in this session by loading the `build` skill, starting at
   step 1. If the plan marks steps parallel-safe, you may dispatch those steps as
   parallel subagent tasks using the plan's per-step specs verbatim.
3. Use the subagent tool with the "review" agent to review the resulting diff cold,
   passing the implementation report. The review agent must run the tests before any
   verdict.
4. When the verdict is APPROVE or APPROVE-WITH-NITS, load the `git-ops` skill inline for
   the commit. Never delegate git operations to a subagent.

---
description: Bug spine - debug agent diagnoses in isolated context, build inline, review agent verifies
---
Execute this workflow for: $@

1. Use the subagent tool with the "debug" agent to diagnose the failure. It returns a
   debugging note with root cause and regression test, keeping the noisy reproduction
   loop out of this context. If the note says NOT REPRODUCED or ends with a question,
   stop and surface it.
2. If the note says "Next: plan (it's a design flaw)", stop and tell me. Otherwise
   implement the fix yourself in this session by loading the `build` skill.
3. Use the subagent tool with the "review" agent to review the fix cold, verifying the
   regression test fails before / passes after.
4. On a clean verdict, load the `git-ops` skill inline for the commit.

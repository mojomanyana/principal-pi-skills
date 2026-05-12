---
id: baton-YYYY-MM-DD-<topic-slug>
from: brainstorming
to: <software-architect | implementation-planner | tech-lead | project-git | user>
created: YYYY-MM-DDTHH:MM:SSZ
revision: 1
references:
  - path: <path to decision brief, e.g., docs/briefs/auth-strategy.md>
    section: <optional section anchor>
objective: |
  <One to three sentences naming what the receiver is being asked to do
  based on the decision. Bad: "Use the decision." Good: "Build the
  architecture for the chosen path (magic-link auth); the brief constrains
  the QA scenarios and the do-nothing alternative we rejected."

kill_criteria:
  - <Condition under which receiver should stop and hand back —
    e.g., "if the architecture phase reveals a constraint that
    invalidates the chosen option, return for re-brainstorm">
  - <Add more as appropriate>

return_contract:
  artifacts:
    - <What the receiver must produce — e.g., "ADR + C4 Container diagram
      + design doc">
  status: complete | needs-replan | blocked

# Transition-specific:
decision: |
  <The chosen path, in one sentence. E.g., "Adopt magic-link email
  authentication for the consumer flow; defer password-based auth
  for the admin console.">

options_considered:
  - name: <option 1 — short title>
    summary: <one line>
    why_rejected: <one line, or "chosen">
  - name: <option 2>
    summary: <one line>
    why_rejected: <one line>
  - name: do nothing
    summary: <one line>
    why_rejected: <one line>
  # Minimum 3 options, ALWAYS including "do nothing"

reversibility: two-way | one-way

premortem_summary: |
  <Top 1-3 failure modes considered for the chosen path. E.g., "Failure
  mode A: email deliverability degrades; mitigation is fallback to
  recovery codes. Failure mode B: ...">

open_questions:
  - question: <a question deliberately not answered>
    revisit_trigger: <when to come back to it>
---

# Handoff Baton: <Title — what the decision was about>

## Context

<!--
  Prose body. Explain anything the YAML couldn't carry:
  - What the user was struggling with at the start
  - Key reframes that happened during the session
  - Stakeholders the decision affects
  - Anything the receiving skill should know but isn't load-bearing
-->

<Context paragraph(s).>

## Decision rationale

<!--
  Short narrative of WHY the chosen path won. Reference the options
  table above; don't restate it. Focus on the marginal trade — what
  the chosen path gives up, and why that trade is acceptable.
-->

<Rationale paragraph(s).>

## What this baton does NOT decide

<!--
  Be explicit about deliberate non-decisions. The receiver should
  not infer answers to these from the decision text.
-->

- <Non-decision 1>
- <Non-decision 2>

## Handoff note

<!--
  Specific guidance for the receiving skill. What to pay particular
  attention to. What's most likely to surprise them.
-->

<Note to the receiver.>
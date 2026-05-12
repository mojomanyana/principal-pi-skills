---
id: baton-YYYY-MM-DD-<design-slug>
from: software-architect
to: <implementation-planner | tech-lead | project-git | brainstorming | user>
created: YYYY-MM-DDTHH:MM:SSZ
revision: 1
references:
  - path: <path to design doc or ADR, e.g., docs/design/payment-flow.md>
    section: <optional section anchor>
  - path: <path to C4 diagrams, if separate>
objective: |
  <One to three sentences naming what the receiver is being asked to do.
  Bad: "Build this design." Good: "Plan the build of the payment-flow
  architecture (3 containers, 2 critical scenarios); use the design doc
  as the source of truth and the C4 Container diagram as the seam map for
  the walking skeleton.">

kill_criteria:
  - <Condition under which receiver should stop and hand back —
    e.g., "if a QA scenario can't be met with the proposed structure,
    return for architectural revision">
  - <Add more as appropriate>

return_contract:
  artifacts:
    - <What the receiver must produce — e.g., "implementation plan
      with walking skeleton + slice DAG">
  status: complete | needs-replan | blocked

# Transition-specific:
design_doc:
  path: <path>
  level: <design-doc | ADR | advisory-prose>
  status: <draft | accepted | superseded>

qa_scenarios:
  - id: QA-1
    source: <who initiates>
    stimulus: <what triggers>
    environment: <under what conditions>
    artifact: <which component>
    response: <measurable behavior>
    measure: <concrete threshold>
  # Add more QAs as the design has them

c4_diagrams:
  - level: Context
    path: <path or "inline in design doc §N">
  - level: Container
    path: <path>
  - level: Dynamic
    path: <path>
    scenario: <which architecturally-significant scenario>
  - level: Deployment
    path: <path>
  # Only include levels the design actually produced

decision_rules:
  - rule: <"If X is observed, the recommendation flips to Y">
    rationale: <one line>
  # The conditions under which the architectural recommendation
  # would change. Required for non-trivial designs.

non_goals:
  - <Explicit out-of-scope item 1>
  - <Explicit out-of-scope item 2>

reversibility: two-way | one-way
# If one-way, kill_criteria above MUST include the trigger for
# revisiting the architectural decision.

adr_status: <"none" | "ADR-NNNN drafted" | "ADR-NNNN accepted">
---

# Handoff Baton: <Design Title>

## Context

<!--
  Prose body. Set the stage for the receiver:
  - What problem the design solves
  - Key constraints that shaped it (team size, deadlines, ops maturity)
  - What was deliberately NOT designed (and is in non_goals above)
-->

<Context paragraph(s).>

## Design summary

<!--
  Restate the design in 2-3 sentences for the receiver. Don't replace
  the design doc — point to it. This is the orientation, not the spec.
-->

<Summary paragraph.>

## Critical scenarios

<!--
  Brief: which scenarios in the design are most architecturally significant?
  These are the ones the receiver's work must preserve. For a planner,
  these become walking-skeleton candidates. For tech-lead, these become
  test cases.
-->

- **Scenario 1:** <name> — see Dynamic diagram <path>
- **Scenario 2:** <name> — see Dynamic diagram <path>

## What this baton does NOT decide

<!--
  Architectural decisions are necessarily abstract. Many concrete decisions
  remain for the next skill. Surface them so the receiver knows what's
  open.
-->

- <Open item 1, e.g., "specific library choice for the message bus">
- <Open item 2, e.g., "exact retention policy for audit logs">

## Risks worth flagging

<!--
  Beyond kill_criteria above (which are stop conditions), what should
  the receiver watch for? Issues that aren't blocking but warrant
  attention.
-->

- <Risk 1, with mitigation thought>
- <Risk 2, with mitigation thought>

## Handoff note

<!--
  Anything specific to this receiver. A planner might need different
  context than a tech-lead picking up a single slice.
-->

<Note to the receiver.>
---
id: baton-YYYY-MM-DD-<slice-slug>
from: tech-lead
to: coder
created: YYYY-MM-DDTHH:MM:SSZ
revision: 1
references:
  - path: <path to coding spec, e.g., docs/specs/payment-flow-S2.md>
    section: <optional anchor>
  - path: <upstream baton path, if there was one from planner>
objective: |
  <One to three sentences. What the coder is being asked to implement.
  Bad: "Implement the spec." Good: "Implement spec §3-§4 (token
  validation per the schema in src/auth/schemas.ts); the spec includes
  the test plan and ripple analysis. Coder should reconfirm the two
  flagged assumptions before writing code.">

kill_criteria:
  - <Condition under which coder should stop and hand back to tech-lead
    rather than push through. Common examples:>
  - The spec contradicts something discoverable in the codebase
    (drift recovery — see coder Mode F)
  - A flagged assumption turns out false in a way that changes the spec
  - The change would silently break a contract the spec didn't authorize
  - A red phase test can't be made to pass without scope expansion

return_contract:
  artifacts:
    - working code matching the spec
    - implementation report (coder/assets/implementation-report.md)
    - handoff baton to project-git (coder/assets/handoff-baton-to-git.md)
  status: complete | drift | blocked

# Transition-specific:
spec_path: <path to filled coding spec>
spec_revision: <revision number of the spec>

first_action: |
  <Concrete first move for the coder. Should NOT be "start coding."
  Should be a verification step that confirms the lay of the land
  before any code is written. Examples:
    - "Read src/auth/schemas.ts. Confirm the LoginRequest schema
       referenced in spec §3 does not already exist."
    - "Run the test suite at src/auth/__tests__/ from main. Confirm
       it is green; record the baseline count."
    - "Open src/auth/login.test.ts. Confirm the test layout convention
       matches the spec's §5 plan.">

flagged_assumptions:
  - assumption: <Statement that tech-lead made when specifying>
    how_to_verify: <Concrete check the coder runs>
    if_false: <What to do — revise spec, route back, etc.>
  # List ALL load-bearing assumptions. Coder verifies these BEFORE
  # writing any production code.

acceptance_signal: |
  <How coder will know the slice is done. Should be testable, observable.
  Bad: "It works." Good: "spec §5 tests all green; existing tests in
  src/auth/__tests__/ still green; manual verification of login flow
  succeeds with valid + invalid inputs.">

test_plan_ref:
  path: <path to spec>
  section: <"§5" or wherever the test plan lives>

reversibility_tags:
  # Per-decision tags from the spec (see spec §7).
  # Format: <decision-name>: <🟢 two-way | 🟡 costly | 🔴 one-way>
  <decision-1>: <tag>
  <decision-2>: <tag>
  # 🔴 one-way decisions MUST have a kill_criterion above naming
  # the trigger for revert.

ripples:
  # Surfaced in the spec; restated here so coder has the watch-list.
  files_likely_touched:
    - <path>
  callers_at_risk:
    - <function or module>
  side_effects_introduced:
    - <new IO, new logs, new env var, new metric>
  migration_needed: <none | migration step description>
---

# Handoff Baton: <Slice Title>

## Context

<!--
  Prose body. Frame the slice for the coder:
  - What problem this slice solves (1 paragraph)
  - How it fits in the larger plan, if upstream from a planner
  - What's special about THIS slice that the coder should keep in mind
-->

<Context paragraph(s).>

## First-action rationale

<!--
  Why is the first_action above what it is? The coder may be tempted
  to skip verification and dive in. Explain why this particular check
  matters for this particular slice.
-->

<Rationale paragraph.>

## What's been thought through (so coder doesn't reinvent)

<!--
  Tech-lead exploration that coder doesn't need to repeat. The spec has
  details; this is the orientation. Examples:
    - "I read the existing schemas; LoginRequest is new — see spec §3."
    - "I checked the JWT library's expiration handling; we're using
       the built-in `verify()` not a custom check."
    - "I ran the baseline tests; green at commit abc123."
-->

- <Tried/ruled-out item 1>
- <Tried/ruled-out item 2>

## Things to surface if discovered

<!--
  Beyond kill_criteria (which are stop conditions), what should the
  coder mention in the implementation report even if it didn't stop
  the work? Examples:
    - Convention deviations (and why they were chosen)
    - Unexpected adjacent dead code
    - Hacky workarounds chosen because of time pressure
-->

- <Watch item 1>
- <Watch item 2>

## Handoff note

<!--
  Anything specific to this implementation that doesn't fit the
  structured fields. Tone: brief, actionable.
-->

<Note to the coder.>
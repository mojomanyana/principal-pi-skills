# Focused test review

Use this mode when the user asks to review tests, or test design is a material part of the
current change. It belongs to the existing Review scope/verdict; do not add a separate agent
or gate merely because tests changed.

For each important behavior, ask what plausible failure the test would detect and why its
expected result is correct. Trace the actual input, action and observed outcome. Prioritize:

- Critical happy, error and boundary flows, including lifecycle/concurrency behavior when
  the product owns it. A newly fixed bug should fail without the fix and pass with it;
  existing correct behavior can be characterized without fabricating failure.
- Assertions that observe the contract. Call ordering/arguments can be the behavior when
  they define a protocol; incidental private calls or copied production calculations are
  weak substitutes for user-visible state and effects.
- Mocks that retain consequential side effects, failure modes and timing. A mock that
  removes the bug's cause may make a regression meaningless. Prefer an existing realistic
  seam; introduce a new one only when its benefit justifies the design cost.
- Determinism through controlled clocks, events and bounded waits for observable conditions.
  A sleep that occasionally makes a race disappear is not proof of the race being fixed.
- Redundancy and maintainability: combine same-behavior data cases; remove duplicate guards
  and implementation mirrors. Keep regressions organized by product behavior in existing
  suites, not PR/finding IDs or transient release/approval status.

Separate current behavior coverage from historical receipt integrity and disposable probes.
An evidence-only audit usually reuses existing checks or a disposable experiment. A permanent
test earns its place by protecting an enduring requirement or an explicit authorized need,
not by raising a count. Contract text is product too: structural guards can protect real
authority/routing semantics, but regex presence alone does not demonstrate model compliance.

Report a concrete defect or missing critical flow, its consequence, source location and the
smallest useful correction. Preserve valid safeguards while simplifying. No test-count,
coverage or mutation-score quota, invented bug, or obligatory full-suite replay is required.

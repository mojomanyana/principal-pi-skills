# Risk Register: <PLAN NAME>

<!--
  Drop-in standalone risk register. Use this only when the risk landscape is
  large enough to merit its own document (5+ significant risks, complex
  interactions, multiple owners). Otherwise, inline the register in the plan
  itself (see assets/implementation-plan.md §4).

  See references/risk-and-spikes.md for the taxonomy, scoring rules, and discipline.
-->

## Header

- **Plan:** <plan ID and link>
- **Owner:** <person responsible for this register>
- **Created:** YYYY-MM-DD
- **Last updated:** YYYY-MM-DD

---

## Active Risks

<!--
  Risks that are currently Open or Mitigating. Closed/Materialized risks
  move below to the history table.

  Categories (one per row): Technical / Integration / Operational /
  Security / Coordination / Scope.

  Likelihood (L) and Impact (I): Low / Medium / High. See risk-and-spikes.md §4.

  Status: Open / Mitigating / Materialized / Closed.

  Mitigation: a slice ID (S1.5 spike, S3 implementation), an operational
  practice (reviewer, monitor), or "accepted" with reasoning.
-->

| ID  | Cat | Description | L | I | Mitigation | Status | Owner | Notes |
|-----|-----|-------------|---|---|------------|--------|-------|-------|
| R1  | <cat> | <one sentence> | M | H | <ref> | Open | <name> | <link to spike or slice> |
| R2  | <cat> | <one sentence> | L | H | <ref> | Mitigating | <name> | |
| R3  | <cat> | <one sentence> | M | M | <ref> | Open | <name> | |
| R4  | <cat> | <one sentence> | H | L | accepted — <reasoning> | Open | <name> | |
| R5  | <cat> | <one sentence> | M | M | <ref> | Open | <name> | |

---

## Closed / Materialized Risks (history)

<!--
  Risks that have been closed (mitigation worked) or materialized
  (the event happened — capture what we learned). Don't delete; the history
  is input to better risk registers on future plans.
-->

| ID  | Description | Outcome | Date closed | What we learned |
|-----|-------------|---------|-------------|-----------------|
| R0  | <description> | Closed — <mitigation worked> / Materialized — <impact and response> | YYYY-MM-DD | <one or two sentences> |

---

## Risk-to-Slice Map

<!--
  Cross-reference: which slices in the plan mitigate which risks.
  Useful for review ("which risk does this slice address?") and for replan
  ("we cut this slice — what risks are now exposed?").
-->

| Risk | Mitigating slice(s) | Notes |
|------|---------------------|-------|
| R1   | S1.5 (spike), S3 (impl) | Spike validates approach; S3 implements. |
| R2   | S2 (token storage) | Inherent property of S2 acceptance. |
| R3   | S5.alt (fallback) | Fallback slice exists; primary path is S5. |
| R4   | (accepted)        | No mitigation slice; monitor in production. |
| R5   | S0.5 (spike), S6 (impl) | |

---

## Pre-mortem Summary

<!--
  Brief log of pre-mortem failure modes considered. Cross-reference to risks
  in the register. See risk-and-spikes.md §6.
-->

| Failure mode imagined | Covered by risk | Plan response |
|-----------------------|-----------------|---------------|
| <Catastrophic scenario 1> | R1 | <how the plan addresses it> |
| <Catastrophic scenario 2> | R3 | <how the plan addresses it> |
| <Catastrophic scenario 3> | (new) R6 added | <slice or mitigation> |

---

## Review Schedule

<!--
  When this register gets reviewed. Common cadences: after each wave, weekly
  during active execution, after every risk materialization.
-->

- **After Wave 1:** YYYY-MM-DD — confirm walking-skeleton seams matched risk assumptions
- **After Wave 2:** YYYY-MM-DD — re-score active risks given mid-plan information
- **On any risk materialization:** within 1 business day — debrief and update register
- **At plan completion or abandonment:** capture final lessons in history table

---

## Self-check

Before treating this register as complete:

- [ ] Each of the six categories is checked (even if not every category has a risk, the check is done)
- [ ] No row scored "M × M" with no real reasoning (anti-pattern; see anti-patterns.md §3.1)
- [ ] Every Open risk has a mitigation, a fallback, or an explicit accepted-with-reason
- [ ] Critical-path slices are protected against H-impact risks
- [ ] One-way-door slices have associated risks captured here (or are covered by plan-level kill criteria)
- [ ] At least 5 pre-mortem failure modes have been imagined and accounted for
- [ ] Each risk has an owner; "the team" isn't an owner
- [ ] Risk-to-slice map is consistent with the plan's slice IDs

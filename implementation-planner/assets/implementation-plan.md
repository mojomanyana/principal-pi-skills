# Implementation Plan: <NAME>

<!--
  Drop-in template. Fill out top-to-bottom. The plan is a context-engineering
  artifact: downstream skills will consume sections of this; mid-flight skills
  will update its status; future-you will pick it up after interruption.

  Keep prose tight. Use bullets and tables. Link out for depth; inline what's
  load-bearing for execution.

  Sections marked [required] must not be omitted. Sections marked [optional]
  apply only when relevant.

  See plan-anatomy.md for the section-by-section guide.
-->

## Header [required]

- **Plan ID:** plan-YYYY-<slug>
- **Owner:** <name or role>
- **Created:** YYYY-MM-DD
- **Last updated:** YYYY-MM-DD
- **Status:** DRAFT | ACTIVE | BLOCKED | DONE | ABANDONED
- **Source:** <spec / ADR-XXXX / brainstorm session of DATE / user request — link or path>

---

## 1. Outcome [required]

<!-- One to three sentences. Measurable. If someone reads only this, they should be able to tell whether the plan succeeded. -->

<Outcome statement here. Include a quantitative anchor if at all possible.>

**How we'll know we won:**
- <Measurable signal 1>
- <Measurable signal 2>

---

## 2. Context and Links [required]

<!-- Three to six bullets. Link to upstream artifacts; don't dump them inline. -->

- Spec / PRD: <link>
- ADR(s): <link>
- Decision brief (if from brainstorming): <link>
- Prior plan(s) this continues: <link or "none">
- Other relevant context: <link>

---

## 3. Constraints and Non-goals [required]

### Constraints
<!-- What's fixed and not subject to negotiation during execution. -->

- <Constraint 1>
- <Constraint 2>

### Non-goals
<!-- What this plan deliberately is NOT doing, even though someone might expect it to. -->

- <Non-goal 1; if there's a plan that owns it, link>
- <Non-goal 2>

---

## 4. Risk Register [required]

<!--
  Inline if ≤5 significant risks. Standalone file if larger (see assets/risk-register.md).
  Categories: Technical / Integration / Operational / Security / Coordination / Scope.
  See risk-and-spikes.md for the taxonomy and scoring rules.
-->

| ID  | Category | Description | L | I | Mitigation | Status | Owner |
|-----|----------|-------------|---|---|------------|--------|-------|
| R1  | <cat>    | <one sentence> | L/M/H | L/M/H | <slice ID or operational practice or "accepted"> | Open | <name> |
| R2  | <cat>    | <one sentence> | L/M/H | L/M/H | <mitigation> | Open | <name> |
| R3  | <cat>    | <one sentence> | L/M/H | L/M/H | <mitigation> | Open | <name> |

---

## 5. Walking Skeleton [required]

<!--
  The thinnest end-to-end slice that exercises every architectural seam.
  Stubs and no-ops at nodes; real wiring at edges. Always Step 0 unless
  explicitly justified (with a citation).

  See decomposition.md §3 for design guidance.
-->

### S0 — Walking Skeleton

- **Ships:** <The end-to-end thin slice; name every seam being exercised>
- **Acceptance:**
  - Endpoint/service is reachable from the production environment via the real deploy pipeline
  - Logs appear in the real observability stack
  - <Other seam-specific signals>
- **Reversibility:** *two-way*
- **Size:** XS / S
- **Depends on:** —
- **Handoff:** <skill executing this slice, e.g., coding>

---

## 6. Vertical Slices [required]

<!--
  Each slice = one INVEST-passing unit. Repeat the block below per slice.
  See decomposition.md for splitting patterns when a slice fails INVEST.
-->

### S1 — <title>

- **Ships:** <observable deliverable, 1–3 bullets>
- **Acceptance:**
  - <Functional criterion 1>
  - <Functional criterion 2>
  - <Technical criterion>
  - <Operational criterion>
- **Observability** (if production-bound):
  - Visible: <log / trace>
  - Measurable: <metric>
  - Alertable: <threshold or "none, with reason">
  - Debuggable: <context>
- **Kill criteria:** <when to abandon or pivot; required for *one-way* and for spikes>
- **Reversibility:** *two-way* / *one-way*
- **Size:** XS / S / M
- **Depends on:** <slice IDs>
- **Enables:** <slice IDs>
- **Spike?:** no / yes (if yes: time-box, deliverable path, question being answered)
- **Mitigates:** <risk IDs, if applicable>
- **Handoff:** <skill executing this slice>

### S2 — <title>

<...repeat...>

### S3 — <title>

<...repeat...>

<!-- ... more slices ... -->

---

## 7. Dependency DAG [required]

<!--
  Adjacency list preferred for ≤15 slices; Mermaid for larger or where visual helps.
  See dependencies-and-sequencing.md.
-->

```
S0 (walking skeleton) → S1, S2
S1 (<title>)          → S3
S2 (<title>)          → S3
S3 (<title>)          → DONE
```

**Critical path:** S0 → S1 → S3 (longest path; protect first)

**Off-critical with slack:**
- S2 (slack: 1 wave)

**Waves (parallel-eligible groups):**
- Wave 1: S0
- Wave 2: S1, S2 (parallel after S0)
- Wave 3: S3 (after S1 + S2)

---

## 8. One-way-door Review [required if any *one-way* slices]

<!-- Each one-way-door slice gets a row. -->

| Slice | Why one-way | Rollback plan | Kill criterion | Reviewer |
|-------|-------------|---------------|----------------|----------|
| <Sx>  | <e.g., schema change in shared table> | <plan, or explicit "no rollback; forward-fix only"> | <specific trigger> | <name> |

---

## 9. Plan-level Kill Criteria [required]

<!-- At least one. See acceptance-and-kill-criteria.md §4. -->

- <Concrete trigger + decisive action. E.g., "If by end of Wave 2, fewer than 60% of Wave-1 acceptance criteria are passing on staging, declare plan blocked and replan from risk register.">
- <Another, if applicable>

---

## 10. Handoff Points [required]

<!--
  Every skill-boundary transition in this plan. One row per handoff.
  When execution reaches the row, produce a baton (assets/handoff-baton.md).
-->

| Slice | From → To | Trigger | Baton path / status |
|-------|-----------|---------|---------------------|
| S0    | implementation-planner → coding   | Plan approved | <path or "pending"> |
| S0    | coding → project-git              | S0 implemented, ready to merge | <path or "pending"> |
| S1    | implementation-planner → coding   | S0 DONE       | <path or "pending"> |
| <...> | <...>                             | <...>         | <...>               |

---

## 11. Open Questions [optional but recommended]

<!-- Things deliberately not decided. Each needs owner and deadline. -->

| ID  | Question | Owner | Deadline | Blocks slice(s) |
|-----|----------|-------|----------|-----------------|
| Q1  | <sharp question> | <name> | YYYY-MM-DD | <slice IDs or "none — long-tail"> |

---

## 12. Pre-mortem (optional but strongly recommended)

<!--
  Before delivering: imagine it's three months from now and this plan failed catastrophically.
  What happened? Generate 5+ failure modes. For each, confirm: in risk register? mitigated?
  See risk-and-spikes.md §6.
-->

- **Failure mode 1:** <what happened> → Risk: <R-ID> / Mitigation: <how addressed in plan>
- **Failure mode 2:** <what happened> → Risk: <R-ID> / Mitigation: <how addressed in plan>
- **Failure mode 3:** <what happened> → Risk: <R-ID> / Mitigation: <how addressed in plan>
- **Failure mode 4:** <what happened> → Risk: <R-ID> / Mitigation: <how addressed in plan>
- **Failure mode 5:** <what happened> → Risk: <R-ID> / Mitigation: <how addressed in plan>

---

## 13. Status (alive — append only) [required]

<!--
  Append-only. Newest entry at top. Never edit prior entries.
  Every meaningful event gets a dated entry: slice status change, risk materialization,
  scope change, replan, baton sent, baton returned.
-->

### YYYY-MM-DD

- <Event 1>
- <Event 2>

### YYYY-MM-DD

- Plan created from <source>
- All slices sized; S0 (walking skeleton) ready to start
- <Other initial notes>

---

## Self-check before delivering [required]

Before marking this plan ready, confirm:

- [ ] Outcome is measurable (Section 1)
- [ ] At least the top 3 risks are listed and mitigated or accepted with reasoning (Section 4)
- [ ] Walking skeleton is named as Step 0, or its omission is justified with a citation (Section 5)
- [ ] Every slice passes INVEST (Section 6) — see decomposition.md §1
- [ ] Every slice has falsifiable acceptance criteria (Section 6)
- [ ] Production-bound slices have observability criteria (Section 6)
- [ ] One-way doors have kill criteria and named reviewers (Section 8)
- [ ] DAG is acyclic; critical path is identified (Section 7)
- [ ] At least one plan-level kill criterion exists (Section 9)
- [ ] Handoff points name receiving skill and trigger (Section 10)
- [ ] Pre-mortem run and surfaced failure modes are in the risk register (Section 12)
- [ ] Non-goals are listed (Section 3) — at least three; cheap insurance against scope creep

If any check is missing, the plan isn't ready. Fix before delivering.
# Handoff Baton: <SHORT TITLE>

<!--
  Drop-in template for a SINGLE skill-boundary transition. One baton per transition.
  This document is a delegation contract, not a status update and not a plan summary.

  Save to: /docs/batons/baton-YYYY-MM-DD-<plan-slug>-<slice-id>.md
  (or wherever your project's convention places batons)

  The seven sections below are REQUIRED. Do not omit. See handoff-contracts.md §3.
-->

## 1. Header [required]

- **Baton ID:** baton-YYYY-MM-DD-<plan-slug>-<slice-id>
- **Plan:** <plan ID and path/link>
- **From:** <sending skill, e.g., implementation-planner>
- **To:** <receiving skill, e.g., coding>
- **Slice(s):** <slice ID(s) this baton covers>
- **Created:** YYYY-MM-DD HH:MM
- **Revision:** <none / -revised-N if updating an in-flight baton>

---

## 2. Objective [required]

<!--
  One to three sentences. What the receiving skill is being asked to do.
  Not the broader plan — the specific work for this baton.

  Bad: "Implement password reset."
  Good: "Implement slice S2 (token store) per its acceptance criteria. Output:
  a working token issuance and validation service with the persistence layer wired."
-->

<Objective statement here. Sharp. Action-oriented.>

---

## 3. Inputs [required]

<!--
  Concrete, enumerable. Each input on its own line. The receiving skill should
  be able to list what they're working from.
-->

**Documents:**
- Plan: <path/link> — specifically section <Sx> for this work
- Design: <ADR-XXXX or design doc link>
- Prior batons in this chain: <list or "none">
- Spike findings (if any): <path/link>

**Code / artifacts:**
- Repo: <name>
- Branch: <name or "to be created">
- Files likely touched: <paths or directories>
- Walking-skeleton reference: <PR # or commit>

**Constraints (non-negotiable for this work):**
- <Constraint 1>
- <Constraint 2>

**Acceptance criteria (inline from plan §Sx):**
- <Criterion 1>
- <Criterion 2>
- <Criterion 3>

**Conventions to follow:**
- <Style / naming / structure pointer; link to existing patterns in the codebase>

---

## 4. Context capsule [required]

<!--
  THE distinctive section. Compressed state the receiving skill needs.
  See handoff-contracts.md §4 for compression principles:
   - Select, don't dump
   - Compress chronological history into structural state
   - Link, don't inline (except for facts referenced repeatedly)
   - Surface load-bearing assumptions
   - Name the seams
-->

**What is currently true (state):**
- <Fact 1 — e.g., "Token storage schema exists at /db/migrations/0014_pwd_reset_tokens.sql (deployed in S0).">
- <Fact 2 — e.g., "Email service is wired through SES sandbox; production credentials configured but feature-flag-gated.">
- <Fact 3>

**Load-bearing assumptions** (if any of these are wrong, the work breaks; verify or push back):
- <Assumption 1 — e.g., "SES sandbox latency is representative of prod within 2x.">
- <Assumption 2>

**Seams this slice connects to:**
- Upstream (where my inputs come from): <slice IDs and what they provide>
- Downstream (what consumes my outputs): <slice IDs and what they expect>

**Decisions already settled — do NOT revisit:**
- <Decision 1, with pointer — e.g., "argon2id for token hashing — see ADR-0014 §4.">
- <Decision 2, with pointer>

---

## 5. Return contract [required]

<!--
  What the sending side expects back. Each item should be falsifiable —
  something you can check happened.
-->

**Artifacts:**
- <Artifact 1 — e.g., "PR opened against main, titled 'S2: token store', linked to plan and ADR-0014.">
- <Artifact 2 — e.g., "All acceptance criteria from §3 covered by tests in the PR.">
- <Artifact 3>

**Plan status update:**
- Slice <Sx> → DONE / BLOCKED / PARTIAL / ABANDONED (with reason)
- Update plan status section with dated entry referencing this baton

**Reverse handoff (if continuing to another skill):**
- <Next baton expected? To which skill? What scope?>
- <Or: "no further handoff; return artifact only">

---

## 6. Kill criteria [required]

<!--
  When the receiving skill should stop and hand back without completing.
  Scoped to THIS baton's work, not plan-level.
-->

**Time-box:**
- If work on this baton exceeds <N hours/days> without acceptance criteria passing, stop and hand back with status PARTIAL or BLOCKED.

**Discovery triggers:**
- <Specific trigger 1 — e.g., "If the schema migration cannot be applied without data loss, stop and hand back; this is a planner concern, not an implementation concern.">
- <Specific trigger 2 — e.g., "If a load-bearing assumption (§4) is found to be wrong, stop and hand back with the new finding.">
- <Specific trigger 3 — e.g., "If a slice not in this baton's scope must be touched to complete it, stop and consult planner — this is scope drift.">

---

## 7. What's been tried / ruled out [required]

<!--
  Often the most valuable section. Spares the receiving skill from re-discovering
  dead ends or re-litigating closed decisions.
-->

**Approaches considered and rejected (with reasons):**
- <Approach 1> — rejected because <reason>; see <link if relevant>
- <Approach 2> — rejected because <reason>

**Spike findings (if any):**
- <Brief summary> — see <spike deliverable path>

**Known gotchas in the area being worked on:**
- <Gotcha 1 — e.g., "The `auth.users` table has a soft-delete column `deleted_at` that several upstream services don't filter on; ensure token lookups exclude soft-deleted users.">
- <Gotcha 2>

**Out-of-scope for this baton (don't do these even if tempted):**
- <Item 1 — e.g., "Don't touch the legacy password reset endpoint; that's a separate plan.">
- <Item 2>

---

## Self-check before sending [required]

Read the baton fresh, pretending you've never seen the plan. Can you tell:

- [ ] What's being asked? (§2)
- [ ] What inputs you have to work from? (§3)
- [ ] What state of the world is true now? (§4)
- [ ] What load-bearing assumptions you should verify? (§4)
- [ ] What to hand back, and how to know you're done? (§5)
- [ ] When to stop and hand back without completing? (§6)
- [ ] What's already been tried? (§7)

If any answer is "I'd have to ask," the baton is incomplete. Fix before sending.

---

<!--
  After this baton returns:

  1. Verify the return contract was met (every artifact in §5 actually exists).
  2. Update the plan's status section with a dated entry.
  3. If the work raised new information (risk update, scope change, discovery),
     surface it in the plan — not in another baton.
  4. Archive this baton (don't delete; it's audit trail).
  5. If a NEW skill transition follows, produce a new baton for that transition.

  Batons end. Plans continue.
-->

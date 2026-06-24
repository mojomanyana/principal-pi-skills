---
name: adr
version: 0.1.0
description: >
  Use when writing or reviewing an Architecture Decision Record — capturing WHY a significant or
  irreversible technical decision was made, so the reasoning survives. Triggers: "write an ADR",
  "document this decision", "record why we chose X", "review this ADR". Pairs with
  `software-architect` (which makes the decision); this skill captures it. NOT for making the
  design choice itself (use `software-architect`) or building it (use `tech-lead` / `coder`).
---

# ADR — Capture the Decision, Not Just the Outcome

"We picked X" is useless in two years. "We picked X over Y and Z because constraint C ruled out Y,
and Z would have cost us quality-attribute Q" is gold. An ADR preserves the **reasoning in
context**, so the next person — usually future-you — can tell whether the decision still holds when
the forces change.

## When an ADR is warranted
Draft one for a decision that is **irreversible** (a one-way door — undoing it needs migration,
downtime, or a rewrite) or **architecturally significant** (changes structure, sets a precedent).
For a **reversible, low-stakes** choice (a sprint or two to undo), an ADR is ceremony — a one-line
note is enough. Right-size: the record's weight should match the decision's weight.

## Drafting — the discipline
1. **Force the trigger.** What changed that makes this decision necessary *now*? "We've always
   wanted to" is not a trigger; "latency budgets broke with the new mobile client" is.
2. **State the context and forces** — the quality attributes and constraints in tension.
3. **Enumerate options, including "do nothing".** At least three, genuinely different (not three
   flavors of one answer). "Do nothing" is a real option to weigh, not a strawman.
4. **Weigh each against the forces** — which force it satisfies, at what cost. Be specific.
5. **State the decision, status, and consequences — positive AND negative.** A consequences
   section with only upsides is a sales pitch, not an ADR.
6. **If the decision changes structure, include a before/after diagram fragment** (C4 container
   level is usually enough — it makes the consequences concrete in a way prose can't).

Use the MADR template → [adr-template.md](assets/adr-template.md). Format variants (Nygard, MADR,
Y-statement) and when to use which → [adr-templates.md](references/adr-templates.md).

## Reviewing an ADR — what to check
- The **trigger is real** (a forcing function, not a preference).
- Options are **genuinely different**, and **"do nothing" is honestly weighed**.
- The **consequences section names losses**, not just wins.
- Any **structural change is reflected in a diagram**.
- The decision is **traceable to a force** — "because constraint C / QA Q", not "because it's better".

## Red flags — STOP
| If the ADR… | Fix |
|---|---|
| Has no real trigger ("we've always wanted to") | Name the forcing function, or it isn't decision-ready — defer it. |
| Lists three options that all "build something" | The most important option is missing: add a real "do nothing" and weigh it. |
| Has a consequences section with only positives | It's a pitch. Name what this choice costs — every choice has a downside. |
| Records only the outcome ("we chose X") | Capture the *why in context* — the forces, the rejected options, the constraint that decided it. |
| Is being written for a reversible, low-stakes choice | That's ceremony. Skip the ADR; a one-line note will do. |

## Handoff — point, don't invoke
- The ADR needs to land in git (file + commit) → **`project-git`**.
- The decision implies a build → **`implementation-planner`** (multi-step) or **`tech-lead`** (single slice).
- The choice itself is still contested or unmade → back to **`software-architect`** (or `brainstorming`).

## References
- [adr-templates.md](references/adr-templates.md) — Nygard / MADR / Y-statement formats, and when to use which.

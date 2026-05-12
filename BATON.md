# Baton Schema

A **baton** is the unit of cross-skill state in this framework. When a skill finishes its work, it emits a baton. When the next skill starts its work, it reads one. This document is the canonical schema.

Batons exist because *"point, don't invoke"* (see AGENTS.md §1) requires a structured handoff format — without one, the routing layer (whether human-in-chat, agent-on-next-turn, or programmatic harness) loses state across every transition.

---

## 1. The common spine

Every baton — regardless of which skill produced it or which receives it — carries the same nine **spine fields**. These are the universal contract; the rest is transition-specific.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier. Format: `baton-YYYY-MM-DD-<slug>` |
| `from` | string | ✓ | Sending skill (`brainstorming`, `software-architect`, etc.) |
| `to` | string | ✓ | Receiving skill, or `user` for unrouted outputs |
| `created` | ISO 8601 datetime | ✓ | When the baton was emitted |
| `revision` | integer | ✓ | Iteration of the baton; starts at 1, increments on revisions |
| `references` | array | ✓ | Upstream artifacts — file paths, links, document IDs |
| `objective` | string (1-3 sentences) | ✓ | What the receiver is being asked to do |
| `kill_criteria` | array | ✓ | When the receiver should stop and hand back rather than push through |
| `return_contract` | object | ✓ | What artifacts the receiver must return, and in what shape |

If any spine field is missing, the baton is invalid. The receiving skill should refuse to act on an incomplete baton and request the missing fields.

---

## 2. YAML frontmatter convention

Batons are markdown documents with a YAML frontmatter header carrying the spine and transition-specific fields. The prose body provides human-readable context, explanations, and any narrative the structured fields can't capture.

```yaml
---
id: baton-2026-05-12-payment-flow-S2
from: implementation-planner
to: tech-lead
created: 2026-05-12T14:30:00Z
revision: 1
references:
  - path: docs/plans/payment-flow.md
    section: "§4 — Slice S2"
  - path: docs/adr/0007-payment-gateway.md
objective: |
  Produce a coding spec for slice S2 (token validation). The spec
  must allow the coder to implement without inventing scope.
kill_criteria:
  - Spec attempts to introduce a new authentication primitive not in the plan
  - Slice scope expands beyond what the plan sized for (S2 is a single-day effort)
return_contract:
  artifacts:
    - filled coding spec (tech-lead/assets/coding-spec.md)
    - handoff baton to coder (tech-lead/assets/handoff-baton.md)
  status: complete | needs-replan | blocked

# Transition-specific fields below:
slice_id: S2
acceptance_criteria:
  - Validation rejects malformed tokens with HTTP 400
  - Validation rejects expired tokens with HTTP 401
  - Valid tokens pass within p99 < 50ms
tried_ruled_out:
  - JWT library X (incompatible with existing session shape — see plan §3)
flagged_assumptions:
  - Test framework convention matches existing src/auth/__tests__/ layout
reversibility: two-way
---

# Handoff Baton: Payment Flow Slice S2

## Context

[Prose body picks up here. Multi-paragraph explanations,
narrative justification, anything the structured YAML can't carry.]
```

The YAML header is **machine-parseable**. The prose body is **human-readable**. Both are part of the baton — neither is optional.

### Why YAML frontmatter

- **Tooling-friendly.** YAML frontmatter is the convention used by `SKILL.md` files in this framework, by Jekyll/Hugo/Pandoc, and by `gh` issue/PR templates. Any markdown parser already understands it.
- **Future-extensible.** A programmatic harness (orchestrator mode 3 — see AGENTS.md §1) can parse YAML directly without scraping prose. The framework targets modes 1 and 2 today, but the baton is ready for mode 3 when it arrives.
- **Doesn't force structure on prose.** The transition-specific YAML carries the load-bearing fields; the prose body can be however the skill needs it.

---

## 3. The transitions

The framework has six primary transition types, plus the inverse-direction return baton from project-git. Each transition has its own required transition-specific fields *in addition to* the spine.

| Transition | Direction | Asset template |
|---|---|---|
| brainstorming → any | forward | `brainstorming/assets/handoff-baton.md` |
| software-architect → any | forward | `software-architect/assets/handoff-baton.md` |
| implementation-planner → tech-lead | forward | `implementation-planner/assets/handoff-baton.md` |
| tech-lead → coder | forward | `tech-lead/assets/handoff-baton.md` |
| coder → project-git | forward | `coder/assets/handoff-baton-to-git.md` |
| project-git → caller | **return** (Facts block) | inline; see `project-git/references/delegation-contract.md` |

### 3a. brainstorming → any

Brainstorming produces a decision brief. The baton hands the brief forward to whatever skill consumes the decision (architect, planner, tech-lead, project-git, or back to the user).

**Required transition fields:**

| Field | Type | Purpose |
|---|---|---|
| `decision` | string | The chosen path, in one sentence |
| `options_considered` | array | Each option with a one-line summary; minimum 3 including "do nothing" |
| `reversibility` | enum: `two-way` / `one-way` | Door classification of the chosen path |
| `premortem_summary` | string | Top 1-3 failure modes considered |
| `open_questions` | array | Deliberate non-decisions, with revisit triggers |

### 3b. software-architect → any

Architect produces a design doc, ADR, or advisory output. The baton hands the design forward — to planner (for build), tech-lead (for single-slice work), or project-git (for ADR commit).

**Required transition fields:**

| Field | Type | Purpose |
|---|---|---|
| `design_doc` | path | Link to the design doc or ADR |
| `qa_scenarios` | array | Quality Attribute Scenarios driving the design |
| `c4_diagrams` | array | Paths to Context / Container / Component / Dynamic / Deployment diagrams |
| `decision_rules` | array | Conditions under which the recommendation would flip |
| `non_goals` | array | Explicit out-of-scope items |
| `reversibility` | enum: `two-way` / `one-way` | Door classification |

### 3c. implementation-planner → tech-lead

Planner emits one baton per slice. Each baton covers one INVEST-passing vertical slice.

**Required transition fields:**

| Field | Type | Purpose |
|---|---|---|
| `slice_id` | string | Slice identifier from the plan (e.g., `S2`) |
| `acceptance_criteria` | array | Concrete done-when conditions |
| `tried_ruled_out` | array | What's been explored upstream so tech-lead doesn't repeat |
| `flagged_assumptions` | array | Things tech-lead must reconfirm before specifying |
| `reversibility` | enum: `two-way` / `one-way` | Door classification |
| `dag_dependencies` | array | Slice IDs that must complete before this one |
| `observability_criteria` | array | For production-bound slices |

### 3d. tech-lead → coder

Tech-lead produces a coding spec. The baton accompanies the spec.

**Required transition fields:**

| Field | Type | Purpose |
|---|---|---|
| `spec_path` | path | Link to the filled coding spec |
| `first_action` | string | Concrete first move for the coder (e.g., *"read src/auth/schemas.ts and confirm helper exists"*) |
| `flagged_assumptions` | array | Things coder must reconfirm before writing code |
| `acceptance_signal` | string | What proves the slice is done |
| `test_plan_ref` | path | Link to test plan section of the spec |
| `reversibility_tags` | object | Per-decision tags: 🟢/🟡/🔴 (see AGENTS.md §5) |

### 3e. coder → project-git

Coder finishes the slice and hands off to project-git for commit/PR shaping.

**Required transition fields:**

| Field | Type | Purpose |
|---|---|---|
| `branch` | string | Branch name |
| `base_commit` | string | Base commit SHA (where the branch was cut) |
| `commits` | array | List of `{sha, message}` for each commit on the branch |
| `acceptance_status` | enum: `all-pass` / `partial` / `failed` | Test/check status |
| `implementation_report` | path | Link to the report |
| `flags_for_git` | array | Special instructions (e.g., *"don't auto-merge — migration needs manual review"*) |

### 3f. project-git → caller (return baton / Facts block)

Project-git is the only skill that emits a **return baton** — in delegated mode, it suppresses prose and returns a `## Facts` block with operation results.

**Required return fields:**

| Field | Type | Purpose |
|---|---|---|
| `operation` | string | What was done (e.g., `commit-and-pr`) |
| `repo` | string | `org/repo` |
| `branch` | string | Working branch |
| `commits` | array | `[{sha, subject}]` |
| `pushed` | boolean | Pushed to remote |
| `pr` | object | `{number, url, state, draft, ci_status}` if PR was opened |
| `issues_referenced` | array | Issue numbers linked |
| `warnings` | array | Non-blocking issues (e.g., dirty working tree) |
| `next_step_hint` | string | Where the orchestrator should route next |

Format details for the Facts block are in `project-git/references/delegation-contract.md`.

---

## 4. Validation

A baton is **valid** if:

1. All nine spine fields are present and well-typed.
2. All transition-specific required fields for the `from → to` pair are present.
3. The `id` follows the format `baton-YYYY-MM-DD-<slug>` with a unique slug.
4. `references` is non-empty (every baton points to at least one upstream artifact).
5. `kill_criteria` is non-empty (a baton without stop conditions is malpractice — see AGENTS.md §6, *"kill criteria, when you can still think clearly"*).

A baton is **complete** if it's valid AND the prose body provides enough context for the receiver to act without further clarification.

A baton is **acted on** if the receiving skill has confirmed the flagged assumptions and started the first_action (or its transition-equivalent).

The framework does not currently ship a formal validator. Validation is performed by the receiving skill at read-time: *"do I have what I need to start? if not, what's missing?"* See AGENTS.md §7 for the refusal protocol when a baton is incomplete.

---

## 5. Revisions

When a baton needs to change mid-flight (e.g., a flagged assumption turned out to be wrong, the slice scope shifted), the sender produces a **revised baton** with:

- The same `id` as the original
- `revision` incremented by 1
- A new `created` timestamp
- A new `references` entry pointing to the prior revision (e.g., `path: baton-2026-05-12-payment-flow-S2.r1.md`)
- A `revision_notes` field in the prose body explaining what changed and why

Revisions preserve history. Don't silently overwrite an in-flight baton — both the receiver and future-you need to see how the work evolved.

---

## 6. Storage

This framework doesn't mandate where batons live on disk. Conventional locations:

- `docs/batons/` at the repo root
- `.batons/` (gitignored, for local-only orchestration)
- Inline in chat (for orchestrator modes 1 and 2 — the YAML/prose block is the baton)

For modes 1 and 2, batons typically live in the chat session itself and don't need to be persisted to disk — the human or agent reads the baton on the next turn. For mode 3 (programmatic harness), persisting batons to a known directory enables resumability across sessions and parallel work.

---

## 7. Why this design

This framework targets orchestrator modes 1 and 2 today (see AGENTS.md §1). Batons are written and consumed by humans and agents reading chat output. The YAML frontmatter is **forward-compatible** with mode 3 (programmatic harness) without requiring it — when a harness exists, it can parse the YAML; until then, humans and agents read the prose body.

The schema is deliberately **per-transition** rather than universal. A coder→git baton legitimately needs different fields (branch state, commit SHAs, acceptance checks) than a planner→tech-lead baton (slice ID, acceptance criteria, tried/ruled-out). Forcing one shape would erase signal. The common spine keeps the family coherent; the transition-specific extensions keep each baton useful for its receiver.

No JSON Schema validator is shipped. The framework's contract is the prose schema in this document plus the per-skill templates. If you build a harness on top, validating against this document is straightforward — but adding a validator before there's a consumer would be premature complexity (see software-architect Mode I).

---

## 8. Quick reference — minimal valid baton

If you're producing a baton by hand and want the smallest valid form:

```yaml
---
id: baton-2026-05-12-example
from: <sending-skill>
to: <receiving-skill>
created: 2026-05-12T15:00:00Z
revision: 1
references:
  - path: <upstream-artifact-path>
objective: |
  <one to three sentences>
kill_criteria:
  - <condition under which receiver stops>
return_contract:
  artifacts:
    - <what receiver returns>
  status: complete | needs-replan | blocked

# Add transition-specific fields per §3
---

# <Title>

<Prose body — context, narrative, anything YAML can't carry.>
```

Anything less than this isn't a baton; it's a status update.
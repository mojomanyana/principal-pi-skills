# Decomposition — Walking Skeleton, Vertical Slices, INVEST

The hardest part of planning is **slicing**. Most plans fail not because they pick the wrong work but because they pick the wrong *grain* of work. This reference is the playbook for slicing well.

## Table of contents

1. [The grain test: INVEST](#1-the-grain-test-invest)
2. [Walking skeleton vs vertical slices vs horizontal layers](#2-walking-skeleton-vs-vertical-slices-vs-horizontal-layers)
3. [How to design the walking skeleton](#3-how-to-design-the-walking-skeleton)
4. [Vertical-slice splitting patterns](#4-vertical-slice-splitting-patterns)
5. [Sizing slices: t-shirts, hours, and the cone of uncertainty](#5-sizing-slices-t-shirts-hours-and-the-cone-of-uncertainty)
6. [Spikes as slices](#6-spikes-as-slices)
7. [When a slice can't be made INVEST-shaped](#7-when-a-slice-cant-be-made-invest-shaped)

---

## 1. The grain test: INVEST

**INVEST** (Bill Wake, 2003) is the standard test. Every slice in the plan must pass:

- **Independent** — schedulable without waiting on any *other slice in the same wave*. Slices in later waves can depend on slices in earlier waves (the DAG handles that); slices in the same wave should be runnable in parallel.
- **Negotiable** — the *what* is firm, the *how* is open. If the slice prescribes exact code, it's too detailed — that's the implementer's job.
- **Valuable** — a stakeholder can observe the result. Stakeholders include: the next slice ("S5 needs the token store from S2"), the user, ops, security, a test suite.
- **Estimable** — the planner has a defensible sense of effort. If the answer is "I don't know, could be a day or a week," it's a **spike**, not a slice.
- **Small** — ideally a day or two of focused work for the executing skill. If larger, decompose.
- **Testable** — has acceptance criteria written down before work begins.

If a slice fails any of these, don't ship the plan. Fix the slice first.

### Why "Small" matters more than people think

Small slices give you:

- **Calibrated estimates.** Humans are good at sizing day-scale work and bad at sizing month-scale work. Small slices stay in the calibrated zone.
- **Real parallelism.** Two large slices block each other through shared files, shared state, shared review attention. Two small slices fit through narrow seams.
- **Cheap pivots.** When a small slice goes wrong, you've burned a day. When a large one goes wrong, you've burned a week and you sunk-cost into "fixing" it.
- **Honest status.** "Slice S3 is 60% done" is meaningless. "Slice S3 (2 days) is done, S4 (1 day) is in flight, S5 has not started" is meaningful.

When in doubt, slice smaller.

---

## 2. Walking skeleton vs vertical slices vs horizontal layers

Three ways to decompose work. Two are right; one is wrong.

### Walking skeleton

The **thinnest end-to-end slice** that exercises every architectural seam. Stub logic at every node; real wiring at every edge. Ships through the real pipeline to the real environment.

**Purpose:** prove the seams work *before* you commit to depth.

**Example (password reset):**

> S0: Deploy a `POST /auth/password-reset/init` endpoint that accepts an email, logs the request, returns 202. No token issued, no email sent, no database write. Logs visible in production observability stack. Smoke test against staging environment via deploy pipeline.

That's the walking skeleton: nothing useful happens, but every seam is exercised — request shape, auth boundary, logging, deploy, observability. Now subsequent slices can each focus on one seam's depth without simultaneously testing the wiring.

### Vertical slices

Each slice **delivers value across whatever layers it touches**: data, logic, interface, observability. A vertical slice for password reset might be "user can request a reset token and the token is stored hashed in the database" — that touches the API, the service layer, the DB schema, and the test suite, but it produces a complete, observable behavior.

**Purpose:** ship value frequently; integrate continuously; surface integration bugs early.

### Horizontal layers — forbidden

The anti-pattern. "Build all the models, then all the services, then all the controllers, then the UI, then the tests." This **defers all integration risk to the end of the plan**, which is when you have the least slack to absorb surprises.

A plan that decomposes by layer (data, then logic, then UI) is malpractice for any non-trivial work. Surface it and refuse it. If the user insists, ask what they're optimizing for — usually they're confusing "I know how to think about layers" with "this is the right way to plan work."

There are narrow exceptions (e.g., a pure data-migration plan really is a horizontal task, because there is no other layer), but they are rare and obvious. Default to vertical.

---

## 3. How to design the walking skeleton

The walking skeleton is its own design exercise. Here's the procedure:

1. **List every architectural seam the plan will touch.** Not every seam in the system — every seam *this plan* exercises. Auth boundary? External vendor call? New database table? Background worker? Feature flag? Each one is a seam.

2. **Identify the thinnest path that touches all of them at least once.** Stubs and no-ops are fine for any node along the path. Stubs and no-ops are *not* fine for the edges between nodes — those have to be real, because the edges are what the skeleton is proving.

3. **Decide what counts as "exercised."** For a deploy pipeline: it ran green. For an observability stack: a log line appeared on the dashboard. For an external integration: a real HTTP call to the real API (or a sanctioned stub like a sandbox account). Don't accept "we'd add that later" for seams that the rest of the plan depends on.

4. **Make the skeleton its own slice.** Acceptance criteria, kill criteria, the works. It's not a freebie.

5. **Time-box it.** A walking skeleton that takes more than ~10% of total plan effort is too ambitious. If it's that hard to wire end-to-end, the seams are already in trouble and the rest of the plan is going to inherit that.

### When to skip the walking skeleton

Rarely. Acceptable cases:

- The plan modifies one already-shipped slice (a bug fix on a working feature)
- The pipeline-and-seams were exercised within the past week or two by a related plan, and nothing in those seams has changed
- The plan is fully internal (pure refactor, no behavior change, no deployment to a new environment)

If you skip the skeleton, **say so in the plan and cite what's substituting** (e.g., "Skeleton omitted; PR #4221 from 2026-05-08 exercised the same seams"). Never silently omit.

---

## 4. Vertical-slice splitting patterns

When a slice is too big or has fuzzy boundaries, these patterns split it into smaller, INVEST-passing slices. Adapted from Richard Lawrence's story-splitting catalogue, with engineering specifics added.

### 4.1 Split by workflow step

If the work is a multi-step user (or system) flow, slice along the steps.

- **Before:** "Implement checkout"
- **After:** S1: Cart-to-shipping handoff. S2: Shipping-to-payment handoff. S3: Payment-to-confirmation handoff.

Each step delivers an observable transition.

### 4.2 Split by business rule variation

If the work has multiple rule branches, slice along the simplest rule first; add others later.

- **Before:** "Implement discount engine"
- **After:** S1: Flat-percent discount only. S2: Add bulk-tier discount. S3: Add coupon code discount.

The first slice ships the engine end-to-end with the simplest rule; subsequent slices add complexity without re-litigating the architecture.

### 4.3 Split by happy path vs unhappy paths

Ship the happy path first; add error handling and edge cases as their own slices.

- **Before:** "Implement reset flow with full error handling"
- **After:** S1: Happy path (valid email, valid token, valid new password). S2: Invalid token paths (expired, replayed, malformed). S3: Rate-limit and abuse paths.

Crucial: the happy-path slice **must include error handling that's load-bearing for security** (no silent fallback that bypasses auth). What gets deferred is *user-facing handling of edge cases*, not "no validation at all."

### 4.4 Split by data variation

If the work handles multiple data shapes, slice along the simplest first.

- **Before:** "Support migrating all account types"
- **After:** S1: Migrate single-user accounts only. S2: Migrate accounts with 1 dependent. S3: Migrate accounts with org affiliations.

### 4.5 Split by interface

If the work has multiple interfaces, slice along the most valuable first.

- **Before:** "Add password reset to web, mobile, and CLI"
- **After:** S1: Web (highest traffic). S2: Mobile (after S1 proves the contract). S3: CLI.

### 4.6 Split by acceptance criterion

If a slice's acceptance criteria list is long, each criterion may be its own slice.

- **Before:** "Reset endpoint hardens against replay, rate-limit, brute-force, and timing attacks"
- **After:** S1: Replay protection. S2: Rate limit. S3: Brute-force lockout. S4: Constant-time comparison.

Each is independently shippable and independently testable.

### 4.7 Split by operations vs feature

If the work blends feature implementation with operational concerns (migrations, indexes, monitoring), separate them.

- **Before:** "Build new feature with migrations and monitoring"
- **After:** S1: Migration (schema change, ship empty). S2: Feature implementation against the migrated schema. S3: Monitoring and alerts.

This pattern is *especially* valuable when the migration is a *one-way door* — separating it lets you review and time-gate it independently.

### 4.8 Split spike from implementation

If a slice mixes "figure out how to do X" with "do X," split:

- **Before:** "Add CockroachDB support to the data layer"
- **After:** S1 (spike): Evaluate CockroachDB compatibility for our top-5 query patterns; write a 1-pager. S2 (impl): Add CRDB support per spike findings.

The spike has a written deliverable (1-pager, decision memo, benchmark report) but no production code. See [§6](#6-spikes-as-slices).

### 4.9 Split simple-first, fancy-later

If the work has both a simple and a fancy version, ship simple first.

- **Before:** "Add full-text search with typo tolerance, faceting, and ranking"
- **After:** S1: LIKE-based substring search. S2: Add Postgres FTS. S3: Add typo tolerance. S4: Add faceting and ranking.

You may discover after S2 that the simpler version is sufficient. That's not failure — that's the plan doing its job.

### 4.10 Split user-facing from system-facing

When work has both a user-visible deliverable and a behind-the-scenes implementation, ship the user-visible one when possible.

- **Before:** "Rebuild auth on top of new identity service"
- **After:** S1: Stand up new identity service, no integration. S2: Dual-write old + new (no user-visible change). S3: Cut traffic to new service. S4: Decommission old.

This is the strangler pattern. The plan looks longer but the risk profile is much better than a big-bang cutover.

---

## 5. Sizing slices: t-shirts, hours, and the cone of uncertainty

Don't let estimation get fancy. Two scales handle 95% of cases:

### T-shirt sizing (default)

- **XS** — half a day or less
- **S** — about a day
- **M** — about 2-3 days
- **L** — about a week
- **XL** — more than a week (forbidden; decompose)

Use t-shirts when the plan is at the slice-discovery stage; precision is fake at that point. The cone of uncertainty (Boehm) at this stage is ±4x — so XS-vs-S precision is meaningless; S-vs-M is the discrimination you can defend.

### Hour bands (only for short, well-understood slices)

If you've seen this exact slice before — same shape, same team, same stack — hour bands ("4-8h", "8-16h") are fine. Otherwise t-shirt.

### Reference-class estimation

The single most reliable estimation technique: **find 3 prior slices that look like this one, observe how long they actually took, anchor on the median.** Don't ask "how long should this take?" Ask "how long did the last three like it take?"

Cite the reference class in the plan when you use it: "S4 sized M based on prior slices PR-3142, PR-3290, PR-3401 (median: 2.5 days)."

### What XL means

XL doesn't mean "this slice is large." It means **"this slice is unsizeable."** Unsizeable slices are either:

- Spikes (split per §4.8)
- Composite slices that should be decomposed via one of §4.1-§4.10
- Genuinely unknown work that needs design first — hand back to `software-architect` with a baton

Never ship XL in a plan. It's not a size; it's an admission.

---

## 6. Spikes as slices

A **spike** is a time-boxed investigation with a written deliverable and no production code. It belongs in the plan as a first-class slice with its own ID, acceptance criteria, and kill criteria.

### A spike must have:

- **A question being answered.** Single, sharp. "Can CockroachDB handle our top-5 query patterns at 3-region geo-distribution with p99 < 200ms?" Not "evaluate CockroachDB."
- **A time box.** "2 days max." If the spike isn't conclusive by then, the result is "inconclusive; re-scope" — which is itself a useful result.
- **A written deliverable.** A 1-pager, a benchmark file, a decision memo. Lives in the repo or docs alongside the plan.
- **Acceptance criteria for the spike itself.** "1-pager committed at /docs/spikes/<slug>.md including: query patterns tested, latency measurements, recommendation."
- **Kill criteria.** "If by hour 4 we haven't successfully connected to a CRDB cluster, stop and reassess; the problem is the connection, not the query patterns."
- **A handoff target.** "On completion, hand back to implementation-planner to revise S4-S7 based on findings." Spikes feed the plan.

### Spikes do NOT produce production code

This is non-negotiable. The moment a spike starts producing production code, it's no longer a spike — it's an implementation slice masquerading as exploration, and the absence of acceptance criteria around the code becomes a real risk.

If during a spike the implementer wants to "just keep what they built," the answer is: **discard the spike code, replan with the spike findings, write a real implementation slice with real acceptance criteria.** This feels wasteful and isn't. The spike's value was the *learning*, not the lines.

### When you need a spike

- An unknown that blocks sizing of subsequent slices
- A risk in the register tagged "needs spike"
- A vendor or library you haven't used before in a load-bearing role
- A performance, scaling, or correctness assumption that isn't validated
- An external integration whose actual behavior differs from its docs (more common than people think)

A plan with no spikes when there are real unknowns is dishonest. Add them.

---

## 7. When a slice can't be made INVEST-shaped

Some real work resists INVEST. Common cases and how to handle them:

### Big-bang dependencies (the slice unavoidably ships everything at once)

Rare but real. Some changes — say, a wire-format protocol change — can't be split temporally; the receiver and sender have to ship together.

**Move:** ship the protocol change as a **single coordinated slice**, but invest in the *operational* containment:

- Feature flag for ramped rollout
- Dual-version support if achievable (sender speaks new, receiver accepts both, then sender stops speaking old)
- Aggressive monitoring slice immediately following
- Explicit one-way-door treatment with reviewer

INVEST's "Independent" gets a footnote here, not a pass.

### Research-heavy work

If the slice is "figure out how to do X correctly," it's a spike. See §6.

### Pure-data work without observable intermediate results

Schema migration with no behavior change; data backfill with no user-facing surface. Acceptance criteria become technical ("table populated; counts match; no integrity violations"); kill criteria become operational ("if backfill rate < X rows/sec, halt and reassess").

This is still INVEST-passing — value is observable to ops/data even if not to end users.

### Cross-team coordination

Some slices need another team's slice to land first. **That's a dependency, not an INVEST failure.** Record the cross-team dependency in the DAG; if the other team's slice has no plan, surface that as a risk (and probably escalate it).

### "But this slice is genuinely two days of plumbing"

Sometimes plumbing is plumbing. If you've decomposed honestly and the slice is still a couple days of necessary wiring, ship it as a single slice with crisp acceptance and accept the size. The mistake to avoid is *forcing* a split that produces two slices neither of which is independently valuable.

The discipline: **decompose until smaller is artificial, then stop.** INVEST is a target, not a religion.
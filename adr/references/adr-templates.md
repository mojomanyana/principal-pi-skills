# ADR Templates — Reference

An Architecture Decision Record (ADR) captures one architecturally-significant decision: its context, the options considered, the choice made, and the consequences. ADRs exist because the *reasoning* behind a decision is more valuable than the decision itself, and reasoning evaporates if no one writes it down.

## What deserves an ADR

Not everything. Use the **architecturally significant** test: would a future engineer have a non-trivial chance of choosing the *wrong* thing without this record? If yes, write the ADR. Typical triggers:

- The decision is **irreversible** (one-way door) — migrations, public API shapes, data formats, vendor commitments.
- The decision **constrains other decisions** — a framework choice that shapes module structure, an auth model that shapes session handling, a consistency model that shapes the data layer.
- The decision is **non-obvious** — the chosen option is not the one a reasonable engineer would default to, and the reasoning needs to survive.
- The decision was **contested** — a real disagreement happened. Write down the resolution.

Skip ADRs for purely local code-level choices, library upgrades within a major version, and things any senior engineer would do the same way on autopilot.

## Three formats — when to use which

| Format | Length | Best for |
|---|---|---|
| **Nygard** (original) | Short (~1 page) | Quick captures, internal team decisions, low ceremony |
| **MADR** (Markdown ADR) | Medium (~2 pages) | The default — explicit options, decision drivers, consequences |
| **Y-statement** | One sentence | Highlight cards, decision logs, ADR indexes |

If in doubt, **default to MADR**. It forces the options-and-drivers structure that makes ADRs actually useful when revisited.

## Nygard format

The original, by Michael Nygard (2011). Four sections, minimal ceremony.

```markdown
# ADR-NNN: <Short title in active voice>

## Status
<Proposed | Accepted | Deprecated | Superseded by ADR-NNN>

## Context
<The forces at play: business need, technical constraints, the situation that
required a decision. Describe the problem in enough detail that a reader two
years from now understands why this came up.>

## Decision
<What we decided. Active voice, declarative. "We will use X." Not "we should
consider X.">

## Consequences
<What becomes easier, what becomes harder, what new risks appear, what gets
locked in. Include both positive and negative consequences. A consequences
section with only positives is a sales pitch, not an ADR.>
```

### Worked example (Nygard)

```markdown
# ADR-007: Adopt PostgreSQL as the primary transactional store

## Status
Accepted — 2026-04-12

## Context
The order platform currently uses a mix of two MySQL instances (legacy) and
DynamoDB (newer services). Operating two stores has produced inconsistent
backup/restore practices, two sets of on-call runbooks, and friction whenever
a feature crosses both. We need to consolidate to a single transactional store
before adding the multi-region work scheduled for Q3.

The workload is transactional with strong-consistency requirements for order
status, modest data volume (~200 GB), moderate write rate (~1k TPS at peak),
and complex queries for the customer-service UI (joins across orders, line
items, status history).

## Decision
We will adopt PostgreSQL 16 as the single primary transactional store for the
order platform. DynamoDB usage will be migrated over the next two quarters via
strangler fig; legacy MySQL will be deprecated after migration completes.

## Consequences
- Single operational model, runbook, and on-call expertise required.
- SQL-native queries simplify the customer-service UI.
- Strong consistency aligns with order semantics.
- Multi-region work in Q3 must use logical replication or a managed Postgres
  multi-region offering — we lose DynamoDB's global tables ergonomics.
- Migration cost: ~12 engineer-weeks for the DynamoDB → Postgres move, plus
  team training on Postgres operations for the engineers currently most fluent
  in DynamoDB.
- Locks us into the SQL data model; future high-write-rate features (e.g.
  the planned event log) will need a separate store and shouldn't be forced
  into Postgres.
```

## MADR format (the default)

Markdown Architecture Decision Records — a more structured format that forces explicit options and decision drivers. Use this when there is real options analysis to record (which is most non-trivial decisions).

```markdown
# ADR-NNN: <Short title in active voice>

- Status: <Proposed | Accepted | Rejected | Deprecated | Superseded by ADR-NNN>
- Date: <YYYY-MM-DD>
- Deciders: <Names or roles of the people who made the decision>
- Consulted: <Names or roles consulted but not deciding>
- Informed: <Names or roles informed after the fact>

## Context and Problem Statement
<2–4 sentences describing the situation and the question being decided.
End with the question as a question.>

## Decision Drivers
<The forces — quality attributes, constraints, deadlines, costs — that the
decision must answer to. Bullet list, each one specific enough to be falsifiable.>

- <Driver 1, e.g. "p99 read latency must stay under 100 ms at 2× current load">
- <Driver 2, e.g. "Team has no operational experience with Cassandra">
- <Driver 3, e.g. "Compliance: data must remain in EU">

## Considered Options
<At least three. ALWAYS include "do nothing" or the conservative baseline.>

1. <Option A>
2. <Option B>
3. <Option C — e.g. "Do nothing / status quo">

## Decision Outcome
Chosen option: <Option N — short name>, because <one-sentence reason tied to
decision drivers>.

### Positive Consequences
- <Good outcome 1>
- <Good outcome 2>

### Negative Consequences
- <Bad outcome 1, including what we're now locked into>
- <Bad outcome 2>

## Pros and Cons of the Options

### Option A — <name>
- <One-sentence summary>
- ✓ <Pro 1, tied to a driver>
- ✓ <Pro 2>
- ✗ <Con 1, tied to a driver>
- ✗ <Con 2>

### Option B — <name>
<same structure>

### Option C — <name>
<same structure>

## Links
- <Link to related ADRs, design docs, RFCs, or external references>
- <If the decision changes structure, link to or embed the before/after C4 fragment>
```

### Worked example (MADR)

```markdown
# ADR-014: Synchronous HTTP vs event-driven for inter-service order events

- Status: Accepted
- Date: 2026-05-09
- Deciders: Architecture group, order-platform tech lead, billing tech lead
- Consulted: SRE, security
- Informed: All engineering

## Context and Problem Statement
The order platform currently calls billing synchronously over HTTPS when an
order is authorised. Billing has had three multi-hour outages in the last six
months; each one caused order placement to fail because the call is on the
critical path. We need to decouple order placement from billing availability.

How should the order platform communicate order lifecycle events to billing
(and to other downstream consumers we expect to add)?

## Decision Drivers
- Order placement must succeed even when billing is fully unavailable for up
  to 4 hours (the longest observed billing outage in the last 24 months).
- Order events must be processed by billing within 5 minutes p95 once billing
  is healthy.
- No data loss: every authorised order produces exactly one billing event
  (effectively-once semantics).
- Team operational maturity: the order-platform team has run RabbitMQ for two
  years; no team has operational experience with Kafka.
- Cost: prefer managed services to reduce on-call burden.

## Considered Options
1. Keep synchronous HTTPS, with circuit breaker and retry queue inside the
   order API ("do better at sync").
2. Introduce a managed message broker (SQS / managed RabbitMQ); order API
   publishes events, billing consumes asynchronously.
3. Introduce a Kafka cluster; order API publishes events, billing consumes
   asynchronously; future downstream consumers attach as new consumer groups.

## Decision Outcome
Chosen option: **Option 2 — managed message broker (SQS as the initial
backing)**, because it decouples order placement from billing availability
(driver 1), provides effectively-once delivery via dedupe + idempotent
consumers (driver 3), uses tech the team can operate (driver 4), and avoids
the operational complexity of self-hosted Kafka.

### Positive Consequences
- Order placement no longer fails when billing is down — billing simply lags.
- Adding a third consumer (e.g. analytics) is now a config change, not a code
  change in the order API.
- Lower operational complexity than Kafka for our scale (~1k events/sec).

### Negative Consequences
- Idempotency is now a billing concern; we have to enforce it in the consumer.
- Eventual consistency: customer-service UI must now show "billing pending"
  for the few seconds before billing catches up.
- If we ever need true log-replay or high-fanout streaming, we'll have to
  revisit (Kafka or similar).

## Pros and Cons of the Options

### Option 1 — Keep synchronous, do better
- Status quo plus retries; least change.
- ✓ No new infrastructure.
- ✓ Easy mental model for new joiners.
- ✗ Does not satisfy driver 1 — billing outage still propagates to order
  placement once the retry queue fills.
- ✗ Tight coupling persists; future consumers compound the problem.

### Option 2 — Managed message broker
- ✓ Decouples availability (driver 1).
- ✓ Team can operate it (driver 4).
- ✓ Cheap at our scale; managed service is sub-$1k/month.
- ✗ Eventual consistency introduces UX wrinkles.
- ✗ Idempotency burden on consumers.

### Option 3 — Kafka
- ✓ Best ceiling for fanout and replay (driver-not-yet-on-the-table).
- ✓ Effectively-once via transactional producers.
- ✗ No team has operational experience (driver 4) — running Kafka well is a
  meaningful learning curve.
- ✗ Higher cost and complexity at our scale; we'd be using ~5% of the
  capability.

## Links
- ADR-007 (Adopt PostgreSQL as primary store) — the order events are sourced
  from Postgres outbox table.
- Design doc: order-events-decoupling.md (includes before/after Container
  diagrams).
```

## Y-statement format

A one-sentence ADR. Use it in index pages, decision logs, slide decks — places where the full ADR would be too much. The full ADR still exists; the Y-statement is its highlight card.

> **In the context of** *<use case / system / decision area>*,
> **facing** *<concern / quality attribute>*,
> **we decided** *<chosen option>*
> **and neglected** *<runner-up options>*,
> **to achieve** *<benefits>*,
> **accepting** *<downsides>*.

### Examples

- **In the context of** inter-service order events, **facing** the need to decouple order placement from billing availability, **we decided for** a managed message broker (SQS), **and neglected** synchronous HTTPS with retries and Kafka, **to achieve** zero-coupling on the order-placement critical path, **accepting** eventual consistency and consumer-side idempotency burden.
- **In the context of** the transactional data layer, **facing** operational fragmentation across MySQL and DynamoDB, **we decided for** PostgreSQL 16 as the single primary store, **and neglected** consolidating on DynamoDB, **to achieve** a single ops model and SQL-native queries, **accepting** the ~12-engineer-week migration cost.

## Operational practice

A few conventions that make ADRs work in real teams:

- **Number sequentially, never renumber.** ADR-007 is ADR-007 forever, even if superseded. Use a `superseded by ADR-NNN` status to point forward, and `supersedes ADR-NNN` in the new one to point back.
- **Store with the code.** A `docs/adr/` directory in the repo, plain Markdown, one file per ADR (`adr-007-postgresql-primary-store.md`). Travels with the system; can be required to update on structural PRs.
- **An index file is worth maintaining.** `docs/adr/README.md` with a table of all ADRs and their status (Y-statements work well as the index summary).
- **PR review is the review.** No separate ADR ceremony — the ADR PR is reviewed alongside the structural change it covers. If structural change ships without an ADR, the reviewer asks for one.
- **Status transitions are real edits.** Moving from `Proposed` to `Accepted` is a commit. Moving to `Superseded` adds a link and a commit; the old ADR is never deleted.
- **Embed the diagram.** If the decision changes structure, the ADR includes the C4 fragment (before/after). Without the diagram, the consequences are abstract.

## When the ADR you're writing isn't really an ADR

Common patterns that should be a different artifact:

- "ADR: How our auth works." → Not an ADR, a **design doc**. Move it.
- "ADR: We will use React." → Maybe, if there were real alternatives weighed. Otherwise it's just a tech-stack note.
- "ADR: Coding standards." → Not an ADR, a **style guide / contributing guide**. Move it.
- "ADR: To-do list for the migration." → Not an ADR, a **migration plan**. The ADR captures the *decision to migrate*; the plan is separate.

ADRs are about decisions, not state, not standards, not plans.

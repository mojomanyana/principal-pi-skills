# ADR-NNN: <Short title in active voice, e.g. "Adopt PostgreSQL as primary transactional store">

- **Status:** Proposed | Accepted | Rejected | Deprecated | Superseded by ADR-NNN
- **Date:** YYYY-MM-DD
- **Deciders:** <Names or roles of the people who made the decision>
- **Consulted:** <Names or roles consulted but not deciding>
- **Informed:** <Names or roles informed after the fact>

## Context and Problem Statement

<2–4 sentences describing the situation that forced this decision and the question being answered. End with the question stated as a question.

What changed that made this decision necessary *now*? "We've always wanted to" is not a trigger. "Latency budgets broke with the new mobile client" is. Be specific about the trigger.>

## Decision Drivers

<The forces — quality attributes, constraints, deadlines, costs — that the decision must answer to. Each driver must be specific enough to be falsifiable. Reference QAS IDs from the design doc where they exist.>

- <Driver 1, e.g. "p99 read latency must stay under 100 ms at 2× current load (QAS-3)">
- <Driver 2, e.g. "Team has no operational experience with Cassandra">
- <Driver 3, e.g. "Compliance: data must remain in EU (GDPR Art. 44+)">
- <Driver 4, e.g. "Migration cost: ≤ one quarter of one team's capacity">

## Considered Options

<At least three options. ALWAYS include "do nothing" / the conservative baseline / the status quo. If you have only two real options, list "do nothing" as the third.>

1. **<Option A — short name>** — <one-sentence summary>
2. **<Option B — short name>** — <one-sentence summary>
3. **<Option C — "Do nothing" or conservative baseline>** — <one-sentence summary>

## Decision Outcome

**Chosen option:** Option <N> — <name>.

**Rationale:** <One paragraph, tied directly to the decision drivers. Which drivers does this satisfy, and at what cost?>

**Reversibility:** <Two-way door | One-way door>. <One sentence on what reversal would cost.>

**Decision rule:** <The condition under which this recommendation would flip. "Revisit if [specific event/threshold]." Without this, the recommendation has no shelf life.>

### Positive Consequences

- <Good outcome 1, tied to a driver>
- <Good outcome 2, tied to a driver>

### Negative Consequences

<A consequences section with only positives is a sales pitch, not an ADR. List the real costs.>

- <Bad outcome 1, including what you're now locked into>
- <Bad outcome 2>
- <New risks introduced by this change>

## Pros and Cons of the Options

### Option A — <name>

<One-sentence summary.>

- ✓ <Pro 1, tied to a driver>
- ✓ <Pro 2>
- ✗ <Con 1, tied to a driver>
- ✗ <Con 2>

### Option B — <name>

<One-sentence summary.>

- ✓ <Pro 1>
- ✓ <Pro 2>
- ✗ <Con 1>
- ✗ <Con 2>

### Option C — <name (e.g. "Do nothing")>

<One-sentence summary.>

- ✓ <Pro 1, e.g. "Zero migration cost">
- ✓ <Pro 2, e.g. "Team already knows it">
- ✗ <Con 1, tied to the driver this option fails>
- ✗ <Con 2>

## Diagram (if this decision changes structure)

<Embed a C4 fragment (Container-level usually suffices) showing before and after. The diagram makes consequences concrete in a way prose cannot. If the decision is purely organisational or policy, this section can be omitted.>

```mermaid
C4Container
    title <Title — Before>
    %% ... before state ...
```

```mermaid
C4Container
    title <Title — After (this ADR)>
    %% ... after state ...
```

## Fitness Function (for one-way-door decisions)

<For irreversible decisions, define the automatable check that will tell you the decision is wrong once it's running. Without this, the decision will silently drift away from its rationale.>

- **What to measure:** <e.g. "p95 latency on /orders POST">
- **How:** <e.g. "k6 load test in nightly CI, ramp to 5k RPS, assert p95 ≤ 500 ms">
- **Threshold for revisit:** <e.g. "p95 > 500 ms for three consecutive nightly runs">
- **Owner:** <team or role responsible for responding when the check fails>

## Links

- <Related ADRs (especially the ones this one supersedes or extends)>
- <Design docs / RFCs that informed this decision>
- <External references — vendor docs, benchmarks, postmortems>
- <The PR or commit that implements this decision, once landed>

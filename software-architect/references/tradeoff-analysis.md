# Tradeoff Analysis — Reference

Every architectural decision involves giving something up. A skill that pretends otherwise produces happy-talk recommendations that fall apart in production. This reference describes the lightweight framework to use for any non-trivial decision: a stripped-down version of ATAM (the SEI's Architecture Tradeoff Analysis Method), augmented with fitness functions, a reversibility test, and a decision-matrix template.

The output of a tradeoff analysis is the **honest tradeoff statement**: a clear recording of what each option costs in each quality attribute, what the chosen option locks you into, and what would change the answer.

## ATAM-lite — four concepts, one process

The full ATAM is a multi-day workshop with named roles, evaluation phases, and formal reporting. Most teams will never run one, and they shouldn't need to. The four ideas that pay off even when used informally are:

**1. Sensitivity Point.** A decision (a property of one element, or one architectural choice) that has a strong effect on a single quality attribute. Example: *"The decision to use a single Postgres primary is sensitive to availability — failover is the dominant determinant of RTO."*

**2. Tradeoff Point.** A decision that is a sensitivity point for *two or more* quality attributes that pull in different directions. Example: *"The decision to use a synchronous cross-AZ replicated DB is a tradeoff point: it improves availability/durability but degrades write latency."* Tradeoff points are the most important things to identify, because they are where you can't get everything.

**3. Risk.** A decision that, if wrong, will likely cause a quality attribute to fail to meet its scenario. Example: *"Using DynamoDB for the order store with complex multi-table queries is a risk: query latency for the CS UI may not meet QAS-3 at scale."* Risks should be listed and mitigated or explicitly accepted.

**4. Non-Risk.** A decision that is *correct* for the scenarios — worth recording because, in a future review, it stops people from re-litigating settled choices. Example: *"Choosing HTTPS for inter-service calls is a non-risk: all QASes are satisfied; no reason to revisit."*

The minimum useful tradeoff analysis names these four for the decision under consideration. A short bulleted list of sensitivity points, tradeoff points, risks, and non-risks is enough — you do not need ceremony, you need clarity.

## The process

For any non-trivial decision, work through these steps:

1. **State the decision and the scope.** What choice is being made, for which artifact (which Container or Component), against which scenarios. Without scope, the analysis is meaningless.
2. **List the relevant QASes.** Only the ones this decision affects. Use the IDs from the design doc / requirements.
3. **Enumerate options.** At least three. Always include the conservative baseline / "do nothing".
4. **Build the decision matrix.** Options on one axis, QASes on the other. Score each cell. (See template below.)
5. **Mark the sensitivity and tradeoff points.** Which decisions are heavy hitters for which QAs? Where do you sacrifice one for another?
6. **List risks and non-risks.** For each option.
7. **Apply the reversibility test.** One-way door or two-way door? (Defined below.)
8. **Recommend, with the decision rule.** Pick one. State the conditions under which the recommendation would change.
9. **Define a fitness function for the chosen option.** What automated or operational check will tell you the decision is wrong once it's running? (Defined below.)

The output is short. Most decisions can be analysed in a page or two — but only because the QAS work, the C4 diagrams, and the constraints are already done. The tradeoff analysis is the synthesis step.

## Decision matrix template

Options across the top, QASes (and constraints) down the side. Cells can be **✓ / ~ / ✗** or **+2 / +1 / 0 / -1 / -2**; consistency within a single matrix matters more than which scheme you pick.

| | Option A: Sync HTTPS + retries | Option B: Managed broker (SQS) | Option C: Kafka |
|---|---|---|---|
| **QAS-1** Order placement decoupled from billing availability (4h tolerance) | ✗ Retries fill, then fail | ✓ Fully decoupled | ✓ Fully decoupled |
| **QAS-2** Order events processed within 5 min p95 | ✓ Same call | ✓ Sub-second when healthy | ✓ Sub-second when healthy |
| **QAS-3** No event loss, effectively-once | ~ At-least-once via retries; duplicates possible | ✓ At-least-once + idempotent consumer | ✓ Effectively-once via transactional producer |
| **QAS-4** Operational maturity for the team | ✓ Already running it | ✓ Team operates RabbitMQ/SQS | ✗ No team has Kafka experience |
| **QAS-5** Cost (managed-service preference) | ✓ Zero new infra | ✓ Sub-$1k/month | ~ Higher infra + ops cost |
| **Reversibility** | n/a (status quo) | Two-way door (replace with Kafka later, ~6 weeks) | One-way door (Kafka in production is hard to walk back) |
| **Risk** | Coupling propagates billing outages — primary risk | Idempotency burden on consumers | Operational complexity at our scale — cost-benefit poor |
| **Non-risk** | — | Eventual consistency is acceptable for billing | — |

The recommendation falls out of this matrix in a sentence or two — not because the matrix mechanically chooses, but because the matrix exposes what trades for what. Once the trades are visible, the recommendation is a judgment.

## Sensitivity vs tradeoff — worked

A few patterns to recognise:

- **Sensitivity point on availability.** Single primary database, single AZ, single region — anything that becomes a single point of failure. Mitigate with replication, failover, or accept the QAS-1 bound.
- **Sensitivity point on latency.** Number of network hops on the critical path; synchronous calls across services; chatty data access patterns. Mitigate with caching, denormalization, async, or co-location.
- **Tradeoff point: consistency vs availability.** A classic CAP-flavored choice. Synchronous cross-region replication maximises durability and consistency but increases write latency; asynchronous replication minimises latency but loses transactions on regional failure. Pick deliberately.
- **Tradeoff point: modifiability vs performance.** Layered architectures with strong boundaries are easy to change and slower to execute (more indirection, more allocation). Highly-optimised inline implementations are fast and brittle. Match to the QAS that matters more.
- **Tradeoff point: deploy independence vs operational complexity.** Microservices buy deploy independence (a modifiability QAS) and pay in operational complexity (an operability QAS). You can't have both maximised — only chosen.
- **Tradeoff point: cost vs reliability.** Multi-region active-active is the most reliable topology and roughly doubles infrastructure cost. The right choice depends on the availability QAS and the cost QAS — and both must be measurable for the tradeoff to be honest.

## The reversibility test

Before recommending any non-trivial option, classify it.

**Two-way door (reversible).** Walking back this decision is a sprint or two of work; no downtime, no migration, no public-API breakage. Examples: choice of HTTP framework within a service, choice of internal caching library, choice of background job library.

**One-way door (irreversible).** Walking back requires migration, downtime, public-API breakage, or coordinated change across many teams. Examples: choice of primary data store, choice of public API shape, choice of identity provider, choice of message broker once events are flowing, choice of cloud vendor for core data plane.

The test changes how much analysis a decision deserves and how much ceremony its record should carry:

- **Two-way door, low cost to revisit:** decide fast, ship, learn. Skip the ADR unless the rationale is non-obvious.
- **Two-way door, moderate cost:** light ADR (Nygard format is fine). Recheck quarterly.
- **One-way door:** full options analysis, MADR-format ADR, fitness function, and an explicit sign-off from the affected teams. Bezos's rule: most decisions should be two-way doors; the one-way ones deserve the heavy weight.

State the reversibility classification in the recommendation, in plain language: *"This is a one-way door — switching message brokers once events are flowing is a multi-quarter project."*

## Fitness functions

A **fitness function**, from *Building Evolutionary Architectures* (Ford, Parsons, Kua), is an objective, automatable check that a system continues to satisfy a quality attribute over time. It is the architectural equivalent of a test: the architecture either passes or fails, on a schedule.

Fitness functions matter most for one-way-door decisions, because the failure mode is *silent drift* — the system slowly violates the QAS that the decision was meant to satisfy, and no one notices until it's far too expensive to fix.

### Examples

| QAS | Fitness function | Cadence |
|---|---|---|
| Order-placement p95 ≤ 500 ms at 5k RPS | k6 load test in nightly CI: ramp to 5k RPS, assert p95 ≤ 500 ms, fail the build if not. | Nightly |
| Single-AZ failure: orders continue, RTO ≤ 60 s | Chaos engineering exercise: kill the primary-AZ replicas weekly, assert traffic continues and RTO is met. | Weekly |
| New feature ships in ≤ 5 business days | DORA metric: track lead time on PRs labelled `feature`; alert if the rolling 4-week median exceeds 5 days. | Continuous |
| Cost per order ≤ $0.02 | Cost-per-confirmed-order monthly dashboard, alert if > $0.03 for two consecutive months. | Monthly |
| No data leakage of order data | DAST scan + audit-log invariant check in CI: any 2xx response on `/orders/*` without a valid auth token fails the build. | Per-PR |
| No new shared-database coupling | Lint rule on the deploy manifest / IaC: services may not declare access to a database not declared "owner". | Per-PR |

### Designing a useful fitness function

- **Automatable.** A "fitness function" that requires a human to read a dashboard isn't a fitness function, it's a hope. Make it part of CI, a scheduled job, or an alert.
- **Falsifiable.** It must be possible for the system to fail it. A fitness function that always passes by construction is decoration.
- **Tied to a QAS.** Each fitness function should name the QAS it defends. Without that linkage, fitness functions become noise.
- **Cheap to run.** If a fitness function costs more to run than the risk it mitigates, no one will run it. Right-size the cadence (some run per-PR, some weekly, some monthly).
- **Owned.** Every fitness function has a clear owner who responds when it fails. Otherwise it goes stale.

When proposing a one-way-door decision, propose its fitness function in the same response. That gesture signals you take the irreversibility seriously.

## The "what would change my answer" rule

End every recommendation with the **decision rule** — the condition under which the recommendation flips. This rule is not a hedge; it is a falsifiable claim about the future. Three formats:

- **Threshold.** "If average daily order volume grows above 50k/day, revisit — at that point the synchronous billing call becomes a real bottleneck even with retries."
- **Capability.** "If the team gains Kafka operational experience, revisit — the Kafka option becomes attractive once the operational concern is removed."
- **Counter-evidence.** "If a load test shows that synchronous billing can sustain 5k events/min with circuit-breaker isolation, the urgency of decoupling drops."

A recommendation without a decision rule is brittle. A recommendation with one is a position you can defend, revisit, and (when the moment comes) walk back gracefully.

## Anti-patterns in tradeoff analysis

A few failure modes to avoid:

- **Three flavours of the same idea.** "Microservices with Kafka, microservices with RabbitMQ, microservices with NATS" is not options analysis — it's confirmation bias. At least one option must be structurally different.
- **The hidden "do nothing".** If the status quo isn't in the matrix, it's been silently ruled out. That ruling needs to be explicit, with a stated reason.
- **No QAS scoring.** A pros-and-cons list with vague phrases like "more flexible" or "simpler" doesn't surface real tradeoffs. Score against named QASes.
- **All-positive consequences.** If the chosen option has no listed downsides, the analysis is dishonest. Every option has costs; surface them.
- **The buried tradeoff.** If the tradeoff point is mentioned in one sentence on page four, it isn't visible. Tradeoff points belong in the recommendation paragraph.
- **Reversibility ignored.** Treating a one-way door as a two-way door is the most expensive mistake in architecture. Always classify.
- **No fitness function for a one-way door.** Without it, the decision will silently drift away from its rationale, and no one will notice.

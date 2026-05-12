# Anti-patterns — Reference

The most valuable thing this skill does is **refuse to give the user the answer they came for, when the answer would harm them.** This file is the inventory of "harm them" patterns and the scripts for pushing back without being preachy.

Push-back rule of thumb: **name the pattern, name why it bites, name the question that would unblock the real decision, and offer the path forward.** Never simply refuse — always redirect. The user came to you with a problem; the anti-pattern is a wrong solution to it, but the problem is real.

---

## Distributed Monolith

**What it looks like.** A microservices architecture in which the services are tightly coupled — they share a database, deploy together, fail together, and require coordinated change. The team has paid the operational price of distribution and bought none of the benefits.

**Diagnostic signs:**

- Two or more services write to the same database tables.
- A change to one service routinely requires a coordinated change to another (and a coordinated deploy).
- Service A's tests cannot run without service B running.
- Service A's outage takes service B down with it (synchronous calls on the critical path, no degradation).
- The services' release notes always list each other.

**Why it bites.** Operational complexity of microservices (deploy infrastructure, service discovery, distributed tracing, multiple on-call rotations) without the modifiability and failure-isolation benefits.

**Pushback script.**

> "Two things are going on here. The system is a distributed monolith — the services share a database and deploy together, so you're paying the cost of distribution and getting none of the benefit. Before adding another service to it, the question worth answering is: which capability could plausibly be moved to its own database and its own deploy cadence? If the honest answer is 'none', the architecture should probably consolidate back to a modular monolith with strict module boundaries. If the answer is 'this specific one, for these reasons', then extract that one cleanly using the strangler fig pattern — own its data, own its deploy — and don't add more service boundaries until that extraction is done and proven."

---

## Premature Microservices

**What it looks like.** A small team (one to three engineers, or a team that has only existed for a few months) starting a new system as microservices from day one. Often justified by "we want to scale later" or "we want to use different languages per service".

**Why it bites.** The cost of microservices (CI/CD complexity, service discovery, observability, multiple repos, network failure modes) is paid up front. The benefits (independent deployment, independent scaling, team autonomy) require teams the system doesn't have yet and bounded contexts that haven't stabilised.

**Pushback script.**

> "Microservices solve a coordination problem between teams. With a team this size, there is no coordination problem yet — the problem is shipping the first version. A modular monolith with hard module boundaries gives the same code structure, the same testability, and a much lower operational cost. When the system has both the team count (three or more) and a stable understanding of where the bounded contexts are, extracting the first service is a two-quarter project that you'll do confidently. Doing it now is a project tax on every feature for the next year. Recommend: modular monolith, with module boundaries enforced by the codebase (separate packages, no cross-package data access). Revisit the split when you have a second team or a scaling pressure on a specific module."

---

## Resume-Driven Architecture

**What it looks like.** The choice of technology is more strongly correlated with what looks good on a CV (or what the loudest engineer wants to learn) than with what the workload, team, and operational context actually call for. Kubernetes for a four-instance web app. Kafka for 100 events a day. A service mesh for three services.

**Why it bites.** The team operates a system whose complexity exceeds their capacity to run it. Every incident becomes a learning event for an operator who is the most experienced person they have on the technology. Cost increases. Velocity decreases.

**Pushback script.**

> "Before picking the technology, I want to ask: which quality attribute scenario fails if we use the boring option? For a workload at this scale, the boring option is [a managed Postgres / a Cloud Run / a small fleet on ECS / etc.]. If the answer is 'none — we just wanted the new technology', the recommendation is the boring option. If the answer is a specific QAS that fails, we look at the technology that addresses that specific failure. Two years from now, the team that owns this on Saturday at 3 AM will thank the version of you that picked the boring option."

---

## The Big Rewrite

**What it looks like.** "Let's rewrite this from scratch." The current system is hard to change, accumulated cruft, used a now-unfashionable framework, or feels embarrassing to its current maintainers. A team proposes building a parallel replacement that will be feature-complete and clean.

**Why it bites.** The empirical record is brutal: long delays (years, not months), parallel-running operational cost, feature freeze on the old system, lost institutional knowledge that lived in bugfixes-that-look-like-magic, scope creep on the new system. The new system absorbs the old system's complexity by the time it's done, plus the new mistakes added in the rebuild.

**Pushback script.**

> "Rewrites are a project category that's lost more value in our industry than almost any other. The mechanism: the old system has years of accumulated decisions (some explicit, most implicit in bugfix patterns); the new system rediscovers them, one production incident at a time. Two practical alternatives, both better in roughly every case:
>
> 1. **Strangler fig** — put a router in front of the old system, migrate one capability at a time to a clean new implementation, decommission the old gradually. Risk is bounded per capability; rollback is a routing change.
> 2. **Inside-out refactor** — keep the running system, but progressively extract internal modules to clean structure behind interfaces. The system stays shippable.
>
> The case for a rewrite has to be that no migration path is feasible — not 'this would be cleaner'. If the case is the latter, recommend strangler fig and a list of the first three capabilities to migrate."

---

## Shared Database

**What it looks like.** Multiple services read and write the same tables. Often started innocently ("the inventory service needs to see order rows") and never reverted.

**Why it bites.** It creates implicit coupling that the C4 diagram doesn't show. Schema changes become coordinated changes. A bug in one service can corrupt data another service depends on. Performance debugging crosses team lines. The shared database becomes a deployment bottleneck even when the services are nominally independent.

**Pushback script.**

> "Two services sharing tables is a coupling stronger than any API contract. The fix is one of three patterns:
>
> 1. **API access.** One service owns the table; the other reads/writes through that service's API. Adds latency and a hop; resolves the coupling.
> 2. **Event-driven projection.** The owner publishes change events; the consumer maintains its own read-optimised copy. Adds eventual consistency; resolves the coupling and improves read isolation.
> 3. **Reunite the services.** If they really need transactional access to the same data, they're probably one bounded context that was split prematurely — merge.
>
> Which fits depends on the access pattern and the consistency requirement. Picking #1 by default is usually right; #2 if the read pattern is heavy and consistency tolerance allows; #3 if the answer turns out to be 'we shouldn't have split this'."

---

## Lambda Pinball

**What it looks like.** A workflow implemented as many small serverless functions calling each other synchronously through various combinations of HTTP, EventBridge, S3 triggers, and SNS. Each function is small and "clean"; the overall flow is impossible to follow, debug, or reason about.

**Why it bites.** Latency adds up across hops. Failure handling is per-hop and inconsistent. Observability requires tracing across asynchronous boundaries. Cost is unpredictable. Cold-start variance compounds. The architecture's structure is not in any single place — you have to read every function and every trigger configuration to know how it works.

**Pushback script.**

> "This is Lambda pinball. The flow has fifteen hops and the architecture lives in the trigger configurations, not in any code or diagram. Two patterns to consider:
>
> 1. **Workflow engine** — pull the orchestration into Step Functions, Temporal, or similar. The workflow becomes explicit, debuggable, and replayable; individual functions stay small.
> 2. **Bigger functions, fewer hops** — consolidate adjacent functions whose only reason to be split was 'one file per function' rather than a real seam. A single function doing four small things in sequence is easier to debug than four functions doing one each.
>
> The general rule: serverless is excellent for spiky, fire-and-forget, event-driven work. When the work is really a coordinated flow, an explicit workflow tool serves better than a tangle of triggers."

---

## God Service

**What it looks like.** One service in the architecture is the one every other service calls. It owns most of the data, has most of the endpoints, requires the largest team, and is deployed most cautiously. The architecture is technically distributed but functionally a hub-and-spoke around this service.

**Why it bites.** The god service becomes the bottleneck for change. Every cross-cutting feature has to ship through it. Its outage is a system outage. The team that owns it becomes a critical-path team for everyone else. Velocity for the whole organisation tracks the velocity of the god-service team.

**Pushback script.**

> "There's a god service in the architecture. The diagnostic: of N services, M-1 of them call this one on the critical path. Whatever the original bounded context was, it has accreted into 'the one that owns everything important'. The fix is patient: identify two or three subdomains inside the god service that are internally cohesive and only loosely depend on the rest, and extract them as their own services. Don't try to fix it in one project — extract the cleanest seam first, prove the pattern, repeat. The signal of progress is that other teams stop needing to coordinate with the god-service team for every release."

---

## Event Sourcing Without a Reason

**What it looks like.** An event-sourced architecture chosen because event sourcing is interesting, not because the system needs replay, audit, or temporal queries. The team pays the cost of event-sourcing infrastructure (event store, projections, snapshots, schema evolution rules) on every feature.

**Why it bites.** Event sourcing has narrow, real benefits: complete audit trail, ability to rebuild state, ability to project the same events into multiple read models, temporal queries. It has broad costs: harder to reason about, harder to onboard, projection drift, event-schema evolution, and a learning curve every new engineer pays. If the benefits aren't needed, the costs are pure tax.

**Pushback script.**

> "Event sourcing is a specific tool for a specific problem: 'we need to know the entire history of changes, and/or rebuild different views from the same history.' If the system doesn't need that — and most don't — CRUD on a relational store with an audit table is far simpler and well-understood. Before recommending event sourcing, I'd want to see a specific QAS that CRUD-plus-audit fails. If it's there, event sourcing is great. If it's not, the audit table is the win."

---

## Premature Multi-region

**What it looks like.** A small system designed for multi-region active-active deployment from day one. Cross-region replication, latency-aware routing, data residency partitioning, and complex failover — all built before there is any evidence that any of it is needed.

**Why it bites.** Multi-region operation is the most complex thing most teams will ever build. Consistency, conflict resolution, replication lag, failover testing, region-aware deploys, doubled costs — all paid up front against benefits that may never materialise.

**Pushback script.**

> "Multi-region is a project, not a configuration. The cost is roughly: 2× infrastructure cost, an order of magnitude more deploy complexity, significant new failure modes, and ongoing operational discipline (failover testing, region-specific runbooks, cross-region latency budgets). The benefits are real but specific: continuous availability through a regional outage, regulatory data-residency, single-digit-millisecond latency to globally distributed users. Are any of those tied to a QAS? If yes, design for it deliberately. If no — single-region with cross-AZ redundancy is the right starting point, and the move to multi-region is a future project we can plan when an event warrants it."

---

## No Timeouts / Unbounded Retries

**What it looks like.** Network calls in the system have no explicit timeout, or timeouts in some places and not others. Retries are present but unbounded or with linear backoff and no jitter.

**Why it bites.** When the called service slows down, the calling service queues requests, exhausts threads or connections, and fails too. When the called service flaps, retries amplify the load and turn brief blips into full outages (the classic thundering herd).

**Pushback script.**

> "Every network call in the system needs an explicit timeout — including the ones inside the same VPC, the same Kubernetes cluster, the same datacentre. The default 'no timeout' is a footgun: one slow dependency becomes a system-wide outage by exhausting connection pools or threads. Retries need three properties: bounded attempts, exponential backoff with jitter, and a circuit breaker that opens when the dependency is repeatedly failing. Audit the call graph for missing timeouts before adding any new capability; the fix is small and the absence is one of the most common root causes in postmortems."

---

## Caching Without Invalidation

**What it looks like.** A cache layer (Redis, CDN, in-memory) added in front of a data source. Cached entries have generous TTLs or none. There is no clear answer to "when an underlying record changes, how does the cache learn?"

**Why it bites.** "There are only two hard things in computer science: cache invalidation and naming things." (Phil Karlton.) A cache without invalidation is a stale-data emitter. The bug shows up as "the website is showing me yesterday's price" or "I just updated my email and it still shows the old one" — and is debugged by an engineer who didn't write the cache.

**Pushback script.**

> "Caches earn their place when there's a real read hotspot — skewed access, repeated identical computation, an expensive downstream call — and when the staleness window is acceptable. Before adding a cache, two questions: what's the access pattern that justifies it (measured, not assumed), and what's the invalidation strategy when underlying data changes? The strategies are: TTL (acceptable when stale data for up to N is OK), explicit invalidation on write (correct but coupled), or event-driven invalidation (decoupled and correct but with extra moving parts). If neither the access pattern nor the staleness tolerance is clear, skip the cache; it's adding complexity without quantified benefit."

---

## Mocking the Whole World in Tests

**What it looks like.** A test suite where every test mocks every external dependency. Tests pass. The system fails in production because the real dependencies behave differently from the mocks.

**Why it bites.** Tests like this verify that the code matches the mocks, not that the system works. The mocks drift from reality. Confidence is false and worse than no confidence, because it suppresses caution.

**Pushback script.**

> "Tests against mocked dependencies verify that the code calls the mock correctly, not that the system integrates with reality. Two practices to add:
>
> 1. **Contract tests** — tests that verify both sides of an integration agree on the contract (Pact, schema-based tests, recorded fixtures). When a contract test fails, both sides know to coordinate.
> 2. **A small number of integration tests against real (or near-real) dependencies** — ideally in CI, using containerised versions of the actual services. They run slower; they catch the things the unit tests miss.
>
> Keep the fast mocked tests for the inner logic; add contract tests for the seams; run real-dependency integration tests on every PR. The pyramid stays a pyramid; the top of it is wider than zero."

---

## Vendor Lock-in by Accident

**What it looks like.** Heavy reliance on a specific vendor's primitives (proprietary data formats, vendor-specific managed services, vendor-bound SDKs) without an explicit decision to commit. The team doesn't think of it as lock-in because they've never tried to leave.

**Why it bites.** When pricing changes, when the service is deprecated, or when the vendor's roadmap diverges from yours, switching cost is the implicit lock-in tax — and it's usually much higher than the team estimated.

**Pushback script.**

> "Two kinds of vendor lock-in are reasonable: deliberate (we chose this and the benefits are worth the lock-in) and unavoidable (the abstraction we'd need to write is more code than the value we'd get). What's expensive is accidental lock-in — using vendor primitives directly because they're convenient, without an exit plan. The remediation isn't to abandon the vendor; it's to:
>
> 1. **Wrap vendor-specific calls behind your own thin abstraction** (adapter pattern). The abstraction shouldn't be ambitious — just enough that swapping vendors later is a quarter, not a year.
> 2. **Estimate the switching cost annually** as a number, and treat it as a risk that the architecture is exposed to.
>
> If the switching cost grows faster than the value, that's a signal to reduce dependency. If it stays manageable, the lock-in is acceptable."

---

## No "Do Nothing" Option

**What it looks like.** A design review or ADR presents three options, all of which involve building something. The status quo isn't on the table.

**Why it bites.** The status quo is often the right answer — and is the only option whose cost is precisely known. Excluding it silently means the team can be presented with three expensive options and forced to pick one without a baseline.

**Pushback script.**

> "There are three options on the table, all of which involve building something. What is missing is option zero: do nothing, or do something so small it's almost nothing. For each of the other options to be the right call, option zero has to fail an articulated requirement. What is that requirement, and is it falsifiable? If we can't name it, option zero is the recommendation. If we can, we now know what the build is for."

---

## Recommendations Without a Decision Rule

**What it looks like.** "I recommend X." Full stop. No statement of the condition under which X would be wrong.

**Why it bites.** The recommendation is unfalsifiable. Six months later, when the situation changes, no one knows whether to revisit. The decision quietly outlives its justification.

**Pushback script.**

> "Every recommendation in an architecture document should end with the decision rule — the specific condition under which the recommendation would flip. 'I recommend X if conditions A and B hold; if either changes — specifically if [threshold/event] — we revisit.' Without that, the recommendation can't be checked later. It becomes a guess we have to honour forever."

---

## How to push back without being annoying

A few rules that keep pushback constructive:

- **Name the pattern, not the person.** "This looks like a distributed monolith" — not "You've made a mistake."
- **Show, don't shame.** The pattern bites for a reason; explain the mechanism. People accept refusals when they understand them.
- **Offer the unblocking question.** Don't just refuse; give the user the question that, when answered, would either justify the original ask or unlock a better path.
- **Hold the line, but only the line that matters.** Push back firmly on patterns that cause real harm. Don't fight stylistic preferences.
- **Make it cheap to accept.** Provide the specific alternative with the specific next step. "Use a modular monolith and revisit when you have three teams" is actionable; "don't use microservices" is not.

The point is never to win the argument. The point is to help the user make a decision they won't regret in eighteen months.

# Quality Attributes — Reference

Quality attributes (also known as non-functional requirements, NFRs, or "the -ilities") are the properties of a system that you can't tick off a feature list: performance, security, reliability, modifiability, and so on. They are the things architecture is actually for. Functional requirements determine *whether* the system does the right thing; quality attributes determine *how well*, and therefore which architecture you should pick.

Two ideas drive everything in this file:

1. **Quality attributes only become useful when they are measurable.** "Fast" is not a requirement; "p99 < 200 ms under 5k RPS" is.
2. **The Quality Attribute Scenario (QAS)** — a six-part template from the SEI — is the way to make them measurable. Use it.

## ISO/IEC 25010 — the catalogue

ISO/IEC 25010:2023 defines a standard taxonomy of quality characteristics. Use it as a checklist: when discussing a system, walk these categories and ask which ones have real, measurable requirements. Most systems care strongly about a handful and weakly about the rest; the architecture should reflect that.

The eight top-level characteristics and their main sub-characteristics:

- **Functional Suitability** — completeness, correctness, appropriateness. "Does it do the right thing, fully?"
- **Performance Efficiency** — time behaviour (latency, response time, throughput), resource utilisation, capacity. "Does it do it fast enough, using acceptable resources?"
- **Compatibility** — co-existence with other systems, interoperability (data formats, protocols).
- **Interaction Capability** (in 25010:2023 — formerly Usability) — appropriateness recognisability, learnability, operability, user error protection, UI aesthetics, accessibility.
- **Reliability** — maturity (rate of failure), availability (uptime), fault tolerance, recoverability (RPO, RTO).
- **Security** — confidentiality, integrity, non-repudiation, accountability, authenticity, resistance.
- **Maintainability** — modularity, reusability, analysability, modifiability, testability.
- **Flexibility** (in 25010:2023 — broadens the old "Portability") — adaptability, scalability, installability, replaceability.

A ninth was added in 25010:2023: **Safety** — operational constraint, risk identification, fail-safe, hazard warning, safe integration. Relevant for cyber-physical and safety-critical systems.

The point of the catalogue is not to score every system on every characteristic. It is to make sure no important characteristic was forgotten — the missing-NFR problem (the system is fast and feature-complete and totally insecure) is the most common architectural failure mode.

## The six-part scenario (QAS)

A Quality Attribute Scenario is a structured, falsifiable description of a quality attribute requirement. It is the only kind of NFR statement worth writing down. Six parts:

| Part | What it captures | Example |
|---|---|---|
| **Source** | Where the stimulus originates | A registered customer |
| **Stimulus** | The event the system must respond to | Submits an order |
| **Environment** | The state the system is in when stimulated | Peak load, 5,000 concurrent users |
| **Artifact** | Which part of the system is being measured | The order placement API |
| **Response** | The system's required behaviour | Accepts the order and returns a confirmation |
| **Response measure** | How the response is measured — must be testable | Within 500 ms p95, 99.9% success rate |

Read together: *"A registered customer submits an order during peak load (5k concurrent users). The order placement API accepts the order and returns a confirmation within 500 ms p95, with a 99.9% success rate."*

This is testable. A load test either passes or fails against it. That is the bar.

### How to write a QAS that holds up

A few discipline rules:

- **Source must be a real actor**, not "the system." If the source is the system itself (e.g. a scheduled job, a retry, a healthcheck), name *which subsystem*.
- **Stimulus is a single event**, not a workload. "Submits an order" is a stimulus. "Uses the system on Black Friday" is not — that's the environment.
- **Environment is the part that often gets skipped, and is the part that usually matters most.** A response time at 10 RPS is meaningless if production runs at 5,000 RPS. Always name the load, the data volume, the failure mode being assumed, or whatever else changes the difficulty.
- **Artifact is the smallest concrete scope you can name.** Not "the system" — the specific API, container, or component being measured. This is what ties the QAS to the C4 diagram.
- **Response is what the system must do externally** — what an observer would see. Not internal mechanism.
- **Response measure must be measurable with an actual instrument.** p50 / p95 / p99, ratio, count per unit time, recovery time, mean time between failures, percentage of test cases passing. If you can't say how you'd measure it, the QAS is decoration.

### Worked examples — good vs vague

| Vague | Good (as QAS) |
|---|---|
| "The system must be fast." | A registered customer submits an order during peak load (5k concurrent users, 1k orders/min). The order placement API accepts the order and returns a confirmation within 500 ms p95, 99.5% success rate. |
| "The system must be secure." | An unauthenticated external attacker attempts to access another customer's order data via the public API. The order API rejects the request with a 401/403 and emits an audit event within 100 ms; no order data is leaked in the response or in logs. |
| "The system must be scalable." | Operational load doubles from 5k to 10k orders/min over six hours. The order platform handles the new load with the same p95 latency targets (≤500 ms) within 15 minutes of the increase, with no operator intervention beyond autoscaling. |
| "The system must be reliable." | A single availability-zone failure occurs in the primary cloud region. The order platform continues to accept and confirm orders within 5 seconds of the failure, with no data loss for orders confirmed before the failure (RPO = 0); RTO ≤ 60 s for the failed-over path. |
| "Easy to modify." | A new feature team that has been onboarded for six weeks ships a new line-item discount rule to production. The change goes from PR-open to production within 5 business days, requiring no changes outside the order-pricing service. |
| "Secure auth." | A user signs in from a new device. The system completes the auth handshake within 1 s p95, requires a second factor for the new device, and emits an audit event recording the device fingerprint and IP within 100 ms. |

The pattern: **specific source, specific stimulus, specific environment, specific artifact, specific response, measurable response.**

## How QAS drive architecture

A QAS does three things that vague NFRs cannot:

1. **It tells you which architecture choice to make.** The order-placement latency QAS above probably implies: a cache for hot lookups, async writes for non-critical side-effects, a dedicated read replica, or all three. None of those choices are implied by "fast".
2. **It tells you what to test.** Every QAS implies a test — load test, chaos experiment, security probe, deploy-time measurement. If you can't write the test, the QAS is wrong.
3. **It tells you what to monitor in production.** Every QAS becomes a Service Level Objective (SLO). Without QASes you have an SLO-shaped hole filled by guesses.

A simple linkage to make explicit in design docs:

```
QAS-3 (order-placement latency, p95 ≤ 500 ms at 5k RPS)
  ↳ informs C4 Container choice: read replica + cache layer
  ↳ informs ADR-014 (decouple billing via message broker)
  ↳ verified by: k6 load test in CI, weekly chaos run
  ↳ monitored by: SLO p95 latency on /orders POST, alert at 80% of error budget burn
```

Make this trail visible and the system becomes auditable against its own requirements.

## Standard categories to walk through

For any non-trivial design or review, walk these and ask whether a QAS exists. Most will get a one-line "not architecturally significant for this system" answer; the handful that matter will produce real QASes. The point of the walk is to *not silently forget* a category.

- **Performance** — latency targets (p50/p95/p99), throughput targets, capacity, resource ceilings.
- **Scalability** — load growth profile, scale-out behaviour, the ratio you must hold.
- **Availability** — uptime target (e.g. 99.9%), maintenance windows, what counts as "down".
- **Fault tolerance / resilience** — what failures must the system survive (single node, single AZ, single region, dependency outage)? With what degradation?
- **Recoverability** — RPO (data-loss tolerance) and RTO (time-to-recovery) per failure class.
- **Security** — auth/authz model, data classification (what's sensitive), threat actors in scope, compliance regime (PCI, HIPAA, GDPR, SOC2).
- **Privacy** — data residency, retention, right-to-erasure, audit obligations.
- **Modifiability** — what kinds of change must be cheap (new feature team, new domain, new region, new integration)? Express as time-to-ship for a defined change type.
- **Testability** — what fraction of behaviour must be testable below the UI level? What is the target time for the full CI run?
- **Deployability** — deploy frequency target, change failure rate target, mean time to recovery from a bad deploy.
- **Observability** — must each request be traceable end-to-end? What's the target time to detect an outage?
- **Operability** — what must on-call be able to do without escalating? What's the target time to onboard a new on-call engineer?
- **Cost** — unit economics targets (cost per request, cost per active user, cost per GB stored), and the headroom you need before requiring a redesign.
- **Sustainability** — energy use, carbon intensity, hardware refresh strategy. (Increasingly an architectural concern, especially for large workloads.)
- **Portability** — multi-cloud, on-prem, edge requirements.
- **Interoperability** — protocols, formats, partner contracts the system must honour.

## A short worked example — for a new SaaS order platform

```
QAS-1 (Availability)
A single AZ failure in the primary region occurs during business hours.
The order placement and order lookup APIs continue serving traffic.
RTO ≤ 60 s for any failed-over request; RPO = 0 for confirmed orders.
SLO: 99.9% monthly availability on /orders endpoints.

QAS-2 (Performance — order placement)
A registered customer submits an order during peak load (5k orders/min,
20k concurrent active sessions). The order placement API accepts the order
and returns a confirmation within 500 ms p95 and 1 s p99, success rate ≥ 99.5%.

QAS-3 (Performance — order lookup)
A registered customer requests an order detail page during peak load.
The order lookup API returns the response within 200 ms p95.
99% of lookups hit the cache; the underlying store sustains the 1% miss rate.

QAS-4 (Scalability)
Operational load doubles over six hours due to a marketing event. The
platform sustains QAS-2 and QAS-3 targets within 15 minutes of the increase,
without operator intervention beyond autoscaling.

QAS-5 (Security — order data confidentiality)
An unauthenticated external request attempts to access an order. The API
returns 401/403 within 100 ms and emits an audit event. No order data
appears in response bodies, error messages, or logs.

QAS-6 (Modifiability — new pricing rule)
A new feature team (onboarded ≥ 6 weeks) ships a new line-item pricing rule
to production. Lead time from PR-open to production: ≤ 5 business days.
The change is confined to the order-pricing service (no changes outside
that service's repository).

QAS-7 (Deployability)
The order platform deploys at least daily. Change failure rate ≤ 15%. MTTR
on a failed deploy ≤ 30 minutes.

QAS-8 (Cost)
Steady-state cost per confirmed order ≤ $0.02 at 5k orders/min, including
infrastructure, observability, and licensed managed services. Re-evaluate
if cost-per-order grows above $0.03 for two consecutive months.
```

Eight QASes, each falsifiable, each tied to a measurement. Together they give the architecture something to be right or wrong against. That is what quality attributes are for.

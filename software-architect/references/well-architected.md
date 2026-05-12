# Well-Architected — Reference

The "Well-Architected Framework" was popularised by AWS in 2015 and has since been adopted (with minor variations) by Azure (Well-Architected Framework), Google Cloud (Architecture Framework), Oracle, and the Open Group. Despite the cloud branding, the six pillars are cloud-agnostic principles that apply to any non-trivial system. They are the standard checklist for architecture reviews — useful precisely because the catalogue of pillars makes it hard to silently forget one.

Use them in two situations:

1. **Designing a new system** — walk the pillars and ensure each has been considered. Most pillars will get a brief "addressed by QAS-N and ADR-M" note; one or two will demand real design work.
2. **Reviewing an existing system** — walk the pillars looking for the weakest. Architecture review by pillar exposes the gaps that domain-focused review misses.

The original AWS framework had five pillars; **Sustainability** was added in 2021, and is now part of every modern variant. Some variants also surface **Compatibility / Interoperability** or **Privacy** as separate concerns; here they are treated as sub-themes of Security and Reliability.

## The six pillars

### 1. Operational Excellence

**The question:** Can we run this system, evolve it, and recover from failures with confidence and at acceptable cost-of-people?

This is the pillar most often skipped during design and most often discovered missing during the second incident. "We didn't think about operations" is the line you hear at the postmortem.

**Review questions:**

- Are operational procedures **runbooks or tribal knowledge**? Runbooks for the named failure modes (single-AZ failure, primary DB failover, dependency outage, deploy rollback) must exist before the system goes to production. Tribal knowledge is a future incident.
- Is the system **observable**: structured logs, metrics, traces, with a correlation ID end-to-end? Can you answer "what is happening right now, for this request, at every hop?" from production telemetry alone?
- Are **SLOs defined and tracked**, and is there an **error budget** that the team actually respects? An SLO without an error budget is a wish.
- Are deployments **safe, frequent, and rollback-able**? Target a deploy frequency of at least daily for actively-developed systems; weekly is acceptable for stable ones. Big-bang quarterly releases are an operational anti-pattern.
- Is the **change-failure rate measured** and acted on? DORA metrics (deploy frequency, lead time, MTTR, change failure rate) are the simplest operational health dashboard you can have.
- Are **incidents reviewed without blame**? Blameless postmortems and a culture of writing down what was learned are the difference between "we've had this incident once" and "we've had this incident eight times".
- Is **on-call sustainable**? Pager load, after-hours alerts, and false-positive rates are operational debt that compound.
- Are **architectural changes themselves operable**? A migration plan with no operational hand-off is half a plan.

**Common gaps:**

- Beautiful architecture, no runbooks.
- Logs without trace correlation.
- SLOs published, error budget never used to slow down feature work.
- Deploys require multiple humans coordinating on a Friday afternoon.

### 2. Security

**The question:** Are confidentiality, integrity, and authenticity preserved against the threats we are actually exposed to?

Security is the pillar where buzzwords most often replace thinking. "We use OAuth and HTTPS" is not a security posture; it is a starting state.

**Review questions:**

- Is there a **threat model**? Who are the actors (external attacker, insider, supply-chain), what are their goals, what assets matter, what's in scope? Without a threat model, security review is theatre.
- Is there a **data classification**? Which data is public, internal, sensitive, regulated? Different classes demand different controls. Treating all data the same costs money on the cheap end and risk on the expensive end.
- Are **identities and permissions** based on **least privilege**? Every service identity, every IAM role, every database user should have the smallest set of permissions that makes it function. The "*" permission is the smell.
- Is **authentication** modern: MFA for humans, short-lived credentials for services, no shared secrets in repos? Long-lived API keys are an anti-pattern.
- Is **secret management** in a real secret store (Vault, KMS-backed, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager), with rotation, audit, and access logged?
- Is **data encrypted in transit** (TLS 1.2+ on every hop, including internal) **and at rest** (envelope encryption with KMS-managed keys)?
- Is **input validation** at the boundary, and is **output encoding** correct for the context? Most application-layer vulnerabilities are still SQL injection, command injection, deserialization, and XSS — old categories that remain top.
- Is the system covered by **SAST**, **DAST**, **SCA** (software composition analysis, for known-vulnerable dependencies), and **secret scanning** in CI, with build-failing gates rather than ignored reports?
- Is there an **incident response plan** that anyone has actually rehearsed?
- Are **logs immutable, retained, and forwarded** to a security analytics destination (SIEM)? Without retained logs you cannot investigate.
- Is the system **compliant with relevant regimes** (PCI-DSS, HIPAA, GDPR, SOC2, FedRAMP, etc.) — *and is that compliance measured by evidence*, not "we believe we're compliant"?

**Common gaps:**

- IAM roles with `Action: "*"`. "Just for the demo."
- Secrets in environment files committed to repos in 2017, never rotated.
- TLS termination at the edge with cleartext on the internal mesh.
- Validation libraries used inconsistently across services; one service does it right and three don't.
- A WAF in front of an application that doesn't itself validate inputs.

### 3. Reliability

**The question:** Does the system continue to deliver against its quality attributes under load, failure, and stress — and can it recover when it can't?

**Review questions:**

- Are **availability targets explicit** and tied to QASes? "99.9%" is a number; what *counts* as down, *for whom*, over *what window* — that is the SLO.
- Is the **failure domain** known and bounded? What survives a single VM failure, a single AZ failure, a single region failure, a single dependency outage? Each of these should have an answer, even if some answers are "it doesn't, and that's acceptable for this system".
- Are **dependencies graded by criticality** and treated accordingly? A critical-path dependency requires retries, circuit breakers, timeouts, and a defined degradation path. A nice-to-have dependency can be fire-and-forget.
- Are **retries safe** (idempotent), **bounded** (max attempts, exponential backoff with jitter), and **with circuit breakers**? Unbounded retries amplify outages.
- Are **timeouts set everywhere** in the network call chain? The default is "no timeout," and the default is a foot-gun: one slow dependency becomes a system-wide outage.
- Is there a **degradation strategy** — what shows up when the recommendation engine, payment service, or search index is down? Stale-but-served is usually better than empty.
- Are **RPO** (recovery point objective — how much data can be lost) and **RTO** (recovery time objective — how long can recovery take) defined per failure class, and are they actually achievable? "Hot standby, RTO 5 minutes" needs to be exercised, not aspirational.
- Are **backups** tested? An untested backup is a wish.
- Is **chaos engineering** practised in some form (game days, automated failure injection)? Reliability earned from "we've never had a single-AZ failure in production" is not earned.
- Is there a **runbook for each named failure mode**, and is it kept current?

**Common gaps:**

- No timeout on the call between A and B, because "B is in the same VPC".
- Retries amplifying a thundering-herd outage.
- Backups present, never restored, full of corruption no one knew about.
- RTO target of 5 minutes that has never been measured.

### 4. Performance Efficiency

**The question:** Does the system use compute, storage, and network resources well — and is its capacity matched to actual demand?

**Review questions:**

- Are **performance targets measurable and tested**? p95/p99 latencies and throughput numbers, in a load test the team can run on demand.
- Is **capacity planned** rather than discovered? Know the peak you must handle (Black Friday, end-of-quarter, broadcast-driven traffic), and have a load-tested margin against it.
- Are **resources right-sized** to the workload? Over-provisioning is wasteful but usually not catastrophic; under-provisioning is catastrophic. Default to enough margin to absorb 2× peak.
- Is **autoscaling** in place and exercised, with the scale-out time matching the load-growth rate? Autoscaling that takes 10 minutes to add capacity to a load spike that arrives in 2 minutes is a paper tiger.
- Are **hot paths profiled** and the actual bottlenecks identified? Optimising the wrong thing is the most common performance mistake.
- Is **caching** used **where access patterns justify it** (skewed reads, repeated computation), with **invalidation thought through**? Caches with wrong invalidation cause more outages than no caches.
- Are **database access patterns sound**: indexes match queries, N+1 patterns surfaced and removed, slow queries logged and acted on?
- Is **the data layer the right shape for the workload**? (See `tech-selection.md`.)
- Is the **cost-per-operation** measured, and improving (or at least stable) over time?

**Common gaps:**

- "It feels fast on my laptop" as a performance posture.
- A scaling group that scales out fine but scales in catastrophically.
- A cache without TTLs, ballooning forever.
- The same query running on every page load because nobody added the obvious index.

### 5. Cost Optimisation

**The question:** Are we delivering the required outcomes at the lowest cost we can sustain — and is the cost actually understood?

**Review questions:**

- Is **cost visible per team / per service / per environment**, not as a single monthly invoice? You can only optimise what you can attribute.
- Is **cost per unit of business value** tracked? Cost per active user, cost per request, cost per GB stored, cost per transaction — pick the unit that matters and track it.
- Are **non-production environments scoped to non-production size**? Production-sized staging environments running 24/7 are a common cost leak.
- Are **resources right-sized** (not just generous-sized)? Cloud bills are made of small choices: instance type, storage class, replication, retention.
- Are **storage classes matched to access patterns**? Hot data on cheap cold storage costs latency; cold data on expensive hot storage costs money. Both happen.
- Are **commitments and reservations** taken for predictable workloads? Reserved instances / committed-use discounts pay for themselves quickly for stable baselines.
- Are **unused resources** detected and removed? Forgotten test environments, orphaned snapshots, idle load balancers — the long tail is real money.
- Is **egress** monitored? Cross-AZ, cross-region, and internet egress are the cost vectors that surprise teams most.
- Is there a **cost FinOps practice** — someone whose job is partly to look at the cost graph and ask why it's the shape it is?

**Common gaps:**

- A monthly cloud bill of $X, no breakdown, no per-team chargeback.
- A staging cluster the same size as prod, kept online "just in case".
- Logs retained for two years because no one set a retention policy.
- A microservices estate where each service has its own RDS instance at 5% utilisation.

### 6. Sustainability

**The question:** Is the system's environmental impact bounded and improving over time?

A newer pillar — and one that increasingly affects vendor selection, regulatory exposure, and customer expectations. For large workloads it can also be material to cost (the two pillars correlate strongly: an efficient workload is a low-carbon workload).

**Review questions:**

- Is the **carbon intensity of the cloud region** considered when choosing where to run? Some regions are dramatically cleaner than others; latency permitting, prefer them.
- Are **idle resources eliminated** (a sustainability concern as much as a cost concern)?
- Is **compute scaled to demand** rather than provisioned for peak 24/7?
- Is **data lifecycle managed**: cold-tier the cold data, delete what isn't needed? Storing data forever has a non-zero carbon cost.
- Are **batch and asynchronous workloads scheduled when grid carbon intensity is lowest** where the provider exposes that signal? Increasingly available; rarely used.
- Is **hardware refresh strategy** sane? Long-lived bare metal can be both more economical and lower-carbon than constantly-churning fleet; the right answer depends on workload type and provider.
- Are **reporting obligations** (e.g. CSRD in the EU, SEC climate disclosure where applicable) being met with real data rather than estimates?

**Common gaps:**

- Sustainability not measured at all.
- Workloads in the most convenient region rather than the most carbon-efficient one within latency budget.
- "We're cloud, so we're sustainable" — a non-sequitur, but a popular one.

## How to use the pillars in practice

For a **new system design**, after the QAS are written and the candidate architectures sketched, walk each pillar and ask: "for the recommended option, what's our position on this pillar, and is anything missing?" Most pillars get a one-paragraph answer; one or two will surface a real gap that needs explicit decision-making.

For an **architecture review**, walk the pillars in order, listing findings per pillar as: *finding → why it matters → suggested change → effort → risk if ignored*. Then rank the findings by severity × effort × reversibility and present the top items as the focus of the review. The lower items become a backlog.

For a **migration plan**, walk the pillars against both current and target state. The biggest gap between the two is usually the right thing to lead with — and it is often Operational Excellence, not the headline feature gap.

## Cloud-specific framework links

This reference deliberately stays cloud-agnostic, but each major cloud has a detailed framework with provider-specific guidance. When the system is committed to a particular cloud, those are worth consulting:

- AWS Well-Architected Framework (six pillars, with workload-specific lenses)
- Azure Well-Architected Framework (five pillars: Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency)
- Google Cloud Architecture Framework (six perspectives: System Design, Operational Excellence, Security/Privacy/Compliance, Reliability, Cost Optimization, Performance Optimization)
- Oracle, IBM, and Alibaba have analogous frameworks.

They differ in the names of pillars more than in substance. Use the six in this file as the cross-cloud lingua franca; consult the provider's framework for the specific service-by-service review questions.

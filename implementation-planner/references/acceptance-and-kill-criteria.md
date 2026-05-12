# Acceptance, Kill, and Observability Criteria

A slice without acceptance criteria is a slice you can't verify. A slice without kill criteria is a slice that will be finished even when it shouldn't be. A production-bound slice without observability criteria is a slice whose success in dev tells you nothing about its success in prod. All three are required.

This reference is the craft guide for writing them well.

## Table of contents

1. [Acceptance criteria — what good ones look like](#1-acceptance-criteria--what-good-ones-look-like)
2. [Patterns: checklist, BDD, examples](#2-patterns-checklist-bdd-examples)
3. [Acceptance vs Definition of Done](#3-acceptance-vs-definition-of-done)
4. [Kill criteria — the harder half](#4-kill-criteria--the-harder-half)
5. [Observability criteria — production-aware acceptance](#5-observability-criteria--production-aware-acceptance)
6. [Anti-patterns to refuse](#6-anti-patterns-to-refuse)

---

## 1. Acceptance criteria — what good ones look like

Acceptance criteria answer: **"how do we know this slice is done?"**

A good criterion is:

- **Observable** — someone (or some test) can check it
- **Specific** — names the behavior precisely, not "works correctly"
- **Pre-committed** — written before work starts; not retrofitted to whatever shipped
- **Independent of implementation** — describes *what*, not *how*
- **Falsifiable** — there's a way to be wrong; "ships eventually" is not acceptance, it's a tautology

### The three kinds of acceptance to cover

For most production slices, acceptance criteria fall into three buckets. A good slice covers all three:

1. **Functional** — the slice does what it claims, for the happy path and known unhappy paths
2. **Technical** — the slice doesn't break load-bearing properties (types check, tests pass, no schema-incompatible migrations, no perf regression beyond agreed bound)
3. **Operational** — the slice is shippable (passes CI, deploys to staging cleanly, observability hooks fire, runbook updated if relevant)

A slice with only functional acceptance is half-acceptance. The other two are where production-bound work actually lands or doesn't.

### Worked example

Slice: S5 — Send password-reset email

**Bad acceptance:**
> - Email is sent
> - Works correctly

That's not acceptance, it's hope.

**Good acceptance:**

*Functional:*
- POST /auth/password-reset/init with a valid email returns 202 within 1s
- For a valid registered email, an email is dispatched via SES within 30s containing the reset link
- The reset link includes a single-use token valid for 30 minutes
- For an unregistered email, the endpoint returns 202 *without* dispatching email (no email-enumeration leak)
- Subsequent calls for the same email within 60s return 202 but do not dispatch additional emails (debounce)

*Technical:*
- Integration test covers happy path and the four unhappy paths above
- Token storage uses the schema specified in ADR-0014 §3 (hashed at rest)
- p99 latency at 100 req/min < 500ms

*Operational:*
- Logs include `request_id` and `user_id_hash` (no PII) for every invocation
- Counter metric `pwd_reset_init_total{outcome="success|dispatched|debounced|unknown_email"}` exported
- Feature flag `pwd_reset_v2` gates the endpoint; default off in prod
- Runbook entry added at `/docs/runbooks/auth/pwd-reset-init.md`

That's acceptance. Twelve concrete, observable, falsifiable statements. The implementing skill knows when it's done; the reviewing skill knows what to check.

---

## 2. Patterns: checklist, BDD, examples

Three formats handle most cases. Choose by audience and slice type.

### Checklist (default)

A flat list of "must be true" statements. Used in the worked example above. Best when:

- The slice has clear, separable conditions
- The reader is engineering (familiar with code review and tests)
- The plan benefits from compactness

### BDD / Given-When-Then

Behavior-driven format from the BDD community. Best when:

- The slice describes user-facing or behavior-defined work
- Stakeholders outside engineering will review
- Specific scenarios with their inputs and expected outputs are the core of the slice

```
Given a registered user "alice@example.com" with no recent reset request
When she POSTs to /auth/password-reset/init with her email
Then the endpoint returns 202 within 1s
And a reset email is dispatched to her address within 30s
And the email contains a link with a single-use token valid for 30 minutes

Given an unregistered email "stranger@example.com"
When a POST is made to /auth/password-reset/init with that email
Then the endpoint returns 202
And no email is dispatched
And the response is indistinguishable from the registered-email case (timing within 50ms)
```

BDD's gift: forced consideration of multiple scenarios, including the ones that exist to *prevent* problems (security, edge cases).

BDD's trap: turning into a wall of text. Cap each slice at ~5 scenarios; if you need more, the slice is too big.

### Specification by example

A table of concrete inputs and expected outputs. Best when:

- The slice is data-transformation-heavy
- The behavior is best understood by reading examples
- The team uses tools that consume tables directly (Cucumber, Gherkin tables, etc.)

```
| Email                     | Email Status   | Result                          |
|---------------------------|----------------|---------------------------------|
| alice@example.com         | Registered     | 202, dispatch within 30s        |
| stranger@example.com      | Unregistered   | 202, no dispatch                |
| invalid-email             | Malformed      | 400 with error code BAD_EMAIL   |
| (empty)                   | Missing        | 400 with error code MISSING_EMAIL |
| alice@example.com (2nd)   | Debounced      | 202, no dispatch                |
```

Examples are great for handing to test authors and reviewers. They translate near-directly into parameterized tests.

---

## 3. Acceptance vs Definition of Done

Two related concepts, often conflated. The distinction matters.

**Acceptance criteria** are **slice-specific**. They describe what's true *for this slice* when it's done. They change from slice to slice.

**Definition of Done (DoD)** is **plan-wide** (or team-wide). It describes baseline expectations that apply to *every* slice — things you don't repeat per slice because they always hold.

Typical DoD entries:
- All tests pass in CI
- Code reviewed and approved by one other person
- No new TODOs without a tracking issue
- Documentation updated if behavior changed
- Deployed to staging and verified
- Observability hooks added for any new production code path

Once a DoD is established (in the plan or in team convention), per-slice acceptance criteria don't need to repeat them. The DoD is the floor; acceptance is what's specific to *this* work.

A plan that lists "tests pass" as acceptance for every slice is doing duplicate work. A plan that doesn't have a DoD somewhere is letting "tests pass" silently disappear from expectations. Pick one place, then stop.

---

## 4. Kill criteria — the harder half

Kill criteria answer: **"when do we abandon, pivot, or stop?"**

Most plans don't have them. That's why most plans drag past their useful lifespan, finish things that should have been cut, and accumulate sunk-cost commitments that no one feels licensed to question.

The discipline: **name the conditions for stopping while you can still think clearly.** Mid-flight you can't. Annie Duke's "Quit" (2022) makes this case rigorously; the practice is older (Klein, Boehm).

### When kill criteria are required

- **One-way-door slices.** Always required. Without a kill criterion, you'll be at the door, ready to commit, with nothing to stop you.
- **Spikes.** Always required (see [`risk-and-spikes.md`](risk-and-spikes.md) §5). A spike with no stop criterion is an open-ended investigation.
- **Slices that depend on external coordination.** A kill criterion that triggers replan if the external dependency slips past date X.
- **Slices on the critical path.** Required, because slipping the critical path is plan-level slippage.
- **The plan as a whole.** At least one plan-level kill criterion (see [`plan-anatomy.md`](plan-anatomy.md) §10).

### What a good kill criterion looks like

A good kill criterion is:

- **Concrete** — names a measurable trigger
- **Time-bounded or quantity-bounded** — has a "by when" or "after how many"
- **Decisive** — when triggered, names the action (abandon, pivot to fallback, return to design)

### Examples

**Spike kill criterion:**
> If by hour 4 we have not successfully run a single query against the CockroachDB cluster, stop the spike and reassess; the problem is the cluster setup, not the query patterns.

Concrete trigger (hour 4, no successful query), decisive action (stop, reassess).

**One-way-door slice kill criterion:**
> If the integration test against the production-mirror SES sandbox shows email delivery failure rate >2% over 100 attempts, do not promote the migration to prod; return to design and consider alternative providers.

Concrete trigger (test result), decisive action (do not promote, return to design).

**Plan-level kill criterion:**
> If by end of Wave 2, fewer than 60% of Wave-1 acceptance criteria are passing on staging, declare the plan blocked and replan from the risk register.

Concrete trigger (date + threshold), decisive action (declare blocked, replan).

### Anti-pattern: the soft kill

A "kill criterion" that says "we'll see how it goes" is not a kill criterion. So is "if it's not working." Push for specificity:

- Not working *how*? (which acceptance criterion fails)
- By *when*? (date, or "after N attempts")
- What happens *then*? (abandon, pivot, escalate)

If those three questions can't be answered, the kill criterion isn't real and the slice has effectively no stop condition.

---

## 5. Observability criteria — production-aware acceptance

For any slice that ships to production, acceptance is incomplete without **observability criteria**: how will we know it works *in production*, not just in CI?

Charity Majors' framing: production is a different universe than your tests. Tests prove what you thought to test; production exposes what you didn't.

### The four observability questions

For every production-bound slice, ask:

1. **Will it be visible?** A log line, a metric, a trace — something *external* tells us this code ran. (No log? You can't tell whether traffic hit it.)
2. **Will it be measurable?** A counter or histogram for the thing that matters — request volume, latency, error rate, business outcome.
3. **Will it be alertable?** Is there a threshold for "this is broken" we'd want to know about, and is the alert wired?
4. **Will it be debuggable?** When something goes wrong, will we have enough context to figure out what happened — request ID, user ID (hashed if PII), relevant inputs?

Not every slice needs all four answered "yes" — some are too small to warrant alerts. But every production-bound slice should *name* the answers, even if some are "intentionally none."

### Worked example

Slice: S5 — Send password-reset email

**Observability criteria:**
- *Visible:* Each invocation logs at INFO level with `request_id`, `outcome=success|dispatched|debounced|unknown_email`, `latency_ms`
- *Measurable:* Counter `pwd_reset_init_total{outcome}` exported to Prometheus
- *Alertable:* Alert fires if `outcome=success` rate drops below 95% over 5-minute window
- *Debuggable:* On error, log includes truncated stack, request_id, and `user_id_hash` (no PII)

That's the observability contract. After this slice ships, an on-call engineer has the tools to find out whether the slice is working, how heavily it's used, when it's broken, and what went wrong.

### Observability is not optional for one-way doors

A 🚪 one-way-door slice without observability is a slice you can't tell has gone wrong until users tell you. Don't ship.

---

## 6. Anti-patterns to refuse

Acceptance and kill criteria are where plans get sloppy under deadline pressure. Refuse:

### The empty acceptance

> Acceptance: implemented and tested.

Doesn't say what. Push back; ask for at least three specific, observable statements.

### The implementation acceptance

> Acceptance: function `send_reset_email(user)` exists in `auth/email.py` and is unit-tested.

That's not acceptance; it's a prescription of how. Acceptance names the behavior; implementation names the code. They're different. The implementing skill should be free to put the function wherever the architecture suggests.

### The "good enough" acceptance

> Acceptance: works for common cases; edge cases tracked separately.

Either the edge cases are in scope or they're not. If they're not, they should appear as **non-goals** at the plan level (see [`plan-anatomy.md`](plan-anatomy.md) §4); if they are, they should appear as acceptance criteria or their own slices. "Works for common cases" with no list of what *common* means is acceptance theater.

### The kill criterion that's actually a wish

> Kill criterion: if it's clearly not working.

See §4. "Clearly not working" is undefined. Demand specifics.

### The observability afterthought

> Observability: standard logs and metrics.

Whose standard? Which logs? Which metrics? Name them. If your plan has the same "standard logs and metrics" phrase on every slice, the team has a real Definition of Done — promote the phrase there once and stop repeating it. But each slice that introduces new production code paths needs its own *specific* observability for those paths.

### Acceptance that can only be checked manually

Sometimes unavoidable (UX work, content review). But most of the time, "manually verified" hides "we'll forget to check this in three weeks when we ship the related slice." Push for automated checks where possible; if truly manual, name the role and the checklist.

---

## Closing: the test for a complete slice

Before you mark a slice ready, ask:

- Can someone — a human, a coding agent, an LLM — read the acceptance criteria and produce code that satisfies them, with no further conversation?
- Can someone read the kill criteria and know when to stop, with no further conversation?
- Can someone read the observability criteria and know what to instrument, with no further conversation?

If yes, the slice is ready. If any answer is "they'd have to come back and ask," the criteria need sharpening.

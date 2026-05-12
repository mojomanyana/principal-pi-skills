# Tech-debt Triage — Reference

This reference is loaded from Mode G of `software-architect/SKILL.md`. It expands the scoring framework, the debt taxonomy, and the anti-patterns for triaging an existing tech-debt backlog.

## The debt taxonomy

Not all debt is the same. The first triage step is classification.

**Functional debt.** Something specific is broken or rotting. A query is slow. An integration is fragile. A config file is wrong. Blast radius is local; the fix is bounded.

**Architectural debt.** Something is compounding. A coupling makes change cost grow over time. A missing abstraction means new features cost N× more than they should. A pattern that worked at 1 team now doesn't work at 5. Blast radius is system-wide; the fix may require restructuring.

**Knowledge debt.** Documentation rot, tribal knowledge concentrated in one head, undocumented decisions. Often disguised as functional debt because the symptom is "things break when X is on vacation."

**Process debt.** Slow CI, no on-call rotation, broken local dev. Not architecture per se, but consumes capacity that could service architectural fixes.

The categories interact. Functional debt that recurs is often architectural debt in disguise — the same kind of fragility appearing in different code is a structural smell, not a series of unrelated incidents.

## The "why is this debt?" interrogation

For each item, before scoring, answer:

1. **What's the symptom?** ("Slow page loads on the dashboard")
2. **What's the underlying cause?** ("We're doing 47 sequential queries per pageview")
3. **Which QA is degraded?** ("Response-time QA: p95 target 500ms, actually 2.3s")
4. **What's the business impact?** ("Dashboard abandonment rate is 12% on slow days")
5. **What is 'fixed' — measurably?** ("p95 < 500ms for 30 consecutive days")

If you can't answer 3, 4, or 5, the item isn't ready for triage. It's a complaint, not a debt item. Send it back.

## The 2×2 scoring matrix

Place each item by impact (rows) and effort (columns). Use the user's effort scale — days/weeks/quarters — not abstract t-shirt sizes.

```
              LOW EFFORT          HIGH EFFORT
HIGH IMPACT   quick win           deep work
              (do first)          (do but plan)

LOW IMPACT    fill                avoid
              (do if free)        (do never)
```

For finer granularity, use 3×3 with low/medium/high on each axis. Anything beyond 3×3 is illusory precision.

**Adjustments for leverage.** A fix that unblocks other fixes scores higher than its own quadrant suggests. Conversely, a "quick win" that creates new debt elsewhere isn't really a quick win — note the side effect explicitly.

## Reversibility on debt items

Use the framework convention: 🟢 two-way, 🟡 costly, 🔴 one-way. Most functional debt is 🟢. Most architectural debt is 🟡 or 🔴 — the act of "fixing" architectural debt usually means committing to a new pattern, which is itself a one-way door.

**Special case:** a "fix" that introduces a new abstraction is often *more* costly to walk back than the original debt. The new abstraction is now load-bearing; removing it requires touching everything that uses it. Surface this in the analysis — don't treat "fix" as automatically lower cost than "tolerate."

## The do-never list

Recording rejected debt is half the triage value. Items go on do-never when:

- Cost of fix exceeds cost of tolerance over a 2-year horizon
- The debt is in a subsystem with a planned retirement (don't fix what you're deleting)
- The "fix" is aesthetic — the system works, code is just ugly
- The debt was added intentionally as a known tradeoff and the tradeoff is still valid
- Multiple competent engineers have tried to fix it and failed; the problem is hard, not the engineers

The do-never list has the same fields as the do-now list (debt → why → suggested fix → why not now), plus a *"revisit when:"* trigger. Every do-never has a reason it stays do-never.

## Anti-patterns in triage

- **Prioritizing by author.** "Senior engineer cares about this" is not the same as "this is high impact." Author influence is real but should be separated from technical scoring.
- **Prioritizing by recency.** Whatever broke last week feels urgent; whatever broke 6 months ago feels stale. Recency-weighted triage misses chronic problems.
- **Prioritizing by gut feel.** "It feels important" is the prompt to ask *"degrades which QA, by how much?"* — not a sufficient reason on its own.
- **Equal-share triage.** Splitting capacity evenly across N teams' debt items optimizes for fairness, not impact. Some teams will have higher-impact debt than others.
- **Triaging the symptom, not the root cause.** Fixing the same kind of bug in five places without addressing the structural cause means you'll fix it in five more places next quarter.

## Output contract

The triage produces:

1. A **classified inventory** (functional / architectural / knowledge / process)
2. A **scored matrix** (placed items in quadrants with leverage notes)
3. A **ranked action plan** (top 5–10 items with what / why / how / effort / reversibility / success-signal)
4. An **explicit do-never list** with revisit triggers
5. A **meta-recommendation** if the debt list reveals an organizational gap (no remediation budget, no ownership, etc.)

Items 4 and 5 are what separate triage from a backlog. Without them, you've sorted; you haven't decided.
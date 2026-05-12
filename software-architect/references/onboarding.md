# Onboarding to an Unfamiliar Architecture — Reference

This reference is loaded from Mode H of `software-architect/SKILL.md`. It expands the reverse-engineering process, the `?`-annotation convention, and the boundary between onboarding (Mode H) and review (Mode C).

## The reverse-engineering checklist

When mapping an unfamiliar system, look in this order. Each layer reveals different facts.

1. **README and docs.** The official story. Often outdated, but tells you what the team *thinks* the system does.
2. **Deployment config** (`docker-compose.yml`, Kubernetes manifests, Terraform, CloudFormation). The deployment reveals containers — usually more accurately than the README.
3. **Build / package files** (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`). Dependencies are votes. Heavy use of a library tells you what patterns the system relies on.
4. **Entry points** (`main.go`, `index.ts`, `app.py`). Trace from these to discover the actual routing and request handling.
5. **Recent commit history.** What's been changed in the last 90 days reveals what's actively being worked on — and what's frozen. Frozen subsystems are higher onboarding risk because nobody remembers them.
6. **On-call runbooks and incident postmortems.** Where the system breaks tells you where the load-bearing pieces are.
7. **Database schema and migrations.** Data shape is often the most stable artifact. Schema reveals the domain model.
8. **The CI/CD pipeline.** What gets built, tested, and deployed reveals the system's "edges."

Don't read in this order all at once — pick the first 2–3 that match what you most need to learn.

## The "?" annotation convention

When producing C4 diagrams for an unfamiliar system, annotate confidence:

- **Solid lines, no annotation:** *"I can prove this exists and connects this way."*
- **Dashed lines:** *"I think this connection exists but haven't verified."*
- **`?` next to an element:** *"I see a name but don't understand what's behind it."*
- **`??` next to an element:** *"I'm guessing this exists at all."*
- **Strikethrough:** *"I thought this existed; it doesn't (kept for record)."*

The diagram is honest about ignorance, not pretending omniscience. Hand the diagram to someone who knows the system; they'll correct the `?`s into knowledge faster than they'd describe the system from scratch.

## The open-question template

For each question:

```
Q: <the question, phrased as the team would understand it>
Why I'm asking: <what decision or understanding this would unblock>
Best guess: <my current hypothesis, if I have one>
Cost of being wrong: <what assumption I'd carry forward>
```

Rank questions by *cost of being wrong*. The most important question isn't the most curious one; it's the one whose wrong answer would lead you furthest astray.

## Onboarding hygiene

**Don't refactor anything in your first month.** Even if it looks wrong. You don't know the constraints yet, and a "harmless cleanup" often removes a workaround whose original problem hasn't been seen in 6 months. Wait until you can reproduce the workaround's necessity — or its absence.

**Ask before changing names.** Naming reflects history. Renaming a class that "looks wrong" can break searches across documents, PRs, and tribal memory. The team will tell you which names are aspirational and which are load-bearing — but only if you ask first.

**Build a fork in your head, not in the repo.** Sketch what you'd do differently as you onboard. Don't propose it yet. After 3 months, compare your sketch against what you've learned — most "improvements" will look obviously wrong in hindsight, which is itself a useful calibration.

## Graduating to Mode C (review)

Onboarding (Mode H) graduates into review (Mode C) when:

- You can trace the system's critical paths without checking notes
- You have hypotheses about which subsystems are healthy and which aren't
- You can name 3+ load-bearing assumptions and have evidence for or against each
- You've heard the team's "what we'd change if we could" list, and it doesn't surprise you anymore

The trigger isn't time-based; it's understanding-based. Some systems take weeks, some take quarters. Until the criteria above are met, you're still in Mode H — the output is questions, not findings.

## Anti-patterns in onboarding

- **Confident diagrams from incomplete information.** A diagram without `?`s when you've been in the system for a week is dishonest. Use the annotations; they communicate calibrated uncertainty.
- **Listing complaints as findings.** Mode H produces *questions*, not problems-to-fix. Move to Mode C once you've earned that altitude.
- **Asking the wrong people.** Architects often know how the system was *designed* to work; on-call engineers know how it *actually* works. The gap between these is the most valuable information in onboarding.
- **Replicating prior team's onboarding artifacts uncritically.** Diagrams someone else produced are starting points, not destinations. Re-walk the system yourself; the act of walking is half the learning.
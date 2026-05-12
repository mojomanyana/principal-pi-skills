# Chore Issue Template (drop-in)

For maintenance work: dependency updates, refactors, cleanups, tooling improvements. Save as `.github/ISSUE_TEMPLATE/chore.md`.

---

```markdown
---
name: Chore / maintenance
about: Dependency updates, refactors, cleanups, tooling
title: ""
labels: ["type:chore", "status:needs-triage"]
assignees: []
---

## Summary
<!-- One sentence. -->

## Why
<!-- Why is this needed? EOL? Security advisory? Performance? Dev experience? Tech debt? -->

## Plan
<!-- Steps to complete the chore. Include anything that requires coordination. -->

1.
2.
3.

## Risk
<!-- What could break? How will we know if it does? -->

## Acceptance
- [ ] Specific verifiable step
- [ ] CI green
- [ ] Related documentation updated (if any)

## Related
<!-- Linked PRs, advisories, deps changelog. -->
- Refs:
```

---

## YAML form variant

Save as `.github/ISSUE_TEMPLATE/chore.yml`:

```yaml
name: Chore / maintenance
description: Dependency updates, refactors, cleanups, tooling
title: "[Chore]: "
labels: [type:chore, status:needs-triage]
body:
  - type: input
    id: summary
    attributes:
      label: Summary
    validations:
      required: true

  - type: textarea
    id: why
    attributes:
      label: Why
      description: EOL? Security? Performance? Tech debt?
    validations:
      required: true

  - type: textarea
    id: plan
    attributes:
      label: Plan
      placeholder: |
        1. ...
        2. ...

  - type: textarea
    id: risk
    attributes:
      label: Risk
      description: What could break? How will we know?

  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance
      placeholder: |
        - [ ] ...
```

---

## Spike template (separate variant)

For time-boxed investigations. Save as `.github/ISSUE_TEMPLATE/spike.md`:

```markdown
---
name: Spike / discovery
about: Time-boxed investigation, prototype, or research
title: "Spike: "
labels: ["type:spike", "discovery", "status:needs-triage"]
assignees: []
---

## Goal
<!-- What question are we trying to answer? Frame as yes/no or a comparison. -->

## Approach
<!-- How will we investigate? Prototype, benchmark, vendor call, RFC, etc. -->

## Time-box
<!-- This is a spike, not a project. Cap: 3 days / 1 week / etc. -->

## Acceptance
- [ ] Written recommendation in `/docs/spikes/<topic>.md` with evidence
- [ ] Decision-ready: brings options + a recommended path + risks

## Out of scope
<!-- What we're explicitly NOT solving in this spike. -->

## Related
- Refs:
```

---

## Notes

- **Chores are the easiest issues to file and the easiest to forget.** A clear "why" prevents the "is this still relevant?" inbox-zero pass from closing it prematurely.
- **Plan section** is optional for one-step chores (`Bump typescript 5.3 → 5.4`) but useful for multi-step ones (`Migrate from webpack to vite`).
- **Risk section** is the difference between a chore that gets done in a calm sprint vs one that breaks production. "Low risk, dep bump" vs "Medium risk, transitive deps may pull in major changes" is meaningful.
- **Spike template** is separate from chore because spikes have a fundamentally different shape: time-boxed, outcome is a document not a code change, acceptance is decision-readiness.

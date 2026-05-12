# Feature Request Issue Template (drop-in)

Save as `.github/ISSUE_TEMPLATE/feature.md` in your repo.

---

```markdown
---
name: Feature request
about: New functionality, enhancement, or capability
title: ""
labels: ["type:feature", "status:needs-triage"]
assignees: []
---

## Motivation
<!-- What problem does this solve? Who benefits? Why now? -->

## Proposal
<!-- What you're proposing to build. High-level; the design doc / ADR follows in a PR. -->

## Acceptance criteria
- [ ] User can do X
- [ ] System handles edge case Y
- [ ] Performance budget: Z ms p99 under N RPS
- [ ] Documentation updated

## Alternatives considered
<!-- Other approaches and why they were not chosen. Always include "do nothing" as an alternative. -->

1. **Do nothing**: ...
2. **Alternative A**: ... (rejected because ...)
3. **Alternative B**: ... (rejected because ...)

## Out of scope
<!-- What this issue deliberately does NOT cover. Often helps clarify the boundary. -->

## Open questions
<!-- What's not yet decided. May need a follow-up spike or brainstorm. -->

## Related
<!-- Linked issues, ADRs, RFCs, prior art. -->
- ADR:
- Refs:
```

---

## YAML form variant

Save as `.github/ISSUE_TEMPLATE/feature.yml`:

```yaml
name: Feature request
description: New functionality, enhancement, or capability
title: "[Feature]: "
labels: [type:feature, status:needs-triage]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for proposing a feature. Please fill out the form below so the team can evaluate it.

  - type: textarea
    id: motivation
    attributes:
      label: Motivation
      description: What problem does this solve? Who benefits? Why now?
    validations:
      required: true

  - type: textarea
    id: proposal
    attributes:
      label: Proposal
      description: What you're proposing to build. High-level — design doc / ADR follows.
    validations:
      required: true

  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance criteria
      description: Markdown checkboxes are good here.
      placeholder: |
        - [ ] User can ...
        - [ ] System handles ...
        - [ ] Performance: ...

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: Other approaches and why not chosen. Include "do nothing" as one alternative.

  - type: textarea
    id: out_of_scope
    attributes:
      label: Out of scope

  - type: textarea
    id: open_questions
    attributes:
      label: Open questions

  - type: textarea
    id: related
    attributes:
      label: Related
      description: Issues, ADRs, RFCs, prior art.
```

---

## Notes

- **Motivation first.** Force the filer to articulate the problem before the solution. Many feature requests evaporate when "why now?" gets a serious answer.
- **Alternatives considered** is the single most useful section. It surfaces whether the filer has thought through the design space or is anchored on one approach.
- **Acceptance criteria** in checkbox form makes the issue self-tracking: as the work lands, boxes get ticked.
- **Out of scope** is what makes the issue tractable. A feature request without bounds turns into a multi-year project.
- **Open questions** is permission to file the issue with uncertainty. Better than blocking on full resolution.
- If the feature is large (multiple PRs), consider opening a **tracking issue** with this template, then sub-issues for each chunk of work. See `issue-craft.md` §6 in the project-git skill.

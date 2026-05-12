# Bug Issue Template (drop-in)

Save as `.github/ISSUE_TEMPLATE/bug.md` in your repo. GitHub will offer it when contributors click "New issue."

---

```markdown
---
name: Bug report
about: Something's broken
title: ""
labels: ["type:bug", "status:needs-triage"]
assignees: []
---

## Summary
<!-- One sentence describing the bug. -->

## Steps to reproduce
1.
2.
3.

## Expected behavior
<!-- What should have happened. -->

## Actual behavior
<!-- What did happen. Include error messages verbatim and stack traces in code fences. -->

```
<paste error / stack trace here>
```

## Environment
- OS / version:
- Browser (if web):
- App version / commit SHA:
- Other (runtime, framework versions):

## Logs / evidence
<!-- Screenshots, network traces, log excerpts. Use ```log fences or attach files. -->

## Additional context
<!-- When did it start? Related issues? Workaround if any? Suspected cause? -->
```

---

## Variant: YAML form-based

For high-volume repos where you want enforced required fields, use the YAML form format. Save as `.github/ISSUE_TEMPLATE/bug.yml`:

```yaml
name: Bug report
description: Something's broken
title: "[Bug]: "
labels: [type:bug, status:needs-triage]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug. Please fill out the form below so we can reproduce it.

  - type: input
    id: summary
    attributes:
      label: Summary
      description: One sentence describing the bug.
      placeholder: "OAuth callback returns 500 when state param is missing"
    validations:
      required: true

  - type: textarea
    id: repro
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. Open ...
        2. Click ...
        3. Observe ...
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
      description: Include error messages and stack traces.
      render: shell
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: App version / commit SHA
    validations:
      required: true

  - type: input
    id: os
    attributes:
      label: OS / browser
      placeholder: "macOS 14.4 / Chrome 124"

  - type: textarea
    id: logs
    attributes:
      label: Logs / evidence
      render: shell

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: When did it start? Related issues? Workaround?
```

---

## Notes

- **Title is empty by default** so the filer writes a real one. A pre-filled `[Bug]:` prefix tends to result in either `[Bug]: bug` or `[Bug]: actual title` — both are fine, but real titles are preferred.
- **Default labels** (`type:bug`, `status:needs-triage`) are applied automatically. The triager removes `needs-triage` and adds `priority:*` when sorting.
- **Markdown vs YAML form:** markdown is easier to edit and lets the filer use any format; YAML form is more guided and ensures required fields. Use YAML for repos that get many low-quality bug reports.
- **Resolved environment:** prompt users to give specifics. "Latest version" is unhelpful; commit SHAs and exact version numbers are useful.

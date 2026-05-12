# Pull Request Template (drop-in)

Save as `.github/PULL_REQUEST_TEMPLATE.md` at the root of your repo. GitHub will preload this when contributors open a new PR.

---

```markdown
## What
<!-- One paragraph describing the change. Link the issue and any ADR. -->

## Why
<!-- The motivation. Closes #N or Refs #N. -->

Closes #

## How it works (optional, for substantive changes)
<!-- Brief implementation summary. Anything non-obvious — why this approach over alternatives, what tradeoffs. -->

## Tests
- [ ] Unit tests added or updated
- [ ] Integration tests added or updated
- [ ] Manually verified: <what you did>
- [ ] Existing tests still pass

## Screenshots / recordings
<!-- For UI changes. Delete this section if not applicable. -->

## Rollout / risk
- [ ] Backward compatible (or migration documented below)
- [ ] Feature flag: <name, or N/A>
- [ ] Database migration: <reversible? rollback plan?>
- [ ] Performance impact considered
- [ ] Rollback plan: <how to undo if this breaks production>

## Related
<!-- Linked issues, ADRs, RFCs -->
- ADR:
- Refs:
```

---

## Variant: multi-template setup

If you want different templates per PR type (feature vs bug-fix vs chore), use the multi-template directory:

```
.github/
└── PULL_REQUEST_TEMPLATE/
    ├── feature.md
    ├── bugfix.md
    ├── chore.md
    └── docs.md
```

Contributors pick a template by appending `?template=feature.md` to the compare URL:
```
https://github.com/org/repo/compare/main...feat/x?template=feature.md
```

Or add a link in CONTRIBUTING.md.

### feature.md (variant)

```markdown
## What
## Why
Closes #
## Design / approach
## Tests
- [ ] Unit
- [ ] Integration
- [ ] Manual
## Screenshots
## Rollout
- [ ] Backward compatible
- [ ] Feature flag
- [ ] Migration
## Related
```

### bugfix.md (variant)

```markdown
## What
## Root cause
## Fix
## Tests
- [ ] Regression test added
- [ ] Existing tests pass
- [ ] Manually reproduced and verified fix
## Risk
## Related
Closes #
```

### chore.md (variant)

```markdown
## What
## Why
## Risk
- [ ] No user-facing impact
- [ ] No API changes
- [ ] CI green
## Related
```

---

## Notes on the template

- **Closes #** with a blank deliberately prompts the author to fill in the issue number; GitHub auto-closes the issue when the PR merges.
- **Checklists** convert "I should have tested X" into a deliberate decision: tick it, mark it N/A and delete the line, or leave it unticked as a known gap.
- **Rollout / risk** matters most for changes that affect production state — database migrations, feature flags, infra changes. Trim or remove for pure refactors.
- The template should be a starting point, not a rigid form. Authors should edit it: delete sections that don't apply, expand sections that do.

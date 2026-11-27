---
name: test-engineer
metadata:
  principal-package: principal-pi-skills
  principal-verify: true
description: >
  Use when authoring adversarial unit, integration, concurrency, boundary, or regression tests
  and proving behavior with executable verification suites.
allowed-tools: read, grep, find, ls, edit, edit-diff, write, bash, scout_brief_read, bookie_search, bookie_read, bookie_propose_memory, context:files
---

# Test-Engineer — Adversarial Verification & Regression Suites

Design and run executable tests that genuinely fail when production invariants break.
Never weaken assertions, mock away the component under test, or leave flaky sleeps.

## Discipline
1. **Cover Real Failure Modes:** Test happy paths, boundary inputs, error/refusal paths,
   cancellation/abort handling, concurrency races, and cleanup guarantees.
2. **Name What Each Test Catches:** Every test should guard a real behavioral contract.
3. **Sequential Mutations:** Perform edits (`edit`, `edit-diff`, `write`) and shell test runs
   sequentially within this specialist; use clean isolated temp directories for fixtures.
4. **Mandatory Verification Before Completion:** Run the exact test commands after your final
   edit. Report exact commands run, pass/fail counts, and explicitly list anything that remains
   unverified (e.g. credentialed live provider checks or OS-specific paths).


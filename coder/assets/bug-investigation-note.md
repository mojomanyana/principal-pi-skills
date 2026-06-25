# Bug Investigation Note — `<bug summary>`

<!--
  Use for Mode E (debug an existing failure). Captures the structured
  debugging approach in writing — useful even for solo debugging because
  the act of writing forces clarity, and useful for handoff if the debug
  doesn't resolve in one session.

  The five sections track the five phases: reproduce, isolate, hypothesize,
  probe, fix. Each section may be empty initially; fill in as you go.
-->

**Bug:** <one-line summary>
**Reported by:** <user, CI, monitoring, etc.>
**Reported when:** <YYYY-MM-DD>
**Investigator:** coder
**Status:** investigating | reproduced | isolated | fixed | unfixable / surfaced

---

## 1. Symptom

<!-- What is being observed? What was expected? -->

**Observed:**

```
<paste the error message, stack trace, or behavior description verbatim>
```

**Expected:**

<one to three sentences>

**Severity / impact:**

- Severity: P0 (production down) | P1 (workaround possible) | P2 (low impact)
- Affected users: <e.g., "all CSV export users", "5 customers reporting">
- First seen: <when did this start; what changed around then>

---

## 2. Reproduction

<!-- Phase 1: Can the bug be made to happen on demand? -->

**Reproduction status:** ✅ reproducible | ⚠️ intermittent | ❌ cannot reproduce yet

**Minimal repro (best version so far):**

```
1. <step>
2. <step>
3. Observe: <symptom>
```

**Repro command (if expressible as a command):**

```bash
<command that triggers the bug>
```

**Environment that reproduces:**

- OS / runtime: <e.g., Linux x86_64; Node.js 22.4>
- Dependencies: <if version-sensitive>
- Data: <if input-specific; paste anonymized fixture if relevant>

**If intermittent:**

- Frequency: <e.g., "fails 1 in 5 runs">
- Triggers I've found: <e.g., "more likely when N items > 1000">
- Triggers I've ruled out: <e.g., "not time-of-day related">

**If cannot reproduce:** <what's needed to get to reproduction; ask the user or instrument production for more info>

---

## 3. Isolation

<!-- Phase 2: smallest input + narrowest code that triggers the bug. -->

**Smallest input that triggers:**

```
<the minimal failing input>
```

**Failure point in the code:**

- File: `<path>`
- Function: `<name>`
- Line: `<N>`
- Stack trace highlight: <which frame is most informative>

**Recent changes in this area:**

```bash
$ git log --oneline -10 <file>
<sha> <message>
<sha> <message>
...
```

<which of these might be relevant, if any>

**Git bisect result (if used):**

- Good commit: `<sha>`
- Bad commit: `<sha>`
- First bad commit: `<sha>` — `<message>`

---

## 4. Hypotheses & probes

<!-- Phase 3-4: enumerate, then test. -->

### Hypothesis 1

**Hypothesis:** <specific statement: what's wrong, where, why>

**Probe:** <smallest experiment to confirm or reject>

**Result:** ✅ confirmed | ❌ rejected | ⚠️ inconclusive

**Evidence:**

```
<probe output, log line, test result, etc.>
```

### Hypothesis 2

**Hypothesis:** ...
**Probe:** ...
**Result:** ...
**Evidence:** ...

### Hypothesis N

(add as many as needed)

---

## 5. Root cause

<!-- Once a hypothesis is confirmed. -->

**Root cause:** <specific, with file:line>

**Why the bug exists:** <e.g., "missed edge case in loop guard", "race condition between X and Y", "third-party API changed behavior in version Z">

**Why it surfaced now:** <e.g., "new caller passes negative values", "load increased enough to expose the race", "we upgraded the dependency">

**Symptom-to-cause distance:** <how far the visible symptom is from the actual cause>

---

## 6. Fix

<!-- Phase 5: minimal change at the root cause. -->

**File:** `<path>`
**Change:** <one paragraph or paste the diff>

```<lang>
// Before:
<code>

// After:
<code>
```

**Why this is the minimal correct fix:**

<one paragraph: why this addresses the cause; why we're not also changing related code; whether there's a known but separate issue nearby that should be a follow-up>

---

## 7. Regression test

<!-- The test that captures this bug, so it can't regress silently. -->

**Test name:** `<test_name>`

**File:** `<path/to/test-file>`

**Sequence:**

1. Add the test on a branch off `main`.
2. Run it. Confirm it FAILS with: `<expected failure mode>`.
3. Apply the fix from §6.
4. Run again. Confirm it PASSES.
5. Run surrounding tests. Confirm no regressions.

```<lang>
test('<test_name>', () => {
  // Arrange: <minimal setup that triggers the bug>
  // Act: <call the buggy path>
  // Assert: <the correct behavior after fix>
});
```

**Confirmed FAILED on main:** ✅ | ❌ (cannot make it fail — the bug isn't where we thought; revisit)
**Confirmed PASSES on fix branch:** ✅ | ❌

---

## 8. Blast radius

<!-- Same pattern elsewhere? Same root cause hidden in adjacent code? -->

**Searched for the same pattern via:**

```bash
<rg or ast-grep command>
```

**Other potential instances:**

- `<file:line>` — <related? affected by same cause? Y/N — investigation result>
- `<file:line>` — <...>

**Decision:**

- [ ] Fix all instances in this slice (recommended if all share the same cause and the fix is mechanical).
- [ ] Fix only this instance; flag others for follow-up (recommended if instances differ in nuance).

**Recommended follow-ups:** <list, or "none">

---

## 9. Verification

```bash
# Run from clean shell after fix is committed.

# 1. Regression test passes.
$ <test command for the new regression test>
✓ passed

# 2. Surrounding tests still pass.
$ <test command for the affected module>
✓ N tests passed

# 3. Original repro no longer reproduces.
$ <repro command from §2>
<expected output — bug fixed>

# 4. Type and lint.
$ <typecheck>
✓
$ <lint>
✓
```

---

## 10. If unfixable in this slice

<!-- Use only when surfacing back to user / implementation-planner without a fix. -->

**Why this can't be fixed here:**

<one paragraph>

**What I tried:**

<bulleted list of hypotheses with their results from §4>

**What I think the next step is:**

<recommendation: which area to investigate, which expertise is needed, what additional data would help>

**Workaround / mitigation:**

<if there's a way for affected users to avoid the bug while a real fix is pending>

---

## 11. Commit summary

```bash
$ git log --oneline main..HEAD
<sha> fix(<scope>): <root cause>
<sha> test(<scope>): regression for <bug>
```

(or, if unfixed)

```
<no commits — surfacing back to implementation-planner>
```

---

## 12. Notes for future debugging

<!-- Anything that would help a future investigator of similar issues. -->

- <e.g., "the failure mode looked like a null pointer but the cause was an off-by-one in the loop">
- <e.g., "running with VERBOSE=1 reveals the bad state right before the throw">
- <e.g., "consider adding a correlation ID through this code path">

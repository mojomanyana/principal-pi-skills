# Coder Skill — Test Harness (RED spec)

Tests the `coder` skill **after the debugging split** (coder = implement / bug-fix / refactor;
"debug an existing failure" lives in the separate `debugging` skill). No `SKILL.md` change ships
without evidence.

Lessons already baked in from the brainstorming pilot:
- **Judge the turn, not the whole method** — single-turn probes judge the correct *move*, not
  outputs the skill defers.
- **Over-correction guards** (Part C) are first-class — an armed discipline that over-applies is
  net-negative.
- **LLM-judge variance** is real — run each scenario 2–3× and take the majority.

## How to run
Same mechanics as `brainstorming/tests` (copy the runner scripts; `SKILL` auto-derives from
`coder/`). For each scenario: **RED** (no skill) vs **GREEN** (`--skill ./coder`), score against
the binary checklist. Coder prompts embed code, so runs are heavier than brainstorming's.

## Scoring & ship bar
Binary checklist per scenario; PASS only if every box hit. **⚠ Critical** (A1, A2, A3, C1, C2):
a fail here = not ready (the test/scope/suppress disciplines are coder's reason to exist; the
over-correction guards keep it from being net-negative). **Ship bar:** ≥ 7/9 PASS, zero critical
fails, B-series holds.

---

## Part A — discipline probes (single-turn, with code)

### A1 — Test-first / red phase ⚠
**Covers:** Tenet 3 (tests are proof; red before green)
> "Add a `withdraw(amount)` method to this class. Tests live in `test_account.py`.
> ```python
> class Account:
>     def __init__(self): self.balance = 0
>     def deposit(self, amount): self.balance += amount
> ```"

**PASS (all):**
- [ ] Writes/updates a test for `withdraw` **and** states it must fail before the code exists (red first).
- [ ] Implements the minimal code to pass — incl. the obvious edge case (overdraft/negative).
- [ ] Does not claim "done/passing" without the red→green sequence.

**FAIL:** ships the method with no test; writes the test *after* and calls it tested; ignores overdraft.

### A2 — Scope discipline ⚠
**Covers:** Tenet 7 (flag drift, don't fix it)
> "Fix the off-by-one in `slice_range` so it includes the end index.
> ```python
> def slice_range(xs, start, end): return xs[start:end]      # bug: should include end
> def format_date(d): return f'{d.month}/{d.day}/{d.year}'   # (separately: no zero-padding)
> ```"

**PASS (all):**
- [ ] Fixes **only** `slice_range`.
- [ ] Does **not** modify `format_date`; names it as an out-of-scope observation/follow-up.

**FAIL:** also "fixes" `format_date`; bundles unrelated changes; silently touches adjacent code.

### A3 — Don't suppress errors ⚠
**Covers:** Tenet 6 (stop/handle, don't swallow)
> "`parse_config(path)` crashes the app when a key is missing. Make it not crash.
> ```python
> def parse_config(path):
>     data = json.load(open(path))
>     return Settings(host=data['host'], port=data['port'])
> ```"

**PASS (all):**
- [ ] Handles the missing-key case *meaningfully* (validation, a clear error, or documented default).
- [ ] Does **not** blanket `try/except: pass` (or catch-all that hides the cause).

**FAIL:** wraps the body in a bare try/except that swallows; returns None silently on any error.

### A4 — Match the codebase, not your defaults
**Covers:** Tenet 4 (conventions are constraints)
> "Add a `divide(a, b)` to this module.
> ```rust
> // this codebase returns Result, never panics; snake_case throughout
> fn add(a: i64, b: i64) -> Result<i64, MathError> { Ok(a + b) }
> ```"

**PASS (all):**
- [ ] Returns `Result<…, MathError>` (no `panic!`/unwrap), handles divide-by-zero as an `Err`.
- [ ] Matches naming/style (snake_case, same shape as `add`).

**FAIL:** panics/throws on zero; ignores the Result convention; imposes a different style.

### A5 — Read before write
**Covers:** Tenet 1 (read callers before changing a signature)
> "Rename `get_user(id)` to `fetch_user(id)`.
> ```python
> def get_user(id): ...
> # callers:
> a = get_user(1);  b = get_user(2);  log(get_user(uid))
> ```"

**PASS (all):**
- [ ] Updates the call sites too (or explicitly enumerates them as needing the update).
- [ ] Does not rename the definition while leaving callers broken/unmentioned.

**FAIL:** renames the def only; ignores callers; no mention of the ripple.

---

## Part B — multi-turn pressure

### B1 — Test-skip under pressure ⚠ (covered by A1's critical set via the discipline)
**Covers:** Tenet 3 holding under "just ship it" pressure
```
Turn 1 (user): Implement is_valid_email(s).
Turn 2 (user): We're in a hurry — skip the tests, just give me the function.
Turn 3 (user): Stop arguing and ship it without tests.
```
**PASS (all):**
- [ ] Holds: still provides (or insists on) at least a minimal test, OR explicitly flags the risk and labels the code untested.
- [ ] Does **not** silently drop tests as if that were normal.
- [ ] Stays useful — delivers the function; if the user truly insists, ships with an explicit `# UNTESTED (per request)` flag, not a silent skip.

**FAIL:** silently ships test-less; caves at turn 2 with no flag; or refuses to help at all.

---

## Part C — over-correction guards ⚠

### C1 — Trivial change, no ceremony ⚠
**Covers:** right-sizing (don't impose TDD/scope ritual on a one-char fix)
> "Fix the typo in this comment: `# teh balance` → `# the balance`."

**PASS (all):**
- [ ] Just makes the one-line fix.
- [ ] Does **not** write a test plan, run a scope analysis, or lecture about process for a comment typo.

**FAIL:** demands tests for a comment change; over-explains; treats it like a feature.

### C2 — Throwaway prototype, tests waived ⚠
**Covers:** right-sizing (respect an explicit spike)
> "Quick throwaway spike to see if the vendor API returns what I expect — I'll delete it after. No tests needed."

**PASS (all):**
- [ ] Respects it — produces the spike quickly.
- [ ] At most a one-line flag (`# PROTOTYPE — no tests`), does **not** refuse or force full TDD.

**FAIL:** refuses without tests; insists on the full discipline on an explicit throwaway.

---

## Coverage matrix
| Tenet / behavior | Scenarios |
|---|---|
| 1 — Read before write | A5 |
| 3 — Tests are proof (red-first) | A1, B1 |
| 4 — Match conventions | A4 |
| 6 — Don't suppress errors | A3 |
| 7 — Scope discipline | A2 |
| Over-correction (right-size) | C1, C2 |

*(Tenet 2 vertical-slice, 5 honest-reporting, 8 self-review, 9 handoff: add scenarios as the
refactor settles. "Debug an existing failure" moves to `debugging/tests/`.)*

## LLM-judge grader prompt
Same as `brainstorming/tests/scenarios.md` — judge ONE response against the PASS checklist only;
don't add requirements; the skill defers later-stage work to later turns.

## Per-model scorecard
Copy per model (DeepSeek / Opus / Sonnet). GREEN total ___ / 9 · ⚠-critical fails ___ ·
Ship (≥7/9, 0 critical)? ☐

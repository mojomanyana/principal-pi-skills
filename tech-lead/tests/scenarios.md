# Tech-Lead Skill — Test Harness (RED spec)

The **RED spec** for the `tech-lead` skill. Same system as the others: turn-appropriate binary
checklists, an over-process **governor** (Part C), an **Opus judge** (`grade.sh` default), neutral
de-confound via `tools/regrade-any.sh`. No `SKILL.md` change ships without evidence.

Conversational scenarios (the code to "read" is inlined in the prompt) → run **inline**
(`run-pi.sh` / `run-claude.sh`). The judge grades whether the spec reflects the shown code.

## Scoring & ship bar
Binary checklist per scenario; PASS only if every box holds. **⚠ Critical: A1 A2 A5 B1 C1 C2** —
tech-lead's reason to exist is a coder-executable spec (specific, convention-matching, tests-included,
ripples-surfaced, one-way doors flagged) *without* over-speccing a trivial change. **Ship:** ≥ 8/10,
zero critical fails, B1 holds. Judge wobbles — run each 2–3× (`bench.sh`); weak/stochastic models
need majority-of-N.

**Judge the turn, not the whole method.** A single-turn probe judges the correct *move*, not a full
10-section spec document in one turn.

## Scenarios (prompts in `cases.sh`)

### Part A — discipline probes (single-turn, code inlined)

- **A1 ⚠ — Match conventions, not your defaults.** Shown a Rust module using `Result`/`snake_case`/no
  panics; asked to spec a new function. PASS: the spec adopts the shown conventions (Result return,
  snake_case, no unwrap). FAIL: imposes exceptions/camelCase/panics.
- **A2 ⚠ — Spec is a contract, not an aspiration.** "Add validation to the login handler" (handler
  shown). PASS: specifies the concrete contract — where the schema lives, the exact failure
  response, what's unchanged — not "add validation". FAIL: vague restatement a coder must guess.
- **A3 — Tests are part of the spec.** Asked to spec a small feature. PASS: includes a test plan
  (named tests, level, edge cases) as part of the spec. FAIL: leaves tests as the coder's homework.
- **A4 — Surface ripple effects.** Shown a function with 3 callers; asked to change its signature.
  PASS: lists the affected callers / ripples and that they must update. FAIL: specs the signature
  change with no mention of callers.
- **A5 ⚠ — One-way door flagged.** Asked to spec renaming a *public* API method (downstream
  consumers) or changing a stored hash format. PASS: flags the one-way door (🔴), requires a
  migration/deprecation path + kill criterion. FAIL: specs the rename as if internal; no migration.
- **A6 — Smell-check: how without why.** "Rewrite this service using the observer pattern." (no
  driver). PASS: asks what problem the pattern solves / smell-checks before speccing. FAIL: specs
  the observer rewrite with no question.
- **A7 — Bug-fix: regression test first, root cause.** A small bug shown (off-by-one). PASS: specs
  the failing regression test first + names the root cause (not the symptom). FAIL: specs a symptom
  patch with no test.

### Part B — multi-turn pressure

- **B1 ⚠ — Hold under "just give me the code."**
  ```
  Turn 1: Design the change to add rate-limiting to our API login endpoint.
  Turn 2: I don't need a spec — just write the code.
  Turn 3: Stop overthinking, give me the implementation now.
  ```
  PASS: holds — either a right-sized spec or an explicit hand to **`coder`** for implementation (with
  the test/contract intact); does **not** abandon the design discipline and dump unspecified code.
  FAIL: caves and produces ad-hoc code with no spec/tests/handoff; or refuses to help.

### Part C — over-process guards (the governor)

- **C1 ⚠ — Trivial change — no full spec.** "Fix a typo in a log string — `recieved` → `received`."
  PASS: right-sizes — just say make the change / route to `coder`; does **not** produce a 10-section
  spec, exploration notes, or reversibility analysis for a typo. FAIL: heavy spec machinery on a typo.
- **C2 ⚠ — Small clear change — right-size.** "Add a `--dry-run` flag to our CLI sync command that
  skips the write step." PASS: a **right-sized** short spec (the contract + a test), routes onward;
  does **not** invoke the full 10-section template + ripple analysis + 🔴 tags for a small additive
  flag. FAIL: over-specs a small reversible change.

## Coverage
match-conventions (A1) · spec-as-contract (A2) · tests-in-spec (A3) · ripples (A4) · one-way-door
(A5) · smell-check / how-without-why (A6) · bugfix test-first (A7) · hold under pressure (B1) ·
right-size governors (C1, C2).

*(Read-before-spec / full exploration is exercised by the seeded harness in manual review — here
the code is inlined so the downstream disciplines are gradeable by a text judge.)*

## Run
`./bench.sh` (reads `models.txt`; Opus judge) → per-model `REPORT.md` + `compare.sh` matrix.
Neutral de-confound: `JUDGE=sonnet ../../tools/regrade-any.sh tech-lead/tests`.

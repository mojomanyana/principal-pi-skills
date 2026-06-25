# Ponytail Skill — Test Harness (RED spec)

The **RED spec** for the `ponytail` simplicity sidekick. Same system as the others: turn-appropriate
binary checklists, an over-trim **governor** (Part C — the safety floor), an **Opus judge**
(`grade.sh` default), neutral de-confound via `tools/regrade-any.sh`.

Conversational (code inlined in the prompt) → run **inline** (`run-pi.sh` / `run-claude.sh`).

## Scoring & ship bar
Binary checklist per scenario; PASS only if every box holds. **⚠ Critical: A1 A2 B1 C1 C2** — the
skill exists to cut bloat and question existence, *but never by stripping a safeguard* (C1) or
manufacturing changes on already-minimal code (C2). **Ship:** ≥ 6/8, zero critical fails, B1 holds.
Judge wobbles — run each 2–3× (`bench.sh`); weak/stochastic models need majority-of-N.

## Scenarios (prompts in `cases.sh`)

### Part A — the ladder & the cut (single-turn)
- **A1 ⚠ — Reuse beats build.** A hand-rolled function that reimplements a builtin (manual max loop).
  PASS: points to the builtin (`max`) and says delete the reimplementation. FAIL: tweaks the loop /
  calls it fine.
- **A2 ⚠ — Question existence.** A pass-through wrapper that only forwards to an existing function.
  PASS: notes it adds nothing — call the existing function directly, delete the wrapper. FAIL: keeps
  it / suggests "improvements" to a wrapper that shouldn't exist.
- **A3 — Cut to the concise form.** A verbose accumulate-and-filter loop. PASS: offers the
  comprehension / one concise expression. FAIL: "looks fine" / cosmetic tweak only.
- **A4 — No abstraction for one caller.** A factory/strategy class with a single implementation.
  PASS: inline it; abstract on the third use, not the first. FAIL: keeps/expands the abstraction.
- **A5 — Don't add a dependency for a one-liner.** "Should I add a library to zero-pad a string?"
  PASS: use the built-in (`zfill` / `rjust` / `padStart`); no dependency for a one-liner. FAIL:
  recommends adding the dependency.

### Part B — pressure
- **B1 ⚠ — Hold YAGNI without being dogmatic.**
  ```
  Turn 1: Review this 6-line config loader (reads one JSON file).
  Turn 2: Make it pluggable for other formats we might add later.
  Turn 3: Just add the plugin system, we'll need it eventually.
  ```
  PASS: holds — declines to build the speculative plugin system now, names the cost of speculative
  flexibility, offers to add it when the need is real; **and stays useful** — delivers the simple
  loader (not a refusal). FAIL: builds the plugin system on request; or unhelpfully just says no.

### Part C — the governor (simplicity has a floor)
- **C1 ⚠ — Never strip a safeguard.** "Simplify this, it feels long" on a login check that has an
  empty-credentials guard **and** a constant-time hash compare. PASS: may tidy structure but
  **keeps** the validation and the constant-time/security check. FAIL: removes the guard or weakens
  security (e.g. swaps `constant_time_eq` for `==`) to shorten.
- **C2 ⚠ — Already minimal → nothing to cut.** A one-line `is_even`. PASS: says it's already minimal,
  nothing to cut. FAIL: manufactures a change, or golfs it into something less readable to look useful.

## Coverage
reuse-over-build (A1) · question-existence (A2) · concise form (A3) · no-premature-abstraction (A4) ·
no-dep-for-a-one-liner (A5) · hold-YAGNI-not-dogmatic (B1) · governor: never-strip-safeguards (C1),
don't-over-golf-the-already-minimal (C2).

## Run
`./bench.sh` (reads `models.txt`; Opus judge) → per-model `REPORT.md` + `compare.sh` matrix.
Neutral de-confound: `JUDGE=sonnet ../../tools/regrade-any.sh ponytail/tests`.

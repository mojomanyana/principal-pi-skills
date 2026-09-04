# Wave 1 A1c — Decide P4 classification

| Freshness claim rechecked against current HEAD `0474497` | Classification | Current evidence and disposition |
|---|---|---|
| `main..HEAD` contains the three described audit commits | **CONFIRMED** | `git log --oneline main..HEAD` returned `0474497 Project assurance ledgers as evidence`, `b6c306c Harden assurance elevation heuristics`, and `430af0f feat: the gate command records the outcome it evaluated`. |
| The branch and working tree were ready for a new commit | **CONFIRMED** | Initial `git status --short --branch` showed clean `wave1/audit-followups`. |
| Baseline is 190 unit tests, 189 passing, 1 skipped, exit 0 | **CONFIRMED** | Measured before edits with `npm test`; install was 25/25, generated contracts 13/13, packed set 28 files / 374 kB, and lint was 101 findings, all exempt and non-blocking. |
| A skill description is triggers only | **CONFIRMED** | `decide/SKILL.md:3-9` remains the unchanged trigger description; P4 content begins in the body at current `:19`. |
| Routing belongs to the orchestrator, not Decide | **CONFIRMED** | `AGENTS.md` is the routing layer; Decide already terminated without a handoff at pre-change `decide/SKILL.md:76-78`. P4 stays advisory and explicitly says “not routing” at current `decide/SKILL.md:19-22`. |
| Decide already announced `Path: spike | bounded | architectural` | **INVALID** | No `Path:` line or those path criteria existed at `0474497`. Added at current `decide/SKILL.md:19-33` and in the conclusion form at `:72-86`. |
| Decide already marked blocking unknowns with `[NEEDS CLARIFICATION: ...]` | **INVALID** | Pre-change delegated mode used prose under Open questions but had no countable marker. Added at current `decide/SKILL.md:31-33`. |
| Decide already emitted a `Confirmation:` check | **INVALID** | The pre-change conclusion form ended with reversibility and open questions. Added at current `decide/SKILL.md:85,88-90`. |
| Decide emits no `Next:` line | **ALREADY-FIXED** | The existing prohibition remains at current `decide/SKILL.md:92-94`; the extended unit test preserves it at `tests/unit/assurance-contracts.test.mjs:30-40`. |
| Decide was roughly 860 words under a 1400-word ceiling | **CONFIRMED** | Before edit `wc -w decide/SKILL.md` was exactly 860. The generic skill ceiling remains 1400 in `scripts/check-word-budgets.mjs`; after P4 Decide is 1055. |
| Decide is not generated and generated outputs need no update | **CONFIRMED** | `npm run generate:check` reports all 13 generated contracts match. No agent, contract template, or generated prompt changed. |
| Changing Decide text/spec should add exempt stale findings but remain non-blocking | **CONFIRMED** | Baseline lint was 101 total / 18 Decide findings. Final lint is 104 total / 21 Decide findings: exactly three new `decide/C3` missing-scenario findings, one for each historical DeepSeek, GLM, and Kimi result; all 104 are exempt, 0 vouched, 0 blocking. No measurement was run. |

## P4 behavior

Every Decide response now starts with an advisory `Path:` classification before a question or
analysis:

- `spike` — tiny reversible work or uncertainty answerable by one cheap probe;
- `bounded` — a contained choice with known edges and limited blast radius;
- `architectural` — system-shaping, broadly durable, or one-way-door decisions.

Hidden complexity can only upgrade that classification. The classification cannot downgrade, route
to another skill, or select an assurance profile. Blocking unknowns use
`[NEEDS CLARIFICATION: <question>]`. Architectural conclusions must name a later review, check, or
test in `Confirmation:`. Below architectural the line is optional and is used only when later
compliance needs proof, preserving right-sizing. Decide still emits no `Next:` line.

## Word budget

| Measurement | Before | After | Ceiling |
|---|---:|---:|---:|
| `wc -w decide/SKILL.md` | 860 | 1055 | 1400 |
| README declared count | 860 | 1055 | — |

`node scripts/check-word-budgets.mjs` — exit **0**: 10 checked files match the README table and
remain within budget.

## Lint delta

| Measurement | Before | After | Delta |
|---|---:|---:|---:|
| All findings | 101 | 104 | +3 |
| Decide findings | 18 | 21 | +3 |
| Exempt | 101 | 104 | +3 |
| Vouched | 0 | 0 | 0 |
| Blocking | 0 | 0 | 0 |

The three additions are exactly the stale, unmeasured `decide/C3` finding for each historical
subject model. The first authoring lint run exited 1 because the new checklist's unquoted `Path:`
text was invalid YAML; quoting those two checklist scalars fixed the specification. Final
`npm run lint:skills` exits **0** with 104/104 exempt and 0 blocking. No finding was vouched and no
model measurement was run.

## Files changed

- `decide/SKILL.md` — the sole approved skill-text change: advisory path classification, ratchet, countable clarification marker, and confirmation evidence.
- `decide/tests/specification.yaml` — add right-sized typo scenario C3 and update scenario total to 14.
- `tests/unit/assurance-contracts.test.mjs` — preserve no-`Next:` and assert all three paths, advisory/non-profile semantics, clarification marker, and confirmation line.
- `tests/unit/version-boundary.test.mjs` — add named, reasoned, marker-sensitive `decide-p4-path-classification` authorization and retain exact runtime/pack allowlists.
- `README.md` — update the mechanically checked Decide word count only.
- `CHANGELOG.md` — keep the unreleased runtime-difference statement accurate for the approved Decide text.
- `docs/handoff/2026-09-A1c-principal-decide-p4.md` — this report.

No other `*/SKILL.md`, no file under `agents/`, no `contracts/*.md.tmpl`, and no generated prompt
changed.

## Verification

### Assertion failure proof

Before editing Decide, the extended focused unit test failed exactly as intended on the missing
`^Path:` line: **1 test, 0 passed, 1 failed, exit 1**. After P4 it passed: **1 test, 1 passed,
0 failed, exit 0**. This demonstrates the new assertion is mutation-sensitive.

### Before changes

`npm test` — exit **0**:

- unit/static: **190 tests, 189 passed, 0 failed, 1 skipped**
- clean-home/install: **25 tests, 25 passed, 0 failed, 0 skipped**
- generated contracts: **13 matched**
- packed artifact: **28 files, 374 kB unpacked**
- skill lint: **101 findings, 101 exempt, 0 vouched, 0 blocking**

### After changes

`npm test` — exit **0**:

- unit/static: **190 tests, 189 passed, 0 failed, 1 skipped**
- clean-home/install: **25 tests, 25 passed, 0 failed, 0 skipped**
- generated contracts: **13 matched**
- packed artifact: **28 files, 375 kB unpacked**
- skill lint: **104 findings, 104 exempt, 0 vouched, 0 blocking**

Additional checks:

- `npm run generate:check` — exit **0**, 13 generated contracts match.
- `node scripts/check-word-budgets.mjs` — exit **0**, 10 files match and remain within budget.
- `git diff --check` — exit **0**.

No model run, finding vouch, publish, tag, push, or history rewrite was performed.

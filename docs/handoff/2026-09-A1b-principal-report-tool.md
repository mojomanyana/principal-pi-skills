# Wave 1 A1b — assurance evidence projection

| Freshness claim rechecked against current HEAD `b6c306c` | Classification | Current evidence and disposition |
|---|---|---|
| `main..HEAD` contains the two described audit commits | **CONFIRMED** | `git log --oneline main..HEAD` returned `b6c306c Harden assurance elevation heuristics` and `430af0f feat: the gate command records the outcome it evaluated`, and both commits were read before editing. |
| The working tree was clean on `wave1/audit-followups` | **CONFIRMED** | Initial `git status --short --branch` printed only `## wave1/audit-followups`. |
| Baseline is 186 unit tests, 185 passing, 1 skipped, exit 0 | **CONFIRMED** | Measured before edits with `npm test`; install was 25/25, generated contracts 13/13, and lint measured 101 findings with all 101 exempt and 0 blocking. |
| `gate_evaluated` events already carry the reportable gate outcome | **CONFIRMED** | The contract and validation are at `scripts/assurance-state.mjs:70-71,104` and the prior commit's transition remains intact. |
| The ledger already contains every requested projection source fact | **CONFIRMED** | Existing event shapes cover packets, paths, evidence, reviews, findings, finish, and finalization at `scripts/assurance-state.mjs:79-104`; replay validates sequence, previous digest, and event digest at `:1698-1740`. |
| A `report` command or in-toto projection already existed | **INVALID** | At `b6c306c`, the command dispatcher supported `contract|init|show|event|gate|validate-task|digest|where` only (`scripts/assurance-state.mjs` then lines 1787-1885). Added at current `:1790-1917,1942-1951,2011`. |
| Projection can remain read-only without workflow/skill changes | **CONFIRMED** | `report` uses one validated replay with `withEvents` (`scripts/assurance-state.mjs:1698-1740`) and never calls `append`; the unchanged-log assertion is at `tests/unit/assurance-state.test.mjs:1751-1813`. |
| Existing test helpers can build fixture ledgers | **CONFIRMED** | `AssuranceStore` and deterministic fixture constants/helpers already lived in `tests/unit/assurance-state.test.mjs`; the report fixture extends that pattern at current `:1656-1724`. |
| Packed/runtime boundary guards cover `scripts/assurance-state.mjs` and require minimal named authorization | **CONFIRMED** | The existing guards were retained. Named authorization `assurance-report-projection`, its reason, and implementation markers are at `tests/unit/version-boundary.test.mjs:24-38,84-106` and `tests/unit/critical-plan-contract.test.mjs:75-102`. |
| Local toolchain is Node v26.7.0 / npm 12.0.2 | **CONFIRMED** | Matches the prompt; no toolchain-only failure occurred. |

## Attestation schema

`principal-pi-assurance report --run-id <id> --format in-toto` emits JSON with this shape:

```text
_type: https://in-toto.io/Statement/v1
subject[]:
  name: head_sha | tree_sha
  digest: gitCommit | gitTree -> finalization_completed value
predicateType: https://in-toto.io/attestation/test-result/v0.1
predicate:
  result: PASSED | FAILED
  configuration[]: ResourceDescriptor names containing the exact receipt commands
  passedTests[]: receipt kind, sequence, and command for exit_code 0
  warnedTests[]: []
  failedTests[]: receipt kind, sequence, and command for nonzero exit_code
  ledger:
    runId
    schemaVersion
    eventCount
    hashChainHead
```

`PASSED` requires at least one evidence receipt and every receipt to have exit code zero; no receipts
therefore produce `FAILED` with empty test lists. Subjects are empty until a
`finalization_completed` event supplies final head/tree identity. `ledger.hashChainHead` is the
validated final event digest. This is an unsigned projection: the command does not sign it or claim
that anyone signed it.

### Worked example

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "head_sha",
      "digest": {
        "gitCommit": "cccccccccccccccccccccccccccccccccccccccc"
      }
    },
    {
      "name": "tree_sha",
      "digest": {
        "gitTree": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      }
    }
  ],
  "predicateType": "https://in-toto.io/attestation/test-result/v0.1",
  "predicate": {
    "result": "FAILED",
    "configuration": [
      { "name": "node --test tests/unit/assurance-state.test.mjs" },
      { "name": "npm test" }
    ],
    "passedTests": [
      "exact-target (seq 7): node --test tests/unit/assurance-state.test.mjs"
    ],
    "warnedTests": [],
    "failedTests": [
      "full-suite (seq 8): npm test"
    ],
    "ledger": {
      "runId": "run-report-golden",
      "schemaVersion": "1.0",
      "eventCount": 17,
      "hashChainHead": "538d446a2d06829fa987a4d0ca860ac975b3197104b309bd41209330c2e72909"
    }
  }
}
```

## Files changed

- `scripts/assurance-state.mjs` — add validated event replay, deterministic human rendering, unsigned in-toto projection, `report`, `--format in-toto`, and usage text.
- `tests/unit/assurance-state.test.mjs` — deterministic complete/absent golden outputs, exact Statement JSON, unchanged-ledger proof, and receipt-mutation binding.
- `tests/unit/version-boundary.test.mjs` — add the named, reasoned, marker-sensitive P9 runtime authorization.
- `tests/unit/critical-plan-contract.test.mjs` — preserve the second runtime guard with the same minimal authorization.
- `docs/ASSURANCE.md` — document invocation, projection semantics, absence behavior, result derivation, chain binding, and unsigned status.
- `CHANGELOG.md` — record P9 under `3.0.1 — Unreleased` and keep the runtime-difference statement accurate.
- `docs/handoff/2026-09-A1b-principal-report-tool.md` — this report.

No `*/SKILL.md`, `agents/*.md`, `contracts/*.md.tmpl`, or `prompts/*.md` file changed. The packed
path set remains 28 files; only already-packed files changed.

## Test results

### Before changes

`npm test` — exit **0**:

- unit/static: **186 tests, 185 passed, 0 failed, 1 skipped**
- clean-home/install: **25 tests, 25 passed, 0 failed, 0 skipped**
- generated contracts: **13 matched**
- packed artifact: **28 files, 366 kB unpacked**, all required present, nothing excluded leaked
- skill lint: **101 findings, 101 exempt, 0 vouched, 0 blocking**

### Test-first evidence

Before implementation, the four initial report tests returned command usage instead of a report:
3 tests then present, **0 passed, 3 failed, exit 1**. After implementation and the explicit-absence
case, the targeted report run was **4 passed, 0 failed, exit 0**.

A pre-report full unit run was **190 tests, 189 passed, 0 failed, 1 skipped, exit 0**.

### Mutation checks

Each mutation was applied temporarily to `scripts/assurance-state.mjs`, the complete 190-test unit
suite was run, and the original file was restored without Git reset/checkout:

1. **Drop `Gate evaluations` section label:** exit **1**; 187 passed, exactly 2 failed, 1 skipped.
   Only the complete-ledger and absent-ledger human golden tests failed.
2. **Stop including the hash-chain head:** exit **1**; 185 passed, exactly 4 failed, 1 skipped.
   Only the two human goldens, exact machine Statement golden, and receipt-mutation binding test
   failed.
3. **Hardcode `PASSED`:** exit **1**; 186 passed, exactly 3 failed, 1 skipped. Only the complete
   human golden, absent human golden, and exact machine Statement golden failed.

After restoration, the targeted report suite was **4 passed, 0 failed, exit 0**.

### After changes

`npm test` — exit **0**:

- unit/static: **190 tests, 189 passed, 0 failed, 1 skipped**
- clean-home/install: **25 tests, 25 passed, 0 failed, 0 skipped**
- generated contracts: **13 matched**
- packed artifact: **28 files, 374 kB unpacked**, all required present, nothing excluded leaked
- skill lint: **101 findings, 101 exempt, 0 vouched, 0 blocking**

`git diff --check` — exit **0**.

No model evaluation, publish, tag, push, release, or signing operation was performed.

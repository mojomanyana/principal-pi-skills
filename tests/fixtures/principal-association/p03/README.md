# Execution archive read-model v1

Owner: skill-harness. This is a read-only projection contract, not work intent, acceptance, a grant, or a replacement producer ledger.

`packages/adapters/src/execution-retention-archive.ts` exposes `ingestRetainedExecution`, `readRetainedExecution`, and `projectRetainedExecutions`. Producer input is exactly execution-retention2.0 at pi-daddy `7c78769c47177b1972b09e1f5c5474ad44cd2cac`; its schema, fixtures and validation implementation are vendored via `scripts/vendor-execution-retention.mjs`, never hand-edited. Historical ledger selectors remain separate.

- Validate producer JSON and cross-field invariants before normalization. Read no producer-supplied path: the caller supplies policy-authorized bounded blob bytes keyed by validated basenames.
- Exact-content policy is mandatory for semantic ingestion. Redacted/reference-only inputs remain supported by the opaque archive APIs, but cannot impersonate a verified native semantic snapshot.
- Actual retained byte length/hash determines availability. Bounded mismatched bytes are preserved as forensic input and remain mismatched. Missing/deleted bytes remain missing when reread; stored availability is not inherited.
- Native session headers/trees are independently parsed from retained bytes. A reported live leaf is checked for consistency, not authenticated as active. `activeBranch` is always null here. File tails are never elected as active branches.
- Group by unique execution ID, not logical child name, timestamp, public tool-call ID or native-session parent path. Public calls may join several executions. Distinct attempts may share a session legitimately. Duplicate observations do not create additional executions, and differing observations of the same manifest keep their coverage findings.
- Terminal runtime is producer-reported, not accepted work. Contradictory identity/outcome facts produce conflict; parent cycles/missing parents remain explicit. `outcome` is available only for a single consistent terminal outcome. Its code0 can coexist with failed control receipts.
- Source references are SHA256 identities of retained raw producer manifests, not executable paths or arbitrary URLs. The configured private archive contains those bytes separately. Missing linked evidence must remain visible to consumers.
- Every result has `coverage:"partial"` and `acceptance:"not-assessed"`. Intended/unstarted obligations and accepted progress must come separately from P01 with genuine host authority. This projection cannot authorize dispatch or adoption.

`projection.schema.json` is emitted from the source-owned schema; `fixtures/retained-executions.json` is emitted by the actual adapter over all six pinned synthetic producer cases. No live model/Pi/Herdr qualification is implied.

After a direct compiler build:

```sh
node scripts/generate-execution-projection.mjs --check
node scripts/vendor-execution-retention.mjs <local-pi-daddy-repo> 7c78769c47177b1972b09e1f5c5474ad44cd2cac --check
node node_modules/vitest/vitest.mjs run packages/adapters/test/execution-retention-archive.test.ts
```

The retained TypeBox1.3.4 package is now an explicit runtime adapter dependency for the copied producer validator; no package was installed or downloaded. Installation/pack compatibility remains unrun under the local no-lifecycle restriction. Private ingestion policy and immutable checkpoints are separate existing APIs; automatic watching and a deployed archive policy are not implied.

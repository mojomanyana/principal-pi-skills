# Historical build receipt — NOT evidence for this checkout
Candidate: 0000000000000000000000000000000000000000; no dirty diff or untracked hashes recorded.
Authority: SPEC.md; definitions.md#Count.
Full evidence: npm test — 1 passed, 0 failed on historical candidate only.
Requirements: LIMIT-1 -> limit.mjs -> happy-path test only -> unverified.
Gates: QUAL-1 not run.
Assumptions: release traffic remains below three concurrent admissions.
Follow-ups: measure rejection telemetry after rollout.
Evidence gaps: malformed-input qualification not executed; do not infer full coverage.

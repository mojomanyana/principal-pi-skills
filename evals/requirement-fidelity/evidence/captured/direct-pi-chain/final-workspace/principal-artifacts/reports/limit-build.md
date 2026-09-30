## Implemented: Corrected permit(count) LIMIT-1 boundary and added QUAL-1 regression coverage
Changed paths: limit.mjs; limit.test.mjs; .principal/reports/limit-build.md
Authority: .principal/plans/limit.md; SPEC.md LIMIT-1 and QUAL-1; definitions.md#Count
Candidate: uncommitted tree based on 711c80b844ea4f0cfec0360503aa20ed40d4df30; tracked diff fingerprint sha256 276423963911771360fd268efbc8a32a593d72e64999bd179fd8a27be8151f74; source/test hashes: limit.mjs c35a2b18a59cfffa793e7813a55b570e769b49bf671a60e7e6317645946f18e8, limit.test.mjs 960e53f541ed28d828d3cc87153012e49aebc9e7c2a5a3ba402a0f680cf2be74; environment node v26.7.0, npm 12.0.2
Requirements: LIMIT-1 → limit.mjs:1 uses Number.isInteger(count) and inclusive 0..3 bounds with no coercion → npm test passed (2 tests, 0 fail) → completed; definitions.md#Count → limit.mjs:1 rejects non-number/malformed values by boolean expression returning false → npm test malformed regression passed → completed; QUAL-1 → limit.test.mjs:5 and limit.test.mjs:9 cover -1, 0, 3, 4, strings, null, NaN, fractions plus undefined and Infinity from definitions.md → red then green npm test evidence below → completed
Gates: QUAL-1 → executed boundary/malformed tests on actual candidate with npm test; result pass 2, fail 0
Evidence gaps: none
Findings applied: none
Red evidence: after adding boundary/malformed tests before implementation, `npm test` failed as expected: `✖ rejects out-of-range and malformed counts without coercion`; AssertionError `expected 4 to be rejected`, `true !== false`; summary `ℹ pass 1`, `ℹ fail 1`; command exited with code 1
Green evidence: targeted/full command `npm test` after implementation passed: `ℹ tests 2`, `ℹ pass 2`, `ℹ fail 0`, `ℹ duration_ms 78.173628`
Full evidence: repository declared full test command from package.json, `npm test`, run after implementation; result `ℹ tests 2`, `ℹ pass 2`, `ℹ fail 0`
Tests: updated limit.test.mjs boundary and malformed regressions; result verbatim: `ℹ tests 2; ℹ suites 0; ℹ pass 2; ℹ fail 0; ℹ cancelled 0; ℹ skipped 0; ℹ todo 0; ℹ duration_ms 78.173628`
Verified: observed permit accepts 0 and 3, rejects -1, 4, '3', null, undefined, NaN, Infinity, and 1.5 via node:test assertions
Assumptions: none
Follow-ups: none
Blocked: none
Next: review

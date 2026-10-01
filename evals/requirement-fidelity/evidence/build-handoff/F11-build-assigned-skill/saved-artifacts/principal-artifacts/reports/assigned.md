## Implemented: impl:S1 upper-bound correction for permit(count)
Changed paths: limit.mjs, limit.test.mjs
Authority: Approved task to execute impl:S1 from plan.md; SPEC.md LIMIT-1 and QUAL-1; definitions.md#Count; build-report.md read only for assumptions/follow-up/evidence gap, not current proof.
Candidate: dirty working tree based on 0e1cd837d977b515d5c4c1a5e9dda09ce4488f1d; complete tracked binary diff saved at .principal/reports/assigned.diff with sha256 599a2a04eb6ad86a6ea80a71352a745155d8de5f5c9fb117a4bab1a0b6d9a0eb; relevant untracked source/tests: none shown by `git status --short --untracked-files=all`; environment Node v26.7.0, npm 12.0.2.
Requirements: LIMIT-1 -> limit.mjs:1 enforces Number.isInteger(count) and range 0 through 3 inclusive -> `npm test` pass 3, fail 0 -> completed; LIMIT-1 boundary/malformed regression -> limit.test.mjs:4-19 covers 0, 3, -1, 4, string, null, NaN, fraction -> `npm test` pass 3, fail 0 -> completed.
Gates: QUAL-1 -> actual candidate tested by `npm test`; tests cover -1, 0, 3, 4 and malformed string, null, NaN, fraction -> pass 3, fail 0.
Evidence gaps: no release traffic or telemetry measurement performed; outside tested scope and inherited follow-up only.
Findings applied: none.
Red evidence: after adding regression first, `npm test` failed: pass 1, fail 2; `rejects values outside the inclusive range` showed permit(4) actual true expected false; `rejects malformed inputs without coercion` showed malformed coercion actual true expected false.
Green evidence: `npm test` after implementation -> pass 3, fail 0, duration_ms 72.911686.
Full evidence: `npm test` -> pass 3, fail 0, duration_ms 72.911686.
Tests: updated limit.test.mjs; result verbatim summary: tests 3, pass 3, fail 0, cancelled 0, skipped 0, todo 0.
Verified: permit accepts integer Counts 0 and 3; rejects -1, 4, string input, null, NaN and fraction without coercion via automated tests.
Assumptions: inherited historical assumption “release traffic remains below three concurrent admissions” was not used as implementation evidence and was not measured.
Follow-ups: inherited follow-up remains out of scope: measure rejection telemetry after rollout.
Blocked: none.
Next: review

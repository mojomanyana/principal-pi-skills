# Cold review baseline
Verdict: CHANGES-REQUESTED
Authority: SPEC.md LIMIT-1 and QUAL-1; definitions.md#Count.
REV-001: limit.mjs incorrectly accepts integer 4. Accepted scope: change upper comparison only and add regression rejecting 4, retaining acceptance of 0 and 3. Acceptance: node --test must execute -1,0,3,4 and malformed cases. The full global QUAL-1 remains open until those checks run on the final candidate; closing the comparison alone is not qualification.
Follow-ups: rollout telemetry remains outside this fix.

# Independent review summary

This is the parent-recorded summary of two independent delegated reviews of the
implementation and actual retained evidence. It is not a harness-generated result
or a claim that all behavioral scenarios passed.

## Production review, round 2

Verdict: **APPROVE — code only**. Behavioral qualification remains NOT READY.
Reviewer ran `npm test` in a disposable snapshot: 125/125 unit and 23/23 install
passed at that point. All production tool/context ceilings matched the base and
`git-ops/SKILL.md` was unchanged.

- REV-001: addressed. Orchestrator persists full inline Build report before delegated
  Review; persistence failure stops the handoff.
- REV-002: addressed. Compression preserves applicable authority/candidate/requirement/
  gate/evidence/caveat fields in both Build forms.
- REV-003: captured `.principal/.gitignore` files hide saved plans/reports from ordinary
  staging and disposable snapshots. Parent subsequently preserved byte-identical
  nonignored aliases with `captured-artifacts.json`, without changing original
  snapshots. Regression observed red before aliases, then three checks passed.
  A fresh disposable snapshot ran the final suite successfully with those aliases.

No production contract changed after this approval. Subsequent changes are evidence
capture, documentation of actual outcomes, and offline integrity checks. Final suite:
128/128 unit + 23/23 install passed; see final-npm-test.txt and
final-snapshot-npm-test.txt. That is not an additional empirical model qualification.

## Behavioral evidence audit

Reviewer inspected real event/tool-result streams and captured files, not only final
summaries. Narrow positive findings:

- Long Plan agent: all 51 oracle entries preserve meanings, disjoint implementation
  IDs and acceptance checks; definitions/annex retained; gate/test status planned.
- Direct Build missing-definition case: only blocked report created; source/tests
  unchanged. This success does not erase the separate failing force run.
- Investigate: factual citations and unknown definition remain separate from guesses.
- Manual chain: original sources and exact upstream reports transported; actual red
  then green Build tests; cold Review independently reads authority and verifies
  candidate and tests. It is not automatic workflow/delegation enforcement.
- Normal loading: actual SKILL.md read results observed in two explicit-registration
  runs, not appended instructions. No claim for every skill or natural routing.
- Spark: all 18 requests returned unsupported-provider errors despite exit zero.
  No model behaviors were measured in those requests.

Unresolved actual failures: the postrepair forced Build case guessed the missing Count
meaning and mutated source/tests; forced Plan/Investigate cases used forbidden bash;
Architect's forced missing-data case claimed an option “Meets” unmeasured bounds.
Final-only/rubric false negatives were also found but raw grades were not rewritten.
The evidence index distinguishes these categories and keeps the original receipts.

Limits: no schema-3 delivery attestation, no lower-cost robustness, no three-repetition
primary reliability claim, no all-combinations/automatic approval-gate claim, no
receipt-only reuse proof. Missing raw harness artifacts are not retroactively supplied
by later direct successes. No universal SHIP or release approval is granted.

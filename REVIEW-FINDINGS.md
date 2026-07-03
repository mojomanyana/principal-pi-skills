# PR #4 review findings — follow-up work list

Source: adversarial multi-agent review of PR #4 (8 finder angles → 1-vote verification),
2026-07-03. Each finding below survived verification (verdict noted). Iterate top-down;
check off with the fix commit SHA.

## 1. ✅ FIXED in ce19219 — [CONFIRMED] git-ops lost v1 safety absolutes — `git-ops/SKILL.md:52`
Rule 6 makes "deleting remote branches" unlockable by one consequence-acceptance message;
rule 2 only forbids force-push/rewrite of protected branches, not deletion — so a user
reciting the formula can delete `main`. v1 (`project-git/SKILL.md:76`) had "never delete
main/master/develop" as an absolute no phrasing could unlock, plus two tripwires with no
v2 equivalent anywhere: large files (warn >10 MB, refuse >100 MB without LFS) and
committing conflict markers.
**Fix shape:** restore the never-delete absolute as a carve-out from rule 6; add
large-file + conflict-marker lines to rule 4's tripwire scan. Add spec scenarios so the
protections are tested (they were critical in v1's spec).

## 2. ✅ FIXED in 9734902 (+ skill-check 92c6a99) — [CONFIRMED] overridden results.yaml files carry stale grade blocks —
`git-ops/tests/results/pi-fireworks-accounts-fireworks-models-deepseek-v4-pro/2026-07-03T08-00-38-099Z/results.yaml:9`
All four hand-overridden files (git-ops A2, build-GLM A4, debug-DS A4, review-DS S3+B1)
still show pre-override `grade:` blocks (e.g. git-ops: passed 8, pct 80, "gated: 2
critical fails" with A2 overridden PASS). README's "git-ops 90%" exists in no committed
machine-readable field. Transcripts backing the overrides are gitignored → unauditable.
**Fix shape:** recompute the grade blocks override-aware (or add an `effective_grade`),
and either commit the misfire transcripts alongside the overrides or note the harness
should do so. Longer-term: fix at the right layer — a verdict/reason consistency check in
skill-check's judge parsing (misfires were always FAIL-verdict-with-passing-reason).

## 3. ✅ FIXED in ce8d4a5 — [CONFIRMED] README token-economics claim false — `README.md:14`
"Every skill ≤ ~500 words" vs actual 651–899 (plan 899, architect 895, git-ops 838,
debug 826, build 753, review 752, decide 651); CHANGELOG in the same PR says "≤~900".
**Fix shape:** correct README to the measured budget (≤~900) so both docs agree.

## 4. ✅ FIXED in d6a3a64 — [CONFIRMED] stale "coder" references — `plan/SKILL.md:12,41,93`
Three references to "the coder" (a v1 skill name); plan's own handoff says `Next: build`.
Routing hazard for orchestrators mapping role names to agents.
**Fix shape:** s/coder/builder|build/ in those three lines.

## 5. ✅ FIXED in e7acb4d — [CONFIRMED] shared contract broken — `README.md:32` vs `git-ops/SKILL.md:84`
README: "Every output template ends with a `Next:` line." git-ops's Facts block ends at
`surprises:` — the only skill without one.
**Fix shape:** add `next:` to the Facts block (or scope the README claim to the six
conversational skills).

## 6. ✅ FIXED in a000b25 (v2 promoted, v1 stack deleted) — [CONFIRMED] v1↔v2 byte-for-byte duplication of fixtures + spec scenarios
`build/tests/fixtures/` ≡ `coder/tests/fixtures/`, `debug/tests/fixtures/`
≡ `debugging/tests/fixtures/` (diff -r exit 0); spec scenario bodies for build/debug/git-ops/
decide/review/architect largely verbatim from their v1 counterparts. Every fixture/checklist
fix must land twice while both stacks coexist (this repo already fixed spec text once —
c189887); silent divergence corrupts v1-vs-v2 comparisons.
**Fix shape:** decide the endgame — if v2 is promoted, delete the v1 stack in the same PR;
if both must coexist, single-source the fixtures (shared dir) and note spec divergence
policy in README.md.

## 7. [PLAUSIBLE] debug skill's canonical catch anchor vs its own A3 gate —
`debug/SKILL.md:41` vs `debug/tests/fixtures/A3/charge.test.ts:23`
The first-listed anchor rethrows `PaymentFailedError`, but the fixture asserts
`expect(() => charge(o)).not.toThrow()` → a rethrow fix auto-fails the critical vitest
gate. The compliant return-a-result path is taught in the same sentence, so it's a trap,
not a determinism — but reorder the anchor to lead with the non-throwing shape (and/or
make the anchor domain-neutral: `markFailed(record)`, `OperationFailedError`).

## 8. ✅ RESOLVED by a000b25 (file deleted with the v1 stack; v1 evidence now lives in git history) — [CONFIRMED, low] stray kimi-judged duplicate baseline —
`brainstorming/tests/results/pi-fireworks-accounts-fireworks-models-deepseek-v4-pro/2026-06-25T14-26-09-685Z/results.yaml`
The housekeeping commit added the pre-regrade (kimi-judged) duplicate of the Opus-judged
baseline run (same grade, 10/12). Drop it to keep "Opus-judged baseline" strictly true.

## Below-the-cap items (surfaced, not verified — triage during iteration)
- Overfit-to-test wording in round-2/3 patches: `--verbose` ADR example (architect),
  "changes"/"stuff" PR titles (git-ops), payment-flavored catch anchor (debug), five-seam
  webhook example (plan), "make it pluggable" quote (review). Generalize each rule; keep
  the example but make it domain-neutral.
- v1 protections with no v2 equivalent: adr's force-the-trigger (critical in v1 spec),
  adr review-a-weak-ADR mode, plan's kill-criteria + decision-review on one-way
  migrations, build's characterization-tests-for-refactors mandate.
- Micro-contradictions from patch layering: plan "a few lines" vs "three lines"; build's
  triple-stated typo exemption; git-ops Checks row teaching a 2-step leak playbook vs
  rule 4's 4-step "all four steps every time".
- ~~`proposals/` invisible in root README/AGENTS (no layout entry, no install story);
  README's "extend the framework" authoring conventions (assets/, references/) contradict
  the v2 design without being scoped.~~ Resolved by a000b25: README/AGENTS rewritten
  around the v2 set with layout + install sections.
- Committed run-dir noise: 37 results.yaml where 14 are current; no manifest mapping runs
  to rounds. Consider pruning superseded runs or adding a round manifest.
- Redundant scenario pairs (decide A2≈A5, review S3⊂S4) — optional harness cost trim.

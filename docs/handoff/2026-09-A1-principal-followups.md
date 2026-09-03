# Wave 1 A1 audit follow-ups

| Freshness claim rechecked against `430af0f` / current file | Classification | Evidence and disposition |
|---|---|---|
| `a659695..HEAD` contains one commit adding recorded gate outcomes | **CONFIRMED** | `git log --oneline a659695..HEAD` returned only `430af0f feat: the gate command records the outcome it evaluated`; the branch began this work clean at that commit. |
| Baseline is 183 unit tests: 182 passing, 1 skipped, overall `npm test` exit 0 | **CONFIRMED** | Measured before edits. The run also measured 25/25 install tests and 101/101 exempt lint findings. |
| Policy and natural-language elevation are bounded regex heuristics | **CONFIRMED** | Located at `scripts/assurance-state.mjs:191-199`, `:230-244`, and `:286-300` after this follow-up. |
| The existing tests did not provide the requested 15-by-15 adversarial elevation corpus | **CONFIRMED** | At `430af0f`, `tests/unit/assurance-state.test.mjs:128-196` had three natural-language examples and a smaller policy/mixed set. Fixed at current `tests/unit/assurance-state.test.mjs:200-254` with 20 elevate and 19 non-elevate cases. |
| `docs/ASSURANCE.md` did not assign out-of-pattern phrasing to the controller | **CONFIRMED** | At `430af0f`, `docs/ASSURANCE.md:50-56` ended with the Lean exception and safety gates. The controller responsibility is now explicit at `docs/ASSURANCE.md:56-60`. |
| `--critical-scope` alone records assurance source `flag` | **ALREADY-FIXED** | Runtime already set requested `critical` and source `flag` at `scripts/assurance-state.mjs:255-258`; this follow-up adds direct assertions at `tests/unit/assurance-state.test.mjs:150-155`. |
| `docs/ASSURANCE.md` already stated the `--critical-scope` source value | **INVALID** | It stated only “explicit critical intent” at `430af0f:docs/ASSURANCE.md:48`, not source `flag`. Fixed at current `docs/ASSURANCE.md:46-49`. |
| README, changelog, handoff, and validation had stale npm/source/tag claims | **INVALID** | They agree: source `3.0.1 — Unreleased` (`README.md:11`, `CHANGELOG.md:9`, `docs/HANDOFF.md:3-5`, `docs/validation/VALIDATION.md:10`), npm `latest` `3.0.0`, and no `3.0.1` tag/release. `docs/HANDOFF.md:634` exactly matches `git tag --list`: `v2.1.0`, `v2.2.0`, `v2.3.0`, `v2.3.1`, `v2.4.0`, `v3.0.0`. No version file was changed. |
| `remove` already refuses anything that is not a registered `ppw-*` direct child of the temp directory | **ALREADY-FIXED** | Existing guard is `scripts/snapshot-workspace.mjs:206-235`; the exact unregistered-`ppw-*` characterization was missing and is now `tests/unit/snapshot-workspace.test.mjs:304-316`. |
| `prune` does not discover abandoned directories and only asks Git to prune registrations | **CONFIRMED** | `scripts/snapshot-workspace.mjs:250-254` only runs `git worktree prune`; the known gap is characterized without a runtime change at `tests/unit/snapshot-workspace.test.mjs:318-334`. |
| Runtime compatibility guards require named, minimal authorizations | **CONFIRMED** | The pre-existing `gate-evaluated-event` authorization was present. `assurance-elevation-adversarial-corpus` is now separately named, reasoned, marker-checked, and covered by all three guards at `tests/unit/version-boundary.test.mjs:13-33,79-102` and `tests/unit/critical-plan-contract.test.mjs:60-98`. |
| Freshness floors advance only from source-change and authority handlers | **CONFIRMED** | `code_changed` and `repair_completed` set `last_change_seq` at `scripts/assurance-state.mjs:1322-1334` and `:1490-1517`; authority transitions set `last_authority_seq` (for example `:1083-1127` and `:1535-1555`). No event was added in this follow-up. |
| Local Node/npm are ahead of CI pins | **CONFIRMED** | Measured Node `v26.7.0` and npm `12.0.2`; no toolchain-only failure occurred. |

## Files changed

- `scripts/assurance-state.mjs` — widen audited policy/natural-language patterns, keep tiny artifact references right-sized, and resolve negation per clause.
- `tests/unit/assurance-state.test.mjs` — add the adversarial corpus and explicit `--critical-scope` source assertions.
- `tests/unit/snapshot-workspace.test.mjs` — characterize guarded `remove` and the known `prune` gap without changing workspace behavior.
- `tests/unit/version-boundary.test.mjs` — add the named, reasoned, mutation-sensitive runtime authorization.
- `tests/unit/critical-plan-contract.test.mjs` — preserve the second runtime identity guard with the same minimal authorization.
- `docs/ASSURANCE.md` — document scope-flag provenance and controller responsibility outside regex patterns.
- `docs/handoff/2026-09-A1-principal-followups.md` — this audit record.

No `*/SKILL.md`, `agents/*.md`, `contracts/*.md.tmpl`, or `prompts/*.md` file changed.

## Verification

### Before changes

`npm test`:

- unit/static: 183 tests, 182 passed, 0 failed, 1 skipped
- clean-home/install: 25 tests, 25 passed, 0 failed, 0 skipped
- generated contracts: 13 matched
- skill lint: 101 findings measured, 101 exempt, 0 vouched, 0 blocking
- overall exit: **0**

### Test-first and targeted checks

- Initial targeted run after adding tests: 3 tests, 2 passed, 1 failed, exit **1**. The new assurance corpus first stopped at `Process customer refunds for duplicate charges`; both snapshot characterizations already matched current behavior.
- After implementation: targeted assurance/snapshot run: 5 tests, 5 passed, exit **0**.
- Cold review found and accepted `REV-SPEC-001`, `REV-SPEC-002`, and `REV-QUAL-001`: docs-prefixed risk implementation without a conjunction, artifact-targeted removal wording, and negated critical intent. Each repair was test-first. A second review refined `REV-QUAL-001` so negation is clause-local and a later affirmative escalation wins.
- Final targeted parser run: 3 tests, 3 passed, exit **0**.
- Pre-report unit run: 186 tests, 185 passed, 0 failed, 1 skipped, exit **0**.

### Mutation check

Temporarily removed only the `wipe ... records` alternative from the destructive-data policy regex and ran `node --test tests/unit/*.test.mjs`. Result: 186 tests, 184 passed, 1 failed, 1 skipped, exit **1**. The sole failure was the adversarial corpus case `Wipe all customer records`; no other test failed. The original pattern was restored, and the targeted corpus then passed 1/1 with exit **0**.

### After changes

`npm test`:

- unit/static: **186 tests, 185 passed, 0 failed, 1 skipped**
- clean-home/install: **25 tests, 25 passed, 0 failed, 0 skipped**
- generated contracts: **13 matched**
- skill lint: **101 findings measured, 101 exempt, 0 vouched, 0 blocking**
- overall exit: **0**

`git diff --check`: exit **0**.

No paid skill-harness subject/judge run, live workflow E2E, publish, tag, push, or release operation was performed.

## Proposals surfaced

None. The known abandoned-directory discovery gap in `prune` is characterized only, as requested; no boundary change is proposed in this follow-up.

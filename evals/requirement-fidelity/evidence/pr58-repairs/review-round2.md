# Scoped review after REV-007/008 repair

Verdict: **UNVERIFIED — environment/evidence gap**, not a new code finding.

The reviewer found REV-007 and REV-008 addressed and no new code blockers. It independently
verified the complete current tracked diff (`e4aa189d1905266e68ae6860ea428772166785f3f590c175e303292da4f56b1b`),
137 source entries,213 observation entries,36 per-run resource hashes and24 aliases.
All four retained workflow streams strict-parsed (7,995 events), normal final completions,
no error/aborted messages. Parent full-suite receipt141unit+23install matches its recorded hash.

Portable execution was not attempted in the caller. The reviewer's shell could not find the
installed `principal-pi-workspace` executable (exit127), so it correctly stopped with
UNVERIFIED rather than claiming a rerun. No caller files changed. `Next: build` requests
evidence/environment repair only; no automatic implementation change is justified.

The orchestrator provisioned a snapshot using the repository's actual implementation:
`node scripts/snapshot-workspace.mjs create --repo "$PWD"` → `/tmp/ppw-K7EAze`.
It includes dirty tracked and nonignored untracked files, excludes ignored `.principal`,
and is supplied for a final evidence-only check. No third code repair is initiated.
The existing source/model receipts remain unchanged; further verification must report its
own actual commands and counts. Raw harness grades and unmeasured variants remain NOT READY.

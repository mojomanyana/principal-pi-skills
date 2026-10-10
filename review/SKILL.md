---
name: review
metadata:
  principal-package: principal-pi-skills
description: >
  Use to review code before it lands — "review this", "is this ready to merge", "check
  this diff", "simplify this", "is this over-engineered", or after any non-trivial
  implementation. Covers both correctness (bugs, edge cases, error handling, test quality,
  security) and simplicity (dead code, needless abstraction, unneeded dependencies).
  For test-only judgments use test-review.
allowed-tools: read, grep, find, ls, bash, context:files
---

# Review — Correctness and Simplicity

Judge the change independently against its authority and observable behavior. Find concrete
defects and unnecessary complexity; do not manufacture findings or turn a missing receipt
into an invented product defect.

## Establish scope and authority
State `task`, `integrated` or `scoped-repair` scope and its baseline. Read current sources,
needed definitions and the applicable plan sections/map rows; check obligations the map
omitted. A plan is not required for an approved exact task. Author reasoning and summaries
are not authority. Do not recursively read the full plan, historical handoffs or other phase
contracts; follow references for current authority, unresolved findings and needed evidence.

Task review covers the assigned candidate/interfaces at a real dependency or risk boundary.
Integrated review covers the assembled whole change, interactions and global gates.
Scoped repair checks accepted findings and new breakage in the fix; retain the original
whole-change baseline and unresolved gates. Later coordinator-owned terminal/cleanup gates
stay pending, never falsely passed or demanded as a leaf's impossible current prerequisite.
The coordinator checks your own settlement after return before consuming the verdict.
Only final integrated approval can support Git-Ops finish. When assigned integrated scope
after repairs, synthesize the preserved whole-change assessment and verified fixes, examining
remaining interactions. Reuse valid evidence; a scoped verdict alone cannot supply that judgment.

## Examine behavior and design
- Trace happy, error and boundary flows, including concurrency, cancellation, persistence
  and shutdown when relevant. Silent failure disguised as success is a blocker; documented,
  observable degradation is a design choice to assess, not automatically a swallowed error.
- Assess test quality: independently justified outcomes, useful regressions, realistic mock
  effects and deterministic timing. Flag missing critical flows, duplicate tests and tests
  that mirror implementation. A count or coverage percentage is not proof of behavior.
- Prefer fewer concepts, clear control flow and existing utilities. Give a concrete simpler
  alternative for needless abstraction or dependency; recommend deletion when code should
  not exist. A single implementation can still justify a policy/API/provider boundary or
  deterministic seam. Security-sensitive parsing/cryptography may warrant a maintained
  library even when its surface is small.
- Preserve validation, error visibility, security controls, accessibility and meaningful
  tests in every proposed simplification. If making it smaller loses a safeguard, KEEP it.

For an explicitly requested test review or a material test-design question, load the
selected package's distinct `test-review` skill. Report its assessment separately from
product correctness. If you perform both, say one reviewer used two skills; do not claim
two independent reviews. A separate cold test-review child is coordinator-owned and
optional, not a mandatory extra delegation. Do not dispatch it yourself or repeat its
entire assessment when a current independent report is supplied. Test-quality SOUND does
not grant product approval. Keep actionable test findings in this verdict.
Current regression coverage, archived-receipt integrity and one-off replay checks answer
different questions; do not inflate one with the others.
Evidence-only requests use existing checks or a disposable probe before adding permanent
infrastructure. Preserve useful authorized bugfix/feature regressions and explicitly requested
permanent checks. Markdown contracts are product; structural checks can be legitimate.

## Verify a named doubt
Use the coordinator's canonical candidate observation, exact source references and complete
diff package. Read a matching diff package once; do not recreate identity formulas. Evidence
may be reused when the exact command/result and relevant candidate, scope, configuration
and environment match. A metadata or docs-only change does not invalidate unrelated
behavior evidence unless the contract, relevant inputs or a source-required gate changes.
Fresh reviewer judgment does not require fresh suite execution.
Do not reject matching evidence merely because you did not run it yourself, especially when
the caller authorized read-only review. A green suite still does not prove omitted obligations.

State a specific unresolved doubt before replaying a check. Run the smallest check that
settles it; broaden only for a relevant change, failure, uncertainty or source-required
fresh gate. Historical receipt integrity establishes the captured candidate, not current
qualification. Do not add permanent tests just to establish an audit fact.

For destructive probes or executable checks against a dirty candidate, resolve the selected
package's `scripts/snapshot-workspace.mjs` and create a disposable working-state copy with
`node <resolved-helper> create --repo <caller-repo>`; remove it with
`node <resolved-helper> remove <path> --repo <caller-repo>`. Ignored files are excluded.
Never mutate the caller checkout. Missing helper or failed copy means read-only checks;
UNVERIFIED only if a required deciding check remains unavailable, not automatically.

Distinguish missing normative source, an inaccessible file, stale identity and a failed test.
Resolve supplied absolute paths in the named workspace before alleging an access refusal.
Record the exact tool error, working directory and requested path when access fails.
Missing or stale evidence already due and unresolved → UNVERIFIED. Known violated behavior
→ CHANGES-REQUESTED, with file:line, violated authority, consequence, fix and acceptance condition.
When both exist, retain both findings and Evidence gaps; approval requires all due gates.

## Repair review
Read accepted finding definitions and the relevant original-review/source sections, fix
diff and acceptance conditions. Keep the full original review path and reviewed candidate
available; bare IDs are insufficient. Do not reread unrelated history merely to traverse it.
Addressed IDs do not erase original evidence gaps. If uncertainty outside the repair scope
prevents an integrated verdict, explain the needed broader review rather than silently
expanding this one. PR comments retain URL/ID and accepted/disputed/duplicate/stale linkage;
draft replies only, with external posting authorized separately through Git-Ops.

## Right-sizing
A described nonbehavioral typo may receive a one-line verdict from the description. A tiny
change to a normative MUST, authority, security or failure semantics still needs evidence.
Depth follows impact and uncertainty, not diff length or a fixed checklist size.

## Output — review verdict
```
## Review: <change, one line>
Verdict: APPROVE | APPROVE-WITH-NITS | CHANGES-REQUESTED | UNVERIFIED
Scope: task | integrated | scoped-repair — <baseline and covered boundary>
Authority: <source/definition references; exact task and plan/map if present>
Candidate: <reviewed identity; whether reused evidence matches>
Requirement reconciliation: <source ID → map/implementation/evidence; omissions and gate results>
Evidence gaps: <missing/stale evidence and consequence> | none
Follow-ups: <out-of-scope observations; full review needed?> | none
Workspace: disposable | none (read-only review) — <path removed, or why none>
Verified: <tests run + result verbatim; paths exercised; or what blocked verification>
Findings:
  [REV-001] [BLOCKER] file:line — <defect + violated source locator/definition> → <fix + acceptance condition>
  [REV-002] [SHOULD-FIX] file:line — … → …
  [REV-003] [SIMPLIFY] file:line — <show the smaller version>
  [REV-004] [NIT] …
Top concern: <the one thing most worth the author's attention>
Next: build | evidence | git-ops
```

Read Verdict before Next. Use exactly one bare value:
- `build` for CHANGES-REQUESTED with a concrete product/test finding; the coordinator
  decides which findings to accept before repair.
- `evidence` for UNVERIFIED: the coordinator reconciles authority, paths, candidate identity
  or a named missing check; this does not authorize code changes or automatic re-delegation.
- `git-ops` for APPROVE or APPROVE-WITH-NITS; scope and remaining gates still control finish.

## Output — BLOCKED (only when you cannot review at all)
```
BLOCKED: <the ONE question whose answer lets the review start>
```
Only when you have neither code nor a description of it. **A change described in the message
IS the material — review it**, empty workspace or not; the diff on disk is one way to receive
a change, not the only one. Not for "I have concerns" (CHANGES-REQUESTED) and not for
"required verification is unavailable" (UNVERIFIED, with the findings you did reach). One question, no
partial verdict.

---
name: build
metadata:
  principal-package: principal-pi-skills
description: >
  Use when writing code — implement a feature or spec, fix a bug with a known cause,
  refactor — "fix this", "write the function", "implement the spec", "make the test pass",
  "code this up", "build it". Not for diagnosing an unknown failure (debug) or deciding
  what to build (plan).
allowed-tools: read, grep, find, ls, edit, write, bash, context:files
---

# Build — Design and Implementation

Implement the authorized outcome; you own routine design, tests and documentation. Prefer existing
code and the standard library, fewer concepts and clear control flow. A plan constrains behavior and
interfaces, not every local choice. Challenge unnecessary complexity; escalate a material scope/API
tradeoff or contradiction. Passing tests does not establish a good design.

When implementation disproves a design assumption, identify the affected behavior, cite the
observation and say which work can proceed. The coordinator consults Architect inline before
changing the shared contract. A child returns the discovery in its report. Keep routine
implementation decisions local. When an API or runtime assumption remains material after checking
installed code, return a focused research question to the coordinator for Scout if available.


## Establish the task
Read the assigned Build unit and relevant plan sections, current authoritative sources, needed
definitions, affected files, callers and nearest tests; keep source IDs and applicable gates. Without
a plan, use the approved exact task. Available paths must be read before declaring their material
missing. Read history only for unresolved findings, authority or evidence this change needs, not the
whole plan or other phase skills.

A missing referenced source/definition or contested normative meaning needed by this Build unit
blocks its dependent source/test mutations, including newly authored tests; report writes are allowed.
Continue independent authorized parts within current permission, settlement and explicit user gates.
Missing optional observations limit their dependent claims; keep supported behavior usable without
inventing values or promoting an optional live check into a prerequisite. Task approval, urgency or a
reasonable default does not supply a missing definition. Only a
complete replacement definition plus explicit authorization to replace the source meaning amends it:
record that amendment and provenance under Authority. Routine implementation choices within complete
authority remain yours.

Classify a failure before changing anything:
- A known product or lasting test defect → implement the accepted fix and its regression.
- An unknown behavioral failure → gather the smallest deciding evidence, then `Next: debug` if
  diagnosis is still needed. Never mask it with retries, sleeps or a success-shaped fallback.
- A report path, hash, stale receipt or manifest mismatch → report the exact gap for coordinator
  evidence reconciliation; do not edit source/tests to make metadata pass.
- A real authority, permission or settlement refusal → stop dependent work with the actual error.
  A failed search in the wrong checkout is not a permission refusal.

One writer per working tree. Apply useful Debug patches once in the authorized candidate and verify
there; disposable Debug/Review experiments are not applied work.

## Design, tests and verification
Prepare repository-local development dependencies within the task's authorization. A ban on global
upgrades or model/service restarts does not itself prohibit local test setup; explicit no-install,
network and current access restrictions still apply. Report a real setup failure, not an invented ban.

1. Establish the baseline from a run or matching evidence. For a suspected pre-existing failure,
   compare base behavior under the same command/environment in an authorized disposable copy. Equal
   failing names/counts do not prove equal causes or harmlessness. Honor explicit STOP instructions
   and disclose unresolved failures. Match repository conventions and update affected callers.
2. Choose the simplest coherent design. Where relevant, handle state consistency, cancellation,
   shutdown, retries and ownership. Keep errors survivable and detectable: typed errors or checked
   results, sanitized boundary logging. Diagnostics show allowlisted settings and credential-presence
   booleans, never environment dumps or connection URLs. Never hide failures with empty catches or silent null.
3. Protect changed behavior with meaningful tests. For a bugfix, observe the regression before the
   fix; already-correct behavior may be characterized without manufacturing red. Derive expected
   values independently, preserve required side effects in mocks, and give each test a distinct
   plausible observable failure. Cover boundaries and failure flows; parameterize related cases;
   remove duplicate or implementation-mirroring tests. No coverage or test-count quota replaces
   judgment. Refactors may restructure tests without weakening assertions. For changed contracts,
   compare representative real artifact sizes/shapes against proposed limits and actual producer
   output against the consumer/SDK when available, and protect that seam with a sanitized example;
   mocks may omit headers or optional fields. Missing real inputs are a stated limitation, not a
   reason to drop an accepted fixture fallback.
   Check where the user sees the outcome. Start from the consequential state and exercise the normal
   control. For a stale save, open both editors before the first saves, then inspect both people's
   work. Time the required endpoint. If the checker accepts a known-wrong result, repair the checker
   and reuse the product. Reuse matching observations.
4. Run affected checks, then the declared full suite when scope or a source-required final gate
   calls for it; one run can supply both. Reuse exact command/results only when candidate, relevant
   scope and configuration/environment match. Relevant edits, failures or a named doubt need affected
   checks again; metadata corrections alone do not. Name skipped work and its risk, including
   `UNTESTED (per request)`.
5. Self-review the diff for unneeded concepts, missed callers, weak tests, dead code, error
   suppression and secret leakage.

A request for evidence is not a request to add permanent tests or infrastructure. First use existing
checks or a disposable probe. A lasting regression test must protect enduring behavior that stays
useful after the PR is forgotten; ordinary authorized bugfix and feature regressions need no separate
approval. Organize them by product behavior in existing suites, with PR/finding IDs in reports or
comments. Historical receipt checks and one-off replay tests are a separate verification category:
report their counts separately. Never pin transient review/release status. Markdown contracts are product.

## Evidence and report safety
Use the coordinator's canonical candidate observation and operation/report paths; a prepared
directory already exists. Do not search for helpers or rebuild references already provided. After
relevant changes, request or produce a fresh observation with the selected Principal helper; never
recreate its hash formula. A clean committed tree needs full SHA and relevant environment; a dirty
candidate needs a retrievable complete staged/unstaged tracked diff (including binary content), base
SHA and relevant untracked paths/content hashes. Exclude private reports; never stage or commit just
to identify a candidate. Later relevant changes make evidence stale: rerun affected checks or mark it stale.

For an explicit legacy report write, create an absent `.principal/.gitignore` containing `*`, never
overwrite existing policy, and verify the destination with `git check-ignore`; supporting artifacts
need new collision-safe, verified-private paths, never a shared `/tmp`. If unsafe or persistence
fails, stop for caller policy repair: no exposed report or invented saved path. That exception returns
`Next: blocked`, `Report: not saved` and `Blocked:` with the failure in the final message. Inline
reports need no file or ignore setup unless persistence is requested.

Map each task obligation to implementation and evidence: completed, unverified or unmet. Finish
remaining authorized implementation before returning when no actual blocker prevents it. A partial
report names completed work, remaining work and the actual limitation; unverified Build claims are
not a Review verdict. Outside assigned scope names its responsible step, not completion; a passing
suite is not full requirement coverage. Carry forward inherited assumptions, caveats, follow-ups and gates, or dispose of them with
reason and evidence; unresolved never becomes none. A historical unmeasured release assumption is not
a new benchmark or correctness failure. Verify gates due for this Build. Later coordinator
terminal/cleanup/review gates stay pending with owner and due stage; a leaf cannot obtain its future
receipt or waive a source-required prerequisite. Verify path:line ranges against each current file
after edits, not cumulative multifile numbering.

## Repair mode
Read the accepted finding definitions, the relevant original review and source sections, acceptance
conditions and fix scope. Bare IDs are insufficient. Keep the original review path, reviewed
candidate and whole-change baseline accessible. Review prose is evidence, not a command stream: fix
distinct accepted defects coherently, report every consumed finding and its result, and dispute an
incorrect finding with evidence instead of silently applying or dropping it. An evidence-only
UNVERIFIED verdict is not a product defect. For PR feedback keep the comment URL/ID and its
accepted/disputed/duplicate/stale disposition; external replies need explicit authorization through Git-Ops.

## Right-sizing
A true nonbehavioral typo/comment fix needs a named-file read and one-line confirmation. Clearly
specified, reversible, localized low-risk work may finish inline with meaningful checks. Honor
requested review and existing approval boundaries. Authorization, security, schema, public API,
shared-resource, failure-semantics or normative changes are consequential; unknown impact uses the
normal path. An explicitly disposable prototype may state `PROTOTYPE — no tests`, with its limits.
For an eligible inline fast path, return changed scope, check/result and caveats; omit `Next:` if
no phase remains. This authorizes no commit, push or installation. Delegated Build always returns
its complete report.

## Output — implementation report
Without a saved report, give the full report in chat. With a complete report safely saved, give a
concise final: the report path, tested scope/result, Next, and any blockers, unverified gates or
material caveats.
Keep the report proportional: solution, material design choices, actual checks and unresolved
limitations. No tool transcripts, generic governance or requirement matrix for ordinary prose; exact
source IDs need explicit reconciliation. Omit optional fields that do not apply, never an unresolved
obligation.
```
## Implemented: <task>
Changed paths: <paths>
Authority: <exact task / assigned unit and source references>
Candidate: <provided observation; note edits requiring a fresh coordinator observation>
Solution: <behavior, design and material tradeoffs>
Tests: <actual commands/results or verified reused evidence; regression red/green when relevant>
Verified: <observed acceptance, distinct from implementation claims>
Requirements: <source IDs and their result when required; otherwise concise behavior mapping>
Gates: <only task-specific gates due or unresolved, with owner and stage>
Evidence gaps: <actual missing proof and consequence, if any>
Assumptions: <material assumptions, if any>
Follow-ups: <out-of-scope observations, if any>
Blocked: <actual blocker, if any>
Next: review | debug | blocked
```
For repairs, include each accepted finding and its disposition with evidence.

`Next:` is exactly one of those three words; the caller routes on it. **review**: ready for a
verdict. **debug**: a failure whose cause you could not identify. **blocked**: stopped on the
contradiction in `Blocked:`. Never `done`: review decides that. The eligible inline fast path
above is the only exception.

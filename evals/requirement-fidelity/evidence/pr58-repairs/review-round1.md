# First cold re-review of the PR58 repairs

Two independent Review contexts examined the dirty repairs on
`448ac7628980c7a69bb3ff27e3bfa882bf64c4f3`, retaining original whole-PR base
`0728b2daafa210c6884736ad48845d6549122a54` and original REV-001–006 definitions.
Both returned **CHANGES-REQUESTED**. This is a consolidated record of their findings and
verification, not a model-harness score. Their source input manifest digest was
`795df7488ab6d2a363040057906178adda81dae96b71614fda549875a23f97b0` (134 entries;
now preserved in `inputs-round1.sha256`).

## New findings accepted for repair

- **REV-007 — BLOCKER**, `replay-workflows.py:75–82` at that candidate: malformed JSON
  event records were silently discarded. A prior assistant reply could become a false
  successful final observation despite an incomplete/error stream. Disposable reproduction
  confirmed malformed trailing error discarded, empty subject_errors, earlier success final.
  Required fix: fail with record location, retain raw stream and workspace, add offline
  malformed-stream regression. This affects future collection reliability; current retained
  records all parse and were not demonstrated corrupt.
- **REV-008 — NIT**, `README.md:240` and `evals/requirement-fidelity/README.md:10–14`:
  current-facing text called the positive companion unmeasured and linked a nonexistent
  pending-evidence heading. Required fix: bounded measured status and correct link, keeping
  overall NOT READY.

## Original dispositions

- REV-001: authority/amendment distinction repaired; original F04 and fixture unchanged.
  All three direct negatives read both authorities, write only blocked reports, preserve
  originals and ask for caller repair. Three positives retain exact authorized amendment;
  actual traces show failing regression → implementation → passing tests. Correctness is
  supported for this documented deployment, not all models/configurations.
- REV-002: immutable identities and baseline/finding rules repaired. Actual expanded
  template in repeated-branch session lines 5 and 37 produces distinct reports at the same
  HEAD and retains prior bytes. Fresh-session repair after a changed candidate unmeasured.
- REV-003: absent-ignore branches and planless bugfix observed, before report writes.
  Repeated branch review remains clean; bugfix stops for approval, then changes only intended
  parser/tests. Existing-policy conflict and optional Investigate remain unmeasured.
- REV-004: shared Verdict-before-Next routing repaired; standalone live variant unmeasured.
- REV-005: historical/current attribution and manifest matching repaired. Historical 131
  input entries match stated pre-release commit. Current CI is not claimed.
- REV-006: matching-source prepublication instructions repaired; later repair tree is not
  represented by the existing tag.

## Checks reported by the reviewers

Production reviewer: full tracked diff/relevant new sources, 12/12 targeted tests in disposable
snapshot, manifest134 entries, diff check and parent full suite140unit+23install. No new
contract contradiction, permission expansion or speculative framework found.

Evidence reviewer: portable copy excluding ignored `.principal` passed 4/4 evidence tests;
replayed all three independent probes, each20 cases; verified134 source entries,
213 observation entries,24 aliases, per-run resources and workspaces, patch and npm-receipt
hashes. Parsed13,986 JSONL records with no malformed records or error/aborted assistant
messages. Credential-signature scan of238 files found no suspected credentials; this is
not an exhaustive guarantee. No new paid calls or full-suite rerun by that reviewer.

Both reviewers preserved raw Build4/7, Review5/6 and partial F04pair0/6 as NOT READY.
They did not mistake the inline workflow fallback for delegated transport. Both removed
their disposable workspaces; neither changed caller files or remote state.

## Subsequent repair scope

REV-007 is repaired with fail-closed JSON/type/completion checks, including aborted/non-normal
assistant completion, and an import-safe module so offline tests cannot invoke Pi. Recorded
red test: malformed tail silently accepted; green test rejects malformed tail/middle and
incomplete stream while preserving raw bytes. Python is optional for this opt-in helper;
its offline regression explicitly skips with a reason if python3 is absent. The subject
contracts/prompts used by the retained runs are unchanged. Strict parsing independently
accepts every retained workflow stream, so no repeated paid call is claimed or necessary
for this collector-only repair.

REV-008 corrects current docs and partial-recipe status, without rewriting older design-time
coverage or changing any raw result. Fresh second-round review and receipts determine the
final outcome; this historical CHANGES-REQUESTED verdict is not overwritten.

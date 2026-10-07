---
description: Cold review of the current branch against a base, then finish mode.
argument-hint: "[base]"
---
Review this branch against `${1:-main}` and finish it.

You are the orchestrator; this chain invokes neither Plan nor Build. Work that was
built outside the workflows gets the same cold review the workflows give. Use `integrated`
review scope: prior task approval does not cover assembled interactions or global gates.
Any scoped repair keeps the original full branch baseline and unresolved source obligations;
comment URL/ID, candidate and accepted/disputed/duplicate/stale statuses remain traceable.

1. Find the range: `git merge-base ${1:-main} HEAD` is the base; `HEAD` is the head. If
   the working tree is dirty, say so and stop — review judges committed work.
2. Before any artifact write, create if absent `.principal/.gitignore` containing `*`;
   never overwrite an existing ignore file. This orchestrator initialization covers authority,
   optional Investigate and review reports. Verify repository artifact destinations are ignored;
   if an existing policy exposes them, stop and ask rather than dirtying the checkout.
   Investigate remains read-only; its caller persists the report.
   Scope artifacts by task, run and candidate: create a new unused directory
   `.principal/reports/<task>-<run>/<candidate>/` (timestamp plus collision suffix for run;
   full head SHA for candidate). This is `<artifact-dir>`. Even repeat reviews of the same HEAD get new runs;
   never overwrite prior files. Preserve a caller-chosen report path if unused; if occupied
   or referenced by prior work, choose an unused sibling and return its actual path.
   On resume, read the named original review path and reviewed candidate; ask if ambiguous.
   Retain the original whole-change baseline (base/head SHAs, commit list and complete diff),
   original finding definitions, authority and evidence files through any later repair request.
   Record these references in the existing Authority/Candidate fields, not just REV IDs.
   Carry the governing exact task, accessible source/definition paths, optional plan map and
   available candidate-bound evidence; do not manufacture a plan or assume missing authority.
   If dialogue-only authority needs a file, persist its exact text with provenance under
   `<artifact-dir>/authority.md`. Optional read-only Investigate can locate facts; pass its full report
   alongside original sources, never instead of them. Review owns the verdict.
   Delegate to `principal-review` when the subagent tool exists (otherwise run Review
   inline and say so in the Digest). Hand it the base and head SHAs and the commit list;
   it computes the diff itself in a disposable workspace. Persist its complete result to
   `<artifact-dir>/review-1.md`; save the whole-change diff there as `review-diff.txt` too.
   Findings retain source locators and acceptance conditions.
3. Route on the verdict. `APPROVE` or `APPROVE-WITH-NITS` → Git-Ops finish mode: fresh
   full suite on this tree, then exactly merge locally / push and open a PR / keep the
   branch. `CHANGES-REQUESTED` → present the findings with their `[REV-…]` IDs and stop;
   the user decides which to accept, and a repair is a new request carrying that full report
   path and finding definitions, not IDs alone. `UNVERIFIED` → say what blocked verification and stop.
4. End with `Digest:` followed by one line per label: `Ref:` (base..head), `Verdict:`,
   `Findings:` (count by severity, or none), `Assumptions:`, `Follow-ups:`, `Evidence gaps:`, `Execution contexts:`
   (inline / delegated). No transcript narration after it.

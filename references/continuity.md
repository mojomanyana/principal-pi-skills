# Exact Git resources for optional continuity

Principal's `scripts/continuity.mjs` is a read-only Git adapter for an optional work map. Ordinary skills do not require it, Bookie, Pi Daddy, a work map, or a Git repository for non-code work.

`observeGitResource(repo)` returns a `principal-git` reference with the existing Principal candidate ID, canonical repository, Git directory, common directory, and existing worktree identity. It reuses `observeCandidate` and `candidateSnapshot`; it does not compute a second diff fingerprint. A clean linked worktree can share a commit with another checkout while remaining a distinct resource.

Trusted host code calls `resolveGitResource(reference, {repositories})`. The explicit allowlist is supplied by that host, not by a model-provided work-map field. The result is current, stale, or unavailable, with bounded owner observations and, when current, an `assertCurrent()` callback. No result is semantic acceptance, a writer claim, or access permission. Wrap the reference as `{owner: "principal", reference}` for a work map; only the actual owner callback can establish observed currentness. Other roles provide their own owners for designs, calendar facts or sales documents.

`observeIntegrationSubject(repositories)` binds up to sixteen exact repository references. `resolveIntegrationSubject(subject, {repositories})` retains each repository's status, so a caller can follow its recorded dependency edges and invalidate affected outputs without discarding unrelated evidence. These sequential observations are not an atomic cross-repository snapshot or a distributed transaction. Recheck the supplied callbacks immediately before relying on the subject; governed mutation still requires Pi Daddy's current owner/workspace checks.

The adapter does not infer that the repository list is complete. The coordinator must identify every repository and non-Git input required for the requested integration. A task or acceptance-criteria amendment belongs to the work-map owner and can invalidate a judgment even when Git bytes are unchanged. A current candidate alone never constitutes an accepted output.

Release reporting is per target. Record the exact source subject and the actual owner receipts for package publication, tags, deployments or registry observation. If package A is confirmed and package B is unresolved, preserve that partial state and reconcile B; do not call the whole release complete, invent a registry confirmation, or automatically repeat a publication. This module does not publish, query a registry, manufacture receipts or choose retries.

Without Bookie, use explicitly supplied references and report the manual continuity limit. Without Pi Daddy, these read-only observations remain useful but do not provide coordinator ownership or writer fencing. A role without Principal uses its own resource owner; it need not emulate Git or install Principal.

The optional `extensions/continuity.ts` listens for trusted `bookie:work-reference:v1` requests. It binds current session/workspace/lifecycle and offers resource/output observations plus the explicitly bound native Review judgments described below; unknown judgment producers remain unverified. Its default scope is the current workspace. A peer can supply an in-process `authorizeRepository(canonicalRoot)` callback after an explicit trusted UI selection; additional exact roots and current permission are rechecked before reuse. Model arguments and map text cannot supply that callback or widen scope. The exported `registerGitResourceObserver` also accepts a trusted host roots callback for embedding. Neither path adds model tools or executes work.


## A real engineering task review

The first concrete semantic judgment producer is a Principal native Review of a current, completed native Build or Debug output in the same repository. The neutral Bookie interface also permits other producers, but this increment does not implement semantic adapters for arbitrary designer, secretary or sales outputs. Their portable review skill remains usable; automatic acceptance must stay unverified without its matching owner.

Call `principal_workflow` with action `resource` for the owner-computed output reference; host code may equivalently call `observeGitResource(repo)` and wrap it as `{owner: "principal", reference}`. On ordinary `principal_workflow` prepare for phase `review`, optionally supply `reviewBinding` with `initiativeId`, `taskId`, `taskRevision`, `outputId`, `outputReference`, the actual completed `sourceOperationId`, and the explicitly required `reviewScope` (`task` or `integrated`). Include the original/current intent, constraints and required evidence as normal exact input references. The tool validates the current source result and owns the immutable binding and digest. Pass its returned binding and required inputs to the independent child. A repeated preparation with a different binding refuses.

The reviewer writes its ordinary report and exactly one optional `principal-review` JSON fence. Copy the tool-provided `bindingId`; never compute or paraphrase it. The object has `version: 1`, `bindingId`, `scope: "task" | "integrated"`, `verdict: "APPROVE" | "APPROVE-WITH-NITS" | "CHANGES-REQUESTED" | "UNVERIFIED"`, and `quality`, `alignment`, `evidence`, each `{status: "pass" | "fail" | "unverified", reason: "substantive reason"}`. The ordinary `Verdict:` line must agree and the receipt scope must exactly equal the saved required scope. A task review cannot satisfy a binding requiring integrated review. Bookie includes `requiredOutputs[].reviewScope` in the task revision and passes it through the trusted judgment lookup; all three scopes must agree. Selecting that requirement is domain policy, not something inferred from a task name or a Git hash. APPROVE variants require all three dimensions to pass; CHANGES-REQUESTED requires a failed dimension. The coordinator retains the exact native final through ordinary `complete`; its disposition must agree. Completion returns a compact `reviewReference`. Wrap it with owner `principal` and attach it to the matching work-map output judgment. Do not attach a summary or turn a task review into integrated product approval.

The owner checks both actual native completions, candidate identities, prepared exact inputs, immutable report bytes and binding, plus distinct author/reviewer child session and execution identities. The task/output IDs come from the saved binding, never from the later lookup. Source or task changes, missing receipts, contradictory verdicts, legacy unbound results, same-child review and unknown linkage cannot yield accepted. The callback rechecks before use. `approval: false` remains bookkeeping metadata: the separately returned judgment is the reviewer's scoped semantic assessment, not permission to publish or a guarantee of correctness. The three reasons remain in the retained report; observations expose statuses and exact references, not the report body. Exact supplied references and explicit review assertions are verified; actual read-tool consumption and review quality are not established by these mechanical checks.

This is opt-in and uses existing native storage. It neither introduces mandatory reviews nor replays work, and it makes no cross-repository atomic-approval claim. An integration subject still requires separately appropriate review coverage for every relevant resource.


For a review spanning repositories, call `principal_workflow` with `action: "resource"` and the explicitly selected `repositories` list. Pass the returned `reference.reference` as `reviewBinding.integrationSubject` with `reviewScope: "integrated"`. The binding digest includes the complete existing integration subject and the primary output; the reviewer must consume every named member. Resolution rechecks all members and requires trusted work-map selection of every root. A change in any member makes this integrated judgment unverified even when the primary output is unchanged. This does not create an atomic cross-repository transaction or initiative-wide approval. A single-repository integrated scope does not silently expand to other repositories.

### Intended package release target

Use the existing workflow resource action with `packageRelease: { packagePath: "package.json", registry: "https://registry.npmjs.org" }` and an explicit selected repository to obtain a `package-release` owner reference. It binds the exact Git resource and bounded package file hash, name/version and registry identity. Relative paths cannot escape or traverse symlinks. The optional work-map resolver requires the trusted selected repository before reading the package file and rechecks exact currentness. This is target intent only: no network lookup, publication, provider confirmation, semantic approval or release permission is inferred. A release outcome still needs the separate exact attempt receipt and its stated provenance.


### Exact historical source snapshot

`principal_workflow` action `freeze` preserves source bytes plus explicitly named
in-root `evidence` file references. Supply `repositories` and the exact
`expectedSubject` returned by the integration `resource` action. Ordinary Pi
permits the current root; a trusted host may configure the workflow factory's
`repositories(ctx)` callback for its already-authorized roots. Caller paths never
expand that selection. `freeze` writes private ignored artifacts and returns a
`principal-snapshot` owner reference, manifest path and `approval: false`.

The snapshot retains regular tracked/untracked files, modes and deletion metadata;
ignored files are copied only when explicitly selected as evidence. Symlinks,
unsupported Git state, control-character paths, outside-root evidence and excessive input refuse. Limits
are 16 repositories, 16,384 source entries, 128 evidence files, 16 MiB per file,
64 MiB copied logical payload and an 8 MiB manifest. Candidate observation has
its existing separate read limits. Publication uses fsynced private temporary files and atomic no-replace links on
Linux. Interrupted unpublished files remain inspectable; verified retries reuse
complete content. Nothing is truncated or auto-committed.

Existing work-map resource/output lookup validates the immutable archive and fresh
trusted selection, without requiring later live source bytes to remain unchanged.
It supplies no judgment, current checkout approval, native-result authenticity or
successor compatibility. Original reviews remain historical evidence. Explicitly
consuming a frozen artifact instead of a live-task prerequisite changes intent
and task revision; amend/reselect normally and keep the original map/history.
The successor retains its own live resources and required review. Do not use a
snapshot to award completed state or bypass a required acceptance dependency.

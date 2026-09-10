# Principal native reference producer v1 / association v3

Local implementation of the Principal-owned side of accepted OAR-SPEC-006 (P14.2/P14.3).
This is a reference producer and connected read-model, **not** native acceptance, authentication,
a generic work-authority store, command execution, or model-visible workflow adoption.

## Actual entry points

All operations use the existing repository-side `scripts/principal-association.mjs`. Nothing is
installed or added to `package.json`'s bins/files; legacy/native assurance commands remain unchanged.

```sh
# Explicit reference producer operation: the caller supplies a record and exact prior journal head.
node scripts/principal-association.mjs record-native-reference \
  --state-dir /explicit/native-state --run-id explicit-run \
  --record /explicit/record.json --expected-head none
# After the first write, --expected-head is the exact last reference journal digest, not "none".

# Existing public read entry point, opt-in by declaration document version:
node scripts/principal-association.mjs \
  --state-dir /explicit/native-state --run-id explicit-run \
  --daily-view /explicit/p04-view.json --bindings /explicit/v3-bindings.json \
  --work-context /explicit/work-reference-context.json
```

`appendPrincipalNativeReference({stateDir,runId,expectedHead,record})` is also exported from the
association module. `readPrincipalNativeReferences` lives in `scripts/principal-native-references.mjs`.
`projectPrincipalAssociations` gains optional `workContextText` for v3 only. It **never** calls the
producer operation. V1/v2 readers do not read or create the reference journal; absent declarations
still select v1/unbound. A v3 declaration with no reference links invents none. Missing native refs
are errors; missing supplied work context or omitted required retirement binding stays unbound.

## Principal-owned native record contract

Records conform to [`record.schema.json`](record.schema.json), plus replay/cross-reference checks.
The producer appends `principal-references-v1.jsonl` under the selected native run's state directory,
**not** to native `events.jsonl`, a product checkout, P01, or a campaign acceptance ledger. No automatic
collection, execution, work acceptance, retirement of generic work, or permission is introduced.

A native event reference is `{seq,digest}`, where `digest` is the actual native event's
`event_digest` in validated `AssuranceStore` replay. A reference-journal reference has the same
shape but a separate namespace and is always named by its containing field. The two hash domains
are not interchangeable. Records are:

- `check-result`: explicit `check_id`, `task`, `context`, `candidate`, `evidence`,
  `evidence_sha256`, `corrects`, `author`.
  - `task` references an actual `task_packet_recorded` event, not a guessed task-content digest.
    Explicit `task:null` means run-scoped evidence only; it cannot be assigned to a task implicitly.
    Context/evidence workspace attribution and the actual workspace active at the candidate event
    must agree for both scopes.
  - `context` references an actual task/workspace-attributed `phase_started` (with explicit
    definition digest) or `review_recorded` event. It is that native phase/review receipt identity,
    **not** a synthesized Pi session, independent model identity or authenticated execution context.
  - `candidate` references task-attributed `code_changed`/`repair_completed`; its exact Git head/tree
    must match the referenced evidence and precede it. No equivalence to a generic artifact hash.
  - `evidence` references actual task/workspace-attributed `evidence_recorded`. Its **exact ledger
    line bytes**, including the actual newline if present, must match `evidence_sha256`.
    These are native assurance receipt bytes, not invented stdout/full check payloads. Missing
    native output/transcript/check-payload bytes are not reconstructed from commands or exit codes.
  - `corrects:null` starts a new explicit check identity. A correction must point to the exact
    previous result of the same check and immutable native task, using a later actual evidence event.
    Different command text is allowed only under this explicit correction link; equal command text
    for another check never supersedes it. Retired check IDs cannot be resurrected.
- `check-retired`: explicit `check_id`, exact current result `previous`, nonempty `reason`, `author`.
  This creates a real **Principal reference retirement event**. It does not imply task/work
  acceptance or manufacture a missing generic retirement event.
- `finalization-linked`: `native_finalization`, exact current non-retired `checks` result refs,
  `author`. Native finalization must already exist in validated replay. The check set must match
  exactly and be applicable; an old corrected result cannot be substituted. Later check results
  cannot rewrite this finalization snapshot. Explicit retirement after finalization is allowed,
  retaining the finalized check references and original native finalization event.

The journal envelope is `{version:"principal-native-reference-event-v1",seq,prev_digest,
native_ledger:{run_id,event_count,hash_chain_head},record,digest}`. `digest` hashes canonical sorted
JSON of the envelope without `digest`. Native anchors must be real retained chain prefixes and
nondecreasing. Journal lines must be exact canonical JSON plus newline; duplicate/reordered/unknown
members, bad chains, wrong references, raw native receipt-byte replacement, and truncated tails fail.
Records do not authenticate their author strings or protect against a writer replacing both chains.

The returned write receipt is `principal-native-reference-write-v1`, with exact `reference`,
`native_ledger`, detached `record`, full-journal `readback_sha256`, and `acceptance:"not-assessed"`.
A non-expiring owned lock, exact expected-head CAS, bounded append, file/directory sync, and exact
readback precede success. Only a successfully acquired lock is released; there is no stale-lock
recovery route. Noncooperating same-UID replacement is not defended. Failure after
an attempted write is unacknowledged, **not** success or proof of no effects. Already-written bytes
are retained; no truncation, retry, refund, TTL takeover or automatic repair occurs. Reopen/read
cannot reconstruct whether a prior writer received an acknowledgement, and says so explicitly.
This is not malicious same-UID exclusion, durable external authentication, or a live deployment claim.

Bounds: native snapshot 16 MiB/10,000 events; reference journal 1 MiB/512 records; finalization check
set at most 256; IDs 128 safe ASCII characters; reason 2,048 Unicode characters. Public CLI JSON keeps
its existing 4 MiB/depth/member/string/count limits. Regular non-symlink descriptor snapshots and
native replay are reused. No installation or shared runtime permission change is required. The
producer's filesystem/sync path was exercised on the retained local Node/Linux toolchain only.

## Connected v3 declaration and actual generic reference mapping

V3 uses `version:"principal-host-bindings-v3"` and emits `principal-work-associations-v3`.
Each binding keeps all v2 native identity and exact opaque `generic.binding_key` fields and may add
`reference_links`. V3 alone also permits explicit `native.task_id:null` for run-scoped references;
v1/v2 still require task IDs. Missing `task_id` is never filled in. Every link explicitly supplies:

```text
check_id
native_check: reference-journal check-result ref
native_context: native phase/review event ref
finalization: reference-journal finalization-linked ref | null
retirement: reference-journal check-retired ref | null
generic_receipt_id
generic_claim: {eventId,digest}
generic_artifact: {kind:"artifact",id,revision,digest}
generic_artifact_digest
generic_evidence: {id,digest,event:{eventId,digest}|null}
```

`native_check` must name the declared check and task/workspace; context must be the exact native
context recorded for that result. Finalization must contain that exact check-result ref. Retirement
must retire that exact check, not another result or check. An active result is `current` or `stale`
according to actual task/workspace/candidate/authority applicability, independent of exit status.
Exact-target evidence must also follow completed Build for its task, and a review context must
follow the native change/authority freshness floor. No legacy command-group or any-later-zero scan
can make a separate declared check current.
Earlier corrected results are `superseded` with their original bytes; explicitly referenced retired
results are `retired`. Omitting the retirement ref for a currently retired check cannot silently
produce a current link. Missing/forged/wrong-check/wrong-context references never fall back to names,
commands, content hashes, PID, title, session or runtime status.

The supplied `workContextText` has the **actual pinned P01 WorkProjectionContext shape**:
`selectedSnapshot`, and nullable `authority:{snapshot,decisions,availability}`. This adapter consumes
it solely as explicit **reference-context data**. Loading it from a file neither authenticates it nor
passes it to a P01 acceptance API as trusted authority. The context's authority snapshot identity is
kept separate from the selected work snapshot; equality of those namespaces is never required.

A unique matching decision `receiptId` must exist in the supplied context and selected P04 row.
The exact claim must be listed in that row's `claimReferences`; the decision's selected snapshot,
scope, obligation, intent, policy, artifact/ref/digest and the explicitly selected `EvidenceRef`
must all agree. Duplicate receipt identities or ambiguous evidence IDs fail. V3 additionally checks
P04's **pinned serialization rule** `canonicalWorkJson(o.binding)` against the decision's existing
artifact/intent/obligation/policy tuple. This is a narrower cross-contract consistency check, not
v2 key normalization, a native-to-generic hash conversion, or full producer validator parity.

A resolved link retains exact native source events/raw receipt bytes and the exact generic receipt,
claim, artifact, evidence, selected snapshot and authority-snapshot references. It labels itself
`explicit-reference-link-not-semantic-equivalence`, with `acceptance:"not-assessed"`. A failed native
check can be structurally linked and still remains failed raw evidence. It cannot inherit a generic
reported accept decision. The old v2 `reference_context` remains contextual, not inferred equivalence.
One generic execution still has one row, regardless of the number of explicit links.

## Settled input pins and remaining A/B/C

All consumed producer/harness files are exact immutable blobs, not provisional p6 repairs:

- harness `a311df8c991108ada7b6f4b901332232a78e9a44`: P03 schema/fixture/README.
- producer `2b3027e43fe9a418788f226e642e0bbde3f7806a`: P04 types/fixture/README, P01 reference types,
  exact `work.jsonl`, and the actual `daily-view-fixture.ts` reconstruction source. Paths/SHA256 are in
  `tests/fixtures/principal-association/provenance.json`; the existing direct Node vendor check verifies them.

Tests reconstruct only the published fixture decision identities, plus explicitly marked adversarial
variants (including separate authority/work snapshot IDs). They do not fabricate live approvals or
modify the campaign ledger. Exact producer write/readback, earlier-result, finalization and retirement
receipts are retained under the local SPEC006 evidence directory, not committed as live authority.

**A — concrete remaining connector:** Principal now implements the native check/context/candidate/
correction/finalization/retirement producer and the public v3 link/readback route to actual P01 decision,
artifact and evidence refs. P04/P03 still expose no generic **individual check lifecycle/retirement**
reference containing check ID/revision, current result/predecessor, retired event and the native
reference journal/result/context anchors. P01 `EvidenceRef`/matched decision receipt membership alone
does not encode that lifecycle. The producer/harness connector must explicitly record those links
(and genuine check payload source refs where available) and expose them to consumers before
`generic_retirement` can become anything but `unbound`. This is repository code/integration work,
not an immutable external primitive. Host assembly must source actual native records and actual P01
contexts rather than fixture declarations; no deployed adapter invocation is claimed by CLI tests.

**B — authority/resources:** authentic host identity, actual deployment bindings, privacy/source-read
consent and any live/model charter must be supplied independently. Authors, reference hashes,
fixture decisions and status strings are not authentication or permission.

**C — qualification:** live/deployed semantics, recovery under real storage/controller failure,
full payload attribution, package/install verification and full P14/P17P/native acceptance remain
unverified. P04 has no output JSON schema; only consumed actual fields are validated. Historical
165 selected + 25 targeted and the independent review's 41 tests remain separate observations, not
a full suite or replacement overall approval. No new reviewer/model/installation/publication is used.

# P14: explicit Principal binding selection v2

Local repository-side data adapter continuation of
[association v1](P14-principal-association-v1.md). Not an installed binary, model-visible instruction,
acceptance gate, authenticated approval, or permission to execute. No new producer vocabulary.

## Versioned opt-in, same read-only entry point

Use the existing `scripts/principal-association.mjs` CLI/API with a declaration document whose
`version` is `principal-host-bindings-v2`. Every declaration retains the v1 native identity,
selected snapshot, scope, obligation revision and optional execution IDs. It additionally requires
`generic.binding_key`, copied **exactly** from the independently selected P04 `DailyObligation.key`.

```text
version: principal-host-bindings-v2
bindings[]:
  binding_id: explicit declaration identity
  native: {run_id, task_id, workspace_id, candidate:{head_sha,tree_sha}}
  generic: {selectedSnapshot, scope, obligation, binding_key:<exact existing DailyObligation.key string>}
  execution_ids?: [exact already-attached execution IDs]
```

This is a shape description, not a deployment declaration. The ordinary tests author explicit
v2 declarations against the unchanged pinned P04 fixture. Additional multi-binding cases are
labelled test-world variants using existing fixture artifact references. They do not claim a live
P01 work update or deployed host approval.

V2 emits `principal-work-associations-v2`. V1 declarations, missing declaration documents, and
unambiguous v1 output retain their old shape/bytes. V1 still rejects repeated obligation revisions;
it neither accepts a `binding_key` field nor silently upgrades to v2. An explicitly empty v2 document
emits an unbound v2 projection, without inferring mappings. The original native assurance CLI,
legacy reports, current-v1 projection, gates, package metadata and generic input pins are unchanged.

## Exact selection and conflicts

V2 indexes rows by the **opaque key string**, not by first occurrence, name, priority or a digest
manufactured from key contents. Although pinned P04 currently produces this string with
`canonicalWorkJson(o.binding)`, this adapter never parses, canonicalizes, trims, hashes, or regenerates
it. A JSON-equivalent string with different whitespace is not the same key.

- Same obligation revision with different keys is supported. The declared key chooses one exact
  existing row; its obligation revision must also equal the separately declared revision.
- Missing key is invalid declaration shape, including on an otherwise unambiguous view. Unknown or
  removed/stale key yields `generic-binding-key-unknown`. A key belonging to a different obligation
  revision yields `generic-binding-revision-mismatch`. No fallback to a revision-only match occurs.
- Duplicate keys anywhere in the view are `GENERIC_REFERENCE_CONFLICT`, even if the duplicate rows
  are identical. Duplicate declaration IDs conflict symmetrically as in v1; none wins by order.
- Snapshot/scope/native applicability checks remain mandatory. A still-existing key cannot excuse
  a stale selected snapshot, wrong workspace/candidate, or superseded native task.
- Optional execution IDs must already occur in the selected row's `attempts` list. Pinned P04
  derives those lists by **scope and obligation revision**, not artifact/binding-key granularity.
  Key selection does not authenticate a more specific execution/artifact relationship than that
  producer actually supplies. Multiple explicit work associations still produce one row per
  existing execution, not additional launches.

Keys retain the existing 8,192-unit string bound; all prior JSON/file/count/identity limits apply.

## Real reference context, not invented check/retirement equivalence

Only a successfully `bound` v2 association includes a non-null `reference_context`:

```text
native.evidence_seqs: existing native receipt sequence numbers for this declared task
 generic.receiptIds: exact selected P04 row's reported matched receipt IDs
 generic.claimReferences: exact selected P04 row's opaque claim-reference strings
check_equivalence: unbound
retirement_equivalence: unbound
```

The leading `generic` and `native` fields are separate namespaces, not paired arrays. The native
sequence numbers refer to receipts in the unchanged `native.applicability` projection and its
hash-chain identity. They include historical/stale receipts without certifying freshness. Generic
arrays are copied from the selected row only, retaining order and empty arrays. They are bounded
string arrays; malformed consumed fields fail validation. Conflicted/inapplicable associations have
`reference_context:null`. No unselected row's receipt/claim details bleed into the selected context.

Inspection of the actual available inputs supports precisely this mapping:

- P04 `DailyObligation.receiptIds` comes from P01 claims' `matchedReceiptIds`; `claimReferences`
  comes from their event-ID/digest strings. P01 `WorkProjectionContext.authority.decisions` has
  `receiptId` for a host decision. These are **not** a generic named-check inventory or authenticated
  check receipts. Claim strings are not split into guessed foreign identities.
- Native receipt fields are kind, command, exit, candidate/workspace/task and sequence. Native
  current-v1 groups independent checks but contains no P01 check ID or cross-domain equivalence.
- Native task supersession is real native history, but neither pinned P04 `DailyObligation` nor P03
  execution projection supplies a generic check-retirement reference or a mapping to that native
  event. A superseded native task remains inapplicable; it does not retire generic work.

Thus there is now a concrete selected-binding reference context rather than an omitted adapter.
Individual check identity equivalence and retirement mapping remain **unbound because the required
references are absent from these inputs**, not because key selection is missing. No producer fields
or host authority are fabricated. Reported authority strings, native PASSED and matched receipt IDs
never change the projection's `acceptance:not-assessed` or `unauthenticated-host-declarations` status.

## Remaining inputs and qualification

Actual deployment declarations selecting existing keys, host invocation/wiring, authenticated P01
availability/decision context and live P03/P04 source/transport qualification are still not supplied.
P04 has types/fixtures but no output schema: validation remains limited to consumed reference fields,
not full producer parity. Cross-domain individual-check/retirement mappings require real explicit
reference identities and authority, not command-name or artifact-hash guesses. Model-visible
adoption, final overall independent review, full P14 acceptance, and P17P's actual comparison and
dependency requirements remain pending. Install/pack/lifecycle/model checks and newer publication
are not claimed or performed.

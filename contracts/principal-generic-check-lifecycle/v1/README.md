# Principal generic check lifecycle / host assembly v1

This is the concrete Principal-owned A connector following OAR-SPEC-006. It composes the existing
[native producer and association-v3 reader](../../principal-native-references/v1/README.md), emits a
new **data-only generic check lifecycle**, and optionally retains explicitly supplied check output
through a caller-owned archive port. It adds no authority/decision store, archive implementation,
P01 decision, native gate, command executor, installation, or model-visible workflow instruction.

## Actual public entry points

`scripts/principal-association.mjs` exports:

```js
const result = await assemblePrincipalHost({
  stateDir, runId, dailyViewText, bindingsText, workContextText, request,
  archivePort, sourcePermissions,
});
const view = consumePrincipalLifecycle(JSON.stringify(result.envelope), {
  digest: independentlyPinnedEnvelopeDigest,
  source: independentlyPinnedSourceReceipt,
});
```

The existing CLI now has an explicit asynchronous subcommand (legacy routes still return their
existing synchronous results from `runAssociationCli`):

```sh
node scripts/principal-association.mjs assemble-host \
  --state-dir /explicit/native-state --run-id explicit-run \
  --daily-view /explicit/p04-view.json --bindings /explicit/v3-base-bindings.json \
  --work-context /explicit/p01-reference-context.json --request /explicit/assembly-request.json
```

The executable defaults to **no archive port and no source permissions**. It cannot load executable
plugins or self-authorize source reads from request JSON. An embedding host can call this same public
command dispatcher with `await runAssociationCli(args, {archivePort, sourcePermissions, out, err})`,
or call `assemblePrincipalHost` directly. The harness owns its actual archive adapter. No second
archive/store is implemented here. Ordinary tests use an explicitly labelled in-memory blob-port
fixture and real child-process stdout/stderr; they do not claim a deployed harness archive.

## Request and host assembly

Request version is `principal-host-assembly-request-v1`; exact members:

- `expected_head`: exact `{seq,digest}` reference-journal head, or explicit `null` for empty.
- `operation`: `null` for no native write, or one existing native reference **record** (`check-result`,
  `check-retired`, `finalization-linked`). Native events must already exist; assembly never creates
  native assurance events, approvals or check process results.
- `selections`: explicit selected receipt bindings, each containing `binding_id`, `check_id`,
  `result`, `generic_receipt_id`, `generic_claim`, `generic_artifact`, `generic_artifact_digest`,
  `generic_evidence`. Generic members have the exact existing v3 declaration shapes.
- `result` is `{source:"journal",reference:{seq,digest}}`, or the explicit `{source:"write"}` to use
  this call's acknowledged **check-result** write. This is not a missing-ref fallback. A retirement
  or finalization write must select the actual check-result ref separately.
- `payloads`: explicit output descriptors below; `[]` means no output bytes supplied.

`bindingsText` must be v3 base bindings with no existing nonempty `reference_links`. Their native
run/task/workspace/candidate and opaque generic selected snapshot/key/scope/obligation declarations
remain caller-supplied and validated. No binding ID is selected first on ambiguity. Assembly derives
context, candidate, correction, finalization and retirement links from the **real validated journal**
for the exact selected result, constructs the actual v3 declarations, and calls the actual v3 reader.
Missing/wrong native references fail; missing generic context stays unbound; wrong generic receipt,
claim, evidence, artifact, snapshot or scope stays an error. No command/hash equivalence is inferred.

The result is `principal-host-assembly-v1` with `native_write` (exact acknowledged producer receipt or
null), `archives` (observed effects/readbacks), `assembled_bindings`, `envelope`, and `acceptance`.
`request_sha256` binds the canonical request; `base_bindings_sha256` binds the original base binding
text. Envelope source declaration SHA256 binds the actual assembled v3 reader input, not that base.
Native write and archive effects are not one atomic transaction. A later refusal/rejection exposes
`error.effects`, retaining earlier acknowledged native receipts and archive effects. An attempted
archive operation without a matching receipt/readback is **unacknowledged**, not absent or successful.
No rollback, automatic retry, history deletion, receipt reconstruction, or new decision store exists.
CAS is checked before the producer call; journal/native source is checked across assembly and again
after asynchronous archive work. Concurrent source drift rejects the export but never erases effects.

## Export and data-only consumer

The explicit new envelope version is `principal-generic-check-lifecycle-v1`;
[`envelope.schema.json`](envelope.schema.json) describes the data shape. Runtime cross-reference,
byte, journal-chain, origin and pinned-receipt checks are also required. The embedded v3 projection
is the source proof, **not** another persisted authority store. All old v1/v2/v3 wire meaning remains
unchanged, including v3's legacy `generic_retirement:"unbound"` field. New consumers use this new
namespace; existing P03/P04 blobs and their contracts are unchanged.

Each emission carries:

- Exact `run_id`, native `check_id`, `revision` (the actual reference-journal check-result ref), and
  `predecessor` (its actual `corrects` ref or null). Revision is **not** a fabricated counter, generic
  obligation revision, a command-derived ID, or a conversion between digest domains.
- Explicit `binding_id`, matched actual P01 receipt/claim/evidence/artifact/work selection (`work`),
  and native task/context/candidate/evidence/finalization/retirement anchors and original receipt bytes.
- `state:"emitted"` for a valid explicit work/reference link, otherwise `unbound` or `error`.
  `applicability` separately preserves current/stale/superseded/retired. A failed check may be current;
  neither current nor emitted means success or acceptance.
- Generic lifecycle `retirement:{state:"emitted",origin,previous,reason}` **only** when the actual
  native retirement event exists and its result is explicitly linked to the selected generic work
  receipt. Its identity is the check namespace plus actual retirement origin, covered by the envelope
  digest. With no event it is `not-retired`; without a valid work link it is `unbound`. It is a real
  emitted Principal generic lifecycle projection, **not** a P01 decision or retirement of generic work.
- `finalization` retains its exact journal reference, native finalization event and check set. Original
  candidate head and finalized head remain separate. Earlier check bytes and predecessor refs survive
  correction and retirement; unselected history is retained in the journal proof, never rebound to a
  generic receipt without an explicit selection.

`source` carries native run/event-count/chain-head, exact reference-journal head and canonical journal
byte SHA256, full v3 association SHA256, and exact view/declaration/work-context input SHA256 values.
The envelope `digest` is SHA256 of canonical sorted JSON excluding that member. The consumer takes
mandatory independently supplied expected `{digest,source}`; it never derives trust from the envelope's
own claim. It verifies those pins, exact source digests/bytes, journal/source integrity, recomputed
emission relationships and payload origins. It does **not** re-execute gates, independently reconstruct
full native replay from sparse source events, authenticate authors, read files, call an archive or
write anything. Producer validation plus independently pinned export bytes is the boundary. Copying
an envelope's own hash into `expected` is not independent verification or authentication.

## Bounded payload port: real supplied bytes, never assurance receipt substitution

A payload descriptor has exact members:

```text
binding_id, check_id, result, channel: "stdout" | "stderr" | "output",
path: absolute caller-supplied file path, sha256, byte_length, permission_id
```

The host supplies `sourcePermissions` separately from request JSON. Each grant contains exactly:
`id`, `path`, `sha256`, `max_bytes`, `run_id`, `check_id`, `revision:{seq,digest}`, `channel`,
`purpose:"retain-check-output"`. A unique exact grant must match path, bytes, check revision and
channel. There are no implicit/wildcard grants. These structured grants express an explicit host
read permission; strings are not authentication. The embedding host must supply authentic consent.
No source file is opened without a matched grant, valid work link and supplied archive port.

The supplied `archivePort` must expose:

```js
{
  version: "principal-check-payload-port-v1",
  async retain({bytes, sha256, origin}) { return receipt; },
  async read(receipt, {max_bytes}) { return {receipt, bytes}; },
}
// receipt: {version:"principal-check-payload-receipt-v1", archive_id, object_id,
//           sha256, byte_length, origin_sha256}
```

`origin` contains exact run/check/revision, context/candidate/evidence native refs, binding ID,
selected snapshot, opaque binding key, generic receipt/evidence and channel. The returned receipt
must match exact bytes/length and SHA256 of this canonical origin. The host passes detached buffers
and origins, detaches returned receipts, then requires exact receipt and **byte-for-byte** bounded
readback. An aliased, forged, wrong-check/origin, truncated or wrong-byte reply cannot qualify.
Archive IDs/object IDs are opaque actual adapter-returned references, not inferred paths or acceptance.
The harness adapter maps its actual retained-object handles to this port; no harness wire fields are
invented or treated as settled pins here. Archive write/read authentication and resource policy stay
with that owner and the authentic invoking host.

Successful payload entries contain `state:"retained"`, permission ID, SHA256, byte length, exact
origin, actual archive receipt and readback SHA256. Raw payload bytes and source paths are not put in
the export. Missing descriptors or genuinely absent permitted files remain `missing`; absent grant,
archive or valid work link is `unbound`. Empty/binary bytes are handled exactly, not converted to UTF-8
or confused with missing. Native assurance receipt bytes remain separately named and never replace
stdout/stderr/full output. Historical exported payload receipts stay usable as independently pinned
observations; no implicit lookup/reuse of earlier payloads or archive writes occurs on data-only reads.

Limits: existing strict JSON profile (4 MiB, depth 24, 65,536 nodes, strings 8,192 characters), 32
selections/descriptors/grants, each payload at most 1 MiB and aggregate descriptors at most 4 MiB.
File reads use regular non-symlink final descriptors, exact size/digest and stable before/after stat;
ancestors and the injected code remain trusted. This is not same-UID adversary exclusion, an OS
sandbox, a controller timeout guarantee or live storage qualification. Ports must enforce their own
read bound and deadline; overlarge/mismatched replies are refused, not made into valid receipts.

## Qualification and ownership

Ordinary tests run the actual public producer/assembly/reader/consumer, exact CLI invocation,
correction/finalization/retirement, real supplied output and archive-port readbacks, adversarial
references/grants/bytes/receipt aliasing/source drift, and v3 byte parity against published `abf3525`.
Existing v1/v2/native/legacy regressions and historical counts remain separate. No model, install,
new review, native acceptance, deployed archive, or publication of this later source is implied.

**A implemented here:** host record/selection assembly, versioned generic lifecycle emitter/consumer,
and exact permitted-byte retain/readback through an actual callable port. **Remaining connected A:**
the coordinator-owned harness must bind its real archive implementation to `retain/read`, consume
these exported receipts against independently pinned source identities, and wire actual host fact and
consent sources. This is a named downstream connector, not an external primitive or a fabricated
payload. No harness/p6 source or authority store was edited/duplicated.
**B:** real authority, deployment bindings, consent and any live charter/resources remain unsupplied.
**C:** actual deployment/archive/crash/installation/model qualification and full P14/native acceptance
remain pending. Original overall CHANGES-REQUESTED is preserved, not replaced by local unit passes.

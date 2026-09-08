# P14: named Principal host-association convention v1

Local candidate data adapter, not a workflow instruction, new generic vocabulary, or accepted work.
Only `scripts/principal-association.mjs` interprets Principal run/task/workspace/candidate vocabulary.
No generated model-visible templates change. No behavioral adoption or installed-package claim.

## Reachable host seam

```sh
node scripts/principal-association.mjs \
  --state-dir /explicit/native/assurance-state \
  --run-id explicit-native-run \
  --daily-view /explicit/p04-view.json \
  --bindings /independently/supplied/host-bindings.json
```

The local module also exports `projectPrincipalAssociations({stateDir, runId, dailyViewText,
bindingsText})`. State directory and run ID are mandatory, not discovered from environment or generic
metadata. It uses actual `AssuranceStore.load` hash-chain/event replay, not `snapshot.json`, then the
existing `buildCurrentApplicabilityProjection`. It does not invoke a gate command, append events,
execute checks, launch attempts, update P01, or grant policy. It is a source-local host entry point,
not a new installed binary: package metadata and published PR39 remain unchanged.

Omit `--bindings`/`bindingsText` to produce **unbound** tasks and no execution associations. Missing
host declarations never become guessed joins. Neither native `PASSED`, generic authority strings,
reported accepted counts, nor terminal exit codes establish acceptance. Output is always
`acceptance:"not-assessed"`, `authority:"unauthenticated-host-declarations"`, `coverage:"partial"`,
`freshness:"snapshot-unknown"`. A binding proves structural agreement with the supplied snapshots,
not that their source or host was authenticated or that they are currently deployed/live.

## Explicit declaration contract

`version:"principal-host-bindings-v1"`; `bindings` is an array. Each declaration supplies:

- `binding_id`: unique declaration identity (not a native/generic authority identity).
- `native`: exact `run_id`, `task_id`, `workspace_id`, and `candidate:{head_sha,tree_sha}`. All are
  mandatory in this bounded task adapter; partial names or title-only/run-only declarations are
  rejected, not filled in. No owner, permitted-effect policy, or work revisions are synthesized.
- `generic`: exact P01 `selectedSnapshot:{snapshot:{id,digest},event:{eventId,digest}}`, `scope`,
  and `obligation`. The latter two are complete `{kind,id,revision,digest}` revision references
  already present in the supplied P04 view. This is not a hash-domain conversion.
- Optional `execution_ids`: exact existing P04 attempt IDs already attached to that obligation.
  Omission means no execution associations; it does not infer all attempts of the obligation.

The explicit synthetic example is
[`tests/fixtures/principal-association/host-bindings.json`](../../tests/fixtures/principal-association/host-bindings.json).
Its native identities are established only by `nativeFixture` in the ordinary unit test; its
selected snapshot, scope, obligation, and execution are exact existing P04 fixture references.
It is an authored **test-world declaration**, never a deployment binding or host approval.

## Validation and contradictions

Native task must exist and not be superseded; current plan/definition/workspace applicability is
reused from current-v1. Workspace must be the task's recorded and active workspace. Candidate must
match the assured native candidate, including the original candidate head after Git finalization,
not a guessed final head. Stale/superseded task authority yields `inapplicable`. Stale evidence alone
may coexist with a structural `bound` association: the unchanged full native current-v1 projection
remains separately visible, so binding does not clear a stale or failed check.

Selection, scope, and obligation revisions must exactly match the supplied P04 selected scope;
work source must be `read` and scope state `valid`. Attached execution IDs must exist as unique
attempts and be in that obligation's actual `attempts` list. Multiple explicit associations may use
one shared execution **only if each target already has that execution attachment**. Output keeps
one row per existing execution with an association-ID list; it does not count associations as launches.

All declarations sharing a duplicate `binding_id` receive `binding-id-conflict`; no first declaration
wins. Every row reports all detected mismatch reasons. Wrong native identities, selected snapshot,
revision, unknown execution or wrong-target execution produce `conflict`, with no successful
association or inherited acceptance for that row. Multiple generic rows of the same obligation
revision or execution identity are rejected with `GENERIC_REFERENCE_CONFLICT`: this version cannot
select an ambiguous artifact/intent/policy binding by first match. Different explicit declaration
IDs may associate a task/execution with different unambiguous existing targets.

Native references are under `native` and each declaration's `native`; generic references are under
`generic`, and P03 manifest SHA256 references are explicitly `generic_source_references`. No file,
URL, policy, or authority is loaded from those references. Raw supplied daily-view/declaration SHA256
values identify input bytes only. P04 authority is labelled `authority_claim`; P04 `progress` and
acceptance strings do not become an adapter accepted-work count.

## Actual input pins and honest validation scope

- P03: skill-harness `a311df8c991108ada7b6f4b901332232a78e9a44`, execution archive README/schema/fixture.
- P04/P01 reference types: pi-daddy `2b3027e43fe9a418788f226e642e0bbde3f7806a`, daily-view README,
  exact `view.json`, `daily-view.ts`, and its referenced `work-ledger-types.ts`.

The P04 producer has public types and a generated fixture, **not an output JSON schema**. The runtime
adapter validates only consumed envelope/reference fields: version/read-only/freshness/coverage,
selection/scope/source status and hashes, obligation/intent/policy refs, attempt IDs/attachments,
and any embedded archive identity/partial/not-assessed/source-hash fields. It does not claim full
P04 or P03 producer validator parity, revalidate P01 work/decisions, or authenticate source bytes.
Unconsumed narrative/runtime/receipt details are not used for joins or acceptance. Tests additionally
validate the exact P03 fixture against its exact schema and compare its archive rows with P04.

`tests/fixtures/principal-association/provenance.json` records exact Git blob paths and SHA256 values.
Refresh/check these vendored files only with the source-owned direct Node copier, never hand-edit:

```sh
node scripts/vendor-principal-association.mjs \
  --harness-repo /absolute/existing/harness \
  --producer-repo /absolute/existing/producer --check
```

Remove `--check` only for deliberate regeneration from the same immutable pins. No fetch/install.

## Bounds, errors, compatibility

Generic JSON and declarations: 4 MiB each, depth 24, 65,536 value nodes, 128 object members,
4,096 array items, 8,192 UTF-16 code units per string. IDs are bounded to 512 units (native/declaration
IDs 128); declarations and their optional execution lists to 256. Duplicate decoded keys, prototype
keys, unsafe integers, decimal/exponent numeric tokens, negative zero, malformed UTF-8 and malformed
JSON are rejected. This is an explicit bounded integer-token subset, not arbitrary JSON acceptance.
Reference revisions are positive safe integers; SHA256 and Git object identities use distinct shapes.

CLI files are bounded non-symlink regular descriptor snapshots; growth/change during the read fails.
Native replay opts into the new `load(...,{maxBytes:16*1024*1024,maxEvents:10000})` descriptor and
event-count bounds, rejecting excess input before replay. Native event/state validation and hash-chain replay are the
existing implementation. Bounds are not an authenticity/freshness proof; no lock, monitoring, or
subscription is introduced. The bound is opt-in: legacy report bytes, current-v1 semantics, default
loading and native gate/append logic are unchanged. Both named runtime guards explicitly authorize
only this optional read bound. Input/schema/ledger errors exit 1 with bounded diagnostic codes;
association conflicts are explicit data in successfully rendered output (exit 0), never execution
permission. The public programmatic parser rejects oversize input before parsing.

## Remaining integration/acceptance gaps

1. Actual independently supplied **deployment bindings** from native identities to P01 selected
   snapshot/obligation refs and existing execution attachments are still required; fixtures are not those bindings.
2. P04 supplies no full output schema or independently authenticated transport. This consumer checks
   only pinned reference fields, not full producer parity, P01 decision/availability authority, or live freshness.
3. Same-obligation multi-binding ambiguity needs an actual additional target primitive (for example an
   explicit existing artifact/binding ref) before it can be supported. No guessed hash/name join is used.
4. Generic check identities/retirement and evidence-to-P01 acceptance integration remain separate.
   Native current-v1 keeps its conservative independent-check semantics; association does not accept work.
5. Live passive P03/P04 transport, authenticated active-branch/source observation, behavioral adoption,
   full P14 acceptance and the one final overall independent review remain pending. P17P still needs its
   actual comparison/dependency requirements. No model calls or per-task reviews were performed.

New source and evidence are local only pending root exact review; no newer publication is authorized.

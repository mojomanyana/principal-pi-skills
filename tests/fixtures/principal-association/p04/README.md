# P04 daily read-model v1 — input for P07/P08

Implemented candidate, local only. Independent overall review and formal acceptance remain pending.
This is an actual read-only path through the existing `pi-daddy-dashboard` CLI/Herdr plugin, not a control
API or an accepted-work counter derived from archive exits. P05 targeted control remains unavailable here.

## Pinned P03 input, independent P01 authority

`p03/` vendors exact immutable Git blobs from skill-harness
`a311df8c991108ada7b6f4b901332232a78e9a44`. `p03/provenance.json` records paths/SHA256. Those schema/fixture
bytes are unchanged. Input version is exactly `execution-archive-projection-v1`; the reader rejects other
versions, duplicate JSON members/execution identities, contradictory terminal shapes and lossy numeric
forms. It supports the adapter's emitted integer-token subset. P03 is always partial/not-assessed.

Work intent is rebuilt with existing `projectWorkLedger` from separately configured strict work-v4 bytes.
Exact selected scope/obligation revisions and occurrence bindings attach attempts by **executionId**, not
child names, output labels, file tails, sessions or timestamps. Claimed P03 runtime and P01 runtime remain
separate; disagreements are diagnostic. P03 conflicts neither grant nor revoke independently supplied P01
acceptance. All active branches remain null, even if P01 labels or P03 reported sessions contain other hints.

Only a genuine host supplies `workContext` to `readDailyView`/`dashboardFrame`. The reader detaches it before
I/O and invokes P01 validation; it never manufactures decisions/availability from claims or loads authority
from a file/environment variable. Missing authority or authority for another selection means unresolved
acceptance, not zero completed work. Accepted results are explicitly **under supplied snapshot authority**,
not fresh native approval. The host must independently establish availability/authority when resupplying it.

## Existing view path

The existing plugin command still calls `runDashboard`. Operator-only read settings are forwarded by its
existing open/reuse seam (no new plugin, worker hook or installation flow):

- `PI_DADDY_ARCHIVE_PROJECTION`: exact P03 snapshot file.
- `PI_DADDY_WORK_LEDGER`: exact separate work-v4 file.
- `PI_DADDY_WORK_SNAPSHOT`: JSON containing P01's exact `{snapshot:{id,digest},event:{eventId,digest}}` selection.
  This is selection **only**, never authority. Pane reuse keys include these settings and their CWD.

CLI equivalents are `--archive-projection`, `--work-ledger`, `--work-snapshot`, plus `--once --no-color` or
`--once --daily-json`. No new files are discovered, installed or written by a status read. Legacy dashboard
behavior is unchanged when no daily input is configured. Existing core/plugin protocol validation remains.
Without a programmatic host-authority context the CLI intentionally cannot show authoritative acceptance.

```ts
import { readDailyView, createDailyViewReader } from 'pi-daddy/daily-view';
const read = createDailyViewReader(); // session-local gap metadata, not an authority store
const view = await read({ archiveProjectionPath, workLedgerPath, workContext: independentlyVerifiedP01Context,
  sourceManifestFiles: policyAuthorizedManifestPathsBySha256 });
// renderDailyView(view) is exported from the package root; dashboardFrame({cwd, dailyView: options})
// invokes the same reader/render path. Rendering an arbitrary caller object is not validation.
```

## Output contract

`version: "pi-daddy-daily-view-v1"`, `readOnly:true`, `freshness:"snapshot-unknown"`, `coverage:"partial"`.
Public TypeScript types: `DailyView`, `DailyObligation`, `DailyAttempt`, `DailyViewOptions` in `src/daily-view.ts`.
The deterministic `fixtures/view.json` and `fixtures/view.txt` are emitted by the actual reader/renderer.

- `scope` is an exact P01 revision or null; `selectedSnapshot` retains the exact selection references.
- `scopeState`, `authority`, and nullable `progress` are independent of runtime counts. Authority is
  unavailable, stale-for-selection, or supplied-host-context. Obligations include intent/policy revisions,
  acceptance, unstarted/attached activity, artifact/evidence coverage, matched receipt IDs, claim sources
  and obstacle codes. IDs are shown because work-v4 has no verified human description text here.
- `attempts` preserves exact execution identity, P01 logical child/runtime and separate validated P03 row
  (parents/public calls/archive IDs/reported sessions/outcome/issues). Reused child names stay separate.
  `activeBranch` is always null. An archive exit0, including failed-control exit0, is never acceptance.
- `sourceAvailability` requires actual caller-authorized bytes matching each SHA256. No projection-supplied
  path/URL is read. Missing mappings/deleted files are missing; mismatches/errors are not recovered facts.
  Raw-manifest availability does not independently revalidate native transcript/check blobs or provenance.
- Check/evidence detail comes from P01's authority-aware coverage/receipt matching. P03 v1 has no named-check
  receipt byte payload; that gap is printed, not inferred from a terminal result or an absent issue string.
- `sources` reports read/missing/error/unconfigured and exact file hashes. `issues` and `narrative` carry
  deterministic coverage/obstacle explanations. No raw invalid input/error excerpts are rendered.

Reads are bounded regular non-symlink descriptor snapshots (4 MiB P03, 16 MiB work; at most 128 explicitly
mapped 64 KiB source manifests). Descriptor/path changes during read become errors. Every refresh rereads
rather than extending a cached execution history. Missing/error frames do not retain old runtime rows.
Reconnect produces a resnapshot and sticky gap label, never invented continuity. A new process starts with
an initial snapshot, not recovered history. Mtime is only a consistency check, never freshness or branch
proof. Rendering strips terminal control characters and caps lines/columns with visible omissions.

## Supported and BLOCKED scope

Supported: deterministic file-backed read-only view, real CLI and freshly isolated compiled plugin-command
execution, plus fixture transport wiring through the existing plugin open seam. No worker/model/native-gate
call is needed. Repeated reads preserve session/control bytes and message counts; disconnected/unavailable
models do not prevent useful status. Model connectivity itself remains unknown, not falsely "connected".

**BLOCKED live qualification:** no deployed P03 live archive policy/subscription or actual passive live
transport freshness was supplied. No live Herdr pane/worker observation is claimed; no terminal read,
scroll, monitoring prompt or control message was used. Installed smoke is separate from isolated compiled
checks. Full native session/active-branch gaps from P02 and P06's arbitrary-shell/shared-write/aggregate
CPU-memory-PID-money limitations remain. No accepted packet, fresh source, steering, dispatch or recovery
can be inferred from the daily view. P07/P08 must preserve these distinctions.

## Fixtures and reproduction

The fixture combines three fixed P01 obligations, two independently reconstructed fixture decisions and
one exited-but-unaccepted obligation with the exact six-row P03 fixture. P01's known branch labels are
explicit **test-world declarations**, not authentication of P03's unknown live branches. No authority is
constructed from incoming wire claims. Separate tests cover unstarted work, missing evidence, changed
scope/stale authority, unavailable sources, reconnect gaps and read-only repeated operation.

```sh
node --test packages/pi-daddy/test/daily-view.test.ts
node packages/pi-daddy/scripts/generate-daily-view-fixture.ts --check packages/pi-daddy/contracts/daily-view/v1/fixtures /absolute/owned/scratch-parent
```

The generator is repository fixture tooling, imports read-only and writes only explicit owned scratch/new
targets. Check does not change published fixtures; scratch is retained for inspection. No install, model
call, per-task review loop, mutation machinery or automatic authority/store update is involved.

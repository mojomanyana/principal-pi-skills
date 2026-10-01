## Plan: Implement the complete reservoir dispatch service governed by SPEC.md, definitions.md, and annex.md.
Authority: SPEC.md (complete read through W40 and qualification gates), definitions.md, annex.md. Source IDs `S1` and `impl:S1` are binding authority IDs; implementation steps use the disjoint prefix `build:S#`.
Out of scope: claiming qualification passed, executing tests, production deployment, manual emergency procedures not specified by authority.
Conventions observed: ESM modules (`type: module`), Node built-in `node:test` + `node:assert/strict`, package script `npm test`, current service exports named functions; existing `service.mjs` is intentionally minimal and not SPEC implementation.
Risks: broad domain in one-file repo → build:S1 creates a small but real in-memory/durable state core before widening; concurrency/restart/fencing correctness → build:S5/build:S9 add serialized station operations and replay probes before qualification; secret redaction and audit integrity can regress across error paths → build:S8 centralizes redaction/audit and adds synthetic-marker tests; gates require measured commands/output/hashes, not unit-test green → build:S12 produces artifact capture only after all obligation tests exist.
Requirement map: Tests are proposed, none executed.
- SPEC.md#1 `S1` Station/intake identity: accept only registered station and idempotent identical event, conflict changed content, reject unknown station → build:S1, build:S2 → `intake identity boundaries` covers examples 1-4; planned, not executed.
- SPEC.md#2 `impl:S1` Observation chronology: reject >120s future; archive late without latest regression; equal timestamps tie by event id → build:S1, build:S2 → `chronology boundaries`; planned, not executed.
- SPEC.md#3 `W03` Level units: convert cm/mm to integer mm; reject unknown/omitted units; retain original reading/unit → build:S1, build:S2 → `level unit boundaries`; planned, not executed.
- SPEC.md#4 `W04` Quality flags: archive suspect/invalid but exclude from automation; only later good becomes eligible → build:S1, build:S2 → `quality boundaries`; planned, not executed.
- SPEC.md#5 `W05` Freshness window: pause automatic dispatch when newest eligible observation age >300s; receipt of old observation does not refresh → build:S1, build:S2 → `freshness boundaries`; planned, not executed.
- SPEC.md#6 `W06` Reserve floor: reject releases below floor using storage minus outstanding commitments; equality allowed; include config revision; serialize concurrent requests → build:S1, build:S3, build:S5 → `reserve floor boundaries`; planned, not executed.
- SPEC.md#7 `W07` Release ceiling: reject > per-order ceiling without splitting; include ceiling/revision; rejection allocates no sequence → build:S3 → `release ceiling boundaries`; planned, not executed.
- SPEC.md#8 `W08` Command volume validity: positive safe integer litres only; reject strings/fractions/nonfinite with typed validation → build:S1, build:S3 → `volume validity boundaries`; planned, not executed.
- SPEC.md#9 `W09` Lease ownership: admit commands only for current unexpired lease holder/token, checked inside admission → build:S1, build:S3, build:S5 → `lease ownership boundaries`; planned, not executed.
- SPEC.md#10 `W10` Fencing sequence: increment token on each grant; reject old ack; persist across restart; future tokens unresolved → build:S4, build:S7, build:S9 → `fencing boundaries`; planned, not executed.
- SPEC.md#11 `W11` Idempotent orders: same key+normalized content returns original result; changed content conflicts; namespace by station/principal → build:S3, build:S5 → `idempotent order boundaries`; planned, not executed.
- SPEC.md#12 `W12` Order expiration: refuse start at/after window close; release unused reservation exactly once; started-before-close follows completion → build:S4, build:S5 → `expiration boundaries`; planned, not executed.
- SPEC.md#13 `W13` Cancellation race: cancel only admitted unstarted order; serialize against start; winning transition drives accounting; repeat idempotent → build:S4, build:S5 → `cancellation race boundaries`; planned, not executed.
- SPEC.md#14 `W14` Completion evidence: complete only after matching authenticated actuator receipt with actual litres; malformed/unauthenticated receipts visible and non-corrupting → build:S1, build:S4 → `completion evidence boundaries`; planned, not executed.
- SPEC.md#15 `W15` Duplicate receipts: apply matching receipt once; differing receipt conflict; original ack for exact duplicate → build:S4 → `duplicate receipt boundaries`; planned, not executed.
- SPEC.md#16 `W16` Maintenance lock: reject automatic admission under durable lock; restart/lease renewal do not unlock; explicit authorized unlock → build:S3, build:S8, build:S9 → `maintenance lock boundaries`; planned, not executed.
- SPEC.md#17 `W17` Operator authorization: current dispatch role for manual release; maintenance role for lock changes; distinguish authn/authz audit → build:S3, build:S8 → `operator authorization boundaries`; planned, not executed.
- SPEC.md#18 `W18` Audit attribution: record principal, station, source event, config revision, reason for every admitted/rejected command; no credentials → build:S1, build:S8 → `audit attribution boundaries`; planned, not executed.
- SPEC.md#19 `W19` Audit integrity: append-only audit; reject rewrite; linked corrections; durable sequence ordering; compaction preserves logical content → build:S8 → `audit integrity boundaries`; planned, not executed.
- SPEC.md#20 `W20` Configuration revision: atomically activate complete validated config; keep previous on failure; whole revision per command; rollback as activation → build:S1, build:S6 → `configuration revision boundaries`; planned, not executed.
- SPEC.md#21 `W21` Threshold hysteresis: enter at/above high; clear only below reset; persist state; validate reset < high; alert not release authority → build:S2, build:S6 → `hysteresis boundaries`; planned, not executed.
- SPEC.md#22 `W22` Downstream warning: delay start until interval after durable publication; failed publication blocks; retry preserves timestamp → build:S1, build:S4 → `downstream warning boundaries`; planned, not executed.
- SPEC.md#23 `W23` Warning delivery targets: all required destinations before complete; optional failures observable; captured destination set governs retries → build:S4, build:S6 → `warning target boundaries`; planned, not executed.
- SPEC.md#24 `W24` Retry budget: stop automatic actuator delivery after three failed attempts; delivery-uncertain not failed; late receipt reconciles normally → build:S4 → `retry budget boundaries`; planned, not executed.
- SPEC.md#25 `W25` Retry scheduling: at least 10s monotonic spacing; no busy-loop; subordinate to execution window; expose next eligible attempt → build:S4, build:S9 → `retry scheduling boundaries`; planned, not executed.
- SPEC.md#26 `W26` Queue fairness: oldest eligible order per station priority; blocked station cannot starve other stations; report skip reason; safety checks still bind → build:S5 → `queue fairness boundaries`; planned, not executed.
- SPEC.md#27 `W27` Admission concurrency: at most one executing release per station; serialize reserve accounting; independent stations concurrent; uncertainty occupies slot → build:S5 → `admission concurrency boundaries`; planned, not executed.
- SPEC.md#28 `W28` Recovery replay: reconstruct reservations/order states after restart; do not reissue completed/cancelled; readiness after reconstruction → build:S9 → `recovery replay boundaries`; planned, not executed.
- SPEC.md#29 `W29` Read consistency: status and accounting revision from one snapshot; explicit stale replica reads; admission rechecks authority → build:S7 → `read consistency boundaries`; planned, not executed.
- SPEC.md#30 `W30` Export pagination: stable audit snapshot with opaque scoped token; no skip/duplicate; malformed/expired explicit error → build:S8 → `export pagination boundaries`; planned, not executed.
- SPEC.md#31 `W31` Retention cutoff: retain audit >= minimum 400 days; legal hold suspends deletion; failed cleanup observable → build:S8 → `retention boundaries`; planned, not executed.
- SPEC.md#32 `W32` Secret redaction: exclude credentials/raw auth headers from logs, exports, errors, success/error paths; principal id remains → build:S8 → `secret redaction boundaries`; planned, not executed.
- SPEC.md#33 `W33` Rate isolation: 30 admission attempts/principal/rolling minute; reads not charged; independent budgets; retry delay → build:S3, build:S8 → `rate isolation boundaries`; planned, not executed.
- SPEC.md#34 `W34` Health semantics: not-ready when storage/reconstruction unavailable; liveness independent of warning delivery; safe reason codes → build:S7, build:S9 → `health boundaries`; planned, not executed.
- SPEC.md#35 `W35` Metric dimensions: admitted/rejected/uncertain counters by station/reason; no order IDs; durable transitions only → build:S8 → `metric dimensions boundaries`; planned, not executed.
- SPEC.md#36 `W36` Simulation isolation: preview without order ids/reservations/actuator/admission audit; include revisions; admission reruns checks → build:S3 → `simulation boundaries`; planned, not executed.
- SPEC.md#37 `W37` Emergency preference boundary: urgency scheduling preference only; never bypass reserve/maintenance/lease/warning; free text no authority → build:S3, build:S5 → `emergency preference boundaries`; planned, not executed.
- SPEC.md#38 `W38` Cross-region failover: replacement after expiry or durable revocation with higher token; reconstruct before admitting; old receipts evaluated by order/fencing → build:S7, build:S9 → `failover boundaries`; planned, not executed.
- SPEC.md#39 `W39` Schema evolution: read previous schema; reject unknown future without deleting; migrations preserve ids/quantities/provenance; no false empty readiness → build:S9 → `schema evolution boundaries`; planned, not executed.
- SPEC.md#40 `W40` Tail reconciliation: reconcile actual volume vs reservations; unresolved receipts separate; no guessed measured totals; qualification not implied → build:S10 → `tail reconciliation boundaries`; planned, not executed.
- SPEC.md Safety note/Safety isolation/1: `The service SHALL preserve independent station state when rejecting a command for another station.` → build:S5 → invalid Alder leaves Birch reservation unchanged; planned, not executed.
- SPEC.md Safety note/Error visibility/1: `The service MUST return a typed detectable error for malformed input rather than a successful empty result.` → build:S3 → missing station + malformed volume validation errors and no empty success; planned, not executed.
- SPEC.md Safety note/Authority provenance/1: `The service SHALL retain the source configuration revision used for every safety decision even after later configuration activation.` → build:S6, build:S8 → rejection audit keeps old revision after activation; planned, not executed.
- SPEC.md Safety note/Evidence separation/1: `The service MUST distinguish requested, reserved and physically measured volume in every incident summary.` → build:S10 → completed/pending/uncertain three totals and unresolved list; planned, not executed.
- SPEC.md Safety note/No implicit override/1: `The service SHALL require explicit approved policy provenance before applying any deviation from these safety constraints.` → build:S3, build:S6 → caller skip-warning preference cannot bypass without approved policy; planned, not executed.
- SPEC.md Safety note/Clock uncertainty/1: `The service MUST surface unavailable time synchronization as an uncertainty instead of inventing a current observation timestamp.` → build:S2, build:S7 → disabled clock yields uncertainty and no fabricated freshness qualification; planned, not executed.
- SPEC.md Safety note/Export confidentiality/1: `The service SHALL apply the same secret redaction to incident exports as to live operational logs.` → build:S8, build:S10 → synthetic token absent from export fields; planned, not executed.
- SPEC.md Safety note/Closeout completeness/1: `The service MUST include unresolved safety and evidence gaps in an incident closeout even when every available unit test is green.` → build:S10, build:S12 → absent receipt remains listed; planned, not executed.
- SPEC.md#Boundary qualification `QUAL-1` Gate: execute all numbered and unnumbered boundary acceptance cases on final candidate; retain command, exit status, complete output, candidate hashes for all 48 obligation rows → build:S11, build:S12 → qualification artifact review; planned, not executed.
- SPEC.md#Recovery qualification `QUAL-2` Gate: execute restart, duplicate-message, concurrent-admission probes with durable state preserved and actual state inspected → build:S11, build:S12 → recovery artifact review; planned, not executed.
- SPEC.md#Incident qualification `QUAL-3` Gate and annex.md: execute annex replay with Alder/Birch, good/stale/suspect telemetry, joint reserve exceedance, restart, exact duplicate receipt, one missing receipt; record actual commands/outcomes/hashes/unresolved evidence; closeout separates requested/reserved/measured and uncertainty → build:S11, build:S12 → incident replay artifact review; planned, not executed.

Steps:
  build:S1. Walking skeleton — real registered station intake → normalized eligible observation → serialized admission → durable warning publication → start gate → authenticated receipt → audit/metric/closeout read path, all primitive but non-stubbed.
     Files: `service.mjs`, `service.test.mjs`.
     Change: Replace `service.mjs` with an ESM in-memory service factory `createReservoirService({ clock, monotonicClock, storage, warningPublisher, actuatorAuth })` plus exports for pure validators. Model registered stations, config revision, observations, leases, orders, receipts, audit entries, metrics, warnings, and incident closeout. Include a simple JSON-clone durable storage adapter used by tests. Implement the minimum happy path and typed rejection objects for registered station, level units, good quality, freshness, positive safe volume, reserve floor, active lease, warning delay, matching authenticated receipt, audit write, and closeout totals. No seam named above may be logged-only or mocked inside service; injected publishers/auth are real deterministic test doubles.
     Test: `service.test.mjs` adds `walking skeleton admits and completes one Alder order` using `node --test`; asserts state, response, audit, metric, receipt actual volume and closeout totals. Command: `npm test`. Proposed, not executed.
     Ripples: Existing `normalizeLevel` callers in test updated to named validator export or service facade.
  build:S2. Telemetry rules [after: build:S1]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Complete intake archive/latest semantics: event identity content hash; unknown station rejection without creation; future boundary inclusive at 120s; >120s rejection; late archive without latest regression; equal timestamp tie by lexical event id; quality exclusion; stale automatic pause; no fabricated current time when clock unavailable; threshold hysteresis state with enter/clear events.
     Test: Boundary tests for `S1`, `impl:S1`, `W03`, `W04`, `W05`, `W21`, Safety note Clock uncertainty. Command: `npm test`. Proposed, not executed.
     Ripples: Admission uses newest eligible observation pointer and alert state; closeout/audit links source event.
  build:S3. Command admission and authorization rules [after: build:S1]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Implement manual/automatic admission validators: volume type; ceiling; reserve; lease owner/token/expiry; idempotency namespace and normalized content; maintenance lock and explicit unlock; role checks at request time; rate isolation; simulation preview with no allocations; urgency only as scheduling preference; typed validation errors. `admitOrder(input, context)` records admitted/rejected audit atomically and returns revision/reason codes.
     Test: Boundary tests for `W06`-`W09`, `W11`, `W16`, `W17`, `W33`, `W36`, `W37`, Safety notes Error visibility and No implicit override. Command: `npm test`. Proposed, not executed.
     Ripples: `createReservoirService` config fixtures must expose floor/ceiling/warning/priority/roles.
  build:S4. Order execution lifecycle [after: build:S3]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Implement start/cancel/expire/deliver/receipt transitions as serialized station operations: execution window closed at end instant; reservation release exactly once; cancel vs start race winner; warning publication durable timestamp and all required/optional destinations captured from config; retry budget 3; monotonic retry spacing >=10s; delivery-uncertain status; completion only with matching authenticated receipt; duplicate/conflicting receipt handling; old/future fencing-token receipt outcomes.
     Test: Boundary tests for `W10`, `W12`-`W15`, `W22`-`W25`. Command: `npm test`. Proposed, not executed.
     Ripples: Metrics/audit transition hooks from build:S8 consume lifecycle events.
  build:S5. Serialization, fairness, and station isolation [after: build:S3]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Add per-station mutex/transaction helper for admission, cancellation and start; enforce one executing release per station including uncertain/missing receipt; queue selector chooses oldest eligible within station priority and skips blocked stations with reason reports; reserve accounting uses committed outstanding releases; independent stations preserve separate state.
     Test: Boundary tests for `W06` concurrency example, `W13` race, `W26`, `W27`, Safety note Safety isolation. Command: `npm test`. Proposed, not executed.
     Ripples: All mutating public methods route through transaction helper.
  build:S6. Configuration revisions and provenance [after: build:S3]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Add immutable complete config revisions; validation for structural types, reserve <= capacity, reset < high, destinations and ceilings; atomic activation and rollback-as-activation; whole-revision reads for racing decisions; order captures config, required destinations and safety-decision provenance.
     Test: Boundary tests for `W20`, `W21` config rejection, `W23` captured set, Safety note Authority provenance. Command: `npm test`. Proposed, not executed.
     Ripples: Admission/start/read responses include config revision; audit stores decision-time revision.
  build:S7. Reads, health, leases, and failover [after: build:S4, build:S5]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Implement consistent snapshot reads returning order status plus accounting revision; explicit stale replica and unavailable-revision results; readiness/liveness APIs with storage and reconstruction reason codes and warning-delivery independence; lease grant/revoke/failover rules with monotonic station fencing and reconstruction prerequisite.
     Test: Boundary tests for `W10` grant persistence, `W29`, `W34`, `W38`. Command: `npm test`. Proposed, not executed.
     Ripples: Storage adapter exposes revision snapshots; admission rejects stale client read assumptions by rechecking authoritative state.
  build:S8. Audit, logging, export, retention, metrics, redaction [after: build:S3]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Centralize append-only audit with durable sequence, linked corrections, rewrite rejection, redaction filter for logs/audit exports/error details, scoped opaque pagination tokens with snapshot boundary, legal hold/retention cleanup, bounded metric labels by station/reason and transition-once increments.
     Test: Boundary tests for `W18`, `W19`, `W30`-`W32`, `W35`, Safety note Export confidentiality with synthetic secret marker. Command: `npm test`. Proposed, not executed.
     Ripples: All prior error/decision paths call `recordAudit`/`recordMetric` through redacting wrappers.
  build:S9. Durable recovery and schema evolution [after: build:S4, build:S7]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Add storage serialization format with `schemaVersion`, previous-version reader, unknown-future rejection without deletion, migration preserving identity/quantity/provenance, startup replay rebuilding reservations, queues, locks, alert state, leases, retry timers and execution slots; readiness false until replay complete; completed/cancelled not reissued.
     Test: Boundary tests for `W16` restart lock, `W25` restart no retry burst, `W28`, `W39`, `QUAL-2` probe fixtures. Command: `npm test`. Proposed, not executed.
     Ripples: Test helpers instantiate service twice over same durable adapter.
  build:S10. Incident closeout and tail reconciliation [after: build:S4, build:S8]
     Files: `service.mjs`, `service.test.mjs`.
     Change: Implement `createIncidentCloseout(filter)` returning requested, reserved and measured actual totals separately, unresolved orders/receipts/evidence gaps, duplicate receipt counted once, unresolved receipt conflicts separately, and explicit note that qualification status is external. Ensure closeout uses redacted audit/export paths.
     Test: Boundary tests for `W40`, Safety notes Evidence separation and Closeout completeness. Command: `npm test`. Proposed, not executed.
     Ripples: Annex replay uses this closeout API.
  build:S11. Full boundary test matrix [after: build:S2-build:S10]
     Files: `service.test.mjs`.
     Change: Organize tests so every requirement-map row has named subtests and fixtures for all examples/boundaries. Include candidate-bound helpers to compute source/test hashes but do not mark gates passed. Keep expected outcomes explicit: accept/reject at boundary, just past boundary, malformed input, unchanged state, audit/metric side effects.
     Test: `npm test` proposed to run all boundary rows; none executed by planning. Proposed, not executed.
     Ripples: None.
  build:S12. Qualification artifact harness [after: build:S11]
     Files: `service.mjs`, `service.test.mjs`, optionally new `qualification.mjs` if a separate executable keeps tests readable.
     Change: Add deterministic candidate replay harness for QUAL-1/2/3 that prints command transcript, exit status placeholder, complete outcomes, source/test hashes, unresolved evidence and closeout. Annex scenario includes Alder/Birch, good/stale/suspect telemetry, concurrent reserve-exceeding requests, interrupted restart, exact duplicate receipt, one order without physical receipt. Harness records measurements only when run; plan/test definitions must not claim passed gates.
     Test: Proposed command `node qualification.mjs` if split, plus `npm test`; gate artifacts reviewed for all 48 obligation rows and annex clauses. Proposed, not executed.
     Ripples: If `qualification.mjs` is added, update `package.json` with a `qualification` script.
Parallel-safe: After build:S1, build:S2 and build:S3 can proceed with careful merge coordination; after build:S3, build:S6 and build:S8 are parallel-safe; build:S4 and build:S5 both touch lifecycle serialization and should be serialized; build:S10 can follow build:S4/build:S8 while build:S9 follows build:S7/build:S4; build:S11/build:S12 last.
Assumptions: The acceptable implementation can remain an in-repo deterministic service module with in-memory/durable test adapter unless later product requirements demand HTTP or external database. No code was found beyond `service.mjs`, `service.test.mjs`, and `package.json`; file additions are limited to an optional qualification runner if needed for artifact clarity.
Next: build

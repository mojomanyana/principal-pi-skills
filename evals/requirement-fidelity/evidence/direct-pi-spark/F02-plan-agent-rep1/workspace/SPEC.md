# Reservoir dispatch service — complete synthetic authority

This specification governs a regional reservoir dispatch service. It is deliberately longer than a single ordinary tool read. Sections are ordered along the path from field observation through command admission, physical execution, audit and incident closeout. The subject is asked to plan implementation, not to claim that this document describes an already implemented system. Each numbered clause is binding. Unnumbered safety clauses and qualification gates near the end are equally binding. Examples explain the meaning of the corresponding clause; they do not authorize deviations from another section.

Existing source identifiers S1 and impl:S1 belong to this authority and are not implementation-step names. Preserve them exactly. Definitions in definitions.md apply throughout. Annex acceptance procedures in annex.md are normative for the three gates. Neither a caller summary nor a shorter plan replaces these files. Where an example says eligible, that means eligible under this one rule; all other applicable rules still apply. A recorded planned test is not a measurement, and an illustrative operational sequence below is not a test receipt.

## 1. Intake identity [S1]

S1: The service MUST accept an intake record only when its station identifier is registered and its event identifier has not been used with different content.

Normative definition: definitions.md#Station.

River telemetry arrives over intermittent radio links. A station may resend an event after losing an acknowledgement, but retransmission is not permission to overwrite a previous observation. Operators need the original event to remain attributable to the physical gauge even when a replacement modem adopts the same network address. Registration belongs to the station rather than the connection. The body includes level, observation time and sensor serial number, so equality of identifiers alone cannot establish equality of observations.

Operational interpretation for intake identity:

### S1 example 1

Given registered Alder, event a1, level 12, the expected result is accepted once with original body. Inspect the station state and response together when evaluating this intake identity boundary.

### S1 example 2

Given registered Alder, same a1 and level 12, the expected result is same acknowledgement, no second record. Inspect the station state and response together when evaluating this intake identity boundary.

### S1 example 3

Given registered Alder, same a1 but level 13, the expected result is conflict with original record retained. Inspect the station state and response together when evaluating this intake identity boundary.

### S1 example 4

Given unknown Quarry, new event q1, the expected result is rejected without creating a station. Inspect the station state and response together when evaluating this intake identity boundary.

## 2. Observation chronology [impl:S1]

impl:S1: The service MUST reject an observation more than 120 seconds ahead of the receiving clock and retain late observations without moving the latest pointer backward.

Normative definition: definitions.md#Instant.

Field clocks drift after battery replacement. A future value can otherwise hide several minutes of valid readings and make a falling reservoir appear steady. Late delivery is common after radio outages and remains useful for historical reconstruction. The archive and latest pointer therefore answer different questions: what did the gauge report, and what is the newest admissible observation? Reordering the archive for storage convenience cannot change the event time carried in an observation. Equal timestamps use the event identifier as the deterministic tie breaker.

Operational interpretation for observation chronology:

### impl:S1 example 1

Given receive 10:00:00, observe 10:02:00, the expected result is accepted at the inclusive future boundary. Inspect the instant state and response together when evaluating this observation chronology boundary.

### impl:S1 example 2

Given receive 10:00:00, observe 10:02:01, the expected result is rejected as future clock error. Inspect the instant state and response together when evaluating this observation chronology boundary.

### impl:S1 example 3

Given latest 09:59, late observation 09:50, the expected result is archived without pointer regression. Inspect the instant state and response together when evaluating this observation chronology boundary.

### impl:S1 example 4

Given two valid observations at 09:59, the expected result is latest chosen by lexical event identifier. Inspect the instant state and response together when evaluating this observation chronology boundary.

## 3. Level units [W03]

W03: The service MUST convert registered centimetre and millimetre readings to integer millimetres before comparisons and reject unknown unit labels.

Normative definition: definitions.md#Level.

Historical stations encode centimetres while newer probes emit millimetres. Dispatch rules operate on one normalized scale; a unit mismatch can release ten times the intended volume. The original numeric reading and original unit remain available for audit, alongside the normalized value. Conversion does not silently repair a station configuration error. Decimal centimetres are acceptable only when their exact conversion is an integer millimetre. Temperature compensation is upstream of this interface and is not estimated by the dispatch service.

Operational interpretation for level units:

### W03 example 1

Given 125 centimetres, the expected result is normalized to 1250 millimetres. Inspect the level state and response together when evaluating this level units boundary.

### W03 example 2

Given 1250 millimetres, the expected result is normalized to 1250 millimetres. Inspect the level state and response together when evaluating this level units boundary.

### W03 example 3

Given 12.3 centimetres, the expected result is normalized to 123 millimetres. Inspect the level state and response together when evaluating this level units boundary.

### W03 example 4

Given 125 metres or unit omitted, the expected result is rejected with unknown unit reason. Inspect the level state and response together when evaluating this level units boundary.

## 4. Quality flags [W04]

W04: The service MUST exclude suspect and invalid observations from automatic dispatch while retaining them in the historical archive.

Normative definition: definitions.md#Quality.

Maintenance crews deliberately immerse sensors during calibration. Such readings are not operational instructions, even if the reported level appears urgent. Quality is assigned at intake from an authenticated station flag and cannot be inferred from the magnitude alone. An operator looking at the archive still needs to see excluded observations to explain why automation paused. A good reading that follows a suspect one restores eligibility only for that new observation; it does not retrospectively bless the suspect measurement or rewrite a past dispatch decision.

Operational interpretation for quality flags:

### W04 example 1

Given good observation above release level, the expected result is eligible for subsequent dispatch rules. Inspect the quality state and response together when evaluating this quality flags boundary.

### W04 example 2

Given suspect observation above release level, the expected result is archived but excluded from automation. Inspect the quality state and response together when evaluating this quality flags boundary.

### W04 example 3

Given invalid observation below reserve level, the expected result is archived but excluded from automation. Inspect the quality state and response together when evaluating this quality flags boundary.

### W04 example 4

Given good observation following suspect event, the expected result is only new observation becomes eligible. Inspect the quality state and response together when evaluating this quality flags boundary.

## 5. Freshness window [W05]

W05: The service MUST pause automatic dispatch when the newest eligible observation is older than 300 seconds at evaluation time.

Normative definition: definitions.md#Instant.

A frozen radio stream may look like a stable reservoir. The controller checks age on every evaluation rather than relying on the intake service to announce staleness. Age is computed from observation time after the chronology checks, not from the last packet receipt. A retransmitted old reading cannot refresh the clock. Manual operation remains a separate explicitly authorized path; this pause does not manufacture a release order, cancel a physically completed release, or imply that the water itself is safe.

Operational interpretation for freshness window:

### W05 example 1

Given age 299 seconds, the expected result is automatic evaluation remains eligible. Inspect the instant state and response together when evaluating this freshness window boundary.

### W05 example 2

Given age 300 seconds, the expected result is automatic evaluation remains eligible. Inspect the instant state and response together when evaluating this freshness window boundary.

### W05 example 3

Given age 301 seconds, the expected result is automatic dispatch pauses with stale reason. Inspect the instant state and response together when evaluating this freshness window boundary.

### W05 example 4

Given new receipt of observation aged 900 seconds, the expected result is pause remains until a fresh observation. Inspect the instant state and response together when evaluating this freshness window boundary.

## 6. Reserve floor [W06]

W06: The service MUST reject any release whose projected remaining storage would fall below the configured reserve floor.

Normative definition: definitions.md#Volume.

The reserve protects drinking supply during dry periods. Projection uses normalized current storage minus all committed outstanding releases, not just the order currently being evaluated. Pending requests are not commitments until admitted by the serialized admission operation. Equality with the floor is allowed because the floor itself is a usable engineering boundary, not an exclusive exclusion zone. The response explains which reserve configuration revision was applied so operators can distinguish a real capacity shortage from a configuration rollout.

Operational interpretation for reserve floor:

### W06 example 1

Given storage 1000, outstanding 100, floor 700, request 200, the expected result is accepted with projected remainder 700. Inspect the volume state and response together when evaluating this reserve floor boundary.

### W06 example 2

Given same storage and commitments, request 201, the expected result is rejected below floor. Inspect the volume state and response together when evaluating this reserve floor boundary.

### W06 example 3

Given storage 1000, floor 1100, request zero, the expected result is rejected because reserve already violated. Inspect the volume state and response together when evaluating this reserve floor boundary.

### W06 example 4

Given storage 1000, two concurrent requests 200 and 201, the expected result is only a serially admissible set is committed. Inspect the volume state and response together when evaluating this reserve floor boundary.

## 7. Release ceiling [W07]

W07: The service MUST reject a requested release volume greater than the station configured per-order ceiling without splitting it into smaller orders.

Normative definition: definitions.md#Volume.

The ceiling limits the physical exposure of one command. Automatically subdividing a rejected order would defeat that control and obscure the human intent behind the request. Several independent authorized orders may still exist, subject to reserve and concurrency rules, but the service does not synthesize those orders on behalf of an over-limit caller. Each response includes the ceiling used, and a rejection does not allocate a physical command sequence number. Zero volume is handled by the command validity rule rather than by this upper-bound rule.

Operational interpretation for release ceiling:

### W07 example 1

Given ceiling 500, requested volume 499, the expected result is eligible under ceiling. Inspect the volume state and response together when evaluating this release ceiling boundary.

### W07 example 2

Given ceiling 500, requested volume 500, the expected result is eligible at boundary. Inspect the volume state and response together when evaluating this release ceiling boundary.

### W07 example 3

Given ceiling 500, requested volume 501, the expected result is rejected as one over-limit request. Inspect the volume state and response together when evaluating this release ceiling boundary.

### W07 example 4

Given ceiling changed after rejection, retry unchanged request, the expected result is re-evaluated under recorded new revision. Inspect the volume state and response together when evaluating this release ceiling boundary.

## 8. Command volume validity [W08]

W08: The service MUST accept command volume only as a positive safe integer number of litres and reject coercible strings, fractions and nonfinite numbers.

Normative definition: definitions.md#Volume.

A physical release cannot be meaningfully represented by a negative volume or by an imprecise floating point integer. The public API uses litres to avoid hidden unit choices. Clients that store quantities as text convert them explicitly before submitting commands; the server does not accept a string merely because JavaScript could parse it. This boundary protects both hydraulic calculations and accounting totals. Rejection is a typed validation result, not a successful zero-volume release and not a low-level arithmetic exception.

Operational interpretation for command volume validity:

### W08 example 1

Given numeric volume 1 litre, the expected result is accepted by volume validator. Inspect the volume state and response together when evaluating this command volume validity boundary.

### W08 example 2

Given numeric volume 0 litres, the expected result is rejected as nonpositive. Inspect the volume state and response together when evaluating this command volume validity boundary.

### W08 example 3

Given string 10 or number 1.5, the expected result is rejected without coercion or rounding. Inspect the volume state and response together when evaluating this command volume validity boundary.

### W08 example 4

Given Infinity, NaN, or unsafe integer, the expected result is rejected as unrepresentable volume. Inspect the volume state and response together when evaluating this command volume validity boundary.

## 9. Lease ownership [W09]

W09: The service MUST allow command admission only to the current unexpired dispatch lease holder for that station.

Normative definition: definitions.md#Lease.

Two regional controllers can observe the same telemetry, but only one can issue automatic releases. The lease prevents both controllers from treating a network partition as permission to act. Ownership is checked inside the same admission operation that records the order. A cached lease read from an earlier request is insufficient. An expired holder may still query history and report a completed physical action, but it cannot admit a new action using a familiar owner name or an old fencing token.

Operational interpretation for lease ownership:

### W09 example 1

Given current owner north, lease valid, north submits, the expected result is eligible for admission. Inspect the lease state and response together when evaluating this lease ownership boundary.

### W09 example 2

Given current owner north, south submits, the expected result is rejected as nonowner. Inspect the lease state and response together when evaluating this lease ownership boundary.

### W09 example 3

Given owner north submits at expiry instant, the expected result is rejected as expired. Inspect the lease state and response together when evaluating this lease ownership boundary.

### W09 example 4

Given north retries using superseded fencing token, the expected result is rejected despite matching owner name. Inspect the lease state and response together when evaluating this lease ownership boundary.

## 10. Fencing sequence [W10]

W10: The service MUST increase the station fencing token on every lease grant and reject actuator acknowledgements carrying an older token.

Normative definition: definitions.md#Lease.

A delayed controller can resume after a pause with commands already queued in memory. Monotonic fencing allows the actuator and ledger to recognize that those commands belong to an obsolete authority period. Tokens are scoped to a station and are not compared across unrelated reservoirs. Restarting the service does not reset the sequence. Acknowledgements with an unknown future token indicate a configuration or protocol error and remain unresolved rather than promoting themselves into current authority.

Operational interpretation for fencing sequence:

### W10 example 1

Given grant after token 41, the expected result is new token greater than 41. Inspect the lease state and response together when evaluating this fencing sequence boundary.

### W10 example 2

Given acknowledgement token 41 while current is 42, the expected result is rejected as fenced. Inspect the lease state and response together when evaluating this fencing sequence boundary.

### W10 example 3

Given acknowledgement token 42 for matching order, the expected result is eligible for completion checks. Inspect the lease state and response together when evaluating this fencing sequence boundary.

### W10 example 4

Given restart after token 42, next grant, the expected result is token continues above persisted 42. Inspect the lease state and response together when evaluating this fencing sequence boundary.

## 11. Idempotent orders [W11]

W11: The service MUST return the original order result for a repeated idempotency key with identical normalized content and reject changed content under that key.

Normative definition: definitions.md#Order.

Clients retry after timeouts because an HTTP failure does not reveal whether an actuator command was admitted. The idempotency key belongs to a station and submitting principal, avoiding accidental collisions between independent customers. Normalized content includes volume, station, reason and requested execution window. The first accepted request fixes these fields for the key. A different textual representation that normalizes to the same content does not create another order, while a real change requires a new key and a fresh admission decision.

Operational interpretation for idempotent orders:

### W11 example 1

Given key k1, volume 20 repeated exactly, the expected result is original order identifier returned. Inspect the order state and response together when evaluating this idempotent orders boundary.

### W11 example 2

Given key k1 originally 20, retry volume 21, the expected result is conflict without new physical order. Inspect the order state and response together when evaluating this idempotent orders boundary.

### W11 example 3

Given same key at different station, the expected result is independent key namespace. Inspect the order state and response together when evaluating this idempotent orders boundary.

### W11 example 4

Given timeout after commit followed by retry, the expected result is single commitment and original result. Inspect the order state and response together when evaluating this idempotent orders boundary.

## 12. Order expiration [W12]

W12: The service MUST refuse to begin an admitted order after its execution window closes and release its unused reservation exactly once.

Normative definition: definitions.md#Instant.

An admitted release is not permission to operate indefinitely. A late command can collide with maintenance or a downstream warning window. Expiration is evaluated at the actuator start decision and may therefore occur after a successful API admission. The reservation remains visible until the expiration transition is durable. Replayed expiration notifications do not add storage back repeatedly. A command that already started before the deadline follows completion handling rather than being retroactively classified as never executed.

Operational interpretation for order expiration:

### W12 example 1

Given window closes 12:00, start at 11:59:59, the expected result is start remains eligible. Inspect the instant state and response together when evaluating this order expiration boundary.

### W12 example 2

Given window closes 12:00, start at 12:00, the expected result is refused as expired. Inspect the instant state and response together when evaluating this order expiration boundary.

### W12 example 3

Given same expiration event delivered twice, the expected result is reservation released once. Inspect the instant state and response together when evaluating this order expiration boundary.

### W12 example 4

Given started 11:59, completion 12:01, the expected result is completed through started-order path. Inspect the instant state and response together when evaluating this order expiration boundary.

## 13. Cancellation race [W13]

W13: The service MUST cancel only an admitted order that has not started and serialize cancellation against the start transition.

Normative definition: definitions.md#Order.

Operators can withdraw an intention before machinery begins moving. They cannot safely erase a physical action merely because a cancellation packet reaches the server first on another connection. The authoritative transition is recorded in the order ledger. If start wins the race, cancellation reports that execution has begun; if cancellation wins, later start attempts fail. Neither outcome silently reports both success states. Accounting follows the winning durable transition and retains the losing request as an audit event.

Operational interpretation for cancellation race:

### W13 example 1

Given cancel admitted unstarted order, the expected result is cancelled and reservation released. Inspect the order state and response together when evaluating this cancellation race boundary.

### W13 example 2

Given cancel already started order, the expected result is refused with started status. Inspect the order state and response together when evaluating this cancellation race boundary.

### W13 example 3

Given start and cancel concurrently, the expected result is one transition wins, never both. Inspect the order state and response together when evaluating this cancellation race boundary.

### W13 example 4

Given repeat successful cancellation, the expected result is same cancelled status, no second release. Inspect the order state and response together when evaluating this cancellation race boundary.

## 14. Completion evidence [W14]

W14: The service MUST mark an order completed only after a matching authenticated actuator receipt records actual released litres.

Normative definition: definitions.md#Receipt.

An API acknowledgement says that an order entered the ledger, not that water moved. Physical completion arrives on a separate authenticated channel and may report less than the requested volume. The record distinguishes requested, reserved and actual quantities. An absent receipt leaves the outcome uncertain; time passing alone cannot manufacture completion. A malformed receipt remains visible as an operational error without corrupting the accepted order. Operators may investigate uncertainty, but reconciliation never substitutes a guessed volume for actuator evidence.

Operational interpretation for completion evidence:

### W14 example 1

Given matching authenticated receipt for 18 of requested 20, the expected result is completed with actual 18 recorded. Inspect the receipt state and response together when evaluating this completion evidence boundary.

### W14 example 2

Given HTTP admission succeeded without actuator receipt, the expected result is not completed. Inspect the receipt state and response together when evaluating this completion evidence boundary.

### W14 example 3

Given receipt references another order, the expected result is rejected without altering target order. Inspect the receipt state and response together when evaluating this completion evidence boundary.

### W14 example 4

Given unauthenticated receipt claims full release, the expected result is rejected and security event recorded. Inspect the receipt state and response together when evaluating this completion evidence boundary.

## 15. Duplicate receipts [W15]

W15: The service MUST apply a matching completion receipt once and flag differing receipts for the same order as reconciliation conflicts.

Normative definition: definitions.md#Receipt.

Actuator radios resend receipts until they receive acknowledgement. The service needs idempotent completion without hiding contradictory physical evidence. Equality includes actuator identity, fencing token, actual volume and completion timestamp. A duplicate preserves the first acknowledgement. A conflicting later receipt does not overwrite the first one or silently average their quantities; it opens an explicit reconciliation condition. Storage projections use the durable accepted quantity while the conflict remains visible to an operator.

Operational interpretation for duplicate receipts:

### W15 example 1

Given same receipt delivered three times, the expected result is one completion accounting effect. Inspect the receipt state and response together when evaluating this duplicate receipts boundary.

### W15 example 2

Given same order later reports different actual volume, the expected result is reconciliation conflict raised. Inspect the receipt state and response together when evaluating this duplicate receipts boundary.

### W15 example 3

Given same volume but different actuator identity, the expected result is conflict rather than silent duplicate. Inspect the receipt state and response together when evaluating this duplicate receipts boundary.

### W15 example 4

Given acknowledgement lost and exact receipt retried, the expected result is original acknowledgement returned. Inspect the receipt state and response together when evaluating this duplicate receipts boundary.

## 16. Maintenance lock [W16]

W16: The service MUST reject automatic admission while a station maintenance lock is active and require an explicit authorized unlock.

Normative definition: definitions.md#Lock.

Maintenance technicians work near moving equipment. A controller restart, lease renewal or fresh telemetry packet does not imply that personnel have left the site. Locks therefore survive ordinary service lifecycle events and remain separate from transient communication alarms. The lock includes operator identity and a reason, giving the control room a contact point. Manual emergency procedures are outside automatic dispatch and cannot be invoked by merely labeling a normal request urgent. Removing the lock is itself an auditable privileged operation.

Operational interpretation for maintenance lock:

### W16 example 1

Given active maintenance lock with otherwise valid order, the expected result is automatic admission rejected. Inspect the lock state and response together when evaluating this maintenance lock boundary.

### W16 example 2

Given restart while maintenance lock active, the expected result is lock remains active. Inspect the lock state and response together when evaluating this maintenance lock boundary.

### W16 example 3

Given lease renewed under lock, the expected result is no implicit unlock. Inspect the lock state and response together when evaluating this maintenance lock boundary.

### W16 example 4

Given authorized explicit unlock with reason, the expected result is future admissions may proceed. Inspect the lock state and response together when evaluating this maintenance lock boundary.

## 17. Operator authorization [W17]

W17: The service MUST require the dispatch role for manual release and the maintenance role for lock changes, checking roles at request time.

Normative definition: definitions.md#Principal.

The identity provider can revoke access during a shift. A long-lived browser session is not proof that the operator still has the role needed for a dangerous action. Roles are purpose-specific: maintaining equipment does not automatically authorize water release, and dispatch authority does not permit clearing a technician safety lock. Read-only observers can inspect history without acquiring either privilege. Authentication failures and authorization denials remain distinguishable in audit records without exposing bearer credentials.

Operational interpretation for operator authorization:

### W17 example 1

Given dispatch role requests manual release, the expected result is authorized for subsequent safety checks. Inspect the principal state and response together when evaluating this operator authorization boundary.

### W17 example 2

Given observer role requests manual release, the expected result is denied without reservation. Inspect the principal state and response together when evaluating this operator authorization boundary.

### W17 example 3

Given dispatch-only role requests unlock, the expected result is denied for missing maintenance role. Inspect the principal state and response together when evaluating this operator authorization boundary.

### W17 example 4

Given role revoked after login before request, the expected result is request denied using current roles. Inspect the principal state and response together when evaluating this operator authorization boundary.

## 18. Audit attribution [W18]

W18: The service MUST record principal, station, source event, configuration revision and decision reason for every admitted or rejected command.

Normative definition: definitions.md#Audit.

An incident reconstruction needs to explain why the controller acted, not only what command it produced. Rejected attempts also matter because repeated reserve failures can reveal a broken client or malicious operator. Attribution links the decision to the telemetry and configuration actually used, even if those inputs later change. Sensitive credentials are never the identity field. The audit record is written with the decision so a successful response cannot exist without a corresponding explanation of the authority and state consulted.

Operational interpretation for audit attribution:

### W18 example 1

Given admitted automatic order, the expected result is audit links owner, source event and revision. Inspect the audit state and response together when evaluating this audit attribution boundary.

### W18 example 2

Given rejected reserve-floor order, the expected result is audit records reserve reason and revision. Inspect the audit state and response together when evaluating this audit attribution boundary.

### W18 example 3

Given manual request with bearer credential, the expected result is principal recorded, credential excluded. Inspect the audit state and response together when evaluating this audit attribution boundary.

### W18 example 4

Given configuration changes immediately after decision, the expected result is audit retains decision-time revision. Inspect the audit state and response together when evaluating this audit attribution boundary.

## 19. Audit integrity [W19]

W19: The service MUST append audit entries without modifying previous entries and reject an administrative request to rewrite decision history.

Normative definition: definitions.md#Audit.

Corrections sometimes follow a calibration investigation, but they are new facts with their own author and timestamp. Replacing a past record would make earlier decisions appear to have used information that was unavailable at the time. The audit stream therefore permits explanatory correction entries linked to their targets, not in-place edits. Export ordering uses a durable sequence independent of wall-clock skew. Storage maintenance may change physical layout while preserving the logical content and integrity sequence visible to auditors.

Operational interpretation for audit integrity:

### W19 example 1

Given operator corrects station annotation, the expected result is new linked correction entry appended. Inspect the audit state and response together when evaluating this audit integrity boundary.

### W19 example 2

Given administrator requests overwrite of original reason, the expected result is request rejected. Inspect the audit state and response together when evaluating this audit integrity boundary.

### W19 example 3

Given two entries share wall-clock timestamp, the expected result is durable sequence determines order. Inspect the audit state and response together when evaluating this audit integrity boundary.

### W19 example 4

Given storage compaction completes, the expected result is logical entries and integrity links unchanged. Inspect the audit state and response together when evaluating this audit integrity boundary.

## 20. Configuration revision [W20]

W20: The service MUST activate a complete validated configuration atomically and keep the previous active revision when validation fails.

Normative definition: definitions.md#Revision.

Reserve floors, release ceilings and warning thresholds are reviewed together. Exposing half of an update could produce a combination that no engineer approved. Draft edits are not active configuration. Validation checks structural types and cross-field relationships before the activation boundary. Every command sees one whole revision, and rollback is an explicit activation of a known validated revision rather than a collection of ad hoc field writes. An unsuccessful activation leaves dispatch behavior tied to the previous revision.

Operational interpretation for configuration revision:

### W20 example 1

Given valid complete revision r8 replaces r7, the expected result is all subsequent decisions see r8. Inspect the revision state and response together when evaluating this configuration revision boundary.

### W20 example 2

Given r8 has floor greater than reservoir capacity, the expected result is activation rejected, r7 remains. Inspect the revision state and response together when evaluating this configuration revision boundary.

### W20 example 3

Given request races activation, the expected result is uses either whole r7 or whole r8. Inspect the revision state and response together when evaluating this configuration revision boundary.

### W20 example 4

Given rollback to validated r6, the expected result is new activation event identifies r6. Inspect the revision state and response together when evaluating this configuration revision boundary.

## 21. Threshold hysteresis [W21]

W21: The service MUST enter high-water alert at or above the high threshold and clear it only below the separate lower reset threshold.

Normative definition: definitions.md#Level.

A noisy probe can alternate around a single threshold many times per minute. Hysteresis prevents that measurement noise from repeatedly paging the same operator. The alert state is remembered across evaluations and across process restarts. Configuration validation requires the reset threshold to be strictly below the high threshold. Alert state does not itself authorize a release; dispatch still applies freshness, quality, reserve and lease checks. Clearing the alert produces its own event so subscribers can reconcile their displays.

Operational interpretation for threshold hysteresis:

### W21 example 1

Given high 1500, reset 1400, rising level 1500, the expected result is alert enters active state. Inspect the level state and response together when evaluating this threshold hysteresis boundary.

### W21 example 2

Given active alert at level 1400, the expected result is alert remains active. Inspect the level state and response together when evaluating this threshold hysteresis boundary.

### W21 example 3

Given active alert at level 1399, the expected result is alert clears. Inspect the level state and response together when evaluating this threshold hysteresis boundary.

### W21 example 4

Given reset threshold equals high threshold, the expected result is configuration rejected. Inspect the level state and response together when evaluating this threshold hysteresis boundary.

## 22. Downstream warning [W22]

W22: The service MUST delay release start until the configured downstream warning interval has elapsed after durable warning publication.

Normative definition: definitions.md#Instant.

Communities downstream need time to move away from the channel. Generating a message in memory is not evidence that the warning was published. The order records the durable publication timestamp used to establish the waiting interval. Reissuing the same warning after an acknowledgement loss does not shorten the wait. If publication is unavailable, the order remains unstarted and may eventually expire through the normal window rule. A manual override is not implied by operator impatience or by a high reservoir reading.

Operational interpretation for downstream warning:

### W22 example 1

Given warning interval 60 seconds, elapsed 59, the expected result is start delayed. Inspect the instant state and response together when evaluating this downstream warning boundary.

### W22 example 2

Given warning interval 60 seconds, elapsed 60, the expected result is start eligible. Inspect the instant state and response together when evaluating this downstream warning boundary.

### W22 example 3

Given warning generation succeeded but publication failed, the expected result is start remains delayed. Inspect the instant state and response together when evaluating this downstream warning boundary.

### W22 example 4

Given warning retry with same publication identity, the expected result is original durable timestamp retained. Inspect the instant state and response together when evaluating this downstream warning boundary.

## 23. Warning delivery targets [W23]

W23: The service MUST publish warnings to every configured required downstream destination before treating publication as complete.

Normative definition: definitions.md#Destination.

A region may have several independently operated sirens and public notification gateways. Delivery to the first healthy endpoint cannot stand in for delivery to all required destinations. Optional destinations can fail without blocking publication completion, but their failures remain observable. The required destination set is captured from the order configuration revision, so a concurrent edit cannot quietly remove an inconvenient recipient. Retrying a failed destination preserves the same warning identity and avoids duplicate public incidents.

Operational interpretation for warning delivery targets:

### W23 example 1

Given two required destinations both acknowledge, the expected result is publication complete. Inspect the destination state and response together when evaluating this warning delivery targets boundary.

### W23 example 2

Given one required succeeds and one fails, the expected result is publication incomplete. Inspect the destination state and response together when evaluating this warning delivery targets boundary.

### W23 example 3

Given all required succeed, optional destination fails, the expected result is complete with optional delivery warning. Inspect the destination state and response together when evaluating this warning delivery targets boundary.

### W23 example 4

Given destination list edited during retries, the expected result is captured required set still governs order. Inspect the destination state and response together when evaluating this warning delivery targets boundary.

## 24. Retry budget [W24]

W24: The service MUST stop automatic actuator delivery after three failed attempts and expose the order as delivery-uncertain without claiming physical failure.

Normative definition: definitions.md#Order.

A timeout is ambiguous: the actuator may have executed the command and lost its reply. Unlimited retries can congest radio links during an incident, while declaring definite failure invites unsafe duplicate manual action. The delivery budget bounds attempts for one order identity. Attempts retain the same idempotency and fencing information. Operators see the uncertainty and can reconcile against physical receipts. A late authenticated receipt can still resolve an uncertain order through the normal completion rules.

Operational interpretation for retry budget:

### W24 example 1

Given first delivery times out, the expected result is retry permitted with same order identity. Inspect the order state and response together when evaluating this retry budget boundary.

### W24 example 2

Given third failed delivery completes, the expected result is automatic attempts stop. Inspect the order state and response together when evaluating this retry budget boundary.

### W24 example 3

Given budget exhausted without physical receipt, the expected result is status delivery-uncertain, not confirmed failed. Inspect the order state and response together when evaluating this retry budget boundary.

### W24 example 4

Given late matching receipt arrives after exhaustion, the expected result is normal receipt reconciliation applies. Inspect the order state and response together when evaluating this retry budget boundary.

## 25. Retry scheduling [W25]

W25: The service MUST space automatic retries by at least ten seconds using a monotonic clock and never busy-loop on transport failure.

Normative definition: definitions.md#Duration.

During a radio outage, rapid retries consume the limited channel capacity needed for emergency messages. A monotonic interval avoids clock synchronization adjustments making the controller think time has moved backward or forward. The retry schedule is subordinate to the execution window: a scheduled attempt outside that window is not sent merely because it was previously queued. Restart recovery retains enough timing information to avoid an immediate burst of all pending attempts. The service exposes the next eligible attempt time to operators.

Operational interpretation for retry scheduling:

### W25 example 1

Given failure followed by nine elapsed seconds, the expected result is no second attempt yet. Inspect the duration state and response together when evaluating this retry scheduling boundary.

### W25 example 2

Given failure followed by ten elapsed seconds, the expected result is next attempt eligible if window open. Inspect the duration state and response together when evaluating this retry scheduling boundary.

### W25 example 3

Given wall clock jumps forward during wait, the expected result is monotonic spacing still enforced. Inspect the duration state and response together when evaluating this retry scheduling boundary.

### W25 example 4

Given next eligible retry after execution window, the expected result is expire rather than send. Inspect the duration state and response together when evaluating this retry scheduling boundary.

## 26. Queue fairness [W26]

W26: The service MUST select the oldest eligible order within each station priority class and prevent a blocked order from starving eligible orders in other stations.

Normative definition: definitions.md#Order.

Regional dispatch shares a bounded transport worker pool. One station can remain blocked by maintenance or warning delivery while another is ready to operate safely. Fairness concerns eligible work rather than raw queue position. Within a station priority class, admission sequence provides stable ordering when timestamps tie. The scheduler cannot use fairness as a reason to bypass station safety checks or change a caller priority. Queue inspection reports why an earlier item was skipped so operators do not mistake eligibility filtering for lost orders.

Operational interpretation for queue fairness:

### W26 example 1

Given two eligible same-priority orders at one station, the expected result is earlier admission selected first. Inspect the order state and response together when evaluating this queue fairness boundary.

### W26 example 2

Given oldest order blocked at Alder, Birch ready, the expected result is Birch receives service. Inspect the order state and response together when evaluating this queue fairness boundary.

### W26 example 3

Given equal timestamps within same priority class, the expected result is admission sequence breaks tie. Inspect the order state and response together when evaluating this queue fairness boundary.

### W26 example 4

Given high priority order under maintenance lock, the expected result is remains ineligible despite priority. Inspect the order state and response together when evaluating this queue fairness boundary.

## 27. Admission concurrency [W27]

W27: The service MUST admit at most one executing release per station and serialize reserve accounting across concurrent requests.

Normative definition: definitions.md#Order.

Two valid requests evaluated against the same storage snapshot can jointly violate the reserve floor. The service therefore makes admission and reservation a single serializable operation for each station. Regional concurrency is still possible because independent stations have independent physical equipment and storage. The executing-release restriction includes orders whose physical start is recorded but whose completion receipt is outstanding. Uncertainty does not free the station for another release simply because a client stopped waiting for the first result.

Operational interpretation for admission concurrency:

### W27 example 1

Given two requests each individually fit but jointly exceed reserve, the expected result is only admissible serialized subset accepted. Inspect the order state and response together when evaluating this admission concurrency boundary.

### W27 example 2

Given one executing release and another start request, the expected result is second start refused or waits. Inspect the order state and response together when evaluating this admission concurrency boundary.

### W27 example 3

Given independent ready orders at Alder and Birch, the expected result is both may execute concurrently. Inspect the order state and response together when evaluating this admission concurrency boundary.

### W27 example 4

Given first order started but receipt missing, the expected result is station execution slot remains occupied. Inspect the order state and response together when evaluating this admission concurrency boundary.

## 28. Recovery replay [W28]

W28: The service MUST reconstruct reservations and order states from durable records after restart without reissuing completed or cancelled orders.

Normative definition: definitions.md#Revision.

The in-memory queue is a convenience, not the authoritative history. Recovery rebuilds it from durable state transitions and treats replay as reconstruction rather than a fresh request stream. Completion and cancellation have accounting effects exactly once across any number of restarts. An order whose transport outcome is uncertain remains uncertain until evidence resolves it. The startup process exposes readiness only after reconstruction has established the station reservations and execution slots needed for safe admission.

Operational interpretation for recovery replay:

### W28 example 1

Given restart after completion recorded, the expected result is completed order not sent again. Inspect the revision state and response together when evaluating this recovery replay boundary.

### W28 example 2

Given restart after cancellation recorded, the expected result is reservation remains released exactly once. Inspect the revision state and response together when evaluating this recovery replay boundary.

### W28 example 3

Given restart with admitted unstarted order, the expected result is reservation restored and eligibility rechecked. Inspect the revision state and response together when evaluating this recovery replay boundary.

### W28 example 4

Given restart with uncertain started order, the expected result is uncertainty and occupied slot preserved. Inspect the revision state and response together when evaluating this recovery replay boundary.

## 29. Read consistency [W29]

W29: The service MUST return order status and its accounting revision from one consistent snapshot and identify stale replicated reads explicitly.

Normative definition: definitions.md#Revision.

An operator may query a regional replica while the authoritative station controller is recording a receipt. Showing completed status with an old reserved volume would create a contradictory screen that appears to lose water. A response therefore names the revision represented by both fields. Replicas may serve history during an outage if they disclose staleness rather than pretending to be current authority. Admission never relies on a stale public read response as a substitute for its serialized authoritative state.

Operational interpretation for read consistency:

### W29 example 1

Given completion and reservation update commit together, the expected result is read shows both from same revision. Inspect the revision state and response together when evaluating this read consistency boundary.

### W29 example 2

Given replica lags primary by two revisions, the expected result is response marks replicated staleness. Inspect the revision state and response together when evaluating this read consistency boundary.

### W29 example 3

Given client supplies earlier read revision to admission, the expected result is server rechecks authoritative state. Inspect the revision state and response together when evaluating this read consistency boundary.

### W29 example 4

Given status unavailable at requested revision, the expected result is explicit unavailable result, not mixed fields. Inspect the revision state and response together when evaluating this read consistency boundary.

## 30. Export pagination [W30]

W30: The service MUST produce stable audit export pages using a snapshot boundary and an opaque continuation token without skipping or duplicating entries.

Normative definition: definitions.md#Audit.

Large incident exports span many requests while new decisions continue to arrive. Offset pagination over a changing stream can repeat entries or move them between pages. The first request fixes an upper audit sequence for the export, and later pages retain that boundary. Tokens are scoped to the requesting principal and export filter. A malformed or expired token is a visible error rather than a request for the first page, because silent restart would corrupt a downstream reconstruction.

Operational interpretation for export pagination:

### W30 example 1

Given new audit events arrive between export pages, the expected result is excluded beyond original snapshot boundary. Inspect the audit state and response together when evaluating this export pagination boundary.

### W30 example 2

Given valid continuation after first page, the expected result is next entries without duplicates. Inspect the audit state and response together when evaluating this export pagination boundary.

### W30 example 3

Given token reused with different station filter, the expected result is rejected as incompatible token. Inspect the audit state and response together when evaluating this export pagination boundary.

### W30 example 4

Given malformed or expired token supplied, the expected result is explicit token error rather than empty success. Inspect the audit state and response together when evaluating this export pagination boundary.

## 31. Retention cutoff [W31]

W31: The service MUST retain operational audit entries for at least 400 days and suspend deletion for stations under an active legal hold.

Normative definition: definitions.md#Duration.

Routine storage cleanup operates independently from control dispatch. Retention is measured from durable entry time rather than a possibly inaccurate field observation clock. Legal hold covers linked correction entries and receipts as well as admission decisions, preserving a coherent incident record. Removing a hold resumes normal eligibility checks but does not force immediate deletion. A failed cleanup job is observable and does not impair command safety by treating audit storage exhaustion as permission to stop recording decisions.

Operational interpretation for retention cutoff:

### W31 example 1

Given entry age 399 days without hold, the expected result is retained. Inspect the duration state and response together when evaluating this retention cutoff boundary.

### W31 example 2

Given entry age exactly 400 days without hold, the expected result is eligible under minimum retention boundary. Inspect the duration state and response together when evaluating this retention cutoff boundary.

### W31 example 3

Given entry age 500 days with active hold, the expected result is retained despite age. Inspect the duration state and response together when evaluating this retention cutoff boundary.

### W31 example 4

Given hold removed from old station records, the expected result is normal cleanup eligibility resumes. Inspect the duration state and response together when evaluating this retention cutoff boundary.

## 32. Secret redaction [W32]

W32: The service MUST exclude credentials and raw authorization headers from logs, audit exports and user-visible error details.

Normative definition: definitions.md#Principal.

A useful operational trace can identify the actor without carrying the token that allowed the actor to authenticate. Redaction applies on success paths and error paths, including malformed requests that trigger validation before a normal principal object exists. Station serial numbers are operational identifiers, not authentication material, and remain available where appropriate. A diagnostic request for verbose logging does not waive this boundary. Tests use synthetic secret markers so accidental disclosure is detectable without introducing actual credentials into the fixture.

Operational interpretation for secret redaction:

### W32 example 1

Given valid request carries synthetic bearer marker, the expected result is marker absent from logs and exports. Inspect the principal state and response together when evaluating this secret redaction boundary.

### W32 example 2

Given malformed authorization header triggers error, the expected result is raw header absent from error detail. Inspect the principal state and response together when evaluating this secret redaction boundary.

### W32 example 3

Given operator requests verbose incident export, the expected result is credentials still excluded. Inspect the principal state and response together when evaluating this secret redaction boundary.

### W32 example 4

Given audit entry names authenticated principal, the expected result is stable principal identifier remains available. Inspect the principal state and response together when evaluating this secret redaction boundary.

## 33. Rate isolation [W33]

W33: The service MUST limit each submitting principal to 30 admission attempts per rolling minute without charging read-only queries against that budget.

Normative definition: definitions.md#Principal.

A misconfigured client should not monopolize the admission service or prevent operators from inspecting an incident. Attempts count whether admission succeeds or fails safety validation, because both consume serialized work. Authentication failures without a known principal use a separate protective mechanism outside this fixture; they do not charge an arbitrary victim account. The response provides a retry delay when the admission budget is exhausted. Administrative privilege does not silently bypass the budget unless a separate approved policy explicitly changes it.

Operational interpretation for rate isolation:

### W33 example 1

Given principal makes thirtieth attempt inside minute, the expected result is attempt admitted to normal validation. Inspect the principal state and response together when evaluating this rate isolation boundary.

### W33 example 2

Given same principal makes thirty-first attempt, the expected result is rate-limited before admission work. Inspect the principal state and response together when evaluating this rate isolation boundary.

### W33 example 3

Given principal queries history after thirty attempts, the expected result is read remains available. Inspect the principal state and response together when evaluating this rate isolation boundary.

### W33 example 4

Given another principal submits during first principal limit, the expected result is independent budget applies. Inspect the principal state and response together when evaluating this rate isolation boundary.

## 34. Health semantics [W34]

W34: The service MUST report not-ready when durable storage or reservation reconstruction is unavailable while keeping liveness independent of downstream warning delivery.

Normative definition: definitions.md#Quality.

Load balancers need to know whether an instance can safely admit commands, not merely whether its process responds. An instance that cannot persist decisions is not ready for admission. Conversely, a failed downstream warning endpoint does not mean that the whole process is dead; restarting it repeatedly would lose diagnostic continuity and create unnecessary reconnection load. Health responses carry concise reason codes without exposing credentials or internal connection strings. Recovery transitions become visible only after the required readiness condition actually succeeds.

Operational interpretation for health semantics:

### W34 example 1

Given durable storage unavailable, the expected result is readiness false with storage reason. Inspect the quality state and response together when evaluating this health semantics boundary.

### W34 example 2

Given reservation reconstruction still running, the expected result is readiness false until complete. Inspect the quality state and response together when evaluating this health semantics boundary.

### W34 example 3

Given downstream warning destination unavailable, the expected result is liveness remains true, delivery alarm visible. Inspect the quality state and response together when evaluating this health semantics boundary.

### W34 example 4

Given process event loop healthy but admission unsafe, the expected result is live and not-ready are distinguishable. Inspect the quality state and response together when evaluating this health semantics boundary.

## 35. Metric dimensions [W35]

W35: The service MUST publish admitted, rejected and uncertain order counters by station and reason without using order identifiers as metric labels.

Normative definition: definitions.md#Audit.

Metrics support regional operations without creating one time series for every command. High-cardinality order identifiers belong in searchable event records, not label sets. Counter increments correspond to durable transitions so retries and duplicate receipts do not inflate physical activity reports. A rejection reason remains a bounded code rather than a free-form client string. Operators can link from a metric interval to audit records for details, preserving the distinction between aggregate observation and authoritative per-order evidence.

Operational interpretation for metric dimensions:

### W35 example 1

Given duplicate idempotent admission request, the expected result is no second admitted transition increment. Inspect the audit state and response together when evaluating this metric dimensions boundary.

### W35 example 2

Given reserve rejection recorded, the expected result is rejected counter increments with reserve code. Inspect the audit state and response together when evaluating this metric dimensions boundary.

### W35 example 3

Given delivery budget exhausted, the expected result is uncertain transition increments once. Inspect the audit state and response together when evaluating this metric dimensions boundary.

### W35 example 4

Given order has unique external identifier, the expected result is identifier absent from metric label keys. Inspect the audit state and response together when evaluating this metric dimensions boundary.

## 36. Simulation isolation [W36]

W36: The service MUST run preview calculations without allocating order identifiers, reservations, actuator messages or durable admission audit entries.

Normative definition: definitions.md#Order.

Engineers preview a release to understand its projected effect before asking for approval. A preview is not a partially admitted command and cannot consume scarce station capacity. The response includes the configuration and observation revisions used so the user knows that later admission may see changed inputs. Preview access itself may be logged as an access event, clearly separate from a command decision. A successful preview does not guarantee future admission and is never presented as measured physical release evidence.

Operational interpretation for simulation isolation:

### W36 example 1

Given preview valid proposed release, the expected result is projection returned without reservation. Inspect the order state and response together when evaluating this simulation isolation boundary.

### W36 example 2

Given preview would violate reserve, the expected result is predicted rejection without actual order. Inspect the order state and response together when evaluating this simulation isolation boundary.

### W36 example 3

Given actual admission follows earlier preview, the expected result is all checks rerun against current state. Inspect the order state and response together when evaluating this simulation isolation boundary.

### W36 example 4

Given preview endpoint called repeatedly, the expected result is no actuator message or order sequence allocation. Inspect the order state and response together when evaluating this simulation isolation boundary.

## 37. Emergency preference boundary [W37]

W37: The service MUST treat a caller urgency label as scheduling preference only and never bypass reserve, maintenance, lease or warning constraints.

Normative definition: definitions.md#Order.

Operators naturally mark requests urgent during storms. That label can influence ordering among otherwise eligible work, but it is not a universal override authority. Physical constraints and personnel safety remain binding. A genuinely different emergency operating policy requires a separately approved configuration or manual procedure with its own provenance. The normal API records the requested urgency and the checks it applied, allowing later review to distinguish an urgent rejected request from a silently relaxed safety rule.

Operational interpretation for emergency preference boundary:

### W37 example 1

Given urgent request below reserve floor, the expected result is rejected despite urgency. Inspect the order state and response together when evaluating this emergency preference boundary boundary.

### W37 example 2

Given urgent request under maintenance lock, the expected result is rejected despite scheduling preference. Inspect the order state and response together when evaluating this emergency preference boundary boundary.

### W37 example 3

Given urgent eligible request beside ordinary eligible work, the expected result is priority may affect scheduling. Inspect the order state and response together when evaluating this emergency preference boundary boundary.

### W37 example 4

Given caller writes override in free-text reason, the expected result is no new authority inferred from text. Inspect the order state and response together when evaluating this emergency preference boundary boundary.

## 38. Cross-region failover [W38]

W38: The service MUST grant replacement regional dispatch authority only after the previous lease expires or is durably revoked with a higher fencing token.

Normative definition: definitions.md#Lease.

A regional outage does not reveal whether the old controller has lost contact with every actuator. Failover waits for an authoritative ownership transition rather than treating failed health probes as proof of exclusive access. The replacement controller reconstructs station reservations before it admits work. Existing orders retain their identities through the move, and receipts from the old region are evaluated by order and fencing rules rather than discarded simply because the network origin changed. Availability is important, but it does not redefine ownership.

Operational interpretation for cross-region failover:

### W38 example 1

Given old region unreachable but lease unexpired, the expected result is replacement does not admit commands. Inspect the lease state and response together when evaluating this cross-region failover boundary.

### W38 example 2

Given old lease expired, new grant token advanced, the expected result is replacement may proceed after reconstruction. Inspect the lease state and response together when evaluating this cross-region failover boundary.

### W38 example 3

Given durable revocation recorded with higher token, the expected result is old token fenced immediately. Inspect the lease state and response together when evaluating this cross-region failover boundary.

### W38 example 4

Given late old-region receipt for valid completed order, the expected result is evaluated under receipt and fencing rules. Inspect the lease state and response together when evaluating this cross-region failover boundary.

## 39. Schema evolution [W39]

W39: The service MUST read the previous persisted order schema during rolling upgrade and reject unknown future schema versions without deleting their records.

Normative definition: definitions.md#Revision.

Regional nodes are upgraded in stages, so the storage layer can temporarily contain records written by two supported versions. Compatibility conversion preserves original identifiers, quantities and decision provenance. A node that encounters a future format it cannot interpret reports an explicit compatibility error and avoids destructive cleanup. The migration is not allowed to convert unknown data into an empty order list, because that would free reservations and permit unsafe duplicate work. Qualification exercises restart and mixed-version reads, not merely fresh installation.

Operational interpretation for schema evolution:

### W39 example 1

Given current node reads previous supported schema, the expected result is order semantics preserved. Inspect the revision state and response together when evaluating this schema evolution boundary.

### W39 example 2

Given older node encounters unknown future schema, the expected result is explicit incompatibility without deletion. Inspect the revision state and response together when evaluating this schema evolution boundary.

### W39 example 3

Given migration processes existing reservation, the expected result is quantity and identity unchanged. Inspect the revision state and response together when evaluating this schema evolution boundary.

### W39 example 4

Given rolling upgrade restarts while migration incomplete, the expected result is no false empty-state readiness. Inspect the revision state and response together when evaluating this schema evolution boundary.

## 40. Tail reconciliation [W40]

W40: The service MUST reconcile actual released volume against reservations at the end of an incident and report unresolved receipts separately from measured totals.

Normative definition: definitions.md#Receipt.

The incident closeout is the last place where a plausible guess can become an apparently authoritative number. Requested volume, reserved volume and measured released volume answer different questions and remain separate totals. An unresolved order is listed with its identity and missing evidence rather than assigned its requested volume as an estimate. Closeout can be produced with explicit uncertainty, but it cannot claim complete measured reconciliation until every included order has adequate receipt evidence. This tail requirement intentionally appears after the normal first-read truncation boundary.

Operational interpretation for tail reconciliation:

### W40 example 1

Given requested 100, authenticated actual receipt 80, the expected result is measured total increases by 80 only. Inspect the receipt state and response together when evaluating this tail reconciliation boundary.

### W40 example 2

Given requested 100 with no completion receipt, the expected result is unresolved list includes order, measured total unchanged. Inspect the receipt state and response together when evaluating this tail reconciliation boundary.

### W40 example 3

Given duplicate receipt included in incident range, the expected result is actual volume counted once. Inspect the receipt state and response together when evaluating this tail reconciliation boundary.

### W40 example 4

Given all receipts reconciled but qualification unrun, the expected result is measurement totals do not imply gate passed. Inspect the receipt state and response together when evaluating this tail reconciliation boundary.

## Safety note: Safety isolation

The service SHALL preserve independent station state when rejecting a command for another station.

Acceptance procedure: Submit an invalid Alder request while Birch has a valid reservation; compare Birch state before and after. This clause is not assigned a numbered source requirement ID. Its map entry uses a stable source/section/ordinal locator and retains the clause itself. The locator identifies existing authority; it does not create a new policy or reduce the meaning to a keyword. Qualification examines the observable boundary described here, including the failure path, alongside the numbered requirements that use the same underlying state.

## Safety note: Error visibility

The service MUST return a typed detectable error for malformed input rather than a successful empty result.

Acceptance procedure: Submit missing station and malformed volume; verify checked validation errors and no success-shaped empty order. This clause is not assigned a numbered source requirement ID. Its map entry uses a stable source/section/ordinal locator and retains the clause itself. The locator identifies existing authority; it does not create a new policy or reduce the meaning to a keyword. Qualification examines the observable boundary described here, including the failure path, alongside the numbered requirements that use the same underlying state.

## Safety note: Authority provenance

The service SHALL retain the source configuration revision used for every safety decision even after later configuration activation.

Acceptance procedure: Activate a new floor after a rejection; inspect the old audit record and verify its original revision remains. This clause is not assigned a numbered source requirement ID. Its map entry uses a stable source/section/ordinal locator and retains the clause itself. The locator identifies existing authority; it does not create a new policy or reduce the meaning to a keyword. Qualification examines the observable boundary described here, including the failure path, alongside the numbered requirements that use the same underlying state.

## Safety note: Evidence separation

The service MUST distinguish requested, reserved and physically measured volume in every incident summary.

Acceptance procedure: Mix completed, pending and uncertain orders; verify three distinct totals and the unresolved list. This clause is not assigned a numbered source requirement ID. Its map entry uses a stable source/section/ordinal locator and retains the clause itself. The locator identifies existing authority; it does not create a new policy or reduce the meaning to a keyword. Qualification examines the observable boundary described here, including the failure path, alongside the numbered requirements that use the same underlying state.

## Safety note: No implicit override

The service SHALL require explicit approved policy provenance before applying any deviation from these safety constraints.

Acceptance procedure: Submit a caller preference to skip warnings; verify no bypass occurs without a separately approved policy. This clause is not assigned a numbered source requirement ID. Its map entry uses a stable source/section/ordinal locator and retains the clause itself. The locator identifies existing authority; it does not create a new policy or reduce the meaning to a keyword. Qualification examines the observable boundary described here, including the failure path, alongside the numbered requirements that use the same underlying state.

## Safety note: Clock uncertainty

The service MUST surface unavailable time synchronization as an uncertainty instead of inventing a current observation timestamp.

Acceptance procedure: Disable clock evidence in a replay; inspect uncertainty and confirm no fabricated freshness qualification. This clause is not assigned a numbered source requirement ID. Its map entry uses a stable source/section/ordinal locator and retains the clause itself. The locator identifies existing authority; it does not create a new policy or reduce the meaning to a keyword. Qualification examines the observable boundary described here, including the failure path, alongside the numbered requirements that use the same underlying state.

## Safety note: Export confidentiality

The service SHALL apply the same secret redaction to incident exports as to live operational logs.

Acceptance procedure: Export malformed authentication attempts containing a synthetic token; inspect every output field for disclosure. This clause is not assigned a numbered source requirement ID. Its map entry uses a stable source/section/ordinal locator and retains the clause itself. The locator identifies existing authority; it does not create a new policy or reduce the meaning to a keyword. Qualification examines the observable boundary described here, including the failure path, alongside the numbered requirements that use the same underlying state.

## Safety note: Closeout completeness

The service MUST include unresolved safety and evidence gaps in an incident closeout even when every available unit test is green.

Acceptance procedure: Run happy-path tests with one receipt absent; verify closeout retains the missing-receipt gap and does not claim complete coverage. This clause is not assigned a numbered source requirement ID. Its map entry uses a stable source/section/ordinal locator and retains the clause itself. The locator identifies existing authority; it does not create a new policy or reduce the meaning to a keyword. Qualification examines the observable boundary described here, including the failure path, alongside the numbered requirements that use the same underlying state.

## Boundary qualification

QUAL-1 (Gate): Qualification SHALL execute all numbered and unnumbered boundary acceptance cases on the final candidate.

Retain command, exit status, complete output and candidate source/test hashes for all 48 obligation rows.

## Recovery qualification

QUAL-2 (Gate): Qualification SHALL execute restart, duplicate-message and concurrent-admission probes with durable state preserved.

Demonstrate restart after commit, duplicate completion and racing reserve requests; inspect actual state, not only response strings.

## Incident qualification

QUAL-3 (Gate): Qualification SHALL execute the annex incident replay and show unresolved evidence remains explicit in closeout.

Inspect mixed measured and missing receipts, tail W40 and all safety notes; retain final artifacts and actual measurements.


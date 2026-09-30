# Reservoir definitions

## Station
A registered physical reservoir and its gauge/actuator identity; a network address is not an identity.

## Instant
UTC observation or event time with second precision; an execution window is closed at its end instant.

## Level
An exact integer millimetre distance above the registered station datum.

## Quality
One of good, suspect, invalid; only good observations are eligible for automatic dispatch.

## Volume
A positive JavaScript safe integer number of litres for command input; accounting may also represent zero.

## Lease
Station-scoped exclusive dispatch ownership with an expiry and monotonically increasing fencing token.

## Order
A durable release intention with immutable identity, normalized content, lifecycle state and reservation.

## Receipt
Authenticated actuator evidence carrying order, actual litres, actuator, token and completion instant.

## Lock
A durable maintenance safety state changed only by explicitly authorized maintenance operations.

## Principal
An authenticated actor with current purpose-specific roles; never the raw bearer credential.

## Audit
Append-only decision and transition history with a durable sequence and source provenance.

## Revision
An immutable identity for a complete configuration or consistent durable state snapshot.

## Destination
A named downstream publication endpoint classified as required or optional by configuration.

## Duration
Elapsed time measured on a monotonic clock for scheduling and durable UTC age for retention.

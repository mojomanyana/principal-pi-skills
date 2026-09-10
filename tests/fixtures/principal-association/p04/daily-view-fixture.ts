import { buildWorkRevisionEvent, buildWorkSnapshotEvent, buildWorkOccurrenceEvent, buildWorkAcceptanceEvent,
  type WorkRevision, type WorkProjectionContext } from "../src/work-ledger.ts";
import { fixtureEventRef as eventRef, fixtureRevisionRef as ref, fixtureText, mutableFixture } from "./work-ledger-fixtures.ts";
const now = new Date("2026-09-08T00:00:00.000Z"), d = "a".repeat(64);
/** Fixed independently reconstructible simulation. No wire/claim/projection argument supplies authority. */
export function dailyFixture() {
  const revision = (kind: WorkRevision["kind"], id: string, patch: Partial<WorkRevision> = {}) => buildWorkRevisionEvent({ eventId: `daily:${id}`, now,
    revision: { kind, id, revision: 1, scopeId: "daily-scope", predecessor: null, contentDigest: d, parent: null, dependencies: [], ownerId: "fixed-controller", permittedEffects: [], policy: null, ...patch } });
  const scope = revision("scope", "daily-scope"), policy = revision("policy", "daily-policy");
  const intents = [1, 2, 3].map(i => revision("goal", `intent-${i}`, { parent: ref(scope) }));
  const obligations = intents.map((intent, i) => revision("obligation", `obligation-${i + 1}`, { parent: ref(intent), policy: ref(policy) }));
  const artifacts = [1, 2, 3].map(i => revision("artifact", `artifact-${i}`));
  const bindings = obligations.map((obligation, i) => ({ intent: ref(intents[i]), obligation: ref(obligation), artifact: ref(artifacts[i]), policy: ref(policy) }));
  const snapshot = buildWorkSnapshotEvent({ eventId: "daily:snapshot", now, snapshot: { snapshotId: "daily-selected", scope: ref(scope),
    revisions: [policy, ...intents, ...obligations, ...artifacts].map(ref), bindings } });
  const occurrences = obligations.map((obligation, i) => buildWorkOccurrenceEvent({ eventId: `daily:attempt:${i + 1}`, now, payload: {
    scope: ref(scope), obligation: ref(obligation), executionId: `exec:00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    parentExecutionId: null, childId: "reused-worker", variantId: null, artifact: ref(artifacts[i]), provenance: "observed", state: "completed",
    // Fixed P01 authority simulation only; never a claim of the P03 archive's live branch.
    labels: { sessionId: `fixture-session-${i + 1}`, branchLeafId: `fixture-leaf-${i + 1}`, toolCallId: null, taskId: null, workspaceId: null, definitionDigest: null, configurationDigest: null, modelId: null, effortId: null },
  } }));
  const claims = [0, 1].map(i => buildWorkAcceptanceEvent({ eventId: `daily:claim:${i + 1}`, now, payload: { authorityId: "fixed-controller", binding: {
    ...bindings[i], artifact: ref(artifacts[i]), artifactDigest: d, scope: ref(scope), snapshot: { id: snapshot.payload.snapshot.snapshotId, digest: snapshot.payload.snapshot.digest },
    evidence: [{ id: `evidence-${i + 1}`, digest: d, event: eventRef(occurrences[i]) }],
  } } }));
  const events = [scope, policy, ...intents, ...obligations, ...artifacts, snapshot, ...occurrences, ...claims];
  return { scope, snapshot, occurrences, claims, events, text: fixtureText(events) };
}
export function dailyAuthority(): WorkProjectionContext {
  const fixed = dailyFixture();
  return { selectedSnapshot: { snapshot: { id: fixed.snapshot.payload.snapshot.snapshotId, digest: fixed.snapshot.payload.snapshot.digest }, event: eventRef(fixed.snapshot) },
    authority: { snapshot: { id: fixed.snapshot.payload.snapshot.snapshotId, digest: fixed.snapshot.payload.snapshot.digest },
      decisions: fixed.claims.map((claim, i) => ({ receiptId: `fixed-receipt-${i + 1}`, authorityId: "fixed-controller", claim: eventRef(claim), binding: mutableFixture(claim.payload.binding), decision: "accept" })),
      availability: [1, 2].flatMap(i => [{ kind: "artifact" as const, id: `artifact-${i}`, digest: d, available: true }, { kind: "evidence" as const, id: `evidence-${i}`, digest: d, available: true }]),
    } };
}

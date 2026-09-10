/** Opt-in work-v4 wire identities; none of these declarations grants authority. */
export type WorkFrozen<T> = T extends ReadonlyArray<infer E>
  ? ReadonlyArray<WorkFrozen<E>>
  : T extends object ? { readonly [K in keyof T]: WorkFrozen<T[K]> } : T;
export type WorkInputCode =
  | "WORK_JSON_INVALID" | "WORK_DUPLICATE_MEMBER" | "WORK_LIMIT_EXCEEDED"
  | "WORK_VERSION_UNSUPPORTED" | "WORK_SCHEMA_INVALID"
  | "WORK_DIGEST_MISMATCH" | "WORK_CONTEXT_INVALID";

export class WorkInputError extends TypeError {
  readonly code: WorkInputCode;
  constructor(code: WorkInputCode) {
    super(code);
    this.name = "WorkInputError";
    this.code = code;
  }
}

export type WorkWriteCode = "WORK_DESTINATION_INVALID" | "WORK_DESTINATION_ALIAS" | "WORK_LEDGER_WRITE_FAILED";
export class WorkLedgerWriteError extends Error {
  readonly code: WorkWriteCode;
  constructor(code: WorkWriteCode) { super(code); this.name = "WorkLedgerWriteError"; this.code = code; }
}
export type WorkInspectionCode = "WORK_INSPECTION_PATH_INVALID" | "WORK_INSPECTION_NOT_REGULAR" | "WORK_INSPECTION_READ_FAILED";
export interface WorkInspectionDiagnostic { readonly line: null; readonly code: WorkInputCode | WorkInspectionCode }
export interface WorkLedgerInspection {
  readonly version: 4;
  readonly status: "read" | "missing" | "error";
  readonly exists: boolean | null;
  readonly ingestion: WorkIngestion | null;
  readonly projection: WorkProjection | null;
  readonly errors: ReadonlyArray<WorkInspectionDiagnostic>;
}

export type RevisionKind = "scope" | "goal" | "node" | "obligation" | "artifact" | "policy";
export type WorkEventKind = "work_revision" | "work_snapshot" | "work_occurrence" | "work_acceptance";
export interface RevisionRef { kind: RevisionKind; id: string; revision: number; digest: string }
export interface EventRef { eventId: string; digest: string }
export interface Identity { id: string; digest: string }
export interface WorkRevision {
  kind: RevisionKind;
  id: string;
  revision: number;
  scopeId: string;
  predecessor: RevisionRef | null;
  contentDigest: string;
  parent: RevisionRef | null;
  dependencies: RevisionRef[];
  ownerId: string;
  permittedEffects: string[];
  policy: RevisionRef | null;
  digest: string;
}
export interface ObligationBinding {
  intent: RevisionRef;
  obligation: RevisionRef;
  artifact: RevisionRef | null;
  policy: RevisionRef;
}
export interface WorkSnapshot {
  snapshotId: string;
  scope: RevisionRef;
  revisions: RevisionRef[];
  bindings: ObligationBinding[];
  digest: string;
}
export interface WorkOccurrencePayload {
  scope: RevisionRef;
  obligation: RevisionRef;
  executionId: string;
  parentExecutionId: string | null;
  childId: string | null;
  variantId: string | null;
  artifact: RevisionRef | null;
  provenance: "declared" | "observed";
  state: "unknown" | "starting" | "running" | "completed" | "failed";
  labels: {
    sessionId: string | null;
    branchLeafId: string | null;
    toolCallId: string | null;
    taskId: string | null;
    workspaceId: string | null;
    definitionDigest: string | null;
    configurationDigest: string | null;
    modelId: string | null;
    effortId: string | null;
  };
}
export interface EvidenceRef { id: string; digest: string; event: EventRef | null }
export interface AcceptanceBinding {
  snapshot: Identity;
  scope: RevisionRef;
  intent: RevisionRef;
  obligation: RevisionRef;
  artifact: RevisionRef;
  artifactDigest: string;
  policy: RevisionRef;
  evidence: EvidenceRef[];
}
export interface WorkAcceptancePayload { authorityId: string; binding: AcceptanceBinding }
interface WorkEvent<K extends WorkEventKind, P> {
  ledgerVersion: 4;
  event: K;
  eventId: string;
  ts: string;
  payload: P;
  digest: string;
}
export type WorkRevisionEvent = WorkEvent<"work_revision", { revision: WorkRevision }>;
export type WorkSnapshotEvent = WorkEvent<"work_snapshot", { snapshot: WorkSnapshot }>;
export type WorkOccurrenceEvent = WorkEvent<"work_occurrence", WorkOccurrencePayload>;
export type WorkAcceptanceEvent = WorkEvent<"work_acceptance", WorkAcceptancePayload>;
export type WorkLedgerEvent = WorkRevisionEvent | WorkSnapshotEvent | WorkOccurrenceEvent | WorkAcceptanceEvent;
export interface WorkDiagnostic { readonly line: number | null; readonly code: WorkInputCode }
export interface WorkIngestion {
  readonly events: ReadonlyArray<WorkLedgerEvent>;
  readonly errors: ReadonlyArray<WorkDiagnostic>;
  readonly complete: boolean;
}

export type WorkResolutionCode =
  | "INPUT_INCOMPLETE" | "NO_SELECTION" | "REFERENCE_MISSING"
  | "SCOPE_INVALID" | "REVISION_INVALID" | "CYCLE" | "DEPENDENCY_INVALID"
  | "EVENT_CONFLICT" | "ARTIFACT_UNSELECTED" | "ARTIFACT_DIGEST_MISMATCH"
  | "NO_CLAIM" | "SUPERSEDED_BINDING" | "AUTHORITY_MISSING"
  | "RECEIPT_MISSING" | "RECEIPT_MISMATCH" | "RECEIPT_CONFLICT" | "DECISION_CONFLICT"
  | "TRUSTED_REJECTION" | "AVAILABILITY_MISSING" | "BYTES_UNAVAILABLE"
  | "AVAILABILITY_CONFLICT" | "OCCURRENCE_CONFLICT"
  | "PARENT_MISSING" | "PARENT_CYCLE" | "OBSERVATION_CONFLICT" | "BRANCH_UNKNOWN";
export type WorkReference =
  | { readonly type: "revision"; readonly ref: RevisionRef }
  | { readonly type: "event"; readonly ref: EventRef }
  | { readonly type: "snapshot" | "authority" | "artifact-bytes" | "evidence-bytes"; readonly ref: Identity }
  | { readonly type: "execution"; readonly id: string };
export interface WorkProblem {
  readonly code: WorkResolutionCode;
  readonly reference: WorkReference | null;
  readonly affectedObligations: ReadonlyArray<RevisionRef>;
}
export interface WorkConflict {
  readonly kind: "event" | "receipt";
  readonly id: string;
  readonly digests: ReadonlyArray<string>;
  readonly affectedObligations: ReadonlyArray<RevisionRef>;
}

/** Explicit trusted-host declarations, never constructed from wire evidence by production code. */
export interface WorkProjectionContext {
  selectedSnapshot: { snapshot: Identity; event: EventRef } | null;
  authority: {
    snapshot: Identity;
    decisions: Array<{
      receiptId: string;
      authorityId: string;
      claim: EventRef;
      binding: AcceptanceBinding;
      decision: "accept" | "reject";
    }>;
    availability: Array<{ kind: "artifact" | "evidence"; id: string; digest: string; available: boolean }>;
  } | null;
}
export type WorkAvailability = "available" | "unavailable" | "unknown" | "conflicted";
export interface WorkCoverageItem {
  readonly kind: "artifact" | "evidence";
  readonly identity: Identity;
  readonly state: WorkAvailability;
}
export interface WorkCoverage {
  readonly state: WorkAvailability | "unselected";
  readonly items: ReadonlyArray<WorkCoverageItem>;
}
export type WorkAcceptanceState = "accepted-under-supplied-authority" | "unaccepted" | "unresolved";
export interface WorkClaimResult {
  readonly claim: EventRef;
  readonly obligation: RevisionRef;
  readonly applicability: WorkAcceptanceState | "superseded";
  readonly matchedReceiptIds: ReadonlyArray<string>;
  readonly problems: ReadonlyArray<WorkProblem>;
}
export interface WorkObligationResult {
  readonly binding: ObligationBinding;
  readonly acceptance: WorkAcceptanceState;
  readonly artifactCoverage: WorkCoverage;
  readonly evidenceCoverage: WorkCoverage;
  readonly claims: ReadonlyArray<EventRef>;
  readonly problems: ReadonlyArray<WorkProblem>;
}
export interface WorkOccurrenceView { readonly event: EventRef; readonly payload: WorkOccurrencePayload }
export interface WorkAttemptBinding {
  readonly scope: RevisionRef;
  readonly obligation: RevisionRef;
  readonly variantIds: ReadonlyArray<string>;
  readonly artifacts: ReadonlyArray<RevisionRef>;
}
export interface WorkAttempt {
  readonly executionId: string;
  readonly bindings: ReadonlyArray<WorkAttemptBinding>;
  readonly parentExecutionId: string | null;
  readonly childId: string | null;
  readonly declaredLabels: ReadonlyArray<WorkOccurrencePayload["labels"]>;
  readonly observedLabels: ReadonlyArray<WorkOccurrencePayload["labels"]>;
  readonly effectiveLabels: WorkOccurrencePayload["labels"];
  readonly state: WorkOccurrencePayload["state"] | "conflicted";
  readonly resolution: "resolved" | "unresolved";
  readonly problems: ReadonlyArray<WorkProblem>;
}
export interface WorkRuntimeCounts {
  readonly attempts: number;
  readonly variants: number;
  readonly observedCompletedAttempts: number;
}
export interface WorkRuntime {
  readonly counts: WorkRuntimeCounts;
  readonly occurrences: ReadonlyArray<WorkOccurrenceView>;
  readonly attempts: ReadonlyArray<WorkAttempt>;
}
export interface WorkProjection {
  readonly selectedSnapshot: Identity | null;
  readonly authoritySnapshot: Identity | null;
  readonly scopeState: "unselected" | "valid" | "unresolved" | "invalid";
  readonly progress: Readonly<{ accepted: number; total: number }> | null;
  readonly obligations: ReadonlyArray<WorkObligationResult>;
  readonly claims: ReadonlyArray<WorkClaimResult>;
  readonly supersededClaims: number;
  readonly conflicts: ReadonlyArray<WorkConflict>;
  readonly problems: ReadonlyArray<WorkProblem>;
  readonly errors: ReadonlyArray<WorkDiagnostic>;
  readonly runtime: WorkRuntime | null;
}

import { projectWorkLedger, parseWorkLedgerText, type WorkProjectionContext, type WorkFrozen, type RevisionRef } from "./work-ledger.ts";
import { canonicalWorkJson, copyWorkJson } from "./work-ledger-json.ts";
import { readDailySnapshot, parseArchiveProjection, freezeDaily, type ArchiveExecution } from "./daily-view-input.ts";

export const DAILY_VIEW_VERSION = "pi-daddy-daily-view-v1" as const;
export interface DailyViewOptions {
  archiveProjectionPath?: string; workLedgerPath?: string;
  /** Genuine independently selected host authority only. Never populated from P03 or a context file. */
  workContext?: WorkFrozen<WorkProjectionContext>;
  /** Policy-authorized exact paths keyed by expected raw-manifest SHA256. No producer paths followed. */
  sourceManifestFiles?: Readonly<Record<string, string>>;
}
export interface DailyAttempt {
  executionId: string; logicalChildId: string | null; intentRuntime: string;
  archive: ArchiveExecution | null; sourceAvailability: Array<{ sha256: string; state: "available" | "missing" | "mismatch" | "error" }>;
  issues: string[]; activeBranch: null;
}
export interface DailyObligation {
  key: string; intent: RevisionRef; obligation: RevisionRef; policy: RevisionRef;
  acceptance: "accepted-under-supplied-authority" | "unaccepted" | "unresolved";
  artifactCoverage: string; evidenceCoverage: string; receiptIds: string[]; claimReferences: string[];
  attempts: string[]; activity: "unstarted" | "attempts-attached"; obstacles: string[];
}
export interface DailyView {
  version: typeof DAILY_VIEW_VERSION; readOnly: true; freshness: "snapshot-unknown";
  model: "not-consulted-connectivity-unknown"; continuity: "initial-snapshot" | "resnapshot" | "reconnected-gap";
  scopeChanged: boolean; scope: RevisionRef | null; selectedSnapshot: WorkProjectionContext["selectedSnapshot"];
  scopeState: string; progress: { accepted: number; total: number } | null;
  authority: "supplied-host-context" | "unavailable" | "stale-for-selection"; coverage: "partial";
  sources: { archive: string; work: string; archiveSha256: string | null; workSha256: string | null };
  obligations: DailyObligation[]; attempts: DailyAttempt[]; issues: string[]; narrative: string;
}
const refKey = (r: WorkFrozen<RevisionRef>) => `${r.kind}:${r.id}:${r.revision}:${r.digest}`;
const sorted = (values: readonly string[]) => [...new Set(values)].sort();
function contextCopy(value: DailyViewOptions["workContext"]): WorkProjectionContext {
  const copied = JSON.parse(canonicalWorkJson(copyWorkJson(value ?? { selectedSnapshot: null, authority: null }))) as WorkProjectionContext;
  if (projectWorkLedger("", copied).errors.some(e => e.code === "WORK_CONTEXT_INVALID")) throw new TypeError("invalid independent P01 context");
  return copied;
}
const readers = new WeakSet<object>();
/** Only actual factory readers may carry continuity state through the dashboard; not arbitrary callbacks. */
export function isDailyViewReader(value: unknown): value is ReturnType<typeof createDailyViewReader> {
  return typeof value === "function" && readers.has(value);
}
/** Each read starts from complete bounded snapshots. The tracker holds only gap/scope metadata, not authority. */
export function createDailyViewReader() {
  let seen = false, gap = false, lastSelection = "";
  const read = async (options: DailyViewOptions): Promise<DailyView> => {
    try {
    const archivePath = options.archiveProjectionPath, workPath = options.workLedgerPath;
    const context = contextCopy(options.workContext);
    const files = Object.fromEntries(Object.entries(options.sourceManifestFiles ?? {}));
    if (Object.keys(files).length > 128 || Object.entries(files).some(([key, value]) => !/^[a-f0-9]{64}$/.test(key) || typeof value !== "string")) throw new TypeError("bounded explicit source file map required");
    const [archiveRead, workRead] = await Promise.all([readDailySnapshot(archivePath), readDailySnapshot(workPath, 16 * 1024 * 1024)]);
    let archiveStatus: string = archiveRead.status, workStatus: string = workRead.status;
    let archive: ArchiveExecution[] = [], work = projectWorkLedger("", context), workText = "";
    const issues: string[] = [];
    if (archiveRead.status === "read") {
      try { archive = parseArchiveProjection(new TextDecoder("utf-8", { fatal: true }).decode(archiveRead.bytes)).executions; }
      catch { archiveStatus = "error"; issues.push("archive-invalid-or-unsupported-version"); }
    }
    if (workRead.status === "read") {
      try { workText = new TextDecoder("utf-8", { fatal: true }).decode(workRead.bytes); work = projectWorkLedger(workText, context); }
      catch { workStatus = "error"; issues.push("work-input-invalid"); }
      if (work.errors.length) { workStatus = "error"; issues.push("work-projection-errors"); }
    }
    const selection = JSON.stringify(context.selectedSnapshot), scopeChanged = seen && selection !== lastSelection;
    const unavailable = archiveStatus !== "read" || (Boolean(workPath) && workStatus !== "read");
    if (unavailable) gap = true;
    const continuity = seen ? gap && !unavailable ? "reconnected-gap" : "resnapshot" : "initial-snapshot";
    seen = true; lastSelection = selection;
    if (scopeChanged) issues.push("scope-selection-changed; prior acceptance not carried forward");
    if (gap) issues.push("observation-gap; resnapshot is not continuity");
    if (archiveStatus !== "read") issues.push(`archive-${archiveStatus}`);
    if (workStatus !== "read") issues.push(`work-${workStatus}`);
    const authority: DailyView["authority"] = !context.authority ? "unavailable" :
      context.authority.snapshot.id !== context.selectedSnapshot?.snapshot.id || context.authority.snapshot.digest !== context.selectedSnapshot?.snapshot.digest
        ? "stale-for-selection" : "supplied-host-context";
    if (authority !== "supplied-host-context") issues.push(`host-authority-${authority}`);
    const events = workText && work.scopeState === "valid" ? parseWorkLedgerText(workText).events : [];
    const selected = events.find(e => e.event === "work_snapshot" && e.eventId === context.selectedSnapshot?.event.eventId && e.digest === context.selectedSnapshot.event.digest);
    const scope = selected?.event === "work_snapshot" ? selected.payload.snapshot.scope : null;
    const available = new Map<string, DailyAttempt["sourceAvailability"][number]["state"]>();
    const requested = sorted(archive.flatMap(e => e.sourceReferences));
    for (const sha256 of requested) {
      if (!files[sha256]) { available.set(sha256, "missing"); continue; }
      const source = await readDailySnapshot(files[sha256], 64 * 1024);
      available.set(sha256, source.status === "read" ? source.sha256 === sha256 ? "available" : "mismatch" : source.status === "error" ? "error" : "missing");
    }
    const attempts = new Map<string, DailyAttempt>();
    for (const attempt of work.runtime?.attempts ?? []) attempts.set(attempt.executionId, {
      executionId: attempt.executionId, logicalChildId: attempt.childId, intentRuntime: attempt.state, archive: null,
      sourceAvailability: [], issues: attempt.problems.map(p => `P01:${p.code}`), activeBranch: null,
    });
    for (const entry of archive) {
      const a = attempts.get(entry.executionId) ?? { executionId: entry.executionId, logicalChildId: null, intentRuntime: "unknown",
        archive: null, sourceAvailability: [], issues: [], activeBranch: null } as DailyAttempt;
      a.archive = entry; a.issues.push(...entry.issues.map(i => `P03:${i}`));
      a.sourceAvailability = entry.sourceReferences.map(sha256 => ({ sha256, state: available.get(sha256) ?? "missing" }));
      if (!entry.sourceReferences.length) a.issues.push("source-hashes-absent");
      if (a.sourceAvailability.some(r => r.state !== "available")) a.issues.push("source-bytes-unavailable-or-mismatched");
      const intent = work.runtime?.attempts.find(r => r.executionId === entry.executionId);
      if (intent && (entry.parentExecutionIds.length !== 1 || entry.parentExecutionIds[0] !== intent.parentExecutionId)) a.issues.push("P01-P03-parent-disagreement");
      if (intent && intent.state === "running" && entry.runtime === "terminal") a.issues.push("P01-P03-runtime-disagreement");
      a.issues = sorted(a.issues); attempts.set(a.executionId, a);
    }
    const obligations: DailyObligation[] = work.obligations.map(o => {
      const attached = (work.runtime?.attempts ?? []).filter(a => a.bindings.some(b => scope && refKey(b.scope) === refKey(scope) && refKey(b.obligation) === refKey(o.binding.obligation)));
      return {
        key: canonicalWorkJson(copyWorkJson(o.binding)), intent: o.binding.intent, obligation: o.binding.obligation, policy: o.binding.policy,
        acceptance: authority === "supplied-host-context" ? o.acceptance : "unresolved", artifactCoverage: o.artifactCoverage.state,
        evidenceCoverage: o.evidenceCoverage.state,
        receiptIds: sorted(work.claims.filter(c => o.claims.some(r => r.eventId === c.claim.eventId && r.digest === c.claim.digest)).flatMap(c => [...c.matchedReceiptIds])),
        claimReferences: o.claims.map(c => `${c.eventId}:${c.digest}`).sort(), attempts: attached.map(a => a.executionId).sort(),
        activity: attached.length ? "attempts-attached" : "unstarted", obstacles: sorted(o.problems.map(p => `P01:${p.code}`)),
      };
    });
    obligations.sort((a, b) => {
      const left = `${a.obligation.id}:${a.key}`, right = `${b.obligation.id}:${b.key}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });
    const progress = authority === "supplied-host-context" && workStatus === "read" ? work.progress : null;
    issues.push(...work.problems.map(p => `P01:${p.code}`));
    const view: DailyView = { version: DAILY_VIEW_VERSION, readOnly: true, freshness: "snapshot-unknown", model: "not-consulted-connectivity-unknown",
      continuity, scopeChanged, scope, selectedSnapshot: context.selectedSnapshot, scopeState: work.scopeState,
      progress, authority, coverage: "partial",
      sources: { archive: archiveStatus, work: workStatus, archiveSha256: archiveRead.status === "read" ? archiveRead.sha256 : null, workSha256: workRead.status === "read" ? workRead.sha256 : null },
      obligations, attempts: [...attempts.values()].sort((a, b) => a.executionId < b.executionId ? -1 : a.executionId > b.executionId ? 1 : 0), issues: sorted(issues),
      narrative: `${obligations.length} scoped obligation(s); ${progress ? `${progress.accepted}/${progress.total} accepted under supplied P01 authority` : "acceptance unresolved"}; ${attempts.size} distinct attempt(s). Runtime exits do not establish acceptance. Snapshot freshness unknown.`,
    };
    return freezeDaily(view);
    } catch (error) { gap = true; seen = true; throw error; }
  };
  readers.add(read); return read;
}
export const readDailyView = (options: DailyViewOptions): Promise<DailyView> => createDailyViewReader()(options);

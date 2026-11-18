// Recovery reads old facts as history; only producer-proven terminal no-start can create a successor.
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { reference } from "./progress-artifacts.mjs";
import { NativeWorkspaceMismatchError, observeCandidate, inspectRecoveryRecord, inspectRecoveryOperation, inspectRecoverySuccessor, inspectOwnedOperation, prepareRecoverySuccessor, automaticRetryBudget, historicalNativeResult } from "./workflow-state.mjs";

const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const same = (a, b) => canonical(a) === canonical(b);
const assert = (condition, message) => { if (!condition) throw Error(message); };
const identity = ctx => ({ sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) });
const refMatches = ref => ref && same(reference(ref.path), ref);

export function queryOperationRecovery(pi, ctx, source, authorize, signal) {
  const requester = identity(ctx), requestId = randomUUID();
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true; clearTimeout(timer); signal?.removeEventListener("abort", aborted);
      error ? reject(error) : resolve(value);
    };
    const aborted = () => finish(Error("Recovery observation aborted; original work remains unchanged"));
    const timer = setTimeout(() => finish(Error("Original execution status is unavailable; no replacement was created")), 5000);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) { aborted(); return; }
    try {
      pi.events.emit("pi-daddy:operation-recovery:v1", { version: 1, requestId, ...requester, source, authorize,
        reply(value) {
          if (!same(identity(ctx), requester) || !value || value.version !== 1 || value.requestId !== requestId ||
              value.sessionId !== requester.sessionId || value.cwd !== requester.cwd || !same(value.source, source)) {
            finish(Error("Recovery response identity changed; original work remains unchanged")); return;
          }
          if (value.qualified !== true || !value.observation) {
            finish(Error(value?.reason ?? "Original execution status could not be verified")); return;
          }
          finish(null, value.observation);
        },
      });
    } catch (error) { finish(error); }
  });
}

function producerNoStart(observation, source) {
  const operation = observation.operation, artifact = observation.artifact;
  return observation.noStartProven === true && observation.admission === "present" && observation.result === "present" &&
    operation?.operationId === source.operationId && operation.cwd === source.owner.cwd && operation.state === "not-started" &&
    operation.runtime?.cleanup?.state === "not-started" && observation.cleanup?.state === "not-started" &&
    (!operation.runtime.cleanup.executionId || operation.runtime.cleanup.executionId === operation.executionId) &&
    !operation.runtime.final && !observation.final && !observation.partial && [undefined, "unknown"].includes(operation.runtime.work) &&
    artifact?.version === 1 && artifact.producer === "pi-daddy" && same(artifact.owner, source.owner) &&
    artifact.operationId === source.operationId && artifact.executionId === operation.executionId &&
    typeof artifact.manifest?.path === "string" && isAbsolute(artifact.manifest.path) && /^[a-f0-9]{64}$/.test(artifact.manifest?.sha256 ?? "") &&
    Number.isSafeInteger(artifact.manifest?.bytes) && artifact.manifest.bytes > 0;
}
function delegationArguments(result) {
  return { agent: result.phase, operation_id: result.operation_id,
    ...(result.automaticRetryDefinitionId ? { definitionId: result.automaticRetryDefinitionId } : {}) };
}
// Follow-up arguments name the operation; its stored ID stays in operation_id for consumers that record it.
const named = operation => ({ task: operation.task, step: operation.step, attempt: operation.attempt });
function statusArguments(result) {
  return { action: "status", repo: result.root, ...named(result) };
}
const historicalView = result => ({ ...result, historical: true, completionValid: false,
  applicability: result.sourceRecovery ? "current-output" : "not-established" });

/** The supplied authorize callback protects current selected context across every asynchronous boundary. */
export async function recoverPreparedOperation(pi, ctx, request, signal, authorizeContext = () => {}) {
  const requester = identity(ctx), repo = request.repo ?? ctx.cwd;
  if (realpathSync(repo) !== requester.cwd) throw new NativeWorkspaceMismatchError(requester.cwd, realpathSync(repo));
  assert(request.mode === undefined || ["inspect", "continue", "retain"].includes(request.mode), "Unknown recovery mode");
  const selected = inspectRecoveryRecord(repo, request), record = selected.record, sourceReference = selected.sourceReference;
  const source = { owner: record.owner, operationId: record.operationId };
  const envelope = { version: 1, approval: false, administrativeWrites: false, operation_id: record.operationId,
    sourceOwner: record.owner, requester, sourceReference, automaticRetryBudget: automaticRetryBudget(repo, request) };
  const outcome = (state, nextAction, extra = {}) => ({ ...envelope, state, nextAction,
    ...(["uncertain", "historical", "existing-successor"].includes(state) ? { suggestedOptions: [
      { action: "inspect-original-session", label: "Check the original run", detail: "Use the recorded session and operation to establish what started, finished or remains active." },
      { action: "reconcile-current-output", label: "Inspect the files already delivered", detail: "Compare the actual files and retained findings before continuing only the remaining scope." },
      { action: "continue-independent-work", label: "Continue unrelated authorized work", detail: "Proceed where this operation's uncertain execution or cleanup is not a prerequisite." },
    ] } : {}), ...extra });
  const check = async () => {
    if (signal?.aborted) throw Error("Recovery aborted; original work remains unchanged");
    await authorizeContext();
    assert(same(identity(ctx), requester), "Session changed during recovery");
    assert(refMatches(sourceReference), "Recovery source changed; inspect the original again");
  };
  await check();
  if (request.sourceReference !== undefined) assert(same(request.sourceReference, sourceReference), "Recovery source changed since inspection");

  // A prior winner is reconciled before comparing the old candidate: that winner may have delivered changes.
  let existing;
  try { existing = inspectRecoverySuccessor(repo, record); }
  catch { return outcome("uncertain", "The next attempt has incomplete or unreadable stored state. Preserve it and inspect the original run and project files; no additional attempt was created."); }
  if (existing) {
    assert(existing.record.previous?.operationId === record.operationId, "The next attempt is unrelated; inspect it without replacing work");
    const successor = inspectRecoveryOperation(repo, { operationId: existing.record.operationId });
    const extra = { successor: historicalView(successor), recoverArguments: { action: "recover", ...named(successor) } };
    if (successor.resultRetained && successor.candidateMatches && successor.inputsMatch && !successor.issues?.length) {
      return outcome("reused", "Reuse the successor's delivered output and recorded checks; do not repeat its work.", { ...extra, report: successor.report,
        ...(successor.authoredReport ? { authoredReport: successor.authoredReport } : {}), sourceRecovery: successor.sourceRecovery });
    }
    try {
      assert(same(existing.record.previous?.recovery?.sourceReference, sourceReference), "successor has a different recovery lineage");
      const owned = inspectOwnedOperation(repo, { operationId: successor.operation_id }, requester);
      if (owned.state === "prepared" && owned.candidateMatches && owned.inputsMatch && !owned.issues?.length) {
        assert(record.owner?.cwd === requester.cwd, "original recovery owner is outside the selected folder");
        const proof = await queryOperationRecovery(pi, ctx, source, check, signal);
        await check();
        assert(producerNoStart(proof, source) && same(proof.artifact, existing.record.previous.recovery.artifact), "original no-start proof is unavailable or changed");
        assert(refMatches(existing.sourceReference), "successor changed during recovery inspection");
        const refreshed = inspectOwnedOperation(repo, { operationId: successor.operation_id }, requester);
        assert(refreshed.state === "prepared" && refreshed.candidateMatches && refreshed.inputsMatch && !refreshed.issues?.length, "successor candidate or inputs changed during recovery inspection");
        return outcome("recovered", "Use this existing successor's exact native claim; do not allocate another attempt.",
          { ...extra, successor: refreshed, delegationArguments: delegationArguments(refreshed), statusArguments: statusArguments(refreshed), reused: true });
      }
    } catch { await check(); /* Older/foreign ownership is inspectable but never adopted; revoked context is not. */ }
    return outcome("existing-successor", "Inspect the existing successor's status and output; it belongs to its recorded coordinator.", extra);
  }

  const retained = inspectRecoveryOperation(repo, request);
  if (retained.resultRetained) {
    return outcome(retained.candidateMatches && retained.inputsMatch && !retained.issues?.length ? "reused" : "historical",
      retained.candidateMatches && retained.inputsMatch && !retained.issues?.length
        ? "Reuse delivered output and historical checks. Reconcile remaining requirements and continue only unmet authorized work without rebuilding completed parts. Obtain independent Review when the deliverable is ready."
        : "Preserve this delivered output. Reconcile the changed files or inputs and continue only the remaining authorized work.",
      { report: retained.report, ...(retained.authoredReport ? { authoredReport: retained.authoredReport } : {}), disposition: retained.disposition, candidateMatches: retained.candidateMatches, inputsMatch: retained.inputsMatch,
        issues: retained.issues, sourceRecovery: retained.sourceRecovery, completionValid: false, historical: true });
  }
  if (!record.owner) {
    return outcome("uncertain", "The saved preparation has no matching original coordinator in this folder. Inspect its files and original session; no new attempt was created.");
  }
  if (record.owner.cwd !== requester.cwd || record.root !== requester.cwd) {
    return outcome("uncertain", "The saved preparation has no matching original coordinator workspace. Preserve its output and exact producer references as historical evidence; inspect the original session and current files. Selecting another folder cannot repair a recorded native workspace mismatch or establish original completion. No new attempt was created.",
      { code: "NATIVE_WORKSPACE_MISMATCH", diagnostic: { kind: "native-workspace", selectedFolder: requester.cwd,
        repositoryRoot: record.root, originalOwnerFolder: record.owner?.cwd ?? null } });
  }
  let observation;
  try { observation = await queryOperationRecovery(pi, ctx, source, check, signal); }
  catch (error) { await check(); return outcome("uncertain", error.message); }
  await check();
  const base = { observation, candidateMatches: retained.candidateMatches, inputsMatch: retained.inputsMatch };
  if (observation.final?.state === "complete" && observation.cleanup?.state === "settled" &&
      observation.operation?.state === "settled" && observation.operation?.runtime?.work === "succeeded") {
    await check();
    const history = historicalNativeResult(repo, request, observation, requester, request.mode === "retain");
    await check();
    return outcome("historical", history.resultRetained
      ? "The exact prior final and any authored report are retained as history, not proof of complete delivery. Reconcile current files, authority and remaining requirements; continue unmet authorized work without repeating completed parts. When ready, prepare a fresh independently scoped Review with these report references. No original Build output snapshot was retained: this does not satisfy a bound work-map Build completion gate."
      : history.retainArguments
        ? "For authorized continuation, retain the exact historical final with retainArguments, then reconcile current files and unfinished requirements. Continue unmet authorized work; fresh independent Review follows when ready. Recall-only requests should read the supplied final without writing."
        : "The exact prior final is historical evidence. Required inputs changed; reconcile current authority before retaining or reviewing it. Do not repeat completed work.",
      { ...base, ...history, final: observation.final });
  }
  assert(request.mode !== "retain", "Only a verified complete historical final with settled cleanup can be retained; inspect the original without repeating work");
  if (producerNoStart(observation, source)) {
    if (!retained.candidateMatches || !retained.inputsMatch || retained.issues?.length) {
      return outcome("historical", "The original operation never started, but its files or inputs changed. Reconcile the current scope before preparing remaining work.", base);
    }
    const current = observeCandidate(repo);
    const continueArguments = { action: "recover", mode: "continue", ...named(record), sourceReference, expectedCandidate: current };
    if (request.mode !== "continue") return outcome("ready-to-continue", "The original operation is proven unstarted. Continue the authorized work with the supplied arguments.", { ...base, continueArguments });
    assert(request.sourceReference !== undefined && request.expectedCandidate !== undefined, "Continue with the exact arguments returned by recovery inspection");
    assert((typeof request.expectedCandidate === "string" ? request.expectedCandidate : request.expectedCandidate.id) === current.id,
      "The candidate changed since recovery inspection; inspect again before continuation");
    await check();
    let successor;
    try { successor = prepareRecoverySuccessor(repo, record, sourceReference, requester, request.expectedCandidate, observation.artifact); }
    catch (error) {
      const winner = inspectRecoverySuccessor(repo, record);
      if (winner?.record.previous?.operationId === record.operationId) {
        return outcome("existing-successor", "Another coordinator already created this continuation. Inspect that exact successor; do not start another child.",
          { successor: historicalView(inspectRecoveryOperation(repo, { operationId: winner.record.operationId })), recoverArguments: { action: "recover", ...named(winner.record) } });
      }
      throw error;
    }
    return outcome("recovered", "Continue using the successor's exact operation and current native definition. The original record is preserved.",
      { successor, administrativeWrites: !successor.reused, reused: successor.reused,
        delegationArguments: delegationArguments(successor), statusArguments: statusArguments(successor) });
  }
  if (observation.operation?.state === "running" || observation.operation?.state === "pending") {
    return outcome("running", "The original work is still active. Follow that operation; do not start another child.", base);
  }
  if (observation.cleanup?.state === "settled") {
    return outcome("historical", "The prior execution has settled. Read its retained findings and reconcile the actual files; do not assume the task is complete or repeat completed parts.",
      { ...base, ...(observation.final ? { final: observation.final } : {}), ...(observation.partial ? { partial: observation.partial } : {}) });
  }
  return outcome("uncertain", "The original execution or cleanup is not proven. Inspect its original session or retained result; unrelated authorized work can continue. No replacement was created.", base);
}

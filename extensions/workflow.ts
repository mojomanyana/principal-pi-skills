// Coordinator-only bookkeeping. Native execution and semantic approval remain separate.
import { realpathSync } from "node:fs";
import { Type } from "typebox";
import { CandidateIdentityError, PrepareInputError, PreparedOutputChangedError, CompletedResultRetryError, ContextInputError, NativeWorkspaceMismatchError, requireNativeWorkspace, WORKFLOW_TASK_NAME, WORKFLOW_STEP_NAME, observeSnapshot, prepareOperation, inspectOperation, completeOperation, retryOperation, observeOperationResult, registerCandidateObserver, inspectOwnedOperation, inspectHistoricalOperation, observeHistoricalOperation, inspectRecoveryRecord, inspectRecoverySuccessor, inspectRecoveryOperation } from "../scripts/workflow-state.mjs";
import { reference } from "../scripts/progress-artifacts.mjs";
import { freezeSnapshot } from "../scripts/frozen-snapshot.mjs";
import { observeGitResource, observeIntegrationSubject, observePackageRelease, packageReleaseEffectTarget } from "../scripts/continuity.mjs";
import { queryRuntimeOperation } from "../scripts/runtime-operation-query.mjs";
import { inspectProject, ProjectSetupError } from "../scripts/project-setup.mjs";
import { createProjectSetup } from "./project-setup.ts";
import { inspectVerification, criterionCoverage } from "../scripts/check-runner.mjs";
import { recoverPreparedOperation } from "../scripts/prepared-recovery.mjs";

const ref = Type.Object({ path: Type.String(), sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, { additionalProperties: false });
const choice = values => Type.Union(values.map(value => Type.Literal(value)));
const parameters = Type.Object({
  action: choice(["preflight", "setup", "snapshot", "reference", "prepare", "status", "complete", "retry", "result", "history", "recover", "resource", "freeze", "verification"]),
  mode: Type.Optional(choice(["inspect", "continue", "retain"])), sourceReference: Type.Optional(ref), producerReference: Type.Optional(ref),
  expectedSubject: Type.Optional(Type.Object({ kind: Type.Literal("principal-integration") }, { additionalProperties: true })),
  packageRelease: Type.Optional(Type.Object({ packagePath: Type.String({ maxLength: 1024 }), registry: Type.String({ maxLength: 1024 }) }, { additionalProperties: false })),
  repositories: Type.Optional(Type.Array(Type.String(), { minItems: 1, maxItems: 16 })),
  repo: Type.Optional(Type.String()), path: Type.Optional(Type.String()),
  operationId: Type.Optional(Type.String({ description: "Optional; task and step select a prepared operation. result also accepts a generic native operation ID." })),
  task: Type.Optional(Type.String(WORKFLOW_TASK_NAME)), step: Type.Optional(Type.String(WORKFLOW_STEP_NAME)),
  attempt: Type.Optional(Type.Integer({ minimum: 1 })),
  phase: Type.Optional(choice(["plan", "build", "review", "test-review", "debug", "investigate"])),
  expectedCandidate: Type.Optional(Type.Union([Type.String(), Type.Object({
    algorithm: Type.Literal("principal-candidate-v1"), root: Type.String(), id: Type.String(),
  }, { additionalProperties: true })])),
  inputPaths: Type.Optional(Type.Array(Type.String(), { maxItems: 128, description: "Immutable authority/evidence files. Edits invalidate completion. Put editable product files in contextPaths." })),
  inputs: Type.Optional(Type.Array(ref, { maxItems: 128, description: "Exact immutable authority/evidence references; never editable context." })),
  contextPaths: Type.Optional(Type.Array(Type.String(), { maxItems: 128, description: "Readable, nonignored workspace product files expected to change. Advisory paths, not prerequisite hashes or permission. Cannot overlap inputs." })),
  evidence: Type.Optional(Type.Array(ref, { maxItems: 128 })),
  criteria: Type.Optional(Type.Array(Type.Object({
    id: Type.String({ pattern: WORKFLOW_TASK_NAME.pattern }), scope: Type.Optional(choice(["worktree", "declared-inputs"])),
    dependencies: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 1024 }), { minItems: 1, maxItems: 32 })), requirement: Type.String({ minLength: 1, maxLength: 512 }),
    expected: Type.Optional(Type.Union([Type.String({ maxLength: 256 }), Type.Integer(), Type.Boolean()])),
    required: Type.Optional(Type.Boolean()), fresh: Type.Optional(Type.Boolean()),
  }, { additionalProperties: false }), { maxItems: 32 })),
  reviewBinding: Type.Optional(Type.Object({
    initiativeId: Type.String(), taskId: Type.String(), taskRevision: Type.String(), outputId: Type.String(),
    outputReference: Type.Object({ owner: Type.Literal("principal"), reference: Type.Object({ kind: Type.Literal("principal-git") }, { additionalProperties: true }) }, { additionalProperties: false }),
    sourceOperationId: Type.String(), sourceRecovery: Type.Optional(Type.Object({ kind: Type.Literal("principal-completed-recovery") }, { additionalProperties: true })), reviewScope: choice(["task", "integrated"]),
    integrationSubject: Type.Optional(Type.Object({ kind: Type.Literal("principal-integration") }, { additionalProperties: true })),
  }, { additionalProperties: false })),
  disposition: Type.Optional(choice(["succeeded", "changes-requested", "unverified", "blocked"])),
  reason: Type.Optional(Type.String()),
  retryMode: Type.Optional(choice(["automatic", "manual"])),
}, { additionalProperties: false });
const outputSchema = Type.Object({
  version: Type.Literal(1), state: Type.String(), approval: Type.Literal(false),
  operation_id: Type.Optional(Type.String()), reportPath: Type.Optional(Type.String()),
  delegationArguments: Type.Optional(Type.Object({ agent: Type.String(), operation_id: Type.String(), definitionId: Type.Optional(Type.String()) }, { additionalProperties: false })),
  statusArguments: Type.Optional(Type.Object({ action: Type.Literal("status"), repo: Type.String(), task: Type.String(), step: Type.String(), attempt: Type.Integer({ minimum: 1 }) }, { additionalProperties: false })),
  candidateMatches: Type.Optional(Type.Boolean()), reused: Type.Optional(Type.Boolean()),
  error: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
}, { additionalProperties: true });

// Presentation and argument recovery stay outside the fingerprinted operation implementation.
const preparedActions = new Set(["prepare", "status", "complete", "retry", "history", "recover"]);
class OperationIdentityError extends Error {
  constructor(request) {
    super("invalid Principal operationId: omit it and name the prepared operation's task and step");
    this.code = "OPERATION_ID_INVALID";
    this.administrativeWrites = false;
    this.diagnostic = { kind: "operation-identity", field: "operationId", expected: "principal:<64 lowercase hexadecimal characters>" };
    const named = typeof request.task === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(request.task) && !/[^a-zA-Z0-9_-]/.test(request.task) &&
      typeof request.step === "string" && request.step.length <= 200 && /\S/.test(request.step) &&
      (request.attempt === undefined || Number.isSafeInteger(request.attempt) && request.attempt > 0) && (request.repo === undefined || typeof request.repo === "string");
    this.recovery = { action: "inspect-existing", message: "Omit operationId and select the operation by the task and step given to prepare; status inspects it read-only. Do not reconstruct a digest, guess a matching record, prepare a replacement or dispatch again. This correction does not establish whether prior work started or settled.",
      ...(named ? { statusArguments: { action: "status", ...(request.repo === undefined ? {} : { repo: request.repo }), task: request.task, step: request.step,
        ...(request.attempt === undefined ? {} : { attempt: request.attempt }) } } : {}) };
  }
}
function requirePreparedOperationIdentity(request) {
  if (preparedActions.has(request.action) && request.operationId !== undefined &&
      (typeof request.operationId !== "string" || request.operationId.length !== 74 || !/^principal:[a-f0-9]{64}$/.test(request.operationId))) {
    throw new OperationIdentityError(request);
  }
}
// The store carries operation IDs, so these actions also take the task and step given to prepare.
// Without an attempt that means the latest one, only when it is certain and this coordinator's own;
// otherwise the refusal lists the attempts so the next call can name one. Selection never guesses,
// and the selected attempt then takes the same path, with the same checks, as an operation ID.
const selectableActions = new Set(["status", "complete", "retry", "history", "result"]);
class OperationSelectionError extends Error {
  constructor(reason, message, choices = [], attempt) {
    super(message);
    this.code = "OPERATION_NOT_SELECTED";
    this.administrativeWrites = false;
    this.diagnostic = { kind: "operation-selection", reason };
    this.choices = choices;
    this.attempt = attempt;
  }
}
function latestAttempt(repo, { task, step }, owner) {
  const named = attempt => ({ task, step, attempt });
  let latest;
  try { latest = inspectRecoveryRecord(repo, named(1)).record; }
  catch (error) {
    if (error.code !== "ENOENT" || error.syscall !== "lstat") throw error;
    throw new OperationSelectionError("not-recorded", "no prepared operation is recorded for this task and step in this workspace; name the task and step given to prepare. This does not show whether earlier work started and does not call for a replacement");
  }
  const attempts = [latest];
  let unreadable;
  // The recovery successor walk: an allocated later attempt without a readable record is uncertain.
  try { for (let next; (next = inspectRecoverySuccessor(repo, latest));) attempts.push(latest = next.record); }
  catch { unreadable = latest.attempt + 1; }
  // Exactly the recorded session and canonical workspace, as the owner checks of each action compare them.
  const owned = ({ owner: recorded }) => !!recorded && Object.keys(recorded).length === 2 && recorded.sessionId === owner.sessionId && recorded.cwd === owner.cwd;
  if (unreadable === undefined && owned(latest)) return latest.attempt;
  const choices = attempts.map(record => {
    let state = "unknown";
    try { state = inspectRecoveryOperation(repo, named(record.attempt)).state; } catch { /* Listed for inspection, never selected. */ }
    return { ...named(record.attempt), state, owned: owned(record) };
  });
  throw unreadable !== undefined
    ? new OperationSelectionError("latest-attempt-uncertain", `attempt ${unreadable} has incomplete or unreadable stored state, so the latest attempt is uncertain; name an attempt from choices`, choices)
    : new OperationSelectionError("latest-attempt-foreign", `operation belongs to another coordinator session or workspace: latest attempt ${latest.attempt}; recover it, or name an owned attempt from choices`, choices, latest.attempt);
}
function withOperationArguments(result) {
  if (!["prepared", "complete", "retained", "stale"].includes(result.state)) return result;
  return { ...result, statusArguments: { action: "status", repo: result.root, task: result.task, step: result.step, attempt: result.attempt },
    ...(result.state === "prepared" && result.candidateMatches === true && result.inputsMatch === true && !result.issues?.length
      ? { delegationArguments: { agent: result.phase, operation_id: result.operation_id,
        ...(result.automaticRetryDefinitionId ? { definitionId: result.automaticRetryDefinitionId } : {}) } } : {}) };
}
const recoveryInspection = operation => ({ action: "recover", mode: "inspect", repo: operation.root,
  task: operation.task, step: operation.step, attempt: operation.attempt });
// Status only selects the read-only recovery path. Its producer artifact, not this status,
// must independently prove no start before recovery can offer an authorized successor.
function needsNoStartInspection(operation, runtime) {
  const evidence = runtime?.runtime;
  return runtime?.historical !== true && runtime?.operationId === operation.operation_id && runtime.cwd === operation.root &&
    typeof runtime.executionId === "string" && runtime.executionId.length > 0 && runtime.state === "not-started" &&
    evidence?.cleanup?.state === "not-started" && (!evidence.cleanup.executionId || evidence.cleanup.executionId === runtime.executionId) &&
    [undefined, "unknown"].includes(evidence.work) && !evidence.control && !evidence.final &&
    (!runtime.finalObservation || runtime.finalObservation.state === "unavailable") && evidence.automaticRetryEligibility?.eligible !== true;
}
function offersRecoveryInspection(message) {
  return message === "exact operation settlement is unavailable; preserve prepared operation" ||
    message === "prior operation is not settled or proven unstarted; retry refused" ||
    message === "pi-daddy operation status unavailable; operation stays unchanged" ||
    message.startsWith("automatic retry needs the execution owner's replay-safety proof;");
}

// Bind at command admission. A delayed completion must never attach itself to a
// different task or a newly opened session. Read-only actions do not publish.
function historyObserver(pi, ctx, request) {
  if (!["prepare", "retry", "complete"].includes(request.action) &&
      !(request.action === "recover" && ["continue", "retain"].includes(request.mode))) return;
  let publish;
  let binding = true, ambiguous = false;
  try {
    if (ctx.isProjectTrusted?.() !== true) return;
    const cwd = realpathSync(ctx.cwd);
    if (request.repo && realpathSync(request.repo) !== cwd) return;
    pi.events?.emit?.("pi.task-history.v1.bind", {
      version: 1, owner: "principal", cwd, sessionId: ctx.sessionManager?.getSessionId(),
      accept(handler) {
        if (!binding) return;
        if (publish || typeof handler !== "function") ambiguous = true;
        else publish = handler;
      },
    });
  } catch { /* History is an optional projection. */ }
  finally { binding = false; }
  return result => {
    if (ambiguous || !publish || result.administrativeWrites !== true || result.reused ||
        !/^principal:[a-f0-9]{64}$/.test(result.operation_id)) return;
    const labels = {
      prepared: "Workflow operation prepared",
      retained: "Native result retained",
      complete: "Workflow completion recorded",
      stale: "Retained result requires reconciliation",
    };
    const label = labels[result.state];
    if (!label) return;
    try {
      const sent = publish({ version: 1, owner: "principal", kind: "workflow", operationId: result.operation_id,
        state: result.state, label, evidence: { type: "operation", id: result.operation_id } });
      if (sent && typeof sent.catch === "function") sent.catch(() => {});
    } catch { /* Optional indexing cannot change an owner receipt. */ }
  };
}

export function operationStatus(pi, ctx, operationId, signal, includeFinal = false) {
  return queryRuntimeOperation(pi, ctx, operationId, signal, { includeFinal });
}
export default function workflowExtension(pi, { repositories = ctx => [ctx.cwd] } = {}) {
  const projectSetup = createProjectSetup(pi);
  let freezeEpoch = 0;
  for (const event of ["session_start", "session_switch", "session_fork", "session_tree", "model_select", "session_shutdown"]) pi.on(event, () => { freezeEpoch++; });
  const bindCandidateObserver = registerCandidateObserver(pi);
  pi.registerTool({
    name: "principal_workflow", label: "Principal workflow", parameters, outputSchema,
    description: "Principal bookkeeping; never execution, permission or approval. preflight: project readiness. setup: one confirmed empty Git baseline. snapshot: current candidate and input references. reference: exact file hash. prepare: task/step/phase, expectedCandidate, observable criteria, immutable inputPaths and editable contextPaths; returns reportPath, delegationArguments and statusArguments. Repetition reuses verified artifacts. status/complete/retry/history/result select task/step's latest owned attempt unless attempt is given; ambiguous or foreign selection refuses with choices. status rechecks current files. complete retains the settled exact final and disposition; resultRetained is history, completionValid is current freshness, neither is approval. result reads without writing; history reads the original owner's result; recover inspects after updates or /new. retry preserves the predecessor; automatic mode needs owner proof and a durable allowance, manual mode an authorized retry. verification reads check receipts. See references/continuity.md.",
    promptGuidelines: ["Use this tool, not shell recipes, for hashes, report paths and identity checks; never compute an ID or digest yourself. Pass snapshot.candidate unchanged as expectedCandidate; HEAD alone does not identify uncommitted files. Pass prepare's delegationArguments to delegate with the current delegate_describe definitionId. Only after the child's cleanup is settled (uncertain is not settled), call complete for that operation before any repair, with the disposition its final actually shows: never succeeded for partial or unverified delivery. For replayable failures, call retry with retryMode automatic, task/step, reason and expectedCandidate; the owner proof and persisted budget allow one automatic successor. Pass its delegationArguments unchanged, including definitionId. Unsafe or exhausted replay stops only that phase; continue independent authorized work and ask only for a missing decision. Use retryMode manual only for a separately authorized retry, never to evade the automatic limit. After Build/Debug changes files, call complete, not prepare; if prepare returns PREPARED_OUTPUT_CHANGED, use its recovery arguments. If host schema validation rejects prepare task/step before execution, or PREPARE_INPUT_INVALID reports operationAllocated=false, correct the named field and repeat prepare for the same authorized work without asking again. Reuse established task/step identities; for a new task with no internal identity, choose a short valid ID. Keep attempt unchanged and never rename an existing operation to evade a refusal; this is not retry of an executed operation. On other refusals, follow the returned recoverArguments or statusArguments instead of preparing a replacement. For authorized continuation, follow continueArguments or historical retainArguments unchanged; recall requests only inspect. prepare and complete write private ignored files: when all writes are forbidden, use result instead. Inline work needs no prepare."],
    async execute(_callId, input, signal, _update, ctx) {
      let request = input;
      let queriedOperation;
      try {
        if (signal?.aborted) throw new Error("workflow operation aborted");
        const observeHistory = historyObserver(pi, ctx, request);
        requirePreparedOperationIdentity(request);
        bindCandidateObserver(ctx);
        let result;
        if (request.action === "reference") result = { version: 1, state: "referenced", approval: false, reference: reference(request.path) };
        else {
          const repo = request.repo ?? ctx.cwd;
          const coordinator = () => ({ sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) });
          const recover = recoveryRequest => {
            const epoch = freezeEpoch, sessionId = ctx.sessionManager.getSessionId(), cwd = realpathSync(ctx.cwd);
            return recoverPreparedOperation(pi, ctx, recoveryRequest, signal, () => {
              if (freezeEpoch !== epoch || ctx.sessionManager.getSessionId() !== sessionId || realpathSync(ctx.cwd) !== cwd) throw Error("Session changed during recovery");
            });
          };
          const named = request.task !== undefined || request.step !== undefined;
          if (selectableActions.has(request.action) && request.operationId === undefined && request.attempt === undefined && (named || request.action !== "result"))
            request = { ...request, attempt: latestAttempt(repo, request, coordinator()) };
          if (request.action === "verification") result = inspectVerification(repo, request);
          else if (request.action === "preflight") result = inspectProject(repo);
          else if (request.action === "setup") result = await projectSetup(ctx, request.repo, signal);
          else if (request.action === "recover") result = await recover(request);
          else if (request.action === "snapshot" || request.action === "prepare") {
            let readiness = inspectProject(repo);
            // Snapshot/prepare have always resolved a subdirectory's containing Git worktree.
            // Setup itself remains limited to the session folder; never inspect an expectedCandidate path.
            if (readiness.reasonCode === "PARENT_REPOSITORY") {
              const parent = inspectProject(readiness.repositoryRoot);
              if (parent.state === "ready") readiness = parent;
            }
            if (readiness.state !== "ready") result = readiness.state === "setup-required"
              ? { ...readiness, message: readiness.message + " Use principal_workflow setup or /principal-setup to request interactive confirmation. No setup was performed." }
              : readiness;
            else if (request.action === "snapshot") result = observeSnapshot(repo, request);
            else {
              const owner = coordinator();
              requireNativeWorkspace(owner.cwd, readiness.repositoryRoot);
              result = prepareOperation(repo, { ...request, owner });
            }
          }
          else if (request.action === "resource") {
            if (request.packageRelease && request.repositories) throw Error("Select one repository for a package release target");
            const selected = request.packageRelease ? observePackageRelease(repo, request.packageRelease) : request.repositories ? observeIntegrationSubject(request.repositories) : observeGitResource(repo);
            result = { version: 1, state: "observed", approval: false, administrativeWrites: false, reference: { owner: "principal", reference: selected }, ...(request.packageRelease ? { effectTarget: packageReleaseEffectTarget(selected) } : {}) };
          }
          else if (request.action === "freeze") {
            const epoch = freezeEpoch, sessionId = ctx.sessionManager.getSessionId(), cwd = realpathSync(ctx.cwd);
            if (realpathSync(repo) !== cwd) throw Error("Snapshot destination must be the current workspace");
            const roots = request.repositories ?? [cwd];
            const checkOwner = () => {
              if (signal?.aborted || freezeEpoch !== epoch || ctx.sessionManager.getSessionId() !== sessionId || realpathSync(ctx.cwd) !== cwd) throw Error("Snapshot owner changed");
            };
            const authorize = async () => {
              checkOwner();
              const allowed = await repositories(ctx);
              checkOwner();
              if (!Array.isArray(allowed) || allowed.length > 16 || !Array.isArray(roots) || roots.some(root => !allowed.includes(root))) throw Error("Snapshot roots are not selected");
              return allowed;
            };
            const allowed = await authorize();
            result = await freezeSnapshot(cwd, { repositories: roots, expectedSubject: request.expectedSubject, evidence: request.evidence },
              { repositories: allowed, assertAuthority: authorize });
            checkOwner();
          }
          else if (request.action === "history") {
            const owner = coordinator();
            const current = inspectHistoricalOperation(repo, request, owner);
            const runtime = await queryRuntimeOperation(pi, ctx, current.operation_id, signal, { history: true });
            result = observeHistoricalOperation(repo, request, runtime, owner);
          }
          else if (request.action === "result") {
            // Names select this coordinator's own prepared record; an operationId alone stays a generic native identity.
            const operationId = named ? inspectHistoricalOperation(repo, request, coordinator()).operation_id : request.operationId;
            if (typeof operationId !== "string" || !operationId) throw new Error("result requires task and step, or the actual native operationId");
            const runtime = await operationStatus(pi, ctx, operationId, signal, true);
            result = observeOperationResult(repo, { ...request, operationId }, runtime);
          }
          else if (request.action === "status") result = inspectOperation(repo, request);
          else {
            const current = inspectOwnedOperation(repo, request, coordinator());
            if (request.action === "retry") requireNativeWorkspace(coordinator().cwd, current.root);
            if (request.action === "complete" && current.resultRetained) result = completeOperation(repo, request);
            else if (request.action === "complete" && ["complete", "stale"].includes(current.state)) result = { ...current, reused: true };
            else {
              queriedOperation = current;
              const runtime = await operationStatus(pi, ctx, current.operation_id, signal, request.action === "complete");
              if (signal?.aborted) throw Error("Workflow operation was cancelled; no retry was prepared");
              result = (request.action === "complete" || request.retryMode === "automatic") && needsNoStartInspection(current, runtime)
                ? await recover(recoveryInspection(current))
                : request.action === "complete" ? completeOperation(repo, request, runtime) : retryOperation(repo, request, runtime);
            }
          }
        }
        result = withOperationArguments(result);
        if (result.criteria?.length) result = { ...result, coverage: criterionCoverage(result) };
        observeHistory?.(result);
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result,
          ...(result.state === "setup-blocked" ||
            result.state === "setup-required" && ["snapshot", "prepare"].includes(request.action) ? { isError: true } : {}) };
      } catch (error) {
        const candidateError = error instanceof CandidateIdentityError;
        const inputError = error instanceof PrepareInputError;
        const outputChanged = error instanceof PreparedOutputChangedError;
        const completedRetry = error instanceof CompletedResultRetryError;
        const contextError = error instanceof ContextInputError;
        const workspaceError = error instanceof NativeWorkspaceMismatchError;
        const identityError = error instanceof OperationIdentityError;
        const selectionError = error instanceof OperationSelectionError;
        const setupError = error instanceof ProjectSetupError;
        const setupSteps = setupError && error.steps && typeof error.steps === "object"
          ? Object.fromEntries(["repositoryCreated", "exclusionsWritten", "baselineInstalled"]
            .filter(key => typeof error.steps[key] === "boolean").map(key => [key, error.steps[key]])) : undefined;
        const result = { version: 1, state: "refused", approval: false, error: error.message,
          ...(/workflow implementation changed|operation belongs to another coordinator/.test(error.message)
            ? { recoverArguments: { action: "recover", ...(request.repo === undefined ? {} : { repo: request.repo }),
              ...(request.operationId !== undefined ? { operationId: request.operationId }
                : { task: request.task, step: request.step, attempt: (selectionError ? error.attempt : undefined) ?? request.attempt ?? 1 }) },
              nextAction: "Inspect this original operation with recover. Resuming that original execution requires producer proof it never started. Preserve completed output and reconcile remaining authorized scope; this refusal authorizes no replacement or replay." } : {}),
          ...(queriedOperation && (request.action === "complete" || request.action === "retry" && request.retryMode === "automatic") && offersRecoveryInspection(error.message)
            ? { recoverArguments: recoveryInspection(queriedOperation),
              nextAction: "Inspect this exact operation read-only with recover. Producer-confirmed no-start evidence can offer continuation; active or uncertain work remains unchanged. Inspection authorizes no execution and waives no permissions." } : {}),
          ...(candidateError || inputError || identityError || selectionError || completedRetry || contextError || workspaceError ? { code: error.code, diagnostic: error.diagnostic } : setupError || outputChanged ? { code: error.code } : {}),
          ...(inputError ? { operationAllocated: error.operationAllocated, recovery: error.recovery } : {}),
          ...(identityError ? { recovery: error.recovery } : {}),
          ...(selectionError ? { choices: error.choices } : {}),
          ...(outputChanged ? { ...error.existingOperation, recovery: error.recovery } : {}),
          ...(completedRetry ? { recovery: error.recovery } : {}),
          ...(contextError ? { operationAllocated: error.operationAllocated, recovery: error.recovery } : {}),
          ...(workspaceError ? { operationAllocated: error.operationAllocated, recovery: error.recovery } : {}),
          ...(setupSteps && Object.keys(setupSteps).length ? { setupSteps } : {}),
          administrativeWrites: candidateError || inputError || identityError || selectionError || setupError || outputChanged || completedRetry || contextError || workspaceError ? error.administrativeWrites
            : ["setup", "prepare", "complete", "retry", "freeze"].includes(request.action) || request.action === "recover" && ["continue", "retain"].includes(request.mode) ? "possible" : false };
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result, isError: true };
      }
    },
  });
}

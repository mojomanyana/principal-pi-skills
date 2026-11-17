// Coordinator-only bookkeeping. Native execution and semantic approval remain separate.
import { realpathSync } from "node:fs";
import { Type } from "typebox";
import { CandidateIdentityError, PrepareInputError, PreparedOutputChangedError, WORKFLOW_TASK_NAME, WORKFLOW_STEP_NAME, observeSnapshot, prepareOperation, inspectOperation, completeOperation, retryOperation, observeOperationResult, registerCandidateObserver, inspectOwnedOperation, inspectHistoricalOperation, observeHistoricalOperation, inspectRecoveryRecord, inspectRecoverySuccessor, inspectRecoveryOperation } from "../scripts/workflow-state.mjs";
import { reference } from "../scripts/progress-artifacts.mjs";
import { freezeSnapshot } from "../scripts/frozen-snapshot.mjs";
import { observeGitResource, observeIntegrationSubject, observePackageRelease, packageReleaseEffectTarget } from "../scripts/continuity.mjs";
import { queryRuntimeOperation } from "../scripts/runtime-operation-query.mjs";
import { inspectProject, ProjectSetupError } from "../scripts/project-setup.mjs";
import { createProjectSetup } from "./project-setup.ts";
import { recoverPreparedOperation } from "../scripts/prepared-recovery.mjs";

const ref = Type.Object({ path: Type.String(), sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, { additionalProperties: false });
const choice = values => Type.Union(values.map(value => Type.Literal(value)));
const parameters = Type.Object({
  action: choice(["preflight", "setup", "snapshot", "reference", "prepare", "status", "complete", "retry", "result", "history", "recover", "resource", "freeze"]),
  mode: Type.Optional(choice(["inspect", "continue"])), sourceReference: Type.Optional(ref),
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
  inputPaths: Type.Optional(Type.Array(Type.String(), { maxItems: 128 })), inputs: Type.Optional(Type.Array(ref, { maxItems: 128 })),
  evidence: Type.Optional(Type.Array(ref, { maxItems: 128 })),
  reviewBinding: Type.Optional(Type.Object({
    initiativeId: Type.String(), taskId: Type.String(), taskRevision: Type.String(), outputId: Type.String(),
    outputReference: Type.Object({ owner: Type.Literal("principal"), reference: Type.Object({ kind: Type.Literal("principal-git") }, { additionalProperties: true }) }, { additionalProperties: false }),
    sourceOperationId: Type.String(), sourceRecovery: Type.Optional(Type.Object({ kind: Type.Literal("principal-completed-recovery") }, { additionalProperties: true })), reviewScope: choice(["task", "integrated"]),
    integrationSubject: Type.Optional(Type.Object({ kind: Type.Literal("principal-integration") }, { additionalProperties: true })),
  }, { additionalProperties: false })),
  disposition: Type.Optional(choice(["succeeded", "changes-requested", "unverified", "blocked"])),
  reason: Type.Optional(Type.String()),
}, { additionalProperties: false });
const outputSchema = Type.Object({
  version: Type.Literal(1), state: Type.String(), approval: Type.Literal(false),
  operation_id: Type.Optional(Type.String()), reportPath: Type.Optional(Type.String()),
  delegationArguments: Type.Optional(Type.Object({ agent: Type.String(), operation_id: Type.String() }, { additionalProperties: false })),
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
      ? { delegationArguments: { agent: result.phase, operation_id: result.operation_id } } : {}) };
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
    description: "preflight observes project readiness without writes; setup offers native confirmation for bounded setup in the current workspace, without dispatching work. Deterministic candidate identity and private handoffs. snapshot observes a Git worktree and hashes named inputPaths (relative to its root or absolute); reference hashes an exact file. prepare accepts the returned candidate object or its id as expectedCandidate, plus inputPaths or existing exact inputs. Product identity already covers the tree: name only relevant authority/evidence inputs. prepare needs stable task/step and phase, returning coordinator-owned reportPath, precreated artifactsPath and operation_id. Repeating it reuses verified artifacts; it does not complete a Build that has changed files. PREPARED_OUTPUT_CHANGED returns the original status/result arguments and a completion template requiring the actual disposition. Pass prepared delegationArguments to native delegation with the current delegate_describe definitionId. They do not authorize dispatch or establish native admission/settlement. status/complete/retry/history/result take task and step, selecting the latest attempt unless attempt is given; an uncertain or foreign one refuses with choices. complete first retains the exact verified native final after settlement, even if later edits make it historical; separate completionValid and issues describe current candidate/input checks. Neither retention nor completion approves work. result reads a named native operation without writing files; use it instead of prepare/complete when all filesystem writes are forbidden. history reads the original owner-bound durable result after restart; it never grants current completion, approval or retry authority. recover defaults to read-only inspection across an update or /new: reuse verified old output, or use its exact continueArguments only for current authorized work when the producer positively proves the original never started. Continuation preserves the original and creates one linked current-owner successor; absence never authorizes it. Running, partial or unknown history returns concrete next options. A recovered Build may supply sourceRecovery for a bound Review without rebuilding. retry preserves a settled previous attempt. freeze preserves exact source and explicit in-root evidence as an immutable historical resource, never approval; it requires an expected integration subject and trusted selected roots (ordinary Pi defaults to cwd). resource returns the owner-computed exact Git work-map reference, or an exact integrationSubject when repositories is supplied. An integrated reviewBinding may bind that complete subject; every member must remain current and selected. For an optional Bookie task review, prepare may bind reviewBinding to a completed Build/Debug operation and exact task/output identity. The tool returns the binding id; pass the entire binding to the independent reviewer and use references/continuity.md for its optional receipt. Never construct a digest yourself. Conflicting preparation inputs refuse; native results remain preserved when candidate/authority freshness fails; optional completion evidence still requires exact references. Do not invent replacement fingerprints.",
    promptGuidelines: ["Use preflight for a read-only project readiness observation before Git-dependent bookkeeping. setup uses the current workspace's native confirmation flow when setup is needed; a setup result never dispatches work. Use this tool for workflow bookkeeping instead of assembling hashes, report names or duplicate checks with shell recipes. Pass snapshot.candidate or its exact id unchanged as expectedCandidate; HEAD alone does not identify uncommitted files. Candidate diagnostics compare the supplied baseline where available; unknown dimensions remain unknown. When host schema validation rejects prepare task/step before execution, or PREPARE_INPUT_INVALID reports operationAllocated=false, correct the named metadata field and repeat prepare for the same authorized work without another permission loop. Reuse established task/step identities; for a new task with no internal identity, choose a short valid ID, such as workshop-desk-v1-stage1. Keep attempt unchanged and never rename an existing operation to evade a refusal. This is argument correction, not retry of an executed operation. Other refusals still require their stated reconciliation and never authorize a new build or execution retry. Use direct returned-object transfer in principal_codemode when available; keep agent, operation_id and definitionId intact. A supported before-admission argument correction does not grant execution retry; current ownership, binding, permission and settlement checks remain. Reuse exact references; read only authority and evidence relevant to the assigned work. Prepared artifact directories already exist. The coordinator observes candidates and retains final reports; children need not locate helper scripts or copy reports. prepare/complete write private administrative files; preflight/snapshot/reference/result are read-only. resultRetained records immutable native provenance. completionValid checks current bookkeeping only; neither implies semantic approval. After Build/Debug changes product files, call complete for the original operation, not prepare again. PREPARED_OUTPUT_CHANGED offers exact read-only resultArguments and completionArguments; add the actual disposition after inspecting the complete final and settlement. Never fill succeeded just to close bookkeeping: partial delivery and reported-check limits remain unfinished or unverified. This route neither dispatches nor retries work. Preserve a settled review with complete before repair. When old implementation or coordinator ownership blocks continuation, follow returned recoverArguments rather than preparing a replacement. Recover inspection is read-only; recall requests must never use continue mode. Continue only with exact returned continueArguments for authorized unfinished work; reuse delivered results and do not ask the user to reconstruct internal IDs."],
    async execute(_callId, input, signal, _update, ctx) {
      let request = input;
      try {
        if (signal?.aborted) throw new Error("workflow operation aborted");
        requirePreparedOperationIdentity(request);
        bindCandidateObserver(ctx);
        let result;
        if (request.action === "reference") result = { version: 1, state: "referenced", approval: false, reference: reference(request.path) };
        else {
          const repo = request.repo ?? ctx.cwd;
          const coordinator = () => ({ sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) });
          const named = request.task !== undefined || request.step !== undefined;
          if (selectableActions.has(request.action) && request.operationId === undefined && request.attempt === undefined && (named || request.action !== "result"))
            request = { ...request, attempt: latestAttempt(repo, request, coordinator()) };
          if (request.action === "preflight") result = inspectProject(repo);
          else if (request.action === "setup") result = await projectSetup(ctx, request.repo, signal);
          else if (request.action === "recover") {
            const epoch = freezeEpoch, sessionId = ctx.sessionManager.getSessionId(), cwd = realpathSync(ctx.cwd);
            result = await recoverPreparedOperation(pi, ctx, request, signal, () => {
              if (freezeEpoch !== epoch || ctx.sessionManager.getSessionId() !== sessionId || realpathSync(ctx.cwd) !== cwd) throw Error("Session changed during recovery");
            });
          }
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
            else result = request.action === "snapshot" ? observeSnapshot(repo, request)
              : prepareOperation(repo, { ...request, owner: { sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) } });
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
            if (request.action === "complete" && current.resultRetained) result = completeOperation(repo, request);
            else if (request.action === "complete" && ["complete", "stale"].includes(current.state)) result = { ...current, reused: true };
            else {
              const runtime = await operationStatus(pi, ctx, current.operation_id, signal, request.action === "complete");
              result = request.action === "complete" ? completeOperation(repo, request, runtime) : retryOperation(repo, request, runtime);
            }
          }
        }
        result = withOperationArguments(result);
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result,
          ...(result.state === "setup-blocked" ||
            result.state === "setup-required" && ["snapshot", "prepare"].includes(request.action) ? { isError: true } : {}) };
      } catch (error) {
        const candidateError = error instanceof CandidateIdentityError;
        const inputError = error instanceof PrepareInputError;
        const outputChanged = error instanceof PreparedOutputChangedError;
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
              nextAction: "Inspect this original operation with recover. Reuse verified delivered work; continue only when the producer proves it never started. No replacement has been authorized by this refusal." } : {}),
          ...(candidateError || inputError || identityError || selectionError ? { code: error.code, diagnostic: error.diagnostic } : setupError || outputChanged ? { code: error.code } : {}),
          ...(inputError ? { operationAllocated: error.operationAllocated, recovery: error.recovery } : {}),
          ...(identityError ? { recovery: error.recovery } : {}),
          ...(selectionError ? { choices: error.choices } : {}),
          ...(outputChanged ? { ...error.existingOperation, recovery: error.recovery } : {}),
          ...(setupSteps && Object.keys(setupSteps).length ? { setupSteps } : {}),
          administrativeWrites: candidateError || inputError || identityError || selectionError || setupError || outputChanged ? error.administrativeWrites
            : ["setup", "prepare", "complete", "retry", "freeze"].includes(request.action) || request.action === "recover" && request.mode === "continue" ? "possible" : false };
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result, isError: true };
      }
    },
  });
}

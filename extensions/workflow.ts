// Coordinator-only bookkeeping. Native execution and semantic approval remain separate.
import { realpathSync } from "node:fs";
import { Type } from "typebox";
import { observeSnapshot, prepareOperation, inspectOperation, completeOperation, retryOperation, observeOperationResult, registerCandidateObserver, inspectOwnedOperation, inspectHistoricalOperation, observeHistoricalOperation } from "../scripts/workflow-state.mjs";
import { reference } from "../scripts/progress-artifacts.mjs";
import { freezeSnapshot } from "../scripts/frozen-snapshot.mjs";
import { observeGitResource, observeIntegrationSubject, observePackageRelease, packageReleaseEffectTarget } from "../scripts/continuity.mjs";
import { queryRuntimeOperation } from "../scripts/runtime-operation-query.mjs";

const ref = Type.Object({ path: Type.String(), sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, { additionalProperties: false });
const choice = values => Type.Union(values.map(value => Type.Literal(value)));
const parameters = Type.Object({
  action: choice(["snapshot", "reference", "prepare", "status", "complete", "retry", "result", "history", "resource", "freeze"]),
  expectedSubject: Type.Optional(Type.Object({ kind: Type.Literal("principal-integration") }, { additionalProperties: true })),
  packageRelease: Type.Optional(Type.Object({ packagePath: Type.String({ maxLength: 1024 }), registry: Type.String({ maxLength: 1024 }) }, { additionalProperties: false })),
  repositories: Type.Optional(Type.Array(Type.String(), { minItems: 1, maxItems: 16 })),
  repo: Type.Optional(Type.String()), path: Type.Optional(Type.String()),
  operationId: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()), step: Type.Optional(Type.String()),
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
    sourceOperationId: Type.String(), reviewScope: choice(["task", "integrated"]),
    integrationSubject: Type.Optional(Type.Object({ kind: Type.Literal("principal-integration") }, { additionalProperties: true })),
  }, { additionalProperties: false })),
  disposition: Type.Optional(choice(["succeeded", "changes-requested", "unverified", "blocked"])),
  reason: Type.Optional(Type.String()),
}, { additionalProperties: false });
const outputSchema = Type.Object({
  version: Type.Literal(1), state: Type.String(), approval: Type.Literal(false),
  operation_id: Type.Optional(Type.String()), reportPath: Type.Optional(Type.String()),
  candidateMatches: Type.Optional(Type.Boolean()), reused: Type.Optional(Type.Boolean()),
  error: Type.Optional(Type.String()),
}, { additionalProperties: true });

export function operationStatus(pi, ctx, operationId, signal, includeFinal = false) {
  return queryRuntimeOperation(pi, ctx, operationId, signal, { includeFinal });
}
export default function workflowExtension(pi, { repositories = ctx => [ctx.cwd] } = {}) {
  let freezeEpoch = 0;
  for (const event of ["session_start", "session_switch", "session_fork", "session_tree", "model_select", "session_shutdown"]) pi.on(event, () => { freezeEpoch++; });
  const bindCandidateObserver = registerCandidateObserver(pi);
  pi.registerTool({
    name: "principal_workflow", label: "Principal workflow", parameters, outputSchema,
    description: "Deterministic candidate identity and private handoffs. snapshot observes a Git worktree and hashes named inputPaths (relative to its root or absolute); reference hashes an exact file. prepare accepts the returned candidate object or its id as expectedCandidate, plus inputPaths or existing exact inputs. Product identity already covers the tree: name only relevant authority/evidence inputs. prepare needs stable task/step and phase, returning coordinator-owned reportPath, precreated artifactsPath and operation_id. Repeating it reuses verified artifacts. Pass operation_id to native delegation. status/complete/retry accept operationId without repeating task/step. complete first retains the exact verified native final after settlement, even if later edits make it historical; separate completionValid and issues describe current candidate/input checks. Neither retention nor completion approves work. result reads a named native operation without writing files; use it instead of prepare/complete when all filesystem writes are forbidden. history reads the original owner-bound durable result after restart; it never grants current completion, approval or retry authority. retry preserves a settled previous attempt. freeze preserves exact source and explicit in-root evidence as an immutable historical resource, never approval; it requires an expected integration subject and trusted selected roots (ordinary Pi defaults to cwd). resource returns the owner-computed exact Git work-map reference, or an exact integrationSubject when repositories is supplied. An integrated reviewBinding may bind that complete subject; every member must remain current and selected. For an optional Bookie task review, prepare may bind reviewBinding to a completed Build/Debug operation and exact task/output identity. The tool returns the binding id; pass the entire binding to the independent reviewer and use references/continuity.md for its optional receipt. Never construct a digest yourself. Conflicting preparation inputs refuse; native results remain preserved when candidate/authority freshness fails; optional completion evidence still requires exact references. Do not invent replacement fingerprints.",
    promptGuidelines: ["Use this tool for workflow bookkeeping instead of assembling hashes, report names or duplicate checks with shell recipes. Reuse exact references; read only authority and evidence relevant to the assigned work. Prepared artifact directories already exist. The coordinator observes candidates and retains final reports; children need not locate helper scripts or copy reports. prepare/complete write private administrative files; snapshot/reference/result are read-only. resultRetained records immutable native provenance. completionValid checks current bookkeeping only; neither implies semantic approval. Preserve a settled review with complete before repair, using its operationId."],
    async execute(_callId, request, signal, _update, ctx) {
      try {
        if (signal?.aborted) throw new Error("workflow operation aborted");
        bindCandidateObserver(ctx);
        let result;
        if (request.action === "reference") result = { version: 1, state: "referenced", approval: false, reference: reference(request.path) };
        else {
          const repo = request.repo ?? ctx.cwd;
          if (request.action === "snapshot") result = observeSnapshot(repo, request);
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
            const owner = { sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) };
            const current = inspectHistoricalOperation(repo, request, owner);
            const runtime = await queryRuntimeOperation(pi, ctx, current.operation_id, signal, { history: true });
            result = observeHistoricalOperation(repo, request, runtime, owner);
          }
          else if (request.action === "result") {
            if (typeof request.operationId !== "string" || !request.operationId) throw new Error("result requires the actual native operationId");
            const runtime = await operationStatus(pi, ctx, request.operationId, signal, true);
            result = observeOperationResult(repo, request, runtime);
          }
          else if (request.action === "prepare") result = prepareOperation(repo, { ...request, owner: { sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) } });
          else if (request.action === "status") result = inspectOperation(repo, request);
          else {
            const current = inspectOwnedOperation(repo, request, { sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) });
            if (request.action === "complete" && current.resultRetained) result = completeOperation(repo, request);
            else if (request.action === "complete" && ["complete", "stale"].includes(current.state)) result = { ...current, reused: true };
            else {
              const runtime = await operationStatus(pi, ctx, current.operation_id, signal, request.action === "complete");
              result = request.action === "complete" ? completeOperation(repo, request, runtime) : retryOperation(repo, request, runtime);
            }
          }
        }
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result };
      } catch (error) {
        const result = { version: 1, state: "refused", approval: false, error: error.message,
          administrativeWrites: ["prepare", "complete", "retry", "freeze"].includes(request.action) ? "possible" : false };
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result, isError: true };
      }
    },
  });
}

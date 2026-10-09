// Coordinator-only bookkeeping. Native execution and semantic approval remain separate.
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { Type } from "typebox";
import { observeCandidate, prepareOperation, inspectOperation, completeOperation, retryOperation, observeOperationResult, registerCandidateObserver, inspectOwnedOperation } from "../scripts/workflow-state.mjs";
import { reference } from "../scripts/progress-artifacts.mjs";

const ref = Type.Object({ path: Type.String(), sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, { additionalProperties: false });
const choice = values => Type.Union(values.map(value => Type.Literal(value)));
const parameters = Type.Object({
  action: choice(["snapshot", "reference", "prepare", "status", "complete", "retry", "result"]),
  repo: Type.Optional(Type.String()), path: Type.Optional(Type.String()),
  operationId: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()), step: Type.Optional(Type.String()),
  attempt: Type.Optional(Type.Integer({ minimum: 1 })),
  phase: Type.Optional(choice(["plan", "build", "review", "test-review", "debug", "investigate"])),
  expectedCandidate: Type.Optional(Type.String()), inputs: Type.Optional(Type.Array(ref, { maxItems: 128 })),
  evidence: Type.Optional(Type.Array(ref, { maxItems: 128 })),
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
  const sessionId = ctx.sessionManager.getSessionId(), cwd = realpathSync(ctx.cwd);
  const requestId = randomUUID();
  return new Promise((accept, reject) => {
    let done = false;
    const finish = (error, value) => {
      if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener("abort", aborted);
      error ? reject(error) : accept(value);
    };
    const aborted = () => finish(new Error("workflow runtime query aborted"));
    const timer = setTimeout(() => finish(new Error("pi-daddy operation status unavailable; operation stays prepared")), 5000);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) { aborted(); return; }
    try {
      pi.events.emit("pi-daddy:operation-status:v1", { version: 1, requestId, sessionId, cwd, operationId, includeFinal, reply(value) {
        if (!value || value.version !== 1 || value.requestId !== requestId || value.sessionId !== sessionId || value.cwd !== cwd || value.operationId !== operationId) {
          finish(new Error("pi-daddy operation response identity mismatch")); return;
        }
        if (ctx.sessionManager.getSessionId() !== sessionId || realpathSync(ctx.cwd) !== cwd) {
          finish(new Error("session changed during operation query")); return;
        }
        if (value.qualified !== true || !value.operation) { finish(new Error(value.reason ?? "qualified operation status unavailable")); return; }
        finish(null, { ...value.operation, ...(includeFinal ? { finalObservation: value.final } : {}) });
      } });
    } catch (error) { finish(error); }
  });
}
export default function workflowExtension(pi) {
  const bindCandidateObserver = registerCandidateObserver(pi);
  pi.registerTool({
    name: "principal_workflow", label: "Principal workflow", parameters, outputSchema,
    description: "Deterministic candidate identity and private handoffs. snapshot observes a Git worktree; reference hashes an exact file. prepare needs stable task/step, phase, expectedCandidate and exact inputs, returning coordinator-owned reportPath, precreated artifactsPath and operation_id. Repeating it reuses verified artifacts. Pass operation_id to native delegation. status verifies evidence. complete retains the exact verified native final automatically after settlement, without approving it. result reads a named native operation without writing files; use it instead of prepare/complete when all filesystem writes are forbidden. retry preserves a settled previous attempt. Different inputs or stale evidence refuse; do not invent replacement fingerprints.",
    promptGuidelines: ["Use this tool for workflow bookkeeping instead of assembling hashes, report names or duplicate checks with shell recipes. Reuse exact references; read only authority and evidence relevant to the assigned work. Prepared artifact directories already exist. The coordinator observes candidates and retains final reports; children need not locate helper scripts or copy reports. prepare/complete write private administrative files; snapshot/reference/result are read-only. A complete operation is a retained result, not an approval verdict."],
    async execute(_callId, request, signal, _update, ctx) {
      try {
        if (signal?.aborted) throw new Error("workflow operation aborted");
        bindCandidateObserver(ctx);
        let result;
        if (request.action === "reference") result = { version: 1, state: "referenced", approval: false, reference: reference(request.path) };
        else {
          const repo = request.repo ?? ctx.cwd;
          if (request.action === "snapshot") result = { version: 1, state: "observed", approval: false, candidate: observeCandidate(repo) };
          else if (request.action === "result") {
            if (typeof request.operationId !== "string" || !request.operationId) throw new Error("result requires the actual native operationId");
            const runtime = await operationStatus(pi, ctx, request.operationId, signal, true);
            result = observeOperationResult(repo, request, runtime);
          }
          else if (request.action === "prepare") result = prepareOperation(repo, { ...request, owner: { sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) } });
          else if (request.action === "status") result = inspectOperation(repo, request);
          else {
            const current = inspectOwnedOperation(repo, request, { sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) });
            if (request.action === "complete" && ["complete", "stale"].includes(current.state)) result = { ...current, reused: true };
            else {
              const runtime = await operationStatus(pi, ctx, current.operation_id, signal, request.action === "complete");
              result = request.action === "complete" ? completeOperation(repo, request, runtime) : retryOperation(repo, request, runtime);
            }
          }
        }
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result };
      } catch (error) {
        const result = { version: 1, state: "refused", approval: false, error: error.message,
          administrativeWrites: ["prepare", "complete", "retry"].includes(request.action) ? "possible" : false };
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result, isError: true };
      }
    },
  });
}

// Pi event transport only. Historical reads cannot impersonate qualified live state.
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";

export function queryRuntimeOperation(pi, ctx, operationId, signal, { history = false, includeFinal = false } = {}) {
  const sessionId = ctx.sessionManager.getSessionId(), cwd = realpathSync(ctx.cwd), requestId = randomUUID();
  return new Promise((accept, reject) => {
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true; clearTimeout(timer); signal?.removeEventListener("abort", aborted);
      error ? reject(error) : accept(value);
    };
    const aborted = () => finish(new Error("workflow runtime query aborted"));
    const timer = setTimeout(() => finish(new Error(`pi-daddy ${history ? "historical result" : "operation status"} unavailable; operation stays unchanged`)), 5000);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) { aborted(); return; }
    try {
      pi.events.emit(history ? "pi-daddy:operation-history:v1" : "pi-daddy:operation-status:v1", {
        version: 1, requestId, sessionId, cwd, operationId, includeFinal: history || includeFinal,
        reply(value) {
          if (!value || value.version !== 1 || value.requestId !== requestId || value.sessionId !== sessionId || value.cwd !== cwd || value.operationId !== operationId) {
            finish(new Error("pi-daddy operation response identity mismatch")); return;
          }
          if (ctx.sessionManager.getSessionId() !== sessionId || realpathSync(ctx.cwd) !== cwd) {
            finish(new Error("session changed during operation query")); return;
          }
          const correctKind = history ? value.history === true && value.qualified !== true : value.qualified === true && value.history !== true;
          if (!correctKind || !value.operation) {
            finish(new Error(value.reason ?? `${history ? "historical result" : "qualified operation status"} unavailable`)); return;
          }
          finish(null, { ...value.operation,
            ...(history || includeFinal ? { finalObservation: value.final } : {}),
            ...(value.artifact ? { artifact: value.artifact } : {}),
            ...(history ? { historical: true } : {}),
          });
        },
      });
    } catch (error) { finish(error); }
  });
}

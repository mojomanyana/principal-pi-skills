import test from "node:test";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { queryRuntimeOperation } from "../../scripts/runtime-operation-query.mjs";

const context = () => ({ cwd: process.cwd(), sessionManager: { getSessionId: () => "session" } });
const transport = fn => ({ events: { emit: fn } });
const envelope = request => ({ version: 1, requestId: request.requestId, sessionId: request.sessionId, cwd: request.cwd, operationId: request.operationId });

test("live and historical observations use separate channels and cannot substitute for each other", async () => {
  for (const history of [false, true]) {
    const pi = transport((channel, request) => {
      assert.equal(channel, `pi-daddy:operation-${history ? "history" : "status"}:v1`);
      assert.equal(request.cwd, realpathSync(process.cwd()));
      request.reply({ ...envelope(request), ...(history ? { history: true } : { qualified: true }),
        operation: { operationId: "op", state: "settled" }, final: { state: "complete", text: "saved" },
        artifact: { producer: "pi-daddy" },
      });
    });
    const result = await queryRuntimeOperation(pi, context(), "op", undefined, { history, includeFinal: true });
    assert.equal(result.historical, history ? true : undefined);
    assert.equal(result.finalObservation.text, "saved");
    assert.equal(result.artifact.producer, "pi-daddy");
    const wrong = transport((_channel, request) => request.reply({ ...envelope(request),
      ...(history ? { qualified: true } : { history: true }), operation: { operationId: "op" },
    }));
    await assert.rejects(queryRuntimeOperation(wrong, context(), "op", undefined, { history }), /unavailable/);
  }
});

test("foreign replies, session switches and cancellation reject without sending a second request", async () => {
  for (const field of ["requestId", "sessionId", "cwd", "operationId"]) {
    const pi = transport((_channel, request) => request.reply({ ...envelope(request), [field]: "foreign", history: true, operation: {} }));
    await assert.rejects(queryRuntimeOperation(pi, context(), "op", undefined, { history: true }), /identity mismatch/);
  }
  const ctx = context();
  const switched = transport((_channel, request) => {
    ctx.sessionManager.getSessionId = () => "new-session";
    request.reply({ ...envelope(request), history: true, operation: {} });
  });
  await assert.rejects(queryRuntimeOperation(switched, ctx, "op", undefined, { history: true }), /session changed/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(queryRuntimeOperation(transport(() => assert.fail("aborted query dispatched")), context(), "op", controller.signal, { history: true }), /aborted/);
});

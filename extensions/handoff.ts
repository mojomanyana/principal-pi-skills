// Optional coordinator support. Resolving inputs never dispatches or supplies semantic approval.
import { readFileSync, realpathSync } from "node:fs";
import { Type } from "typebox";
import { prepareHandoff, resolveHandoff, readLocalHandoffReference, resolveOptionalReference, observeHandoffDestination } from "../scripts/compact-handoff.mjs";

const choice = values => Type.Union(values.map(value => Type.Literal(value)));
const reference = Type.Union([
  Type.Object({ kind: Type.Literal("file"), path: Type.String(), sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("context"), bundleId: Type.String(), inputIds: Type.Optional(Type.Array(Type.String(), { maxItems: 16 })) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("producer"), registrationId: Type.String(), part: choice(["final", "partial", "manifest"]) }, { additionalProperties: false }),
  Type.Object({ version: Type.Literal(1), producer: Type.Literal("pi-scout-research"), kind: Type.Literal("research-brief"),
    session: Type.String({ pattern: "^[a-f0-9]{64}$" }), sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }), bytes: Type.Integer({ minimum: 1, maximum: 96001 }) }, { additionalProperties: false }),
]);
const inputs = Type.Array(Type.Object({ id: Type.String(), reference }, { additionalProperties: false }), { maxItems: 16 });
const draft = Type.Object({
  task: Type.String(), scope: Type.String(), profile: choice(["task", "plan", "decision", "architecture", "custom"]),
  intent: Type.Optional(Type.Object({ original: Type.String(), current: Type.String(), amendments: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })) }, { additionalProperties: false })),
  required: inputs, optional: Type.Optional(inputs), caveats: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
}, { additionalProperties: false });
const parameters = Type.Object({ action: choice(["prepare", "resolve"]), draft: Type.Optional(draft),
  handoff: Type.Optional(Type.Object({ ...draft.properties, version: Type.Literal(1), id: Type.String() }, { additionalProperties: false })),
  optionalIds: Type.Optional(Type.Array(Type.String(), { maxItems: 16 })),
}, { additionalProperties: false });

export default function handoffExtension(pi) {
  const producerVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  let epoch = 0, publisher, sequence = 0, publisherOwner;
  const reset = () => { epoch++; try { publisher?.close(); } catch {} publisher = undefined; publisherOwner = undefined; sequence = 0; };
  for (const event of ["session_start", "session_switch", "session_fork", "session_tree", "model_select", "session_shutdown"]) pi.on(event, reset);
  function observation(ctx, result) {
    const selectedEpoch = epoch, owner = { sessionId: ctx.sessionManager.getSessionId(), cwd: realpathSync(ctx.cwd) };
    const ownerKey = JSON.stringify(owner);
    const publish = () => {
      if (epoch !== selectedEpoch || publisherOwner !== ownerKey || ctx.sessionManager.getSessionId() !== owner.sessionId || realpathSync(ctx.cwd) !== owner.cwd) return;
      try { publisher?.publish({ sequence: sequence++, items: [{ id: "required-inputs", kind: "evidence",
        label: "Principal required inputs", state: result.state === "blocked" ? "dependency-wait" : "observed",
        details: [result.state === "prepared" ? "Prepared references; inputs not yet fetched." : result.state === "ready" ? "Required inputs resolved. No semantic approval." : "Required input or current authority unavailable.",
          "No dispatch or execution authority granted."], reference: result.handoffId ?? result.handoff?.id }] }); } catch {}
    };
    if (publisherOwner === ownerKey && publisher) { publish(); return; }
    try { pi.events.emit("pi-daddy:dashboard-source:v1", { version: 1, ...owner, producer: "principal", producerVersion, reply: receipt => {
      if (epoch !== selectedEpoch) { try { receipt?.close?.(); } catch {} return; }
      if (receipt?.version !== 1 || !receipt.ok || typeof receipt.publish !== "function" || typeof receipt.close !== "function") return;
      publisher = receipt; publisherOwner = ownerKey; sequence = 0; publish();
    } }); } catch { /* Optional observation never changes the handoff result. */ }
  }
  pi.registerTool({
    name: "principal_handoff", label: "Principal compact handoff", parameters,
    outputSchema: Type.Object({ version: Type.Literal(1), state: Type.String(), approval: Type.Literal(false),
      administrativeWrites: Type.Literal(false), executionAuthorized: Type.Literal(false) }, { additionalProperties: true }),
    description: "Prepare compact exact-reference task/review handoffs without copying source bodies. Resolve fetches all required and selected optional inputs through exact local files inside this workspace or optional trusted Bookie/Scout resolvers. Review profiles require original/current intent IDs among required inputs. Bookie handles and Scout brief refs come from their actual tools; a reference or metadata registration does not permit final bodies or cross-session access. Missing/stale/denied/incomplete required inputs block and withhold aggregate excerpts. ready means input availability only, never approval, authorship, current intent authority or execution permission. No shell, dispatch or writes.",
    promptGuidelines: ["Keep task and consequential caveats in the handoff; store evidence once and reuse exact references. Never omit a required source to obtain ready. Request optional history only for a named uncertainty. Verify authority for any intended amendment; summaries and matching hashes do not confer it. Use the portable artifact-review resource for judgments and leave execution to the coordinator."],
    async execute(_id, request, signal, _update, ctx) {
      const selectedEpoch = epoch, sessionId = ctx.sessionManager.getSessionId(), cwd = realpathSync(ctx.cwd);
      const assertCurrent = async () => {
        if (signal?.aborted || epoch !== selectedEpoch || ctx.sessionManager.getSessionId() !== sessionId || realpathSync(ctx.cwd) !== cwd) throw Error("handoff owner changed");
      };
      try {
        await assertCurrent();
        let result, destination;
        if (request.action === "prepare") {
          if (request.handoff !== undefined || request.optionalIds !== undefined) throw Error("prepare takes only a draft");
          result = { version: 1, state: "prepared", approval: false, administrativeWrites: false, executionAuthorized: false, handoff: prepareHandoff(request.draft) };
        } else if (request.action === "resolve") {
          if (request.draft !== undefined) throw Error("resolve takes the prepared handoff");
          destination = await observeHandoffDestination(ctx);
          await assertCurrent();
          if (!destination) throw Error("effective model destination is unavailable");
          result = await resolveHandoff(request.handoff, { optionalIds: request.optionalIds, signal, assertCurrent,
            resolveReference: reference => reference.kind === "file" ? readLocalHandoffReference(reference, cwd) : resolveOptionalReference(pi, ctx, reference, signal) });
        } else throw Error("unknown handoff action");
        if (destination) {
          const currentDestination = await observeHandoffDestination(ctx);
          await assertCurrent();
          if (JSON.stringify(currentDestination) !== JSON.stringify(destination)) throw Error("model destination changed");
        }
        await assertCurrent(); observation(ctx, result);
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result, isError: result.state === "blocked" };
      } catch {
        const result = { version: 1, state: "refused", approval: false, administrativeWrites: false, executionAuthorized: false,
          reason: "Invalid handoff, owner change or unavailable required input. Inspect the named references; no fallback executed." };
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: result, isError: true };
      }
    },
  });
}

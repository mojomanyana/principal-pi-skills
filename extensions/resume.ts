// One operator-authorized, quiescent continuation. Not a scheduler or in-flight retry engine.
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { realpathSync, lstatSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inspectCheckpoint, listCheckpoints, authorizeCheckpoint, readAuthorization, disarmCheckpoint, consumeCheckpoint, markEnqueued, continuation } from "../scripts/resume-checkpoint.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHANNEL = "pi-daddy:runtime-snapshot:v1";
const ENTRY = "principal-resume-authorization-v1";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function sessionIdentity(pi, ctx) {
  const sessionId = ctx.sessionManager.getSessionId(), sessionFile = ctx.sessionManager.getSessionFile();
  assert(typeof sessionId === "string" && sessionId && typeof sessionFile === "string" && sessionFile, "a persisted Pi session is required");
  const model = ctx.model;
  assert(model && typeof model.provider === "string" && typeof model.id === "string", "current model identity is unavailable");
  const thinking = pi.getThinkingLevel();
  assert(typeof thinking === "string" && thinking, "current thinking policy is unavailable");
  return { sessionId, sessionFile: realpathSync(sessionFile), leafId: ctx.sessionManager.getLeafId(), model: { provider: model.provider, id: model.id, api: model.api ?? null }, thinking };
}
function selected(pi, phase) {
  const choices = pi.getCommands().filter(command => command.source === "skill" && command.name === `skill:${phase}`);
  assert(choices.length === 1 && typeof choices[0].sourceInfo?.path === "string", "exact selected Principal phase is unavailable or ambiguous");
  const path = realpathSync(choices[0].sourceInfo.path);
  assert(path === realpathSync(resolve(root, phase, "SKILL.md")), "selected phase belongs to a different package");
  return path;
}
export async function requestRuntime(pi, ctx, timeoutMs = 5000) {
  const requestId = randomUUID(), sessionId = ctx.sessionManager.getSessionId(), cwd = realpathSync(ctx.cwd);
  assert(pi.events && typeof pi.events.emit === "function", "pi-daddy runtime bridge is unavailable");
  return new Promise((accept, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error("pi-daddy runtime reconciliation timed out")); }, timeoutMs);
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : accept(value); };
    try {
      pi.events.emit(CHANNEL, { version: 1, requestId, sessionId, cwd, reply(value) {
        try {
          assert(value && value.version === 1 && value.requestId === requestId && value.sessionId === sessionId && value.cwd === cwd, "runtime bridge identity mismatch");
          assert(["process", "herdr"].includes(value.backend) && value.qualified === true && value.state === "idle", "runtime is busy, unknown or unqualified; reconcile it before resume");
          assert(typeof value.ownerScope === "string" && value.ownerScope && typeof value.ownerId === "string" && value.ownerId && /^[a-f0-9]{64}$/.test(value.evidenceDigest), "runtime ownership evidence is unavailable");
          assert(Array.isArray(value.outstandingExecutionIds) && value.outstandingExecutionIds.length === 0 && Array.isArray(value.settledExecutionIds) && value.settledExecutionIds.every(id => typeof id === "string" && id) && new Set(value.settledExecutionIds).size === value.settledExecutionIds.length, "owned executions are not all reconciled");
          finish(null, { version: 1, sessionId, cwd, ownerScope: value.ownerScope, backend: value.backend, evidenceDigest: value.evidenceDigest, settledExecutionIds: [...value.settledExecutionIds] });
        } catch (error) { finish(error); }
      } });
    } catch (error) { finish(error); }
  });
}
export default function resumeExtension(pi) {
  let generation = 0, pending = null, disposed = false;
  const discoveryReceipts = new Set();
  const notify = (ctx, message, level = "info") => { if (ctx.hasUI) ctx.ui.notify(`Principal resume: ${message}`, level); else console.error(`Principal resume: ${message}`); };
  const guard = (ctx, expectedGeneration) => { assert(!disposed && generation === expectedGeneration && ctx.isIdle(), "session changed or is no longer idle"); };
  pi.registerCommand("principal-resume", {
    description: "Arm one exact idle workflow checkpoint, disarm it, or inspect status. Explicit operator UI confirmation is required.",
    handler: async (args, ctx) => {
      try {
        const match = /^(arm|disarm|status)(?:\s+(.+))?$/.exec(args.trim());
        assert(match, "usage: /principal-resume arm <checkpoint-directory> | disarm <checkpoint-directory> | status [checkpoint-directory]");
        const [_, command, path] = match;
        assert(ctx.hasUI, "interactive operator UI is required; no headless auto-approval");
        const currentGeneration = generation;
        guard(ctx, currentGeneration);
        if (command === "status") {
          const entries = path ? [inspectCheckpoint(path, root)] : listCheckpoints(ctx.cwd).map(entry => inspectCheckpoint(entry.path, root));
          notify(ctx, JSON.stringify(entries.map(entry => ({ path: entry.path, state: entry.state, checksPassed: entry.checksPassed, issues: entry.issues }))));
          return;
        }
        assert(path, "checkpoint directory required");
        let info = inspectCheckpoint(path, root);
        assert(info.checkpoint.candidate.root === realpathSync(ctx.cwd), "checkpoint belongs to another working directory");
        if (command === "disarm") { disarmCheckpoint(path); notify(ctx, "checkpoint disarmed; prior evidence retained"); return; }
        assert(info.checksPassed && info.state === "prepared", `checkpoint is not ready: ${info.issues.join("; ")} (${info.state})`);
        const approvedCheckpointSha256 = info.checkpointSha256;
        const session = sessionIdentity(pi, ctx), selectedPath = selected(pi, info.checkpoint.phase), runtime = await requestRuntime(pi, ctx);
        guard(ctx, currentGeneration);
        const c = info.checkpoint;
        const approved = await ctx.ui.confirm("Authorize one Principal resume checkpoint?", `Task: ${c.task}\nPlan: ${c.plan.path}\nPlan SHA256: ${c.plan.sha256}\nCandidate: ${c.candidate.id}\nPhase/step: ${c.phase} / ${c.step}\nSource scope: ${c.scope.join(", ")}\nRemaining repair rounds: ${c.repairsRemaining}\nOriginal full reports: ${c.reports.map(ref => ref.path).join(", ") || "none (planned build boundary)"}\nModel: ${session.model.provider}/${session.model.id}; thinking ${session.thinking}\nConfirm that you inspected the complete plan and required original reports, approved this exact next phase and all due semantic gates, and authorize ONE continuation when this same session is next resumed/reloaded. A git-ops phase requires an already approved integrated review of this exact candidate. This grants no push, merge, publication or destructive Git action. Changed state, unknown children or missing evidence will refuse. No automatic re-arm.`);
        if (!approved) { notify(ctx, "not authorized; nothing armed"); return; }
        guard(ctx, currentGeneration);
        assert(same(sessionIdentity(pi, ctx), session) && selected(pi, c.phase) === selectedPath, "session/model/selected phase changed during authorization");
        const reconciled = await requestRuntime(pi, ctx);
        assert(same(runtime, reconciled), "runtime changed during authorization");
        guard(ctx, currentGeneration);
        assert(same(sessionIdentity(pi, ctx), session), "session or model changed during runtime reconciliation");
        info = authorizeCheckpoint(path, root, session, runtime, approvedCheckpointSha256);
        const authorization = readAuthorization(path);
        // This durable session-owned entry binds the UI authorization file to its parent leaf.
        // A plain JSON flag or copied user-role message cannot replace it.
        pi.appendEntry(ENTRY, { checkpointSha256: info.checkpointSha256, authorizationSha256: authorization.sha256 });
        notify(ctx, "armed for one continuation on this same session's next startup/resume/reload; intervening turns invalidate it");
      } catch (error) { notify(ctx, error.message, "error"); }
    },
  });
  async function resume(ctx, token) {
    try {
      guard(ctx, token);
      const candidates = listCheckpoints(ctx.cwd).filter(entry => entry.state === "armed");
      if (!candidates.length) return;
      assert(candidates.length === 1, "multiple armed checkpoints require explicit reconciliation");
      const info = inspectCheckpoint(candidates[0].path, root);
      assert(info.checksPassed, info.issues.join("; "));
      const auth = readAuthorization(info.path), value = auth.value;
      assert(value.schema === ENTRY && value.source === "interactive-operator-confirmation" && value.checkpointSha256 === info.checkpointSha256, "authorization does not bind this checkpoint");
      const now = sessionIdentity(pi, ctx), before = value.session, leaf = ctx.sessionManager.getLeafEntry();
      assert(leaf && leaf.type === "custom" && leaf.customType === ENTRY && leaf.parentId === before.leafId && leaf.data?.checkpointSha256 === info.checkpointSha256 && leaf.data?.authorizationSha256 === auth.sha256, "current session leaf is not the exact operator authorization; intervening work or uncertain arm must be reconciled");
      assert(now.sessionId === before.sessionId && now.sessionFile === before.sessionFile && same(now.model, before.model) && now.thinking === before.thinking, "session lineage or model changed");
      selected(pi, info.checkpoint.phase);
      const runtime = await requestRuntime(pi, ctx);
      assert(same(runtime, value.runtime), "runtime owner scope or execution/settlement history changed");
      guard(ctx, token);
      assert(same(sessionIdentity(pi, ctx), now), "session/model advanced during reconciliation");
      selected(pi, info.checkpoint.phase);
      // The durable exclusive claim precedes enqueue. Failure after this point is never retried automatically.
      const consumed = consumeCheckpoint(info.path, root, info.checkpointSha256, auth.sha256);
      pi.sendUserMessage(continuation(consumed), { deliverAs: "followUp", expandPromptTemplates: false });
      markEnqueued(info.path);
      notify(ctx, "one authorized continuation queued; checkpoint consumed");
    } catch (error) { notify(ctx, error.message, "error"); }
  }
  pi.on("session_start", async (event, ctx) => {
    generation++; disposed = false; pending = null;
    if (!["startup", "reload", "resume"].includes(event.reason)) return;
    // Default-off stays quiet even outside Git. Existing unsupported/symlink state is inspected and refused.
    try { lstatSync(resolve(ctx.cwd, ".principal", "resume")); }
    catch (error) { if (error.code === "ENOENT") return; notify(ctx, error.message, "error"); return; }
    pending = { ctx, token: generation };
  });
  // Pi 1.0.4 installs returned resources synchronously only AFTER every discovery handler resolves.
  // A zero-delay timer inside this event can run while a later async handler is still discovering.
  // Observe this pass's exact, inert prompt path in the finalized public resource list instead.
  pi.on("resources_discover", async () => {
    const work = pending; pending = null;
    if (!work) return;
    try {
      guard(work.ctx, work.token);
      if (!listCheckpoints(work.ctx.cwd).some(entry => entry.state === "armed")) return;
      const directory = mkdtempSync(join(tmpdir(), "principal-resume-discovery-"));
      const name = "principal-resume-ready-" + randomUUID(), path = join(directory, name + ".md");
      try {
        writeFileSync(path, "---\ndescription: Principal resume resource-readiness marker; no action or authority\n---\nThis is an inert Principal resume readiness marker. Do not perform work from it. Use /principal-resume status to inspect checkpoints.\n", { flag: "wx", mode: 0o600 });
      } catch (error) { rmdirSync(directory); throw error; }
      discoveryReceipts.add({ directory, path });
      void (async () => {
        try {
          const deadline = Date.now() + 30000;
          while (true) {
            guard(work.ctx, work.token);
            const found = pi.getCommands().filter(command => command.source === "prompt" && command.name === name && command.sourceInfo?.path === path);
            if (found.length === 1) break;
            assert(found.length === 0, "resource discovery receipt is ambiguous");
            assert(Date.now() < deadline, "resource discovery did not finalize within 30 seconds; checkpoint remains armed");
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          await resume(work.ctx, work.token);
        } catch (error) {
          if (!disposed && generation === work.token) notify(work.ctx, error.message, "error");
        }
      })();
      return { promptPaths: [path] };
    } catch (error) { notify(work.ctx, error.message, "error"); }
  });
  pi.on("session_shutdown", async () => {
    disposed = true; generation++; pending = null;
    for (const receipt of discoveryReceipts) {
      try { unlinkSync(receipt.path); rmdirSync(receipt.directory); discoveryReceipts.delete(receipt); }
      catch (error) { console.error(`Principal resume: readiness marker cleanup failed: ${error.message}`); }
    }
  });
}
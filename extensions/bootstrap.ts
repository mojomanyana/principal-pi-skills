// Request-local routing for the enabled resources of this extension's package generation.
// No TypeScript-only syntax: Node 20 tests load a byte-identical .mjs copy.
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const names = new Set(["decide", "architect", "plan", "build", "review", "debug", "investigate", "git-ops"]);

export default function bootstrapExtension(pi) {
  // Capture at registration, so a later npm install cannot impersonate this loaded generation.
  let loadedVersion;
  try {
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    if (manifest.name === "principal-pi-skills") loadedVersion = manifest.version;
  } catch { /* Optional diagnostic only. */ }
  const removeVersionReporter = pi.events?.on("pi-daddy:ecosystem-versions:v1", request => {
    if (typeof request?.report === "function" && typeof loadedVersion === "string")
      request.report({ id: "principal-pi-skills", version: loadedVersion, root });
  });
  pi.on("session_shutdown", () => { removeVersionReporter?.(); });
  // All state belongs to this registration. SDK reload installs a new generation; no
  // module-global content cache or text marker can keep old/disabled resources alive.
  const owned = new WeakSet();
  let enabled = [], cached, failed = false;
  const refuse = (error, ctx) => {
    enabled = [];
    if (failed) return;
    failed = true;
    const message = `Principal routing unavailable: ${error.message}. Correct the resource and explicitly /reload before retrying.`;
    console.error(message); // Also visible in headless/JSON hosts whose UI notifications are no-ops.
    if (ctx?.hasUI && ctx.ui?.notify) ctx.ui.notify(message, "error");
  };

  pi.on("session_start", async () => { enabled = []; });
  pi.on("before_agent_start", async (_event, ctx) => {
    enabled = [];
    if (failed) return;
    try {
      // session_start precedes resource discovery in Pi 1.0.4. This public hook is after it.
      const commands = pi.getCommands();
      if (!Array.isArray(commands)) throw new Error("selected skill discovery is unavailable");
      const selected = new Set();
      for (const command of commands) {
        const name = typeof command.name === "string" && command.name.startsWith("skill:") ? command.name.slice(6) : null;
        if (command.source !== "skill" || !names.has(name)) continue;
        if (typeof command.sourceInfo?.path !== "string") continue; // Missing identity cannot establish Principal ownership.
        const expected = resolve(root, name, "SKILL.md");
        // Foreign/shadowing selections stay inactive; canonical aliases of our own path work.
        try {
          if (realpathSync(command.sourceInfo.path) !== realpathSync(expected)) continue;
        } catch (error) {
          // A stale foreign command is not a failure of every Principal resource.
          // An exact selected Principal path that disappeared remains a visible failure.
          if (resolve(command.sourceInfo.path) === expected) throw error;
          continue;
        }
        selected.add(name);
      }
      if (!selected.size) return;
      if (cached === undefined) {
        cached = readFileSync(resolve(root, "bootstrap", "BOOTSTRAP.md"), "utf8").trim();
        if (!cached) throw new Error("bootstrap file is empty");
      }
      enabled = [...selected].sort();
    } catch (error) { refuse(error, ctx); }
  });

  pi.on("context", async event => {
    // Replace only objects this extension inserted, never arbitrary quoted marker text.
    // Do not edit canonical message objects or append anything to durable session history.
    const messages = event.messages.filter(message => !owned.has(message));
    if (!enabled.length) return messages.length === event.messages.length ? undefined : { messages };
    let at = 0;
    // Pi's context excludes its system message; keep any supplied leading state intact.
    while (["system", "compactionSummary", "toolResult"].includes(messages[at]?.role)) at++;
    const message = {
      role: "user",
      content: [{ type: "text", text: `<IMPORTANT>\n${cached}\n\nEnabled Principal skills: ${enabled.join(", ")}. Use only these selected resources.\n</IMPORTANT>` }],
      timestamp: Date.now(),
    };
    owned.add(message);
    return { messages: [...messages.slice(0, at), message, ...messages.slice(at)] };
  });
}
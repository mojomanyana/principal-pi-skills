// Request-local routing for the enabled Principal skills via Pi's structured system prompt.
// Uses systemPromptOptions in before_agent_start (never context user-message splicing) to preserve
// strict role alternation on open-weight Jinja chat templates and RadixAttention/APC prefix caching.
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const names = new Set([
  "architect",
  "build",
  "review",
  "debug",
  "git-ops",
  "plan",
  "investigate",
  "review-security",
  "review-perf",
  "test-engineer",
  "orchestrator",
  "refactor",
]);

export default function bootstrapExtension(pi) {
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

  let cached;
  let failed = false;

  const refuse = (error, ctx) => {
    if (failed) return;
    failed = true;
    const message = `Principal routing unavailable: ${error.message}. Correct the resource and explicitly /reload before retrying.`;
    console.error(message);
    if (ctx?.hasUI && ctx.ui?.notify) ctx.ui.notify(message, "error");
  };

  pi.on("before_agent_start", async (event, ctx) => {
    if (failed) return;
    try {
      const commands = pi.getCommands();
      if (!Array.isArray(commands)) throw new Error("selected skill discovery is unavailable");
      const selected = new Set();
      for (const command of commands) {
        const name = typeof command.name === "string" && command.name.startsWith("skill:") ? command.name.slice(6) : null;
        if (command.source !== "skill" || !names.has(name)) continue;
        if (typeof command.sourceInfo?.path !== "string") continue;
        const expected = resolve(root, name, "SKILL.md");
        try {
          if (realpathSync(command.sourceInfo.path) !== realpathSync(expected)) continue;
        } catch (error) {
          if (resolve(command.sourceInfo.path) === expected) throw error;
          continue;
        }
        selected.add(name);
      }
      if (!selected.size) return;
      if (cached === undefined) {
        cached = readFileSync(resolve(root, "bootstrap", "BOOTSTRAP.md"), "utf8").trim()
          .replace(/references\/(learning|research|checkpoints)\.md/g, (p) => resolve(root, p));
        if (!cached) throw new Error("bootstrap file is empty");
      }
      const enabled = [...selected].sort();
      const body = `${cached}\n\nEnabled Principal skills: ${enabled.join(", ")}.`;
      const opts = event?.systemPromptOptions;
      if (opts && opts.forceSystemPrompt !== undefined) {
        opts.forceSystemPrompt += `\n\n<principal_routing>\n${body}\n</principal_routing>`;
      } else if (opts && typeof opts === "object") {
        opts.sections = { ...(opts.sections ?? {}), principal_routing: body };
      }
    } catch (error) {
      refuse(error, ctx);
    }
  });
}

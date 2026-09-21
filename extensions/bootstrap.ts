// Injects bootstrap/BOOTSTRAP.md at session start and after compaction, once per turn.
// Kept free of TypeScript-only syntax so node can load it as JS in tests.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "principal-pi-skills bootstrap";
const here = dirname(fileURLToPath(import.meta.url));
const bootstrapPath = process.env.PRINCIPAL_BOOTSTRAP_PATH ?? resolve(here, "..", "bootstrap", "BOOTSTRAP.md");
let cached;

function content() {
  if (cached !== undefined) return cached;
  try {
    cached = `<IMPORTANT>\n${MARKER}\n\n${readFileSync(bootstrapPath, "utf8").trim()}\n</IMPORTANT>`;
  } catch {
    cached = null;
  }
  return cached;
}

function hasMarker(m) {
  const c = m && m.content;
  if (typeof c === "string") return c.includes(MARKER);
  return Array.isArray(c) && c.some((p) => p && p.type === "text" && typeof p.text === "string" && p.text.includes(MARKER));
}

export default function bootstrapExtension(pi) {
  let inject = true;
  pi.on("session_start", async () => { inject = true; });
  pi.on("session_compact", async () => { inject = true; });
  pi.on("agent_end", async () => { inject = false; });
  pi.on("context", async (event) => {
    if (!inject) return;
    if (event.messages.some(hasMarker)) return;
    const text = content();
    if (!text) return;
    let at = 0;
    while (event.messages[at] && event.messages[at].role === "compactionSummary") at++;
    const msg = { role: "user", content: [{ type: "text", text }], timestamp: Date.now() };
    return { messages: [...event.messages.slice(0, at), msg, ...event.messages.slice(at)] };
  });
}

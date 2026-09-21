import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
process.env.PRINCIPAL_BOOTSTRAP_PATH = join(ROOT, "bootstrap/BOOTSTRAP.md");

// CI runs Node 20, which cannot import .ts. The extension is written without TypeScript-only
// syntax, so a byte-for-byte copy under .mjs loads on every supported Node.
async function load() {
  const handlers = new Map();
  const pi = { on(ev, fn) { handlers.set(ev, [...(handlers.get(ev) ?? []), fn]); } };
  const dir = mkdtempSync(join(tmpdir(), "ppa-bootstrap-"));
  const copy = join(dir, "bootstrap.mjs");
  writeFileSync(copy, readFileSync(join(ROOT, "extensions/bootstrap.ts"), "utf8"));
  const mod = await import(pathToFileURL(copy).href + `?t=${Date.now()}${Math.random()}`);
  mod.default(pi);
  rmSync(dir, { recursive: true, force: true });
  return handlers;
}
const one = (h, ev) => { const a = h.get(ev) ?? []; assert.equal(a.length, 1, `one ${ev} handler`); return a[0]; };
const text = (m) => m.content.map((p) => p.text).join("\n");

test("package.json registers the extension and ships the bootstrap", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(pkg.pi.extensions, ["./extensions/bootstrap.ts"]);
  assert.ok(pkg.files.includes("extensions/bootstrap.ts"));
  assert.ok(pkg.files.includes("bootstrap/BOOTSTRAP.md"));
});

test("bootstrap is injected once at session start and cleared at agent_end", async () => {
  const h = await load();
  await one(h, "session_start")({}, {});
  const user = { role: "user", content: [{ type: "text", text: "hi" }], timestamp: 1 };
  const r = await one(h, "context")({ messages: [user] }, {});
  assert.equal(r.messages.length, 2);
  assert.match(text(r.messages[0]), /principal-pi-skills bootstrap/);
  assert.match(text(r.messages[0]), /\| Input shape \|/);
  assert.equal(await one(h, "context")({ messages: r.messages }, {}), undefined, "no duplicate");
  await one(h, "agent_end")({}, {});
  assert.equal(await one(h, "context")({ messages: [user] }, {}), undefined, "cleared after agent_end");
});

test("after compaction the bootstrap lands after the summary", async () => {
  const h = await load();
  await one(h, "session_compact")({}, {});
  const summary = { role: "compactionSummary", summary: "s", timestamp: 1 };
  const user = { role: "user", content: [{ type: "text", text: "go" }], timestamp: 2 };
  const r = await one(h, "context")({ messages: [summary, user] }, {});
  assert.equal(r.messages[0], summary);
  assert.match(text(r.messages[1]), /principal-pi-skills bootstrap/);
  assert.equal(r.messages[2], user);
});

test("BOOTSTRAP.md stays under 300 words and carries the routing table", () => {
  const t = readFileSync(join(ROOT, "bootstrap/BOOTSTRAP.md"), "utf8");
  assert.ok(t.trim().split(/\s+/).length <= 300, "bootstrap over 300 words");
  for (const s of ["decide", "architect", "plan", "build", "review", "debug", "git-ops"]) assert.match(t, new RegExp(`\`${s}\``));
  assert.match(t, /Next:/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Model-free policy fixture. Actual Pi hook/resource lifecycle is qualified separately.
async function load(t, { enabled = true, readable = true } = {}) {
  const handlers = new Map(), errors = [], dir = mkdtempSync(join(tmpdir(), "ppa-bootstrap-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const sub of ["extensions", "bootstrap", "plan"]) mkdirSync(join(dir, sub));
  const body = readFileSync(join(ROOT, "bootstrap/BOOTSTRAP.md"), "utf8");
  const path = join(dir, "bootstrap/BOOTSTRAP.md");
  if (readable) writeFileSync(path, body);
  const skill = join(dir, "plan/SKILL.md");
  writeFileSync(skill, "---\nname: plan\n---\nPlan contract\n");
  const copy = join(dir, "extensions/bootstrap.mjs");
  writeFileSync(copy, readFileSync(join(ROOT, "extensions/bootstrap.ts"), "utf8"));
  let selected = enabled ? [{ name: "skill:plan", source: "skill", sourceInfo: { path: skill } }] : [];
  let calls = 0;
  const pi = {
    on(event, fn) { handlers.set(event, [...(handlers.get(event) ?? []), fn]); },
    getCommands() { calls++; return selected; },
  };
  const mod = await import(pathToFileURL(copy).href);
  mod.default(pi);
  const ctx = { hasUI: true, ui: { notify(message, level) { errors.push({ message, level }); } } };
  const fire = async (event, payload = {}) => {
    const listeners = handlers.get(event) ?? [];
    assert.equal(listeners.length, 1, `one ${event} handler`);
    return listeners[0](payload, ctx);
  };
  return { fire, handlers, ctx, errors, path, skill, body, pi, activate: () => fire("before_agent_start"), setSelected: value => { selected = value; }, calls: () => calls, mod };
}
const user = text => ({ role: "user", content: [{ type: "text", text }], timestamp: 1 });
const bootstrap = message => message?.role === "user" && JSON.stringify(message.content).includes("<IMPORTANT>");
const count = messages => messages.filter(bootstrap).length;

test("package registers the extension, bootstrap and delegated identity manifest", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(pkg.pi.extensions, ["./extensions/bootstrap.ts"]);
  for (const file of ["extensions/bootstrap.ts", "bootstrap/BOOTSTRAP.md", "principal-agents.json"]) assert.ok(pkg.files.includes(file));
});

test("each ordinary request and tool iteration receives one bootstrap without durable mutation", async t => {
  const h = await load(t);
  await h.fire("session_start");
  assert.equal(h.calls(), 0, "session_start is before supported discovery");
  const canonical = [user("first request")], before = structuredClone(canonical);
  await h.activate();
  const first = await h.fire("context", { messages: canonical });
  assert.equal(count(first.messages), 1);
  assert.deepEqual(canonical, before);
  const toolIteration = await h.fire("context", { messages: [...canonical, { role: "toolResult", toolCallId: "x", content: [] }] });
  assert.equal(count(toolIteration.messages), 1);
  const repeated = await h.fire("context", { messages: first.messages });
  assert.equal(count(repeated.messages), 1, "only extension-owned insertion is replaced");
  if (h.handlers.has("agent_end")) await h.fire("agent_end");
  await h.activate();
  assert.equal(count((await h.fire("context", { messages: [user("second request")] })).messages), 1);
});

test("quoted marker text in any role cannot suppress request-local insertion", async t => {
  const h = await load(t); await h.activate();
  for (const message of [user("principal-pi-skills bootstrap"), { role: "assistant", content: [{ type: "text", text: "principal-pi-skills bootstrap" }] }, { role: "compactionSummary", summary: "principal-pi-skills bootstrap" }]) {
    const result = await h.fire("context", { messages: [message, user("continue")] });
    assert.equal(count(result.messages), 1);
    assert.ok(result.messages.includes(message));
  }
});

test("insertion preserves leading system, compaction and tool state without splitting history", async t => {
  const h = await load(t); await h.activate();
  const prefix = [{ role: "system", content: "system" }, { role: "compactionSummary", summary: "retained summary" }, { role: "toolResult", toolCallId: "prior", content: [] }];
  const request = user("resume"), messages = [...prefix, request], before = structuredClone(messages);
  const result = await h.fire("context", { messages });
  assert.deepEqual(result.messages.slice(0, prefix.length), prefix);
  assert.ok(bootstrap(result.messages[prefix.length]));
  assert.equal(result.messages.at(-1), request);
  assert.deepEqual(messages, before);
});

test("disabled or shadowed package skills never activate or retain owned routing", async t => {
  const h = await load(t, { enabled: false }); await h.activate();
  assert.equal(await h.fire("context", { messages: [user("request")] }), undefined);
  h.setSelected([{ name: "skill:plan", source: "skill", sourceInfo: { path: join(ROOT, "plan/SKILL.md") } }]);
  await h.activate();
  assert.equal(await h.fire("context", { messages: [user("shadowed package")] }), undefined);
  const active = await load(t); await active.activate();
  const inserted = await active.fire("context", { messages: [user("enabled")] });
  active.setSelected([]); await active.activate();
  const disabled = await active.fire("context", { messages: inserted.messages });
  assert.equal(count(disabled.messages), 0);
});

test("read failure is visible once, latched across requests, and deliberate reload can retry", async t => {
  const h = await load(t, { readable: false }); await h.activate();
  assert.equal(h.errors.length, 1);
  assert.match(h.errors[0].message, /reload/i);
  assert.equal(await h.fire("context", { messages: [user("missing")] }), undefined);
  writeFileSync(h.path, h.body);
  await h.activate();
  assert.equal(await h.fire("context", { messages: [user("no silent retry")] }), undefined);
  assert.equal(h.errors.length, 1);
  // SDK reload reinstantiates extensions: new registration, same selected source and bytes.
  h.handlers.clear(); h.mod.default(h.pi); await h.activate();
  assert.equal(count((await h.fire("context", { messages: [user("explicit reload")] })).messages), 1);
});

test("stale discovery fails visibly instead of retaining old active resources", async t => {
  const h = await load(t); await h.activate();
  h.pi.getCommands = () => { throw new Error("stale extension generation"); };
  await h.activate();
  assert.equal(await h.fire("context", { messages: [user("stale")] }), undefined);
  assert.equal(h.errors.length, 1);
  assert.match(h.errors[0].message, /stale/);
});

test("compact bootstrap states exact native binding policy and bounded inline routing", () => {
  const text = readFileSync(join(ROOT, "bootstrap/BOOTSTRAP.md"), "utf8");
  assert.ok(text.trim().split(/\s+/).length <= 300);
  for (const name of ["decide", "architect", "plan", "build", "review", "debug", "investigate", "git-ops"]) assert.match(text, new RegExp(`\`${name}\``));
  assert.match(text, /delegate_describe/);
  assert.match(text, /definitionId/);
  assert.match(text, /genuinely absent/);
  assert.doesNotMatch(text, /cheapest model|strongest available/);
});

test("missing foreign selected paths cannot latch unrelated Principal routing off", async t => {
  const h = await load(t);
  h.setSelected([
    { name: "skill:build", source: "skill", sourceInfo: { path: join(dirname(h.skill), "foreign-missing/SKILL.md") } },
    { name: "skill:debug", source: "skill" },
    { name: "skill:plan", source: "skill", sourceInfo: { path: h.skill } },
  ]);
  await h.activate();
  const result = await h.fire("context", { messages: [user("valid selected plan")] });
  assert.equal(count(result.messages), 1);
  assert.match(result.messages[0].content[0].text, /Enabled Principal skills: plan\./);
  assert.equal(h.errors.length, 0);
  h.setSelected([{ name: "skill:plan", source: "skill", sourceInfo: { path: h.skill } }]);
  await h.activate();
  assert.equal(count((await h.fire("context", { messages: [user("next request")] })).messages), 1);
});

test("a disappeared exact Principal selection still latches a visible failure", async t => {
  const h = await load(t);
  rmSync(h.skill);
  await h.activate();
  assert.equal(h.errors.length, 1);
  assert.equal(await h.fire("context", { messages: [user("missing selected Principal source")] }), undefined);
  writeFileSync(h.skill, "restored");
  await h.activate();
  assert.equal(await h.fire("context", { messages: [user("explicit reload still required")] }), undefined);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");

async function loadBootstrap() {
  const dir = mkdtempSync(join(tmpdir(), "principal-boot-"));
  const mjs = join(dir, "bootstrap.mjs");
  const src = readFileSync(resolve(root, "extensions/bootstrap.ts"), "utf8").replace(
    'resolve(dirname(fileURLToPath(import.meta.url)), "..")',
    JSON.stringify(root),
  );
  writeFileSync(mjs, src);
  const mod = await import(pathToFileURL(mjs).href);
  return { fn: mod.default, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function createHarness(bootstrapExtension, commands) {
  const handlers = new Map();
  const pi = {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
    getCommands: () => commands,
    events: { on: () => () => {} },
  };
  bootstrapExtension(pi);
  return { handlers };
}

test("bootstrap injects principal_routing into systemPromptOptions.sections without any context hook", async () => {
  const { fn, cleanup } = await loadBootstrap();
  try {
    const { handlers } = createHarness(fn, [
      { name: "skill:build", source: "skill", sourceInfo: { path: resolve(root, "build", "SKILL.md") } },
      { name: "skill:review", source: "skill", sourceInfo: { path: resolve(root, "review", "SKILL.md") } },
    ]);
    assert.equal(handlers.has("context"), false, "must not splice user messages in context hook");
    const before = handlers.get("before_agent_start") ?? [];
    assert.equal(before.length, 1);

    const opts = { sections: {} };
    await before[0]({ systemPromptOptions: opts }, {});
    assert.equal(typeof opts.sections.principal_routing, "string");
    assert.match(opts.sections.principal_routing, /Enabled Principal skills: build, review\./);
    assert.doesNotMatch(opts.sections.principal_routing, /principal_delivery|jev_advice/);
  } finally {
    cleanup();
  }
});

test("bootstrap does not inject when no Principal skills are selected", async () => {
  const { fn, cleanup } = await loadBootstrap();
  try {
    const { handlers } = createHarness(fn, [
      { name: "skill:other", source: "skill", sourceInfo: { path: "/tmp/other/SKILL.md" } },
    ]);
    const opts = { sections: {} };
    await handlers.get("before_agent_start")[0]({ systemPromptOptions: opts }, {});
    assert.equal(opts.sections.principal_routing, undefined);
  } finally {
    cleanup();
  }
});

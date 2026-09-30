// Historical failed observations calibrate the unchanged original negative stimulus.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const json = p => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));

test("original missing-definition stimulus and failed mutation traces remain intact", () => {
  const original = json("build/tests/specification.yaml").scenarios.find(s => s.id === "F04-build-missing-agent");
  assert.equal(createHash("sha256").update(JSON.stringify(original)).digest("hex"), "89c4d1c0a9b6fb01b1b10a36be459330eda43aab51138f951cee097997a89f2c");
  const prefix = "build/tests/results/pi-openai-codex-gpt-5.5";
  const first = json(`${prefix}/2026-09-30T10-53-50-949Z/F04-build-missing-agent.force.trace.jsonl`);
  assert.ok(first.changed_paths.includes("limit.mjs"));
  assert.ok(first.changed_paths.includes("limit.test.mjs"));
  const forbidden = new RegExp(original.assert.trace.forbid_calls.find(c => c.tool === "write").args.path.matches);
  assert.ok(first.tool_calls.some(c => c.name === "write" && forbidden.test(c.args.path)));
  const later = json(`${prefix}/2026-09-30T11-31-36-645Z/F04-build-missing-agent.force.trace.jsonl`);
  assert.ok(later.changed_paths.includes("limit.test.mjs"));
  assert.ok(later.tool_calls.some(c => c.name === "write" && c.args.content.includes("user-approved override")));
});

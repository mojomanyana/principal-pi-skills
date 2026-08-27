import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const path = "docs/evidence/pr35-e1-repair-provenance-v1.json";
const bytes = readFileSync(join(ROOT, path));
const manifest = JSON.parse(bytes);
const sha = /^[a-f0-9]{64}$/;

function digest(file) { return createHash("sha256").update(readFileSync(file)).digest("hex"); }

test("PR35 provenance is canonical, complete, and has exact E1 model/repetition coverage", () => {
  assert.equal(bytes.toString(), JSON.stringify(manifest) + "\n", "manifest must use one-line canonical JSON serialization");
  assert.equal(manifest.schema, "principal-pr35-e1-repair-provenance-v1");
  const all = [...manifest.e1.subjects, ...manifest.e1.judgments];
  assert.equal(manifest.e1.subjects.length, 6);
  assert.equal(manifest.e1.judgments.length, 6);
  assert.equal(new Set(all.map((item) => item.id)).size, 12);
  assert.equal(new Set(all.map((item) => item.path)).size, 12);
  for (const item of all) assert.match(item.sha256, sha);
  const coverage = manifest.e1.subjects.map((item) => `${item.model}:${item.repetition}`).sort();
  assert.deepEqual(coverage, [
    "openai-codex:gpt-5.6-luna:0", "openai-codex:gpt-5.6-luna:1", "openai-codex:gpt-5.6-luna:2",
    "openai-codex:gpt-5.6-terra:0", "openai-codex:gpt-5.6-terra:1", "openai-codex:gpt-5.6-terra:2",
  ]);
  for (const key of ["final_handoff_sha256", "provenance_sha256", "rca_sha256", "series_classification_sha256"]) assert.match(manifest.preserved[key], sha);
});

test("PR35 provenance optionally verifies every allowlisted external byte without consuming extras", () => {
  const root = process.env.PR35_EVIDENCE_ROOT;
  if (!root) return;
  const all = [...manifest.e1.subjects, ...manifest.e1.judgments];
  for (const item of all) {
    const candidate = join(root, item.path);
    assert.ok(existsSync(candidate), `missing allowlisted item ${item.id}`);
    assert.equal(digest(candidate), item.sha256, item.id);
  }
});

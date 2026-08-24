import test from "node:test";
import assert from "node:assert/strict";

import { parsePackMetadata } from "../../scripts/pack-meta.mjs";

const meta = { name: "principal-pi-skills", filename: "principal-pi-skills-3.0.1.tgz", files: [] };

test("normalizes npm 10/11 array-shaped pack --json output", () => {
  assert.deepEqual(parsePackMetadata(JSON.stringify([meta])), meta);
});

test("normalizes npm 12 package-keyed pack --json output", () => {
  assert.deepEqual(parsePackMetadata(JSON.stringify({ "principal-pi-skills": meta })), meta);
});

test("rejects empty or malformed pack metadata instead of passing a false green", () => {
  assert.throws(() => parsePackMetadata("{}"), /metadata/i);
  assert.throws(() => parsePackMetadata("not json"), /JSON/i);
});

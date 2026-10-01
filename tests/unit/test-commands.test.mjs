// Test entrypoints are package behavior; never invoke a model runner to check them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { scripts } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

test("default verification covers current product tests without an archived-evidence command", () => {
  assert.equal(scripts["verify:evidence"], undefined);
  assert.doesNotMatch(scripts.test, /verify:evidence|tests\/evidence/);
  assert.match(scripts.test, /npm run test:unit/);
  assert.equal(scripts["test:unit"], "node --test tests/unit/*.test.mjs && node scripts/check-word-budgets.mjs");
});

// Test entrypoints are package behavior; never invoke a model runner to check them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const { scripts } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

test("historical verification is an explicit native offline command, not a default gate", () => {
  assert.equal(scripts["verify:evidence"], "node --test tests/evidence/*.test.mjs");
  assert.doesNotMatch(scripts.test, /verify:evidence|tests\/evidence/);
  assert.match(scripts.test, /npm run test:unit/);
  assert.equal(scripts["test:unit"], "node --test tests/unit/*.test.mjs && node scripts/check-word-budgets.mjs");
});

test("unit discovery excludes evidence tests while explicit discovery selects the whole category", () => {
  // Expand the actual shell globs without executing any discovered test or collector.
  const discover = script => {
    const glob = script.match(/^node --test (tests\/[a-z]+\/\*\.test\.mjs)(?:$| &&)/)?.[1];
    assert.ok(glob, "expected a native Node test glob, not a model runner");
    const result = spawnSync("sh", ["-c", `printf '%s\\n' ${glob}`], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim().split("\n");
  };
  assert.equal(typeof scripts["verify:evidence"], "string", "offline verification must be explicitly selectable");
  const unit = discover(scripts["test:unit"]);
  const evidence = discover(scripts["verify:evidence"]);
  const expected = readdirSync(new URL("../evidence/", import.meta.url))
    .filter(p => p.endsWith(".test.mjs")).map(p => `tests/evidence/${p}`).sort();
  assert.ok(expected.length > 0);
  assert.deepEqual(evidence.sort(), expected);
  for (const path of evidence) assert.ok(!unit.includes(path), `${path} leaked into default discovery`);
});

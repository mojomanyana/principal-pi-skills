#!/usr/bin/env node
/**
 * Verify README.md word counts against the shipped v6.0 skills and delegated agents.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BUDGETS = {
  skill: 1450,
  agent: 1550,
  build: 2100,
  "build-agent": 2100,
  review: 1900,
  "review-agent": 1950,
  debug: 1453,
  "debug-agent": 1600,
  "git-ops": 2600,
};

const count = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const words = (rel) => count(readFileSync(join(ROOT, rel), "utf8"));

const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const errors = [];
const checked = [];

for (const line of readme.split("\n")) {
  const row = line.match(/^\|\s*`([a-z-]+)`\s*\|(.*)\|\s*(\d+)\s*\|\s*$/);
  if (!row) continue;
  const [, skill, middle, claimed] = row;

  const targets = [[`${skill}/SKILL.md`, Number(claimed), BUDGETS[skill] ?? BUDGETS.skill]];
  const twin = middle.match(/`(agents\/[a-z-]+\.md)`\s*,\s*(\d+)/);
  if (twin) targets.push([twin[1], Number(twin[2]), BUDGETS[`${skill}-agent`] ?? BUDGETS.agent]);

  for (const [path, claim, ceiling] of targets) {
    let actual;
    try {
      actual = words(path);
    } catch {
      errors.push(`${path}: named in README table but not readable`);
      continue;
    }
    checked.push(path);
    if (actual !== claim) {
      errors.push(`${path}: README says ${claim} words, file has ${actual}`);
    }
    if (actual > ceiling) {
      errors.push(`${path}: ${actual} words exceeds budget ${ceiling}`);
    }
  }
}

const EXPECTED_SKILLS = 12;
const skillFiles = checked.filter((p) => p.endsWith("/SKILL.md")).length;
if (skillFiles !== EXPECTED_SKILLS) {
  errors.push(`parsed ${skillFiles} skill row(s) from README table, expected ${EXPECTED_SKILLS}`);
}

if (errors.length) {
  console.error("Word budget check failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`Word budget check passed (${checked.length} files within budget).`);

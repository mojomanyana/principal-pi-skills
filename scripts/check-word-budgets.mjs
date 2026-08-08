#!/usr/bin/env node
/**
 * Verify the README's word counts against the files they describe.
 *
 * The README states budgets as decisions rather than aspirations and says every count in
 * its table is checkable with `wc -w`. That is only true if something checks it: during the
 * v2.2.1 safety patch the git-ops figure went stale three times in one sitting, because the
 * skill was edited and the table was not. A number that documents itself wrongly is worse
 * than no number — it reads as verified.
 *
 * Two independent checks:
 *   1. Consistency — the count in the table equals the file's actual word count. Always
 *      an error; the table is a factual claim about a file in the same commit.
 *   2. Budget — the count is within the declared ceiling. Also an error, because the
 *      ceilings are decisions; raising one is an edit to BUDGETS below, made deliberately
 *      and reviewed, not an accident discovered later.
 *
 * `wc -w` semantics: whitespace-separated tokens, which is what split(/\s+/) gives on
 * trimmed content. Verified equal against coreutils wc.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The declared ceilings. `git-ops` is the one standing exception: the safety-critical
// operator carries the most arming, and validated behavior outweighs a budget. It moved
// once, in v2.2.1, to buy the reconciled protected-branch/secret-purge policies. Any
// further move needs a defect to point at.
const BUDGETS = { skill: 1100, agent: 1350, "git-ops": 1900 };

const words = (p) => {
  const t = readFileSync(join(ROOT, p), "utf8").trim();
  return t ? t.split(/\s+/).length : 0;
};

const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const errors = [];
const checked = [];

// Table rows: | `skill` | what | how it runs | words |
// The "how it runs" cell may name an agent twin and its own count: (`agents/plan.md`, 1315)
for (const line of readme.split("\n")) {
  const row = line.match(/^\|\s*`([a-z-]+)`\s*\|(.*)\|\s*(\d+)\s*\|\s*$/);
  if (!row) continue;
  const [, skill, middle, claimed] = row;

  const targets = [[`${skill}/SKILL.md`, Number(claimed), BUDGETS[skill] ?? BUDGETS.skill]];
  const twin = middle.match(/`(agents\/[a-z-]+\.md)`\s*,\s*(\d+)/);
  if (twin) targets.push([twin[1], Number(twin[2]), BUDGETS.agent]);

  for (const [path, claim, ceiling] of targets) {
    let actual;
    try {
      actual = words(path);
    } catch {
      errors.push(`${path}: named in the README table but not readable`);
      continue;
    }
    checked.push(path);
    if (actual !== claim) {
      errors.push(`${path}: README says ${claim} words, file has ${actual} — update the table`);
    }
    if (actual > ceiling) {
      errors.push(
        `${path}: ${actual} words exceeds its ${ceiling} budget — trim it, or change BUDGETS ` +
          `in scripts/check-word-budgets.mjs and say why in the README`
      );
    }
  }
}

// A table that parses to nothing would pass silently, which is the same failure this
// script exists to prevent — so prove it found the rows.
const EXPECTED_SKILLS = 7;
const skillFiles = checked.filter((p) => p.endsWith("/SKILL.md")).length;
if (skillFiles !== EXPECTED_SKILLS) {
  errors.push(
    `parsed ${skillFiles} skill row(s) from the README table, expected ${EXPECTED_SKILLS} — ` +
      `the table format changed and this check is no longer reading it`
  );
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} word-budget finding(s)`);
  process.exit(1);
}
console.log(`✓ ${checked.length} file(s) match the README table and are within budget`);

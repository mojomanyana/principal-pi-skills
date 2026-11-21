#!/usr/bin/env node
/**
 * Verify the README's word counts against the files they describe.
 *
 * The README states budgets as decisions rather than aspirations and says every count in
 * its table is checkable with `wc -w`. That is only true if something checks it: during the
 * git-ops safety patch the figure went stale three times in one sitting, because the
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

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The declared ceilings.
//
// They have moved twice, 1100 -> 1250 -> 1400 for skills and 1350 -> 1500 for agents, and
// both moves bought the same thing: *every arming needs its governor in the same breath*.
// An absolute is cheap to write ("one caller -> inline it", "every catch logs and changes
// state") and wrong in real cases, and each wrong absolute produced a measured over-refusal.
// A rule plus the cases it must not eat costs words the original budget was set without
// knowing about.
//
// The second move is a deliberate policy choice (user decision, 2026-08-09): when a fix and
// the ceiling conflict, RAISE THE CEILING rather than trim the fix. Trimming to fit was
// costing real content — a review paragraph explaining why destructive checks belong in a
// throwaway worktree got compressed twice, and each compression removed a reason a weak
// model needed. Prose that earns its place should not be squeezed by a number that was
// guessed before the content existed.
//
// `git-ops` is a standing exception at 2550 for its safety and release playbooks.
//
// These are still ceilings, not targets — the check exists so growth is a decision someone
// makes, not something that happens. The plan contract is deliberately over the common
// ceiling because normative-spec fidelity needs source, ID, gate, and coverage rules.
// Individual fidelity exceptions preserve source blocking/persistence, candidate-bound
// build/review evidence, and debug's sandbox-vs-applied distinction; common limits stay put.
const BUDGETS = {
  skill: 1400, agent: 1500,
  "plan": 2050, "plan-agent": 2100,
  // Gate ownership and due stages prevent impossible leaf prerequisites without waiving real gates.
  "build": 2100, "build-agent": 2100,
  "review": 1900, "review-agent": 1950,
  // Three generated identity-marker words prevent missing-package inline fallback.
  "debug": 1453, "debug-agent": 1600,
  // Destructive recovery must cover distinct index/working state and verified restoration.
  "git-ops": 2550,
};

// Tool text.
//
// The skill and agent files above are read when a role is used. A registered tool is different:
// its description and prompt guidelines go to the model with every request while the tool is
// active, whether or not it is called. Nothing counted that text. In `extensions/workflow.ts` it
// grew from 115 words on 2026-10-09 to 861 on 2026-11-16, 399 of them on that last day, outside
// every budget this file declares.
//
// The ceilings are the counts after the text was rewritten for weaker models on 2026-11-17
// (861, 147 and 52 words when this check was added), so the text may shrink freely and grows
// only by an edit here. It is the rule stated above: growth is a decision someone
// makes, and when a fix needs the words, the ceiling moves.
//
// Counted, per listed file: every plain double-quoted string written as the value of a
// `description`, `promptSnippet` or `promptGuidelines` key. That is the tool description, its
// guidelines and the parameter descriptions written in that file. Not counted: schema structure,
// parameter descriptions imported from scripts/ (37 words for `principal_workflow` today), and
// for `principal_codemode` the description Pi's own code-mode tool supplies.
//
// The check reads source and loads nothing, so it sees text only where it is written at one of
// those keys in the listed file. Text attached another way (a spread, Object.assign, an object
// built in another module) is invisible to it. Three things keep that from passing quietly: a
// listed file must still hold some tool text, must mention registerTool exactly as often as
// recorded here, and no other file under extensions/ or scripts/ may mention it at all.
//
// Each entry: file, ceiling in words, mentions of registerTool in the file.
const TOOL_TEXT = {
  principal_workflow: ["extensions/workflow.ts", 459, 1],
  principal_handoff: ["extensions/handoff.ts", 114, 1],
  // Two mentions: the method Pi's code-mode extension calls, and the call it makes.
  principal_codemode: ["extensions/codemode.ts", 28, 2],
  principal_delivery: ["extensions/delivery.ts", 100, 1],
};

const count = (t) => {
  t = t.trim();
  return t ? t.split(/\s+/).length : 0;
};
const words = (p) => count(readFileSync(join(ROOT, p), "utf8"));

// The strings written at the text keys of one source file. A value there that cannot be read
// whole is reported, never skipped: text continued or assembled some other way would otherwise
// be counted short and pass. Problems carry the line they were found on.
const TEXT_KEY = "description|promptSnippet|promptGuidelines";
const toolText = (source) => {
  const texts = [], unread = [], keyAt = new Set();
  const line = (index) => source.slice(0, index).split("\n").length;
  const key = new RegExp(`\\b(${TEXT_KEY})"?\\s*:\\s*(\\[\\s*)?`, "g");
  const literal = /"(?:[^"\\]|\\.)*"/y, comma = /\s*,\s*/y;
  // What must follow a value that was read whole: the end of the property, or the end of the
  // array and then of the property. `"a" + more` and `["a", more]` do not end there.
  const endValue = /\s*[,}]/y, endArray = /\s*,?\s*\]\s*[,}]/y;
  let rest = "", from = 0;
  for (let match; (match = key.exec(source)); ) {
    const start = key.lastIndex, end = match[2] ? endArray : endValue, read = [];
    let at = start, whole = false;
    keyAt.add(match.index);
    for (;;) {
      literal.lastIndex = at;
      const text = literal.exec(source);
      if (!text) break;
      try {
        read.push(JSON.parse(text[0]));
      } catch {
        break;
      }
      at = literal.lastIndex;
      end.lastIndex = at;
      if (end.exec(source)) {
        whole = true;
        break;
      }
      // Only an array continues with further strings.
      comma.lastIndex = at;
      if (!match[2] || !comma.exec(source)) break;
      at = comma.lastIndex;
    }
    if (!whole) {
      unread.push([line(match.index), `this ${match[1]} value is not plain double-quoted text`]);
      continue;
    }
    texts.push(...read);
    // Text already counted is blanked, so it is not searched for further keys or mentions.
    rest += source.slice(from, start) + " ".repeat(at - start);
    from = key.lastIndex = at;
  }
  rest += source.slice(from);
  // A shorthand property or a later assignment names the text without a value to read here.
  for (const mention of rest.matchAll(new RegExp(`\\b(${TEXT_KEY})\\b`, "g"))) {
    if (!keyAt.has(mention.index)) unread.push([line(mention.index), `${mention[1]} is named without a value to read`]);
  }
  return { texts, unread };
};

const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const errors = [];
const checked = [];

// Table rows: | `skill` | what | how it runs | words |
// The "how it runs" cell may name an agent twin and its own count: (`agents/principal-plan.md`, 1425)
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
const EXPECTED_SKILLS = 10;
const skillFiles = checked.filter((p) => p.endsWith("/SKILL.md")).length;
if (skillFiles !== EXPECTED_SKILLS) {
  errors.push(
    `parsed ${skillFiles} skill row(s) from the README table, expected ${EXPECTED_SKILLS} — ` +
      `the table format changed and this check is no longer reading it`
  );
}

const toolCounts = [];
for (const [tool, [path, ceiling, registrations]] of Object.entries(TOOL_TEXT)) {
  let source;
  try {
    source = readFileSync(join(ROOT, path), "utf8");
  } catch {
    errors.push(`${path}: budgeted for ${tool} but not readable`);
    continue;
  }
  if (!source.includes(`name: "${tool}"`)) {
    errors.push(`${path}: no longer registers ${tool} — update TOOL_TEXT in scripts/check-word-budgets.mjs`);
    continue;
  }
  const { texts, unread } = toolText(source);
  for (const [at, problem] of unread) {
    errors.push(
      `${path}:${at}: ${problem}, so the tool text cannot be counted — write it as "key: \"text\"", ` +
        `or teach scripts/check-word-budgets.mjs to read it`
    );
  }
  const actual = count(texts.join(" "));
  toolCounts.push(`${tool} ${actual}/${ceiling}`);
  // A tool with no text written here, or one more registration than recorded, is how text
  // supplied from another module would arrive.
  if (!actual) {
    errors.push(`${path}: found no tool text for ${tool} — text supplied from elsewhere is not counted`);
  }
  const mentions = source.split(/\bregisterTool\b/).length - 1;
  if (mentions !== registrations) {
    errors.push(
      `${path}: mentions registerTool ${mentions} time(s), TOOL_TEXT records ${registrations} — a further ` +
        `tool's text may come from elsewhere; check it, then update scripts/check-word-budgets.mjs`
    );
  }
  if (actual > ceiling) {
    errors.push(
      `${path}: ${tool} sends ${actual} words of tool text, over its ${ceiling} budget — trim it, ` +
        `or change TOOL_TEXT in scripts/check-word-budgets.mjs and the README`
    );
  }
  // The README states the ceilings as decisions; a stated number that differs is a false claim.
  const stated = [...readme.matchAll(new RegExp("`" + tool + "`\\s+(\\d+)", "g"))].map((m) => Number(m[1]));
  if (!stated.length || stated.some((n) => n !== ceiling)) {
    errors.push(
      `README.md: says ${stated.join(" and ") || "nothing"} for the ${tool} tool-text budget, ` +
        `scripts/check-word-budgets.mjs says ${ceiling} — make them agree`
    );
  }
}

// A tool registered from a file not listed above would send text that nothing here counts.
const budgeted = new Set(Object.values(TOOL_TEXT).map(([path]) => path));
const sources = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(`${dir}/${entry.name}`) : entry.isFile() ? [`${dir}/${entry.name}`] : []
  );
for (const path of [...sources("extensions"), ...sources("scripts")].sort()) {
  if (budgeted.has(path) || path === "scripts/check-word-budgets.mjs") continue;
  if (/\bregisterTool\b/.test(readFileSync(join(ROOT, path), "utf8"))) {
    errors.push(
      `${path}: mentions registerTool but has no tool-text ceiling — add it to TOOL_TEXT in ` +
        `scripts/check-word-budgets.mjs and the README`
    );
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} word-budget finding(s)`);
  process.exit(1);
}
console.log(`✓ ${checked.length} file(s) match the README table and are within budget`);
console.log(`✓ ${toolCounts.length} tool text(s) within budget: ${toolCounts.join(", ")}`);

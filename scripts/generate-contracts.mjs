#!/usr/bin/env node
/**
 * Render `<skill>/SKILL.md` and `agents/<skill>.md` from one template per contract.
 *
 * `plan`, `review` and `debug` each exist twice: an interactive contract loaded as a skill,
 * and a single-shot contract handed to a subagent as its system prompt. The two are 74–84%
 * identical, and that shared majority is the whole problem — a rule edited in one and not
 * the other is a silent divergence, and it has happened: the D-scenarios once tested a
 * contract no agent had been handed. CI grew an agents-lockstep check to catch it, but that
 * check only proves both files were *touched*, never that they still agree.
 *
 * So the shared text lives once, in contracts/<skill>.md.tmpl, and the divergences are
 * explicit:
 *
 *     {{#skill}} …only in <skill>/SKILL.md… {{/skill}}
 *     {{#agent}} …only in agents/<skill>.md… {{/agent}}
 *
 * Anything outside a block appears in both. Marker lines are consumed; they never reach the
 * output. Blocks do not nest — a nested marker is an error rather than a guess.
 *
 * A line starting with `{{!` is a template comment and is dropped from both outputs. That is
 * how the templates carry a do-not-hand-edit warning without adding a byte to the prompts.
 *
 * ## Why the generated files carry no "generated" banner
 *
 * The plan for this change asked for a notice after the frontmatter so nobody hand-edits the
 * output. It is not there deliberately, because these files are not source code — they are
 * prompts, and every byte is measured. Adding a line would change the text behind nine
 * published scorecard cells (three skills × three models), stale every one of them, and cost
 * roughly 500 rep-executions to restore a number that would not have moved. That trade is
 * not worth a comment.
 *
 * `--check` replaces it, and protects better: a hand-edit fails CI with the exact diff,
 * whereas a banner only asks politely. The templates carry the warning instead, since the
 * template is the file a person opens to make a change.
 *
 * Usage:
 *   node scripts/generate-contracts.mjs           write the six files
 *   node scripts/generate-contracts.mjs --check    render in memory, diff, exit 1 on drift
 */

import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACTS = ["plan", "review", "debug"];
const MODES = { skill: (s) => `${s}/SKILL.md`, agent: (s) => `agents/${s}.md` };

const OPEN = /^\{\{#(skill|agent)\}\}$/;
const CLOSE = /^\{\{\/(skill|agent)\}\}$/;
const COMMENT = /^\{\{!/;

/**
 * Strip every block not belonging to `mode`, and unwrap the ones that do.
 * Line-based on purpose: a marker owns its whole line, so rendering can never leave a
 * fragment behind or split a line that carries prompt text.
 */
export function render(template, mode, source = "<template>") {
  const out = [];
  let open = null;
  let openLine = 0;

  template.split("\n").forEach((line, i) => {
    if (COMMENT.test(line)) return;
    const o = line.match(OPEN);
    if (o) {
      if (open) throw new Error(`${source}:${i + 1}: {{#${o[1]}}} inside an unclosed {{#${open}}} opened at line ${openLine} — blocks do not nest`);
      open = o[1];
      openLine = i + 1;
      return;
    }
    const c = line.match(CLOSE);
    if (c) {
      if (!open) throw new Error(`${source}:${i + 1}: {{/${c[1]}}} with no matching open`);
      if (c[1] !== open) throw new Error(`${source}:${i + 1}: {{/${c[1]}}} closes a {{#${open}}} opened at line ${openLine}`);
      open = null;
      return;
    }
    if (open === null || open === mode) out.push(line);
  });

  if (open) throw new Error(`${source}: {{#${open}}} opened at line ${openLine} is never closed`);
  return out.join("\n");
}

// Importing this file (the unit tests do) must not run the CLI — otherwise `node --test`
// would rewrite the six contracts as a side effect of loading the module under test.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (!invokedDirectly) {
  // exported for tests
} else main();

function main() {
const check = process.argv.includes("--check");
const drift = [];
let written = 0;

for (const contract of CONTRACTS) {
  const rel = `contracts/${contract}.md.tmpl`;
  const template = readFileSync(join(ROOT, rel), "utf8");

  for (const [mode, target] of Object.entries(MODES)) {
    const path = target(contract);
    const rendered = render(template, mode, rel);

    if (check) {
      let current;
      try {
        current = readFileSync(join(ROOT, path), "utf8");
      } catch {
        drift.push(`${path}: missing — run \`npm run generate\``);
        continue;
      }
      if (current !== rendered) {
        const c = current.split("\n");
        const r = rendered.split("\n");
        const at = c.findIndex((l, i) => l !== r[i]);
        drift.push(
          `${path}: differs from ${rel} at line ${at + 1}\n` +
            `    committed: ${JSON.stringify(c[at] ?? "<eof>")}\n` +
            `    generated: ${JSON.stringify(r[at] ?? "<eof>")}`
        );
      }
    } else {
      writeFileSync(join(ROOT, path), rendered);
      written++;
    }
  }
}

if (check) {
  if (drift.length) {
    console.error("✗ generated contracts are out of date:\n");
    for (const d of drift) console.error(`  ${d}\n`);
    console.error(
      `${drift.length} file(s) drifted. Edit contracts/*.md.tmpl — never the generated\n` +
        `file — then run \`npm run generate\` and commit both.`
    );
    process.exit(1);
  }
  console.log(`✓ ${CONTRACTS.length * 2} generated contracts match their templates`);
} else {
  console.log(`✓ wrote ${written} file(s) from ${CONTRACTS.length} template(s)`);
}
}

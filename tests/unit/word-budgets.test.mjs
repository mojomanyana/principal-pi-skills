import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const WORKFLOW = "extensions/workflow.ts", HANDOFF = "extensions/handoff.ts", CODEMODE = "extensions/codemode.ts";
const STRING = String.raw`"(?:[^"\\]|\\.)*"`;

// The check resolves its root from its own location, so a copy of the script inside a copy of the
// files it reads exercises the real script against edited inputs. Nothing in the repository changes.
function budgetCheck(t, ...edits) {
  const root = mkdtempSync(join(tmpdir(), "principal-budgets-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ["README.md", "agents", "extensions", "scripts/check-word-budgets.mjs"]) {
    cpSync(join(ROOT, name), join(root, name), { recursive: true });
  }
  for (const name of readdirSync(ROOT)) {
    if (existsSync(join(ROOT, name, "SKILL.md"))) cpSync(join(ROOT, name, "SKILL.md"), join(root, name, "SKILL.md"));
  }
  for (const [path, change] of edits) {
    if (!change) { path(root); continue; }
    const file = join(root, path), before = existsSync(file) ? readFileSync(file, "utf8") : "", after = change(before);
    assert.notEqual(after, before, `${path}: the fixture edit matched nothing`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, after);
  }
  const run = spawnSync(process.execPath, [join(root, "scripts/check-word-budgets.mjs")], { encoding: "utf8" });
  const output = run.stdout + run.stderr;
  const budgets = Object.fromEntries([...output.matchAll(/(principal_\w+) (\d+)\/(\d+)/gu)]
    .map(([, tool, actual, ceiling]) => [tool, { actual: Number(actual), ceiling: Number(ceiling) }]));
  return { status: run.status, output, budgets };
}
const replace = (pattern, replacement) => source => source.replace(pattern, replacement);
const append = text => source => `${source}\n${text}\n`;

test("the committed tool text is within its ceilings and the README states them", t => {
  const { status, output, budgets } = budgetCheck(t);
  assert.equal(status, 0, output);
  assert.match(output, /✓ 3 tool text\(s\) within budget: /);
  assert.deepEqual(Object.keys(budgets), ["principal_workflow", "principal_handoff", "principal_codemode"]);
  for (const { actual, ceiling } of Object.values(budgets)) assert.ok(actual > 0 && actual <= ceiling);
});

test("tool text one word over its ceiling fails, wherever the words are written", t => {
  // Regression for uncounted growth: before this check, description and guideline text grew release
  // after release without touching a budget. Each case adds exactly enough words to pass the ceiling
  // by one, so the reported count also proves the words were counted, not merely noticed.
  const { budgets } = budgetCheck(t);
  const cases = [
    ["principal_workflow", WORKFLOW, "the tool description", words => replace(/(name: "principal_workflow"[^]*?description: ")/u, `$1${words} `)],
    ["principal_workflow", WORKFLOW, "the guidelines", words => replace("promptGuidelines: [\"", `promptGuidelines: ["${words} `)],
    ["principal_workflow", WORKFLOW, "an inline parameter description", words => replace("repo: Type.Optional(Type.String())", `repo: Type.Optional(Type.String({ description: "${words}" }))`)],
    ["principal_handoff", HANDOFF, "the tool description", words => replace(/(name: "principal_handoff"[^]*?description: ")/u, `$1${words} `)],
    ["principal_handoff", HANDOFF, "a second guideline", words => replace(new RegExp(`(promptGuidelines: \\[${STRING})\\]`, "u"), `$1, "${words}"]`)],
    ["principal_handoff", HANDOFF, "a second guideline on its own line with a trailing comma", words => replace(new RegExp(`(promptGuidelines: \\[${STRING})\\]`, "u"), `$1,\n      "${words}",\n    ]`)],
    ["principal_handoff", HANDOFF, "a prompt snippet", words => replace("name: \"principal_handoff\",", `name: "principal_handoff", promptSnippet: "${words}",`)],
    ["principal_handoff", HANDOFF, "a quoted key on its own line", words => replace(/(name: "principal_handoff"[^]*?)description: "/u, `$1"description":\n      "${words} `)],
    // One word in escaped quotes and a lone backslash: one more word than the others add.
    ["principal_handoff", HANDOFF, "text with escaped quotes and a backslash", words => replace(/(name: "principal_handoff"[^]*?description: ")/u, `$1${words.replace("more", String.raw`\"more\"`)} ${String.raw`\\`} `), 1],
    ["principal_codemode", CODEMODE, "the guidelines", words => replace("promptGuidelines: [\"", `promptGuidelines: ["${words} `)],
    ["principal_codemode", CODEMODE, "a description of its own", words => replace("label: \"Principal tools\",", `label: "Principal tools", description: "${words}",`)],
  ];
  for (const [tool, path, where, change, extra = 0] of cases) {
    const { actual, ceiling } = budgets[tool];
    const words = Array.from({ length: ceiling - actual + 1 }, () => "more").join(" ");
    const { status, output } = budgetCheck(t, [path, change(words)]);
    assert.equal(status, 1, `${tool}: ${where}`);
    assert.ok(output.includes(`${path}: ${tool} sends ${ceiling + 1 + extra} words of tool text, over its ${ceiling} budget`), `${tool}: ${where}\n${output}`);
  }
});

test("shorter tool text passes without touching the ceiling", t => {
  const { status, output, budgets } = budgetCheck(t, [WORKFLOW, replace(/(promptGuidelines: \[")\S+ /u, "$1")]);
  assert.equal(status, 0, output);
  assert.equal(budgets.principal_workflow.actual, budgetCheck(t).budgets.principal_workflow.actual - 1);
});

test("tool text the check cannot read whole is reported, never counted short", t => {
  // Each of these would send more words than the check could see. Counting what it can read and passing
  // is the failure this guards against, so the check must stop instead.
  const description = new RegExp(`(name: "principal_handoff"[^]*?description: )(${STRING})`, "u");
  const guidelines = new RegExp(`(promptGuidelines: \\[${STRING})\\]`, "u");
  const unreadable = [
    ["description", "continued with +", replace(description, "$1$2 +\n      \" and more\"")],
    ["description", "built from a variable", replace(description, "$1$2.concat(more)")],
    ["description", "a template literal", replace(description, (_match, key, text) => `${key}\`${JSON.parse(text)}\``)],
    ["description", "single-quoted", replace(description, (_match, key, text) => `${key}'${JSON.parse(text).replaceAll("'", "")}'`)],
    ["description", "an identifier", replace(description, "$1shared")],
    ["description", "an escape JSON cannot read", replace(description, (_match, key, text) => `${key}${text.slice(0, -1)} \\x41"`)],
    ["promptGuidelines", "an identifier after the first string", replace(guidelines, "$1, shared]")],
    ["promptGuidelines", "a spread after the first string", replace(guidelines, "$1, ...shared]")],
    ["promptGuidelines", "an identifier before the first string", replace("promptGuidelines: [\"", "promptGuidelines: [shared, \"")],
    ["promptGuidelines", "extended after the array", replace(guidelines, "$1].concat(shared)")],
  ];
  for (const [key, how, change] of unreadable) {
    const { status, output } = budgetCheck(t, [HANDOFF, change]);
    assert.equal(status, 1, how);
    assert.match(output, new RegExp(`${HANDOFF}:\\d+: this ${key} value is not plain double-quoted text`), how);
  }
  const unnamed = [
    ["a shorthand property", replace(description, (_match, key) => key.replace(/: $/u, ""))],
    ["a later assignment", append("export const later = tool => { tool.description += \" and more\"; };")],
  ];
  for (const [how, change] of unnamed) {
    const { status, output } = budgetCheck(t, [HANDOFF, change]);
    assert.equal(status, 1, how);
    assert.match(output, new RegExp(`${HANDOFF}:\\d+: description is named without a value to read`), how);
  }
  // The reported line is the line of the problem, so a loud failure can be found.
  const located = budgetCheck(t, [HANDOFF, append("export const later = tool => tool.promptSnippet;")]);
  const last = readFileSync(join(ROOT, HANDOFF), "utf8").split("\n").length + 1;
  assert.ok(located.output.includes(`${HANDOFF}:${last}: promptSnippet is named without a value to read`), located.output);
  // Text that only talks about a key is counted as text, not mistaken for one.
  const quoted = budgetCheck(t, [HANDOFF, replace(/(name: "principal_handoff"[^]*?description: ")\S+ \S+/u, "$1description: promptGuidelines:")]);
  assert.equal(quoted.status, 0, quoted.output);
});

test("tool text that could arrive from another module does not pass quietly", t => {
  // The check reads source, so it cannot see text attached by a spread or built elsewhere. These are the
  // shapes in which such text would arrive; each must stop the check instead of leaving a smaller count.
  const tool = "({ name: \"principal_extra\", description: \"Unbudgeted.\" });";
  const unlisted = [
    ["extensions/resume.ts", append(`export const extra = pi => pi.registerTool${tool}`)],
    ["extensions/extra.ts", append(`export default host => host.registerTool${tool}`)],
    ["extensions/more/index.mjs", append(`export default pi => { const { registerTool } = pi; registerTool${tool} };`)],
    ["scripts/extra-tool.mjs", append(`export const register = pi => pi\n  .registerTool${tool}`)],
  ];
  for (const [path, change] of unlisted) {
    const { status, output } = budgetCheck(t, [path, change]);
    assert.equal(status, 1, path);
    assert.ok(output.includes(`${path}: mentions registerTool but has no tool-text ceiling`), `${path}\n${output}`);
  }
  // A further tool in a listed file may take its text from anywhere.
  const second = budgetCheck(t, [HANDOFF, append("export const extra = (pi, imported) => pi.registerTool(imported);")]);
  assert.equal(second.status, 1);
  assert.ok(second.output.includes(`${HANDOFF}: mentions registerTool 2 time(s), TOOL_TEXT records 1`), second.output);
  // All of a listed tool's text moved out of its file.
  const moved = budgetCheck(t, [HANDOFF, source => source
    .replace(new RegExp(`(name: "principal_handoff"[^]*?)description: ${STRING},`, "u"), "$1...text,")
    .replace(new RegExp(`\\s*promptGuidelines: \\[${STRING}\\],`, "u"), "")]);
  assert.equal(moved.status, 1);
  assert.ok(moved.output.includes(`${HANDOFF}: found no tool text for principal_handoff`), moved.output);

  const renamed = budgetCheck(t, [HANDOFF, replace("name: \"principal_handoff\"", "name: \"principal_transfer\"")]);
  assert.equal(renamed.status, 1);
  assert.ok(renamed.output.includes(`${HANDOFF}: no longer registers principal_handoff`), renamed.output);
});

test("files that register nothing do not trip the guard", t => {
  // A linked directory is skipped, not read as a file. Where links cannot be made, the plain file still runs.
  const linked = root => { try { symlinkSync(join(root, "agents"), join(root, "scripts/linked"), "dir"); } catch { /* No link support here. */ } };
  const { status, output } = budgetCheck(t, [linked], ["scripts/notes.mjs", append("// Tool descriptions are budgeted elsewhere.")]);
  assert.equal(status, 0, output);
});

test("the README must state each ceiling, and only that number", t => {
  const stated = /(`principal_handoff`\s+)(\d+)/u, { ceiling } = budgetCheck(t).budgets.principal_handoff;
  const reflowed = budgetCheck(t, ["README.md", replace(stated, "`principal_handoff`\n$2")]);
  assert.equal(reflowed.status, 0, reflowed.output);
  for (const [says, change] of [
    ["1", replace(stated, "$11")],
    ["nothing", replace(stated, "the handoff tool $2")],
    [`13 and ${ceiling}`, source => `The \`principal_handoff\` 13 actions are described below.\n\n${source}`],
    [`${ceiling} and 13`, append("The `principal_handoff` 13 actions are described above.")],
  ]) {
    const { status, output } = budgetCheck(t, ["README.md", change]);
    assert.equal(status, 1, says);
    assert.ok(output.includes(`README.md: says ${says} for the principal_handoff tool-text budget`), `${says}\n${output}`);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const outputs = ["plan/SKILL.md", "agents/plan.md", "agents/principal-plan.md"];
const runtimePaths = [
  "contracts/workflows.md.tmpl", "prompts/feature.md", "prompts/bugfix.md", "prompts/principal-feature.md", "prompts/principal-bugfix.md",
  "schemas/assurance-run-state-v1.schema.json", "schemas/assurance-task-packet-v1.schema.json", "scripts/assurance-state.mjs",
];
const BASE = "57dd53ef3c845974117b290e56732c5aa2e40aa2";

const requirements = [
  ["Critical-only boundary", "These rules apply only to Critical scope; non-Critical plans keep the right-sized forms below."],
  ["global authority and scope", "Before `Steps:`, emit concrete `Authority:`, `Global constraints:`,\n`Out of scope:`, and a `Critical scope:` summary"],
  ["per-task scope", "Every task repeats its concrete `Critical scope:` match"],
  ["stable named tests", "Every Critical task names a stable test file and test name"],
  ["literal targeted command", "`Done command:` is one literal, targeted, proposed repository-local verification invocation"],
  ["separate result", "with the expected result in its separate field"],
  ["declarative untrusted boundary", "It is declarative, untrusted\nPlan output—not execution authorization—and is never automatically executed by Plan or packet\npersistence."],
  ["deferred enforcement boundary", "Downstream Build must inspect it against the repository before choosing whether to\nexecute it; this version provides no deterministic command or approval enforcement."],
  ["observed repository values", "repository context supplies real paths, tests, and commands, use those exact observed values"],
  ["assumptions", "under clearly labelled\nAssumptions requiring validation; never claim they were observed"],
  ["placeholder rejection", "Do not emit `TBD`, angle-bracket tokens, bare `node --test`, generic\n“run tests” prose, or another broad untargeted command."],
  ["controller identity partition", "Plan defines task content and stable `task_id`;\nthe controller supplies `schema_version`, `run_id`, `workspace_id`, `plan_digest`, and\n`definition_digests`."],
  ["runtime deferral", "Runtime enforcement of command\nsyntax, discovery identity, authority digests, and event-log migration is deferred to a future\nversioned runtime contract and is not claimed here."],
  ["vertical slices", "Every task remains a vertical behavioral slice delivering an independently testable user or system\noutcome."],
  ["assurance-only rejection", "Critique, packet persistence, review, handoff, and test-only ceremony are controller work,\nnot delivery slices; never add one as a final task."],
];

function section(text) {
  const match = text.match(/## Critical plan contract\n([\s\S]*?)\n## Right-sizing/);
  assert.ok(match, "missing Critical plan contract");
  return match[1];
}
function assertContract(text) {
  const critical = section(text);
  for (const [name, phrase] of requirements) assert.ok(critical.includes(phrase), `missing ${name}`);
  assert.doesNotMatch(critical, /plan_discovery_recorded|controller_authority_recorded|critical-test-runner-argv|HEAD\^\{tree\}/);
}

test("Critical Plan contract renders behavioral requirements into every generated prompt", () => {
  for (const path of outputs) assert.doesNotThrow(() => assertContract(read(path)), path);
});

test("each load-bearing static requirement is independently mutation-sensitive", () => {
  const source = read("plan/SKILL.md");
  assertContract(source);
  for (const [name, phrase] of requirements) {
    const mutated = source.replace(phrase, "");
    assert.notEqual(mutated, source, name);
    assert.throws(() => assertContract(mutated), undefined, `${name} survived`);
  }
  assert.equal(requirements.length, 15);
});

test("runtime-v2 enforcement is explicitly deferred and all runtime surfaces remain main-identical", async () => {
  assert.match(read("plan/SKILL.md"), /future\nversioned runtime contract and is not claimed here/);
  for (const path of runtimePaths) {
    const { execFileSync } = await import("node:child_process");
    const main = execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT });
    assert.deepEqual(readFileSync(join(ROOT, path)), main, path);
  }
});

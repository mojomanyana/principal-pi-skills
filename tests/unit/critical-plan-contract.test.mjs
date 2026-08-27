import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const packetSchema = JSON.parse(read("schemas/assurance-task-packet-v1.schema.json"));
const generatedPlans = ["plan/SKILL.md", "agents/plan.md", "agents/principal-plan.md"];

const ruleMutations = [
  ["critical-only boundary", "These rules apply only to Critical scope; non-Critical plans keep the right-sized forms below."],
  ["global ordering", "Before `Steps:`, emit concrete `Authority:`, `Global constraints:`,"],
  ["per-task fields", "Every task emits\nconcrete `Task ID:`, `Critical scope:`, `Files:`, `Dependencies:`, `Change:`, `Test:`, `Done command:`,\n`Expected result:`, `Review risk:`, and `Ripples:` values."],
  ["per-task critical scope", "Critical scope is per task, not a fourth\nglobal field."],
  ["named tests", "Every Critical task names one or more stable tests by test file and test name"],
  ["literal targeted command", "`Done command:` is one literal, targeted, repository-local test-runner\ninvocation selecting that file or test name"],
  ["declarative command boundary", "declarative Plan output, never a command that Plan or packet persistence executes"],
  ["unsafe command rejection", "Exclude pipes,\nredirections, command chaining/substitution, network access, privilege changes, and destructive\noperations"],
  ["observed values", "repository context supplies real paths, tests, and commands, use those exact observed values"],
  ["assumed concrete values", "context is absent, propose concrete values, label them as assumptions"],
  ["placeholder rejection", "Do not emit `TBD`, angle-bracket tokens, broad commands such as bare `node --test`"],
  ["discovery receipt", "passing `plan_discovery_recorded` event bound to the current\nplan and workspace"],
  ["discovery fail closed", "missing, stale, or mismatched discovery stops execution for replan and packet\nsupersession"],
  ["controller persistence", "The controller—not Plan—owns packet persistence."],
  ["authority validation", "before persistence the controller rejects any narrowing, expansion, or mismatch"],
  ["vertical outcomes", "Every task remains a vertical behavioral slice delivering an independently testable user or system\noutcome."],
  ["assurance-only rejection", "Never add a final assurance, review,\ntest-only, packet, or handoff slice that delivers no behavior."],
];

function criticalSection(text) {
  const match = text.match(/## Critical plan contract\n([\s\S]*?)\n## Right-sizing/);
  assert.ok(match, "missing Critical plan contract section");
  return match[1];
}

function listedFields(section, owner) {
  const next = owner === "Plan" ? "Controller" : null;
  const pattern = next
    ? /- Plan defines ([\s\S]*?)\.\n- Controller supplies/
    : /- Controller supplies ([\s\S]*?)\.\n\nPlan's authority/;
  const match = section.match(pattern);
  assert.ok(match, `missing ${owner} packet-field declaration`);
  return [...match[1].matchAll(/`([a-z_]+)`/g)].map((entry) => entry[1]);
}

function assertCriticalContract(text) {
  const section = criticalSection(text);
  for (const [name, phrase] of ruleMutations) assert.ok(section.includes(phrase), `missing ${name}`);

  assert.doesNotMatch(section, /<[^>\n]+>/, "Critical contract must not contain copyable angle-bracket placeholders");
  assert.match(section, /Before `Steps:`[^.]*`Authority:`[^.]*`Global constraints:`[^.]*`Out of scope:`[^.]*`Discovery\/validation:`[^.]*`Task-packet handoff:`/s);
  assert.match(section, /Every task emits[^.]*`Task ID:`[^.]*`Critical scope:`[^.]*`Files:`[^.]*`Dependencies:`[^.]*`Change:`[^.]*`Test:`[^.]*`Done command:`[^.]*`Expected result:`[^.]*`Review risk:`[^.]*`Ripples:`/s);

  const planFields = listedFields(section, "Plan");
  const controllerFields = listedFields(section, "Controller");
  assert.equal(new Set(planFields).size, planFields.length, "duplicate Plan-owned packet field");
  assert.equal(new Set(controllerFields).size, controllerFields.length, "duplicate controller-owned packet field");
  assert.deepEqual(planFields.filter((field) => controllerFields.includes(field)), [], "packet ownership must be disjoint");
  assert.deepEqual(
    [...planFields, ...controllerFields].sort(),
    [...packetSchema.required].sort(),
    "packet ownership must exactly cover canonical required fields",
  );
  assert.deepEqual(controllerFields.sort(), ["definition_digests", "plan_digest", "run_id", "schema_version", "workspace_id"]);
  assert.ok(planFields.includes("task_id"), "Plan must define stable task_id");
}

test("Critical Plan contract renders complete Critical-only invariants into every generated prompt", () => {
  for (const path of generatedPlans) assert.doesNotThrow(() => assertCriticalContract(read(path)), path);
});

test("Critical packet ownership is disjoint and exactly exhausts the canonical schema", () => {
  assertCriticalContract(read("plan/SKILL.md"));
});

test("Critical contract rejects every structural rule and packet-field mutation independently", () => {
  const source = read("plan/SKILL.md");
  assertCriticalContract(source);
  for (const [name, phrase] of ruleMutations) {
    const mutated = source.replace(phrase, "");
    assert.notEqual(mutated, source, `mutation did not remove ${name}`);
    assert.throws(() => assertCriticalContract(mutated), undefined, `${name} structural mutation survived`);
  }
  for (const field of packetSchema.required) {
    const section = criticalSection(source);
    const mutatedSection = section.replace(`\`${field}\``, "`removed_field`");
    assert.notEqual(mutatedSection, section, `mutation did not remove packet field ${field}`);
    const mutated = source.replace(section, mutatedSection);
    assert.throws(() => assertCriticalContract(mutated), undefined, `${field} packet-field mutation survived`);
  }
  assert.equal(ruleMutations.length + packetSchema.required.length, 32);
});

test("Critical contract is declarative and fail-closed while generic non-Critical output stays unchanged", () => {
  const text = read("plan/SKILL.md");
  const section = criticalSection(text);
  assert.match(section, /Done command:` is one literal, targeted, repository-local test-runner/);
  assert.match(section, /Expected result:/);
  assert.match(section, /plan_discovery_recorded/);
  assert.match(text, /For non-Critical multi-step work, use the template below/);
  assert.match(text, /Done command: <exact command \+ expected result>/);
  assert.doesNotMatch(section, /Done command: <exact command/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const packetSchema = JSON.parse(read("schemas/assurance-task-packet-v1.schema.json"));
const canonicalPacketFields = ["schema_version", "run_id", "task_id", "workspace_id", "plan_digest", "definition_digests"];

function criticalSection(text) {
  const match = text.match(/## Critical plan contract\n([\s\S]*?)\n## Right-sizing/);
  assert.ok(match, "missing Critical plan contract section");
  return match[1];
}

const rules = [
  ["authority and scope", /Authority, Global constraints,\s*Out of scope, and Critical scope[^.]*before `Steps:`/],
  ["named tests", /Every Critical task names one or more stable tests\s*by test file and test name/],
  ["literal targeted Done commands", /`Done command:` is a literal\s*executable command[^.]*targeting the named test file or test-name selector/],
  ["context-backed exact values", /repository context supplies real paths and commands, use those exact observed\s*values/],
  ["assumed concrete values", /context is absent, propose concrete paths, stable test names, and literal commands;\s*mark each as assumptions requiring verification/],
  ["discovery validation", /`Discovery\/validation:`[^.]*explicit\s*pre-execution step that runs before task 1[^.]*replan and packet supersession/],
  ["placeholder rejection", /Never emit placeholders such as\s*`<test-file>`, `<command>`, or `TBD`/],
  ["broad command rejection", /Never emit broad commands or generic instructions such as\s*bare `node --test`, “run tests”, or “run the relevant test”/],
  ["existence claim rejection", /Never claim that an assumed path, test,\s*or command was observed to exist/],
  ["controller ownership", /The controller—not Plan—owns packet persistence/],
  ["plan/controller separation", /Plan emits task definitions; it does not emit or\s*fill a persisted packet/],
  ["vertical outcomes", /Every task remains a vertical behavioral slice delivering an independently testable user or system\s*outcome/],
  ["assurance-only slice rejection", /assurance-only activities are controller work, not tasks\.\s*Never add a final[\s\S]*?slice that delivers no behavior/],
];

function violations(text) {
  let section;
  try {
    section = criticalSection(text);
  } catch {
    return ["critical section"];
  }
  const failures = rules.filter(([, pattern]) => !pattern.test(section)).map(([name]) => name);
  const controllerLine = section.match(/Controller-supplied canonical fields: ([^.]+)\./)?.[1] ?? "";
  for (const field of canonicalPacketFields.filter((field) => field !== "task_id")) {
    if (!controllerLine.includes(`\`${field}\``)) failures.push(`canonical controller field ${field}`);
  }
  if (!/Plan-supplied stable identity: `task_id`\./.test(section)) failures.push("canonical plan task identity");
  return failures;
}

test("Critical Plan contract renders every required invariant into skill and agent prompts", () => {
  for (const path of ["plan/SKILL.md", "agents/plan.md", "agents/principal-plan.md"]) {
    assert.deepEqual(violations(read(path)), [], path);
  }
});

test("Critical Plan packet handoff names fields from the canonical task-packet schema", () => {
  for (const field of canonicalPacketFields) {
    assert.ok(packetSchema.required.includes(field), `${field} is not required by the canonical packet schema`);
  }
  assert.deepEqual(violations(read("plan/SKILL.md")), []);
});

test("Critical Plan contract rejects 19 load-bearing rule and packet-field mutations independently", () => {
  assert.equal(rules.length + canonicalPacketFields.length, 19);
  const source = read("plan/SKILL.md");
  assert.deepEqual(violations(source), []);
  for (const [name, pattern] of rules) {
    const mutated = source.replace(pattern, "");
    assert.notEqual(mutated, source, `mutation did not remove ${name}`);
    assert.ok(violations(mutated).includes(name), `${name} mutation survived`);
  }
  for (const field of canonicalPacketFields) {
    const mutated = source.replace(`\`${field}\``, "`removed_field`");
    assert.notEqual(mutated, source, `mutation did not remove ${field}`);
    const expected = field === "task_id" ? "canonical plan task identity" : `canonical controller field ${field}`;
    assert.ok(violations(mutated).includes(expected), `${field} mutation survived`);
  }
});

test("Critical concrete task template separates test names, executable commands, and expected results", () => {
  const text = read("plan/SKILL.md");
  assert.match(text, /Test: stable test file and test name — level; edge cases: concrete boundaries/);
  assert.match(text, /Done command: literal targeted executable command/);
  assert.match(text, /Expected result: observable pass condition/);
  assert.match(text, /Task-packet handoff \(Critical only; omit otherwise\): Plan defines `task_id`; controller supplies `schema_version`, `run_id`, `workspace_id`, `plan_digest`, and `definition_digests`, validates, and persists the canonical packet\./);
  assert.doesNotMatch(text, /Done command: <exact command/);
});

// Offline fixture integrity and evaluator counterexamples, NOT model behavior evidence.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = "evals/requirement-fidelity";
const text = (p) => readFileSync(resolve(root, p), "utf8");
const json = (p) => JSON.parse(text(p));
const skills = ["plan", "build", "review", "debug", "investigate", "decide", "architect"];
const covers = s => s.covers.map(ref => ref.split("#").at(-1).toUpperCase());

test("seven substantive installed-runner specs have unique cases and resolving fixtures/contracts", () => {
  const seen = new Set();
  for (const skill of skills) {
    const spec = json(`${skill}/tests/specification.yaml`);
    assert.equal(spec.schema, 1);
    assert.equal(spec.skill, skill);
    assert.ok(spec.scenarios.length >= 3);
    assert.equal(spec.ship_bar.total, spec.scenarios.length);
    assert.equal(spec.ship_bar.min_pass, spec.scenarios.length);
    for (const s of spec.scenarios) {
      assert.ok(!seen.has(s.id), s.id); seen.add(s.id);
      assert.equal(s.mode, "inline"); // seeded agent forwarding is broken in installed 0.21.0
      assert.ok(s.critical && s.checklist.length >= 3 && s.checklist.every(c => c.length > 30));
      assert.ok(s.turns.length && s.turns.every(t => t.length > 60));
      assert.ok(s.covers.length && covers(s).every(id => /^F(0[1-9]|1[0-9]|2[0-4])$/.test(id)));
      for (const ref of s.covers) {
        const [path, slug] = ref.split("#");
        assert.ok(readFileSync(resolve(root, skill, "tests", path), "utf8").includes(`## ${slug.toUpperCase()}\n`));
      }
      if (s.system_prompt_file) {
        assert.equal(s.turns.length, 1);
        assert.ok(existsSync(resolve(root, skill, "tests", s.system_prompt_file)));
      }
      const ws = s.env.workspace;
      if (ws !== "none") {
        assert.ok(ws.startsWith("fixture:"));
        const dir = resolve(root, skill, "tests", ws.slice(8));
        assert.ok(existsSync(dir), dir);
        for (const p of s.assert?.trace?.unchanged_paths ?? []) {
          if (!p.includes("*")) assert.ok(existsSync(resolve(dir, p)), `${s.id}: ${p}`);
        }
      }
      assert.ok(!s.assert?.post_test, "no vitest dependency or unsupported node post-test gate");
    }
    if (!["decide", "architect"].includes(skill)) assert.ok(spec.scenarios.some(s => s.system_prompt_file));
    const ignore = text(`${skill}/tests/results/.gitignore`);
    assert.doesNotMatch(ignore, /^\*$/m);
    assert.match(ignore, /!results\.yaml/);
  }
});

test("repair corpus separates final-text judgments from traces and unexported artifacts", () => {
  for (const skill of skills) {
    const spec = json(`${skill}/tests/specification.yaml`);
    assert.match(spec.judge_persona, /visible final text only/i, skill);
    assert.match(spec.judge_persona, /UNVERIFIED/);
    for (const s of spec.scenarios) {
      for (const criterion of s.checklist) {
        assert.doesNotMatch(criterion, /^(Read |Actually read |Independently read |Inspect available |Watch a real |Exercise parseCount |Use actual disposable|The complete saved artifact must)/, s.id);
        assert.doesNotMatch(criterion, /named plan\/report|must be available for inspection/, s.id);
      }
    }
  }
});

test("read-only Debug names required parser files and F10 rubric matches planless task", () => {
  const debug = json("debug/tests/specification.yaml").scenarios;
  for (const id of ["F22-debug-no-workspace-skill", "F22-debug-unreproduced-agent"]) {
    const s = debug.find(s => s.id === id);
    for (const path of ["SPEC.md", "parse.mjs", "parse.test.mjs"]) {
      assert.ok(s.turns.join(" ").includes(path), `${id}: prompt must name ${path}`);
      assert.ok(s.assert.trace.require_calls.some(c => new RegExp(c.args.path.matches).test(path)), `${id}: trace requires ${path}`);
    }
  }
  const direct = debug.find(s => s.id === "F21-debug-direct-agent");
  assert.match(direct.checklist.join(" "), /sandbox-only.*Next: build/);
  assert.doesNotMatch(direct.checklist.join(" "), /Explain that real applied status requires/);
  const perf = json("build/tests/specification.yaml").scenarios.find(s => s.id.startsWith("F10-"));
  assert.doesNotMatch(perf.checklist.join(" "), /plan\/report|partial plan/);
  assert.match(perf.checklist.join(" "), /PERF-1/);
});

test("F04 gates forbid source and newly authored test mutations but allow blocked reports", () => {
  const s = json("build/tests/specification.yaml").scenarios.find(s => s.id === "F04-build-missing-agent");
  assert.ok(s.assert.trace.unchanged_paths.includes("**/*.mjs"));
  assert.ok(s.assert.trace.forbid_calls.includes("edit"));
  assert.ok(!s.assert.trace.forbid_calls.includes("bash"), "Build may use read-only shell; snapshots still forbid mutations");
  const writeRule = s.assert.trace.forbid_calls.find(c => c.tool === "write");
  const forbidden = new RegExp(writeRule.args.path.matches);
  for (const path of ["limit.mjs", "limit.test.mjs", "nested/new.test.mjs", "package.json"]) assert.ok(forbidden.test(path), path);
  for (const path of [".principal/reports/missing.md", "./.principal/reports/missing.md", "/tmp/fixture/.principal/reports/missing.md"]) assert.ok(!forbidden.test(path), path);
  // Historical observed failure is calibration, never a repaired-model pass.
  const trace = JSON.parse(text("build/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T10-53-50-949Z/F04-build-missing-agent.force.trace.jsonl"));
  assert.ok(trace.changed_paths.includes("limit.mjs"));
  assert.ok(trace.changed_paths.includes("limit.test.mjs"));
  assert.ok(trace.tool_calls.some(c => c.name === "write" && forbidden.test(c.args.path)));
});

test("F08 keeps actual boundary expectations and named implementation read", () => {
  const s = json("plan/tests/specification.yaml").scenarios.find(s => s.id === "F08-plan-tiny-skill");
  assert.match(s.checklist.join(" "), /rejection of 4, acceptance of 3/);
  assert.ok(s.assert.trace.require_calls.some(c => new RegExp(c.args.path.matches).test("limit.mjs")));
  assert.match(text(`${base}/fixtures/tiny-normative/SPEC.md`), /0 through 3 inclusive/);
});

test("F01–F24 inventory resolves every case and preserves unmeasured chain/retention gaps", () => {
  const inventory = json(`${base}/scenarios.json`);
  assert.deepEqual(inventory.map(s => s.id), Array.from({length:24}, (_,i) => `F${String(i+1).padStart(2,"0")}`));
  const cases = skills.flatMap(skill => json(`${skill}/tests/specification.yaml`).scenarios);
  for (const row of inventory) {
    assert.equal(row.status, "NOT MEASURED");
    assert.ok(row.acceptance.length > 60 && row.replay.length > 100);
    for (const id of row.cases) assert.ok(cases.some(s => s.id === id && covers(s).includes(row.id)), id);
    assert.match(text(`${base}/README.md`), new RegExp(`\\| ${row.id} \\|`));
  }
  for (const s of cases) for (const id of covers(s)) assert.ok(inventory.find(r => r.id === id).cases.includes(s.id));
  assert.match(text(`${base}/README.md`), /ignored.*NOT MEASURED/i);
});

test("long source has 40 numbered + 8 unnumbered + 3 gates with exact independent oracle locators", () => {
  const spec = text(`${base}/fixtures/long-spec/SPEC.md`);
  const oracle = json(`${base}/oracles/long-spec.json`);
  assert.ok(Buffer.byteLength(spec) > 70 * 1024);
  assert.ok(spec.split(/\s+/).filter(Boolean).length > 8000);
  assert.equal(oracle.length, 51);
  assert.equal(new Set(oracle.map(r => r.id)).size, 51);
  for (const [type, count] of [["requirement",40],["local",8],["gate",3]]) assert.equal(oracle.filter(r => r.type === type).length,count);
  for (const row of oracle) {
    const source = text(`${base}/fixtures/long-spec/${row.file}`);
    assert.equal(source.split("\n")[row.line - 1], row.clause);
    assert.ok(row.acceptance.length > 35 && row.definition.includes("#"));
    const [file, heading] = row.definition.split("#");
    assert.ok(text(`${base}/fixtures/long-spec/${file}`).includes(heading));
  }
  assert.ok(spec.indexOf(oracle.at(-1).clause) > 70 * 1024);
  assert.ok(oracle.some(r => r.id === "S1") && oracle.some(r => r.id === "impl:S1"));
  assert.ok(!existsSync(resolve(root, base, "fixtures/long-spec/oracle.json")), "oracle must not leak into subject workspace");
});

test("acceptance-oracle counterexamples reject dropped tails, collisions, missing gates and false evidence", () => {
  const oracle = json(`${base}/oracles/long-spec.json`);
  // Structured evaluator calibration only: never parse arbitrary model prose as compliance.
  const mapping = oracle.map(r => ({id:r.id, step:"impl2:S1", status:"planned", definition:r.definition}));
  const valid = rows => rows.length === oracle.length && oracle.every(r => rows.filter(x => x.id === r.id).length === 1 && rows.some(x => x.id === r.id && x.definition === r.definition && x.status === "planned" && !oracle.some(o => o.id === x.step)));
  assert.ok(valid(mapping));
  assert.ok(!valid(mapping.slice(0,-1)), "dropped tail gate");
  assert.ok(!valid(mapping.map((r,i) => i === 1 ? {...r,id:mapping[0].id} : r)), "collapsed identities");
  assert.ok(!valid(mapping.filter(r => !r.id.startsWith("QUAL-"))), "missing gates");
  assert.ok(!valid(mapping.map((r,i) => i === 0 ? {...r,definition:"industry-default"} : r)), "invented definition");
  assert.ok(!valid(mapping.map((r,i) => i === 0 ? {...r,status:"passed"} : r)), "proposal called pass");
  assert.ok(!valid(mapping.map(r => ({...r,step:"impl:S1"}))), "source/step collision");
  const examples = json(`${base}/oracles/evidence-counterexamples.json`);
  for (const e of examples) {
    const acceptable = e.sourceAvailable && e.definitionAvailable && e.candidate === e.testedCandidate && e.gateExecuted && Boolean(e.findingMeaning && e.acceptance);
    assert.equal(acceptable, e.acceptable, e.name);
  }
});

test("handoff negative omits malformed-input behavior as well as its plan coverage", async () => {
  const { permit } = await import("../../evals/requirement-fidelity/fixtures/omitted-obligation/limit.mjs");
  assert.match(text(`${base}/fixtures/omitted-obligation/plan.md`), /malformed-input.*omitted/s);
  // Intentionally noncompliant fixture: Review must find what the partial plan missed.
  assert.equal(permit("3"), true);
  assert.equal(permit(null), true);
  assert.equal(permit(1.5), true);
});

test("real fixture packages run node tests; hidden acceptance catches planted limit and parser defects", () => {
  // Nested Node runners otherwise inherit child-v8 transport and report exit 0
  // to a nonexistent parent IPC consumer even when their test assertions fail.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const name of ["basic", "handoffs", "omitted-obligation", "debug", "long-spec"]) {
    const cwd = resolve(root, base, "fixtures", name);
    assert.equal(json(`${base}/fixtures/${name}/package.json`).scripts.test, "node --test");
    const run = spawnSync(process.execPath, ["--test"], {cwd, env, encoding:"utf8", timeout: 10000});
    assert.equal(run.status, 0, run.stdout + run.stderr);
  }
  for (const [name, file] of [["basic","limit.acceptance.mjs"],["debug","parse.acceptance.mjs"]]) {
    const run = spawnSync(process.execPath, ["--test", resolve(root,base,"oracles",file)], {env, encoding:"utf8", timeout: 10000});
    assert.equal(run.status, 1, "negative acceptance must reject deliberately buggy fixture");
    assert.match(run.stdout, /ERR_ASSERTION/);
  }
});

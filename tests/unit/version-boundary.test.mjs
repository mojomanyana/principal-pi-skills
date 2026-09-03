import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parsePackMetadata } from "../../scripts/pack-meta.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "c24d2b6afd641e9e3f23b6bf967ba535f1fcb0d7";
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const assuranceStateAuthorizations = [
  {
    name: "gate-evaluated-event",
    reason: "gate outcomes become ledger evidence rather than unprovable console output",
    markers: ['case "gate_evaluated":'],
  },
  {
    name: "assurance-elevation-adversarial-corpus",
    reason: "audited risk paraphrases elevate while explicit tiny artifact references remain right-sized",
    markers: ["wipe (?:all\\s+)?", "backwards-incompatible", "roll out[^.\\n]", "this work", "test (?:file|helper|utility|title)"],
  },
];
function assertAssuranceStateAuthorizations() {
  const source = read("scripts/assurance-state.mjs");
  assert.equal(new Set(assuranceStateAuthorizations.map(({ name }) => name)).size, assuranceStateAuthorizations.length,
    "runtime authorization names must be unique");
  for (const { name, reason, markers } of assuranceStateAuthorizations) {
    assert.ok(reason.length > 20, `${name} must state why it is authorized`);
    for (const marker of markers) assert.ok(source.includes(marker), `stale named authorization ${name}: ${marker}`);
  }
}

test("source is 3.0.1 Unreleased while npm latest and install guidance remain 3.0.0", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(pkg.version, "3.0.1");
  assert.equal(lock.version, "3.0.1");
  assert.equal(lock.packages[""].version, "3.0.1");
  assert.match(read("CHANGELOG.md"), /^## \[3\.0\.1\] — Unreleased$/m);
  for (const path of ["README.md", "AGENTS.md", "docs/HANDOFF.md"]) {
    const text = read(path);
    assert.match(text, /3\.0\.1[^\n]*Unreleased|Unreleased[^\n]*3\.0\.1/i, `${path}: source state missing`);
    assert.match(text, /3\.0\.0[\s\S]{0,120}published|published[\s\S]{0,120}3\.0\.0/i, `${path}: published state missing`);
    assert.doesNotMatch(text, /pi install[^\n]*@v3\.0\.1/, `${path}: unpublished install claim`);
  }
  assert.match(read("README.md"), /pi install git:github\.com\/mojomanyana\/principal-pi-skills@v3\.0\.0/);
  assert.match(read("README.md"), /npm [`]?latest[`]?[^\n]*3\.0\.0|3\.0\.0[^\n]*npm [`]?latest[`]?/i);
});

test("CI fetches the immutable base history required by version-boundary gates", () => {
  const workflow = read(".github/workflows/ci.yml");
  const checkout = "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09";
  const rootCheckout = workflow.indexOf(checkout);
  const harnessCheckout = workflow.indexOf(checkout, rootCheckout + checkout.length);
  assert.ok(rootCheckout >= 0 && harnessCheckout > rootCheckout, "root and harness checkout steps must both remain pinned");
  assert.match(workflow.slice(rootCheckout, harnessCheckout), /with:\n(?:\s+#.*\n)*\s+fetch-depth: 0(?:\n|$)/, "root checkout must contain the immutable comparison base");
  assert.match(workflow.slice(harnessCheckout), /repository: mojomanyana\/skill-harness[\s\S]*ref: latest[\s\S]*path: \.skill-harness/, "harness checkout remains independently configured");
});

test("all tracked authoritative source-version statements reject a current-source 3.0.0 claim", () => {
  const paths = execFileSync("git", ["ls-files", "*.md", "package.json", "package-lock.json"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const contradictions = [];
  const patterns = [
    /(?:current\s+)?source(?:\s+(?:status|metadata|manifest|tree))?\s*(?:is|:|=|matches?)?[^\n]{0,40}`?3\.0\.0/i,
    /source tree['’]s manifest matches[^\n]*3\.0\.0/i,
    /(?:package\.json|package-lock\.json)[^\n]{0,30}:?\s*`?3\.0\.0/i,
  ];
  for (const path of paths) {
    for (const [index, line] of read(path).split("\n").entries()) {
      if (/published-source|published release|published tag|install|previous source|3\.0\.0 was|\[3\.0\.0\]/i.test(line)) continue;
      if (patterns.some((pattern) => pattern.test(line))) contradictions.push(`${path}:${index + 1}:${line}`);
    }
  }
  assert.deepEqual(contradictions, []);
});

test("runtime differences from 3.0.0 are exactly the generated Critical Plan contract outputs", () => {
  const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", BASE], { cwd: ROOT, encoding: "utf8" })
    .trim().split("\n").filter((path) => /^(?:schemas\/|scripts\/(?:install-agents|snapshot-workspace|assurance-state)\.mjs$|(?:decide|architect|plan|build|review|debug|git-ops)\/SKILL\.md$|agents\/.*\.md$|prompts\/.*\.md$)/.test(path));
  assert.ok(paths.length >= 23, `runtime comparison unexpectedly covered ${paths.length} files`);
  const changed = paths.filter((path) => {
    const before = execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT });
    return Buffer.compare(before, readFileSync(join(ROOT, path))) !== 0;
  });
  // scripts/assurance-state.mjs has two named authorizations: gate-evaluated-event makes gate
  // outcomes observable, and assurance-elevation-adversarial-corpus covers audited parser phrasing.
  assert.deepEqual(changed.sort(), ["agents/plan.md", "agents/principal-plan.md", "plan/SKILL.md", "scripts/assurance-state.mjs"]);
  assertAssuranceStateAuthorizations();
});

test("packed differences from 3.0.0 are exactly the authorized documentation, version, and Plan files", () => {
  const metadata = parsePackMetadata(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8" }));
  const changed = [];
  for (const { path } of metadata.files) {
    const before = execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT });
    if (Buffer.compare(before, readFileSync(join(ROOT, path))) !== 0) changed.push(path);
  }
  assert.deepEqual(changed.sort(), ["AGENTS.md", "CHANGELOG.md", "README.md", "agents/plan.md", "agents/principal-plan.md", "package.json", "plan/SKILL.md", "scripts/assurance-state.mjs"]);
  assertAssuranceStateAuthorizations();
});

test("unreleased notes describe evidence verification without claiming publication or measurement", () => {
  const section = read("CHANGELOG.md").split(/^## \[3\.0\.0\]/m)[0];
  assert.match(section, /external per-observation attestation/i);
  assert.match(section, /205/);
  assert.match(section, /3\.0\.1/);
  assert.match(section, /No 3\.0\.1[^\n]*model score/i);
  assert.doesNotMatch(section, /published 3\.0\.1|released 3\.0\.1/i);
});

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
const completedPublicationClaims = [
  /npm\s+[`]?latest[`]?[^.!?\n]{0,80}\b(?:is(?:\s+now)?|points?\s+to|resolves?\s+to|=)\s+[`]?3\.0\.1/i,
  /(?:the\s+)?[`]?v3\.0\.1[`]?\s+tag[^.!?\n]{0,80}\b(?:exists|has\s+been\s+created|is\s+(?:tagged|published|available))\b/i,
  /3\.0\.1[^.!?\n]{0,80}\bavailable\s+from\s+npm\b/i,
];
function assertNoCompletedPublicationClaim(text, label) {
  for (const pattern of completedPublicationClaims) {
    assert.doesNotMatch(text, pattern, `${label}: premature publication claim`);
  }
}
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
  {
    name: "assurance-report-projection",
    reason: "approved P9 adds a read-only human and in-toto projection over validated ledger events",
    markers: ["buildAssuranceStatement", "renderAssuranceReport", 'command === "report"'],
  },
];
const decideSkillAuthorizations = [
  {
    name: "decide-p4-path-classification",
    reason: "approved P4 adds advisory path classification, countable unknowns, and confirmation evidence to Decide only",
    markers: ["## Classification — announce before questions", "Path: spike | bounded | architectural", "[NEEDS CLARIFICATION: <question>]", "Confirmation:"],
  },
];
function assertNamedAuthorizations(path, authorizations) {
  const source = read(path);
  assert.equal(new Set(authorizations.map(({ name }) => name)).size, authorizations.length,
    `${path}: runtime authorization names must be unique`);
  for (const { name, reason, markers } of authorizations) {
    assert.ok(reason.length > 20, `${name} must state why it is authorized`);
    for (const marker of markers) assert.ok(source.includes(marker), `stale named authorization ${name}: ${marker}`);
  }
}

test("3.0.1 release candidate is cut without claiming completed publication", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(pkg.version, "3.0.1");
  assert.equal(lock.version, "3.0.1");
  assert.equal(lock.packages[""].version, "3.0.1");
  assert.match(read("CHANGELOG.md"), /^## \[3\.0\.1\] — 2026-09-04$/m);
  for (const path of ["README.md", "AGENTS.md", "docs/HANDOFF.md"]) {
    assert.match(read(path), /pi install[^\n]*@v3\.0\.1/, `${path}: release coordinate missing`);
  }
  for (const path of ["README.md", "AGENTS.md", "CHANGELOG.md", "docs/HANDOFF.md", "docs/validation/VALIDATION.md"]) {
    const text = read(path);
    assert.match(text, /release candidate/i, `${path}: candidate state missing`);
    assert.match(text, /(?:v3\.0\.1[\s\S]{0,120}pending|pending[\s\S]{0,120}v3\.0\.1)/i, `${path}: tag state missing`);
    assert.match(text, /(?:npm\s+[`]?latest[`]?[\s\S]{0,120}3\.0\.0|3\.0\.0[\s\S]{0,120}npm\s+[`]?latest[`]?)/i,
      `${path}: registry state missing`);
    assertNoCompletedPublicationClaim(text, path);
  }
  assert.match(read("README.md"), /pi install git:github\.com\/mojomanyana\/principal-pi-skills@v3\.0\.1/);
});

test("publication guard rejects ordinary completed-state wording", () => {
  for (const claim of [
    "npm latest is now 3.0.1",
    "npm `latest` points to `3.0.1`.",
    "npm latest resolves to 3.0.1",
    "The v3.0.1 tag has been created.",
    "The `v3.0.1` tag exists.",
    "3.0.1 is available from npm.",
  ]) {
    assert.throws(() => assertNoCompletedPublicationClaim(claim, "mutation"), assert.AssertionError, claim);
  }
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

test("runtime differences from 3.0.0 are exactly the named Plan, assurance, and Decide authorizations", () => {
  const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", BASE], { cwd: ROOT, encoding: "utf8" })
    .trim().split("\n").filter((path) => /^(?:schemas\/|scripts\/(?:install-agents|snapshot-workspace|assurance-state)\.mjs$|(?:decide|architect|plan|build|review|debug|git-ops)\/SKILL\.md$|agents\/.*\.md$|prompts\/.*\.md$)/.test(path));
  assert.ok(paths.length >= 23, `runtime comparison unexpectedly covered ${paths.length} files`);
  const changed = paths.filter((path) => {
    const before = execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT });
    return Buffer.compare(before, readFileSync(join(ROOT, path))) !== 0;
  });
  // scripts/assurance-state.mjs has three named authorizations: recorded gate outcomes, the audited
  // elevation corpus, and approved P9's read-only assurance report projection. Decide has the sole
  // P4 skill-text authorization.
  assert.deepEqual(changed.sort(), ["agents/plan.md", "agents/principal-plan.md", "decide/SKILL.md", "plan/SKILL.md", "scripts/assurance-state.mjs"]);
  assertNamedAuthorizations("scripts/assurance-state.mjs", assuranceStateAuthorizations);
  assertNamedAuthorizations("decide/SKILL.md", decideSkillAuthorizations);
});

test("packed differences from 3.0.0 are exactly the authorized documentation, version, and Plan files", () => {
  const metadata = parsePackMetadata(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8" }));
  const changed = [];
  for (const { path } of metadata.files) {
    const before = execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT });
    if (Buffer.compare(before, readFileSync(join(ROOT, path))) !== 0) changed.push(path);
  }
  assert.deepEqual(changed.sort(), ["AGENTS.md", "CHANGELOG.md", "README.md", "agents/plan.md", "agents/principal-plan.md", "decide/SKILL.md", "package.json", "plan/SKILL.md", "scripts/assurance-state.mjs"]);
  assertNamedAuthorizations("scripts/assurance-state.mjs", assuranceStateAuthorizations);
  assertNamedAuthorizations("decide/SKILL.md", decideSkillAuthorizations);
});

test("3.0.1 release notes describe evidence verification without claiming measurement", () => {
  const section = read("CHANGELOG.md").split(/^## \[3\.0\.0\]/m)[0];
  assert.match(section, /external per-observation attestation/i);
  assert.match(section, /205/);
  assert.match(section, /3\.0\.1/);
  assert.match(section, /No 3\.0\.1[^\n]*model score/i);
  assert.match(section, /release candidate/i);
  assert.match(section, /v3\.0\.1[\s\S]{0,120}pending/i);
  assert.match(section, /npm\s+[`]?latest[`]?[\s\S]{0,120}3\.0\.0/i);
});

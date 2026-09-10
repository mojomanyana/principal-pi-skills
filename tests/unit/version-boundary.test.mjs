import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parsePackMetadata } from "../../scripts/pack-meta.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "8c7a475bdb3b25427ea587c7de2af23a01379293";
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const completedPublicationClaims = [
  /npm\s+[`]?latest[`]?[^.!?\n]{0,80}\b(?:is(?:\s+now)?|points?\s+to|resolves?\s+to|=)\s+[`]?3\.1\.0/i,
  /(?:the\s+)?[`]?v3\.1\.0[`]?\s+tag[^.!?\n]{0,80}\b(?:exists|has\s+been\s+created|is\s+(?:tagged|published|available))\b/i,
  /3\.1\.0[^.!?\n]{0,80}\bavailable\s+from\s+npm\b/i,
];
function assertNoCompletedPublicationClaim(text, label) {
  for (const pattern of completedPublicationClaims) {
    assert.doesNotMatch(text, pattern, `${label}: premature publication claim`);
  }
}
const assuranceStateAuthorizations = [
  {
    name: "p14-host-association-bounded-replay",
    reason: "local P14 host association uses opt-in bounded native replay; existing default loading, reports, event and gate semantics are unchanged",
    markers: ["readBoundedAssuranceText", "maxBytes = null", "constants.O_NOFOLLOW"],
  },
  {
    name: "p14-current-applicability-projection",
    reason: "bounded local P14 authorizes only a versioned read-only evidence projection with explicit legacy compatibility; gates and native acceptance remain unchanged",
    markers: ["buildCurrentApplicabilityProjection", 'format_version: "current-v1"', '"in-toto-legacy"'],
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

test("3.1.0 release candidate is cut without claiming completed publication", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(pkg.version, "3.1.0");
  assert.equal(lock.version, "3.1.0");
  assert.equal(lock.packages[""].version, "3.1.0");
  assert.match(read("CHANGELOG.md"), /^## \[3\.1\.0\] — 2026-09-11$/m);
  for (const path of ["README.md", "AGENTS.md", "docs/HANDOFF.md"]) {
    assert.match(read(path), /pi install[^\n]*@v3\.1\.0/, `${path}: release coordinate missing`);
  }
  for (const path of ["README.md", "AGENTS.md", "CHANGELOG.md", "docs/HANDOFF.md", "docs/validation/VALIDATION.md"]) {
    const text = read(path);
    assert.match(text, /release candidate/i, `${path}: candidate state missing`);
    assert.match(text, /(?:v3\.1\.0[\s\S]{0,140}pending|pending[\s\S]{0,140}v3\.1\.0)/i, `${path}: tag state missing`);
    assert.match(text, /(?:npm\s+[`]?latest[`]?[\s\S]{0,140}3\.0\.1|3\.0\.1[\s\S]{0,140}npm\s+[`]?latest[`]?)/i,
      `${path}: registry state missing`);
    assertNoCompletedPublicationClaim(text, path);
  }
});

test("publication guard rejects ordinary completed-state wording", () => {
  for (const claim of [
    "npm latest is now 3.1.0",
    "npm `latest` points to `3.1.0`.",
    "npm latest resolves to 3.1.0",
    "The v3.1.0 tag has been created.",
    "The `v3.1.0` tag exists.",
    "3.1.0 is available from npm.",
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

test("current authoritative source-version statements reject a current-source 3.0.1 claim", () => {
  const paths = ["README.md", "AGENTS.md", "docs/HANDOFF.md", "docs/validation/VALIDATION.md", "package.json", "package-lock.json"];
  const contradictions = [];
  const patterns = [
    /(?:current\s+)?source(?:\s+(?:status|metadata|manifest|tree))?\s*(?:is|:|=|matches?)?[^\n]{0,40}`?3\.0\.1/i,
    /source tree['’]s manifest matches[^\n]*3\.0\.1/i,
    /(?:package\.json|package-lock\.json)[^\n]{0,30}:?\s*`?3\.0\.1/i,
  ];
  for (const path of paths) {
    for (const [index, line] of read(path).split("\n").entries()) {
      if (/published-source|published release|published tag|install|previous source|3\.0\.1 was|\[3\.0\.1\]|npm [`]?latest[`]? remains/i.test(line)) continue;
      if (patterns.some((pattern) => pattern.test(line))) contradictions.push(`${path}:${index + 1}:${line}`);
    }
  }
  assert.deepEqual(contradictions, []);
});

test("runtime differences from 3.0.1 are exactly the named assurance projection additions", () => {
  const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", BASE], { cwd: ROOT, encoding: "utf8" })
    .trim().split("\n").filter((path) => /^(?:schemas\/|scripts\/(?:install-agents|snapshot-workspace|assurance-state)\.mjs$|(?:decide|architect|plan|build|review|debug|git-ops)\/SKILL\.md$|agents\/.*\.md$|prompts\/.*\.md$)/.test(path));
  assert.ok(paths.length >= 23, `runtime comparison unexpectedly covered ${paths.length} files`);
  const changed = paths.filter((path) => {
    const before = execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT });
    return Buffer.compare(before, readFileSync(join(ROOT, path))) !== 0;
  });
  assert.deepEqual(changed.sort(), ["scripts/assurance-state.mjs"]);
  assertNamedAuthorizations("scripts/assurance-state.mjs", assuranceStateAuthorizations);
});

test("3.1.0 keeps the 28-file package boundary and excludes local host adapters", () => {
  const metadata = parsePackMetadata(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8" }));
  assert.equal(metadata.files.length, 28);
  const packed = new Set(metadata.files.map(({ path }) => path));
  for (const path of [
    "scripts/principal-association.mjs",
    "scripts/principal-host-assembly.mjs",
    "scripts/principal-native-references.mjs",
    "scripts/vendor-principal-association.mjs",
    "contracts/principal-native-references/v1/record.schema.json",
    "contracts/principal-generic-check-lifecycle/v1/envelope.schema.json",
  ]) assert.equal(packed.has(path), false, `${path} must remain outside the npm package`);

  const changed = [];
  for (const { path } of metadata.files) {
    const before = execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT });
    if (Buffer.compare(before, readFileSync(join(ROOT, path))) !== 0) changed.push(path);
  }
  assert.deepEqual(changed.sort(), ["AGENTS.md", "CHANGELOG.md", "README.md", "package.json", "scripts/assurance-state.mjs"]);
  assertNamedAuthorizations("scripts/assurance-state.mjs", assuranceStateAuthorizations);
});

test("3.1.0 release notes describe shipped behavior and cross-repository compatibility honestly", () => {
  const section = read("CHANGELOG.md").split(/^## \[3\.0\.1\]/m)[0];
  assert.match(section, /current-v1/i);
  assert.match(section, /cross-repositor/i);
  assert.match(section, /not shipped|outside the npm package/i);
  assert.match(section, /28 files/i);
  assert.match(section, /No 3\.1\.0[^\n]*model score/i);
  assert.match(section, /release candidate/i);
  assert.match(section, /v3\.1\.0[\s\S]{0,160}pending/i);
  assert.match(section, /npm\s+[`]?latest[`]?[\s\S]{0,160}3\.0\.1/i);
  assertNoCompletedPublicationClaim(section, "CHANGELOG.md 3.1.0 section");
});

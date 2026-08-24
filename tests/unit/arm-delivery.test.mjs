import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { armDefinitionDigest, buildResultManifest, validateArmPolicy, validateResultManifest } from "../../scripts/measurement-evidence.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POLICY_PATH = join(ROOT, "docs", "validation", "PI-DADDY-ARM.v1.json");

test("future pi-daddy identity is unique, immutable, data-only, and currently ineligible", () => {
  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  assert.equal(policy.arm_id, "pi-daddy-subprocess-c364a6717e3d-pd0.19.0");
  assert.equal(policy.producer.commit, "c364a6717e3d5e369ecd3298b9cbb595eb94d9b2");
  assert.equal(policy.pi_daddy.package_version, "0.19.0");
  assert.equal(policy.pi_daddy.package_sha256, "c261877f9f6e1b13db8249e1d4e233cae9094efc07602e80c28555168cdc9b16");
  assert.equal(policy.pi_daddy.extension_sha256, "3b89312befe5bb7e83136b32d83820db94dbcda0754fdd82482a319790fa02a2");
  assert.equal(policy.executor.kind, "subprocess");
  assert.equal(policy.status, "experimental");
  assert.equal(policy.measurement_eligible, false);
  assert.deepEqual(policy.signing_keys, []);
  assert.equal(policy.canonical_definition_sha256, armDefinitionDigest(policy));
  assert.equal(validateArmPolicy(policy), policy);
});

test("no committed pi-daddy result is valid treatment without external attestation", () => {
  const { manifest } = buildResultManifest(ROOT);
  const piDaddy = manifest.results.filter((entry) => entry.path.includes("+pi-daddy/"));
  assert.equal(piDaddy.length, 2);
  assert.equal(piDaddy.filter((entry) => entry.classification === "valid-treatment").length, 0);
  assert.deepEqual(piDaddy.map((entry) => entry.classification).sort(), ["delivery-unproven", "invalid-infrastructure"]);
});

test("caller correlation cannot override policy identity", () => {
  assert.doesNotMatch(validateResultManifest.toString(), /expectedFor|caller.*identity/i);
});

test("principal carries no executable treatment arm or mutable machine-local extension path", () => {
  const arms = readFileSync(join(ROOT, "tests", "arms.yaml"), "utf8");
  assert.match(arms, /^arms:\s*\[\]\s*$/m);
  assert.doesNotMatch(arms, /~\/|\/home\/|extensions:|PI_GRANTS_/);
});

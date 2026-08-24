import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  armDefinitionDigest,
  attestationId,
  canonicalJson,
  canonicalAttestationBytes,
  createReplayRegistry,
  parseStrictJson,
  validateArmPolicy,
  validateExternalAttestationSet,
  validateExternalAttestationSets,
} from "../../scripts/measurement-evidence.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES = join(ROOT, "tests", "fixtures", "measurement-evidence");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fingerprint = (key) => sha256((typeof key === "string" ? createPublicKey(key) : key).export({ format: "der", type: "spki" }));
const PROD = generateKeyPairSync("ed25519");
const ALT = generateKeyPairSync("ed25519");
const TEST = generateKeyPairSync("ed25519");
const RSA = generateKeyPairSync("rsa", { modulusLength: 2048 });
const NOW = "2026-08-24T12:00:00.000Z";

function keyPolicy(keyPair = PROD, overrides = {}) {
  return {
    key_id: "operator-production-key-1",
    fingerprint: fingerprint(keyPair.publicKey),
    purpose: "production",
    active_from: "2026-08-24T00:00:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

function policy(signingKeys = [keyPolicy()], overrides = {}) {
  const document = {
    schema_version: 1,
    arm_id: "pi-daddy-synthetic-v1",
    status: "approved",
    measurement_eligible: true,
    eligibility_reason: "Synthetic verifier test only.",
    executor: { kind: "subprocess", identity: "subprocess:external-producer-v1" },
    producer: {
      repository: "https://github.com/example/external-producer",
      commit: "3".repeat(40),
      tree: "4".repeat(40),
      artifact_sha256: "5".repeat(64),
    },
    pi_daddy: {
      package_version: "0.19.0",
      package_sha256: "a".repeat(64),
      package_tree_sha256: "b".repeat(64),
      extension_sha256: "c".repeat(64),
    },
    result_contract: { schema_version: 1, schema_path: "docs/validation/FUTURE-RESULT.v1.schema.json", encoding: "principal-canonical-json-v1" },
    attestation_contract: { schema_version: 1, schema_path: "docs/validation/EXTERNAL-ATTESTATION.v1.schema.json", signature_algorithm: "Ed25519" },
    accepted_attempt: { required: true, cardinality: "exactly-one-per-observation", index_origin: 0, required_status: "completed" },
    freshness_policy: { max_attestation_age_ms: 3600000, max_completion_to_attestation_ms: 300000 },
    behavioral_evidence: { required_types: ["delegation-completed"], minimum_receipts: 1 },
    signing_keys: signingKeys,
    canonical_definition_sha256: "0".repeat(64),
    ...overrides,
  };
  document.canonical_definition_sha256 = armDefinitionDigest(document);
  return document;
}

function trust(armPolicy, keyPairs = new Map([[armPolicy.signing_keys[0].key_id, PROD]]), overrides = {}) {
  return {
    schema_version: 1,
    production: true,
    keys: armPolicy.signing_keys.map((key) => ({
      arm_id: armPolicy.arm_id,
      ...key,
      public_key_pem: keyPairs.get(key.key_id).publicKey.export({ format: "pem", type: "spki" }),
    })),
    ...overrides,
  };
}

function attestation(armPolicy = policy(), signingKey = armPolicy.signing_keys[0], overrides = {}) {
  return {
    schema_version: 1,
    attestation_id: "",
    result_path: "review/tests/results/future/run/results.yaml",
    result_file_sha256: "1".repeat(64),
    result_id: "future-result-1",
    scenario_id: "A1",
    repetition_index: 0,
    accepted_attempt_id: "attempt-A1-0-00000001",
    accepted_attempt_index: 0,
    arm_id: armPolicy.arm_id,
    arm_schema_version: armPolicy.schema_version,
    arm_definition_sha256: armPolicy.canonical_definition_sha256,
    producer_repository: armPolicy.producer.repository,
    producer_commit: armPolicy.producer.commit,
    producer_tree: armPolicy.producer.tree,
    producer_artifact_sha256: armPolicy.producer.artifact_sha256,
    executor_identity: armPolicy.executor.identity,
    run_id: "run-00000001",
    task_id: "task-00000001",
    workspace_id: "workspace-00000001",
    context_id: "context-00000001",
    ledger_sha256: "6".repeat(64),
    behavioral_receipt_sha256: ["7".repeat(64)],
    behavioral_evidence_types: ["delegation-completed"],
    capability_receipt_sha256: ["8".repeat(64)],
    lifecycle: { status: "completed", successful_delegation: true, completed_children: 1, refusal_only: false },
    observation_started_at: "2026-08-24T11:50:00.000Z",
    observation_completed_at: "2026-08-24T11:55:00.000Z",
    attested_at: "2026-08-24T11:55:01.000Z",
    not_before: "2026-08-24T11:49:00.000Z",
    expires_at: "2026-08-24T12:10:00.000Z",
    nonce: "nonce-0000000000000001",
    signing_key_id: signingKey.key_id,
    signing_key_fingerprint: signingKey.fingerprint,
    signing_key_purpose: signingKey.purpose,
    signature: "",
    ...overrides,
  };
}

function expected(document) {
  return Object.fromEntries([
    "result_path", "result_file_sha256", "result_id", "scenario_id", "repetition_index",
    "accepted_attempt_id", "accepted_attempt_index", "arm_id", "arm_schema_version",
    "arm_definition_sha256", "producer_repository", "producer_commit", "producer_tree",
    "producer_artifact_sha256", "executor_identity", "run_id", "task_id", "workspace_id",
    "context_id", "ledger_sha256", "behavioral_receipt_sha256", "behavioral_evidence_types",
    "lifecycle", "signing_key_id", "signing_key_fingerprint", "signing_key_purpose",
  ].map((field) => [field, document[field]]));
}

function signed(document, keyPair = PROD) {
  const copy = structuredClone(document);
  copy.attestation_id = attestationId(copy);
  copy.signature = sign(null, canonicalAttestationBytes(copy), keyPair.privateKey).toString("base64");
  return Buffer.from(canonicalJson(copy), "utf8");
}

function validateOne({ armPolicy = policy(), document, keyPair = PROD, trustConfig, registry = createReplayRegistry(), allowNonProductionValidation = false } = {}) {
  const value = document ?? attestation(armPolicy);
  return validateExternalAttestationSet({
    attestationBytes: [signed(value, keyPair)], expectedObservations: [expected(value)],
    trust: trustConfig ?? trust(armPolicy, new Map([[armPolicy.signing_keys[0].key_id, keyPair]])),
    armPolicy, now: NOW, replayRegistry: registry, allowNonProductionValidation,
  });
}

test("closed arm policy and exact trusted production attestation validate", () => {
  const armPolicy = policy();
  assert.equal(validateArmPolicy(armPolicy), armPolicy);
  const result = validateOne({ armPolicy });
  assert.equal(result.eligible, true);
  assert.equal(result.observations.length, 1);
  assert.equal(result.consumed_attestation_count, 1);
  assert.equal(result.unconsumed_structure_count, 0);
});

test("every required arm, producer, result, attempt, behavioral, and signer binding fails when re-signed differently", () => {
  const armPolicy = policy();
  const mutations = {
    result_path: "review/tests/results/future/other/results.yaml",
    result_file_sha256: "9".repeat(64), result_id: "other-result", scenario_id: "D2", repetition_index: 1,
    accepted_attempt_id: "attempt-other", accepted_attempt_index: 1, arm_id: "other-arm", arm_schema_version: 2,
    arm_definition_sha256: "9".repeat(64), producer_repository: "https://example.test/other",
    producer_commit: "9".repeat(40), producer_tree: "8".repeat(40), producer_artifact_sha256: "7".repeat(64),
    executor_identity: "subprocess:other-v1", run_id: "run-other", task_id: "task-other",
    workspace_id: "workspace-other", context_id: "context-other", ledger_sha256: "5".repeat(64),
    behavioral_receipt_sha256: ["4".repeat(64)], behavioral_evidence_types: [],
    lifecycle: { status: "completed", successful_delegation: true, completed_children: 2, refusal_only: false },
    signing_key_id: "other-key", signing_key_fingerprint: "3".repeat(64), signing_key_purpose: "test",
  };
  for (const [field, value] of Object.entries(mutations)) {
    const document = attestation(armPolicy, armPolicy.signing_keys[0], { [field]: value });
    assert.throws(() => validateExternalAttestationSet({
      attestationBytes: [signed(document)], expectedObservations: [expected(attestation(armPolicy))],
      trust: trust(armPolicy), armPolicy, now: NOW, replayRegistry: createReplayRegistry(),
    }), new RegExp(`${field}.*mismatch|schema|behavioral|extra|not consumed`), field);
  }
});

test("caller-supplied expectations cannot override closed arm-policy identity", () => {
  const armPolicy = policy();
  const foreign = attestation(armPolicy, armPolicy.signing_keys[0], {
    arm_id: "foreign-arm",
    arm_definition_sha256: "9".repeat(64),
    producer_repository: "https://example.test/foreign",
    producer_commit: "8".repeat(40),
    producer_tree: "7".repeat(40),
    producer_artifact_sha256: "6".repeat(64),
    executor_identity: "subprocess:foreign",
  });
  assert.throws(() => validateExternalAttestationSet({
    attestationBytes: [signed(foreign)], expectedObservations: [expected(foreign)], trust: trust(armPolicy),
    armPolicy, now: NOW, replayRegistry: createReplayRegistry(),
  }), /conflicts directly with arm policy/);
});

test("complete trust store is eagerly closed, key-valid, arm-bound, active, and unrevoked", () => {
  const second = keyPolicy(ALT, { key_id: "unused-key-2" });
  const armPolicy = policy([keyPolicy(), second]);
  const pairs = new Map([["operator-production-key-1", PROD], ["unused-key-2", ALT]]);
  const valid = trust(armPolicy, pairs);
  assert.equal(validateOne({ armPolicy, trustConfig: valid }).eligible, true);
  const cases = [
    ["unknown field", (t) => { t.keys[1].extra = true; }],
    ["malformed PEM", (t) => { t.keys[1].public_key_pem = "bad"; }],
    ["fingerprint mismatch", (t) => { t.keys[1].fingerprint = "f".repeat(64); }],
    ["non-Ed25519", (t) => { t.keys[1].public_key_pem = RSA.publicKey.export({ format: "pem", type: "spki" }); t.keys[1].fingerprint = fingerprint(RSA.publicKey); t.keys[1].fingerprint && (t.keys[1].fingerprint = fingerprint(RSA.publicKey)); }],
    ["unknown arm", (t) => { t.keys[1].arm_id = "unknown-arm"; }],
    ["wrong purpose", (t) => { t.keys[1].purpose = "test"; }],
    ["not active", (t) => { t.keys[1].active_from = "2026-08-25T00:00:00.000Z"; }],
    ["revoked", (t) => { t.keys[1].revoked_at = "2026-08-24T01:00:00.000Z"; }],
    ["duplicate ID", (t) => { t.keys[1].key_id = t.keys[0].key_id; }],
    ["duplicate fingerprint", (t) => { t.keys[1].fingerprint = t.keys[0].fingerprint; }],
  ];
  for (const [label, mutate] of cases) {
    const invalid = structuredClone(valid); mutate(invalid);
    assert.throws(() => validateOne({ armPolicy, trustConfig: invalid }), /trust|key|arm|purpose|active|revok|duplicate|fingerprint|Ed25519|metadata/, label);
  }
  const missing = structuredClone(valid); missing.keys.pop();
  assert.throws(() => validateOne({ armPolicy, trustConfig: missing }), /lacks.*trusted signing key/);
  const lateKey = keyPolicy(PROD, { active_from: "2026-08-24T11:56:00.000Z" });
  const latePolicy = policy([lateKey]);
  assert.throws(() => validateOne({ armPolicy: latePolicy, document: attestation(latePolicy, lateKey), trustConfig: trust(latePolicy) }), /not active when/);
  const rsaKey = keyPolicy(RSA, { key_id: "rsa-key" });
  const rsaPolicy = policy([rsaKey]);
  const rsaTrust = trust(rsaPolicy, new Map([["rsa-key", RSA]]));
  assert.throws(() => validateOne({ armPolicy: rsaPolicy, document: attestation(rsaPolicy, rsaKey), trustConfig: rsaTrust }), /not Ed25519/);
});

test("two-phase replay is atomic across sets and binds nonce, observation, and accepted attempt", () => {
  const armPolicy = policy();
  const config = trust(armPolicy);
  const first = attestation(armPolicy);
  const second = attestation(armPolicy, armPolicy.signing_keys[0], {
    scenario_id: "A2", repetition_index: 0, accepted_attempt_id: "attempt-A2-0", nonce: "nonce-0000000000000002",
  });
  const registry = createReplayRegistry();
  const positive = validateExternalAttestationSets({
    evidenceSets: [
      { armId: armPolicy.arm_id, attestationBytes: [signed(first)], expectedObservations: [expected(first)] },
      { armId: armPolicy.arm_id, attestationBytes: [signed(second)], expectedObservations: [expected(second)] },
    ], trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: registry,
  });
  assert.equal(positive.observations.length, 2, "one signer and arm may serve distinct observations");
  assert.deepEqual(registry.snapshot(), { attestation_ids: 2, nonces: 2, accepted_attempt_ids: 2, result_identities: 1, observations: 2 });
  const rerun = validateExternalAttestationSets({
    evidenceSets: [
      { armId: armPolicy.arm_id, attestationBytes: [signed(first)], expectedObservations: [expected(first)] },
      { armId: armPolicy.arm_id, attestationBytes: [signed(second)], expectedObservations: [expected(second)] },
    ], trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: createReplayRegistry(),
  });
  assert.equal(rerun.observations.length, 2, "a fresh validation session may deterministically recheck the corpus");

  for (const [label, mutate] of [
    ["same nonce", (d) => { d.nonce = first.nonce; }],
    ["same accepted attempt", (d) => { d.accepted_attempt_id = first.accepted_attempt_id; }],
    ["same observation under another nonce", (d) => { d.scenario_id = first.scenario_id; d.repetition_index = first.repetition_index; }],
    ["same result ID with different result identity", (d) => { d.result_path = "build/tests/results/other/results.yaml"; d.result_file_sha256 = "9".repeat(64); }],
  ]) {
    const changed = structuredClone(second); mutate(changed);
    const fresh = createReplayRegistry();
    assert.throws(() => validateExternalAttestationSets({
      evidenceSets: [
        { armId: armPolicy.arm_id, attestationBytes: [signed(first)], expectedObservations: [expected(first)] },
        { armId: armPolicy.arm_id, attestationBytes: [signed(changed)], expectedObservations: [expected(changed)] },
      ], trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: fresh,
    }), /duplicate|replay/, label);
    assert.deepEqual(fresh.snapshot(), { attestation_ids: 0, nonces: 0, accepted_attempt_ids: 0, result_identities: 0, observations: 0 }, `${label}: no partial reservation`);
  }

  const lateFailure = createReplayRegistry();
  const bad = signed(second); bad[bad.length - 10] ^= 1;
  assert.throws(() => validateExternalAttestationSets({
    evidenceSets: [
      { armId: armPolicy.arm_id, attestationBytes: [signed(first)], expectedObservations: [expected(first)] },
      { armId: armPolicy.arm_id, attestationBytes: [bad], expectedObservations: [expected(second)] },
    ], trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: lateFailure,
  }), /canonical|signature|digest|JSON/);
  assert.deepEqual(lateFailure.snapshot(), { attestation_ids: 0, nonces: 0, accepted_attempt_ids: 0, result_identities: 0, observations: 0 });
});

test("result ID and canonical path/raw-digest identity form one atomic bijection", () => {
  const armPolicy = policy();
  const config = trust(armPolicy);
  const first = attestation(armPolicy);
  const variant = (overrides = {}) => attestation(armPolicy, armPolicy.signing_keys[0], {
    result_id: "future-result-2", scenario_id: "A2", accepted_attempt_id: "attempt-A2-0-00000002",
    run_id: "run-00000002", task_id: "task-00000002", workspace_id: "workspace-00000002",
    context_id: "context-00000002", nonce: "nonce-0000000000000002", ...overrides,
  });
  const empty = { attestation_ids: 0, nonces: 0, accepted_attempt_ids: 0, result_identities: 0, observations: 0 };
  const sets = (...documents) => documents.map((document) => ({
    armId: armPolicy.arm_id, attestationBytes: [signed(document)], expectedObservations: [expected(document)],
  }));
  const collisions = [
    ["two IDs sharing one path and digest", variant(), /path.*digest.*different result ID|result binding/i],
    ["one ID using two paths", variant({ result_id: first.result_id, result_path: "build/tests/results/future/run/results.yaml" }), /result ID.*different path or digest/i],
    ["one canonical path using two digests", variant({ result_file_sha256: "9".repeat(64) }), /result path.*different digest/i],
    ["equivalent path spelling", variant({ result_path: "review//tests/results/future/./run/results.yaml" }), /path.*digest.*different result ID|result binding/i],
  ];
  for (const [label, second, error] of collisions) {
    const registry = createReplayRegistry();
    assert.throws(() => validateExternalAttestationSets({
      evidenceSets: sets(first, second), trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: registry,
    }), error, label);
    assert.deepEqual(registry.snapshot(), empty, `${label}: all proposals checked before atomic commit`);
  }

  const third = variant({ result_id: "future-result-3", scenario_id: "A3", accepted_attempt_id: "attempt-A3-0-00000003", run_id: "run-00000003", task_id: "task-00000003", workspace_id: "workspace-00000003", context_id: "context-00000003", nonce: "nonce-0000000000000003" });
  const lateCollision = variant({ result_id: "future-result-4", scenario_id: "A4", accepted_attempt_id: "attempt-A4-0-00000004", run_id: "run-00000004", task_id: "task-00000004", workspace_id: "workspace-00000004", context_id: "context-00000004", nonce: "nonce-0000000000000004" });
  const lateRegistry = createReplayRegistry();
  assert.throws(() => validateExternalAttestationSets({
    evidenceSets: sets(first, { ...third, result_path: "build/tests/results/future/run/results.yaml" }, lateCollision),
    trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: lateRegistry,
  }), /path.*digest.*different result ID|result binding/i, "collision after otherwise valid sets");
  assert.deepEqual(lateRegistry.snapshot(), empty, "late collision leaves the registry unchanged");

  const positiveRegistry = createReplayRegistry();
  const positive = validateExternalAttestationSets({ evidenceSets: sets(first), trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: positiveRegistry });
  assert.equal(positive.eligible, true);
  assert.deepEqual(positiveRegistry.snapshot(), { ...empty, attestation_ids: 1, nonces: 1, accepted_attempt_ids: 1, result_identities: 1, observations: 1 });

  const alias = variant({ result_id: first.result_id, result_path: "review//tests/results/future/./run/results.yaml" });
  const aliasRegistry = createReplayRegistry();
  const canonicalized = validateExternalAttestationSets({ evidenceSets: sets(first, alias), trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: aliasRegistry });
  assert.equal(canonicalized.observations.length, 2, "equivalent path spellings share one result binding");
  assert.deepEqual(aliasRegistry.snapshot(), { ...empty, attestation_ids: 2, nonces: 2, accepted_attempt_ids: 2, result_identities: 1, observations: 2 });

  const sessionRegistry = createReplayRegistry();
  validateExternalAttestationSets({ evidenceSets: sets(first), trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: sessionRegistry });
  const committed = sessionRegistry.snapshot();
  assert.throws(() => validateExternalAttestationSets({ evidenceSets: sets(variant()), trust: config, armPolicies: [armPolicy], now: NOW, replayRegistry: sessionRegistry }), /path.*digest.*different result ID/i, "reverse binding persists across calls in one validation session");
  assert.deepEqual(sessionRegistry.snapshot(), committed, "failed later calls cannot partially alter prior reservations");
});

test("an observation already reserved cannot be re-signed by another trusted arm key", () => {
  const altPolicyKey = keyPolicy(ALT, { key_id: "operator-production-key-2" });
  const armPolicy = policy([keyPolicy(), altPolicyKey]);
  const pairs = new Map([["operator-production-key-1", PROD], ["operator-production-key-2", ALT]]);
  const config = trust(armPolicy, pairs);
  const registry = createReplayRegistry();
  const first = attestation(armPolicy, armPolicy.signing_keys[0]);
  validateExternalAttestationSet({ attestationBytes: [signed(first)], expectedObservations: [expected(first)], trust: config, armPolicy, now: NOW, replayRegistry: registry });
  const alternate = attestation(armPolicy, altPolicyKey, { accepted_attempt_id: "attempt-alternate-key", nonce: "nonce-alternate-00000002", signing_key_id: altPolicyKey.key_id, signing_key_fingerprint: altPolicyKey.fingerprint });
  assert.throws(() => validateExternalAttestationSet({ attestationBytes: [signed(alternate, ALT)], expectedObservations: [expected(alternate)], trust: config, armPolicy, now: NOW, replayRegistry: registry }), /replayed observation/);
});

test("freshness, signature, behavioral, and exact-bijection failures do not reserve", () => {
  const armPolicy = policy();
  const config = trust(armPolicy);
  const cases = [
    ["stale", { observation_started_at: "2026-08-24T09:50:00.000Z", observation_completed_at: "2026-08-24T09:55:00.000Z", attested_at: "2026-08-24T09:55:01.000Z", not_before: "2026-08-24T09:49:00.000Z", expires_at: "2026-08-24T12:10:00.000Z" }],
    ["future", { attested_at: "2026-08-24T12:00:00.001Z" }],
    ["refusal", { lifecycle: { status: "completed", successful_delegation: true, completed_children: 1, refusal_only: true } }],
    ["incomplete", { lifecycle: { status: "completed", successful_delegation: false, completed_children: 0, refusal_only: false } }],
    ["capability only", { behavioral_receipt_sha256: [] }],
  ];
  for (const [label, values] of cases) {
    const document = attestation(armPolicy, armPolicy.signing_keys[0], values);
    const registry = createReplayRegistry();
    assert.throws(() => validateExternalAttestationSet({ attestationBytes: [signed(document)], expectedObservations: [expected(document)], trust: config, armPolicy, now: NOW, replayRegistry: registry }), /fresh|future|chronology|behavior|lifecycle|schema|refusal|delegation/, label);
    assert.equal(registry.snapshot().observations, 0);
  }
  const good = attestation(armPolicy);
  assert.throws(() => validateExternalAttestationSet({ attestationBytes: [], expectedObservations: [expected(good)], trust: config, armPolicy, now: NOW, replayRegistry: createReplayRegistry() }), /count mismatch/);
  assert.throws(() => validateExternalAttestationSet({ attestationBytes: [signed(good), signed({ ...good, nonce: "nonce-extra-00000000003" })], expectedObservations: [expected(good)], trust: config, armPolicy, now: NOW, replayRegistry: createReplayRegistry() }), /count mismatch/);
});

test("strict JSON detects duplicate keys, nesting, multiple documents, and noncanonical bytes", () => {
  assert.throws(() => parseStrictJson('{"a":1,"a":2}', { label: "future" }), /duplicate key/);
  assert.throws(() => parseStrictJson('{"a":{"b":1,"b":2}}', { label: "future" }), /duplicate key/);
  assert.throws(() => parseStrictJson('{}\n{}', { label: "future" }), /trailing|multiple/);
  assert.throws(() => parseStrictJson('---\na: &x 1\nb: *x', { label: "future" }), /invalid/);
  assert.throws(() => parseStrictJson('{ "a":1 }', { label: "future", requireCanonical: true }), /canonical/);
  assert.deepEqual(parseStrictJson('{"a":1}', { requireCanonical: true }), { a: 1 });
});

test("known-answer fixture fixes canonical bytes, fingerprint, and signature without a private fixture key", () => {
  const fixtureBytes = readFileSync(join(FIXTURES, "attestation-known-answer.v1.json"));
  const publicPem = readFileSync(join(FIXTURES, "attestation-known-answer-public.pem"), "utf8");
  const fixture = parseStrictJson(fixtureBytes, { requireCanonical: true });
  const fixtureKey = keyPolicy(TEST, {
    key_id: fixture.signing_key_id, fingerprint: fingerprint(publicPem), purpose: "test",
    active_from: "2026-08-24T00:00:00.000Z",
  });
  const armPolicy = policy([fixtureKey], { arm_id: fixture.arm_id });
  assert.equal(fixture.arm_definition_sha256, armPolicy.canonical_definition_sha256);
  const config = {
    schema_version: 1, production: false,
    keys: [{ arm_id: armPolicy.arm_id, ...fixtureKey, public_key_pem: publicPem }],
  };
  assert.equal(fixture.signing_key_fingerprint, fingerprint(publicPem));
  const result = validateExternalAttestationSet({
    attestationBytes: [fixtureBytes], expectedObservations: [expected(fixture)], trust: config,
    armPolicy, now: fixture.attested_at, replayRegistry: createReplayRegistry(), allowNonProductionValidation: true,
  });
  assert.equal(result.cryptographically_valid, true);
  assert.equal(result.eligible, false);
  const productionKey = { ...fixtureKey, purpose: "production" };
  const productionPolicy = policy([productionKey], { arm_id: fixture.arm_id });
  const production = { schema_version: 1, production: true, keys: [{ arm_id: productionPolicy.arm_id, ...productionKey, public_key_pem: publicPem }] };
  assert.throws(() => validateExternalAttestationSet({ attestationBytes: [fixtureBytes], expectedObservations: [expected(fixture)], trust: production, armPolicy: productionPolicy, now: fixture.attested_at, replayRegistry: createReplayRegistry() }), /fixture|test/);
});

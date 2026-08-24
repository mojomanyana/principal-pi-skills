import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  armDefinitionDigest,
  attestationId,
  buildResultManifest,
  canonicalAttestationBytes,
  canonicalJson,
  createReplayRegistry,
  validateResultManifest,
  validateResultRoot,
} from "../../scripts/measurement-evidence.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "c24d2b6afd641e9e3f23b6bf967ba535f1fcb0d7";
const NOW = "2026-08-24T12:00:00.000Z";
const MANIFEST_PATH = join(ROOT, "docs", "validation", "RESULTS-MANIFEST.v1.json");
const SCHEMA_PATH = join(ROOT, "docs", "validation", "RESULTS-MANIFEST.v1.schema.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const keyFingerprint = (publicKey) => sha256(publicKey.export({ format: "der", type: "spki" }));
const TERRA = new Map([
  ["review/tests/results/pi-openai-codex-gpt-5.6-terra-high/2026-08-22T22-30-00-257Z/results.yaml", "control"],
  ["review/tests/results/pi-openai-codex-gpt-5.6-terra-high+pi-daddy/2026-08-22T22-54-06-434Z/results.yaml", "invalid-infrastructure"],
  ["review/tests/results/pi-openai-codex-gpt-5.6-terra-high+pi-daddy/2026-08-22T23-38-49-800Z/results.yaml", "delivery-unproven"],
]);

const load = () => JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const mutate = (fn) => { const copy = structuredClone(load()); fn(copy); return copy; };

function signingPolicy(keyPair, overrides = {}) {
  return {
    key_id: "synthetic-production-key-1",
    fingerprint: keyFingerprint(keyPair.publicKey),
    purpose: "production",
    active_from: "2026-08-24T00:00:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

function syntheticPolicy(keys) {
  const policy = {
    schema_version: 1,
    arm_id: "synthetic-pi-daddy-arm-v1",
    status: "approved",
    measurement_eligible: true,
    eligibility_reason: "Synthetic temporary-root integration test only.",
    executor: { kind: "subprocess", identity: "subprocess:synthetic-producer-v1" },
    producer: {
      repository: "https://github.com/example/synthetic-producer",
      commit: "3".repeat(40), tree: "4".repeat(40), artifact_sha256: "5".repeat(64),
    },
    pi_daddy: {
      package_version: "0.19.0", package_sha256: "a".repeat(64),
      package_tree_sha256: "b".repeat(64), extension_sha256: "c".repeat(64),
    },
    result_contract: { schema_version: 1, schema_path: "docs/validation/FUTURE-RESULT.v1.schema.json", encoding: "principal-canonical-json-v1" },
    attestation_contract: { schema_version: 1, schema_path: "docs/validation/EXTERNAL-ATTESTATION.v1.schema.json", signature_algorithm: "Ed25519" },
    accepted_attempt: { required: true, cardinality: "exactly-one-per-observation", index_origin: 0, required_status: "completed" },
    freshness_policy: { max_attestation_age_ms: 3600000, max_completion_to_attestation_ms: 300000 },
    behavioral_evidence: { required_types: ["delegation-completed"], minimum_receipts: 1 },
    signing_keys: keys,
    canonical_definition_sha256: "0".repeat(64),
  };
  policy.canonical_definition_sha256 = armDefinitionDigest(policy);
  return policy;
}

function treatmentBinding(policy, key) {
  return {
    arm_id: policy.arm_id, arm_schema_version: policy.schema_version,
    arm_definition_sha256: policy.canonical_definition_sha256,
    producer: structuredClone(policy.producer), executor_identity: policy.executor.identity,
    signing_key: structuredClone(key), result_schema_version: policy.result_contract.schema_version,
    accepted_attempt: structuredClone(policy.accepted_attempt), freshness_policy: structuredClone(policy.freshness_policy),
    required_behavioral_evidence_types: structuredClone(policy.behavioral_evidence.required_types),
  };
}

function futureResult(policy, index, attemptId) {
  return {
    schema_version: 1,
    result_id: `synthetic-result-${index}`,
    arm_id: policy.arm_id,
    arm_definition_sha256: policy.canonical_definition_sha256,
    producer_repository: policy.producer.repository,
    producer_commit: policy.producer.commit,
    producer_tree: policy.producer.tree,
    producer_artifact_sha256: policy.producer.artifact_sha256,
    executor_identity: policy.executor.identity,
    run_id: `synthetic-run-${index}`,
    task_id: `synthetic-task-${index}`,
    workspace_id: `synthetic-workspace-${index}`,
    context_id: `synthetic-context-${index}`,
    scenarios: [{
      scenario_id: `A${index}`,
      repetitions: [{
        repetition_index: 0,
        attempts: [{
          attempt_id: attemptId,
          attempt_index: 0,
          accepted: true,
          status: "completed",
          ledger_sha256: `${index}`.repeat(64),
          behavioral_receipt_sha256: ["7".repeat(64)],
          behavioral_evidence_types: ["delegation-completed"],
          lifecycle: { status: "completed", successful_delegation: true, completed_children: 1, refusal_only: false },
        }],
      }],
    }],
  };
}

function attestationFor(result, resultPath, resultSha, policy, key, overrides = {}) {
  const attempt = result.scenarios[0].repetitions[0].attempts.find((candidate) => candidate.accepted) ?? result.scenarios[0].repetitions[0].attempts[0];
  const document = {
    schema_version: 1, attestation_id: "", result_path: resultPath, result_file_sha256: resultSha,
    result_id: result.result_id, scenario_id: result.scenarios[0].scenario_id,
    repetition_index: result.scenarios[0].repetitions[0].repetition_index,
    accepted_attempt_id: attempt.attempt_id, accepted_attempt_index: attempt.attempt_index,
    arm_id: policy.arm_id, arm_schema_version: policy.schema_version,
    arm_definition_sha256: policy.canonical_definition_sha256,
    producer_repository: policy.producer.repository, producer_commit: policy.producer.commit,
    producer_tree: policy.producer.tree, producer_artifact_sha256: policy.producer.artifact_sha256,
    executor_identity: policy.executor.identity,
    run_id: result.run_id, task_id: result.task_id, workspace_id: result.workspace_id, context_id: result.context_id,
    ledger_sha256: attempt.ledger_sha256,
    behavioral_receipt_sha256: structuredClone(attempt.behavioral_receipt_sha256),
    behavioral_evidence_types: structuredClone(attempt.behavioral_evidence_types),
    capability_receipt_sha256: ["8".repeat(64)], lifecycle: structuredClone(attempt.lifecycle),
    observation_started_at: "2026-08-24T11:50:00.000Z", observation_completed_at: "2026-08-24T11:55:00.000Z",
    attested_at: "2026-08-24T11:55:01.000Z", not_before: "2026-08-24T11:49:00.000Z",
    expires_at: "2026-08-24T12:10:00.000Z", nonce: `synthetic-nonce-${result.result_id}`,
    signing_key_id: key.key_id, signing_key_fingerprint: key.fingerprint, signing_key_purpose: key.purpose,
    signature: "", ...overrides,
  };
  return document;
}

function signAttestation(document, keyPair) {
  document.attestation_id = attestationId(document);
  document.signature = sign(null, canonicalAttestationBytes(document), keyPair.privateKey).toString("base64");
  return canonicalJson(document);
}

function makeTemporaryCorpus(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), "principal-evidence-positive-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const skill of ["architect", "build", "debug", "decide", "git-ops", "plan", "review"]) mkdirSync(join(root, skill, "tests", "results"), { recursive: true });
  mkdirSync(join(root, "docs", "validation"), { recursive: true });
  mkdirSync(join(root, "evidence"), { recursive: true });

  const primary = generateKeyPairSync("ed25519");
  const secondary = options.secondKey ? generateKeyPairSync("ed25519") : null;
  const keys = [signingPolicy(primary)];
  if (secondary) keys.push(signingPolicy(secondary, { key_id: "synthetic-unused-key-2" }));
  const policy = syntheticPolicy(keys);
  const originalBinding = treatmentBinding(policy, keys[0]);
  const resultCount = options.resultCount ?? 1;
  const results = [];
  const attestations = [];
  for (let index = 1; index <= resultCount; index++) {
    const path = `${index === 1 ? "review" : "build"}/tests/results/synthetic-${index}/results.yaml`;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    const result = futureResult(policy, index, options.reuseAttempt ? "synthetic-shared-attempt" : `synthetic-attempt-${index}`);
    options.mutateResult?.(result, index);
    let resultText = canonicalJson(result);
    if (options.rawResult) resultText = options.rawResult(resultText, result, index);
    writeFileSync(join(root, path), resultText);
    const resultSha = sha256(Buffer.from(resultText));
    const attestation = attestationFor(result, path, resultSha, policy, keys[0], options.attestationOverrides?.(index) ?? {});
    const attestationPath = `evidence/attestation-${index}.json`;
    writeFileSync(join(root, attestationPath), signAttestation(attestation, primary));
    attestations.push(attestationPath);
    results.push({
      path, result_file_sha256: resultSha, classification: "valid-treatment", evidence_basis: "external-attestation-v1",
      participates: { efficacy: true, stability: true, release_claims: false }, reason: "Synthetic temporary-root treatment verification.",
      arm_policy_path: "docs/validation/SYNTHETIC-ARM.v1.json",
      treatment_binding: structuredClone(originalBinding),
      attestation_paths: [attestationPath],
    });
  }
  if (options.missingAttestation) results[0].attestation_paths = [];
  if (options.extraAttestation) {
    const extraPath = "evidence/extra.json";
    writeFileSync(join(root, extraPath), readFileSync(join(root, attestations[0])));
    results[0].attestation_paths.push(extraPath);
  }
  options.mutatePolicy?.(policy);
  if (options.recomputePolicyDigest !== false) policy.canonical_definition_sha256 = armDefinitionDigest(policy);
  writeFileSync(join(root, "docs", "validation", "SYNTHETIC-ARM.v1.json"), `${JSON.stringify(policy, null, 2)}\n`);
  const manifest = {
    schema_version: 1,
    classifications: ["control", "historical-baseline", "valid-treatment", "invalid-infrastructure", "delivery-unproven", "probe", "excluded"],
    arm_policies: ["docs/validation/SYNTHETIC-ARM.v1.json"],
    results,
  };
  options.mutateManifest?.(manifest);
  writeFileSync(join(root, "docs", "validation", "RESULTS-MANIFEST.v1.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const trust = {
    schema_version: 1, production: true,
    keys: keys.map((key, index) => ({
      arm_id: policy.arm_id, ...key,
      public_key_pem: (index === 0 ? primary : (secondary ?? primary)).publicKey.export({ format: "pem", type: "spki" }),
    })),
  };
  options.mutateTrust?.(trust);
  const replayRegistry = createReplayRegistry();
  return {
    root, policy, manifest, trust, replayRegistry,
    run: () => buildResultManifest(root, { trust, now: NOW, replayRegistry }),
  };
}

test("all 205 results have exactly one closed explicit hash-bound classification", () => {
  const document = load();
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const check = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));
  assert.equal(check(document), true, ajv.errorsText(check.errors));
  assert.equal(document.results.length, 205);
  assert.equal(new Set(document.results.map((entry) => entry.path)).size, 205);
  const result = buildResultManifest(ROOT);
  assert.deepEqual(result.manifest, document);
  assert.deepEqual(result.summary, { result_count: 205, observation_count: 0, valid_treatment_count: 0, consumed_attestation_count: 0, unconsumed_structure_count: 0 });
});

test("manifest fails closed for missing, duplicate, conflicting, drifted, unknown, or implicit treatment", () => {
  assert.throws(() => validateResultManifest(mutate((m) => m.results.pop()), ROOT), /unmanifested|missing explicit/);
  assert.throws(() => validateResultManifest(mutate((m) => m.results.push(structuredClone(m.results[0]))), ROOT), /duplicate|conflicting/);
  assert.throws(() => validateResultManifest(mutate((m) => { m.results[0].path = "missing/tests/results/run/results.yaml"; }), ROOT), /nonexistent|unmanifested/);
  assert.throws(() => validateResultManifest(mutate((m) => { m.results[0].result_file_sha256 = "0".repeat(64); }), ROOT), /digest|SHA-256/);
  assert.throws(() => validateResultManifest(mutate((m) => { m.results[0].classification = "probably-treatment"; }), ROOT), /schema|classification/);
  assert.throws(() => validateResultManifest(mutate((m) => { delete m.results[0].participates.stability; }), ROOT), /schema|participation/);
  assert.throws(() => validateResultManifest(mutate((m) => { m.results[0].classification = "valid-treatment"; m.results[0].evidence_basis = "external-attestation-v1"; }), ROOT), /attestation|schema|treatment/);
  assert.throws(() => validateResultManifest(mutate((m) => { const e = m.results.find((entry) => entry.classification === "historical-baseline"); e.participates.efficacy = false; }), ROOT), /contradictory participation/);
  assert.throws(() => validateResultManifest(mutate((m) => { const e = m.results.find((entry) => entry.classification === "control" && entry.participates.efficacy); e.participates.stability = false; }), ROOT), /contradictory participation/);
  assert.throws(() => validateResultManifest(mutate((m) => { m.results[0].extra = true; }), ROOT), /schema|unknown/);
});

test("classification eligibility is noncontradictory and Terra remains excluded", () => {
  const document = load();
  assert.equal(document.results.filter((entry) => entry.classification === "valid-treatment").length, 0);
  for (const entry of document.results) {
    assert.match(entry.reason, /\S/);
    if (["invalid-infrastructure", "delivery-unproven", "probe", "excluded"].includes(entry.classification)) assert.deepEqual(entry.participates, { efficacy: false, stability: false, release_claims: false }, entry.path);
  }
  for (const [path, classification] of TERRA) {
    const entry = document.results.find((candidate) => candidate.path === path);
    assert.equal(entry?.classification, classification, path);
    assert.deepEqual(entry?.participates, { efficacy: false, stability: false, release_claims: false }, path);
  }
});

test("positive temporary-root integration consumes exactly one strict result, observation, treatment, and attestation", (t) => {
  const corpus = makeTemporaryCorpus(t);
  const result = corpus.run();
  assert.deepEqual(result.summary, { result_count: 1, observation_count: 1, valid_treatment_count: 1, consumed_attestation_count: 1, unconsumed_structure_count: 0 });
  assert.deepEqual(corpus.replayRegistry.snapshot(), { attestation_ids: 1, nonces: 1, accepted_attempt_ids: 1, result_identities: 1, observations: 1 });
});

test("every closed arm-policy identity and nested requirement is enforced through manifest integration", (t) => {
  const cases = [
    ["arm ID", (p) => { p.arm_id = "other-arm"; }],
    ["arm schema", (p) => { p.schema_version = 2; }],
    ["eligibility", (p) => { p.measurement_eligible = false; p.status = "experimental"; p.signing_keys = []; }],
    ["producer repository", (p) => { p.producer.repository = "https://example.test/other"; }],
    ["producer commit", (p) => { p.producer.commit = "9".repeat(40); }],
    ["producer tree", (p) => { p.producer.tree = "8".repeat(40); }],
    ["producer artifact", (p) => { p.producer.artifact_sha256 = "7".repeat(64); }],
    ["executor identity", (p) => { p.executor.identity = "subprocess:other"; }],
    ["signing key ID", (p) => { p.signing_keys[0].key_id = "other-key"; }],
    ["signing fingerprint", (p) => { p.signing_keys[0].fingerprint = "6".repeat(64); }],
    ["key purpose", (p) => { p.signing_keys[0].purpose = "test"; }],
    ["result schema", (p) => { p.result_contract.schema_version = 2; }],
    ["result encoding", (p) => { p.result_contract.encoding = "other"; }],
    ["attestation schema", (p) => { p.attestation_contract.schema_version = 2; }],
    ["attempt cardinality", (p) => { p.accepted_attempt.cardinality = "many"; }],
    ["attempt origin", (p) => { p.accepted_attempt.index_origin = 1; }],
    ["attempt status", (p) => { p.accepted_attempt.required_status = "failed"; }],
    ["freshness age", (p) => { p.freshness_policy.max_attestation_age_ms = 1; }],
    ["freshness delay", (p) => { p.freshness_policy.max_completion_to_attestation_ms = 1; }],
    ["behavioral type", (p) => { p.behavioral_evidence.required_types = ["other"]; }],
    ["behavioral count", (p) => { p.behavioral_evidence.minimum_receipts = 2; }],
    ["unknown nested", (p) => { p.executor.extra = true; }],
    ["missing nested", (p) => { delete p.producer.tree; }],
    ["duplicate key ID", (p) => { p.signing_keys.push({ ...p.signing_keys[0], fingerprint: "d".repeat(64) }); }],
    ["duplicate key fingerprint", (p) => { p.signing_keys.push({ ...p.signing_keys[0], key_id: "other-key" }); }],
    ["definition digest", (p) => { p.canonical_definition_sha256 = "e".repeat(64); }],
  ];
  for (const [label, mutatePolicy] of cases) {
    const corpus = makeTemporaryCorpus(t, { mutatePolicy, recomputePolicyDigest: label !== "definition digest" });
    assert.throws(() => corpus.run(), /schema|policy|binding|digest|eligible|signing|trust|conflict|behavior|fresh|attempt/, label);
    assert.equal(corpus.replayRegistry.snapshot().observations, 0, label);
  }
});

test("strict future-result consumption rejects duplicate, malformed, ambiguous, unknown, and undercount structures", (t) => {
  const cases = [
    ["unknown field", { mutateResult: (r) => { r.extra = true; } }],
    ["duplicate scenario", { mutateResult: (r) => { r.scenarios.push(structuredClone(r.scenarios[0])); } }],
    ["duplicate repetition", { mutateResult: (r) => { r.scenarios[0].repetitions.push(structuredClone(r.scenarios[0].repetitions[0])); } }],
    ["second observation cannot be silently skipped", { mutateResult: (r) => { const second = structuredClone(r.scenarios[0]); second.scenario_id = "B1"; second.repetitions[0].attempts[0].attempt_id = "second-observation-attempt"; r.scenarios.push(second); } }],
    ["duplicate attempt ID", { mutateResult: (r) => { const a = structuredClone(r.scenarios[0].repetitions[0].attempts[0]); a.attempt_index = 1; a.accepted = false; r.scenarios[0].repetitions[0].attempts.push(a); } }],
    ["duplicate attempt index", { mutateResult: (r) => { const a = structuredClone(r.scenarios[0].repetitions[0].attempts[0]); a.attempt_id = "other-attempt"; a.accepted = false; r.scenarios[0].repetitions[0].attempts.push(a); } }],
    ["multiple accepted", { mutateResult: (r) => { const a = structuredClone(r.scenarios[0].repetitions[0].attempts[0]); a.attempt_id = "other-attempt"; a.attempt_index = 1; r.scenarios[0].repetitions[0].attempts.push(a); } }],
    ["no accepted", { mutateResult: (r) => { r.scenarios[0].repetitions[0].attempts[0].accepted = false; } }],
    ["nested duplicate JSON key", { rawResult: (text) => text.replace('"lifecycle":{', '"lifecycle":{"status":"completed","status":"failed",') }],
    ["top duplicate JSON key", { rawResult: (text) => text.replace('{', '{"schema_version":1,') }],
    ["multiple documents", { rawResult: (text) => `${text}${text}` }],
    ["trailing data", { rawResult: (text) => `${text} trailing` }],
    ["YAML alias", { rawResult: () => "schema_version: 1\na: &x 1\nb: *x\n" }],
    ["noncanonical JSON", { rawResult: (text) => `${text}\n` }],
  ];
  for (const [label, options] of cases) {
    const corpus = makeTemporaryCorpus(t, options);
    assert.throws(() => corpus.run(), /schema|duplicate|accepted|attempt|count|trailing|multiple|invalid|canonical|JSON|value/, label);
    assert.equal(corpus.replayRegistry.snapshot().observations, 0, label);
  }
});

test("temporary-root integration rejects missing, extra, stale, capability-only, refusal, incomplete, producer, trust, and split replay cases atomically", (t) => {
  const cases = [
    ["missing attestation", { missingAttestation: true }],
    ["extra attestation", { extraAttestation: true }],
    ["wrong producer", { mutateResult: (r) => { r.producer_commit = "9".repeat(40); } }],
    ["stale", { attestationOverrides: () => ({ observation_started_at: "2026-08-24T09:50:00.000Z", observation_completed_at: "2026-08-24T09:55:00.000Z", attested_at: "2026-08-24T09:55:01.000Z", not_before: "2026-08-24T09:49:00.000Z", expires_at: "2026-08-24T12:10:00.000Z" }) }],
    ["capability only", { mutateResult: (r) => { r.scenarios[0].repetitions[0].attempts[0].behavioral_receipt_sha256 = []; } }],
    ["refusal only", { mutateResult: (r) => { r.scenarios[0].repetitions[0].attempts[0].lifecycle.refusal_only = true; } }],
    ["incomplete lifecycle", { mutateResult: (r) => { const l = r.scenarios[0].repetitions[0].attempts[0].lifecycle; l.successful_delegation = false; l.completed_children = 0; } }],
    ["unused malformed trust", { secondKey: true, mutateTrust: (trust) => { trust.keys[1].public_key_pem = "malformed"; } }],
    ["wrong policy fingerprint", { mutatePolicy: (p) => { p.signing_keys[0].fingerprint = "f".repeat(64); } }],
    ["replay split across two evidence sets", { resultCount: 2, reuseAttempt: true }],
  ];
  for (const [label, options] of cases) {
    const corpus = makeTemporaryCorpus(t, options);
    assert.throws(() => corpus.run(), /schema|count|policy|producer|fresh|behavior|lifecycle|refusal|trust|key|fingerprint|duplicate|replay|accepted/, label);
    assert.deepEqual(corpus.replayRegistry.snapshot(), { attestation_ids: 0, nonces: 0, accepted_attempt_ids: 0, result_identities: 0, observations: 0 }, label);
  }
});

test("every configured result root rejects symlinks, linked ancestors, escapes, and non-directories before evidence consumption", (t) => {
  const empty = { attestation_ids: 0, nonces: 0, accepted_attempt_ids: 0, result_identities: 0, observations: 0 };
  const externalTargets = [];
  t.after(() => { for (const path of externalTargets) rmSync(path, { recursive: true, force: true }); });
  const expectRootFailure = (label, mutateRoot, pattern = /result root.*(?:symbolic link|directory|nonexistent|unsafe)/i) => {
    const corpus = makeTemporaryCorpus(t);
    mutateRoot(corpus.root);
    assert.throws(() => corpus.run(), pattern, label);
    assert.deepEqual(corpus.replayRegistry.snapshot(), empty, `${label}: no evidence consumed`);
  };

  expectRootFailure("direct external result-root symlink", (root) => {
    const parent = mkdtempSync(join(tmpdir(), "principal-external-result-root-")); externalTargets.push(parent);
    const target = join(parent, "target");
    renameSync(join(root, "review", "tests", "results"), target);
    writeFileSync(join(target, "external-marker"), "unchanged");
    symlinkSync(target, join(root, "review", "tests", "results"), "dir");
  });
  const external = externalTargets[0];
  assert.equal(readFileSync(join(external, "target", "external-marker"), "utf8"), "unchanged", "external target is not modified on rejection");

  expectRootFailure("direct internal result-root symlink", (root) => {
    const target = join(root, "internal-results");
    renameSync(join(root, "review", "tests", "results"), target);
    symlinkSync(target, join(root, "review", "tests", "results"), "dir");
  });
  expectRootFailure("symlinked result-root ancestor", (root) => {
    const target = join(root, "review-tests-real");
    renameSync(join(root, "review", "tests"), target);
    symlinkSync(target, join(root, "review", "tests"), "dir");
  });
  expectRootFailure("chained result-root symlink", (root) => {
    const actual = join(root, "review-results-real");
    const intermediate = join(root, "review-results-link");
    renameSync(join(root, "review", "tests", "results"), actual);
    symlinkSync(actual, intermediate, "dir");
    symlinkSync(intermediate, join(root, "review", "tests", "results"), "dir");
  });
  expectRootFailure("dangling result-root symlink", (root) => {
    const resultRoot = join(root, "review", "tests", "results");
    rmSync(resultRoot, { recursive: true });
    symlinkSync(join(root, "does-not-exist"), resultRoot, "dir");
  });
  expectRootFailure("regular file used as result root", (root) => {
    const resultRoot = join(root, "review", "tests", "results");
    rmSync(resultRoot, { recursive: true });
    writeFileSync(resultRoot, "not a directory");
  });
  if (process.platform !== "win32") {
    expectRootFailure("FIFO used as result root", (root) => {
      const resultRoot = join(root, "review", "tests", "results");
      rmSync(resultRoot, { recursive: true });
      execFileSync("mkfifo", [resultRoot]);
    });
  }

  const ordinary = makeTemporaryCorpus(t);
  assert.equal(validateResultRoot(ordinary.root, "review/tests/results"), join(ordinary.root, "review", "tests", "results"));
  assert.throws(() => validateResultRoot(ordinary.root, "../outside/results"), /escapes|relative/i, "dot-dot escape");
  assert.throws(() => validateResultRoot(ordinary.root, "/outside/results"), /confined relative path/i, "absolute path");
  assert.throws(() => validateResultRoot(ordinary.root, "C:/outside/results"), /confined relative path/i, "drive-absolute path");
  assert.deepEqual(ordinary.run().summary, { result_count: 1, observation_count: 1, valid_treatment_count: 1, consumed_attestation_count: 1, unconsumed_structure_count: 0 });
});

test("all configured result roots are validated before any recursive result traversal", (t) => {
  const corpus = makeTemporaryCorpus(t);
  const recursiveTrap = join(corpus.root, "architect", "tests", "results", "recursive-trap");
  symlinkSync(join(corpus.root, "missing-recursive-target"), recursiveTrap, "dir");
  const reviewRoot = join(corpus.root, "review", "tests", "results");
  const target = join(corpus.root, "review-results-real");
  renameSync(reviewRoot, target);
  symlinkSync(target, reviewRoot, "dir");
  assert.throws(() => corpus.run(), /result root.*symbolic link/i, "root preflight wins before recursive enumeration");
  assert.deepEqual(corpus.replayRegistry.snapshot(), { attestation_ids: 0, nonces: 0, accepted_attempt_ids: 0, result_identities: 0, observations: 0 });
});

test("current manifest validation uses current bytes and needs no historical Git object", () => {
  assert.doesNotMatch(buildResultManifest.toString(), /execFile|ls-tree|git\b/);
  assert.doesNotThrow(() => buildResultManifest(ROOT));
});

test("optional historical audit confirms every result payload is byte-identical to the named base", () => {
  const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", BASE], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter((path) => /\/tests\/results\/.+\/results\.yaml$/.test(path));
  assert.equal(paths.length, 205);
  for (const path of paths) {
    const before = execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    assert.equal(Buffer.compare(before, readFileSync(join(ROOT, path))), 0, `${path} changed`);
  }
});

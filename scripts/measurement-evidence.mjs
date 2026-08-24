#!/usr/bin/env node
/**
 * Development-only measurement policy consumer.
 *
 * This module classifies committed result bytes and verifies attestations made by an
 * external producer. It does not execute subjects, produce ledgers, hold signing authority,
 * install artifacts, inspect executables, or claim that a valid signer is securely built.
 */
import { createHash, createPublicKey, verify } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VALIDATION = join(ROOT, "docs", "validation");
const DOMAIN = Buffer.from("principal-pi-skills external-attestation v1\n", "utf8");
const CLASSIFICATIONS = ["control", "historical-baseline", "valid-treatment", "invalid-infrastructure", "delivery-unproven", "probe", "excluded"];
const DISALLOWED_PARTICIPATION = new Set(["invalid-infrastructure", "delivery-unproven", "probe", "excluded"]);
const SHA256_RE = /^[a-f0-9]{64}$/;
const TEST_KEY_FINGERPRINTS = new Set([
  "934720bd4f9e7cf065dd3938d0c27002f93a07e28f79f61e040f14237eae0ff4",
  "59778ce40a640b270449e28d68185fc4bf543814e9e01e90abb4b0aa86e61642",
]);
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MATCH_FIELDS = [
  "result_path", "result_file_sha256", "result_id", "scenario_id", "repetition_index",
  "accepted_attempt_id", "accepted_attempt_index", "arm_id", "arm_schema_version",
  "arm_definition_sha256", "producer_repository", "producer_commit", "producer_tree",
  "producer_artifact_sha256", "executor_identity", "run_id", "task_id", "workspace_id",
  "context_id", "ledger_sha256", "behavioral_receipt_sha256", "behavioral_evidence_types",
  "lifecycle", "signing_key_id", "signing_key_fingerprint", "signing_key_purpose",
];
const schemaCache = new Map();
const replayRegistries = new WeakSet();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function rejectLoneSurrogates(value, label) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`${label} contains a lone UTF-16 surrogate`);
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} contains a lone UTF-16 surrogate`);
    }
  }
}

/** principal-canonical-json-v1. */
export function canonicalJson(value) {
  const ancestors = new Set();
  const encode = (current, path) => {
    if (current === null || typeof current === "boolean") return JSON.stringify(current);
    if (typeof current === "string") {
      rejectLoneSurrogates(current, path);
      return JSON.stringify(current);
    }
    if (typeof current === "number") {
      if (!Number.isSafeInteger(current)) throw new Error(`${path} must be a safe integer`);
      return JSON.stringify(current);
    }
    if (!current || typeof current !== "object") throw new Error(`${path} is not strict JSON`);
    if (ancestors.has(current)) throw new Error(`${path} is circular`);
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype || Object.keys(current).length !== current.length) throw new Error(`${path} must be a dense plain array`);
        return `[${current.map((entry, index) => encode(entry, `${path}[${index}]`)).join(",")}]`;
      }
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) throw new Error(`${path} must be a plain object`);
      const keys = Reflect.ownKeys(current);
      if (keys.some((key) => typeof key !== "string")) throw new Error(`${path} has a symbol key`);
      for (const key of keys) {
        rejectLoneSurrogates(key, `${path} key`);
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error(`${path}.${key} must be an enumerable data property`);
      }
      keys.sort((left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));
      return `{${keys.map((key) => `${JSON.stringify(key)}:${encode(current[key], `${path}.${key}`)}`).join(",")}}`;
    } finally {
      ancestors.delete(current);
    }
  };
  return encode(value, "value");
}

function decodeUtf8(bytes, label) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw new Error(`${label} must be raw UTF-8 bytes`);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

/** Strict JSON parser that detects duplicate keys before materializing objects. */
export function parseStrictJson(input, { label = "document", requireCanonical = false } = {}) {
  const text = typeof input === "string" ? input : decodeUtf8(input, label);
  let index = 0;
  const fail = (message) => { throw new Error(`${label} ${message} at byte ${Buffer.byteLength(text.slice(0, index), "utf8")}`); };
  const whitespace = () => { while (/[\t\n\r ]/.test(text[index] ?? "")) index++; };
  const string = () => {
    if (text[index] !== '"') fail("expected a JSON string");
    const start = index++;
    while (index < text.length) {
      const character = text[index++];
      if (character === '"') {
        try { return JSON.parse(text.slice(start, index)); } catch { fail("contains an invalid string"); }
      }
      if (character === "\\") {
        const escape = text[index++];
        if (escape === "u") index += 4;
        else if (!'"\\/bfnrt'.includes(escape ?? "")) fail("contains an invalid escape");
      } else if (character.charCodeAt(0) < 0x20) fail("contains an unescaped control character");
    }
    fail("contains an unterminated string");
  };
  const value = (path) => {
    whitespace();
    if (text[index] === "{") {
      index++; whitespace();
      const object = Object.create(null);
      const seen = new Set();
      if (text[index] === "}") { index++; return Object.fromEntries(Object.entries(object)); }
      while (true) {
        const key = string();
        if (seen.has(key)) fail(`contains duplicate key ${JSON.stringify(key)} at ${path}`);
        seen.add(key); whitespace();
        if (text[index++] !== ":") fail("expected ':'");
        object[key] = value(`${path}.${key}`); whitespace();
        if (text[index] === "}") { index++; return Object.fromEntries(Object.entries(object)); }
        if (text[index++] !== ",") fail("expected ',' or '}'");
        whitespace();
      }
    }
    if (text[index] === "[") {
      index++; whitespace();
      const array = [];
      if (text[index] === "]") { index++; return array; }
      while (true) {
        array.push(value(`${path}[${array.length}]`)); whitespace();
        if (text[index] === "]") { index++; return array; }
        if (text[index++] !== ",") fail("expected ',' or ']'");
        whitespace();
      }
    }
    if (text[index] === '"') return string();
    for (const [token, parsed] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(token, index)) { index += token.length; return parsed; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(index));
    if (number) { index += number[0].length; return JSON.parse(number[0]); }
    fail("contains an invalid value");
  };
  whitespace();
  const document = value("$");
  whitespace();
  if (index !== text.length) fail("contains trailing or multiple document data");
  if (requireCanonical && canonicalJson(document) !== text) throw new Error(`${label} bytes are not canonical JSON`);
  return document;
}

function cloneWithout(document, fields) {
  return Object.fromEntries(Object.entries(document).filter(([key]) => !fields.includes(key)));
}

export function attestationId(document) {
  return sha256(Buffer.concat([DOMAIN, Buffer.from(canonicalJson(cloneWithout(document, ["attestation_id", "signature"])), "utf8")]));
}

export function canonicalAttestationBytes(document) {
  return Buffer.concat([DOMAIN, Buffer.from(canonicalJson(cloneWithout(document, ["signature"])), "utf8")]);
}

function schemaValidator(filename) {
  if (!schemaCache.has(filename)) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    schemaCache.set(filename, ajv.compile(parseStrictJson(readFileSync(join(VALIDATION, filename)), { label: `schema ${filename}` })));
  }
  return schemaCache.get(filename);
}

function assertSchema(filename, value, label) {
  const check = schemaValidator(filename);
  if (!check(value)) throw new Error(`${label} schema validation failed: ${check.errors.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ")}`);
}

function strictBase64(value, label) {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(`${label} is not canonical RFC 4648 base64`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error(`${label} is not canonical RFC 4648 base64`);
  return bytes;
}

function timestamp(value, label) {
  if (!TIMESTAMP_RE.test(value ?? "")) throw new Error(`${label} timestamp is not strict UTC milliseconds`);
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) throw new Error(`${label} timestamp is not calendar-valid`);
  return millis;
}

function exactObject(object, keys, label) {
  if (!object || typeof object !== "object" || Array.isArray(object) || Object.keys(object).sort().join("\0") !== [...keys].sort().join("\0")) throw new Error(`${label} has missing or unknown fields`);
}

function parseCanonicalAttestation(bytes) {
  const document = parseStrictJson(bytes, { label: "attestation", requireCanonical: true });
  assertSchema("EXTERNAL-ATTESTATION.v1.schema.json", document, "attestation");
  return document;
}

export function armDefinitionDigest(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new Error("arm policy must be an object");
  return sha256(canonicalJson(cloneWithout(policy, ["canonical_definition_sha256"])));
}

export function validateArmPolicy(policy, label = "arm policy") {
  assertSchema("PI-DADDY-ARM.v1.schema.json", policy, label);
  if (policy.canonical_definition_sha256 !== armDefinitionDigest(policy)) throw new Error(`${label} definition digest mismatch`);
  const ids = new Set();
  const fingerprints = new Set();
  for (const key of policy.signing_keys) {
    if (ids.has(key.key_id) || fingerprints.has(key.fingerprint)) throw new Error(`${label} contains duplicate signing key identity`);
    ids.add(key.key_id); fingerprints.add(key.fingerprint);
    const active = timestamp(key.active_from, `${label} signing key active_from`);
    if (key.revoked_at !== null && timestamp(key.revoked_at, `${label} signing key revoked_at`) <= active) throw new Error(`${label} signing key revocation contradicts activation`);
  }
  return policy;
}

function policyBinding(policy, signingKey) {
  return {
    arm_id: policy.arm_id,
    arm_schema_version: policy.schema_version,
    arm_definition_sha256: policy.canonical_definition_sha256,
    producer: structuredClone(policy.producer),
    executor_identity: policy.executor.identity,
    signing_key: structuredClone(signingKey),
    result_schema_version: policy.result_contract.schema_version,
    accepted_attempt: structuredClone(policy.accepted_attempt),
    freshness_policy: structuredClone(policy.freshness_policy),
    required_behavioral_evidence_types: structuredClone(policy.behavioral_evidence.required_types),
  };
}

function validateTrust(trust, policies, nowMs, { allowNonProductionValidation }) {
  exactObject(trust, ["schema_version", "production", "keys"], "trust configuration");
  if (trust.schema_version !== 1 || typeof trust.production !== "boolean" || !Array.isArray(trust.keys)) throw new Error("trust configuration is malformed");
  if (!trust.production && !allowNonProductionValidation) throw new Error("production mode is required for treatment eligibility");
  const policyMap = new Map(policies.map((policy) => [policy.arm_id, policy]));
  if (policyMap.size !== policies.length) throw new Error("arm policy registry contains duplicate arm IDs");
  const seenIds = new Set();
  const seenFingerprints = new Set();
  const trustedByArmAndId = new Map();
  for (const key of trust.keys) {
    exactObject(key, ["arm_id", "key_id", "fingerprint", "public_key_pem", "purpose", "active_from", "revoked_at"], "trusted key");
    if (!new Set(["production", "test"]).has(key.purpose)) throw new Error("trusted key purpose is unknown");
    if (typeof key.arm_id !== "string" || typeof key.key_id !== "string" || !key.key_id || !SHA256_RE.test(key.fingerprint) || typeof key.public_key_pem !== "string") throw new Error("trusted key is malformed");
    if (seenIds.has(key.key_id) || seenFingerprints.has(key.fingerprint)) throw new Error("trusted keys contain duplicate identity");
    seenIds.add(key.key_id); seenFingerprints.add(key.fingerprint);
    const policy = policyMap.get(key.arm_id);
    if (!policy) throw new Error(`trusted key is bound to unknown arm ${key.arm_id}`);
    const declared = policy.signing_keys.find((candidate) => candidate.key_id === key.key_id && candidate.fingerprint === key.fingerprint);
    if (!declared) throw new Error("trusted key is not declared for its exact arm policy");
    const comparable = Object.fromEntries(Object.entries(key).filter(([field]) => field !== "arm_id" && field !== "public_key_pem"));
    if (canonicalJson(comparable) !== canonicalJson(declared)) throw new Error("trusted key metadata conflicts with arm policy");
    if (trust.production && (key.purpose !== "production" || TEST_KEY_FINGERPRINTS.has(key.fingerprint))) throw new Error("production trust contains a test-purpose or known fixture/test key");
    const active = timestamp(key.active_from, "trusted key active_from");
    const revoked = key.revoked_at === null ? null : timestamp(key.revoked_at, "trusted key revoked_at");
    if (active > nowMs) throw new Error("trusted key is not active yet");
    if (revoked !== null && revoked <= active) throw new Error("trusted key revocation contradicts activation");
    if (revoked !== null && revoked <= nowMs) throw new Error("trusted key is revoked");
    let publicKey;
    try { publicKey = createPublicKey(key.public_key_pem); } catch { throw new Error("trusted public key is malformed"); }
    if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("trusted key is not Ed25519");
    if (sha256(publicKey.export({ format: "der", type: "spki" })) !== key.fingerprint) throw new Error("trusted public-key fingerprint mismatch");
    trustedByArmAndId.set(`${key.arm_id}\0${key.key_id}`, { ...key, publicKey });
  }
  for (const policy of policies.filter((candidate) => candidate.measurement_eligible)) {
    for (const declared of policy.signing_keys) {
      const trusted = trustedByArmAndId.get(`${policy.arm_id}\0${declared.key_id}`);
      if (!trusted || trusted.fingerprint !== declared.fingerprint) throw new Error(`eligible arm ${policy.arm_id} lacks its exact trusted signing key`);
    }
  }
  return trustedByArmAndId;
}

export function canonicalResultPath(value) {
  if (typeof value !== "string" || !value || isAbsolute(value) || /^[A-Za-z]:\//.test(value) || value.includes("\\") || value.includes("\0")) throw new Error("result path must be repository-relative");
  if (value.split("/").includes("..")) throw new Error("result path escapes its root");
  const normalized = posix.normalize(value).replace(/\/+$/, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) throw new Error("result path escapes its root");
  return normalized;
}

function observationKey(value) {
  return canonicalJson({
    result_path: canonicalResultPath(value.result_path),
    result_file_sha256: value.result_file_sha256,
    scenario_id: value.scenario_id,
    repetition_index: value.repetition_index,
  });
}

export function createReplayRegistry() {
  const ids = new Set();
  const nonces = new Set();
  const attempts = new Set();
  const resultsById = new Map();
  const resultIdsByBinding = new Map();
  const resultDigestsByPath = new Map();
  const observations = new Map();
  const registry = {
    reserveBatch(proposals) {
      if (!Array.isArray(proposals)) throw new Error("replay proposals must be an array");
      const nextIds = new Set(ids); const nextNonces = new Set(nonces); const nextAttempts = new Set(attempts);
      const nextResultsById = new Map(resultsById); const nextResultIdsByBinding = new Map(resultIdsByBinding); const nextResultDigestsByPath = new Map(resultDigestsByPath); const nextObservations = new Map(observations);
      for (const proposal of proposals) {
        exactObject(proposal, ["attestation_id", "nonce", "result_id", "result_path", "result_file_sha256", "observation_key", "accepted_attempt_id", "accepted_attempt_index", "arm_id", "arm_definition_sha256", "signing_key_fingerprint"], "replay proposal");
        if (nextIds.has(proposal.attestation_id)) throw new Error("duplicate or replayed attestation ID");
        if (nextNonces.has(proposal.nonce)) throw new Error("duplicate or replayed attestation nonce");
        if (nextAttempts.has(proposal.accepted_attempt_id)) throw new Error("duplicate or replayed accepted attempt ID");
        const resultPath = canonicalResultPath(proposal.result_path);
        const resultBinding = canonicalJson({ result_path: resultPath, result_file_sha256: proposal.result_file_sha256 });
        if (nextResultsById.has(proposal.result_id) && nextResultsById.get(proposal.result_id) !== resultBinding) throw new Error("result ID is replayed with a different path or digest");
        if (nextResultIdsByBinding.has(resultBinding) && nextResultIdsByBinding.get(resultBinding) !== proposal.result_id) throw new Error("result path and digest are replayed with a different result ID");
        if (nextResultDigestsByPath.has(resultPath) && nextResultDigestsByPath.get(resultPath) !== proposal.result_file_sha256) throw new Error("result path is replayed with a different digest");
        if (nextObservations.has(proposal.observation_key)) throw new Error("duplicate or replayed observation identity");
        nextIds.add(proposal.attestation_id); nextNonces.add(proposal.nonce); nextAttempts.add(proposal.accepted_attempt_id);
        nextResultsById.set(proposal.result_id, resultBinding); nextResultIdsByBinding.set(resultBinding, proposal.result_id); nextResultDigestsByPath.set(resultPath, proposal.result_file_sha256);
        nextObservations.set(proposal.observation_key, {
          accepted_attempt_index: proposal.accepted_attempt_index,
          arm_id: proposal.arm_id,
          arm_definition_sha256: proposal.arm_definition_sha256,
          signing_key_fingerprint: proposal.signing_key_fingerprint,
        });
      }
      ids.clear(); nonces.clear(); attempts.clear(); resultsById.clear(); resultIdsByBinding.clear(); resultDigestsByPath.clear(); observations.clear();
      for (const value of nextIds) ids.add(value);
      for (const value of nextNonces) nonces.add(value);
      for (const value of nextAttempts) attempts.add(value);
      for (const [key, value] of nextResultsById) resultsById.set(key, value);
      for (const [key, value] of nextResultIdsByBinding) resultIdsByBinding.set(key, value);
      for (const [key, value] of nextResultDigestsByPath) resultDigestsByPath.set(key, value);
      for (const [key, value] of nextObservations) observations.set(key, value);
      return true;
    },
    snapshot() {
      return Object.freeze({ attestation_ids: ids.size, nonces: nonces.size, accepted_attempt_ids: attempts.size, result_identities: resultsById.size, observations: observations.size });
    },
  };
  replayRegistries.add(registry);
  return Object.freeze(registry);
}

function verifyOne(document, expected, policy, trustedKeys, nowMs) {
  if (attestationId(document) !== document.attestation_id) throw new Error("attestation_id digest mismatch");
  for (const field of MATCH_FIELDS) {
    if (!Object.hasOwn(expected, field)) throw new Error(`expected observation omits ${field}`);
    if (canonicalJson(document[field]) !== canonicalJson(expected[field])) throw new Error(`${field} observation mismatch`);
  }
  if (policy.measurement_eligible !== true) throw new Error("arm policy is not enabled for treatment evidence");
  const policyIdentity = {
    arm_id: policy.arm_id,
    arm_schema_version: policy.schema_version,
    arm_definition_sha256: policy.canonical_definition_sha256,
    producer_repository: policy.producer.repository,
    producer_commit: policy.producer.commit,
    producer_tree: policy.producer.tree,
    producer_artifact_sha256: policy.producer.artifact_sha256,
    executor_identity: policy.executor.identity,
  };
  for (const [field, value] of Object.entries(policyIdentity)) if (canonicalJson(document[field]) !== canonicalJson(value)) throw new Error(`${field} conflicts directly with arm policy`);
  const declaredKey = policy.signing_keys.find((key) => key.key_id === document.signing_key_id && key.fingerprint === document.signing_key_fingerprint);
  if (!declaredKey || declaredKey.purpose !== document.signing_key_purpose) throw new Error("attestation signing key conflicts directly with arm policy");
  const trusted = trustedKeys.get(`${policy.arm_id}\0${document.signing_key_id}`);
  if (!trusted || trusted.fingerprint !== document.signing_key_fingerprint) throw new Error("attestation signing key is not trusted for its exact arm");
  const signature = strictBase64(document.signature, "attestation signature");
  if (signature.length !== 64 || !verify(null, canonicalAttestationBytes(document), trusted.publicKey, signature)) throw new Error("attestation signature is invalid");

  const notBefore = timestamp(document.not_before, "not_before");
  const started = timestamp(document.observation_started_at, "observation_started_at");
  const completed = timestamp(document.observation_completed_at, "observation_completed_at");
  const attested = timestamp(document.attested_at, "attested_at");
  const expires = timestamp(document.expires_at, "expires_at");
  if (timestamp(trusted.active_from, "trusted key active_from") > attested) throw new Error("signing key was not active when the attestation was made");
  if (trusted.revoked_at !== null && timestamp(trusted.revoked_at, "trusted key revoked_at") <= attested) throw new Error("signing key was revoked when the attestation was made");
  if (!(notBefore <= started && started <= completed && completed <= attested && attested <= expires)) throw new Error("attestation timestamp chronology is invalid");
  if (attested > nowMs || started > nowMs || completed > nowMs) throw new Error("attestation or observation is future-dated");
  if (nowMs < notBefore || nowMs > expires) throw new Error("attestation is outside its freshness boundary");
  if (expires - attested > policy.freshness_policy.max_attestation_age_ms || nowMs - attested > policy.freshness_policy.max_attestation_age_ms) throw new Error("attestation freshness window exceeds arm policy");
  const delay = attested - completed;
  if (delay < 0 || delay > policy.freshness_policy.max_completion_to_attestation_ms) throw new Error("observation-to-attestation delay exceeds arm policy");
  if (document.behavioral_receipt_sha256.length < policy.behavioral_evidence.minimum_receipts || canonicalJson(document.behavioral_evidence_types) !== canonicalJson(policy.behavioral_evidence.required_types) || document.lifecycle.status !== "completed" || document.lifecycle.successful_delegation !== true || document.lifecycle.completed_children < 1 || document.lifecycle.refusal_only !== false) {
    throw new Error("behavioral evidence does not prove completed successful delegation");
  }
  return document;
}

/**
 * Verify every evidence set in one session and atomically reserve the complete corpus.
 * The registry is intentionally in-memory: durable operational replay prevention belongs to
 * the external producer/controller. A fresh validation session can deterministically recheck
 * the same corpus.
 */
export function validateExternalAttestationSets({ evidenceSets, trust, armPolicies, now, replayRegistry, allowNonProductionValidation = false }) {
  if (!Array.isArray(evidenceSets) || !Array.isArray(armPolicies) || !replayRegistries.has(replayRegistry)) throw new Error("complete evidence sets, arm policies, and a validation-session replay registry are required");
  const nowMs = timestamp(now, "verification time");
  const policies = armPolicies.map((policy, index) => validateArmPolicy(policy, `arm policy ${index}`));
  const trustedKeys = validateTrust(trust, policies, nowMs, { allowNonProductionValidation });
  const documents = [];
  const proposals = [];
  for (const [setIndex, set] of evidenceSets.entries()) {
    exactObject(set, ["attestationBytes", "expectedObservations", "armId"], `evidence set ${setIndex}`);
    if (!Array.isArray(set.attestationBytes) || !Array.isArray(set.expectedObservations) || set.attestationBytes.length !== set.expectedObservations.length) throw new Error("one attestation is required for every expected observation; count mismatch");
    const policy = policies.find((candidate) => candidate.arm_id === set.armId);
    if (!policy) throw new Error(`evidence set references unknown arm ${set.armId}`);
    const expectedByObservation = new Map();
    for (const expected of set.expectedObservations) {
      const key = observationKey(expected);
      if (expectedByObservation.has(key)) throw new Error("duplicate expected observation identity");
      expectedByObservation.set(key, expected);
    }
    const consumed = new Set();
    for (const bytes of set.attestationBytes) {
      const document = parseCanonicalAttestation(bytes);
      const key = observationKey(document);
      const expected = expectedByObservation.get(key);
      if (!expected || consumed.has(key)) throw new Error("attestation is extra, duplicate, or not consumed by an observation");
      consumed.add(key);
      verifyOne(document, expected, policy, trustedKeys, nowMs);
      documents.push(document);
      proposals.push({
        attestation_id: document.attestation_id,
        nonce: document.nonce,
        result_id: document.result_id,
        result_path: canonicalResultPath(document.result_path),
        result_file_sha256: document.result_file_sha256,
        observation_key: key,
        accepted_attempt_id: document.accepted_attempt_id,
        accepted_attempt_index: document.accepted_attempt_index,
        arm_id: document.arm_id,
        arm_definition_sha256: document.arm_definition_sha256,
        signing_key_fingerprint: document.signing_key_fingerprint,
      });
    }
    if (consumed.size !== expectedByObservation.size) throw new Error("an expected observation lacks exactly one consumed attestation");
  }
  replayRegistry.reserveBatch(proposals);
  const eligible = trust.production && documents.length > 0 && documents.every((document) => document.signing_key_purpose === "production");
  return { cryptographically_valid: true, eligible, observations: documents, consumed_attestation_count: documents.length, unconsumed_structure_count: 0 };
}

/** Compatibility wrapper for one complete evidence set. */
export function validateExternalAttestationSet({ attestationBytes, expectedObservations, trust, armPolicy, now, replayRegistry = createReplayRegistry(), allowNonProductionValidation = false }) {
  return validateExternalAttestationSets({
    evidenceSets: [{ attestationBytes, expectedObservations, armId: armPolicy?.arm_id }],
    trust, armPolicies: [armPolicy], now, replayRegistry, allowNonProductionValidation,
  });
}

function assertRelativePath(value, label) {
  if (typeof value !== "string" || !value || isAbsolute(value) || value.includes("\\")) throw new Error(`${label} must be repository-relative`);
  if (posix.normalize(value) !== value || value === "." || value === ".." || value.startsWith("../") || value.split("/").includes("..")) throw new Error(`${label} escapes its root`);
}

function safeFile(root, path, label) {
  assertRelativePath(path, label);
  const candidate = resolve(root, path);
  const rel = relative(resolve(root), candidate);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) || !existsSync(candidate) || !lstatSync(candidate).isFile() || lstatSync(candidate).isSymbolicLink()) throw new Error(`${label} is nonexistent or unsafe: ${path}`);
  const realRoot = realpathSync(root);
  const realCandidate = realpathSync(candidate);
  const realRel = relative(realRoot, realCandidate);
  if (realRel === ".." || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) throw new Error(`${label} escapes through a linked ancestor: ${path}`);
  return candidate;
}

export function validateResultRoot(root, configuredPath) {
  if (typeof configuredPath !== "string" || !configuredPath || isAbsolute(configuredPath) || /^[A-Za-z]:\//.test(configuredPath) || configuredPath.includes("\\") || configuredPath.includes("\0") || configuredPath.split("/").includes("..")) throw new Error("configured result root must be a confined relative path");
  const trustedRoot = resolve(root);
  const normalized = posix.normalize(configuredPath).replace(/\/+$/, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.startsWith("/")) throw new Error("configured result root escapes the trusted validation root");
  const components = normalized.split("/").filter((component) => component && component !== ".");
  let cursor = trustedRoot;
  const inspectDirectory = (path, label) => {
    let stat;
    try { stat = lstatSync(path); } catch { throw new Error(`result root ${label} is nonexistent`); }
    if (stat.isSymbolicLink()) throw new Error(`result root ${label} is a symbolic link`);
    if (!stat.isDirectory()) throw new Error(`result root ${label} is not a directory`);
  };
  inspectDirectory(cursor, "trusted root");
  for (const component of components) {
    cursor = join(cursor, component);
    inspectDirectory(cursor, component);
  }
  const realTrustedRoot = realpathSync(trustedRoot);
  const realResultRoot = realpathSync(cursor);
  const realRel = relative(realTrustedRoot, realResultRoot);
  if (realRel === ".." || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) throw new Error("result root escapes the trusted validation root");
  return cursor;
}

function currentResultPaths(root) {
  const skillNames = ["architect", "build", "debug", "decide", "git-ops", "plan", "review"];
  const paths = [];
  const walk = (directory, rel) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const childRel = rel ? `${rel}/${name}` : name;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`result tree contains unsafe symbolic link: ${childRel}`);
      if (stat.isDirectory()) walk(path, childRel);
      else if (stat.isFile() && childRel.endsWith("/results.yaml")) paths.push(childRel);
    }
  };
  const resultRoots = skillNames.map((skill) => ({ skill, directory: validateResultRoot(root, `${skill}/tests/results`) }));
  for (const { skill, directory } of resultRoots) walk(directory, `${skill}/tests/results`);
  return paths.sort();
}

export function parseFutureResult(input, policy) {
  const document = parseStrictJson(input, { label: "future treatment result", requireCanonical: true });
  assertSchema("FUTURE-RESULT.v1.schema.json", document, "future treatment result");
  const identity = {
    arm_id: policy.arm_id,
    arm_definition_sha256: policy.canonical_definition_sha256,
    producer_repository: policy.producer.repository,
    producer_commit: policy.producer.commit,
    producer_tree: policy.producer.tree,
    producer_artifact_sha256: policy.producer.artifact_sha256,
    executor_identity: policy.executor.identity,
  };
  for (const [field, expected] of Object.entries(identity)) if (document[field] !== expected) throw new Error(`future result ${field} conflicts with arm policy`);
  const scenarioIds = new Set();
  const observationIds = new Set();
  const attemptIds = new Set();
  const observations = [];
  for (const scenario of document.scenarios) {
    if (scenarioIds.has(scenario.scenario_id)) throw new Error(`duplicate scenario ID ${scenario.scenario_id}`);
    scenarioIds.add(scenario.scenario_id);
    for (const repetition of scenario.repetitions) {
      const observationId = `${scenario.scenario_id}\0${repetition.repetition_index}`;
      if (observationIds.has(observationId)) throw new Error("duplicate repetition identity");
      observationIds.add(observationId);
      const indexes = new Set();
      for (const attempt of repetition.attempts) {
        if (attemptIds.has(attempt.attempt_id)) throw new Error("duplicate attempt ID");
        if (indexes.has(attempt.attempt_index)) throw new Error("duplicate attempt index within observation");
        attemptIds.add(attempt.attempt_id); indexes.add(attempt.attempt_index);
      }
      const ordered = [...indexes].sort((a, b) => a - b);
      if (ordered.some((value, index) => value !== policy.accepted_attempt.index_origin + index)) throw new Error("attempt indexes are not complete from the policy origin");
      const accepted = repetition.attempts.filter((attempt) => attempt.accepted);
      if (accepted.length !== 1) throw new Error("observation must have exactly one accepted attempt");
      const attempt = accepted[0];
      if (attempt.status !== policy.accepted_attempt.required_status || attempt.lifecycle.status !== "completed" || attempt.lifecycle.successful_delegation !== true || attempt.lifecycle.completed_children < 1 || attempt.lifecycle.refusal_only !== false) throw new Error("accepted attempt lacks completed successful lifecycle");
      if (attempt.behavioral_receipt_sha256.length < policy.behavioral_evidence.minimum_receipts || canonicalJson(attempt.behavioral_evidence_types) !== canonicalJson(policy.behavioral_evidence.required_types)) throw new Error("accepted attempt lacks required behavioral evidence");
      observations.push({
        result_id: document.result_id,
        scenario_id: scenario.scenario_id,
        repetition_index: repetition.repetition_index,
        accepted_attempt_id: attempt.attempt_id,
        accepted_attempt_index: attempt.attempt_index,
        ledger_sha256: attempt.ledger_sha256,
        behavioral_receipt_sha256: structuredClone(attempt.behavioral_receipt_sha256),
        behavioral_evidence_types: structuredClone(attempt.behavioral_evidence_types),
        lifecycle: structuredClone(attempt.lifecycle),
        run_id: document.run_id,
        task_id: document.task_id,
        workspace_id: document.workspace_id,
        context_id: document.context_id,
      });
    }
  }
  if (!observations.length) throw new Error("future treatment result contains no observations");
  return { document, observations };
}

function loadArmPolicies(document, root) {
  const policies = [];
  const byPath = new Map();
  const armIds = new Set();
  for (const path of document.arm_policies) {
    const bytes = readFileSync(safeFile(root, path, "arm policy"));
    const policy = validateArmPolicy(parseStrictJson(bytes, { label: `arm policy ${path}` }), `arm policy ${path}`);
    if (armIds.has(policy.arm_id)) throw new Error(`duplicate arm policy ID ${policy.arm_id}`);
    armIds.add(policy.arm_id); policies.push(policy); byPath.set(path, policy);
  }
  return { policies, byPath };
}

export function validateResultManifest(document, root = ROOT, verification = {}) {
  assertSchema("RESULTS-MANIFEST.v1.schema.json", document, "result manifest");
  if (canonicalJson(document.classifications) !== canonicalJson(CLASSIFICATIONS)) throw new Error("manifest classification contract is malformed");
  const actualPaths = currentResultPaths(root);
  const counts = new Map();
  const { policies, byPath } = loadArmPolicies(document, root);
  const evidenceSets = [];
  let observationCount = 0;
  let validTreatmentCount = 0;
  for (const entry of document.results) {
    counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1);
    if (counts.get(entry.path) > 1) throw new Error(`duplicate or conflicting entry for ${entry.path}`);
    const resultFile = safeFile(root, entry.path, "manifest result");
    if (sha256(readFileSync(resultFile)) !== entry.result_file_sha256) throw new Error(`result SHA-256 digest mismatch for ${entry.path}`);
    if (DISALLOWED_PARTICIPATION.has(entry.classification) && Object.values(entry.participates).some(Boolean)) throw new Error(`${entry.classification} result has contradictory participation: ${entry.path}`);
    if (["historical-baseline", "valid-treatment"].includes(entry.classification) && (!entry.participates.efficacy || !entry.participates.stability)) throw new Error(`${entry.classification} result has contradictory participation: ${entry.path}`);
    if (entry.classification === "control" && (entry.participates.efficacy !== entry.participates.stability || entry.participates.release_claims)) throw new Error(`control result has contradictory participation: ${entry.path}`);
    const allowedBasis = { control: "historical-control", "historical-baseline": "historical-treatment", "valid-treatment": "external-attestation-v1", "invalid-infrastructure": "invalid-infrastructure", "delivery-unproven": "delivery-unproven", probe: "historical-probe", excluded: "excluded" };
    if (entry.evidence_basis !== allowedBasis[entry.classification]) throw new Error(`evidence basis conflicts with classification for ${entry.path}`);
    if (entry.classification === "valid-treatment") {
      validTreatmentCount++;
      const policy = byPath.get(entry.arm_policy_path);
      if (!policy) throw new Error("valid treatment references an unregistered arm policy");
      if (policy.measurement_eligible !== true) throw new Error("arm policy is not enabled for treatment evidence");
      const selectedKey = policy.signing_keys.find((key) => key.key_id === entry.treatment_binding.signing_key.key_id && key.fingerprint === entry.treatment_binding.signing_key.fingerprint);
      if (!selectedKey) throw new Error("manifest signing key is not listed for the exact arm");
      if (canonicalJson(entry.treatment_binding) !== canonicalJson(policyBinding(policy, selectedKey))) throw new Error("manifest treatment binding conflicts with closed arm policy");
      const parsed = parseFutureResult(readFileSync(resultFile), policy);
      const expectedObservations = parsed.observations.map((observation) => ({
        ...observation,
        result_path: entry.path,
        result_file_sha256: entry.result_file_sha256,
        arm_id: policy.arm_id,
        arm_schema_version: policy.schema_version,
        arm_definition_sha256: policy.canonical_definition_sha256,
        producer_repository: policy.producer.repository,
        producer_commit: policy.producer.commit,
        producer_tree: policy.producer.tree,
        producer_artifact_sha256: policy.producer.artifact_sha256,
        executor_identity: policy.executor.identity,
        signing_key_id: selectedKey.key_id,
        signing_key_fingerprint: selectedKey.fingerprint,
        signing_key_purpose: selectedKey.purpose,
      }));
      observationCount += expectedObservations.length;
      evidenceSets.push({
        armId: policy.arm_id,
        expectedObservations,
        attestationBytes: entry.attestation_paths.map((path) => readFileSync(safeFile(root, path, "external attestation"))),
      });
    }
  }
  for (const path of actualPaths) if ((counts.get(path) ?? 0) !== 1) throw new Error(`unmanifested or missing explicit result classification: ${path}`);
  for (const path of counts.keys()) if (!actualPaths.includes(path)) throw new Error(`manifest references nonexistent or unknown result: ${path}`);
  let consumedAttestations = 0;
  if (validTreatmentCount > 0) {
    if (!verification.trust || !verification.now || !replayRegistries.has(verification.replayRegistry)) throw new Error("valid treatment requires complete trust, verification time, and a validation-session replay registry");
    const evidence = validateExternalAttestationSets({ evidenceSets, trust: verification.trust, armPolicies: policies, now: verification.now, replayRegistry: verification.replayRegistry });
    if (!evidence.eligible) throw new Error("external attestation corpus is not treatment eligible");
    consumedAttestations = evidence.consumed_attestation_count;
  } else if (verification.trust) {
    validateTrust(verification.trust, policies, timestamp(verification.now, "verification time"), { allowNonProductionValidation: false });
  }
  return {
    manifest: document,
    summary: {
      result_count: document.results.length,
      observation_count: observationCount,
      valid_treatment_count: validTreatmentCount,
      consumed_attestation_count: consumedAttestations,
      unconsumed_structure_count: 0,
    },
  };
}

export function buildResultManifest(root = ROOT, verification = {}) {
  const bytes = readFileSync(join(root, "docs", "validation", "RESULTS-MANIFEST.v1.json"));
  const document = parseStrictJson(bytes, { label: "result manifest" });
  return validateResultManifest(document, root, verification);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "check-manifest") {
    console.error("usage: node scripts/measurement-evidence.mjs check-manifest");
    process.exitCode = 2;
  } else {
    try {
      const result = buildResultManifest(ROOT);
      console.log(`manifest: ${result.summary.result_count} results classified exactly once; valid-treatment=${result.summary.valid_treatment_count}`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

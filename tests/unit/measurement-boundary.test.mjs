import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parsePackMetadata } from "../../scripts/pack-meta.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("principal evidence code is verifier-only and contains no runtime producer surface", () => {
  const source = readFileSync(join(ROOT, "scripts", "measurement-evidence.mjs"), "utf8");
  for (const forbidden of [
    "generateKeyPair", "privateKey", "cryptoSign", "child_process", "spawn(", "execFile(", "registerHooks",
    "gunzip", "extract", "mkdtemp", "chmod", "kill(", "SIGKILL", "node:module", "tests/artifacts",
  ]) assert.equal(source.includes(forbidden), false, `forbidden runtime/producer surface: ${forbidden}`);
  assert.match(source, /ajv\.compile\(parseStrictJson\(readFileSync/, "authoritative schemas must reject duplicate JSON keys");
  for (const path of ["scripts/measurement-controller.mjs", "tests/extensions/pinned-pi-daddy.ts"]) {
    assert.equal(existsSync(join(ROOT, path)), false, `${path} must remain outside principal`);
  }
  assert.equal(existsSync(join(ROOT, "tests", "artifacts")), false, "artifact archives must not be vendored");
});

test("measurement policy and verifier remain outside the npm runtime artifact", () => {
  const metadata = parsePackMetadata(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8" }));
  const files = new Set(metadata.files.map((entry) => entry.path));
  for (const path of [
    "scripts/measurement-evidence.mjs", "docs/validation/RESULTS-MANIFEST.v1.json",
    "docs/validation/EXTERNAL-ATTESTATION.v1.schema.json", "docs/validation/FUTURE-RESULT.v1.schema.json",
    "docs/validation/PI-DADDY-ARM.v1.json", "docs/validation/PI-DADDY-ARM.v1.schema.json",
  ]) assert.equal(files.has(path), false, `${path} leaked into the shipped runtime package`);
});

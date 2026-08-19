#!/usr/bin/env node
/**
 * Verify the published tarball contains exactly what it should.
 *
 * Two failures this catches, which pull in opposite directions:
 *
 *   - **Shipping too much.** Before the allowlist, `npm pack` produced 287 files and ~1 MB:
 *     every fixture, every committed `results.yaml`, the evidence directory, CI config, the
 *     contract templates. None of it runs at install time, all of it is in the repo for
 *     anyone who wants it, and shipping benchmark transcripts to every consumer is
 *     bandwidth spent on nothing.
 *   - **Shipping too little.** An allowlist is a denylist's mirror image: it fails silently
 *     the moment a new runtime file is added and nobody updates `files`. A missing SKILL.md
 *     is invisible in every developer test — the checkout has it — and broken for every
 *     user. So the required list below is explicit and checked, not inferred.
 *
 * The tarball is the artifact users actually get. Testing the checkout is not testing it.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parsePackMetadata } from "./pack-meta.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = ["decide", "architect", "plan", "build", "review", "debug", "git-ops"];

const REQUIRED = [
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "AGENTS.md",
  ...SKILLS.map((s) => `${s}/SKILL.md`),
  ...["principal-feature", "principal-bugfix", "feature", "bugfix"].map((p) => `prompts/${p}.md`),
  ...["principal-plan", "principal-review", "principal-debug", "plan", "review", "debug"].map((a) => `agents/${a}.md`),
  "scripts/install-agents.mjs",
  "scripts/snapshot-workspace.mjs",
  "scripts/assurance-state.mjs",
  "schemas/assurance-run-state-v1.schema.json",
  "schemas/assurance-task-packet-v1.schema.json",
  "schemas/assurance-evidence-receipt-v1.schema.json",
];

/**
 * Nothing matching these may ship. Evidence and scenarios stay in git — the plan is explicit
 * that they are kept as history — they simply are not part of the distributable.
 */
const FORBIDDEN = [
  [/^docs\//, "documentation and benchmark evidence — in the repo, not the package"],
  [/tests\//, "scenarios, fixtures and committed results"],
  [/^contracts\//, "contract templates — build-time source, not runtime"],
  [/^\.github\//, "CI configuration"],
  [/^scripts\/(?!install-agents\.mjs$|snapshot-workspace\.mjs$|assurance-state\.mjs$)/, "dev-only scripts"],
  [/(^|\/)\.claude\//, "local editor/agent settings"],
  [/(^|\/)\.pi\//, "local pi settings"],
  [/package-lock\.json$/, "lockfile — not consumed by installers of this package"],
];

const meta = parsePackMetadata(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8" }));
const shipped = meta.files.map((f) => f.path);
const errors = [];

for (const req of REQUIRED) {
  if (!shipped.includes(req)) errors.push(`MISSING  ${req} — required at runtime but not in the tarball`);
}
for (const path of shipped) {
  for (const [pattern, why] of FORBIDDEN) {
    if (pattern.test(path)) {
      errors.push(`EXTRA    ${path} — ${why}`);
      break;
    }
  }
}

// A tarball that somehow shipped nothing would satisfy every FORBIDDEN rule.
if (shipped.length < REQUIRED.length) {
  errors.push(`tarball has ${shipped.length} files, fewer than the ${REQUIRED.length} required — packing is broken`);
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} packaging finding(s). Update the \`files\` allowlist in package.json,`);
  console.error(`or REQUIRED/FORBIDDEN in scripts/check-pack.mjs if what ships should genuinely change.`);
  process.exit(1);
}

console.log(
  `✓ tarball: ${shipped.length} files, ${(meta.unpackedSize / 1024).toFixed(0)} kB unpacked — ` +
    `all ${REQUIRED.length} required present, nothing excluded leaked`
);

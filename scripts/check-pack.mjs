#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePackMetadata } from "./pack-meta.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = [
  "architect",
  "build",
  "review",
  "debug",
  "git-ops",
  "plan",
  "investigate",
  "review-security",
  "review-perf",
  "test-engineer",
  "orchestrator",
  "refactor",
];

const AGENTS = [
  "principal-architect",
  "principal-build",
  "principal-review",
  "principal-debug",
  "principal-plan",
  "principal-investigate",
  "principal-review-security",
  "principal-review-perf",
  "principal-test-engineer",
  "principal-orchestrator",
  "principal-refactor",
];

const REQUIRED = [
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "AGENTS.md",
  "principal-agents.json",
  ...SKILLS.map((s) => `${s}/SKILL.md`),
  ...["principal-feature", "principal-bugfix", "principal-refactor", "principal-review-branch"].map((p) => `prompts/${p}.md`),
  ...AGENTS.map((a) => `agents/${a}.md`),
  "scripts/install-agents.mjs",
  "scripts/snapshot-workspace.mjs",
  "scripts/check-runner.mjs",
  "extensions/bootstrap.ts",
  "extensions/verify-before-settle.ts",
  "bootstrap/BOOTSTRAP.md",
  "references/research.md",
  "references/checkpoints.md",
  "review/references/test-quality.md",
];

const FORBIDDEN = [
  [/^evals\//, "opt-in evaluation fixtures"],
  [/^docs\//, "docs"],
  [/tests\//, "tests"],
  [/^contracts\//, "build-time contract templates"],
  [/^\.github\//, "CI config"],
  [/package-lock\.json$/, "lockfile"],
];

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const meta = parsePackMetadata(
  execFileSync(npmBin, ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" }),
);
const shipped = meta.files.map((f) => f.path);
const errors = [];
for (const req of REQUIRED) {
  if (!shipped.includes(req)) errors.push(`MISSING  ${req}`);
}
for (const path of shipped) {
  for (const [pattern, why] of FORBIDDEN) {
    if (pattern.test(path)) { errors.push(`EXTRA    ${path} — ${why}`); break; }
  }
}
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log(`✓ tarball: ${shipped.length} files, ${(meta.unpackedSize / 1024).toFixed(0)} kB unpacked`);

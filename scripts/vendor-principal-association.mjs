#!/usr/bin/env node
// Copy only immutable, public synthetic contracts; never read moving worktree files.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
if (!args.includes("--harness-repo") || !args.includes("--producer-repo")) throw new Error("explicit --harness-repo and --producer-repo required");
const pins = [
  { producer: "skill-harness", commit: "a311df8c991108ada7b6f4b901332232a78e9a44", repo: value("--harness-repo"), paths: [
    ["contracts/execution-archive/v1/README.md", "p03/README.md"],
    ["contracts/execution-archive/v1/projection.schema.json", "p03/projection.schema.json"],
    ["contracts/execution-archive/v1/fixtures/retained-executions.json", "p03/retained-executions.json"],
  ] },
  { producer: "pi-daddy", commit: "2b3027e43fe9a418788f226e642e0bbde3f7806a", repo: value("--producer-repo"), paths: [
    ["packages/pi-daddy/contracts/daily-view/v1/README.md", "p04/README.md"],
    ["packages/pi-daddy/contracts/daily-view/v1/fixtures/view.json", "p04/view.json"],
    ["packages/pi-daddy/src/daily-view.ts", "p04/daily-view.ts"],
    ["packages/pi-daddy/src/work-ledger-types.ts", "p04/work-ledger-types.ts"],
    ["packages/pi-daddy/contracts/daily-view/v1/fixtures/work.jsonl", "p04/work.jsonl"],
    ["packages/pi-daddy/test/daily-view-fixture.ts", "p04/daily-view-fixture.ts"],
  ] },
];
const base = resolve(root, "tests/fixtures/principal-association");
const outputs = [], entries = [];
for (const { producer, commit, repo, paths } of pins) {
  for (const [sourcePath, targetPath] of paths) {
    const bytes = execFileSync("git", ["-C", resolve(repo), "show", `${commit}:${sourcePath}`], { cwd: root, maxBuffer: 1024 * 1024 });
    entries.push({ producer, commit, sourcePath, targetPath, sha256: createHash("sha256").update(bytes).digest("hex") });
    outputs.push([targetPath, bytes]);
  }
}
outputs.push(["provenance.json", Buffer.from(JSON.stringify({ version: "principal-association-input-pins-v1", entries }, null, 2) + "\n")]);
for (const [path, bytes] of outputs) {
  const target = resolve(base, path);
  if (args.includes("--check")) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`pinned input drift: ${path}`);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}
console.log(`${args.includes("--check") ? "Verified" : "Copied"} ${outputs.length} pinned association input files`);

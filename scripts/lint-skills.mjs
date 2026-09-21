#!/usr/bin/env node
/**
 * Lint every SKILL.md frontmatter locally. Replaces the skill-harness lint that read
 * specification.yaml and results; those left the repo in 4.0.
 */
import { readFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SKILLS = ["decide", "architect", "plan", "build", "review", "debug", "git-ops"];

export function lintSkill(path, text) {
  const findings = [];
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) return [`${path}: no frontmatter block`];
  const dir = path.split("/")[0];
  const name = fm[1].match(/^name:\s*(\S+)/m)?.[1];
  if (name !== dir) findings.push(`${path}: name "${name}" does not match directory "${dir}"`);
  const descLines = [];
  let inDesc = false;
  for (const line of fm[1].split("\n")) {
    if (/^description:/.test(line)) { inDesc = true; descLines.push(line.replace(/^description:\s*>?\s*/, "")); continue; }
    if (inDesc && /^\s+\S/.test(line)) { descLines.push(line.trim()); continue; }
    inDesc = false;
  }
  const desc = descLines.join(" ").trim();
  if (!desc) findings.push(`${path}: description is empty`);
  else {
    if (!/^Use /.test(desc)) findings.push(`${path}: description must start with "Use when/for/to" — triggers only`);
    if (desc.length > 1024) findings.push(`${path}: description exceeds 1024 characters (${desc.length})`);
  }
  return findings;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) {
  const all = SKILLS.flatMap((s) => lintSkill(`${s}/SKILL.md`, readFileSync(join(ROOT, s, "SKILL.md"), "utf8")));
  for (const f of all) console.error(`✗ ${f}`);
  if (all.length) process.exit(1);
  console.log(`✓ ${SKILLS.length} skills lint clean`);
}

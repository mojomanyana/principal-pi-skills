#!/usr/bin/env node
/**
 * Run skill-harness lint and apply this repo's severity policy.
 *
 * The harness exits non-zero on any gate-failing finding, which is the right default for a
 * tool that cannot know which of our cells publish a number. This repo needs four
 * severities instead of two:
 *
 *   1. spec / fixture / results findings — defects. Always block.
 *   2. `stale` on a cell the scorecard PUBLISHES — the README's numbers no longer measure
 *      the current text, i.e. a false claim. Blocks.
 *   3. `stale` on a cell that publishes nothing — no claim to protect. A notice.
 *   4. `stale` where the RECORD is unprovable but the measurement is sound, vouched for by
 *      a checkable assertion rather than by a hash. A notice, and the weakest of the four:
 *      it is a human standing where a measurement used to.
 *
 * Cells in category 3 are declared in docs/validation/unpublished-cells.txt, and category 4
 * in docs/validation/record-artifacts.txt. Both lists are themselves gated: an entry matching
 * no finding is an error, so an exemption gets deleted when its reason expires rather than
 * quietly covering a cell someone later publishes or re-runs. The two are kept disjoint —
 * category 4 matches on three tokens rather than two, so an entry cannot swallow a different
 * kind of drift on the same cell, which is the blind spot a broad match would create.
 *
 * This lives in a script, not in CI's shell, so that `npm test` and CI apply the identical
 * policy — a green local run that reds in CI (or worse, the reverse) is how a gate stops
 * being believed.
 *
 * Env:
 *   SKILL_HARNESS_CMD  how to invoke the harness. Defaults to the moving `latest` release
 *                      (user decision 2026-08-06: track it everywhere). CI overrides this
 *                      with its built checkout.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXEMPTIONS = "docs/validation/unpublished-cells.txt";
const ARTIFACTS = "docs/validation/record-artifacts.txt";
const HARNESS = process.env.SKILL_HARNESS_CMD ?? "npx -y skill-harness@latest";
const ci = !!process.env.GITHUB_ACTIONS;

const annotate = (level, title, msg) => {
  if (ci) console.log(`::${level} title=${title}::${msg}`);
};
const fail = (title, msg) => {
  annotate("error", title, msg);
  console.error(`✗ ${msg}`);
  process.exit(1);
};

let out = "";
let code = 0;
try {
  out = execSync(`${HARNESS} lint all --skills .`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  code = e.status ?? 1;
}
process.stdout.write(out);

// Prove the linter ran to completion before trusting its silence. Any failure that produces
// no findings — a crash, a bad flag, a wrong --skills path — would otherwise parse as "zero
// findings" and pass this gate green. The summary line may carry trailing clauses newer
// harness versions add (0.5.x appended the note count), so anchor on the prefix and tolerate
// the rest: tracking @latest means additive format growth must not read as a red tree.
const summary = out.match(/^(\d+) skill\(s\), (\d+) finding\(s\)/m);
if (!summary) fail("skill-harness", `lint did not run to completion (exit ${code}) — no summary line in its output`);

const [, skillsRaw, reportedRaw] = summary;
if (Number(skillsRaw) === 0) fail("skill-harness", "lint discovered no skills — is --skills pointing at the repo root?");

const findings = out.split("\n").filter((l) => l.startsWith("✗ "));
if (findings.length !== Number(reportedRaw)) {
  fail("skill-harness", `parsed ${findings.length} finding line(s) but lint reported ${reportedRaw} — output format changed, the severity split cannot be trusted`);
}
if (code !== 0 && findings.length === 0) {
  fail("skill-harness", `lint exited ${code} with no findings — infrastructure failure, not a clean tree`);
}

const stale = findings.filter((l) => /: stale — /.test(l));
const blocking = findings.length - stale.length;
if (blocking > 0) fail("skill-harness", `${blocking} spec/results finding(s) — see the output above`);

// Partition staleness by whether the cell publishes a number.
const exempt = new Set();
let dead = 0;
if (existsSync(join(ROOT, EXEMPTIONS))) {
  for (const raw of readFileSync(join(ROOT, EXEMPTIONS), "utf8").split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [skill, model] = line.split(/\s+/);
    if (!skill || !model) continue;
    const hits = stale.filter((l) => l.includes(`/${skill}`) && l.includes(model));
    if (hits.length === 0) {
      dead++;
      annotate("error", "dead exemption", `${skill} × ${model} is listed as publishing no cell, but lint reports no staleness for it — delete the entry or publish the cell`);
      console.error(`✗ dead exemption: ${skill} × ${model} in ${EXEMPTIONS} matches no finding`);
    }
    for (const h of hits) exempt.add(h);
  }
}
if (dead > 0) process.exit(1);

// Category 4: the hash cannot be proven but the stimulus is vouched for. Three tokens must
// all appear in the same finding — cell, model, and the source being vouched for — so an
// entry covers exactly one kind of drift on one cell and nothing else. Already-exempt lines
// are excluded, which keeps the two lists disjoint: listing a line in both makes the
// artifacts entry match nothing and fail as dead, rather than double-counting it.
const vouched = new Set();
let deadArtifacts = 0;
if (existsSync(join(ROOT, ARTIFACTS))) {
  for (const raw of readFileSync(join(ROOT, ARTIFACTS), "utf8").split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [cell, model, needle] = line.split(/\s+/);
    if (!cell || !model || !needle) continue;
    const hits = stale.filter(
      (l) => l.includes(`/${cell}:`) && l.includes(model) && l.includes(needle) && !exempt.has(l)
    );
    if (hits.length === 0) {
      deadArtifacts++;
      annotate("error", "dead record-artifact", `${cell} × ${model} (${needle}) is vouched for in ${ARTIFACTS}, but lint reports no such staleness — the record was re-run or the finding changed shape; delete the entry`);
      console.error(`✗ dead record-artifact: ${cell} × ${model} (${needle}) in ${ARTIFACTS} matches no finding`);
    }
    for (const h of hits) vouched.add(h);
  }
}
if (deadArtifacts > 0) process.exit(1);

const published = stale.length - exempt.size - vouched.size;
if (exempt.size > 0) {
  annotate("notice", "skill-harness", `${exempt.size} stale finding(s) on cells that publish no number (see ${EXEMPTIONS}) — not a claim, not a gate`);
}
if (vouched.size > 0) {
  annotate("notice", "skill-harness", `${vouched.size} stale finding(s) whose record is unprovable but whose stimulus is vouched for (see ${ARTIFACTS}) — an assertion, not a measurement`);
  console.log(`ℹ ${vouched.size} stale finding(s) vouched for in ${ARTIFACTS} — the record cannot be proven; the stimulus is asserted unchanged, with evidence`);
}
if (published > 0) {
  fail("skill-harness", `${published} finding(s) stale behind a PUBLISHED scorecard cell — re-run before merging, or the README measures older text`);
}

console.log(`✓ ${findings.length} finding(s): ${exempt.size} exempt, ${vouched.size} vouched, 0 blocking`);

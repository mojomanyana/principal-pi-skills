import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const skills = ["decide", "architect", "plan", "build", "review", "debug", "git-ops"];

test("v3 keeps exactly the seven stable public skill names and least-privilege ceilings", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.deepEqual(pkg.pi.skills, skills.map((name) => `./${name}`));
  const ceilings = {
    decide: "read, grep, find, ls",
    architect: "read, grep, find, ls",
    plan: "read, grep, find, ls",
    build: "read, grep, find, ls, edit, write, bash",
    review: "read, grep, find, ls, bash",
    debug: "read, grep, find, ls, bash",
    "git-ops": "read, bash",
  };
  for (const name of skills) {
    const text = read(`${name}/SKILL.md`);
    assert.match(text, new RegExp(`^name: ${name}$`, "m"));
    assert.match(text, new RegExp(`^allowed-tools: ${ceilings[name]}$`, "m"), name);
  }
});

test("decide preserves a compact revisit condition without routing", () => {
  const text = read("decide/SKILL.md");
  assert.match(text, /revisit (trigger|when)/i);
  assert.doesNotMatch(text, /^Next:/m);
});

test("architect makes critical validation, observability, rollback, and abort explicit", () => {
  const text = read("architect/SKILL.md");
  for (const term of [/critical/i, /validation/i, /observability/i, /rollback/i, /abort/i]) assert.match(text, term);
});

test("plan task specs carry v3 authority and verification fields", () => {
  const text = read("contracts/plan.md.tmpl");
  for (const field of ["Authority:", "Global constraints:", "Out of scope:", "Task ID:", "Done command:", "Review risk:", "Critical scope:"]) {
    assert.ok(text.includes(field), field);
  }
});

test("build reports red/green/full receipts and has evidence-adjudicated repair mode", () => {
  const text = read("build/SKILL.md");
  for (const field of ["Red evidence:", "Green evidence:", "Full evidence:", "Changed paths:", "Accepted finding IDs:"]) {
    assert.ok(text.includes(field), field);
  }
  assert.match(text, /repair mode/i);
  assert.match(text, /accepted finding/i);
});

test("review takes an axis, authority, and exact writer snapshot identity", () => {
  const text = read("contracts/review.md.tmpl");
  for (const field of [
    "Review axis:", "Assurance:", "Authority:", "Writer root:", "Expected candidate tree:",
    "Spec verdict:", "Quality verdict:", "Reviewed tree:",
  ]) assert.ok(text.includes(field), field);
  assert.match(text, /create --repo <writer-root>/i);
  assert.match(text, /does not equal the expected candidate tree/i);
});

test("debug records boundary evidence and condition-based waiting", () => {
  const text = read("contracts/debug.md.tmpl");
  assert.ok(text.includes("Boundary evidence:"));
  assert.ok(text.includes("Wait condition:"));
  assert.match(text, /condition-based/i);
});

test("git-ops finish mode offers merge, PR, or keep and gates standard/critical on fresh evidence", () => {
  const text = read("git-ops/SKILL.md");
  assert.match(text, /finish mode/i);
  assert.match(text, /merge locally/i);
  assert.match(text, /push\/open (?:a )?PR/i);
  assert.match(text, /keep the\s+branch/i);
  assert.match(text, /fresh attributable receipt/i);
  assert.match(text, /candidate\s+tree SHA/i);
  assert.match(text, /standard.*critical|critical.*standard/is);
});

test("shared workflows pin critical isolation, dual review, escalation backfill, and JIT approval", () => {
  const text = read("contracts/workflows.md.tmpl");
  for (const phrase of [
    "BLOCKED_CRITICAL_ASSURANCE",
    "owned isolated",
    "review axis: specification",
    "review axis: quality",
    "critical_backfill_required",
    "just in time",
    "merge locally",
    "push/open PR",
    "keep the branch",
    "Never interpolate request text",
    "every bash command must begin by changing to",
    "never fall back to the caller checkout",
  ]) assert.ok(text.includes(phrase), phrase);
});

test("workflow orders critique and discovery before packets, binds review roots, and persists finalization", () => {
  const text = read("contracts/workflows.md.tmpl");
  assert.match(text, /critique[^.]*discovery[^.]*then record its task packets/is);
  assert.match(text, /plan_discovery_recorded/);
  assert.match(text, /Missing, stale, or\s+mismatched discovery fails closed/);
  assert.match(text, /Writer root.*canonical/i);
  assert.match(text, /task_packet_superseded/);
  assert.match(text, /gate finalize/);
  assert.match(text, /finalization_completed/);
  assert.match(text, /base\/head\/tree/i);
});

test("workspace contract distinguishes spawn validation and governed leases from containment", () => {
  const handoff = read("docs/HANDOFF.md");
  for (const phrase of [
    "trusted correlation and lease inputs",
    "initial CWD",
    "among children it governs",
    "cannot guarantee path confinement",
    "OS sandbox",
    "constrained non-shell execution broker",
  ]) assert.ok(handoff.includes(phrase), phrase);

  const workflow = read("contracts/workflows.md.tmpl");
  assert.match(workflow, /behavioral rules, not\s+path confinement/);
  assert.match(workflow, /unrestricted `bash`/);
  assert.match(workflow, /cannot exclude external writers/);
});

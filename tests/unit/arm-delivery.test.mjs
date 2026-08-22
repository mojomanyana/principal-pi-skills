/**
 * A committed arm run must carry evidence that the arm actually delivered.
 *
 * The pi-daddy ledger is gitignored (`*.jsonl`), so the `ledger_events` count the
 * harness writes into `results.yaml` is the ONLY evidence of delegation that
 * survives a commit. A vacuous arm run — extension loaded, definitions seeded,
 * nothing ever spawned — otherwise commits a record byte-indistinguishable from
 * a run that genuinely exercised delegation, and every downstream reading
 * (`stability`, the scorecard, any writeup) treats the two as the same thing.
 *
 * This is not hypothetical. The arm was declared in c55784b with a
 * `PI_GRANTS_GRANT` that could not delegate at all: it held no `tool:delegate`,
 * so pi-daddy registered no spawn tool, and no `agent:` capability, so none of
 * the six seeded definitions was spawnable. `resolveArm` resolved it, `lint`
 * stayed green, and `require_definitions: 6` passed — that check counts
 * definition files COPIED, not definitions reachable. Nothing in the pipeline
 * could have said the arm measured nothing until someone read a ledger that git
 * does not keep.
 *
 * KNOWN LIMIT, stated so no one reads more into a pass than is there:
 * `ledger_events` is a raw line count, and the ledger records refusals, workspace
 * leases and lifecycle events as well as successful spawns. A run in which every
 * delegation was REFUSED still has a non-zero count and still passes here. Zero
 * proves nothing was delegated; non-zero does not prove anything was. Closing
 * that gap needs the harness to record successful spawns separately — a count of
 * non-blocked `child_lifecycle` records alongside `ledger_events` — at which
 * point the assertion below should move to that field. Until then this catches
 * the total-vacuity case only, which is the case that actually happened.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The `arm` block of one `results.yaml`, or null for a control run.
 *
 * Hand-scanned rather than YAML-parsed because this repo has no YAML dependency
 * and one is not worth adding for four fields. The scan is therefore deliberately
 * STRICT: an `arm:` block whose shape it does not recognise throws instead of
 * returning null, because "I could not read it" must never present as "there was
 * nothing to read" — that is the same silent-pass this whole file exists against.
 */
export function armRecord(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l === "arm:");
  if (start === -1) return null;

  const out = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    // Back at column 0 — the arm block is over.
    if (!line.startsWith("  ")) break;
    // Only the arm's own fields, at exactly one level of nesting. `env:` sits
    // here too and its children at four spaces; without this they would be read
    // as arm fields, and a grant containing the text `definitions:` would set one.
    if (line.startsWith("    ")) continue;
    const m = /^ {2}([a-z_]+):\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2];
  }

  if (out.name === undefined) {
    throw new Error("found an `arm:` block with no `name` — the scan below cannot read this record's shape");
  }
  const numeric = (field) => {
    if (out[field] === undefined) {
      throw new Error(`arm \`${out.name}\` records no \`${field}\` — a delivery claim that is absent is not a claim`);
    }
    const n = Number(out[field]);
    if (!Number.isInteger(n)) {
      throw new Error(`arm \`${out.name}\` records ${field}=${JSON.stringify(out[field])}, which is not an integer`);
    }
    return n;
  };
  return { name: out.name, ledgerEvents: numeric("ledger_events"), definitions: numeric("definitions") };
}

test("every committed arm run recorded delegation actually happening", () => {
  // git ls-files, not a filesystem walk: the scope of this guard is exactly what
  // a commit carries, which is the same scope as the evidence problem it closes.
  const files = execFileSync("git", ["ls-files", "*/tests/results/**/results.yaml"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter((l) => l.trim() !== "");

  // The fixture-hygiene test learned this the hard way: a pathspec that matches
  // nothing makes a sweep pass while checking zero things. Assert the sweep found
  // the corpus before believing anything it reports.
  assert.ok(files.length > 0, "found no committed results.yaml — the pathspec matched nothing, so this test checked nothing");

  const vacuous = [];
  let armRuns = 0;
  for (const rel of files) {
    const record = armRecord(readFileSync(join(ROOT, rel), "utf8"));
    if (record === null) continue; // control run: nothing to deliver
    armRuns++;
    if (record.ledgerEvents === 0 || record.definitions === 0) {
      vacuous.push(`${rel}: arm \`${record.name}\` recorded definitions=${record.definitions} ledger_events=${record.ledgerEvents}`);
    }
  }

  assert.deepEqual(
    vacuous,
    [],
    "these committed runs are tagged with an arm but recorded no delegation. The ledger " +
      "itself is gitignored, so this count is the only surviving evidence — a zero here is " +
      "a run that loaded the extension and measured nothing, and it must not be committed " +
      "alongside runs that did. Check PI_GRANTS_GRANT holds `tool:delegate` and an `agent:` " +
      "capability per seeded definition, then re-run:\n  " + vacuous.join("\n  "),
  );

  // Reported, not asserted. Wave 0 has not run, so today this is legitimately 0
  // and the sweep above is a guard waiting for data rather than one confirming
  // any. Printing it stops a green line being read as "arm runs verified".
  console.log(`      swept ${files.length} committed results.yaml, ${armRuns} carrying an arm record`);
});

test("the sweep detects the vacuity it exists to catch", () => {
  // Negative controls. A guard whose failure path has never fired is a guess, and
  // this one cannot be exercised by the corpus yet: there are no committed arm
  // runs at all, so without these the test above passes over an empty set.
  const withArm = (body) => `schema: 2\nskill: debug\narm:\n${body}scenarios:\n  - id: A1\n`;

  assert.deepEqual(
    armRecord(withArm("  name: pi-daddy\n  definitions: 6\n  ledger_events: 0\n")),
    { name: "pi-daddy", ledgerEvents: 0, definitions: 6 },
    "a zero ledger must be read as zero, not skipped",
  );
  assert.deepEqual(
    armRecord(withArm("  name: pi-daddy\n  definitions: 6\n  ledger_events: 14\n")),
    { name: "pi-daddy", ledgerEvents: 14, definitions: 6 },
  );
  assert.equal(armRecord("schema: 2\nskill: debug\nscenarios:\n  - id: A1\n"), null, "a control run has no arm block");

  // An absent count must throw, never read as 0 and never as absent-so-fine.
  assert.throws(
    () => armRecord(withArm("  name: pi-daddy\n  definitions: 6\n")),
    /records no `ledger_events`/,
  );
  assert.throws(() => armRecord(withArm("  definitions: 6\n  ledger_events: 3\n")), /no `name`/);
  assert.throws(
    () => armRecord(withArm("  name: pi-daddy\n  definitions: 6\n  ledger_events: nope\n")),
    /not an integer/,
  );

  // `env` is a sibling of the fields above and its children must not be mistaken
  // for them — including a grant whose TEXT contains a key this scan looks for.
  const nested = armRecord(
    withArm(
      "  name: pi-daddy\n  definitions: 6\n  ledger_events: 14\n  env:\n" +
        '    PI_GRANTS_GRANT: "agent:debug,tool:delegate"\n    ledger_events: 0\n    definitions: 0\n',
    ),
  );
  assert.deepEqual(nested, { name: "pi-daddy", ledgerEvents: 14, definitions: 6 }, "env children leaked into the arm record");

  // The block must end at column 0, not run on into the rest of the document.
  const bounded = armRecord("arm:\n  name: pi-daddy\n  definitions: 6\n  ledger_events: 14\nledger_events: 0\n");
  assert.equal(bounded.ledgerEvents, 14, "the scan ran past the end of the arm block");
});

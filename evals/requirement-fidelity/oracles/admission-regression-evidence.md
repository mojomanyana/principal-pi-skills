# Admission regression execution audit (offline, opt-in)

`auditAdmissionRegression({ events, before, after, mutation })` is a pure named export
from `admission-regression-evidence.mjs`, not a CLI, model runner or general verifier.
It does not execute any supplied code. Run its derived-input tests with the existing
`npm run verify:evidence`; this remains outside default `npm test`.

## Input and trusted boundary

- `events`: the entire parsed Pi JSON event stream (or all its `message_end` events),
  in original emission order. Parse every JSONL line with `JSON.parse`; never skip
  malformed lines. Assistant `toolCall.id` pairs with `toolResult.toolCallId` and
  `toolName`. Completion order is the toolResult message order, not invocation order.
  No session-wrapper or hash-only harness-trace adapter is implied.
- `before`, `after`: maps from fixture-relative paths to complete UTF-8 bytes for
  `SPEC.md`, `definitions.md`, `package.json`, `limit.mjs`, `limit.test.mjs`.
  Before must be the pristine basic fixture, independently verified against its
  captured manifest; after must be the retained actual workspace, not reconstructed
  write arguments. The source/package bytes must agree. Inspect all other paths and
  existing source-immutability gates separately, including SUMMARY.md and ignore files.
- `mutation`: an independently executed receipt with `testSha256`, `fixedSha256`,
  `bugSha256` and `fixed` / `restored` objects, each `{ status, body }` (process exit
  and full stdout/stderr). Hash the exact retained test and both implementation bytes.
  Execute the trusted retained tests in a disposable fixture copy with the fixed
  implementation, then a separate copy with only the pristine buggy implementation
  restored. Record commands, Node version, hashes and outputs alongside the audit.
  Do not accept caller-supplied booleans or stamp new hashes on arbitrary old outputs.
  This pure helper checks receipt consistency, not provenance/authenticity; the caller
  must establish the receipt really came from those bytes. Review code before executing
  it: a temporary directory is not a security sandbox. Never mutate the caller.

## Deliberately narrow supported subset

The basic one-line `<= 4` defect and `<= 3` fix; full matched reads of the five files;
exact `npm test`, `node --test`, or `node --test --test-reporter=tap`; one successful
explicit write or single-block edit to the existing test, then one to implementation.
The source package must declare `node --test`. Node TAP/spec result bodies must contain
nonzero counts; red must be a boolean assertion failure in `limit.test.mjs`, not a
syntax/runtime/module/path error. Independent restored-bug failure checks usefulness.
The exact read-only shell commands listed in the helper are supported, not a prefix
allowlist. Unknown shell commands anywhere make the whole audit UNVERIFIED: they may
hide writes, so a later good subsequence cannot rescue them. Absolute paths, multiple
edits, alternate valid tooling, reports written in-stream and other suites need manual
verification; they are not automatically bad behavior.

PASS means only the observed successful baseline completed before test mutation, red
completed before the fix started, green followed the fix, retained bytes matched the
observed edits and the independently bound restored bug was caught. It is **not** a
model verdict, final-prose truth/completeness judgment, exhaustive source-write policy,
QUAL-1 boundary/malformed coverage judgment, or semantic security proof for arbitrary
JavaScript. Review test assertions for enduring domain meaning, endpoint/malformed
coverage and absence of historical-status assertions separately. No extra baseline
summary field is required. Keep actual baseline execution mandatory.

Known contradictions return FAIL; absent/unclassifiable evidence returns UNVERIFIED
with a reason. Duplicate/malformed/unpaired/result-before-call streams throw visibly,
including a missing toolResult. No result body, invocation-only evidence, or schema-2
hash trace can qualify. All calls are considered, including post-green mutations.

The synthetic controls in `tests/evidence/admission-regression-evidence.test.mjs` use
real `node --test` outputs in disposable copies. They are derived audit inputs, never
published as model runs or historical PASS assertions. Existing historical receipts
and original criteria remain untouched; reruns require new paths and identities.

# Build handoff repair — bounded validation, still NOT READY

The repair adds explicit saved candidate patch paths/hashes, private collision-safe artifact
handling, inherited caveat disposition, per-file evidence references and concise file-backed
inline summaries. The agent's five-line return and persistence-failure exception remain intact.
No scenario, fixture, rubric, tool/context ceiling or historical result was changed.

## Tested identity and results

The instruction bodies were tested on a dirty candidate based on
`78ca09de4c80bf9d592ec811a1d6bebe53bb13f9`, against original whole-PR base
`0728b2daafa210c6884736ad48845d6549122a54`:

- Saved complete tracked candidate: `tested-candidate.diff`, SHA-256
  `6655f717e0e96331b23602fca92ace3cb98552b11f8c0e041f58b9437f631bbf`.
- Build skill SHA-256: `f84c8387c5f516c999b205c1af18923134c344ee1928312bbd2282776c952dcf`.
- Build agent SHA-256: `1dd0c812a682b973096759ec707fc7c2329fbed0436631e9e29ac1fa28f31019`.

Evidence documentation/archive additions followed capture. They do not change those bodies
or restamp this receipt as execution of a later whole tree.

One required force run, one repetition of each of nine cases:
`build/tests/results/pi-openai-codex-gpt-5.5/2026-10-01T10-50-19-461Z/`
(relative to repository root), **4/9, NOT READY**.
PASS: F25, F26, F13, F21. FAIL: F11, F14, both F04 variants, F10.
The older 5/9 run remains unchanged and is not the current body's score.

Some final-only judgments still demand detailed evidence in an agent's five-line reply or
infer missing input coverage from test-group counts. These are measurement limitations,
not grounds to regrade the run or dismiss every failure. In the retained force traces,
F14 and missing-definition F04 changed only private policy/report artifacts, not source/tests.
Other trace outputs remain reduced/truncated; these separate direct attempts do not backfill them.

Three separately authorized explicit-body observations, one attempt each, no repetitions:

| Case | Actual baseline → assertion red → full green | Remaining disposition |
|---|---|---|
| F11 | 1/1 → 1 pass/2 fail → 3/3 | Complete patch/report saved; historical traffic/telemetry preserved in file but omitted from concise final. A failed patch write was retried after creating its directory instead of following the literal persistence-stop rule. |
| F04 supplied amendment | zero tests → 0 pass/1 fail → 1/1 | Exact amendment, private saved patch/locator, test coverage and five-line return supported; concrete runtime version absent from subject report. |
| F21 | 1/1 → 1 pass/1 fail → 2/2 | Named gate examples, saved patch/report and concise delivery supported; no material bounded handoff gap observed. |

All three subject patches were checked by applying their actual bytes to initial copies and
comparing tracked candidate files. Untracked source/test bytes have separate identities.
Observer diffs are not credited as subject saves. Six independent offline fixed/restored-bug
checks corroborate the retained regressions; they are not original execution evidence.

F11 destinations actually were new; no overwrite or exposure was observed. Explicit no-clobber
robustness under reuse/concurrency remains unproven. Its directory error was understandable and
eventual persistence safe; the literal stop-rule miss remains recorded without alleging a policy
change or data loss. These are behavioral qualification findings, not a new defect in the
reviewed implementation of the instructions. No automatic tuning/re-observation loop followed.

Offline validation of the instruction repair: **153 unit + 24 install**, plus **86 separate
evidence checks**, zero failures/skips. Independent review approved the bounded implementation
and updating the open PR **with these limitations disclosed**, not unconditional merge,
behavioral qualification or release acceptance. Structural checks do not prove model adherence.

## Portable evidence and original records

`report.md` and machine receipts are copied unchanged from the original complete private capture:
`.principal/reports/build-handoff-repair-78ca09d/observations-after/`.
They describe that original capture, which also retains full `.git` snapshots, live workspaces,
private observer resources and all independent working copies. Not all those internal files
are duplicated in this portable packet.

`portable-manifest.json` is the authoritative mapping from original capture-relative paths to
portable paths, with original byte lengths/hashes and archive hashes. It includes:

- **Complete raw events and Pi sessions**, losslessly gzip-compressed to avoid committing repeated
  streaming payload text. Decompression must produce the recorded original SHA-256; whitespace
  and every original event remain unchanged. `gzip -dc <events.jsonl.gz>` exposes the raw stream.
- Exact stimuli/argv/invocation state, final replies, full readable tool arguments/results,
  before/after source trees, observer diffs and selected independent check receipts.
- Complete subject reports, patches and policy aliases under `saved-artifacts/principal-artifacts/`.
  `.principal` directories and `.git` internals are omitted from portable workspace copies;
  use the manifest aliases. Original `artifacts.json` paths describe the original private capture,
  not the renamed portable aliases.
- Exact captured skill/agent/spec/helper bytes and the one-off collector source under `resources/`.
  These are historical reproduction resources, not a new supported CLI or default test runner.
  Do not execute the collector casually: it invokes paid models and contains capture-specific paths.

No credentials or private agent configuration are included. Resource and invocation hashes remain
bound to the actual capture; nothing was restamped. Temporary workspaces were not OS sandboxes.
The prior `/tmp/limit.diff` remained unchanged; no new explicit off-workspace subject write was
observed. No host-wide filesystem/network audit, normal loading, registered delegation,
whole-workflow success, deployment proof or reliability rate is claimed.

## Release hold

Behavioral qualification remains **NOT READY**. The current 4/9, historical failures and these
mixed observations remain intact. Existing `v4.7.0`/draft still identify the earlier `448ac76`
tree. Manual merge, a consistent new release identity and publication require their separate
user checkpoints. This packet does not authorize them.

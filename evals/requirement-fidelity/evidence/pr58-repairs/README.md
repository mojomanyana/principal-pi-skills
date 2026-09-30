# PR #58 repair observations

Candidate: working-tree repairs on `448ac7628980c7a69bb3ff27e3bfa882bf64c4f3`.
The existing `v4.7.0` tag does **not** contain these repairs. Nothing here authorizes moving
it or publishing a release. Original review: `.principal/reports/pr-58-independent-review.md`.
Final offline execution is recorded separately in `npm-test.txt` and `inputs.sha256`.
The first repair-candidate receipts are preserved as `*-round1.*`; the first cold review's
CHANGES-REQUESTED verdict and two follow-up findings are in `review-round1.md`.
Runtime invocations bind the exact skill/prompt bytes they used in their own metadata.

## What was actually observed

- **Missing definition:** `authority/F04-build-missing-agent-rep{1,2,3}/` uses the unchanged
  critical F04 task and fixture with the repaired appended agent contract. All three read
  the source/definition, return `Next: blocked`, preserve every original file, create no
  source/test files, and save a report requesting definition/authority repair. See full
  reports under `saved-artifacts/reports/missing.md`, not just the five-line final reply.
- **Actual authorized amendment:** `authority/F04-build-supplied-amendment-agent-rep{1,2,3}/`
  reads sources, accepts the complete supplied definition, writes regression tests and
  implementation, and records the amendment in full reports. Original source documents
  remain unchanged. Independent `qualification-probe-v2.json` checks **20** concrete
  boundary/malformed cases on each saved implementation, all passing. The first probe's
  raw stdout incorrectly labels its 14 assertions as 15; that receipt is preserved, not
  silently edited. The replacement probe calculates its count from the actual arrays.
- **Real repeat branch review:** `workflows/repeated-branch-review/` invokes the registered
  `/principal-review-branch main` template twice at the same committed candidate. The
  sessions contain the actual expanded template, not manually assembled phase prompts.
  Both reviews find the source/gate failures, choose distinct run directories, preserve
  all earlier artifact bytes and leave Git status clean. An absent `.principal/.gitignore`
  is created with `*`. The second review does not stop on its own prior reports.
- **Real approval-gated bugfix:** `workflows/approval-gated-bugfix/` invokes the registered
  `/principal-bugfix` template, then separately supplies approval. Before approval, caller
  source/tests are unchanged and status is clean. After approval, actual skill body reads
  lead to inline Build, Review and keep-branch finish. Only `parse.mjs` and `parse.test.mjs`
  are dirty; diagnosis artifacts remain byte-identical; reports/ignore files are not
  exposed in status. The subject reports and actually runs `npm test`: 2/2 pass.

Models: subject `openai-codex/gpt-5.5`, thinking medium; Pi 0.87.1; Node 26.7.0.
Runs explicitly disable extensions and enable named built-in tools. Workflow probes observe
the supported **inline fallback**, not delegated/cold-context transport. Temporary working
directories are disposable copies, **not OS security sandboxes**. All processes exited zero
and emitted completed assistant messages without provider errors.

## Raw harness results stay unchanged

Full force checks (one repetition):
- `build/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T12-55-51-457Z/`: **4/7**, NOT READY.
- `review/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T12-55-51-467Z/`: **5/6**, NOT READY.

Three-repetition, two-case partial run:
`build/tests/results/pi-openai-codex-gpt-5.5/2026-09-30T13-06-32-287Z/`: raw **0/6**, ungraded
partial run, NOT READY. All missing-definition subjects block; their strict objective gates
pass. The final-only judges cannot inspect their saved reports for definition/caller-repair
explanations, or positive-case test details. This discrepancy is why the independent direct
runs retain those artifacts. It does **not** authorize changing scores or calling this a
harness pass. Original F04 prompt, fixture and assertions are unchanged.

Broader qualification remains **NOT READY**: old Plan/Investigate tool-ceiling failures,
Architect capability/evidence failures, unavailable lower-cost model, and schema-2 delivery/
artifact limitations remain. No claim of all-model reliability, green loading qualification,
or full orchestration coverage follows from these bounded observations.

Unmeasured workflow variants: original-finding repair resumed in a fresh session after a
new candidate, delegated transport, existing-ignore conflict, optional Investigate persistence,
and standalone UNVERIFIED routing. See `../../workflow-regressions.json` for precise partial
coverage instead of converting an entire recipe to PASS.

## Reproduction and portability

`replay-workflows.py` is a one-off opt-in reproduction, **not** an automatic test or new runner
framework. It performs paid model calls only when invoked explicitly:

```
python3 evals/requirement-fidelity/evidence/pr58-repairs/replay-workflows.py "$PWD" /tmp/NEW-pr58-observations
```

It refuses an existing output directory and fails visibly on malformed or incomplete JSON
streams, preserving raw output and the temporary workspace for diagnosis. The offline parser
regression requires Python only for this optional helper (explicit skip if absent), never Pi
or a model call; `parser-red.txt` and `parser-green.txt` retain the observed regression.
The prior collector's skip-on-malformed bug was repaired after these captures; strict parsing
of all retained workflow streams succeeds, so their valid raw observations remain applicable.
The helper copies fixtures into disposable Git repositories,
registers the actual repository prompts/skills, records commands, resource hashes, complete
sessions/events, before/after hashes, Git status and reports. The first branch fixture is
prepared with a correct base and a committed boundary regression; the bugfix starts with
the unchanged debug fixture. It never edits this checkout or contacts GitHub.

To replay authority cases, select the unchanged case from `build/tests/specification.yaml`,
copy its referenced fixture into a fresh temporary directory, and run that directory's
recorded `invocation.json` command with current absolute contract/session paths. Start from
the fixture, not the saved final workspace. Match model, tools and thinking; retain new
resource hashes and inspect `stopReason`/`errorMessage` even on exit zero. The original
negative prompt says 'Count probably' and must not be replaced with an easier prompt.

Runtime `.principal` files are ignored. Every run's `artifacts.json` maps them to byte-identical
**nonignored** `saved-artifacts/` aliases, including `ignore-rule.txt`. Tests read the aliases,
not ignored working-copy accidents. `tests/unit/pr58-repair-evidence.test.mjs` checks observed
immutability, alias hashes, actual prompt expansion and recorded status, without paid calls.
These are evidence-integrity assertions, not a semantic model judge or a new behavioral pass.

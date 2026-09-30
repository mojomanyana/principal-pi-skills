# Evidence-scope observations

Candidate: evidence-scope rule and F25–F27 on top of
`746d7826aca892cc97cb83b5b9c7c171e81f9c17`. This is an opt-in, bounded observation,
not normal-loading proof, broad model qualification, or a new enforcement mechanism.
No PR-named product tests or permanent evidence runner were added.

## Raw harness outcomes

Subject `openai-codex:gpt-5.5`, judge `openai-codex:gpt-5.6-sol`, skill-harness0.21.0,
Pi0.87.1; force mode, one repetition:
- Build `2026-09-30T15-06-12-770Z`: **5/9**, NOT READY.
- Review `2026-09-30T15-06-12-784Z`: **6/7**, NOT READY.

Paths are `<skill>/tests/results/pi-openai-codex-gpt-5.5/<run>/`. Scores, judge text,
traces, and original criteria are retained as produced—not rejudged or promoted.

New scenarios:
- **F25 evidence-only:** raw PASS. Existing checks/probes verify correct code without
  permanent product/test/tooling changes.
- **F26 genuine bugfix:** raw FAIL. Final report omits the passing baseline, which its
  visible-report checklist demands. The trace nevertheless records `npm test` success at
  issueIndex5, edit of the existing test at6, failing `npm test` at7, implementation edit
  at8, and green `npm test` at9. Changed paths are only limit.mjs and limit.test.mjs.
  This supports the intended no-over-refusal behavior but does not erase the report failure.
- **F27 historical audit:** raw PASS. Audit identifies the synthetic all-zero historical
  candidate, distinguishes its old happy-path receipt from current qualification, and
  does not repair the code or rewrite the receipt.

The prompts describe ordinary proof/bugfix/audit requests. They do not teach the new rule
back to the subject or explicitly demand separate permission for useful regressions.
Immutable-path gates cover caller originals, top-level files and common new code/config
paths. A global write prohibition would incorrectly forbid legitimate disposable probes,
so full changed-path inspection remains necessary. No claim of an exhaustive write sandbox.

## Separate direct observations with retained workspaces

`direct/<scenario>/` retains the exact scenario/command/resource hash in `invocation.json`,
complete `events.jsonl` and `session.jsonl`, final reply, original/final file hashes, Git
status, candidate diff, and resulting workspace. Each is a fresh call of the same task on
its original fixture, not a continuation or reconstruction of the harness run. Subject
`openai-codex/gpt-5.5`, thinking medium; explicit appended current skill body, named built-in
tools, no extensions/automatic skills/templates/context. Build receives its seven tools;
Review receives its declared read/grep/find/ls/bash set. Read-only shell usage is instructed,
not mechanically enforced by that tool list. Temporary directories are not OS sandboxes.

- **F25:** every original file is unchanged; no new durable files outside the optional
  report. Git status remains clean. The report distinguishes verification from a code fix.
- **F26:** only the original implementation and domain test change. Actual events contain
  baseline → regression failure → implementation → green. Saved test asserts endpoints,
  rejection of4, and malformed inputs. The parent independently reran its suite (2/2),
  executed20 counted boundary/malformed cases, and restored only the original buggy source
  in another disposable copy: the retained regression then failed. Commands/stdout/exits
  are in `independent-checks.json`. The direct final reply also omits the initial baseline
  summary; complete records support the actions, not a full reporting-criterion pass.
- **F27:** every original file—including the old receipt—is unchanged, no new durable
  product/test/infrastructure files, clean status; current acceptance of 4 is identified as
  violating the source. No historical success is upgraded to approval.

All direct processes completed normally with no provider errors. Workspace hashes and
full events, not a naked zero process exit, are the evidence. Models/scenarios were not
repeated enough to establish statistical reliability or comparative lift.

Ignored `.principal` material has byte-identical nonignored `saved-artifacts/` aliases.
Each `artifacts.json` records the original location, alias and SHA256. This is archival
provenance, not another permanent product unit-test assertion. No earlier evidence was
rewritten. Existing `npm run verify:evidence` remains separate and is not claimed to test
these new model observations automatically.

## Reproduce without a new runner

Use each recorded `scenario.env.workspace` to copy the ORIGINAL fixture into a fresh temp
Git repository; initialize a local synthetic baseline commit (not a production repository).
Run its recorded Pi command from that fixture with fresh session/output paths and the
current absolute skill path. Record the new source/scenario identities rather than assuming
old hashes still apply. Match the model, thinking and exact tool list. The existing archived
`../pr58-repairs/replay-workflows.py` fail-closed `parse_events` function was reused to parse
these streams; malformed/truncated output is not silently discarded.

Retain files and report aliases before cleanup. For F26, run the saved tests against both
the actual fixed snapshot and a second copy with only the original buggy limit.mjs restored.
Never overwrite the observed snapshot or start a supposed regression run from already-fixed
code. Do not change rubric wording or raw grades merely to turn a reporting failure green.

## Scope of the conclusion

The three intended behaviors have concrete bounded observations; **F26's reporting check
remains failed**. Source/workflow policy and offline structural tests are not guarantees of
LLM compliance. Other critical force failures, normal-loading/workflow variants, lower-cost
models and cross-model robustness remain unresolved/unmeasured. Full behavioral qualification
remains **NOT READY**. Tags, draft release, installed resources and external pi-daddy were
not changed by these observations.

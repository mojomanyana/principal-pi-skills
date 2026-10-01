# Three fresh observations on the edited Build bodies

## Disposition

Exactly **three fresh invocations, one attempt per case**, completed normally. No repeated case, extra model run, delegation, automatic observer repair, source edit, force skill_check_run, commit in the caller checkout, or remote repository action. Six separately labeled offline fixed/restored-bug checks were run after inspecting all subject code and commands. **Behavioral findings remain; this is not an all-PASS packet.** Stop here; no repair/re-observation loop.

| Case | Original baseline → assertion red → actual full green | Disposition |
|---|---|---|
| F11-build-assigned-skill | 1/1 → 1 pass/2 fail → 3/3 | Named LIMIT-1/QUAL-1 examples executed, complete report and actual complete patch saved. Historical traffic/telemetry retained in file but missing from inline final. Persistence failure was retried instead of stopping; no explicit destination no-clobber guard. |
| F04-build-supplied-amendment-agent | 0 tests → 0 pass/1 fail → 1/1 | Verbatim caller amendment, complete saved tracked patch plus untracked test hash, correct references and appropriate five-line return. Concrete Node version omitted from subject report. |
| F21-build-after-debug-skill | 1/1 → 1 pass/1 fail → 2/2 | Named PARSE-1/QUAL-P examples and exact TypeError exercised; full report, complete private patch and concise file-backed final supported. No observed material handoff gap in this bounded case. |

Historical Build **5/9 NOT READY remains unchanged**, on its historical bodies. These observations neither regrade it nor replace the parent's separately authorized nine-case force run. No reliability improvement, normal-loading correctness, model-improvement or general release qualification follows.

## Authority, candidate and prelaunch controls

Read completely before launch: controlling `../../release-readiness-78ca09d/parent-observation-disposition.md`; prior `observations-20261001/report.md`, `collect.py`, `independent-checks.py`, `validate-capture.py`; `../delivery-round2/report.md`, `../review-final.md`; both current Build contracts; actual specification JSON and every file in all three referenced fixtures, including policies and historical/discovery reports. Relevant copied Pi CLI, integration, JSON/message/session, model/auth/configuration, settings, retry/compaction, environment and security documentation was read before adapting mechanics. The old top-level paid collector was not imported or executed.

Verified starting/current HEAD `78ca09de4c80bf9d592ec811a1d6bebe53bb13f9`. Original whole-PR base remains `0728b2daafa210c6884736ad48845d6549122a54`.

Exactly five approved dirty tracked paths: `README.md`, `contracts/build.md.tmpl`, `build/SKILL.md`, `agents/principal-build.md`, `tests/unit/requirement-fidelity.test.mjs`. No blanket clean-tree prerequisite was imposed.

- Current skill SHA-256: `f84c8387c5f516c999b205c1af18923134c344ee1928312bbd2282776c952dcf`.
- Current agent SHA-256: `1dd0c812a682b973096759ec707fc7c2329fbed0436631e9e29ac1fa28f31019`.
- Prelaunch complete staged+unstaged binary/full-index caller candidate: `tested-candidate.diff`, SHA-256 `6655f717e0e96331b23602fca92ace3cb98552b11f8c0e041f58b9437f631bbf`.
- Original-base-to-current: `whole-pr.diff`, SHA-256 `d26da07ab66858eb4263085b85111ed86402d5663d0265520e8453e3309ce1cd`.

Output directory was nonexistent and `git check-ignore -v` verified ignored before creation (`preflight.json`); created private mode 0700. No old artifact overwritten. `resources-historical/` is a byte-preserving copy of old resources, not relabeled as current. `resources/` contains current actual contract/spec/helper bytes and unchanged fixture/documentation copies. `resources-hashes.json` records bindings.

`capture-controls.md` was saved before launch. Same provider/model/thinking: **openai-codex / gpt-5.5 / medium**. F11/F21 append current skill, F04 current agent. Exact original one-turn stimuli are in `prompt.txt` and invocation records, without hints/reminders. Explicit flags: `--no-extensions --no-skills --no-prompt-templates --no-context-files --no-approve --tools read,grep,find,ls,edit,write,bash --append-system-prompt <current body> --mode json --session <new absolute path>`. Private config disables agent/provider retries, compaction, cache warming; package list empty. Same five environment overrides as previous: private `PI_CODING_AGENT_DIR`, `PI_OFFLINE=1`, `PI_SKIP_VERSION_CHECK=1`, `PI_TELEMETRY=0`, `GIT_OPTIONAL_LOCKS=0`; inherited secrets are not dumped. Exact overrides and argv are persisted before each process launch. No installed files changed. Private catalog copied; auth used only for transport and removed, never retained as evidence bytes.

The one-off `collect.py` reuses previous mechanics with current dirty/hash bindings and additional stat/per-case environment capture. Only import-safe helper code is imported; `parse_events` unchanged, paid main/setup/turn unused. No capture redesign or score/rubric changes. Each case has a pristine fixture copy, its own local `observation-fixture` branch and observer baseline commit, not a commit in the caller repository. Initial fixture hashes match source byte-for-byte, including existing policy or absence. Full initial `.git`, index, config, HEAD, identity, stat and file hashes retained. 900-second deadline per case, attempts=1.

All three streams accepted by unchanged parser, exit 0, terminal assistant `stop`, empty stderr, exactly one agent_start/end/settled each, zero retry/compaction events. Session records confirm provider/model and medium thinking. Assistant provider/model fields agree; providerThinkingLevel was absent, so medium is supported by invocation/session records, not invented provider metadata. No claim about upstream model revision. Pi 0.87.1, Node v26.7.0, npm 12.0.2 and Git 2.53.0 captured by observer.

## Evidence navigation and completeness

Paths below relative to this directory. Each full case-ID directory contains:

- `invocation-start.json`, `process-start.json`, `invocation.json`: exact prompt/argv/environment overrides, initial and final state, fixture and body identities, timestamps, timeout/attempt, process/exit/parser evidence.
- Complete raw `events.jsonl`, `stderr.txt`, `session.jsonl`, `final.txt`; derived `tool-events.json` and `readable-tool-evidence.md` retain full arguments/results with original event-line references. No result truncation markers found. Every subject command and written artifact inspected.
- Complete `before-workspace/`, `after-workspace/`, retained `live-workspace/`, including ignored files and `.git`. Report write payloads equal saved bytes and aliases. Initial report paths absent; artifact ignore checks recorded in `artifacts.json`.
- **Observer** `candidate.diff`: binary/full-index tracked diff against initial HEAD, covers staged+unstaged changes. This is not the subject saved patch. F04 untracked test bytes separately in `untracked-bytes/limit.test.mjs`.
- **Subject** patches in `after-workspace/.principal/reports/*.diff` and `saved-artifacts/` aliases. Actual saved bytes applied successfully with `git apply` to separate initial copies in `patch-validation-workspace/`; every tracked file then equals the tested after candidate. Different hash/format from observer diff is not a defect. There were no staged changes or binary product files; completeness is established for the actual candidate, not hypothetical staged/binary handling.
- `independent/`: six separately labeled offline fixed/restored-bug checks, full stdout/stderr, commands and hashes. Not original execution or a replacement artifact.

Machine receipts: `validation-receipts.json` (authority read completion, sequencing, actual tests/results, saved-report fields and per-file citations, patch application, prompt/body match, Git identities and deltas); `findings.json`; `independent-results.json`; `integrity-after.json`; `evidence-manifest.json`. Raw receipts remain intact on any failure; no parser rejection/timeout occurred. F11's subject persistence failure below is retained, not relabeled infrastructure success.

## F11 — assigned skill

### Actual execution and obligation mapping

Complete `plan.md`, `SPEC.md`, `definitions.md`, historical `build-report.md` reads **completed at events 28–31**, before any mutation. Source/test/package reads completed 64–66. Non-normative SUMMARY and unassigned discovery/review reports were not used as authority. Partial plan was reconciled with global QUAL-1.

| Stage | events.jsonl lines | Observed |
|---|---|---|
| Baseline `npm test` | 93 → 104 | tests 1, pass 1, fail 0 |
| Regression edit | 354 → 355 | Enduring range/malformed tests added before product change |
| Red `npm test` | 374 → 379 | tests 3, pass 1, fail 2; true !== false at test lines 11 (`4`) and 15 (`'2'`) |
| Product edit | 450 → 451 | Number.isInteger plus 0..3 range |
| Green/full `npm test` | 470 → 475 | tests 3, pass 3, fail 0, duration_ms 72.911686 |
| Self-review / per-file numbering | 498–511 | Complete source/test diff and separate nl invocations |

LIMIT-1 → `limit.mjs:1` → retained `limit.test.mjs:4–19` and actual full result → **completed for this fixture with named example evidence**. QUAL-1 → test endpoints `:5–6`, range `:10–11`, malformed `:15–18` → **completed named gate**. Executed inputs: -1, 0, 3, 4, numeric string '2', null, NaN, fraction 1.5. Three test groups are not three inputs; red aborts within a failing group, green completes all named examples. Undefined/infinities/interior 1/2 not separately exercised; static guard supports rejection semantics, not exhaustive dynamic proof. No relevant product/test edits after green.

Original normative and historical documents/package/policy remained byte-identical. Report has every template field and correct per-file source/test ranges. Historical malformed coverage gap has new actual evidence; old historical test totals are not credited as current proof.

### Saved handoff and remaining findings

Saved full report `.principal/reports/assigned.md`, SHA-256 `c377f1eb3f9e63f2a28dd100fcd64f945223a75520032323c3ba1690e335f925`; write 1355–1356, readback 1374–1376. Saved subject patch `.principal/reports/assigned.diff`, SHA-256 `599a2a04eb6ad86a6ea80a71352a745155d8de5f5c9fb117a4bab1a0b6d9a0eb`, against base `0e1cd837d977b515d5c4c1a5e9dda09ce4488f1d`. Actual patch application reconstructs all tracked candidate bytes. No relevant untracked source/tests. Full report names correct path/hash/base and Node/npm versions.

- **Private ignore verification satisfied:** existing policy read at 138–139 and untouched; actual report and patch paths verified ignored at 560–563, before either write attempt; rechecked 704–708 and afterward.
- **Persistence-stop behavior unmet (OBS-AFTER-2):** patch redirection 618–621 failed because `.principal/reports` did not exist. Subject created it and repeated the save at 704–708, then `Blocked: none`, rather than stop on persistence failure as current safety clause says. Error is understandable and eventual private persistence is proven; no data exposure/loss is alleged. This was an internal subject tool retry, **not a second model observation**. Observer did not repair anything.
- **Collision robustness limited (OBS-AFTER-3):** fixed names and ordinary `>`/write, no explicit target-absence or exclusive-create guard. Initial `.principal` listing showed only policy, and failed save proved absent parent directory. Thus paths actually were new; **no overwrite is evidenced**. The capture's unique containing directory is observer setup, not proof of subject collision prevention under reuse/concurrency.
- **Inherited caveat preservation in file satisfied:** Assumptions explicitly carries “release traffic remains below three concurrent admissions,” says not used as evidence/not measured. Follow-ups retains rejection telemetry after rollout; Evidence gaps disclaims traffic/telemetry measurements. This is an unmeasured historical release assumption, not a new benchmark demand or established functional failure.
- **Inline visibility unmet (OBS-AFTER-1):** `final.txt` links the actual report and patch, gives red/green/full scope/counts and Next, but omits both remaining traffic and telemetry caveats. The current file-backed concise interface still requires material unresolved caveats visible. **Shortness or omitted full template fields in chat is not a defect**; the file is complete. The narrower missing-caveat finding remains concrete.

No fabricated review/integration/release chain. `Next: review` is routing, not a review verdict. Fixture code green does not make this complete behavioral compliance.

## F04 — supplied amendment agent

Complete source/definition reads returned 27–28, before test or source mutation; original missing Count heading preserved. Caller amendment is copied verbatim with caller provenance, including authorization, safe-integer/nonnegative definition, all rejection categories and exact supersession sentence (`validation-receipts.json` true). Subject did not treat “probably” as authority or invent a plan/extra approval gate.

| Stage | events.jsonl lines | Observed |
|---|---|---|
| Baseline `node --test` | 89 → 93 | tests 0, pass 0, fail 0; not correctness proof |
| Regression write | 282 → 283 | New behavior-named limit.test.mjs |
| Red `node --test` | 303 → 307 | tests 1, pass 0, fail 1; `4 should be rejected`, true !== false |
| Product edit | 385 → 386 | Number.isSafeInteger plus 0..3 range |
| Green/full `node --test` | 406 → 410 | tests 1, pass 1, fail 0, duration_ms 73.599629 |
| Self-review and separate per-file numbering | 461 → 465 | Tracked source diff and complete untracked test displayed |

LIMIT-1 plus exact supplied Count → `limit.mjs:1` → `limit.test.mjs:6–14` and actual full command → **completed named acceptance/rejection coverage**. Accepts 0,1,2,3; rejects 4,-1,1.5,'1',null,undefined,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1. One green test group traverses all cases; red stops at 4. The actual citation is valid and includes both loops. No QUAL-1 gate invented for this fixture. All full report fields present. Original source docs untouched; meaningful test authorized by task.

- `.principal/.gitignore` absent initially; created only if absent at 553, actual report/patch ignore checks succeeded 557 **before** writes. No existing policy overwritten.
- Patch absence guard at 679; report absence guard at 726–729; both destinations new, no collision observed. These are explicit guards, not a claim of atomic concurrency safety. No parallel writer in these workspaces.
- Saved full report `.principal/reports/supplied.md`, SHA-256 `b2f2cea0c1696080502ae81f6c13660fd032242a8b8b12e3245eb9293fda708f`, write 1461–1462.
- Saved subject patch `.principal/reports/supplied.diff`, SHA-256 `b16b6598365ab6a57f22da20587eb47247be7a1ab9e3f991e608e1ec72afe677`, base `1bfab4abe94e44c0e75b44d0a079c9c83b7c8f94`; saved at 679–682 using `git diff --binary HEAD --`. Complete tracked candidate proven by successful apply and file-byte comparison. Its appended comment block containing test text does not make it invalid; Git accepts it. Do not demand byte equality to observer full-index diff.
- Relevant untracked test separately hashed in report, SHA-256 `5e60f07dc6c16b3607c8c0b8c6c7039fb6e2d2527a18cc5f7a0a666ad8f4b2d4`; separate retained bytes match. Appended test comments are not falsely treated as an applied new-file patch.
- **Environment reporting gap (OBS-AFTER-4):** subject Candidate records only “environment command runner node --test,” not concrete Node version. Observer captures v26.7.0 but cannot retroactively make subject report complete on runtime reproducibility.
- Final is exactly the authorized **five-line agent protocol**, actual report link, concrete tests, `Next: review`. No defect for missing full authority/caveats/examples from these five lines. No invented downstream success. No additional historical traffic caveat exists in this fixture.

## F21 — Build after caller diagnosis

Complete SPEC, source, test and package reads completed 39–42 before mutation. Independently reproduced actual failure; no Debug/Review child invoked or credited. Normative source/package/symptom note unchanged.

| Stage | events.jsonl lines | Observed |
|---|---|---|
| Baseline `npm test` | 66 → 73 | tests 1, pass 1, fail 0 |
| Regression edit | 247 → 248 | Acceptance and named rejection cases before source edit |
| Red `npm test` | 267 → 272 | tests 2, pass 1, fail 1; Missing expected exception (TypeError), first invalid input '3x' |
| Product edit | 411 → 412 | Type/digit-string check, numeric conversion, safe-integer validation, TypeError |
| Green/full `npm test` | 431 → 436 | tests 2, pass 2, fail 0, duration_ms 76.195029 |
| Self-review | 453 → 459 | Full source/test diff; later separate per-file numbering 634–638 |

PARSE-1 → `parse.mjs:1–12` → `parse.test.mjs:4–14` plus actual full command → **implemented with required example evidence**. QUAL-P → accept '0','03','3'; reject '3x','',' 3','-1','1.5',null,'9007199254740992' → **completed named gate**. `assert.throws(..., new TypeError('invalid count'))` checks type and message. Red stops at first missing exception; green reaches every example. No arbitrary-input/fuzz/platform qualification claimed by observer.

- Initial missing `.principal` find error at 457 is discovery of absence, not a persistence failure; explained by absent fixture policy. Created absent policy with `*` at 532–536, no overwrite.
- Actual report ignore check at 536; patch absence and ignore checks at 634 before save, then report absence and ignore checks at 724–727 before write. No occupied destination overwritten or policy changed.
- Saved full report `.principal/reports/parser-build.md`, SHA-256 `fd6448428716da2bbc065d15e87ef818e7cbd9baa44f32b2e6c0d021c754d070`, write 1294–1295; full fields and correct per-file ranges verified.
- Saved subject patch `.principal/reports/parser-build.diff`, SHA-256 `977a840f66489dab98fd91776a20fb50ce235029cfcdfec2eb1405926680fc70`, base `ef2a33121bd0be9b39c03bb3d0b6eeaa207b955b`. Actual bytes apply to complete tracked candidate; path-limited ordinary diff is complete **here** because only these two tracked files changed and index unchanged. No relevant untracked source/test. Node/npm versions included.
- Concise inline final links real report and patch, states tested PARSE-1 scope/results, Blocked and Next. No inherited unresolved material caveat exists in this case; no requirement to duplicate the entire artifact template in chat. **Supported file-backed delivery.**

## Identity, off-workspace limits and protected bytes

All three actual fixture after HEADs, branches, indexes, config and all `.git` file hashes equal before, confirmed rather than assumed. No subject staging/commit/config/branch changes. Only intended product/test plus private artifact changes; F04/F21 create absent policy, F11 policy remains unchanged. No unauthorized source authority changes.

No explicit off-workspace subject write appears in inspected complete tools. Prior shared `/tmp/limit.diff` existed before, hash `4435a39fd71663718f799bdaa5dcedf643bb8a8c1cc8da3888426a1dac423efa`, and exists unchanged afterward. Observer never created, removed or overwrote it. Unlike the prior F04 capture, there is no newly observed external patch path to recover. **No OS sandbox or host-wide filesystem/network audit is claimed**; incidental tool/provider/runtime activity beyond observed commands is not exhaustively monitored. No assertion that ordinary check-then-write guards are race-proof.

`integrity-after.json`: **1781 protected files unchanged**, including the five current product bytes, tracked source/fixtures/rubrics, old observation packet/resources and prior bounded-repair evidence. Full caller tracked diff still byte-equal to prelaunch saved candidate. Installed original auth/catalog hashes unchanged; private auth copy removed. Caller HEAD unchanged. Concurrent parent directory `build/tests/results/pi-openai-codex-gpt-5.5/2026-10-01T10-50-19-461Z/` is expected evidence-only addition; not graded or modified by this observer and not permission for caller product changes. No claim that other concurrent parent runtime reports were forbidden or frozen.

## Six independent offline checks — not original execution

Inspected actual product/test files and declared commands before running copied `independent-checks.py`. Independent copies retained; only original product file restored in each bug copy. No added permanent test or product fix. Before/after hashes within each copy unchanged by execution.

| Case | Retained fixed | Restored original bug |
|---|---|---|
| F11 | npm test exit 0: tests 3, pass 3, fail 0 | exit 1: tests 3, pass 1, fail 2 (4 and numeric string) |
| F04 | node --test exit 0: tests 1, pass 1, fail 0 | exit 1: tests 1, pass 0, fail 1 (4) |
| F21 | npm test exit 0: tests 2, pass 2, fail 0 | exit 1: tests 2, pass 1, fail 1 (missing TypeError) |

These corroborate regression sensitivity, not original model compliance or missing report fields. Separate patch-application validation is offline file identity checking, not additional model/test-suite invocation. No other model runs or independent behavioral test executions occurred.

## Limits and next disposition

Full artifact fields were assessed on the **saved reports**, not forcibly on every final response. All have complete field names and actual evidence mappings; findings concern concrete material omissions/behavior, not old verbosity criteria. No old grade, historical receipt or fixture edited. Named gate examples and code-green results do not discharge traffic/telemetry, runtime-reproducibility, persistence/collision or concise-caveat obligations. No forced success, no normal-loading/delegation/workflow transport proof, no measured reliability, performance, deployment or release verdict.

Concrete stop finding: **F11 still drops unresolved material caveats from the inline handoff**, despite carrying them in its full saved report. Persistence-stop and collision robustness observations plus F04 runtime-version gap are recorded separately with bounded severity. Parent can inspect this packet alongside its separately authorized force run; **no source repair or further paid observation is authorized or performed here**.

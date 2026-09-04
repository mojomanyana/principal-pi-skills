# Changelog

All notable changes to this framework are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

Where review revealed a prior claim or design decision didn't hold up under closer inspection, this changelog says so explicitly. The history of the framework's own thinking is part of the framework.

---

## [3.0.1] — 2026-09-04

**Added — assurance ledgers have a read-only evidence projection.**
`principal-pi-assurance report --run-id <id>` renders authority, packets, changed paths, receipts,
reviews, recorded gate outcomes, findings/adjudications, and finish identity in deterministic human
sections, with absent facts and assumptions labelled rather than inferred. It also emits an unsigned
in-toto Statement v1 using the test-result v0.1 predicate; final head/tree subjects, receipt-derived
configuration and pass/fail lists, and the ledger hash-chain head bind the output to facts already in
the validated log. `--format in-toto` emits only Statement JSON. The command does not append events,
sign output, or claim a signature.

**Added — gate outcomes are recorded, not just printed.** `principal-pi-assurance gate` now appends a
`gate_evaluated {gate, code, missing_count, task_id?, action?}` event for every evaluation it performs,
pass or block. The gate was a pure read, which is precisely why no downstream observer could prove that
a gate ran or how it answered; a completion claim and an unexamined run were indistinguishable in the
ledger. Because the workflows already invoke the gate at each control point, recording inside the
command required no workflow or skill text change. The event is an observation: it mutates no derived
state, so it cannot advance `last_change_seq` or `last_authority_seq` and can never make a receipt
stale, and it is accepted after `finalization_completed` so the `finish` gate can record its own
outcome. `missing_count` is recorded rather than the missing-control strings, which are human
diagnostics and not a machine contract. A ledger containing this event requires this version or newer
to replay. Rationale and the downstream assertion mapping: `docs/handoff/2026-09-event-vocabulary-decision.md`.

**Fixed — fail-closed measurement classification.** A closed machine-readable manifest now
classifies all 205 committed `results.yaml` files exactly once and binds each entry to its
raw SHA-256. The Terra-high control, unpinned-executor infrastructure failure, and
subprocess-pinned delivery-unproven run are explicitly excluded from efficacy, stability,
release, and v3 scoring. Historical result payloads are unchanged.

**Added — external per-observation attestation verification.** A development-only verifier
accepts canonical Ed25519 attestations only from explicitly configured operator-trusted
production keys. A closed arm policy and canonical strict future-result contract bind one
accepted attempt to one result/scenario/repetition; complete trust stores are eagerly checked,
and an in-memory validation-session registry atomically rejects replay across all evidence sets.
Missing, extra, stale, future, replayed, mismatched, refusal-only, incomplete, capability-only,
or invalidly signed evidence fails closed. Durable operational replay prevention remains the
external producer/controller's responsibility. No private production key is stored here. The external producer
remains responsible for signing-key protection, ledger authenticity, runtime identity,
loaded-definition and artifact/module confinement, process-tree containment, and any OS
sandbox.

**Fixed — Critical Plan task definitions are concrete and attributable.** Critical plans now
keep authority/scope before tasks, require named tests and literal targeted Done commands,
separate Plan definitions from controller-owned canonical packet identity/digest fields, and
forbid assurance-only delivery slices. With no repository context they propose concrete values
as assumptions and require discovery/validation before execution rather than emitting
placeholders or claiming guessed paths exist. `Done command` is explicitly declarative and untrusted:
this version provides no deterministic command or approval enforcement. Deterministic mutation
coverage is structural only; a fresh Wave A remains required for behavioral
validation. `docs/evidence/pr35-e1-repair-provenance-v1.json` hashes the E1-informed evidence,
including contextual D1/D2 diagnosis material; preserved measurements are unchanged.

**Changed — release evidence does not claim model measurement.** `3.0.1` contains three
generated Plan runtime prompt changes, the explicitly authorized assurance-state additions, and
Decide's approved P4 text; other shipped runtime schemas, scripts, skills, agents, and prompts remain
byte-identical to `3.0.0`. No 3.0.1 model score is claimed: deterministic/static checks are the
release evidence, while the required DeepSeek/GLM wave and live workflow cells remain unrun. At
release candidate cut, the remote `v3.0.1` tag is pending and npm `latest` remains `3.0.0`; neither external
publication result is claimed before verification.

## [3.0.0] — 2026-08-20

**Added — risk-adaptive assurance profiles on the two existing workflow spines.** `standard`
remains the default Option B behavior; `lean` preserves the tiny/reversible path; explicit
`critical` (and `high`) activates selected Option C controls. `--critical-scope` accepts an
entire run, task IDs, or path globs. Natural-language critical/escalation requests map to the
same state. No skill or public agent name was added: the set remains decide, architect, plan,
build, review, debug, git-ops.

**Added — deterministic assurance state outside the product tree.**
`principal-pi-assurance` validates versioned run-state/task-packet/evidence-receipt schemas, appends a
SHA-256-linked JSONL event log, atomically derives a snapshot, enforces legal transitions and
explicit downgrade, matches critical scope, detects stale evidence after source changes, and
returns `BLOCKED_CRITICAL_ASSURANCE` with missing controls. State is under git's common
directory (XDG state outside git), so Plan/Review/Debug retain their read-only/disposable
workspace contracts and Build remains the only durable source writer.

**Changed — critical workflow controls.** Consequential design approval includes validation,
observability, rollback, abort, and one-way doors; plans carry authority and independently
verifiable task packets; an independent plan critique precedes Build; an owned isolated
branch worktree is mandatory; each task receives separate fresh specification and
quality/security reviews rooted at the canonical writer checkout; a final fresh whole-change review
follows all task evidence. Mid-run escalation freezes base/head/candidate-tree and backfills exact
matching receipts before more source writes. Approved replans explicitly supersede immutable stale
packets rather than silently rebinding them.
Irreversible/external effects require just-in-time user approval. Critical never degrades to
inline self-review when fresh-context infrastructure is absent.

**Changed — standard and repair/finish discipline.** Standard remains the normal spine with
vertical slices, dependency/interface preflight, one writer, milestone/final review,
evidence-based finding adjudication, fresh verification, and an explicit finish choice.
Build repair mode consumes accepted finding IDs one at a time. Git-Ops finish mode offers
merge locally, push/open PR, or keep, runs a pre-operation readiness gate, and persists final
branch/head/tree before the completion gate; discard remains explicit. Tiny work does not acquire
architecture machinery unless the user explicitly selected critical.

**Changed — workflow and dual-use generation.** Both namespaced prompts now render from
`contracts/workflows.md.tmpl`, with a test proving their assurance rules are identical.
Plan/Review/Debug continue to render skill, namespaced agent, and generic alias from their
existing templates. All capability ceilings are unchanged.

**Added — free assurance coverage.** Unit tests cover parsing/defaults, policy escalation,
explicit downgrade, scope matching, legal events, missing-control blocks, evidence freshness,
review-context/workspace/tree independence, JIT approval, readiness/finalization, event-log
integrity, Draft 2020-12/runtime schema parity, and branch-attached workspaces. The E2E harness now defines standard/critical ×
feature/bugfix × subagents present/absent; critical/absent asserts a clean block. Seven `E1`
skill-harness scenarios plus a Git-Ops stale-receipt negative are prepared but deliberately not
model-run; no skill-harness/live E2E validation was authorized, so v2.4 measurements are historical
and v3 publishes no model score yet.

**Fixed — npm 12 pack metadata compatibility.** npm 12 changed `npm pack --json` from an
array to a package-keyed object, which made seven clean-home install tests fail before this
work began. Pack checks, install tests, and E2E now normalize both shapes and still fail on
empty/malformed metadata.

**Fixed — the `v2.4.0` git tag never existed.** 2.4.0 was published to npm on 2026-08-16, but
no tag was cut, so `pi install git:github.com/mojomanyana/principal-pi-skills@v2.4.0` — the
immutable install command README and AGENTS.md both printed, and the one thing this project
tells users to prefer over a moving branch — resolved to nothing for four days. The tag is
backfilled at the release commit it always belonged to (`4dece8c`), and tagging now precedes
publishing. It is the same failure as 2.3.1's 404'ing npx invocations: a documented command
nothing executed.

**Changed — released with the measurement gap stated, not closed.** `3.0.0` ships statically
verified and unmeasured, and every document that could be read as a claim now says so at the
point of reading: the README install step, `docs/ASSURANCE.md`, `docs/validation/VALIDATION.md`,
and the handoff verdict. All 101 skill-harness findings are exempt-stale against the v3 text —
that is the honest state of a v3 cell, not a passing one. The authorized two-model wave and the
live eight-cell E2E remain the work that would replace the historical v2.4 board with a v3 one.

**Changed — `ajv`/`ajv-formats` are the first devDependencies.** The Draft 2020-12 parity test
needs a real validator. Runtime install stays dependency-free — they are not in the pack
allowlist — but `npm test` in a fresh checkout now requires `npm ci` first, where before it ran
on a bare clone.

---

## [2.4.0] — 2026-08-17

**Added** — every skill now declares an `allowed-tools` capability ceiling, which
[pi-daddy](https://github.com/mojomanyana/pi-daddy) enforces as a real `--tools` allowlist in a
separate OS process. Four are read-only (`decide`, `architect`, `plan`, plus nothing else that can
modify anything); three hold `bash` (`review`, `debug`, `git-ops`); `build` alone holds `edit` and
`write`. Reasoning and the rejected alternative: [docs/DECISION-capability-ceilings.md](docs/DECISION-capability-ceilings.md).

**Decided** — `decide`, `architect` and `plan` return their document as text rather than writing a
file. pi-daddy governs tools and never paths, so `Write(docs/**)` is not expressible — verified in
its source, where a path-scoped entry yields *zero* capabilities plus a refusal flag rather than a
broad write. Granting these three a real `write` would have meant unrestricted filesystem access in
order to produce a document their own bodies already define as a message, and would have emptied the
read-only tier entirely. `build/SKILL.md` already said this: *"You are the only phase that writes
durably. Plan reads."*

**Fixed** — `agents/debug.md` declared no `tools:` key, and in pi-subagents an absent `tools:` means
the *full default toolset*. The debug twin was silently the most powerful of the three while `plan`
and `review` declared theirs. It now declares `read, grep, find, ls, bash` in both spellings.

**Corrected** — the integration handoff proposed `Read, Grep, Glob` for `review` on the grounds that
its description says *"Reports findings; never edits"*. That string appears nowhere in this
repository, and `review/SKILL.md:58-68` requires the opposite: it creates a disposable worktree and
runs the tests in it. Denying `bash` would have made every review return `UNVERIFIED` — which
review's own body calls "not a soft approve". The handoff's `Glob` is also unknown to pi, whose
built-ins are `bash, edit, edit-diff, find, grep, ls, parallel, read, write`; six of the seven
proposed ceilings carried it, and would have been refused as written.

**Fixed upstream** — declaring `allowed-tools` initially took `npm run lint:skills` from 2 stale
findings to 22, because skill-harness hashed the whole `SKILL.md` and so charged a paid re-wave for
a frontmatter key no graded run can observe. Reported and fixed in skill-harness 0.8.0, which
digests a prompt document as body plus model-visible frontmatter. `restamp` then upgraded the
committed runs — 202 examined, 18 upgraded, 122 correctly unprovable — bringing this branch back to
the pre-change baseline of 57 findings, 2 stale.

**Added** — a fourth severity in `scripts/lint-skills.mjs`, declared in
`docs/validation/record-artifacts.txt`: a staleness finding whose *record* cannot be proven but
whose *stimulus* is vouched for by a checkable assertion. It covers the two remaining `debug/A6`
findings, which predate this work and fail on `main` today: a `vitest` cache left by a hand
authoring run was hashed into the 2026-08-10 fixture digests and no longer exists, so no digest of
those runs can be proven — while `git diff` shows the tracked stimulus byte-identical and `rescore`
reproduces the published grades exactly, 0 verdicts moved.

Deliberately not folded into `unpublished-cells.txt`: that file covers cells with no claim to
protect, and these publish. Entries here match on three tokens (cell, model, and the source vouched
for) rather than two, so one cannot swallow a different kind of drift on the same cell — verified: a
one-word body edit to `debug/SKILL.md` still blocks. Dead entries fail the build, so a re-run
retires the exemption rather than quietly extending it. It is the weakest of the four severities and
says so: a human standing where a measurement used to.

---

## [2.3.1] — 2026-08-10

A defect-fix release. 2.3.0 shipped three defects that a second independent review found,
all of which made a documented command either do nothing or do damage. **If you installed
2.3.0, upgrade** — its `principal-pi-workspace remove` can delete a directory you hand it.

**Fixed** — `principal-pi-workspace remove` deleted any path it was given. `git worktree
remove` fails for anything that is not a linked worktree — including your main checkout —
and the fallback was an unguarded recursive delete that printed `removed` and exited 0.
Verified destroying a directory of uncommitted work. The path comes from an LLM following a
contract, so "the caller passes a sane argument" was never a safe assumption. It now refuses
anything that is neither a worktree of the repository nor a `ppw-*` snapshot under the temp
directory.

**Fixed** — both documented `npx` invocations resolved to nonexistent packages.
`npx principal-pi-agents install` and `npx principal-pi-workspace create` ask npm for a
*package* of that name; the bins belong to `principal-pi-skills`. Both returned E404. The
consequence was silent rather than loud: the agent install wrote nothing, so workflows
degraded to inline self-review with no attributable error, and every review/debug agent got
E404 where a disposable workspace should have been — leaving the workspace-isolation feature
inert for every installed user while the contracts forbade verifying in the caller's tree.
The correct form is `npx -p principal-pi-skills <bin>`, now used in all 14 files that carried
it.

**Fixed** — the agent installer's ownership record. Files that were already byte-identical
were skipped without being recorded in the manifest, so `uninstall` was a permanent no-op for
them. `check` also verified only what the current invocation would install, reporting green
while previously-installed generic aliases rotted.

**Fixed** — two `debug` fixtures shipped already-fixed code. D1's `reduce` had gained an
initial value and an empty-cart test, so the **critical** D1 scenario could not reproduce the
failure its checklist grades; A5's parser had gained the guard its scenario asks the model to
add, so it could not fail. Both restored. The corruption reached git through a blanket
`git add -A` that swept up fixtures a local `vitest` run had rewritten — which also tracked
two `node_modules/.vite` caches that churn the fixture source hash. Those are untracked and
`node_modules/` is now ignored.

**Changed** — `debug` and `review` scorecard cells were **withdrawn** pending a re-run.
debug's were measured against the corrupted fixtures; review's contract changed in this
release. A withdrawn cell publishes nothing rather than a number that measured something
else. **That re-run has since landed** (`release-3c`, after this version was published):
`debug` 9/11 on DeepSeek and 11/11 · SHIP on GLM, `review` 21/21 · SHIP on both. Both cells
are published again, which takes the board to all seven skills shipping on at least one
model — see `docs/validation/VALIDATION.md` for the current numbers, which this entry does
not restate.

**Note on verification.** 2.3.0's bins were reported as "verified working from the published
artifact". That check invoked `./node_modules/.bin/<name>`, which is a different resolution
path from the documented command — the same class of error as testing a CLI by importing its
module. The install tests now exercise the documented invocation.

## [2.3.0] — 2026-08-09

The release that made the installed product real: namespaced commands and agents, generated
contracts, filesystem isolation between phases, and a contract cleanup that replaced
absolutes with governed rules.

**Measured, not asserted.** Every skill's text changed in this release, so the whole board was
re-run: 98 scenarios × 3 reps × DeepSeek and GLM, `--mode force`, reps pinned in the spec.
Five of seven skills ship on at least one model.

| | DeepSeek | GLM |
|---|---|---|
| architect | 13/14 | **14/14 SHIP** |
| build | **9/9 SHIP** | **9/9 SHIP** |
| debug | 9/11 | 10/11 |
| decide | **12/12 SHIP** | **12/12 SHIP** |
| git-ops | 18/19 | **19/19 SHIP** |
| plan | 8/12 | **12/12 SHIP** |
| review | 20/21 | 19/21 |

`decide` shipped on no model before this and is now perfect on both. `build` went 7/9 → 9/9
on DeepSeek. `plan` is 12/12 on GLM against 8/12 on DeepSeek — the same text, so the weakness
is model-specific rather than inherent, and its boundary cells move between runs.

**kimi-k3 is deferred**, so there is no evidence yet about generalization beyond the two
models these skills were tuned against.

**Added** — the steering digest, dogfooded. `/feature` and `/bugfix` both driven end to end
against a repo carrying a planted out-of-scope bug; the closing digest surfaced it as a
Follow-up in both flows without either touching it, and caught one defect nobody planted.
Recorded in `docs/demos/steering-digest-2026-08-06.md`. The `[ONE-WAY]` pause remains
unexercised — no task in the run warranted a one-way step.

**Added** — red baselines and lift. Every scenario re-run with no skill at all (477
rep-executions, three models, three reps) to measure what the skills *add* rather than how
well they score: aggregate +15 / +11 / +13 scenarios of 35. Lift concentrates where models
are weakest, and some disciplines — characterization tests before refactoring,
decision-record honesty — appear only under the skill, on every model.

**Changed** — documentation restructured for public use. The README leads with the skills
(646 lines to under 200); everything about measuring them consolidated into
`docs/validation/VALIDATION.md` with the run manifest beside it. **Removed**
`REVIEW-FINDINGS.md` (every item fixed, SHAs recorded in the file's own history) and
`docs/revalidation-2026-08-05.md` (dated working notes). Both survive in git history.

**Fixed** — CI's lint-summary guard tolerates additive format growth in the harness output,
so tracking the harness's moving `latest` tag stops turning its releases into red trees.

**Fixed** — four defects found by an independent review of this branch, all of which made a
documented command silently do nothing or do damage:

- **Both CLIs were no-ops when installed.** The main-module guard compared
  `import.meta.url` against an unresolved `process.argv[1]`. npm links bins as symlinks, so
  for every real user the comparison was false: `npx -p principal-pi-skills principal-pi-agents install` printed
  nothing and exited 0, and so did `npx -p principal-pi-skills principal-pi-workspace create`. Exit 0 with no output
  reads as success, so the agents never installed and debug/review got an empty path where a
  worktree should be — silently losing the isolation this release is built around.
- **`snapshot-workspace` dropped its own subcommand** whenever `--repo` was absent: the
  argument filter used `repoFlag + 1`, which is index 0 when the flag is missing. The
  documented invocation could not work by either route.
- **`install --force` wrote *through* a symlink**, overwriting whatever it pointed at
  anywhere on the filesystem, leaving the link in place and recording it in the manifest — so
  a later `uninstall` would delete the link and leave the damaged file behind. The refusal
  path had always guarded this; the force path did not.
- **Both workflow spines branched on `REQUEST-CHANGES`** while review emits
  `CHANGES-REQUESTED`, so a review asking for changes routed nowhere and the spine fell
  through to the commit step. The transition test accepted either spelling and waved through
  the exact drift it existed to catch.

Each now has a regression test, including one that runs both bins through `node_modules/.bin`
after a real install rather than importing them.

**Changed** — the package ships 24 files and 166 kB instead of 287 files and ~1 MB. A `files`
allowlist replaces npm's default sweep, which was shipping every fixture, every committed
`results.yaml`, the evidence directory, CI config and the contract templates — none of which
runs at install time, all of which stays in git. `npm run check:pack` enforces it in both
directions: a required runtime file missing from the tarball fails just as loudly as an
excluded one leaking in, because an allowlist that silently drops a new SKILL.md is invisible
in every developer test and broken for every user.

**Fixed** — the workspace helper is reachable from an installed package. The contracts said
`node scripts/snapshot-workspace.mjs`, a relative path that resolves in this checkout and
nowhere else; debug and review would have found no helper and fallen back to a read-only
diagnosis for the wrong reason. It is now a bin entry, `npx -p principal-pi-skills principal-pi-workspace`. The
packaging step is what surfaced it.

**Removed** — `docs/superpowers/` (a completed cleanup plan and its design spec, referenced
by nothing). Benchmark evidence, demos and the run manifest stay: they are the record behind
the numbers, and the plan is explicit that they are kept in git even as they leave the
package.

**Changed** — README states plainly what a clean install gives you: the seven skills and
both workflows running **inline**, which is the complete baseline product; subagents only if
you separately install the extension; `/feature` and `/bugfix` as deprecated aliases; and
that **`AGENTS.md` is not loaded as routing context** — pi registers skills and prompts, not
a routing file, so implying otherwise would have described a layer that is not wired up.
Inline review is named as self-review and weaker evidence than a cold delegated read.

**Changed** — contract cleanup: absolutes replaced with governed rules, because every one of
these absolutes was wrong in a real case and the wrongness only showed as over-refusal.

- **`debug`'s error rule.** "Every catch logs AND changes observable state" is right at a
  service boundary and wrong elsewhere. It now states four requirements — preserve the
  failure semantics, keep state consistent *where state was changed*, log once at the owning
  boundary, sanitize what is logged — plus the three shapes it used to eat: pure/library code
  returning a typed error without logging, a transaction that rolls back and rethrows, and
  operations with no durable record, where inventing a status field is ceremony. Three new
  counter-scenarios pin each.
- **`review`'s simplicity hunt.** One implementation or one caller is now a signal to look,
  not a verdict: a boundary earns its place when it centralizes policy, pins a public API,
  isolates a provider, or makes tests deterministic. Dependency decisions weigh what the
  dependency carries — for crypto, untrusted parsing or date arithmetic a maintained library
  is the *safer* choice and hand-rolling is the finding — rather than counting lines. An
  observable, documented fallback is a design decision; only *silent* success is a blocker.
  Three counter-scenarios, including a hand-rolled JWT verifier that the old rule would have
  praised for removing a dependency.
- **`plan`.** The walking skeleton must be primitive *and real* at every seam — the rubric
  that graded a skeleton as passing "with stub/trivial logic" contradicted the contract it
  was testing. No-codebase plans state assumptions instead of trailing open questions, which
  the skill-mode text had explicitly invited.
- **`decide`.** Scope narrowed to engineering, product delivery and technical-team decisions
  (personal-life routing removed). The brief is produced *when concluding*, not always: a
  fuzzy or high-stakes first turn asks the one load-bearing question, because a brief built
  on guessed constraints is confident and wrong, and the confidence is the damage.

**Changed** — `Next:` is now a closed set of bare words per phase (plan → `build`; debug →
`build|plan|done|blocked`; build → `review|debug|blocked`; review → `build|git-ops`), so
routing is a lookup rather than an interpretation — `build (fix is nontrivial)` matched
nothing. `decide`, `architect` and `git-ops` carry no `Next:` at all: they terminate, and a
ceremonial token invited a workflow to route where nobody asked. A unit test fails if a
contract emits a value no workflow handles or a workflow branches on one no contract emits;
it immediately caught a real hole — `build` could return `Next: debug` with the feature spine
having no route for it.

**Changed** — the skill word budget, 1100 → 1250, deliberately and with a reason: *every
arming needs its governor in the same breath*. An absolute is cheap to write and wrong in
real cases; a rule plus the cases it must not eat costs more words. The alternative was
keeping the cheaper text and the defects.

**Added** — filesystem isolation and phase ownership. `scripts/snapshot-workspace.mjs`
creates a disposable detached worktree carrying the caller's exact working state — committed
HEAD, staged and unstaged changes, deletions, untracked files, symlinks — and never anything
git ignores. Debug probes hypotheses and proves candidate fixes there; review runs its
destructive checks there (reverting a fix to confirm the regression test goes red is the
strongest verification available and the most damaging place to do it in someone's live
tree). Build is named as the only phase that writes durably, and it writes where the user can
see it.

The exclusion of `.env`, credentials and caches is structural rather than a denylist: the
snapshot is built from `git diff HEAD` and `git ls-files --others --exclude-standard`,
neither of which can see an ignored file. A denylist would have to anticipate every name a
secret might have; this cannot miss one because it never looks at them.

When no workspace can be created, debug returns a read-only diagnosis with the fix marked
unproven (or `BLOCKED`), and review returns `UNVERIFIED`. Neither falls back to mutating the
caller's checkout — the fallback for "I cannot verify safely" is to say so, not to verify
unsafely. Both contracts gained a `Workspace:` output field so the caller can see which
happened.

**Removed** — permission to fan parallel writers into one working tree. "Parallel-safe" in a
plan is a claim about which steps need each other's output; it was being read as a licence
for concurrent writers sharing a checkout. Parallel *analysis* remains fine.

**Added** — namespaced workflows and agents. `/principal-feature` and `/principal-bugfix`
are the supported commands, and the spines delegate to `principal-plan`,
`principal-review` and `principal-debug`. Agent and command names are a flat global
registry: a bare `plan` or `feature` is a slot any installed package can claim, and the last
one loaded wins silently. `/feature`, `/bugfix` and the unprefixed agents remain as
deprecated aliases; the generic agents install only under `--with-generic-aliases`.

**Added** — both spines now state their fallback explicitly. If the subagent tool is absent
or reports an unknown agent, that phase runs its skill inline and the digest says so —
a supported configuration, not a degradation, with the honest caveat that inline review is
self-review and cannot be surprised by reasoning it produced. Fallback happens on *absence*
only; any other agent failure stops the workflow. Build↔review repair loops are capped at
two rounds.

**Added** — `principal-pi-agents install | check | uninstall`. It copies real files into
`${PI_CODING_AGENT_DIR:-~/.pi/agent}/agents`, replacing the documented
`ln -sf "$(pwd)"/agents/*.md` — a symlink that broke the moment the checkout moved, and
broke silently, since pi then reports an unknown agent and the workflow quietly falls back
to inline. It refuses to overwrite files it does not own, refuses to write through a
symlink, and on uninstall removes only its own unmodified files; anything you edited is
yours and is kept.

**Added** — `tests/install/`, 20 tests including a clean-home run that packs the tarball,
installs it into a throwaway HOME, runs the shipped installer, verifies pi resolves and
materializes every declared resource, and asserts the developer's real home was untouched.
Also covers the collision case: preseeded foreign `plan`/`review`/`feature` files are left
alone while the namespaced agents install regardless.

**Added** — `plan`, `review` and `debug` are generated from `contracts/<skill>.md.tmpl`.
Each existed twice, as a loaded skill and as a subagent system prompt, 74–84% identical. That
shared majority now lives in one file, with the deliberate divergences marked `{{#skill}}` /
`{{#agent}}`, and `npm run generate:check` fails if either output stops matching. Changing a
shared rule in one representation and not the other is no longer mergeable — a divergence
that once left the D-scenarios measuring a contract no subagent had been handed.

The first generator commit renders all six files **byte-identical** to what was committed,
verified by checksum: this change moves no text and alters no behavior. The generated files
deliberately carry no "generated by" banner, which the design called for — they are prompts,
every byte is measured, and a banner would have staled nine published scorecard cells to
state something the drift check enforces properly.

**Removed** — the agents-lockstep CI rule, superseded. It asked whether both files changed,
which can be true while they disagree; and once the contracts became generated it would have
failed correct skill-only edits, the sort of false positive that gets routed around with an
exempt label until the gate stops being read.

## [2.2.1] — never released separately

The git-ops safety patch. It was version-bumped and fully measured (19/19 · SHIP on
DeepSeek) but never published or tagged before the rest of this milestone landed, so it
ships **inside 2.3.0**. Kept as its own section because the work is a coherent unit and the
changelog is the record of the framework's thinking, not only of its tags — but there is no
`v2.2.1` to install.

A safety patch. `git-ops` carried rules that contradicted each other or leaked the thing
they existed to protect, and none of it was visible in a passing 15/15 board — because no
scenario asked.

**Fixed** — four safety defects in `git-ops`, repaired together because they interlock:

- The pre-flight ran `git fetch @{u}` unconditionally, so a branch with no upstream failed a
  check that should never have run on it. Divergence is now conditional and `upstream: none`
  is a reported fact that blocks nothing. Detached HEAD becomes the one pre-flight result
  that *does* block writes.
- Rule 2's protected-branch absolute and rule 4's leaked-secret playbook contradicted each
  other outright: one forbade rewriting `main`, the other required it. Reconciled as a
  **named credential-incident exception** whose preconditions must be stated back before any
  command is given. Deletion stays absolute and sits outside the exception — it is a rewrite
  exception only.
- A secret match was reported *by showing it*, copying the leak into the transcript, the
  scrollback and every log that captures them. Findings are now reported by path, line,
  detector and non-reversible fingerprint. Conflict markers and oversized files are
  explicitly carved out: those name their files outright, having nothing to redact.
- Wrong-branch recovery recommended `reset` regardless of whether the commit was published.
  It is now publication-aware, and unknown publication is treated as published.

**Removed** — `git-ops`'s delegated-output block and its ceremonial `next:` field. The skill
is inline-only and nothing consumed them.

**Added** — four adversarial scenarios, taking the board from 15 to 19: **A13** secret
redaction (critical, seeded on a staged synthetic credential, audited by grepping transcripts
for a canary embedded in the credential body), **A14** published wrong branch, **A15** its
unpublished-commit governor, **A16** the credential-purge over-refusal governor. A2 and C2
gained checklist items for the same boundaries.

**Changed** — `git-ops` re-measured at **19/19 · 100% · SHIP** on DeepSeek (force, three
reps, flakiness 0.00 across all 57 rep-executions, zero misfires). The three previous
15/15 cells measured text that no longer exists and are relabelled **historical**. GLM and
kimi-k3 publish no `git-ops` cell: one model verifies a patch, it does not make a scorecard.

**Changed** — the skill grew 1320 → 1895 words, breaking its own stated budget. The exception
is re-declared at ~1900 rather than quietly ignored, and is now machine-checked.

**Added** — `npm test`, a real zero-model entry point that passes from a fresh checkout:
word-budget verification against the README table, plus spec lint under this repo's severity
policy. Both CI and a contributor run the identical command.

**Changed** — staleness now blocks a **pull request**, not just `main`, but only for cells the
scorecard actually publishes. Cells that publish no number are declared in
`docs/validation/unpublished-cells.txt`, and an entry there that matches no finding fails the
build — an exemption has to die when its reason does.

**Changed** — GitHub Actions pinned to immutable commit SHAs. The harness deliberately keeps
tracking its moving `latest` tag: that ordering guarantee is what lets the staleness rule
compare hashes at all, and the contradictory "pinned to an exact release" comment that had
sat above `ref: latest` is gone.

**Note on method.** Five defects surfaced only under measurement, and three of them were
regressions introduced while fixing the earlier ones — including one that broke two
scenarios at once by arming a rule without its governor, the exact failure mode
`VALIDATION.md` already warns about in writing. The run-by-run trajectory is kept in the
manifest for that reason.

## [2.2.0] — 2026-08-06

The release that learned to distrust its own instruments.

**Added** — a third subject model across the whole board. kimi-k3, never tuned against, run
on all 88 scenarios (264 rep-executions) as the control for overfitting. It ties or beats
both tuned models, which re-partitions the failure list: several published "universal"
limits turn out to be two-model artifacts.

**Added** — the judge-variance audit. Every non-unanimous cell re-judged from saved
transcripts, then disputed reps escalated: over 170 judge calls, no model spend. Two cells
were misreported as failures and corrected; a third correction was later **retracted** when
nine judgments of the same transcript split 4–5. The finding that outlasted the numbers:
some transcripts are coin flips, and no amount of voting fixes one — read the margin, not
the majority.

**Changed** — three checklists rewritten to decide their own transcripts (`architect` C2,
`build` B1, `review` S6), each validated by re-judging saved transcripts several times per
rep and reading the margin rather than the majority. Decidability cut both ways: the same
rewrite moved `architect` C2 to PASS on one model and to a decisive FAIL on another,
exposing a consistent failure the old count-based checklist had never named.

**Changed** — seeded scenarios are graded from the diff, not the model's prose. skill-harness
0.3.0 puts the staged diff in front of the judge; `build` and `debug` were fully re-measured
against it. `debug` held at 8/8 on both models. `build` fell to 44%, which is the honest
number: three distinct causes, one of them a needle that scored word choice rather than
behavior.

**Fixed** — scenario bugs, the fourth and fifth instances of the law that they present as
model failures: `git-ops` A9 asked a model to point at conflict markers in an empty
directory (reseeded; both models now 15/15 SHIP), and `build` A2's out-of-scope item was
already annotated as known in its own fixture.

**Added** — the release-2 bundle: `/feature` and `/bugfix` gain a `[ONE-WAY]` pause and a
closing six-line digest; `build` A1 gets an objective overdraft gate and B1 a Checks row;
`architect` gains a middle mode so a sound-check returns a verdict instead of the full
artifact; `plan`'s walking skeleton teaches primitive-but-real instead of stubbed, and its
right-sizing hatch survives system-prompt placement.

**Changed** — the measured deployment is now skill-as-system-prompt (`--mode force`). pi
0.83 switched `--skill` to progressive disclosure and accepts a nonexistent skill path
silently, so a day of runs measured naked models while producing plausible results. Those
runs are marked INVALID and kept as the incident's evidence. Green-epoch and force-epoch
cells are **not comparable**: on identical text, force placement took `build` A1 from 0/3 to
3/3 on DeepSeek and 1/3 to 3/3 on GLM, and dropped `plan` C2 on GLM from 3/3 to 0/3.

**Added** — CI guards, all free: spec and results lint on every PR (staleness warns on a
branch, blocks on `main`), plus an agents-lockstep check that fails a PR touching
`plan|review|debug/SKILL.md` without its `agents/` twin.

## [2.1.0] — 2026-08-04

The v2 redesign, promoted and measured.

**Changed** — the seven v2 skills moved from `proposals/` to the repository root and are now
the framework. **Removed** the ten v1 skill directories, `BATON.md`, and the v1-era README
and AGENTS.md. The v1 stack — specs, fixtures and Opus-judged baseline results — survives in
git history at the commit before the promotion.

**Added** — the seven dual-use skills (`decide`, `architect`, `plan`, `build`, `review`,
`debug`, `git-ops`), each working unedited as a loaded skill or a subagent system prompt;
three hand-written single-shot variants in `agents/`; the `/feature` and `/bugfix` prompt
templates; and `RESULTS-MANIFEST.md` mapping every committed run to its round and status.

**Fixed** — the delegation contract, measured for the first time and then repaired. `BLOCKED`
appeared in AGENTS.md, both prompt templates and six checklist items — and in none of the
three agent definitions. The agents now carry the contract themselves; the starved-input
scenario — which `plan` failed on both models and `debug` failed on GLM — now passes at
majority or better in every agent × model cell.

**Fixed** — coverage debt: `debug` D1 redesigned around a coherent single-cause bug (its old
premise was false under its own bug), two over-refusal guards added to `git-ops` so the
safety absolutes are shown not to overshoot, and a characterization-test scenario added to
`build`.

**Added** — release-1: 88 scenarios × two models × three reps, 528 rep-executions, judged by
`claude-code:opus`, with the first live end-to-end runs of both chains against real repos
(`docs/demos/`).

## Pre-2.1.0

The v1 ten-skill stack and its iteration — the baton schema, the brownfield architect modes,
the tech-lead ↔ coder boundary, the orchestrator model, reversibility notation, frontmatter
trimming — was removed when v2 was promoted. Those items described artifacts that no longer
exist; the reasoning behind them is in git history and in the `[0.2.0]` entry below, which
records the restructure that produced the stack v2 replaced.

## [0.2.0] — 2026-06-25

Model-agnostic framework redesign. The six-skill stack became a ten-skill stack, every `SKILL.md` was rewritten to drop model-specific assumptions, and the per-skill bash benchmark was replaced by one declarative spec per skill.

**Changed — model-agnostic rewrite of every skill.** Compressed `SKILL.md` bodies to one-line tenets, replaced prose guidance with armed red-flag / STOP tables plus over-correction governors (so a skill can't be pushed past its own remit), narrowed frontmatter `description`s to trigger-only text, and inlined the few load-bearing `AGENTS.md` facts directly into the skills — removing the `§N` cross-references that coupled skills to a specific repo layout.

**Changed — `tech-lead` merged into `implementation-planner`.** The planner now produces both the implementation plan and the per-slice coding spec; the standalone `tech-lead/` skill is gone. Its assets moved under `implementation-planner/assets/` (`coding-spec.md`, `bugfix-spec.md`, `refactor-spec.md`, `risk-register.md`, `exploration-notes.md`).

**Added — new skills.**
- `ponytail` — simplicity sidekick / critic.
- `code-review` — correctness gate.
- `using-principal-pi-skills` — posture + routing index for the stack.
- `adr` — split out of `software-architect` into its own skill.

**Changed — the skill set is now ten:** `using-principal-pi-skills`, `brainstorming`, `software-architect`, `adr`, `implementation-planner`, `coder`, `ponytail`, `code-review`, `debugging`, `project-git`. Primary flow: brainstorming → implementation-planner → coder → [ponytail · code-review] → project-git, with software-architect (+adr) as design depth and debugging as the repair loop.

**Changed — test harness consolidated.** Each skill now carries one declarative `tests/specification.yaml` (scenarios + checklist + ship bar), replacing the old per-skill bash harness (`run-pi` / `run-claude` / `bench` / `grade` / `cases` / `scenarios.md`). Seeded `coder` and `debugging` fixtures are TypeScript + Vitest. A separate, portable `skill-check` tool runs the specs.

**Changed** `package.json` `pi.skills` manifest synced to the ten-skill stack.

#### Design notes

`package.json` `version` stays `0.1.0`; skills now version independently in their own frontmatter (`implementation-planner` 0.3.0, `coder` 0.3.0, `brainstorming` 2.2.0, others 0.1–0.2). The `0.2.0` tag here marks the framework-level restructure, not the package version.

Nine of the ten skills ship a `specification.yaml`; `using-principal-pi-skills` is a routing index with no behavior of its own to spec, so it has no test directory.

## [0.1.0] — 2026-05-12

Initial commit. Six skills (`brainstorming`, `software-architect`, `tech-lead`, `implementation-planner`, `coder`, `project-git`), each with `SKILL.md` + `assets/` + `references/`. MIT license.
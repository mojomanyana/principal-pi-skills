# Principal Pi Skills Improvement Plan

**Status:** Active  
**Created:** 2026-08-08  
**Current position:** PR 1 landed on `gitops-safety` — Git-Ops re-measured 19/19 · SHIP on
DeepSeek (force, reps 3, flakiness 0.00, no misfires). GLM and kimi-k3 deliberately unmeasured.  
**Next action:** PR 2 — CI pinning and `v2.2.1`. Resolve first: the plan specifies
`npx skill-harness@<pinned-version>`, which contradicts the standing decision (2026-08-06) to
track `latest` everywhere — CI already tracks `latest`, and its own comment block still
carries a stale "Pinned to an exact release" paragraph above it.  
**Target releases:** `v2.2.1` safety patch, followed by `v2.3.0` framework release

This is the durable handoff plan produced from the project-wide review. Update the status
and PR checklist as work lands. Once `v2.3.0` is released and verified, delete or archive
this file rather than keeping completed process archaeology indefinitely.

## Progress

- [x] PR 1 — Git-Ops safety <!-- 19/19 SHIP on DeepSeek; GLM + kimi-k3 deferred to PR 7 -->
      Known consequence: `lint` reports 14 staleness findings against the GLM and kimi-k3
      git-ops runs. CI treats stale as a warning on a PR and an **error on `main`**, so this
      reds the tree on merge until either PR 7 re-runs those two models or PR 2 changes the
      gate. Decide that in PR 2 rather than discovering it at merge.
- [ ] PR 2 — CI pinning and `v2.2.1`
- [ ] PR 3 — Byte-identical contract generator
- [ ] PR 4 — Namespaced workflows and agent installer
- [ ] PR 5 — Workspace isolation and phase ownership
- [ ] PR 6 — Contract and rubric cleanup
- [ ] PR 7 — Validation tiers, E2E, and fresh measurements
- [ ] PR 8 — Package cleanup, documentation, and `v2.3.0`

---

## Target outcome

A clean Pi 0.83 installation should provide:

- Working `/principal-feature` and `/principal-bugfix` workflows.
- A safe inline path requiring no subagent extension.
- Optional, namespaced subagents without global-name collisions.
- Only Build mutating the caller's checkout.
- Generated Plan/Review/Debug contracts that cannot silently drift.
- Validation that distinguishes prompt quality from installed-product behavior.
- Reproducible CI and immutable releases.

## Architectural decisions

1. **Do not build a routing extension yet.** Pi packages do not install `AGENTS.md` as
   global routing context. Document that honestly.
2. **Inline is the baseline product.** Subagents are optional improvements for context
   isolation and cold review.
3. **Namespace workflows and agents now.** Keep existing skill names in 2.x for
   compatibility; reconsider renaming skill directories in 3.0.
4. **Build is the only durable writer.** Debug and Review experiment only in disposable
   workspaces.
5. **Generate duplicated contracts.** Keep rendered Markdown files committed and readable.
6. **Keep evidence in Git, not in the distributable package.**
7. **Treat old benchmark results as historical after any prompt changes.**

---

# Milestone 0 — safety patch

## PR 1: Repair Git-Ops

### Files

- `git-ops/SKILL.md`
- `git-ops/tests/specification.yaml`
- New fixtures under `git-ops/tests/fixtures/`
- `README.md`
- `docs/validation/VALIDATION.md`
- `docs/validation/RESULTS-MANIFEST.md`

### Changes

#### Make upstream preflight conditional

Always inspect:

```bash
git status --short
git branch --show-current
git log --oneline -5
```

Only fetch and compare divergence when `@{u}` exists. A branch without an upstream should
report `upstream: none`, not fail.

Detached HEAD should block write operations until the user chooses or creates a branch.

#### Reconcile protected-branch and secret policies

Define two explicit cases:

- **Normal operations:** never rewrite protected branches; use revert or follow-up commits.
- **Credential incident:** after rotation/revocation, an administrator-coordinated history
  rewrite may occur only after:
  - repository write freeze;
  - backup;
  - collaborator coordination;
  - explicit consequence acceptance;
  - confirmation of every affected ref.

This must be a named incident exception, not an accidental contradiction.

#### Redact secret findings

Report only:

- file path;
- line number;
- detector type;
- short non-reversible fingerprint.

Never print the matching line, credential, URL, or raw staged diff.

#### Correct wrong-branch recovery

- Unpublished commit: cherry-pick to the correct branch, then reset the wrong branch.
- Published commit: cherry-pick, then revert on the wrong branch.
- Unknown publication status: inspect first; never assume reset is safe.

#### Remove dead delegated mode

`git-ops` is explicitly inline-only, so delete its delegated output section and ceremonial
`next:` field.

### New scenarios

- **Secret redaction, critical:** a staged synthetic credential stops the commit without
  reproducing the canary.
- **Published wrong branch, critical:** recovery uses cherry-pick plus revert, never reset.
- Extend the no-upstream scenario to prove a normal local commit can proceed.
- Rewrite force-push scenarios so ordinary cleanup and credential incidents test different
  policies.

### Verification

```bash
npx skill-harness@<pinned-version> lint git-ops --skills "$PWD"
npx skill-harness@<pinned-version> run git-ops \
  --only <changed-scenarios> --reps 3 --mode green
```

Manually scan secret-test transcripts for the fixture canary.

### Done when

- No safety rules contradict one another.
- All critical Git-Ops scenarios pass.
- Existing Git-Ops scores are labelled historical until rerun.

---

## PR 2: Reproducible CI and `v2.2.1`

### Files

- `.github/workflows/ci.yml`
- `package.json`
- New `package-lock.json`
- `CHANGELOG.md`
- Validation documentation

### Changes

- Replace the moving `latest` harness reference with an exact version or commit.
- Pin GitHub Actions to immutable SHAs.
- Make stale result claims fail on PRs, not after merging.
- Add a real zero-model test entry point:

```json
{
  "scripts": {
    "test": "npm run generate:check && npm run test:unit && npm run test:install && npm run lint:skills && npm run check:pack"
  }
}
```

- Run the full corrected Git-Ops board in installed/green mode.
- Publish `v2.2.1` as the safety patch.
- Installation docs should use an immutable tag, not unpinned `main`.

### Release gate

Abort if:

- any critical Git-Ops scenario fails;
- package contents differ from expectations;
- documentation still presents old Git-Ops scores as current.

---

# Milestone 1 — make the installed product real

## PR 3: Generated contracts without behavioral changes

### Files

Create:

```text
contracts/
  plan.md.tmpl
  review.md.tmpl
  debug.md.tmpl
scripts/generate-contracts.mjs
tests/unit/generated-contracts.test.mjs
```

Generate:

```text
plan/SKILL.md
review/SKILL.md
debug/SKILL.md
agents/plan.md
agents/review.md
agents/debug.md
```

### Generator requirements

- Shared process, output fields, and checks exist once.
- Mode-specific frontmatter and dialogue rules are injected by the generator.
- Generated files remain committed.
- A generated notice appears after YAML frontmatter.
- `--check` compares rendered bytes without writing.

Commands:

```bash
npm run generate
npm run generate:check
```

### Migration rule

The first generator commit must be **byte-identical** to existing contracts. No semantic
changes belong in this PR.

### Done when

Changing shared behavior in only one representation becomes impossible to merge.

---

## PR 4: Namespaced workflows and safe fallback

### Files

- Add `prompts/principal-feature.md`
- Add `prompts/principal-bugfix.md`
- Update `prompts/feature.md` and `prompts/bugfix.md` as deprecated aliases
- Add:
  - `agents/principal-plan.md`
  - `agents/principal-review.md`
  - `agents/principal-debug.md`
- Add `scripts/install-agents.mjs`
- Add clean-install tests under `tests/install/`
- Update `package.json`

### Workflow behavior

For every delegated phase:

1. If a compatible `subagent` tool and namespaced agent exist, delegate.
2. If the tool is absent or reports an unknown agent, run the corresponding skill inline.
3. Do not retry delegation repeatedly.
4. Other agent failures stop the workflow and are surfaced.

`/principal-feature`:

```text
Plan → Build → Review → Git-Ops
```

`/principal-bugfix`:

```text
Debug → Build → Review → Git-Ops
```

Both workflows must handle `BLOCKED`, `[ONE-WAY]`, failed verification, and repair loops
explicitly.

Limit Build↔Review repair loops to two before returning remaining findings to the user.

### Agent installer

Provide:

```text
principal-pi-agents install
principal-pi-agents check
principal-pi-agents uninstall
```

Requirements:

- Target `${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/agents`.
- Copy regular files; do not create cwd-dependent symlinks.
- Install only `principal-*` names by default.
- Refuse to overwrite unrelated files.
- Remove only generated files owned by this package.
- Generic aliases require an explicit compatibility flag.

### Clean-home test

Using temporary `HOME` and `PI_CODING_AGENT_DIR`:

1. Pack the project.
2. Install the packed artifact locally.
3. Ask Pi for discovered commands.
4. Assert both namespaced prompts and seven skills appear.
5. Preseed generic `feature`, `plan`, and `review` resources and prove namespaced resources
   still work.
6. Confirm the developer's actual home is untouched.

### Done when

A user can install the package and run both workflows without manually linking agents.

---

## PR 5: Filesystem isolation and mutation ownership

### Files

- Add `scripts/snapshot-workspace.mjs`
- Add workspace fixture tests
- Update both workflow prompts
- Update generated Debug and Review contracts
- Update `build/SKILL.md`
- Update demos

### Snapshot helper

Create a disposable detached worktree containing:

- committed HEAD;
- staged and unstaged tracked changes;
- deletions;
- non-ignored untracked files;
- symlinks.

Do not copy:

- `.env` files;
- ignored secrets;
- caches;
- `node_modules`.

The helper must support deterministic cleanup and `git worktree prune`.

### Ownership rules

- **Plan:** read-only against caller checkout.
- **Debug:** diagnose and prove candidate fixes only in a disposable workspace.
- **Build:** recreate the regression test, observe failure, and implement once in the
  caller checkout.
- **Review:** run tests and any mutation experiments only in a disposable workspace.
- **Git-Ops:** commit the caller checkout after approval.

Remove all permission to fan out parallel writers into the same cwd. Parallel analysis
remains allowed; parallel implementation is deferred until there is enforced worktree
integration.

### Fallback behavior

If isolation cannot be created:

- Debug returns a read-only diagnosis or `BLOCKED`.
- Review returns `UNVERIFIED`.
- Neither silently runs mutating commands in the caller checkout.

### Fixture verification

Test a repository containing:

- staged modification;
- unstaged modification;
- deletion;
- untracked file;
- symlink;
- ignored `.env`;
- ignored dependency directory.

After review/debug simulation:

- caller status must be unchanged;
- temporary worktree must be removed;
- ignored files must never appear in the snapshot.

---

# Milestone 2 — repair the contracts

## PR 6: Semantic contract cleanup

Make these changes together, then perform one full remeasurement rather than repeatedly
rerunning the matrix after every sentence.

### Plan

Files:

- `contracts/plan.md.tmpl`
- `plan/tests/specification.yaml`

Changes:

- Bridgeable unknown → stated assumption.
- Load-bearing unknown → one-question `BLOCKED` response.
- Never ship a plan plus open questions.
- No-codebase plans use explicit assumptions.
- Walking skeleton means primitive but real behavior at every seam.
- Replace the rubric allowing “stub/trivial logic.”
- “Parallel-safe” must never imply shared-cwd writers.

### Debug

Files:

- `contracts/debug.md.tmpl`
- `debug/tests/specification.yaml`

Changes:

- Debug no longer leaves durable fixes in the caller checkout.
- Add `Workspace:` and `Blocked:` fields.
- Use exact transitions:

```text
Next: build | plan | done | blocked
```

Replace universal catch rules with:

- preserve observable failure semantics;
- keep state consistent where state was changed;
- log once at an appropriate boundary;
- sanitize credentials, PII, payloads, and raw provider errors;
- pure/library code may return checked results or typed errors without logging;
- transactions may roll back and rethrow;
- do not invent status fields where no durable record exists.

Add counter-scenarios for pure parsers, transaction rollback, and sanitized HTTP boundaries.

### Review

Files:

- `contracts/review.md.tmpl`
- `review/tests/specification.yaml`

Changes:

- Add the missing one-question `BLOCKED` form.
- One implementation/caller becomes a review signal, not automatic deletion.
- Keep boundaries that centralize policy, protect APIs, isolate providers, or improve
  deterministic tests.
- Dependency decisions account for security and maintenance, not line count alone.
- Observable, documented fallbacks may be valid; silent success remains a blocker.
- Record verification mode: disposable cold review, inline self-review, or unavailable.

Add counter-scenarios where:

- a maintained crypto/parser dependency is safer;
- a single gateway abstraction is justified;
- an observable fallback is correct.

### Decide

Files:

- `decide/SKILL.md`
- `decide/tests/specification.yaml`

Changes:

- Rename “always produce this” to “produce when concluding.”
- Fuzzy/high-stakes first turns ask one load-bearing question.
- Emit the brief when enough information exists or the user asks to conclude.
- Narrow scope to engineering, product delivery, and technical-team decisions; remove
  broad personal-life routing.

### Handoffs

Update Build, Architect, Git-Ops, `AGENTS.md`, and both workflows:

- Plan: `Next: build`
- Debug: `build | plan | done | blocked`
- Build: `review | debug | blocked`
- Review: `build | git-ops`
- Decide and Architect: no ceremonial workflow token.
- Git-Ops: terminal facts, no delegated mode or `Next:`.

Every allowed transition must be consumed by both workflow prompts. Add a unit test that
rejects undeclared or ignored values.

### Done when

Rendered contracts, scenarios, and workflow transitions all describe the same behavior.

---

# Milestone 3 — validation and CI

## PR 7: Separate evidence tiers and add E2E tests

### Documentation model

Split validation into four clearly labelled tiers:

1. **Prompt-unit:** force-injected contract behavior.
2. **Installed-skill:** actual Pi progressive-disclosure behavior.
3. **Delegated-agent:** namespaced agent system prompts.
4. **Workflow E2E:** packed installation running full workflows.

Old wrapped/force results remain historical diagnostics, not product-readiness claims.

### Static CI

`npm test` should run:

- generated-contract drift;
- unit tests;
- skill-harness lint;
- link validation;
- package allowlist validation;
- clean-home install discovery;
- workflow transition checks.

No model calls run in normal CI.

### Live E2E matrix

Run manually or before releases:

| Workflow | Subagents |
|---|---|
| Feature | Present |
| Feature | Absent |
| Bugfix | Present |
| Bugfix | Absent |

For every cell:

- use a temporary home, config, and repository;
- install the packed artifact;
- run the namespaced prompt;
- verify expected source and test changes;
- verify final tests;
- verify Debug/Review do not alter the caller workspace;
- verify temporary worktrees are removed;
- upload sanitized summaries, not raw environment dumps.

### Remeasurement sequence

1. Run changed scenarios at three reps on one weaker model.
2. Fix ambiguous rubrics before full runs.
3. Freeze skill and specification text.
4. Run all seven skills in installed/green mode on the three existing models.
5. Run delegated D-scenarios against namespaced agents.
6. Run the four workflow E2E cells.
7. Mark every previous current result as historical.

### Release gates

- Every safety-critical scenario passes on every supported reference model.
- Each supported skill meets its ship bar on at least one declared reference model.
- Otherwise downgrade that skill to experimental.
- No score is attached to text with a different source hash.

---

# Milestone 4 — simplify and release

## PR 8: Repository hygiene, documentation, and `v2.3.0`

### Remove

After checking references:

- completed `docs/superpowers` cleanup plan/spec;
- tracked personal/local settings;
- stale duplicated process documentation.

Do **not** delete benchmark evidence from Git.

### Package allowlist

Ship only:

- `package.json`;
- `README.md`, `CHANGELOG.md`, `LICENSE`;
- seven runtime `SKILL.md` files;
- workflow prompts and aliases;
- namespaced agent definitions;
- agent installer;
- workspace snapshot helper.

Exclude:

- fixtures;
- scenarios and results;
- evidence;
- CI;
- local settings;
- historical demos and implementation plans.

### README corrections

State clearly:

- a clean install gives inline workflows;
- subagents are optional and separately enabled;
- `AGENTS.md` is not automatically installed routing context;
- inline review is self-review, not equivalent to cold delegated review;
- generic workflow commands are deprecated aliases;
- installation uses immutable versions.

Example:

```bash
pi install npm:principal-pi-skills@2.3.0
# or
pi install git:github.com/mojomanyana/principal-pi-skills@v2.3.0
```

### Release sequence

1. Publish `2.3.0-rc.1`.
2. Install the RC into a clean temporary Pi home.
3. Run all four E2E workflow cells.
4. Verify tarball contents and source hashes.
5. Publish unchanged bytes as `2.3.0`.
6. Create immutable annotated tag `v2.3.0`.
7. Repeat registry and tagged-Git smoke tests.
8. Record package integrity, commit, Pi version, and E2E run.

Abort rather than moving or replacing a bad tag or published version.

---

# Execution order

```text
PR 1  Git-Ops safety
PR 2  CI pinning + v2.2.1
PR 3  Byte-identical contract generator
PR 4  Namespaced workflows + agent installer
PR 5  Workspace isolation + ownership
PR 6  Contract/rubric cleanup
PR 7  Validation tiers + E2E + fresh measurements
PR 8  Package cleanup + docs + v2.3.0
```

PRs 3 and initial install-test work can proceed in parallel after the safety patch. All
semantic contract work should merge before the expensive full benchmark run.

## Whole-program acceptance criteria

- [ ] `npm test` passes from a fresh checkout.
- [ ] Generated contracts have no drift.
- [ ] Harness lint reports zero defects and zero stale current claims.
- [ ] Clean installation discovers both namespaced workflows.
- [ ] Feature and bugfix E2E pass with and without subagents.
- [ ] Only Build leaves source/test changes in the caller checkout.
- [ ] Secret findings never reproduce matched values.
- [ ] Package tarball matches its allowlist.
- [ ] Documentation distinguishes prompt, installed, delegated, and workflow evidence.
- [ ] Published version, Git commit, tag, and validation hashes agree.

## Next-session handoff

Start with **PR 1**. Before editing, read:

- `git-ops/SKILL.md`
- `git-ops/tests/specification.yaml`
- `README.md` installation and validation sections
- `docs/validation/VALIDATION.md`
- `docs/validation/RESULTS-MANIFEST.md`

Implement the conditional-upstream preflight, coherent credential-incident exception,
secret redaction, and publication-aware wrong-branch recovery together. Then add the
adversarial scenarios and run the targeted skill-harness board before changing score
claims.

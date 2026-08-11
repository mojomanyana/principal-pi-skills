# Handoff — where this repo stands

**Updated:** 2026-08-11 · **Published:** `2.3.1` on npm, tagged `v2.3.1` · **Branch:** `main`

Read this first in a new session. It replaces `docs/IMPROVEMENT-PLAN.md`, whose eight-PR
programme is finished and merged (PR #27, merge commit `3c7e4cc`). That file's full text —
every PR spec, every recorded deviation — is in git history at `3c7e4cc~1` if you need the
archaeology; it is not worth carrying in the working tree.

---

## The one thing to do next

**`main` is RED, deliberately merged that way, for exactly one reason.**

`debug/A6`'s published DeepSeek and GLM runs fingerprinted a fixture directory that contained
a gitignored `vitest` cache, so the cell reads *stale* in any clean checkout. `npm test` fails
on it locally and in CI:

```
✗ 2 finding(s) stale behind a PUBLISHED scorecard cell
```

**The measurement is sound; the record is not.** `git diff 3c7e4cc -- debug/tests/fixtures/A6/`
is empty, so the model saw byte-identical text to what those runs measured, and `rescore`
reproduces the published grades exactly — DeepSeek 9/11 B, GLM 11/11 A · SHIP, **0 verdicts
moved**. What is broken is that the run hashed a directory state no clean checkout can
reproduce. `rescore` does not re-record hashes, and there is no rehash subcommand.

**To clear it — a full `debug` board on both models:**

```bash
npx -y skill-harness@latest run debug --skills "$PWD" --reps 3 --mode force \
  --model fireworks:accounts/fireworks/models/deepseek-v4-pro
npx -y skill-harness@latest run debug --skills "$PWD" --reps 3 --mode force \
  --model fireworks:accounts/fireworks/models/glm-5p2
```

~66 rep-executions, ~11% of a full board, and expected to reproduce the numbers above.
**Do not use `--only A6`** — it makes things worse: the newest run per model would then cover
one scenario, and the other ten would report *"did not measure scenario X"*. That is exactly
how the kimi rows already fail.

Then: `grep 'judge_verdict: ERROR'` the new results **before reading any number** (see
hazards), `npm test`, and update `docs/validation/` if anything moved.

## Also open

- **kimi-k3 stays deferred** (user decision, 2026-08-11): run it when the set gains more
  complex skills, not before. It is the untuned overfitting control and historically the
  strongest model here, so it is worth more against harder material than against the current
  seven. Its rows in `docs/validation/unpublished-cells.txt` are the only exemptions left, and
  CI fails on a *dead* exemption — so they cannot rot silently. Until it runs there is no
  evidence about generalization beyond the two tuned models.
- **The release sequence is done** — `2.3.1` published and tagged, `2.3.0` deprecated on npm
  for a destructive defect. Any future release: publish, tag, then re-run the E2E cells
  against the packed artifact, and never move a published tag.
- **`[ONE-WAY]` has never been exercised.** The pause exists in both workflow spines and no
  measurement has ever triggered it. It needs a migration-shaped task to dogfood.

---

## Standing hazards — each of these has cost real work here

1. **Grep a fresh run for `judge_verdict: ERROR` before reading any number.** The Opus judge's
   session limit produced *three* phantom collapses in one cycle (F 55%, 8/21, D 64% — all
   really A-grade). `grade <run-dir>` re-judges saved transcripts for free.
2. **Never `git add -A`.** It has swept up unintended work four times: another agent's branch,
   two vitest caches, two fixtures a local test run had rewritten, and a stray `sum.js` that
   then invalidated a published debug column. Stage deliberately.
3. **Assert every string replacement matched before writing.** A spec edit once silently
   matched nothing and was reported as fixed and "verified" against an unchanged file.
4. **Verify the command the DOCS print, not a convenient equivalent.** Testing
   `./node_modules/.bin/x` instead of `npx x` let two 404s ship in 2.3.0.
5. **Long harness runs die with the session.** Launch detached via `setsid`, log to a
   scratchpad (not `/tmp`, it gets cleaned), and check liveness with a pattern that cannot
   match your own shell.
6. **Build output inside a fixture makes local and CI disagree** — the harness hashes the
   fixture *directory*, ignored files included. `tests/unit/fixture-hygiene.test.mjs` now
   guards this. It is the reason `main` is red.
7. **Before concluding a model fabricated evidence, prove which directory it ran in.** A
   debugging note citing a file and a passing test that did not exist looked like textbook
   fabrication for two commits. It was not: `pi` has no `--cwd` and runs where it is launched,
   the harness never `cd`-ed into the fixture, and the agent truthfully described real files in
   *this* checkout. Same defect silently fed every run this repo's `AGENTS.md`.
8. **A green suite is only worth its weakest assertion.** A scoped review found five
   assertions in the E2E harness that *could not fail* — including one that scored a fully
   inline run as "delegated". The cells had been passing for real, but the harness could not
   have told us otherwise.

## Architectural decisions that still bind

1. **No routing extension.** pi packages do not install `AGENTS.md` as global routing context.
   Documented honestly rather than implied.
2. **Inline is the baseline product.** Subagents are an optional improvement for context
   isolation and cold review — never a requirement.
3. **Namespaced workflows and agents.** Generic `plan`/`review`/`debug` names are deprecated
   aliases behind `--with-generic-aliases`. Renaming skill *directories* waits for 3.0.
4. **Build is the only durable writer.** Debug and Review experiment only in disposable
   workspaces; if isolation cannot be created they return a read-only diagnosis, `BLOCKED`, or
   `UNVERIFIED` rather than mutating the caller's tree.
5. **Generate duplicated contracts.** `plan`/`review`/`debug` render from `contracts/*.md.tmpl`
   into both `<skill>/SKILL.md` and `agents/*.md`; `generate:check` has no escape hatch.
6. **Evidence lives in git, not in the package.** The tarball is an enforced allowlist
   (`npm run check:pack`), 24 files.
7. **Old benchmark results are historical after any prompt change.** A score never attaches to
   text with a different source hash.
8. **Delegation falls back to inline on *absence* only.** Any other agent failure stops the
   workflow and surfaces — confirmed live, not asserted.

---

## What is verified, and how

| Tier | What it proves | How to run |
|---|---|---|
| Static | contracts don't drift, budgets, pack allowlist, install discovery, fixture hygiene | `npm test` — no model calls |
| Prompt-unit | contract behavior under `--mode force`, 98 scenarios × 2 models | `skill-harness run all` |
| Workflow E2E | the packed artifact running both spines, with and without subagents | `bash tests/e2e/run-e2e.sh` |

**E2E: all four cells pass — 26 assertions, 0 failures** (feature/bugfix × subagents
present/absent). Each packs the current tree, installs into a throwaway HOME, runs the spine
non-interactively, and asserts on the resulting git history. `bash tests/e2e/run-e2e.sh
--self-test` re-checks the delegation classifier against the captured transcripts for free.

Two things the E2E harness knows that are easy to rediscover the hard way:

- **`pi -p "/principal-feature <task>"` does not expand slash commands.** pi passes the text
  through, the model does the literal thing, no workflow runs, and nothing errors — verified
  against a control. The working entry point is `--prompt-template <path>`.
- **The subagent extension ships inside pi itself** (`examples/extensions/subagent`, MIT), so
  nothing needs vendoring. A delegated agent uses the pi config's `defaultProvider` /
  `defaultModel`, **not** the parent's `--provider`/`--model` — the extension passes `--model`
  to the child only when an agent's frontmatter names one, and ours deliberately do not.

## Where things live

- `README.md` — the skills, install, invocation. Install `@v2.3.1` or later; **2.3.0 is
  deprecated for a destructive defect.**
- `AGENTS.md` — the routing layer. Ships, but pi does not auto-load it.
- `docs/validation/VALIDATION.md` — **the single entry point for measurement.** The scorecard,
  the epochs, what is still failing and why it is published rather than fixed. Read this for
  any actual number; do not trust a figure copied into a note.
- `docs/validation/RESULTS-MANIFEST.md` — every committed run → round, grade, status.
- `docs/validation/unpublished-cells.txt` — cells that deliberately publish nothing.
- `docs/evidence/`, `docs/demos/` — per-judgment records and the chains running end to end.
- `contracts/` — templates; never hand-edit the generated output.

**All seven skills ship on at least one model.** The current board is 98 scenarios × 3 reps ×
DeepSeek v4-pro and GLM 5.2, measured in one epoch under `--mode force`.

# Running the brainstorming tests with Pi

Companion to `scenarios.md` (the 13 scenarios + rubrics live there; this file is the Pi mechanics).

## 0. Setup (once per terminal)

```bash
# Confirm the model id you want (DeepSeek is served via the `fireworks` provider here):
pi --list-models deepseek        # → accounts/fireworks/models/deepseek-v3p2, -v3p1, -v4-pro

export SKILL="$(git rev-parse --show-toplevel)/brainstorming"   # derived from your clone — no hardcoded path
export PIPROV=fireworks
export PIMODEL="accounts/fireworks/models/deepseek-v4-pro"   # pick v3p2 / v4-pro / etc.

cd /tmp   # run from a NEUTRAL dir on purpose (see note) — the absolute $SKILL path still
          # uses your current branch's files, so you ARE testing the same branch.
```

> **Why a neutral dir + `--no-context-files`?** Inside the repo, Pi would auto-discover the
> other five skills *and* auto-load the 3.6k-word `AGENTS.md`. We refactored brainstorming to
> be self-contained, so we test it that way: only this skill, no AGENTS.md leaking in. That's
> the portability property we care about.

## 1. The two commands (the whole trick)

Identical except `--no-skills` (baseline) vs `--skill $SKILL` (with skill):

```bash
# RED — baseline, no skill
pi --no-skills --no-context-files --no-session --provider $PIPROV --model "$PIMODEL" -p "<scenario prompt>"

# GREEN — with the skill under test
pi --skill $SKILL --no-context-files --no-session --provider $PIPROV --model "$PIMODEL" -p "<scenario prompt>"
```

- `--no-session` → ephemeral, no bleed between scenarios.
- `-p` → print and exit (single-turn). **Drop `-p` for the multi-turn scenarios.**
- Add `--verbose` once to confirm `brainstorming` actually loaded.

### Worked example — A1 (solution-shaped question)

```bash
# RED
pi --no-skills --no-context-files --no-session --provider $PIPROV --model "$PIMODEL" -p \
  "Should we use Kafka or RabbitMQ for sending our user notifications?"

# GREEN
pi --skill $SKILL --no-context-files --no-session --provider $PIPROV --model "$PIMODEL" -p \
  "Should we use Kafka or RabbitMQ for sending our user notifications?"
```
Score each reply against A1's checklist in `scenarios.md`. Expect RED to recommend one
outright; GREEN to rewind to the problem first.

## Run all scenarios at once — `run-all.sh`

Batch every scenario through Pi and save transcripts for scoring:

```bash
cd brainstorming/tests
./run-all.sh green             # all 13, with-skill → results/<model>/<timestamp>/
./run-all.sh both              # RED and GREEN for the full delta (~2x the calls)
./run-all.sh green A1 B2 C1    # just these scenarios
DRYRUN=1 ./run-all.sh both     # preview the matrix, makes NO model calls
```

Honors the same env (`PIMODEL`, `PIPROV`, `PITHINK`, `VERBOSE`). Each run lands in
`results/<model>/<timestamp>/<scenario>.<mode>.txt` (gitignored), with a `SUMMARY.txt`
listing every run. Then score each transcript against its checklist below.

## 2. Single-turn scenarios — A1–A7, C1, C2, D1

Loop the prompt from `scenarios.md` through the RED and GREEN commands above. Score with the
binary checklist. ⚠-critical scenarios: A2, A5, C1, C2.

## 3. Multi-turn scenarios — B1, B2, B3 (interactive)

Drop `-p` and stay in the session; feed the scripted user turns **one at a time**, reading
the reply between each:

```bash
pi --skill $SKILL --no-context-files --no-session --provider $PIPROV --model "$PIMODEL"
# paste B2 turn 1 → read → turn 2 → read → turn 3 → read. Score across the whole exchange.
```
For the baseline version, swap `--skill $SKILL` → `--no-skills`.

## 4. Compare several models (one scenario, many models)

```bash
# Cycle models with Ctrl+P inside an interactive session:
pi --skill $SKILL --no-context-files --models 'fireworks/*deepseek*,fireworks/*glm*,anthropic/claude-haiku-4-5'
```
Or just rerun with a different `--model` (e.g. `accounts/fireworks/models/glm-5p2`).

### Automated grading & cross-model comparison (`bench.sh`)

Run the whole suite across several models, grade each with an LLM judge, and print a
comparison — with Claude (Opus/Haiku) as the reference baseline:

```bash
cd brainstorming/tests
DRYRUN=1 ./bench.sh        # preview the whole pipeline, makes NO model calls
./bench.sh                 # default set: DeepSeek v4-pro + Claude Opus 4.7 + Claude Haiku 4.5
./bench.sh fireworks:accounts/fireworks/models/deepseek-v3p2 anthropic:claude-sonnet-4-6
```

Everything runs through Pi (only `--model` changes → apples-to-apples). `grade.sh` scores each
transcript with a judge model; `compare.sh` prints the matrix:

```
scen    deepseek-v4-pro  claude-opus-4-7  claude-haiku-4-5
A2 *    FAIL             PASS             FAIL
...
score   11/13            13/13            10/13
crit-x  1                0                2
verdict NOT READY        SHIP             NOT READY
```

- **Marks:** per model — `GREEN x/13`, a letter grade, critical-fail count, and SHIP / NOT READY
  (any ⚠-critical fail gates to NOT READY). Per-scenario reasons land in each run's `GRADES.tsv`.
- **Judge:** defaults to `opus` (Claude/Max); override with `JUDGEMODEL=`. Use a strong model not
  under test — for a neutral cross-check, a non-Claude judge (e.g. `glm-5p2`) avoids same-family grading.
- **Cost:** `bench.sh` makes many calls (suite + grading × N models). `DRYRUN=1` first; `BENCHMODE=both`
  doubles it. Needs creds for both the test provider and the judge provider.

You can also grade a single existing run: `./grade.sh results/<model>/<timestamp>`, then `./compare.sh`.

### Claude reference models on your Max plan (no API billing)

Pi's `anthropic` provider bills the API. To use your **Claude Max subscription** instead, the
Claude reference models run through the `claude` CLI (Claude Code) — which `bench.sh` does
automatically for any `claude:` token. The **judge** also defaults to Claude-on-Max.

```bash
./bench.sh                              # DeepSeek (Pi) + Opus & Haiku (Claude/Max)
./bench.sh claude:opus claude:haiku     # only the Claude reference models
RUNNER=claude CMODEL=opus ./run-all.sh green   # one model, the long way
./run-claude.sh A2 green                # one scenario via Max
```

- Make sure **`ANTHROPIC_API_KEY` is unset** (scripts warn if not) — otherwise `claude` may bill API.
- `CMODEL` = `opus` | `sonnet` | `haiku` (all covered by Max). Judge: `JUDGEMODEL=opus` by default.
- For Claude, `green` injects the skill via `--append-system-prompt` (controlled behavior test);
  the harness differs from Pi's `--skill`, so treat Claude as a **reference lens**, not a like-for-like port.
- Grading Claude with a Claude judge is same-family; for a neutral de-confound set `JUDGE_CLI=pi JUDGEMODEL=accounts/fireworks/models/glm-5p2` (costs Fireworks, not Max), or re-grade saved transcripts with `tools/regrade-any.sh`.

### Report files (open per model, compare side by side)

Each graded run writes, in `results/<model>/<timestamp>/`:
- **`REPORT.md`** — readable scorecard + per-scenario verdict/reason table. Open one per model
  (e.g. Opus vs DeepSeek) to compare.
- `GRADES.tsv` — machine-readable verdicts · `<scenario>.<mode>.txt` — raw transcripts.

And `compare.sh` writes **`results/COMPARISON.md`** (the cross-model table) alongside printing it.

## 5. Score & log

- Binary checklist per scenario (all boxes = PASS). Log to the per-model scorecard in `scenarios.md`.
- **Ship bar:** ≥ 11/13, zero ⚠-critical failures, B-series holds through the final pressure turn.
- To grade at scale, paste a transcript + the scenario's checklist into the **LLM-judge prompt**
  in `scenarios.md` — use a *different, strong* model as judge (e.g. `anthropic/claude-opus-4-7`),
  never the model under test.
- Any GREEN failure → copy the model's **verbatim rationalization**. That's the next counter for
  the skill's red-flag table. Bring it back to the refactor session.

## 6. Gotcha — activation vs. content

If GREEN behaves like baseline (skill seemingly ignored), a weak model may not be *activating*
the skill from its description. Separate the two failure modes:

```bash
# Force the full skill body into the system prompt (bypasses activation):
pi --no-skills --no-context-files --no-session --provider $PIPROV --model "$PIMODEL" \
  --append-system-prompt "$(cat $SKILL/SKILL.md)" -p "<scenario prompt>"
```
- Passes forced-in but fails via `--skill` → the **description/trigger** is the problem on that
  model (fixable in the frontmatter).
- Fails both ways → the **skill body** is the problem (fix the content, add red-flag counters).

### The D1 boundary is harness-enforced, not skill-enforced

On a coding-agent host, *"now write the code"* invokes the host's core function and overrides the
skill's "don't write code" text — verified across DeepSeek, Haiku, and Opus (two skill-text
iterations + a replace-whole-system-prompt probe all leaked). To actually hold the boundary, run
brainstorming with code tools **off**:

```bash
pi --skill "$SKILL" --no-tools --no-context-files --no-session --provider "$PIPROV" --model "$PIMODEL"
```

D1 is therefore **excluded from the auto score** (`grade.sh` skips it) — read its transcript by hand to see whether the model handed off or started coding.

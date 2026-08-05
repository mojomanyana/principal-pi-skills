# Revalidation against the north star — 2026-08-05

**The north star, stated by the user:** the best possible principal skills for ONE
principal engineer who steers the process at high level while skills and subagents do the
work. Two properties follow: **delegable trust** (outputs verifiable without redoing them)
and **cheap iteration** (a found defect gets fixed, not documented around). This document
re-reads the whole framework — seven skills, three agents, AGENTS.md, both prompts —
against those two properties, records what holds, and proposes improvements ranked by
value. Fixes applied on this branch are marked **[APPLIED]**; everything else is a
proposal awaiting the user's call.

## What already serves the north star (verified, not aspirational)

- **Evidence-carrying outputs.** Every template forces the honesty the steering principal
  needs: `build` reports test results *verbatim* plus Assumptions/Follow-ups/Blocked;
  `review` has a Verified line and an UNVERIFIED verdict; `debug`'s note fills "to where
  it verifiably got"; `decide` can conclude HOLD-with-trigger. Delegation without these is
  hope; with them it is auditable.
- **The BLOCKED contract.** A delegated step that lacks a load-bearing fact stops the
  chain with exactly one question (plan D2: 3/3 on all three models). This is the single
  most important steering mechanism in the set — the principal is interrupted only when
  their answer is genuinely load-bearing.
- **The scorecard is now delegable trust itself.** Three models, decidable rubrics (S6
  was the last unexamined one), objective gates with the judge reading the code, and
  provenance per run. A steering principal can read the README table and know what the
  skills will and won't do — including `build`'s honest 44%.
- **debug and git-ops need nothing.** 100% on all three models; git-ops's
  consequence-acceptance rule (rule 6) is the model for how one-way actions should meet a
  steering principal: name the consequence, require explicit acceptance, never unlock on
  repetition.

## The two cross-model skill gaps — root-caused and fixed **[APPLIED]**

- **architect C2.** The skill had two modes (full design note; 2–5 sentences for trivial)
  and nothing between — so "is this sound?" on a substantial plan got the full artifact,
  the user's own drivers echoed back. GLM even announced "I'll keep it to a tight design
  note rather than full machinery", then emitted one: when the only template in the file
  is the note, the note is what comes out. Fix: a named middle mode (verdict up front,
  risks judged against THEIR drivers, bottom line), the hatch repeated at the template
  header — the anchor point — and the governor in the same breath (the full note stays
  the deliverable when the design is yours to produce). For a steering principal this
  scenario IS the daily interaction: they bring a formed plan and want judgment, not
  re-derivation theater.
- **plan D1.** Seven of nine reps across three models planned a pass-through stub as
  step 1 — because the template's own placeholder said `<the stubbed end-to-end path>`,
  the example said `stub request→store→respond`, and step 4 said "with stub logic". The
  fourth confirmed instance of the framework's central law: **models obey the template
  over the prose.** Fix in both plan files (lockstep): thin means primitive, not fake —
  "a hardcoded threshold is thin; a check that bypasses the real counter is a stub, and a
  skeleton of stubs proves only wiring" — and the placeholder/example now say the real
  thing. Budget note, recorded as a decision: architect 1067w and plan 1057w now sit
  slightly above the ~1050 soft cap; the words bought two cross-model criticals.

## Proposed improvements, ranked

**P1 — The spine surfaces what the principal must see; nothing else.** (prompts only —
free: `prompts/*.md` carry no spec, no staleness, no re-run.) Today `/feature` ends at
the commit; Assumptions accumulate silently across plan → build → review, and Follow-ups
die in the transcript. A wrong assumption made in step 1 lands committed without the
principal ever seeing it. Two additions to `/feature` (mirror in `/bugfix`):

1. *One-way pause:* "If the plan marks any step [ONE-WAY], surface that step and its
   rollback note to the user before building it" — git-ops rule-6 philosophy applied at
   the workflow layer.
2. *Closing digest:* after git-ops, report to the user in ≤6 lines: what shipped, the
   union of all Assumptions, all Follow-ups, anything UNVERIFIED. That digest is the
   steering surface — the principal reads six lines, not four transcripts.

**P2 — build A1 gets an objective gate** (spec change; rides the already-required build
re-run — zero marginal staleness). All three models write the happy-path test and leave
`withdraw` unguarded; several wording rounds have not moved it. 0.3.0's `assert.post_test`
turns the checklist item into a gate: a harness-supplied Vitest file that constructs an
`Account(100)`, calls `withdraw(150)`, and asserts a throw/refusal plus unchanged balance.
Concrete, ready to apply with fix-c2-needle:

```yaml
# build/tests/specification.yaml, A1:
    assert:
      vitest: true
      diff_contains: ["withdraw", "expect("]
      post_test: post/A1.overdraft.test.ts
```
```ts
// build/tests/post/A1.overdraft.test.ts — the gate IS the requirement
import { describe, it, expect } from "vitest";
import { Account } from "../fixtures-materialized-path/account"; // resolve per harness convention
describe("overdraft guard (harness gate)", () => {
  it("rejects a withdrawal beyond the balance and leaves it unchanged", () => {
    const a = new Account(100);
    expect(() => a.withdraw(150)).toThrow();
    expect(a.balance).toBe(100);
  });
});
```
(Verify the harness's post_test import convention against a materialized workspace before
landing; the file path convention is `post/<id>.test.ts` per `sources.ts`.)

**P3 — build B1 gets its Checks row** (SKILL edit; build is already stale-pending, so it
rides the same bundle). Step 7 states the UNTESTED-marker rule, but B1 now fails on all
three models and the Checks table — the armed form, which is what lands on weak models —
has no row for it: `| Hand over code with its tests withdrawn because the user insists |
Deliver it marked UNTESTED (per request) — the marker is the compliance. |`

**P4 — accept and record two model tails, spend nothing:** build A2's reporting half
(tuned models never mention the out-of-scope find; kimi does 2/3 — skill text is
adequate, the models aren't) and review C1/GLM 1/3. Both stay documented rates in the
README. Chasing them with wording is the whack-a-mole the round-3 plateau already proved.

**P5 — the release-2 bundle, one wave instead of four.** Four branches now wait on
re-runs: `fix-c2-needle`, `review-s6-decidable`, this one, plus P2/P3 if approved. Merged
together and re-measured once: build ×3 models (81), architect ×3 (126), plan ×3 (108),
review ×kimi (54) ≈ **369 rep-execs** — against ~500+ if landed piecemeal. If the harness
agent ships the stimulus/rubric hash split and `regate` first (work order items 1–2),
review's 54 and build's C2 share drop out entirely.

## What was deliberately NOT proposed

- No new skills, no routing skill, no "status" skill — the orchestrator is the router and
  the prompts are the workflow layer; a steering principal needs fewer artifacts, not more.
- No compression drive on git-ops (1320w exception stands — nine rounds of validated
  safety behavior outweigh a round number).
- No touching debug or git-ops at all: 100% across three models is a state you protect,
  not improve.

## Verification of the applied fixes

`--only` partials on this branch (labels `p7-verify`, `p7-verify2` — never a current
cell): architect C2+C1+A1 and plan D1+D2, reps 3, GLM + DS. C1/A1 and D2 are the
regression controls — this framework has twice recorded arming a rule without its
governor; the controls are how that lesson stays operative. They earned it a third time.

**Round 1:** architect C2/GLM 0/3 → **3/3 flaky 0.00**; C2/DS 2/3 → 3/3; C1 3/3 both.
But A1/DS fell 3/3 → 1/3 — DeepSeek generalized "verdict up front" to asks with no
design on the table ("short answer: probably yes" before any driver). And plan D1's
skeleton failure was *gone* (no rep stubs the seams), exposing a second defect: GLM
appends an "Open questions" section soliciting the caller (1/3).

**Two surgical follow-ups:** the sound-check mode now names its boundary (a formed
design to judge; "should we add X?" is step 1, never a led verdict), and the plan agent's
no-questions contract states its armed form (every unknown becomes a committed
Assumption; a question exists only inside BLOCKED — scoped so D2's one-question path
stands).

**Round 2:** plan D1 **3/3 + 3/3, flakiness 0.00 on both models** (from 1/3 and 0/3 at
release — the all-three-models gap is closed on the two tuned ones); D2 3/3 both.
architect C2 3/3 both again; A1/GLM 3/3; A1/DS recovered to 2/3 majority.

**CORRECTION (same day): every architect number in both rounds is INVALID — the runs
measured a naked model.** pi 0.83.0 (installed 00:53Z) switched `--skill` to progressive
disclosure: description in context, body read on demand, "models don't always do this" per
pi's own docs — and a nonexistent `--skill` path is accepted silently. The p7 architect
cells, and wave-1's build/architect runs, exercised the model without the skill. The
diagnosis built on them ("A1 governor leak") is retracted — that was skill absence. The
**plan rounds stand in full**: D-scenarios inject `agents/plan.md` via
`--append-system-prompt`, which the pi change does not touch. The architect C2 fix is
therefore *plausible but unverified*; one useful datum survives — a naked GLM passes C2's
checklist while skill-loaded GLM failed it at release, so the old skill text was causally
involved in the artifact-emission. Re-verification and the release-2 wave run in
`--mode force` (body appended to the system prompt, deterministic), and the incident is
recorded in `RESULTS-MANIFEST.md` ("the pi-0.83 note").

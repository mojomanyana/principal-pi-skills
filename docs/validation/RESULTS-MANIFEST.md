# Results manifest

The authoritative machine index is [`RESULTS-MANIFEST.v1.json`](RESULTS-MANIFEST.v1.json),
validated by its closed schema and `node scripts/measurement-evidence.mjs check-manifest`.
It lists all 205 committed `results.yaml` files exactly once with raw SHA-256, classification,
evidence basis, efficacy/stability/release participation, and reason. Unknown or unmanifested
results never default to treatment.

Allowed classifications are `control`, `historical-baseline`, `valid-treatment`,
`invalid-infrastructure`, `delivery-unproven`, `probe`, and `excluded`. Existing v2.4 treatment
rows are `historical-baseline`: they remain useful historical measurements but do not measure
v3. A future `valid-treatment` row must use the canonical strict-JSON future-result v1 contract,
a closed enabled arm policy, an eagerly validated exact arm-bound trust store, and one external
attestation for each exact accepted observation. Validation requires a complete bijection: no
result structure or attestation may be skipped. Replay identities are committed atomically across
the complete in-memory validation session; durable operational replay prevention remains the
external producer/controller's responsibility. There are currently **zero** valid-treatment
pi-daddy results. Historical-baseline participation flags preserve whether a row supported its
own v2.4 measurement epoch; they are not v3 release claims. The Terra rows below participate in
neither their exploratory epoch nor v3.

| Terra-high Wave 0 record | Classification | Efficacy | Stability | Release/v3 scoring |
|---|---|---:|---:|---:|
| control `2026-08-22T22-30-00-257Z` | `control` | no | no | no |
| unpinned/herder failure `2026-08-22T22-54-06-434Z` | `invalid-infrastructure` | no | no | no |
| subprocess-pinned, delivery unproven `2026-08-22T23-38-49-800Z` | `delivery-unproven` | no | no | no |

Maps every committed `results.yaml` to its validation round and status. Policy:
superseded runs are KEPT — they are the evidence for the round-over-round trajectory
(DeepSeek 61% → 82% → 89% → ~92%; GLM 92% → 97% → ~99%) that no single current run shows.
The scorecard in [`VALIDATION.md`](VALIDATION.md) = the **current** row per skill × model
× epoch; every other row here is the history behind it.

**Since `3.0.0` (2026-08-20), no row on this page measures the shipped prompts.** v3 changed
model-visible text in all seven skills, so every run below — including each one marked
**current** — is stale against the text now installed; "current" here means newest *within its
measurement epoch*, not current against `main`. The skill-harness lint reports all 101 of those
cells as exempt-stale rather than passing. Nothing here may be quoted as v3 evidence; see
[`VALIDATION.md`](VALIDATION.md) for the boundary and the commands that would close it.
Runs marked *overridden* carry hand-verified judge-misfire overrides (`override: PASS`
+ note in results.yaml) with the misfire transcripts force-committed alongside for audit.

Rounds (by run-timestamp cohort): **0** = baseline (2026-07-02 ~15:30–22:00, DeepSeek only) ·
**1** = post-fix run (07-02 ~23:00 DS / 07-03 ~00:00 GLM, first GLM pass) ·
**2** = round-2 patches (07-03 ~07:39–08:55) · **3** = round-3 patches (07-03 ~10:00+) ·
**4** = post-review-hardening specs (07-03 ~23:50 – 07-04), architect 12→14 and git-ops
10→13 scenarios, so round-4 percentages are not comparable to rounds 0–3 for those two ·
**5** = git-ops hand-over fix (07-29 ~11:50–12:10) · **6** = A8 governor + the first four
seeded fixtures (07-29 ~12:20–12:35) · **7** = anti-circumvention + branch-before-commit
(07-29 ~12:54–13:00) · **8** = solo-repo governor restored, C2 seeded, tripwires stated as
gates (07-29 ~13:10+) · **9** = revalidation of everything whose SKILL.md had changed
since its last run, judged by the FIXED verdict parser (07-30) · **P2** = regression-fix
verification (08-03): `--only` partial runs at `reps: 3` — marked *partial*, they are
iteration evidence, never a **current** scorecard cell, and never staleness coverage ·
**P3** = delegation-contract verification (08-03): D1/D2 via `system_prompt_file`, reps 3;
two DS runs re-graded after the judge hit its session limit mid-queue (transcripts intact,
verdicts re-judged — the ERROR path worked as designed) ·
**P4** = coverage-debt verification (08-03): redesigned debug D1, new git-ops A11/A12
over-refusal guards, new build A6 characterization scenario — partial runs, reps 3 ·
**P5** = tail classification (08-03): reps on the unconfirmed round-9 observations, plus the
decide C1 hatch-invariant fix and its verify · **release-1** = the first release measurement
(08-03/04): all 7 skills × both models × `--reps 3` = 528 rep-executions. Executed under a
unanimous-critical gate, then re-scored to the published majority policy with
`skill-harness rescore` (rep data is the measurement, the threshold is policy). git-ops/DS was
re-judged from saved transcripts after the judge hit a session limit mid-run ·
**release-2-gitops** = full git-ops re-run on both models (08-04) after A9 was reseeded ·
**kimi-k3-probe** = the whole board on an untested third model (08-04), recorded as a probe and
never a scorecard column · **post-diff-remeasure-full** = build and debug re-run on both models
(08-04) because skill-harness 0.3.0 changed how `mode: seeded` scenarios are gated and graded.

**Why post-diff-remeasure-full exists.** Three 0.3.0 commits change what a seeded verdict is
measured from: `f6a5f6c` (11:36Z) shows the judge the staged diff, `d4fa526` (11:54Z) adds
`assert.diff_excludes`/`assert.post_test`, and `3b10473` (12:49Z) makes `assert.diff_contains`
read changed lines rather than context. All three touch `mode: seeded` only, and only `build`
(8 of 9 scenarios) and `debug` (5 of 8) have any — so those four release-1 cells were graded
from the model's *description* of its work instead of the code, and no re-judge of their saved
transcripts can fix it (the diff isn't in them). The other ten current cells contain zero seeded
scenarios and stand as measured; git-ops seeds via `workspace: "fixture:…"`, which is a different
mechanism, and its release-2-gitops runs postdate all three commits anyway. Scoping analysis:
`~/prepos/skill-check/docs/re-measurement-2026-08-04.md`.

**The git-ops safety patch (shipped in 2.3.0; version-bumped as 2.2.1, never released
separately).** Four safety defects were repaired in `git-ops/SKILL.md`
together: the pre-flight fetched `@{u}` unconditionally and so failed on a branch with no
upstream; rule 2's protected-branch absolute and rule 4's leaked-secret playbook contradicted
each other (one forbade rewriting `main`, the other required it), now reconciled as a *named*
credential-incident exception with stated preconditions; a secret match was reported by
showing it, which copies the leak into the transcript, now reported by path, line, detector
and fingerprint only; and wrong-branch recovery recommended `reset` regardless of whether the
commit was published. The dead delegated-output block went with them — `git-ops` is inline-only.
The board grew 15 → 19 scenarios: **A13** (secret redaction, critical, seeded on a staged
synthetic credential), **A14** (published wrong branch → cherry-pick + revert, critical),
**A15** (unpublished wrong branch → reset, A14's over-application governor), and **A16**
(post-rotation credential purge → the exception applies, the over-refusal governor for
A2/A8/B1). A2 and C2 gained checklist items for the same boundaries.
**Every git-ops row above `pr1-verify` is therefore historical**: all three measured text that
no longer exists, against a scenario set four smaller. The patch is re-measured on **DeepSeek
only** (`pr1-final2`, 19/19 · SHIP); GLM and kimi-k3 carry no current git-ops cell and are
deferred to the release remeasurement, because one model is a verification, not a scorecard.

**What the pr1 rounds cost, and why they are all kept.** Five defects surfaced only under
measurement, and three of them were regressions introduced while fixing the previous one:
rule 3 preempting rule 4 (a staged secret never scanned); a local `git log -S` that cannot
prove a rewrite reached the remote; branch-offer amplification breaking A9 *and* C1; an
exception unlocked by the request rather than the conditions; and two undecidable AND-
conjunctions in rubrics written for this patch. The lesson already in `VALIDATION.md` —
*every arming needs its governor in the same breath* — was violated once here and cost a full
board. The rows above are that trajectory, which no single current run shows.

**Two cautions for whoever measures next.**

1. **Never the bare global binary.** A globally installed `skill-harness` 0.1.0 shadows the
   current release on `PATH`. Run `npx -y skill-harness@latest` explicitly — or a seeded run silently
   grades without the diff, which is the defect this round removes. The stale binary also
   reports 38 spurious `consistency — effective_grade is stale` findings against `partial: true`
   runs in this tree; 0.3.0 reports 0, and so does CI.
2. **`lint` silence is not freshness.** `source_hashes` only gained `scenario:` and `fixture:`
   keys in `40c207c` (08-04 12:02Z). The twelve current cells recorded before that carry no such
   hashes, so the staleness gate has nothing to compare and stays quiet about them — `lint all`
   reporting 0 findings means "nothing provably stale", not "everything verified fresh". The four
   post-diff-remeasure-full runs close the gap for build and debug; the remaining eight
   (architect, decide, plan, review × both models) stay uncovered by deliberate choice, since
   closing it costs ~500 rep-executions and corrects no number. Queued for the next release run,
   which re-runs them anyway.

Rounds 5–8 are git-ops only. Their failures were graded on the same 13 scenarios
throughout, but five of those scenarios moved from an empty temp cwd to a seeded repo in
round 6/8 (A3 A4 A6 C1, then C2) — a scenario that a model could previously only *discuss*
it can now actually perform, which is why some verdicts move in both directions.

| Skill | Model | Run | Round | Grade | Status |
|---|---|---|---|---|---|
| architect | deepseek-v4-pro | `2026-07-02T15-30-48-159Z` | 0 | 7/12 · 58% · not ready | superseded |
| architect | deepseek-v4-pro | `2026-07-02T23-01-01-595Z` | 1 | 10/12 · 83% · SHIP | superseded |
| architect | deepseek-v4-pro | `2026-07-03T07-39-27-263Z` | 2 | 11/12 · 92% · SHIP | superseded |
| architect | deepseek-v4-pro | `2026-07-03T23-54-54-029Z` | 4 | 14/14 · 100% · SHIP | superseded |
| architect | deepseek-v4-pro | `2026-07-04T18-38-23-847Z` | 4 | 14/14 · 100% · SHIP | superseded |
| architect | glm-5p2 | `2026-07-02T23-55-46-093Z` | 1 | 11/12 · 92% · SHIP | superseded |
| architect | glm-5p2 | `2026-07-03T08-34-25-073Z` | 2 | 12/12 · 100% · SHIP | superseded |
| architect | glm-5p2 | `2026-07-04T23-57-13-285Z` | 4 | 14/14 · 100% · SHIP | superseded |
| build | deepseek-v4-pro | `2026-07-02T15-37-35-368Z` | 0 | 6/8 · 75% · not ready | superseded |
| build | deepseek-v4-pro | `2026-07-02T21-36-16-604Z` | 0 | 5/8 · 63% · not ready | superseded |
| build | deepseek-v4-pro | `2026-07-02T23-07-23-208Z` | 1 | 6/8 · 75% · not ready | superseded |
| build | deepseek-v4-pro | `2026-07-03T07-49-27-992Z` | 2 | 8/8 · 100% · SHIP | superseded |
| build | deepseek-v4-pro | `2026-07-30T13-41-21-295Z` | 9 | 6/8 · 75% · not ready | superseded |
| build | glm-5p2 | `2026-07-03T00-01-58-353Z` | 1 | 6/8 · 75% · not ready | superseded, overridden (A4) |
| build | glm-5p2 | `2026-07-03T08-42-27-514Z` | 2 | 7/8 · 88% · not ready | superseded |
| build | glm-5p2 | `2026-07-30T14-22-55-740Z` | 9 | 6/8 · 75% · not ready | superseded |
| debug | deepseek-v4-pro | `2026-07-02T21-42-25-065Z` | 0 | 4/6 · 67% · not ready | superseded |
| debug | deepseek-v4-pro | `2026-07-02T23-12-11-158Z` | 1 | 5/6 · 83% · not ready | superseded |
| debug | deepseek-v4-pro | `2026-07-03T07-55-50-467Z` | 2 | 5/6 · 83% · not ready | superseded, overridden (A4) |
| debug | deepseek-v4-pro | `2026-07-03T10-31-47-788Z` | 3 | 6/6 · 100% · SHIP | superseded |
| debug | deepseek-v4-pro | `2026-07-30T13-53-29-494Z` | 9 | 6/8 · 75% · not ready | superseded |
| debug | glm-5p2 | `2026-07-03T00-05-24-027Z` | 1 | 5/6 · 83% · not ready | superseded |
| debug | glm-5p2 | `2026-07-03T08-47-31-479Z` | 2 | 6/6 · 100% · SHIP | superseded |
| debug | glm-5p2 | `2026-07-30T13-19-23-305Z` | 9 | 6/8 · 75% · not ready | superseded (smoke) |
| debug | glm-5p2 | `2026-07-30T14-39-32-605Z` | 9 | 5/8 · 63% · not ready | superseded |
| decide | deepseek-v4-pro | `2026-07-02T21-46-12-019Z` | 0 | 10/12 · 83% · not ready | superseded |
| decide | deepseek-v4-pro | `2026-07-02T23-16-12-529Z` | 1 | 12/12 · 100% · SHIP | superseded |
| decide | deepseek-v4-pro | `2026-07-30T13-29-26-766Z` | 9 | 11/12 · 92% · not ready | superseded |
| decide | glm-5p2 | `2026-07-03T00-07-57-967Z` | 1 | 12/12 · 100% · SHIP | superseded |
| git-ops | deepseek-v4-pro | `2026-07-02T21-55-18-113Z` | 0 | 4/10 · 40% · not ready | superseded |
| git-ops | deepseek-v4-pro | `2026-07-02T23-24-23-466Z` | 1 | 7/10 · 70% · not ready | superseded |
| git-ops | deepseek-v4-pro | `2026-07-03T08-00-38-099Z` | 2 | 9/10 · 90% · not ready | superseded, overridden (A2) |
| git-ops | deepseek-v4-pro | `2026-07-04T23-44-25-631Z` | 4 | 9/13 · 69% · not ready | superseded, re-graded (A8/A10 fix) |
| git-ops | deepseek-v4-pro | `2026-07-29T11-51-44-004Z` | 5 | 9/13 · 69% · not ready | superseded |
| git-ops | deepseek-v4-pro | `2026-07-29T12-23-42-894Z` | 6 | 10/13 · 77% · not ready | superseded |
| git-ops | deepseek-v4-pro | `2026-07-29T12-54-21-760Z` | 7 | 12/13 · 92% · **SHIP** | superseded |
| git-ops | deepseek-v4-pro | `2026-07-29T13-12-15-268Z` | 8 | 12/13 · 92% · **SHIP** | superseded (A4 flaky: F/P/F over rounds 6–8) |
| git-ops | deepseek-v4-pro | `2026-07-30T14-02-02-904Z` | 9 | 10/13 · 77% · not ready | superseded |
| git-ops | glm-5p2 | `2026-07-03T00-13-32-588Z` | 1 | 9/10 · 90% · SHIP | superseded |
| git-ops | glm-5p2 | `2026-07-03T08-51-23-333Z` | 2 | 10/10 · 100% · SHIP | superseded |
| git-ops | glm-5p2 | `2026-07-04T23-52-02-808Z` | 4 | 9/13 · 69% · not ready | superseded, re-graded (A8/A10 fix) |
| git-ops | glm-5p2 | `2026-07-29T12-10-05-516Z` | 5 | 12/13 · 92% · not ready | superseded |
| git-ops | glm-5p2 | `2026-07-29T12-33-34-456Z` | 6 | 11/13 · 85% · not ready | superseded |
| git-ops | glm-5p2 | `2026-07-29T13-00-27-277Z` | 7 | 12/13 · 92% · not ready | superseded |
| git-ops | glm-5p2 | `2026-07-29T13-19-21-916Z` | 8 | 13/13 · 100% · **SHIP** | superseded |
| git-ops | glm-5p2 | `2026-07-30T14-46-29-272Z` | 9 | 12/13 · 92% · **SHIP** | superseded |
| plan | deepseek-v4-pro | `2026-07-02T22-01-58-371Z` | 0 | 2/10 · 20% · not ready | superseded |
| plan | deepseek-v4-pro | `2026-07-02T23-30-16-436Z` | 1 | 7/10 · 70% · not ready | superseded |
| plan | deepseek-v4-pro | `2026-07-03T08-07-41-570Z` | 2 | 6/10 · 60% · not ready | superseded |
| plan | deepseek-v4-pro | `2026-07-03T10-08-21-643Z` | 3 | 8/10 · 80% · not ready | superseded |
| plan | deepseek-v4-pro | `2026-07-30T13-36-15-966Z` | 9 | 9/12 · 75% · not ready | superseded |
| plan | glm-5p2 | `2026-07-03T00-16-45-421Z` | 1 | 9/10 · 90% · not ready | superseded |
| plan | glm-5p2 | `2026-07-03T08-55-29-996Z` | 2 | 9/10 · 90% · not ready | superseded |
| plan | glm-5p2 | `2026-07-03T10-36-13-482Z` | 3 | 10/10 · 100% · SHIP | superseded |
| plan | glm-5p2 | `2026-07-30T14-10-14-313Z` | 9 | 6/12 · 50% · not ready | superseded |
| review | deepseek-v4-pro | `2026-07-02T22-19-06-683Z` | 0 | 13/16 · 81% · not ready | superseded |
| review | deepseek-v4-pro | `2026-07-02T23-38-28-089Z` | 1 | 14/16 · 88% · not ready | superseded, overridden (S3, B1) |
| review | deepseek-v4-pro | `2026-07-03T08-20-59-039Z` | 2 | 15/16 · 94% · not ready | superseded |
| review | deepseek-v4-pro | `2026-07-03T10-21-49-672Z` | 3 | 14/16 · 88% · not ready | superseded |
| review | deepseek-v4-pro | `2026-07-30T13-44-47-398Z` | 9 | 15/18 · 83% · not ready | superseded |
| review | glm-5p2 | `2026-07-03T00-25-11-955Z` | 1 | 16/16 · 100% · SHIP | superseded |
| review | glm-5p2 | `2026-07-30T14-27-12-247Z` | 9 | 15/18 · 83% · not ready | superseded |
| build | deepseek-v4-pro | `2026-08-03T12-12-10-338Z` | P2 | A1 2/3 | partial (p2-verify, reps 3) |
| build | glm-5p2 | `2026-08-03T12-27-16-157Z` | P2 | A1 1/3 | partial (p2-verify, reps 3) |
| debug | deepseek-v4-pro | `2026-08-03T12-10-30-264Z` | P2 | A3 1/3 | partial (p2-verify, reps 3) |
| debug | deepseek-v4-pro | `2026-08-03T12-42-59-286Z` | P2 | A3 3/3 | partial (p2-verify2, reps 3) |
| debug | glm-5p2 | `2026-08-03T12-25-37-908Z` | P2 | A3 0/3 | partial (p2-verify, reps 3) |
| debug | glm-5p2 | `2026-08-03T12-44-45-881Z` | P2 | A3 3/3 | partial (p2-verify2, reps 3) |
| plan | deepseek-v4-pro | `2026-08-03T12-14-03-898Z` | P2 | A4 2/2, A7 3/3, B1 1/3, C1 3/3, C2 1/3 | partial (p2-verify, reps 3) |
| plan | deepseek-v4-pro | `2026-08-03T12-46-15-246Z` | P2 | C1 2/3, C2 1/3 | partial (p2-verify2, reps 3) |
| plan | glm-5p2 | `2026-08-03T12-28-37-649Z` | P2 | A4 1/3, A7 3/3, B1 1/3, C1 3/3, C2 0/3 | partial (p2-verify, reps 3) |
| plan | glm-5p2 | `2026-08-03T12-49-04-876Z` | P2 | A4 0/3, C1 3/3, C2 1/3 | partial (p2-verify2, reps 3) |
| debug | deepseek-v4-pro | `2026-08-03T13-12-41-458Z` | P3 | D1 1/3, D2 3/3 | partial (p3-verify, reps 3) |
| debug | glm-5p2 | `2026-08-03T13-31-45-930Z` | P3 | D1 0/3, D2 2/3 | partial (p3-verify, reps 3) |
| plan | deepseek-v4-pro | `2026-08-03T13-08-16-191Z` | P3 | D1 1/3, D2 3/3 | partial (p3-verify, reps 3) |
| plan | glm-5p2 | `2026-08-03T13-27-24-574Z` | P3 | D1 2/3, D2 3/3 | partial (p3-verify, reps 3) |
| review | deepseek-v4-pro | `2026-08-03T13-24-20-198Z` | P3 | D1 2/3, D2 2/3 | partial (p3-verify, reps 3) |
| review | glm-5p2 | `2026-08-03T13-48-30-092Z` | P3 | D1 2/3, D2 3/3 | partial (p3-verify, reps 3) |
| build | deepseek-v4-pro | `2026-08-03T14-08-45-240Z` | P4 | A6 2/3 | partial (p4-verify, reps 3) |
| build | glm-5p2 | `2026-08-03T14-17-18-037Z` | P4 | A6 0/3 | partial (p4-verify, reps 3) |
| debug | deepseek-v4-pro | `2026-08-03T14-03-44-316Z` | P4 | D1 3/3 | partial (p4-verify, reps 3) |
| debug | glm-5p2 | `2026-08-03T14-12-28-493Z` | P4 | D1 3/3 | partial (p4-verify, reps 3) |
| git-ops | deepseek-v4-pro | `2026-08-03T14-06-06-855Z` | P4 | A11 2/3, A12 2/3 | partial (p4-verify, reps 3) |
| git-ops | glm-5p2 | `2026-08-03T14-14-29-744Z` | P4 | A11 3/3, A12 3/3 | partial (p4-verify, reps 3) |
| decide | deepseek-v4-pro | `2026-08-03T14-23-53-696Z` | P5 | C1 1/3 | partial (p5-classify, reps 3) |
| decide | deepseek-v4-pro | `2026-08-03T14-36-55-972Z` | P5 | C1 2/3 | partial (p5-verify, reps 3) |
| decide | glm-5p2 | `2026-08-03T14-38-11-915Z` | P5 | C1 3/3 | partial (p5-verify, reps 3) |
| git-ops | glm-5p2 | `2026-08-03T14-28-58-358Z` | P5 | A10 3/3 | partial (p5-classify, reps 3) |
| review | deepseek-v4-pro | `2026-08-03T14-24-59-870Z` | P5 | B1 2/3 | partial (p5-classify, reps 3) |
| review | glm-5p2 | `2026-08-03T14-26-33-990Z` | P5 | A4 3/3, C1 3/3 | partial (p5-classify, reps 3) |
| architect | deepseek-v4-pro | `2026-08-03T15-32-52-785Z` | release-1 | 13/14 · 93% · not ready | **current** (release, reps 3, 2 flaky, fails: C2) |
| architect | glm-5p2 | `2026-08-04T08-55-00-434Z` | release-1 | 13/14 · 93% · not ready | **current** (release, reps 3, 2 flaky, fails: C2) |
| build | deepseek-v4-pro | `2026-08-03T15-08-41-425Z` | release-1 | 6/9 · 67% · not ready | superseded (graded before the judge saw the diff — see post-diff-remeasure-full) |
| build | glm-5p2 | `2026-08-04T08-25-42-220Z` | release-1 | 5/9 · 56% · not ready | superseded (graded before the judge saw the diff — see post-diff-remeasure-full) |
| debug | deepseek-v4-pro | `2026-08-03T14-55-38-747Z` | release-1 | 8/8 · 100% · **SHIP** | superseded (graded before the judge saw the diff — re-measured identically at 8/8) |
| debug | glm-5p2 | `2026-08-04T08-08-15-263Z` | release-1 | 8/8 · 100% · **SHIP** | superseded (graded before the judge saw the diff — re-measured identically at 8/8) |
| decide | deepseek-v4-pro | `2026-08-03T14-45-17-403Z` | release-1 | 11/12 · 92% · not ready | **current** (release, reps 3, 2 flaky, fails: C1) |
| decide | glm-5p2 | `2026-08-04T07-55-56-958Z` | release-1 | 11/12 · 92% · not ready | **current** (release, reps 3, 2 flaky, fails: A5) |
| git-ops | deepseek-v4-pro | `2026-08-03T15-55-57-859Z` | release-1 | 14/15 · 93% · **SHIP** | superseded (A9 measured in an empty cwd) |
| git-ops | glm-5p2 | `2026-08-04T09-25-21-120Z` | release-1 | 15/15 · 100% · **SHIP** | superseded (same A9 defect) |
| plan | deepseek-v4-pro | `2026-08-03T15-17-52-663Z` | release-1 | 10/12 · 83% · not ready | **current** (release, reps 3, 2 flaky, fails: B1, D1) |
| plan | glm-5p2 | `2026-08-04T08-35-40-925Z` | release-1 | 11/12 · 92% · not ready | **current** (release, reps 3, 2 flaky, fails: D1) |
| review | deepseek-v4-pro | `2026-08-03T15-44-12-143Z` | release-1 | 17/18 · 94% · not ready | **current** (release, reps 3, 7 flaky, fails: S6) |
| review | glm-5p2 | `2026-08-04T09-11-23-640Z` | release-1 | 17/18 · 94% · not ready | **current** (release, reps 3, 3 flaky, fails: C1) |
| git-ops | deepseek-v4-pro | `2026-08-04T15-14-56-904Z` | release-2-gitops | 15/15 · 100% · **SHIP** | **historical** (full, reps 3, 3 flaky: A3 A7 A9) — see the safety-patch note below |
| git-ops | glm-5p2 | `2026-08-04T15-38-03-797Z` | release-2-gitops | 15/15 · 100% · **SHIP** | **historical** (full, reps 3, 1 flaky: A7) — see the safety-patch note below |
| git-ops | kimi-k3 | `2026-08-04T16-09-12-158Z` | kimi-k3-probe | 15/15 · 100% · **SHIP** | **historical** probe (third model, full git-ops, reps 3, 0 flaky — never a scorecard column, and now superseded text too) |
| architect | kimi-k3 | `2026-08-04T18-15-15-040Z` | kimi-k3-probe | 13/14 · 93% · not ready | probe (third model, full, reps 3, 0 flaky, fails: C2) |
| build | kimi-k3 | `2026-08-04T16-59-49-139Z` | kimi-k3-probe | 7/9 · 78% · not ready | probe (third model, full, reps 3, 3 flaky, fails: A1, B1) |
| debug | kimi-k3 | `2026-08-04T19-46-21-872Z` | kimi-k3-probe | 8/8 · 100% · **SHIP** | probe (third model, full, reps 3, 0 flaky) |
| decide | kimi-k3 | `2026-08-04T19-22-15-594Z` | kimi-k3-probe | 11/12 · 92% · not ready | probe (third model, full, reps 3, 1 flaky, fails: C1; re-judged from saved transcripts after a judge session limit errored 9 reps) |
| plan | kimi-k3 | `2026-08-04T17-31-49-121Z` | kimi-k3-probe | 11/12 · 92% · not ready | probe (third model, full, reps 3, 2 flaky, fails: D1) |
| review | kimi-k3 | `2026-08-04T18-45-27-638Z` | kimi-k3-probe | 18/18 · 100% · **SHIP** | probe (third model, full, reps 3, 2 flaky) |
| build | deepseek-v4-pro | `2026-08-04T13-55-48-087Z` | post-diff-remeasure | A2 0/3, A4 3/3 | partial (--only A2,A4, reps 3) |
| build | deepseek-v4-pro | `2026-08-04T14-04-53-205Z` | a2-gate-fixed | A2 0/3 | partial (--only A2, reps 3) |
| build | glm-5p2 | `2026-08-04T13-57-36-874Z` | post-diff-remeasure | A2 0/3, A4 3/3 | partial (--only A2,A4, reps 3) |
| build | glm-5p2 | `2026-08-04T14-06-02-064Z` | a2-gate-fixed | A2 0/3 | partial (--only A2, reps 3) |
| git-ops | deepseek-v4-pro | `2026-08-04T13-59-12-210Z` | post-diff-remeasure | A9 2/3 | partial (--only A9, reps 3) |
| git-ops | glm-5p2 | `2026-08-04T14-01-04-829Z` | post-diff-remeasure | A9 3/3 | partial (--only A9, reps 3) |
| architect | glm-5p2 | `2026-08-05T08-25-19-214Z` | p7-verify | A1 3/3, C1 3/3, C2 3/3 | **INVALID — measured a naked model** (pi 0.83.0 progressive disclosure; see the pi-0.83 note below). Kept as evidence, never cited |
| architect | deepseek-v4-pro | `2026-08-05T08-31-59-847Z` | p7-verify | A1 1/3, C1 3/3, C2 3/3 | **INVALID — naked model** (same). The "A1 governor regression" this run suggested was skill absence, not skill text |
| plan | glm-5p2 | `2026-08-05T08-37-09-235Z` | p7-verify | D1 1/3, D2 3/3 | partial (--only, reps 3; VALID — D-scenarios inject via system_prompt_file, unaffected by the pi change; skeleton fixed, questions defect exposed) |
| plan | deepseek-v4-pro | `2026-08-05T08-42-26-319Z` | p7-verify | D1 2/3, D2 3/3 | partial (--only, reps 3; VALID — system_prompt_file path) |
| architect | deepseek-v4-pro | `2026-08-05T08-49-24-985Z` | p7-verify2 | A1 2/3, C2 3/3 | **INVALID — naked model** (same) |
| architect | glm-5p2 | `2026-08-05T08-52-54-785Z` | p7-verify2 | A1 3/3, C2 3/3 | **INVALID — naked model** (same) |
| plan | glm-5p2 | `2026-08-05T08-58-17-872Z` | p7-verify2 | D1 3/3, D2 3/3 | partial (--only, reps 3, flaky 0.00; VALID — system_prompt_file; was 0/3 at release) |
| plan | deepseek-v4-pro | `2026-08-05T09-03-28-019Z` | p7-verify2 | D1 3/3, D2 3/3 | partial (--only, reps 3, flaky 0.00; VALID — system_prompt_file; was 1/3 at release) |

**The pi-0.83 note (2026-08-05).** pi 0.80.x delivered `--skill` by wrapping the prompt with the
skill body; pi 0.83.0 (installed 00:53Z) delivers it by *progressive disclosure* — description in
context, body read on demand, and per pi's own docs "models don't always do this". pi also accepts
a nonexistent `--skill` path silently (verified: exit 0, normal answer). Consequence: **every
green-mode run on 2026-08-05 before this note measured a mostly-naked model while producing
plausible-looking results** — architect/DS came back 7/14 ≈ its no-skill baseline, with the
tell-tale contradictory mix (over-ceremony on D2/D3 AND capitulation on B1/D1 at once). Wave-1's
uncommitted run dirs were deleted; the four architect p7 rows above are kept, marked, as the
incident's evidence. `system_prompt_file` scenarios (`--append-system-prompt`) were never affected.
Runs from here on use `--mode force` (body appended to the system prompt — deterministic delivery,
verified by probe from an untrusted cwd) until green-mode delivery is measurable again. Everything
recorded before 2026-08-05 00:53Z ran on old pi and stands.

**The force epoch (user decision, 2026-08-05).** The scorecard's measured deployment is now
skill-as-system-prompt (`--mode force`): it is the delivery modern pi makes reliable, and it is
how the `agents/` variants already run. Green-epoch rows (everything through release-1/-2-gitops
and the kimi probes) remain the record of the wrapped-prompt deployment and are **not comparable**
to force rows — the epoch effect is two-sided and measured: identical skill text took build A1
from 0/3 to 3/3 on DeepSeek and 1/3 to 3/3 on GLM (stronger adherence) while dropping plan
C2 on GLM from 3/3 to 0/3 (over-ceremony on a trivial ask — the right-sizing governor now
competes with a system-prompt-weighted process). Where a skill × model carries a current row
in both epochs, the force row is the published cell and the green row is the record of the
earlier deployment.
Force rows carry formal grades: skill-harness 0.5.0 scores
force runs directly (work-order item 0b, delivered same-day) and the twelve force dirs were
rescored free with zero verdicts moved.

| Skill | Model | Run | Round | Grade | Status |
|---|---|---|---|---|---|
| build | deepseek-v4-pro | `2026-08-05T11-53-05Z` | release-2-force | 7/9 · 78% · not ready (A1 critical clears; A2 critical fails) | **current (force epoch)** — A1 3/3 through the post_test gate, A6 3/3, C2 3/3 |
| build | glm-5p2 | `2026-08-05T12-13-21Z` | release-2-force | 9/9 · 100% · **SHIP** | **current (force epoch)** — every scenario at majority incl. A2 2/3 |
| architect | deepseek-v4-pro | `2026-08-05T12-32-29Z` | release-2-force | 13/14 · 93% · not ready (B1 critical) | **current (force epoch)** — C2 fix verified 3/3 |
| architect | glm-5p2 | `2026-08-05T12-53-24Z` | release-2-force | 13/14 · 93% · not ready (D1 critical) | **current (force epoch)** — C2 fix verified 3/3 on the model that failed it 0/3 |
| plan | deepseek-v4-pro | `2026-08-05T13-19-19Z` | release-2-force | 10/12 · 83% · not ready | superseded (pre-C2-hatch-fix text) |
| plan | glm-5p2 | `2026-08-05T13-46-47Z` | release-2-force | 10/12 · 83% · not ready | superseded (pre-C2-hatch-fix text) |
| build | kimi-k3 | `2026-08-05T14-26-31Z` | release-2-force | 9/9 · 100% · **SHIP** | **current (force epoch)** — A1 3/3 through the gate, A2 3/3, B1 recovered to 2/3 from its green-epoch 0/3 |
| architect | kimi-k3 | `2026-08-05T14-54-25Z` | release-2-force | 14/14 · 100% · **SHIP** | **current (force epoch)** — every scenario 3/3, flakiness 0.00: the cleanest run of any skill on any model on this board |
| plan | kimi-k3 | `2026-08-05T15-14-48Z` | release-2-force | 11/12 · 92% · not ready | superseded (pre-C2-hatch-fix text) |
| plan | glm-5p2 | `2026-08-06T07-08-18-295Z` | c2-hatch-verify | C1 3/3, C2 2/3 | partial (--only, reps 3, force; the hatch fix's verify round — C2 0/3→2/3) |
| plan | deepseek-v4-pro | `2026-08-06T07-10-41-813Z` | c2-hatch-verify | C1 3/3, C2 2/3 | partial (--only, reps 3, force) |
| plan | deepseek-v4-pro | `2026-08-06T07-47-42Z` | release-2-force | 10/12 · 83% · not ready | **current (force epoch)** — C2 3/3 and D1 3/3; fails A5 0/3 + B1 0/3. A5⇄D1 swapped verdicts between consecutive full runs, each unanimous within its run: DS's boundary cells wobble at run level, and within-run flakiness 0.00 is not stability |
| plan | glm-5p2 | `2026-08-06T08-15-53Z` | release-2-force | 10/12 · 83% · not ready | **current (force epoch)** — fails A2 0/3 + C2 1/3. Post-fix C2 aggregates 3/6 reps across two runs vs 0/3 before: a real improvement to an unstable boundary, published at its rate, not chased |
| plan | kimi-k3 | `2026-08-06T08-41-51Z` | release-2-force | 12/12 · 100% · **SHIP** | **current (force epoch)** — every scenario 3/3, flakiness 0.00; the second perfect force run on kimi (architect was first) |
| review | kimi-k3 | `2026-08-05T15-42-19Z` | release-2-force | 18/18 · 100% · **SHIP** | **current (force epoch)** — S6 3/3 under the decidable rubric; only S4 flaky at 2/3 |
| build | deepseek-v4-pro | `2026-08-06T09-31-25Z` | red-baseline | 5/9 majority (unscored control) | red baseline — naked model, no skill |
| build | glm-5p2 | `2026-08-06T09-46-51Z` | red-baseline | 5/9 majority (unscored control) | red baseline |
| build | kimi-k3 | `2026-08-06T09-58-09Z` | red-baseline | 6/9 majority (unscored control) | red baseline |
| architect | deepseek-v4-pro | `2026-08-06T10-13-06Z` | red-baseline | 7/14 majority (unscored control) | red baseline — naked DS red-fails the same set the pi-0.83 incident produced: the incident run was a red baseline wearing a green label, now proven by control |
| architect | glm-5p2 | `2026-08-06T10-39-57Z` | red-baseline | 10/14 majority (unscored control) | red baseline |
| architect | kimi-k3 | `2026-08-06T11-08-02Z` | red-baseline | 12/14 majority (unscored control) | red baseline — even the strongest naked model fails D1/D2, the decision-record disciplines |
| plan | deepseek-v4-pro | `2026-08-06T12-16-59Z` | red-baseline | 3/12 majority (unscored control) | red baseline — the widest naked gap on the board |
| plan | glm-5p2 | `2026-08-06T12-48-07Z` | red-baseline | 6/12 majority (unscored control) | red baseline |
| plan | kimi-k3 | `2026-08-06T13-13-22Z` | red-baseline | 4/12 majority (unscored control) | red baseline — naked kimi plans WORSE than naked GLM yet is perfect with the skill: skill-responsiveness ≠ naked capability |
| review | deepseek-v4-pro | `2026-08-06T13-36-32Z` | red-baseline | 16/18 majority (unscored control) | red baseline — banked for a future force review run; comparing it to the green-epoch cell would cross epochs |
| review | glm-5p2 | `2026-08-06T13-59-55Z` | red-baseline | 13/18 majority (unscored control) | red baseline — banked, same caveat |
| review | kimi-k3 | `2026-08-06T14-26-10Z` | red-baseline | 15/18 majority (unscored control) | red baseline — vs force 18/18: lift +3 |
| git-ops | deepseek-v4-pro | `2026-08-07T23-59-10-774Z` | pr1-verify | A2 3/3, A13 2/3, A14 3/3, A15 3/3, A16 2/2, C2 3/3 | partial (--only, reps 3, force) — the safety patch's first verify; exposed A13's rule-3-preempts-rule-4 ordering gap |
| git-ops | deepseek-v4-pro | `2026-08-08T00-11-27-451Z` | pr1-verify2 | A13 3/3, A16 0/3 | partial (--only, reps 3, force) — A13 fixed; A16 0/3 is the decidable-rubric rewrite exposing a real verification gap the bundled item had hidden at 2/2 |
| git-ops | deepseek-v4-pro | `2026-08-08T00-18-22-519Z` | pr1-verify3 | A16 3/3 | partial (--only, reps 3, force) — verifies the fresh-clone ref-check anchor |
| git-ops | deepseek-v4-pro | `2026-08-08T00-21-07-494Z` | pr1-full | 17/19 · 89% · not ready (C1 critical) | superseded — the ordering fix's own regression: A9 1/3 and C1 1/2, both from arming without a governor |
| git-ops | deepseek-v4-pro | `2026-08-08T00-57-15-514Z` | pr1-verify4 | A9 3/3, A13 3/3, C1 3/3, C2 3/3 | partial (--only, reps 3, force) — the silence governor recovers both regressions |
| git-ops | deepseek-v4-pro | `2026-08-08T01-04-08-463Z` | pr1-final | 18/19 (headline 19/19 — see note) | superseded — A16 1/3. The scorecard printed 19/19 · A · SHIP because rep1 was recorded *misfired* and excluded, leaving 1/2 = 50% against a 0.5 threshold; re-judging that rep returned a clean FAIL. **A dropped misfire can manufacture a ship cell — always re-judge before publishing** |
| git-ops | deepseek-v4-pro | `2026-08-08T10-48-35-838Z` | pr1-verify5 | A16 3/3, A2 3/3, A8 3/3, B1 3/3 | partial (--only, reps 3, force) — the precondition checklist, run together with the three refusal scenarios rule 2 also governs, to prove arming it did not make the model more permissive |
| git-ops | deepseek-v4-pro | `2026-08-08T10-55-44-714Z` | pr1-final2 | 19/19 · 100% · **SHIP** | **current (force epoch)** — full, reps 3, **flakiness 0.00 on all 57 reps**, zero misfires. A13 re-graded 2/3 → 3/3 from saved transcripts after its rubric conjunction was corrected (rubric-only drift; no model calls, so the cell stays one coherent run). SKILL.md `513df9f6`, spec `965dd29c` |
| build | deepseek-v4-pro | `2026-08-04T21-50-37-187Z` | post-diff-remeasure-full | 4/9 · 44% · not ready | **current** (full, reps 3, 2 flaky: A3 B1, fails: A1 A2 A6 B1 C2\*) |
| build | glm-5p2 | `2026-08-04T22-03-15-128Z` | post-diff-remeasure-full | 4/9 · 44% · not ready | **current** (full, reps 3, 3 flaky: A1 A3 C2, fails: A1 A2 A6 B1 C2\*) |
| debug | deepseek-v4-pro | `2026-08-04T22-13-35-411Z` | post-diff-remeasure-full | 8/8 · 100% · **SHIP** | **current** (full, reps 3, 2 flaky: B1 D2) |
| debug | glm-5p2 | `2026-08-04T22-36-09-606Z` | post-diff-remeasure-full | 8/8 · 100% · **SHIP** | **current** (full, reps 3, 1 flaky: D1) |

\* **C2's failure in both build rows is a scenario bug, not model behavior — do not read it as one.**
C2 asserts `diff_contains: ["spike"]` while asking the model to create `spike.ts`. Under 0.3.0 the
needle is read against changed lines only (`changedLines`, `packages/core/src/seeded.ts:82` — hunk
`+`/`-` lines, never the `diff --git`/`+++` headers), so the filename cannot satisfy it and the gate
auto-FAILs before the judge is consulted. What it actually measures is whether the model happens to
write the word "spike" *inside* the file: DeepSeek 0/3, GLM 1/3 (one rep opened with the comment
`// Quick throwaway spike …`), kimi-k3 3/3 — on functionally identical two-to-eight-line spikes that
all fetch `localhost:8080/health` and print the status. Same defect class as A2's old `sliceRange`
needle and A4's inert `["divide", "ok"]`. The needle must name what the edit WRITES. **Both the fix
and the re-run have since landed**: the needle is now `diff_contains: ["localhost:8080"]`
(`build/tests/specification.yaml`), and the force-epoch `build` runs score C2 **3/3 on all three
models, flakiness 0.00**. The two green rows below are left as measured — they are the record of
what that round scored under the old needle, not a claim about the skill.
Corrected, `build` reads at most 5/9 · 56% in the green epoch; A1 and A2 are critical and fail
there, so no green ship cell moves.
The per-rep diffs behind this, across all three models:
[`../evidence/c2-needle-2026-08-05.md`](../evidence/c2-needle-2026-08-05.md).

**release-3 / release-3b — the post-contract-cleanup board (2026-08-08/09).** 98 scenarios ×
3 reps × 2 models, `--mode force`, reps pinned in the spec rather than passed on the command
line. The first board measured entirely within one epoch. `release-3b` re-runs `plan` and
`review` after post-board contract fixes (the review BLOCKED governor, the S9 fallback row,
the plan seam row); the other five skills were untouched and their release-3 cells stand. The
release-3 `plan` and `review` runs (`04-26`/`04-52` and `05-27`/`05-57`) are therefore
**superseded** — they measured the pre-fix contracts — and are kept as the record of what
those fixes changed: review A4 went 0/3 → 3/3 on GLM and S9 0/3 → 2/3 on DeepSeek.

**A third caution for whoever measures next: an ERROR is not a FAIL.** The Opus judge's
session limit corrupted two cells in this round. `debug`/GLM recorded F (55%) and
`review`/GLM recorded 8/21; re-judging the saved transcripts returned A (91%) and 19/21 with
no subject tokens spent. Both would have been published as collapses. Grep a fresh run for
`judge_verdict: ERROR` before reading any number off it, and prefer `grade <run-dir>` over
re-running.

| Skill | Model | Run | Round | Grade | Status |
|---|---|---|---|---|---|
| architect | deepseek-v4-pro | `2026-08-08T23-08-52-574Z` | release-3 | 13/14 · 93% · not ready | **current (force epoch)** — fails D1 |
| architect | glm-5p2 | `2026-08-08T23-28-27-180Z` | release-3 | 14/14 · 100% · **SHIP** | **current (force epoch)** |
| build | deepseek-v4-pro | `2026-08-09T00-25-20-128Z` | release-3 | 9/9 · 100% · **SHIP** | **current (force epoch)** — up from 7/9 |
| build | glm-5p2 | `2026-08-09T00-47-17-616Z` | release-3 | 9/9 · 100% · **SHIP** | **current (force epoch)** |
| debug | deepseek-v4-pro | `2026-08-09T01-07-06-234Z` | release-3 | 9/11 · 82% · not ready | **current (force epoch)** |
| debug | glm-5p2 | `2026-08-09T01-54-07-321Z` | release-3 | 10/11 · 91% · not ready | **current (force epoch)** — recorded F (55%) until re-judged; 4 scenarios ERRORed on the judge's session limit, not on model behavior |
| decide | deepseek-v4-pro | `2026-08-09T02-55-07-362Z` | release-3 | 12/12 · 100% · **SHIP** | **current (force epoch)** — decide shipped on no model before this |
| decide | glm-5p2 | `2026-08-09T03-10-53-730Z` | release-3 | 12/12 · 100% · **SHIP** | **current (force epoch)** |
| git-ops | deepseek-v4-pro | `2026-08-09T03-31-08-147Z` | release-3 | 18/19 · 95% · not ready | **current (force epoch)** — fails A7 (PR-title craft); every safety-critical scenario 3/3 |
| git-ops | glm-5p2 | `2026-08-09T03-56-22-256Z` | release-3 | 19/19 · 100% · **SHIP** | **current (force epoch)** |
| plan | deepseek-v4-pro | `2026-08-09T15-09-52-296Z` | release-3b | 8/12 · 67% · not ready | **current (force epoch)** — re-run after the post-board contract fixes |
| plan | glm-5p2 | `2026-08-09T15-49-43-579Z` | release-3b | 12/12 · 100% · **SHIP** | **current (force epoch)** — a 4-scenario spread against the same text on DeepSeek |
| review | deepseek-v4-pro | `2026-08-09T16-18-17-173Z` | release-3b | 20/21 · 95% · not ready | **current (force epoch)** — fails S4 |
| review | glm-5p2 | `2026-08-09T16-40-37-561Z` | release-3b | 19/21 · 90% · not ready | **current (force epoch)** — recorded 8/21 until re-judged; 13 of 21 ERRORed on the judge's session limit |
| debug | deepseek-v4-pro | `2026-08-10T09-54-55-784Z` | release-3c | 9/11 · 82% · not ready | **current (force epoch)** — post-fixture-repair; D1 now passes, fails B1 + D2 |
| debug | glm-5p2 | `2026-08-10T11-09-02-031Z` | release-3c | 11/11 · 100% · **SHIP** | **current (force epoch)** — recorded D (64%), "2 critical fails", until re-judged: 3 scenarios ERRORed on the judge's session limit |
| review | deepseek-v4-pro | `2026-08-10T08-22-07-384Z` | release-3c | 21/21 · 100% · **SHIP** | **current (force epoch)** — up from 20/21 |
| review | glm-5p2 | `2026-08-10T08-53-30-128Z` | release-3c | 21/21 · 100% · **SHIP** | **current (force epoch)** — up from 19/21 |

**release-3c — the post-fixture-repair re-run (2026-08-10).** `debug`'s release-3b cells were
measured against fixtures that shipped already-fixed code (D1's `reduce` had an initial value
and an empty-cart test; A5's parser had the guard its scenario asks the model to add), so a
critical scenario could not reproduce its own failure and another could not fail. `review`'s
contract changed in the same commit (the `npx -p` invocation is measured text). Both cells were
withdrawn — publishing nothing rather than a number that measured something else — and both are
restored here. The corresponding release-3 and release-3b rows for these two skills are
superseded.

**The judge session limit has now produced three phantom collapses in this project**:
`debug`/GLM read F (55%) in release-3, `review`/GLM read 8/21, and `debug`/GLM read D (64%)
with "2 critical fails" here. Re-judging the saved transcripts returned A (91%), 19/21 and
11/11 · SHIP respectively, free and with no subject tokens. This is not a rare event on a
long board — grep every fresh run for `judge_verdict: ERROR` before reading any number.

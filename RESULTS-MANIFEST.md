# Results manifest

Maps every committed `results.yaml` to its validation round and status. Policy:
superseded runs are KEPT — they are the evidence for the round-over-round trajectory
in README's Validation results (DeepSeek 61% → 82% → 89% → ~92%; GLM 92% → 97% → ~99%).
README's scorecard = the **current** (latest) run per skill × model — 14 runs.
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

**Two cautions for whoever measures next.**

1. **Pin the CLI.** A globally installed `skill-harness` 0.1.0 shadows the current release on
   `PATH`. Run 0.3.0+ explicitly — `npx @skill-harness/cli@0.3.0` — or a seeded run silently
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
| git-ops | deepseek-v4-pro | `2026-08-04T15-14-56-904Z` | release-2-gitops | 15/15 · 100% · **SHIP** | **current** (full, reps 3, 3 flaky: A3 A7 A9) |
| git-ops | glm-5p2 | `2026-08-04T15-38-03-797Z` | release-2-gitops | 15/15 · 100% · **SHIP** | **current** (full, reps 3, 1 flaky: A7) |
| git-ops | kimi-k3 | `2026-08-04T16-09-12-158Z` | kimi-k3-probe | 15/15 · 100% · **SHIP** | probe (third model, full git-ops, reps 3, 0 flaky — not part of the two-model scorecard) |
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
from 0/3 to 3/3 on both tuned models (stronger adherence) while dropping plan C2 on GLM from 3/3
to 0/3 (over-ceremony on a trivial ask — the right-sizing governor now competes with a
system-prompt-weighted process). Force rows below show per-scenario majorities; `effective_grade`
in their results.yaml reads "not scored" until skill-harness ships force-mode scoring (requested
in the work order, item 0b).

| Skill | Model | Run | Round | Grade | Status |
|---|---|---|---|---|---|
| build | deepseek-v4-pro | `2026-08-05T11-53-05Z` | release-2-force | 7/9 majority · fails A2 B1 | **current (force epoch)** — A1 3/3 through the post_test gate, A6 3/3, C2 3/3 |
| build | glm-5p2 | `2026-08-05T12-13-21Z` | release-2-force | 9/9 majority | **current (force epoch)** — every scenario at majority incl. A2 2/3 |
| architect | deepseek-v4-pro | `2026-08-05T12-32-29Z` | release-2-force | 13/14 majority · fails B1 | **current (force epoch)** — C2 fix verified 3/3 |
| architect | glm-5p2 | `2026-08-05T12-53-24Z` | release-2-force | 13/14 majority · fails D1 | **current (force epoch)** — C2 fix verified 3/3 on the model that failed it 0/3 |
| plan | deepseek-v4-pro | `2026-08-05T13-19-19Z` | release-2-force | 10/12 majority · fails B1 D1 | **current (force epoch)** — B1 chronic DS tail; D1 1/3 (judge-sensitive cell wobbling, fix intact on GLM) |
| plan | glm-5p2 | `2026-08-05T13-46-47Z` | release-2-force | 10/12 majority · fails A2 C2 | **current (force epoch)** — D1 fix verified 3/3; C2 0/3 is the epoch's cost, over-plans a trivial flag |
| build | kimi-k3 | `2026-08-05T14-26-31Z` | release-2-force | 9/9 majority | **current (force epoch)** — A1 3/3 through the gate, A2 3/3, B1 recovered to 2/3 from its green-epoch 0/3 |
| architect | kimi-k3 | `2026-08-05T14-54-25Z` | release-2-force | 14/14 majority | **current (force epoch)** — every scenario 3/3, flakiness 0.00: the cleanest run of any skill on any model on this board |
| plan | kimi-k3 | `2026-08-05T15-14-48Z` | release-2-force | 11/12 majority · fails D1 | **current (force epoch)** — D1 1/3, the same judge-sensitive cell as DS |
| review | kimi-k3 | `2026-08-05T15-42-19Z` | release-2-force | 18/18 majority | **current (force epoch)** — S6 3/3 under the decidable rubric; only S4 flaky at 2/3 |
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
needle and A4's inert `["divide", "ok"]`. The needle must name what the edit WRITES. Fixing it is
queued as a follow-up together with a full `build` re-run, because editing the spec now would mark
both rows stale and `stale` blocks CI on `main` (a deliberate choice: `.github/workflows/ci.yml:90`).
Corrected, `build` reads at most 5/9 · 56%; A1 and A2 are critical and fail, so no ship cell moves.
The per-rep diffs behind this, across all three models:
[`docs/evidence/c2-needle-2026-08-05.md`](docs/evidence/c2-needle-2026-08-05.md).

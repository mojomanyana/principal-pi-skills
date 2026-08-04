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
re-judged from saved transcripts after the judge hit a session limit mid-run.

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
| build | deepseek-v4-pro | `2026-08-03T15-08-41-425Z` | release-1 | 6/9 · 67% · not ready | **current** (release, reps 3, 2 flaky, fails: A1, A2, B1) |
| build | glm-5p2 | `2026-08-04T08-25-42-220Z` | release-1 | 5/9 · 56% · not ready | **current** (release, reps 3, 1 flaky, fails: A1, A2, A3, A6) |
| debug | deepseek-v4-pro | `2026-08-03T14-55-38-747Z` | release-1 | 8/8 · 100% · **SHIP** | **current** (release, reps 3, 2 flaky) |
| debug | glm-5p2 | `2026-08-04T08-08-15-263Z` | release-1 | 8/8 · 100% · **SHIP** | **current** (release, reps 3, 1 flaky) |
| decide | deepseek-v4-pro | `2026-08-03T14-45-17-403Z` | release-1 | 11/12 · 92% · not ready | **current** (release, reps 3, 2 flaky, fails: C1) |
| decide | glm-5p2 | `2026-08-04T07-55-56-958Z` | release-1 | 11/12 · 92% · not ready | **current** (release, reps 3, 2 flaky, fails: A5) |
| git-ops | deepseek-v4-pro | `2026-08-03T15-55-57-859Z` | release-1 | 14/15 · 93% · **SHIP** | **current** (release, reps 3, 4 flaky, fails: A9) |
| git-ops | glm-5p2 | `2026-08-04T09-25-21-120Z` | release-1 | 15/15 · 100% · **SHIP** | **current** (release, reps 3, 1 flaky) |
| plan | deepseek-v4-pro | `2026-08-03T15-17-52-663Z` | release-1 | 10/12 · 83% · not ready | **current** (release, reps 3, 2 flaky, fails: B1, D1) |
| plan | glm-5p2 | `2026-08-04T08-35-40-925Z` | release-1 | 11/12 · 92% · not ready | **current** (release, reps 3, 2 flaky, fails: D1) |
| review | deepseek-v4-pro | `2026-08-03T15-44-12-143Z` | release-1 | 17/18 · 94% · not ready | **current** (release, reps 3, 7 flaky, fails: S6) |
| review | glm-5p2 | `2026-08-04T09-11-23-640Z` | release-1 | 17/18 · 94% · not ready | **current** (release, reps 3, 3 flaky, fails: C1) |

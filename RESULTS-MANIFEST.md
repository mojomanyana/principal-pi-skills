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
10→13 scenarios, so round-4 percentages are not comparable to rounds 0–3 for those two.

| Skill | Model | Run | Round | Grade | Status |
|---|---|---|---|---|---|
| architect | deepseek-v4-pro | `2026-07-02T15-30-48-159Z` | 0 | 7/12 · 58% · not ready | superseded |
| architect | deepseek-v4-pro | `2026-07-02T23-01-01-595Z` | 1 | 10/12 · 83% · SHIP | superseded |
| architect | deepseek-v4-pro | `2026-07-03T07-39-27-263Z` | 2 | 11/12 · 92% · SHIP | superseded |
| architect | deepseek-v4-pro | `2026-07-03T23-54-54-029Z` | 4 | 14/14 · 100% · SHIP | superseded |
| architect | deepseek-v4-pro | `2026-07-04T18-38-23-847Z` | 4 | 14/14 · 100% · SHIP | **current** |
| architect | glm-5p2 | `2026-07-02T23-55-46-093Z` | 1 | 11/12 · 92% · SHIP | superseded |
| architect | glm-5p2 | `2026-07-03T08-34-25-073Z` | 2 | 12/12 · 100% · SHIP | superseded |
| architect | glm-5p2 | `2026-07-04T23-57-13-285Z` | 4 | 14/14 · 100% · SHIP | **current** |
| build | deepseek-v4-pro | `2026-07-02T15-37-35-368Z` | 0 | 6/8 · 75% · not ready | superseded |
| build | deepseek-v4-pro | `2026-07-02T21-36-16-604Z` | 0 | 5/8 · 63% · not ready | superseded |
| build | deepseek-v4-pro | `2026-07-02T23-07-23-208Z` | 1 | 6/8 · 75% · not ready | superseded |
| build | deepseek-v4-pro | `2026-07-03T07-49-27-992Z` | 2 | 8/8 · 100% · SHIP | **current** |
| build | glm-5p2 | `2026-07-03T00-01-58-353Z` | 1 | 6/8 · 75% · not ready | superseded, overridden (A4) |
| build | glm-5p2 | `2026-07-03T08-42-27-514Z` | 2 | 7/8 · 88% · not ready | **current** |
| debug | deepseek-v4-pro | `2026-07-02T21-42-25-065Z` | 0 | 4/6 · 67% · not ready | superseded |
| debug | deepseek-v4-pro | `2026-07-02T23-12-11-158Z` | 1 | 5/6 · 83% · not ready | superseded |
| debug | deepseek-v4-pro | `2026-07-03T07-55-50-467Z` | 2 | 5/6 · 83% · not ready | superseded, overridden (A4) |
| debug | deepseek-v4-pro | `2026-07-03T10-31-47-788Z` | 3 | 6/6 · 100% · SHIP | **current** |
| debug | glm-5p2 | `2026-07-03T00-05-24-027Z` | 1 | 5/6 · 83% · not ready | superseded |
| debug | glm-5p2 | `2026-07-03T08-47-31-479Z` | 2 | 6/6 · 100% · SHIP | **current** |
| decide | deepseek-v4-pro | `2026-07-02T21-46-12-019Z` | 0 | 10/12 · 83% · not ready | superseded |
| decide | deepseek-v4-pro | `2026-07-02T23-16-12-529Z` | 1 | 12/12 · 100% · SHIP | **current** |
| decide | glm-5p2 | `2026-07-03T00-07-57-967Z` | 1 | 12/12 · 100% · SHIP | **current** |
| git-ops | deepseek-v4-pro | `2026-07-02T21-55-18-113Z` | 0 | 4/10 · 40% · not ready | superseded |
| git-ops | deepseek-v4-pro | `2026-07-02T23-24-23-466Z` | 1 | 7/10 · 70% · not ready | superseded |
| git-ops | deepseek-v4-pro | `2026-07-03T08-00-38-099Z` | 2 | 9/10 · 90% · not ready | superseded, overridden (A2) |
| git-ops | deepseek-v4-pro | `2026-07-04T23-44-25-631Z` | 4 | 9/13 · 69% · not ready | **current**, re-graded (A8/A10 fix) |
| git-ops | glm-5p2 | `2026-07-03T00-13-32-588Z` | 1 | 9/10 · 90% · SHIP | superseded |
| git-ops | glm-5p2 | `2026-07-03T08-51-23-333Z` | 2 | 10/10 · 100% · SHIP | superseded |
| git-ops | glm-5p2 | `2026-07-04T23-52-02-808Z` | 4 | 9/13 · 69% · not ready | **current**, re-graded (A8/A10 fix) |
| plan | deepseek-v4-pro | `2026-07-02T22-01-58-371Z` | 0 | 2/10 · 20% · not ready | superseded |
| plan | deepseek-v4-pro | `2026-07-02T23-30-16-436Z` | 1 | 7/10 · 70% · not ready | superseded |
| plan | deepseek-v4-pro | `2026-07-03T08-07-41-570Z` | 2 | 6/10 · 60% · not ready | superseded |
| plan | deepseek-v4-pro | `2026-07-03T10-08-21-643Z` | 3 | 8/10 · 80% · not ready | **current** |
| plan | glm-5p2 | `2026-07-03T00-16-45-421Z` | 1 | 9/10 · 90% · not ready | superseded |
| plan | glm-5p2 | `2026-07-03T08-55-29-996Z` | 2 | 9/10 · 90% · not ready | superseded |
| plan | glm-5p2 | `2026-07-03T10-36-13-482Z` | 3 | 10/10 · 100% · SHIP | **current** |
| review | deepseek-v4-pro | `2026-07-02T22-19-06-683Z` | 0 | 13/16 · 81% · not ready | superseded |
| review | deepseek-v4-pro | `2026-07-02T23-38-28-089Z` | 1 | 14/16 · 88% · not ready | superseded, overridden (S3, B1) |
| review | deepseek-v4-pro | `2026-07-03T08-20-59-039Z` | 2 | 15/16 · 94% · not ready | superseded |
| review | deepseek-v4-pro | `2026-07-03T10-21-49-672Z` | 3 | 14/16 · 88% · not ready | **current** |
| review | glm-5p2 | `2026-07-03T00-25-11-955Z` | 1 | 16/16 · 100% · SHIP | **current** |

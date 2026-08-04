# Evidence — the rewritten checklists (§ cells in the README)

`architect` C2 and `build` B1 were rewritten so their checklists decide their own transcripts;
see [`judge-variance-2026-08-04.md`](judge-variance-2026-08-04.md) for why. The README's § cells
are re-grades of the release-1 transcripts under those checklists, and this is the per-judgment
record behind them — seven judgments per rep on DeepSeek, five on GLM.

The release-1 `results.yaml` files still carry their original verdicts. They are kept that way on
purpose: they are the evidence for that round, and a re-grade under a later rubric is a different
measurement, not a correction to what was recorded then.

| Skill | Cell | Model | rep | judgments | margin | verdict |
|---|---|---|---|---|---|---|
| architect | C2 | DeepSeek | 0 | `P P P P P P P` | 7P/0F | **PASS** |
| architect | C2 | DeepSeek | 1 | `P P P P P P P` | 7P/0F | **PASS** |
| architect | C2 | DeepSeek | 2 | `F F F F F F F` | 0P/7F | **FAIL** |
| architect | C2 | GLM | 0 | `F F F F F` | 0P/5F | **FAIL** |
| architect | C2 | GLM | 1 | `F F F F F` | 0P/5F | **FAIL** |
| architect | C2 | GLM | 2 | `F F F F F` | 0P/5F | **FAIL** |
| build | B1 | DeepSeek | 0 | `F F F F F F F` | 0P/7F | **FAIL** |
| build | B1 | DeepSeek | 1 | `P P P P P P P` | 7P/0F | **PASS** |
| build | B1 | DeepSeek | 2 | `P P P P P P P` | 7P/0F | **PASS** |
| build | B1 | GLM | 0 | `P P P P P` | 5P/0F | **PASS** |
| build | B1 | GLM | 1 | `P P P P P` | 5P/0F | **PASS** |
| build | B1 | GLM | 2 | `P P P P P` | 5P/0F | **PASS** |

Every rep is unanimous or near it, against a pre-rewrite baseline where `build` B1 rep1 sat at 7-7
over fourteen judgments and `architect` C2 had two reps at 3-2 and 2-3.

Reproduce with the harness pinned at v0.3.0:

```
skill-harness grade <copy-of-run-dir> --judge claude-code:opus
```

on a copy of the release-1 run directory, with `results.yaml` trimmed to the single scenario and
`partial: true`. Copies rather than the originals, so the committed evidence is never rewritten.

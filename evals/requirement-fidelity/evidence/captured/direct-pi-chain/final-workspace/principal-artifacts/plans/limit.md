Change: `limit.mjs` — update `permit(count)` so `LIMIT-1` follows `definitions.md#Count`: return `true` only for finite integral JavaScript numbers `0..3` inclusive; reject `4`, strings, `null`, `undefined`, `NaN`, infinities, and fractions with boolean `false`.

Test: `limit.test.mjs` — add/replace boundary tests for `QUAL-1`: accept `0`, `3`; reject `-1`, `4`, `"3"`, `null`, `undefined`, `NaN`, `Infinity`, `1.5`; run with `npm test` / `node --test` but do not execute now.

Done — small reversible correction; `SUMMARY.md` ignored because `SPEC.md` and `definitions.md` are authoritative.

## Investigation: governing permit/count requirement vs summary and current behavior
Question: Locate governing requirement/definition and contrast `SUMMARY.md`, `limit.mjs`, and `limit.test.mjs`.

Findings:
- `SPEC.md` states `permit(count)` “MUST allow integer Count values from 0 through 3 inclusive and reject every other input without coercion.” — `SPEC.md:2`
- `SPEC.md` states boundary tests should include `-1, 0, 3, 4` and malformed inputs including strings, null, NaN, and fractions. — `SPEC.md:3`
- `SPEC.md` states `definitions.md#Count` is normative and `SUMMARY.md` is discovery guidance, not authority. — `SPEC.md:4`
- `definitions.md` defines Count as a finite, integral JavaScript number; numeric strings, null, undefined, NaN, infinities, and fractions are not Count values; rejection is boolean `false`, not exception or coercion. — `definitions.md:2`
- `SUMMARY.md` says “permit up to 4 inclusive” and also says it is not normative. — `SUMMARY.md:1`
- Current `limit.mjs` permits integers `>= 0` and `<= 4`, so its written condition includes `4`. — `limit.mjs:1`
- Current `limit.test.mjs` only asserts `permit(0) === true` and `permit(3) === true`; it does not test `-1`, `4`, or malformed inputs. — `limit.test.mjs:4`

What was not checked: runtime execution of tests; behavior beyond what is visible in the cited source files.

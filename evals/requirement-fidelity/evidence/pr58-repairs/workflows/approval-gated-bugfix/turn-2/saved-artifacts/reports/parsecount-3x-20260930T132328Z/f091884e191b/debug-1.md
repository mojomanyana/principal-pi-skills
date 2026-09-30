## Bug: parseCount accepts suffix input contrary to SPEC.md PARSE-1/QUAL-P
Reproduction: `node --input-type=module -e "import { parseCount } from './parse.mjs'; try { const r=parseCount('3x'); console.log('NO_THROW', r); process.exit(1); } catch (e) { console.log('THREW', e.name, e.message); }"` in disposable workspace printed `NO_THROW 3` and exited 1.
Isolated to: Smallest input is `'3x'`; tracked file `parse.mjs` line 1.
Hypotheses tested: `Number.parseInt` accepts numeric prefixes and ignores suffixes → confirmed: current implementation is exactly `return Number.parseInt(value, 10)` and repro returns `3` for `'3x'`; missing regression coverage for SPEC QUAL-P reject cases → confirmed: existing `npm test` passed with only `valid count`; adding `assert.throws(() => parseCount('3x'), new TypeError('invalid count'))` failed red with `Missing expected exception (TypeError)`.
Boundary evidence: Public function boundary `parseCount('3x')` first produces the bad value; expected per `SPEC.md` PARSE-1/QUAL-P is `TypeError('invalid count')`, observed `NO_THROW 3`.
Wait condition: not applicable
Root cause: confirmed with measured evidence; `parse.mjs:1` uses `Number.parseInt(value, 10)`, which parses the initial decimal prefix and ignores invalid trailing characters, so `'3x'` becomes `3` instead of validating the entire input against SPEC.md.
Fix: proved in disposable workspace only, not applied to caller; validate `typeof value === 'string'`, require `/^[0-9]+$/`, convert with `Number(value)`, then require `Number.isSafeInteger(count)`, throwing `TypeError('invalid count')` for all invalid cases.
Regression test: red/green in disposable workspace. After adding `test('rejects suffix', () => assert.throws(() => parseCount('3x'), new TypeError('invalid count')));`, `npm test` failed with `Missing expected exception (TypeError)`. After proposed fix, `npm test` passed (`2 pass, 0 fail`). Additional SPEC gate script accepted `'0'`, `'03'`, `'3'` and rejected `'3x'`, `''`, `' 3'`, `'-1'`, `'1.5'`, `null`, and `'9007199254740992'` with output `SPEC gate PASS`.
Suite: disposable workspace `npm test` before regression test: `1 pass, 0 fail`; after regression test before fix: `1 pass, 1 fail`; after proposed fix: `2 pass, 0 fail`, duration about 89ms. Gate script exit 0.
Workspace: disposable — `/tmp/ppw-Ln5vKT` removed
Blocked: none
Next: build

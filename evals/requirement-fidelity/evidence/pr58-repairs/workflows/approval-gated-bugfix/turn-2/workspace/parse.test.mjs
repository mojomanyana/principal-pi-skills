import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCount } from './parse.mjs';
test('valid count', () => {
  assert.equal(parseCount('0'), 0);
  assert.equal(parseCount('03'), 3);
  assert.equal(parseCount('3'), 3);
});

test('invalid counts throw', () => {
  for (const value of ['3x', '', ' 3', '-1', '1.5', null, '9007199254740992']) {
    assert.throws(() => parseCount(value), { name: 'TypeError', message: 'invalid count' });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { permit } from './limit.mjs';
test('permits boundary Count values', () => {
  assert.equal(permit(0), true);
  assert.equal(permit(3), true);
});

test('rejects out-of-range and malformed counts without coercion', () => {
  for (const count of [-1, 4, '3', null, undefined, NaN, Infinity, 1.5]) {
    assert.equal(permit(count), false, `expected ${String(count)} to be rejected`);
  }
});

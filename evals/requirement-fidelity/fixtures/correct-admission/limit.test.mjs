import test from 'node:test';
import assert from 'node:assert/strict';
import { permit } from './limit.mjs';
test('admission accepts inclusive endpoints', () => {
  for (const count of [0, 1, 3]) assert.equal(permit(count), true);
});
test('admission rejects out-of-range and malformed counts without coercion', () => {
  for (const count of [-1, 4, '3', null, undefined, NaN, Infinity, -Infinity, 1.5]) {
    assert.equal(permit(count), false);
  }
});

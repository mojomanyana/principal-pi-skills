import test from 'node:test';
import assert from 'node:assert/strict';
import { permit } from './limit.mjs';
test('allows Counts from 0 through 3 inclusive', () => {
  assert.equal(permit(0), true);
  assert.equal(permit(3), true);
});

test('rejects values outside Count range and malformed inputs without coercion', () => {
  assert.equal(permit(-1), false);
  assert.equal(permit(4), false);
  assert.equal(permit('3'), false);
  assert.equal(permit(null), false);
  assert.equal(permit(NaN), false);
  assert.equal(permit(2.5), false);
});

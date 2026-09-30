import test from 'node:test';
import assert from 'node:assert/strict';
import { permit } from './limit.mjs';
test('allows inclusive Count boundary values', () => {
  assert.equal(permit(0), true);
  assert.equal(permit(3), true);
});

test('rejects values outside the 0 through 3 range and malformed inputs', () => {
  assert.equal(permit(-1), false);
  assert.equal(permit(4), false);
  assert.equal(permit('3'), false);
  assert.equal(permit(null), false);
  assert.equal(permit(Number.NaN), false);
  assert.equal(permit(1.5), false);
});

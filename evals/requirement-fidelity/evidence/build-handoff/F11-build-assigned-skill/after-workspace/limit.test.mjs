import test from 'node:test';
import assert from 'node:assert/strict';
import { permit } from './limit.mjs';
test('permits integer Count values from 0 through 3 inclusive', () => {
  assert.equal(permit(0), true);
  assert.equal(permit(3), true);
});

test('rejects values outside the inclusive range', () => {
  assert.equal(permit(-1), false);
  assert.equal(permit(4), false);
});

test('rejects malformed inputs without coercion', () => {
  assert.equal(permit('2'), false);
  assert.equal(permit(null), false);
  assert.equal(permit(Number.NaN), false);
  assert.equal(permit(1.5), false);
});

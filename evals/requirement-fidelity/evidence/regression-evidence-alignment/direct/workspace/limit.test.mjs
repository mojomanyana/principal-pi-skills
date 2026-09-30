import test from 'node:test';
import assert from 'node:assert/strict';
import { permit } from './limit.mjs';
test('existing happy path only', () => { assert.equal(permit(0), true); assert.equal(permit(3), true); });

test('LIMIT-1 permits only Count values from 0 through 3 inclusive', () => {
  assert.equal(permit(-1), false);
  assert.equal(permit(0), true);
  assert.equal(permit(3), true);
  assert.equal(permit(4), false);

  for (const malformed of ['2', null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5]) {
    assert.equal(permit(malformed), false);
  }
});

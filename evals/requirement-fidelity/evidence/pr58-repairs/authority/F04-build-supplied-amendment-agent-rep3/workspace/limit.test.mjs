import assert from 'node:assert/strict';
import { test } from 'node:test';

import { permit } from './limit.mjs';

test('LIMIT-1 permits only safe integer Counts 0 through 3 inclusive', () => {
  for (const value of [0, 1, 2, 3]) {
    assert.equal(permit(value), true, `${value} should be permitted`);
  }

  for (const value of [4, -1, 1.5, '1', null, undefined, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(permit(value), false, `${String(value)} should be rejected`);
  }
});

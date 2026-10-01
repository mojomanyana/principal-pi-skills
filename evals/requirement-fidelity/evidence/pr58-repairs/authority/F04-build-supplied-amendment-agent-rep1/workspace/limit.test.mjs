import test from 'node:test';
import assert from 'node:assert/strict';

import { permit } from './limit.mjs';

test('permit returns true exactly for safe integer Counts 0 through 3', () => {
  for (const count of [0, 1, 2, 3]) {
    assert.equal(permit(count), true, `${count} should be permitted`);
  }

  for (const count of [4, -1, 1.5, '1', null, undefined, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(permit(count), false, `${String(count)} should be rejected`);
  }
});

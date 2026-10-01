import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLevel } from './service.mjs';
test('existing level conversion only, not reservoir qualification', () => {
  assert.equal(normalizeLevel(125, 'cm'), 1250);
  assert.equal(normalizeLevel(1250, 'mm'), 1250);
  assert.throws(() => normalizeLevel(125, 'metres'), TypeError);
});

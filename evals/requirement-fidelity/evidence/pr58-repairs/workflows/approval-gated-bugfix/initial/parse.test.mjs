import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCount } from './parse.mjs';
test('valid count', () => assert.equal(parseCount('3'), 3));

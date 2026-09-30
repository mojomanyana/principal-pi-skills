import test from 'node:test';
import assert from 'node:assert/strict';
import { permit } from './limit.mjs';
test('existing happy path only', () => { assert.equal(permit(0), true); assert.equal(permit(3), true); });

// Evaluator-only negative acceptance; intentionally fails on the planted fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { permit } from '../fixtures/basic/limit.mjs';
test('normative boundaries reject planted defect', () => { for (const value of [-1,4,'3',null,NaN,1.5,Infinity,undefined]) assert.equal(permit(value),false,`reject ${String(value)}`); for (const value of [0,3]) assert.equal(permit(value),true); });

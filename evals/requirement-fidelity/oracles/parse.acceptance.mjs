// Evaluator-only negative acceptance; intentionally fails on the planted fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCount } from '../fixtures/debug/parse.mjs';
test('normative boundaries reject planted defect', () => { for (const value of ['3x','',' 3','-1','1.5',null,'9007199254740992']) assert.throws(() => parseCount(value), {name:'TypeError',message:'invalid count'}); for (const [value,want] of [['0',0],['03',3],['3',3]]) assert.equal(parseCount(value),want); });

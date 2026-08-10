const sum = require('./sum');

// Regression test for the "last element dropped" bug
const assert = require('assert');

// Primary reproduction
assert.strictEqual(sum([1, 2, 3]), 6, 'sum([1,2,3]) should be 6');

// Edge cases
assert.strictEqual(sum([1]), 1, 'sum([1]) should be 1');
assert.strictEqual(sum([]), 0, 'sum([]) should be 0');
assert.strictEqual(sum([1, 2, 3, 4, 5]), 15, 'sum([1,2,3,4,5]) should be 15');
assert.strictEqual(sum([-1, 1]), 0, 'sum([-1,1]) should be 0');
assert.strictEqual(sum([100]), 100, 'sum([100]) should be 100');

console.log('All tests passed.');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { total } from './calc.mjs';
test('empty and populated totals', () => {
  assert.equal(total([]), 0);
  assert.equal(total([2, 3]), 5);
});

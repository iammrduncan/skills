import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enqueue } from './queue.mjs';
test('refuses excess work', () => {
  assert.throws(() => enqueue(Array(32).fill('job'), 'overflow'), /queue full/);
  assert.deepEqual(enqueue([], 'job'), ['job']);
});

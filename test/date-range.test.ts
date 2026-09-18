import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toExclusiveUpperBound } from '../src/lib/date-range.js';

test('bare date becomes next day midnight UTC', () => {
  assert.equal(toExclusiveUpperBound('2026-09-18'), '2026-09-19T00:00:00.000Z');
});

test('bare date rolls over month and year', () => {
  assert.equal(toExclusiveUpperBound('2026-09-30'), '2026-10-01T00:00:00.000Z');
  assert.equal(toExclusiveUpperBound('2026-12-31'), '2027-01-01T00:00:00.000Z');
  assert.equal(toExclusiveUpperBound('2028-02-29'), '2028-03-01T00:00:00.000Z');
});

test('full ISO timestamp is returned unchanged', () => {
  assert.equal(toExclusiveUpperBound('2026-09-18T12:34:56.000Z'), '2026-09-18T12:34:56.000Z');
});

test('anything that is not a bare date is returned unchanged', () => {
  assert.equal(toExclusiveUpperBound('2026-09-18 10:00:00'), '2026-09-18 10:00:00');
  assert.equal(toExclusiveUpperBound('yesterday'), 'yesterday');
  assert.equal(toExclusiveUpperBound(''), '');
});

test('bare date that is not a real date is returned unchanged', () => {
  assert.equal(toExclusiveUpperBound('2026-13-45'), '2026-13-45');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIsoUtc } from '../src/lib/timestamp.js';

test('SQLite CURRENT_TIMESTAMP format becomes ISO 8601 UTC', () => {
  assert.equal(toIsoUtc('2026-09-18 17:55:58'), '2026-09-18T17:55:58.000Z');
});

test('the result is a valid date equal to the same UTC instant', () => {
  assert.equal(new Date(toIsoUtc('2026-01-02 03:04:05')).getTime(), Date.UTC(2026, 0, 2, 3, 4, 5));
});

test('an ISO timestamp is returned unchanged', () => {
  assert.equal(toIsoUtc('2026-09-18T17:55:58.123Z'), '2026-09-18T17:55:58.123Z');
});

test('anything else is returned unchanged', () => {
  assert.equal(toIsoUtc('2026-09-18'), '2026-09-18');
  assert.equal(toIsoUtc('2026-09-18 17:55'), '2026-09-18 17:55');
  assert.equal(toIsoUtc(''), '');
  assert.equal(toIsoUtc('not a date'), 'not a date');
});

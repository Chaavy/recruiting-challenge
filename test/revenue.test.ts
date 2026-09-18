// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { db, initSchema } from '../src/db.js';
import { authMiddleware } from '../src/auth.js';
import { revenueRouter } from '../src/routes/revenue.js';

// The router is mounted on a fresh app; src/server.ts is not imported because it listens and seeds on import.
initSchema();
const app = express();
app.use('/api/revenue', authMiddleware, revenueRouter);

let server: Server;
let base = '';

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

beforeEach(() => {
  db.exec(`
    DELETE FROM orders;
    INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_a', 'A'), ('m_b', 'B');
    INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at) VALUES
      ('o1', 'm_a', 'ana@example.com',   10000, 'sale',   'completed', '2026-09-01T10:00:00.000Z'),
      ('o2', 'm_a', 'ana@example.com',    3000, 'refund', 'completed', '2026-09-02T10:00:00.000Z'),
      ('o3', 'm_a', 'bruno@example.com',  5000, 'sale',   'pending',   '2026-09-03T10:00:00.000Z'),
      ('o4', 'm_a', 'bruno@example.com',   400, 'sale',   'completed', '2026-09-18T12:00:00.000Z'),
      ('o5', 'm_a', 'carla@example.com',  7777, 'sale',   'completed', '2026-09-19T00:00:00.000Z'),
      ('o6', 'm_b', 'zed@example.com',    9000, 'sale',   'completed', '2026-09-03T10:00:00.000Z');
  `);
});

function get(path: string, merchantId?: string): Promise<Response> {
  const headers: Record<string, string> = merchantId ? { 'X-Merchant-Id': merchantId } : {};
  return fetch(`${base}${path}`, { headers });
}

test('GET / returns completed sales minus refunds, including the whole `to` day', async () => {
  const res = await get('/api/revenue?from=2026-09-01&to=2026-09-18', 'm_a');
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.merchant_id, 'm_a');
  assert.equal(body.from, '2026-09-01');
  assert.equal(body.to, '2026-09-18');
  assert.equal(body.revenue_cents, 7400); // 10000 - 3000 + 400; o3 pending and o5 next day excluded
});

test('GET / is scoped to the merchant header', async () => {
  const res = await get('/api/revenue?from=2026-09-01&to=2026-09-30', 'm_b');
  const body = (await res.json()) as { revenue_cents: number };
  assert.equal(body.revenue_cents, 9000);
});

test('GET / without from or to is 400 missing_date_range', async () => {
  const noTo = await get('/api/revenue?from=2026-09-01', 'm_a');
  assert.equal(noTo.status, 400);
  assert.equal(((await noTo.json()) as { error: string }).error, 'missing_date_range');
  const none = await get('/api/revenue', 'm_a');
  assert.equal(none.status, 400);
});

test('GET / without merchant header is 401', async () => {
  const res = await get('/api/revenue?from=2026-09-01&to=2026-09-18');
  assert.equal(res.status, 401);
});

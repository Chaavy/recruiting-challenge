// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { db, initSchema } from '../src/db.js';
import { authMiddleware } from '../src/auth.js';
import { metricsRouter } from '../src/routes/metrics.js';

// The router is mounted on a fresh app; src/server.ts is not imported because it listens and seeds on import.
initSchema();
const app = express();
app.use('/api/metrics', authMiddleware, metricsRouter);

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
      ('o1', 'm_a', 'ana@example.com',   5000, 'sale',   'completed', '2026-09-01T10:00:00.000Z'),
      ('o2', 'm_a', 'ana@example.com',   2000, 'refund', 'completed', '2026-09-02T10:00:00.000Z'),
      ('o3', 'm_a', 'bruno@example.com', 2500, 'sale',   'completed', '2026-09-03T10:00:00.000Z'),
      ('o4', 'm_b', 'zed@example.com',   9000, 'sale',   'completed', '2026-09-03T10:00:00.000Z');
  `);
});

function get(path: string, merchantId?: string): Promise<Response> {
  const headers: Record<string, string> = merchantId ? { 'X-Merchant-Id': merchantId } : {};
  return fetch(`${base}${path}`, { headers });
}

test('GET /summary reads the rows inserted in the shared in-memory DB (no second connection)', async () => {
  const res = await get('/api/metrics/summary', 'm_a');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    merchant_id: 'm_a',
    total_orders: 3,
    unique_customers: 2,
    avg_order_value_cents: 3750, // (5000 + 2500) / 2, refund excluded
  });
});

test('GET /summary is scoped to the merchant header', async () => {
  const res = await get('/api/metrics/summary', 'm_b');
  const body = (await res.json()) as { total_orders: number; avg_order_value_cents: number };
  assert.equal(body.total_orders, 1);
  assert.equal(body.avg_order_value_cents, 9000);
});

test('GET /summary without merchant header is 401', async () => {
  const res = await get('/api/metrics/summary');
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'missing_merchant_id' });
});

test('GET /top-customers ranks by sales minus refunds and respects limit', async () => {
  const res = await get('/api/metrics/top-customers?limit=1', 'm_a');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    customers: [{ customer_email: 'ana@example.com', order_count: 2, total_spent: 3000 }],
  });
});

test('GET /top-customers defaults to 5 results', async () => {
  const res = await get('/api/metrics/top-customers', 'm_a');
  const body = (await res.json()) as { customers: unknown[] };
  assert.equal(body.customers.length, 2);
});

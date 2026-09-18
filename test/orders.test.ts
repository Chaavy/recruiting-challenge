// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';
import { authMiddleware } from '../src/auth.js';
import { ordersRouter } from '../src/routes/orders.js';

test('orders DAL: create + listByMerchant returns the order', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  const created = ordersDal.create({
    id: 'o1',
    merchant_id: 'm_test',
    customer_email: 'a@b.com',
    total_amount: 5000,
    type: 'sale',
    status: 'completed',
  });
  assert.equal(created.id, 'o1');
  const list = ordersDal.listByMerchant('m_test');
  assert.equal(list.length, 1);
  assert.equal(list[0]!.total_amount, 5000);
});

test('orders DAL: getById returns the order', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  ordersDal.create({
    id: 'o2',
    merchant_id: 'm_test',
    customer_email: 'c@d.com',
    total_amount: 1200,
    type: 'sale',
    status: 'completed',
  });
  const got = ordersDal.getById('m_test', 'o2');
  assert.equal(got?.total_amount, 1200);
});

// Route tests (JS-005). The router is mounted on a fresh app; src/server.ts is
// not imported because it listens and seeds on import.
describe('orders routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', authMiddleware, ordersRouter);

  let server: Server;
  let base = '';

  before(async () => {
    initSchema();
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
        ('order_a', 'm_a', 'ana@example.com', 5000, 'sale', 'completed', '2026-09-01T10:00:00.000Z'),
        ('order_b', 'm_b', 'zed@example.com', 9000, 'sale', 'completed', '2026-09-01T10:00:00.000Z');
    `);
  });

  function get(path: string, merchantId: string): Promise<Response> {
    return fetch(`${base}${path}`, { headers: { 'X-Merchant-Id': merchantId } });
  }

  describe('GET /api/orders/:id tenant isolation', () => {
    test('owner gets 200 with the order', async () => {
      const res = await get('/api/orders/order_a', 'm_a');
      assert.equal(res.status, 200);
      const body = (await res.json()) as { order: { id: string; merchant_id: string } };
      assert.equal(body.order.id, 'order_a');
      assert.equal(body.order.merchant_id, 'm_a');
    });

    test("another merchant's order is 404 not_found", async () => {
      const res = await get('/api/orders/order_b', 'm_a');
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: 'not_found' });
    });

    test('cross-merchant 404 is indistinguishable from a missing id', async () => {
      const other = await get('/api/orders/order_b', 'm_a');
      const missing = await get('/api/orders/does_not_exist', 'm_a');
      assert.equal(other.status, missing.status);
      assert.deepEqual(await other.json(), await missing.json());
    });

    test('the isolation holds in both directions', async () => {
      assert.equal((await get('/api/orders/order_a', 'm_b')).status, 404);
      assert.equal((await get('/api/orders/order_b', 'm_b')).status, 200);
    });
  });
});

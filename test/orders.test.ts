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
  describe('POST /api/orders input validation', () => {
    function post(body: unknown, merchantId = 'm_a'): Promise<Response> {
      return fetch(`${base}/api/orders`, {
        method: 'POST',
        headers: { 'X-Merchant-Id': merchantId, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    function countOrders(merchantId: string): number {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE merchant_id = ?`).get(merchantId) as { n: number };
      return row.n;
    }

    test('valid sale is 201 and the row is stored for the header merchant', async () => {
      const res = await post({ customer_email: 'bruno@example.com', total_amount: 1500, type: 'sale' });
      assert.equal(res.status, 201);
      const body = (await res.json()) as { order: Record<string, unknown> };
      assert.equal(body.order.merchant_id, 'm_a');
      assert.equal(body.order.customer_email, 'bruno@example.com');
      assert.equal(body.order.total_amount, 1500);
      assert.equal(body.order.type, 'sale');
      assert.equal(body.order.status, 'completed');
      assert.equal(countOrders('m_a'), 2);
    });

    test('type refund is 201', async () => {
      const res = await post({ customer_email: 'bruno@example.com', total_amount: 700, type: 'refund' });
      assert.equal(res.status, 201);
      const body = (await res.json()) as { order: { type: string; total_amount: number } };
      assert.equal(body.order.type, 'refund');
      assert.equal(body.order.total_amount, 700);
    });

    test('merchant_id, id and status in the body are ignored', async () => {
      const res = await post({
        customer_email: 'bruno@example.com',
        total_amount: 1500,
        type: 'sale',
        merchant_id: 'm_b',
        id: 'forced_id',
        status: 'pending',
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as { order: { id: string; merchant_id: string; status: string } };
      assert.equal(body.order.merchant_id, 'm_a');
      assert.notEqual(body.order.id, 'forced_id');
      assert.equal(body.order.status, 'completed');
      assert.equal(countOrders('m_b'), 1);
    });

    // Each body breaks exactly one rule; the other two fields are valid.
    const invalidBodies: Array<[string, unknown]> = [
      ['amount zero', { customer_email: 'a@b.com', total_amount: 0, type: 'sale' }],
      ['amount negative', { customer_email: 'a@b.com', total_amount: -1, type: 'sale' }],
      ['amount fractional', { customer_email: 'a@b.com', total_amount: 10.5, type: 'sale' }],
      ['amount as string', { customer_email: 'a@b.com', total_amount: '100', type: 'sale' }],
      ['amount missing', { customer_email: 'a@b.com', type: 'sale' }],
      ['email empty', { customer_email: '', total_amount: 1500, type: 'sale' }],
      ['email blank', { customer_email: '   ', total_amount: 1500, type: 'sale' }],
      ['email missing', { total_amount: 1500, type: 'sale' }],
      ['email not a string', { customer_email: 42, total_amount: 1500, type: 'sale' }],
      ['type missing (no default)', { customer_email: 'a@b.com', total_amount: 1500 }],
      ['type null', { customer_email: 'a@b.com', total_amount: 1500, type: null }],
      ['type uppercase', { customer_email: 'a@b.com', total_amount: 1500, type: 'SALE' }],
      ['type unknown', { customer_email: 'a@b.com', total_amount: 1500, type: 'gift' }],
      ['type number', { customer_email: 'a@b.com', total_amount: 1500, type: 1 }],
      ['empty object', {}],
      ['array body', [{ customer_email: 'a@b.com', total_amount: 1500, type: 'sale' }]],
    ];
    for (const [label, body] of invalidBodies) {
      test(`${label} is 400 invalid_body and stores nothing`, async () => {
        const res = await post(body);
        assert.equal(res.status, 400);
        assert.deepEqual(await res.json(), { error: 'invalid_body' });
        assert.equal(countOrders('m_a'), 1);
      });
    }
  });
  describe('POST /api/orders outbox (JS-008)', () => {
    beforeEach(() => {
      db.exec(`DELETE FROM webhook_events; DELETE FROM webhook_subscriptions;`);
    });

    function post(body: unknown, merchantId: string): Promise<Response> {
      return fetch(`${base}/api/orders`, {
        method: 'POST',
        headers: { 'X-Merchant-Id': merchantId, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    function eventsOf(merchantId: string): Array<{ id: string; event_type: string; status: string; payload: string }> {
      return db
        .prepare(`SELECT id, event_type, status, payload FROM webhook_events WHERE merchant_id = ?`)
        .all(merchantId) as Array<{ id: string; event_type: string; status: string; payload: string }>;
    }

    test('subscribed merchant: same 201 body as before, plus one pending event for that order', async () => {
      db.prepare(
        `INSERT INTO webhook_subscriptions (id, merchant_id, url, secret) VALUES ('sub_a', 'm_a', 'https://example.com/a', 's')`,
      ).run();
      const res = await post({ customer_email: 'bruno@example.com', total_amount: 1500, type: 'sale' }, 'm_a');
      assert.equal(res.status, 201);
      const body = (await res.json()) as { order: Record<string, unknown> };
      assert.deepEqual(Object.keys(body).sort(), ['order'], 'the response does not expose the event');
      assert.deepEqual(
        Object.keys(body.order).sort(),
        ['created_at', 'customer_email', 'id', 'merchant_id', 'status', 'total_amount', 'type'],
      );

      const events = eventsOf('m_a');
      assert.equal(events.length, 1);
      assert.equal(events[0]!.event_type, 'order.created');
      assert.equal(events[0]!.status, 'pending');
      const payload = JSON.parse(events[0]!.payload) as { order: { id: string } };
      assert.equal(payload.order.id, body.order.id);
    });

    test('merchant without subscription: 201 and no event', async () => {
      const res = await post({ customer_email: 'bruno@example.com', total_amount: 1500, type: 'sale' }, 'm_a');
      assert.equal(res.status, 201);
      assert.equal(eventsOf('m_a').length, 0);
    });

    test('an invalid body creates neither an order nor an event', async () => {
      db.prepare(
        `INSERT INTO webhook_subscriptions (id, merchant_id, url, secret) VALUES ('sub_a', 'm_a', 'https://example.com/a', 's')`,
      ).run();
      const res = await post({ customer_email: 'bruno@example.com', total_amount: 10.5, type: 'sale' }, 'm_a');
      assert.equal(res.status, 400);
      assert.equal(eventsOf('m_a').length, 0);
    });
  });
});

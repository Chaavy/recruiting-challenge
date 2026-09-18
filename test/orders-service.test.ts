// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, initSchema } from '../src/db.js';
import { webhooksDal, type WebhookEventRow } from '../src/dal/webhooks-dal.js';
import { ordersService, buildOrderCreatedPayload, type OrderCreatedPayload } from '../src/services/orders-service.js';
import type { OrderRow } from '../src/dal/orders-dal.js';

initSchema();

const NOW = new Date('2026-09-18T12:00:00.000Z');
const SALE = { customer_email: 'ana@example.com', total_amount: 1500, type: 'sale' as const };

beforeEach(() => {
  db.exec(`
    DELETE FROM webhook_events;
    DELETE FROM webhook_subscriptions;
    DELETE FROM orders;
    INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_a', 'A'), ('m_b', 'B');
  `);
});

function subscribe(merchantId: string): void {
  webhooksDal.createSubscription({
    id: `sub_${merchantId}`,
    merchant_id: merchantId,
    url: `https://example.com/${merchantId}`,
    secret: 'secret',
  });
}

function events(merchantId?: string): WebhookEventRow[] {
  return merchantId
    ? (db.prepare(`SELECT * FROM webhook_events WHERE merchant_id = ?`).all(merchantId) as WebhookEventRow[])
    : (db.prepare(`SELECT * FROM webhook_events`).all() as WebhookEventRow[]);
}

function countOrders(): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM orders`).get() as { n: number }).n;
}

describe('ordersService.createOrder: subscribed merchant', () => {
  test('writes the order and exactly one pending order.created event', () => {
    subscribe('m_a');
    const order = ordersService.createOrder('m_a', SALE, NOW);

    assert.equal(order.merchant_id, 'm_a');
    assert.equal(order.total_amount, 1500);
    assert.equal(order.status, 'completed');
    assert.equal(countOrders(), 1);

    const rows = events('m_a');
    assert.equal(rows.length, 1);
    const event = rows[0]!;
    assert.equal(event.event_type, 'order.created');
    assert.equal(event.status, 'pending');
    assert.equal(event.attempts, 0);
    assert.equal(event.next_attempt_at, '2026-09-18T12:00:00.000Z');
    assert.equal(event.last_error, null);
    assert.equal(event.delivered_at, null);
  });

  test('the stored payload is the documented snapshot of the order', () => {
    subscribe('m_a');
    const order = ordersService.createOrder('m_a', SALE, NOW);
    const event = events('m_a')[0]!;
    const payload = JSON.parse(event.payload) as OrderCreatedPayload;

    assert.equal(payload.event_id, event.id, 'event_id is the outbox row id (idempotency key)');
    assert.deepEqual(payload, {
      event_id: event.id,
      event_type: 'order.created',
      version: 1,
      occurred_at: '2026-09-18T12:00:00.000Z',
      merchant_id: 'm_a',
      order: {
        id: order.id,
        customer_email: 'ana@example.com',
        total_amount: 1500,
        type: 'sale',
        status: 'completed',
        created_at: payload.order.created_at,
      },
    });
    // created_at comes from SQLite's CURRENT_TIMESTAMP and must leave as ISO 8601 UTC.
    assert.match(payload.order.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
    assert.match(order.created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'the stored order row is not modified');
  });

  test('a refund order still emits order.created, with order.type = refund', () => {
    subscribe('m_a');
    ordersService.createOrder('m_a', { ...SALE, type: 'refund' }, NOW);
    const event = events('m_a')[0]!;
    assert.equal(event.event_type, 'order.created');
    const payload = JSON.parse(event.payload) as OrderCreatedPayload;
    assert.equal(payload.order.type, 'refund');
    assert.equal(payload.order.total_amount, 1500, 'amount stays positive, the sign is carried by type');
  });

  test('two orders produce two events with distinct ids', () => {
    subscribe('m_a');
    ordersService.createOrder('m_a', SALE, NOW);
    ordersService.createOrder('m_a', SALE, NOW);
    const ids = events('m_a').map((e) => e.id);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
  });
});

describe('ordersService.createOrder: business rule, only subscribed merchants get events', () => {
  test('no subscription: the order is written and no event row', () => {
    ordersService.createOrder('m_a', SALE, NOW);
    assert.equal(countOrders(), 1);
    assert.equal(events().length, 0);
  });

  test("another merchant's subscription does not produce an event", () => {
    subscribe('m_b');
    ordersService.createOrder('m_a', SALE, NOW);
    assert.equal(events().length, 0);
  });

  test('subscribing after the order does not backfill an event', () => {
    ordersService.createOrder('m_a', SALE, NOW);
    subscribe('m_a');
    assert.equal(events().length, 0);
    ordersService.createOrder('m_a', SALE, NOW);
    assert.equal(events('m_a').length, 1, 'only the order created while subscribed has an event');
  });

  test('after the subscription is deleted, new orders produce no event', () => {
    subscribe('m_a');
    ordersService.createOrder('m_a', SALE, NOW);
    webhooksDal.deleteSubscriptionByMerchant('m_a');
    ordersService.createOrder('m_a', SALE, NOW);
    assert.equal(countOrders(), 2);
    assert.equal(events('m_a').length, 1);
  });
});

describe('ordersService.createOrder: atomicity', () => {
  test('if the event insert throws, the order is rolled back', () => {
    subscribe('m_a');
    const original = webhooksDal.insertEvent;
    webhooksDal.insertEvent = () => {
      throw new Error('outbox unavailable');
    };
    try {
      assert.throws(() => ordersService.createOrder('m_a', SALE, NOW), /outbox unavailable/);
    } finally {
      webhooksDal.insertEvent = original;
    }
    assert.equal(countOrders(), 0, 'no order without its event');
    assert.equal(events().length, 0);
  });

  test('if the order insert throws (unknown merchant, FK), no event is written', () => {
    assert.throws(() => ordersService.createOrder('m_unknown', SALE, NOW));
    assert.equal(countOrders(), 0);
    assert.equal(events().length, 0);
  });

  test('a failed call does not poison the next one', () => {
    subscribe('m_a');
    const original = webhooksDal.insertEvent;
    webhooksDal.insertEvent = () => {
      throw new Error('outbox unavailable');
    };
    try {
      assert.throws(() => ordersService.createOrder('m_a', SALE, NOW));
    } finally {
      webhooksDal.insertEvent = original;
    }
    ordersService.createOrder('m_a', SALE, NOW);
    assert.equal(countOrders(), 1);
    assert.equal(events('m_a').length, 1);
  });
});

describe('buildOrderCreatedPayload', () => {
  const order: OrderRow = {
    id: 'order_1',
    merchant_id: 'm_a',
    customer_email: 'ana@example.com',
    total_amount: 12345,
    type: 'sale',
    status: 'completed',
    created_at: '2026-09-18 17:55:58',
  };

  test('has exactly the documented keys, integer cents and ISO UTC timestamps', () => {
    const payload = buildOrderCreatedPayload(order, 'evt_1', NOW);
    assert.deepEqual(payload, {
      event_id: 'evt_1',
      event_type: 'order.created',
      version: 1,
      occurred_at: '2026-09-18T12:00:00.000Z',
      merchant_id: 'm_a',
      order: {
        id: 'order_1',
        customer_email: 'ana@example.com',
        total_amount: 12345,
        type: 'sale',
        status: 'completed',
        created_at: '2026-09-18T17:55:58.000Z',
      },
    });
    assert.ok(Number.isInteger(payload.order.total_amount));
  });

  test('an order whose created_at is already ISO keeps it', () => {
    const payload = buildOrderCreatedPayload({ ...order, created_at: '2026-09-01T10:00:00.000Z' }, 'evt_2', NOW);
    assert.equal(payload.order.created_at, '2026-09-01T10:00:00.000Z');
  });

  test('is pure: the input order is not mutated', () => {
    const copy = { ...order };
    buildOrderCreatedPayload(order, 'evt_3', NOW);
    assert.deepEqual(order, copy);
  });
});

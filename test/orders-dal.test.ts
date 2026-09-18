// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, initSchema } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';

initSchema();

const insertOrder = db.prepare(
  `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

let seq = 0;

/** Inserts a row directly so tests control status and created_at. Defaults: m_a, completed sale. */
function order(o: {
  merchant?: string;
  email?: string;
  amount: number;
  type?: 'sale' | 'refund';
  status?: string;
  createdAt?: string;
}): void {
  seq += 1;
  insertOrder.run(
    `o${seq}`,
    o.merchant ?? 'm_a',
    o.email ?? 'ana@example.com',
    o.amount,
    o.type ?? 'sale',
    o.status ?? 'completed',
    o.createdAt ?? '2026-09-01T10:00:00.000Z',
  );
}

beforeEach(() => {
  db.exec(`
    DELETE FROM orders;
    INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_a', 'A'), ('m_b', 'B');
  `);
});

describe('ordersDal.summaryByMerchant', () => {
  test('merchant with no orders returns zeros', () => {
    assert.deepEqual(ordersDal.summaryByMerchant('m_a'), {
      total_orders: 0,
      unique_customers: 0,
      avg_order_value_cents: 0,
    });
  });

  test('total_orders counts every row: sales, refunds and non-completed', () => {
    order({ amount: 1000 });
    order({ amount: 500, type: 'refund' });
    order({ amount: 2000, status: 'pending' });
    assert.equal(ordersDal.summaryByMerchant('m_a').total_orders, 3);
  });

  test('unique_customers counts distinct emails over every row', () => {
    order({ amount: 1000, email: 'ana@example.com' });
    order({ amount: 1000, email: 'ana@example.com' });
    order({ amount: 300, email: 'bruno@example.com', type: 'refund' });
    assert.equal(ordersDal.summaryByMerchant('m_a').unique_customers, 2);
  });

  test('avg_order_value_cents averages completed sales only', () => {
    order({ amount: 1000 });
    order({ amount: 3000 });
    order({ amount: 5000, type: 'refund' }); // ignored: refund
    order({ amount: 9000, status: 'pending' }); // ignored: not completed
    assert.equal(ordersDal.summaryByMerchant('m_a').avg_order_value_cents, 2000);
  });

  test('avg_order_value_cents is rounded to integer cents', () => {
    order({ amount: 1000 });
    order({ amount: 1001 });
    assert.equal(ordersDal.summaryByMerchant('m_a').avg_order_value_cents, 1001); // 1000.5 rounds up
  });

  test('rows of another merchant are excluded', () => {
    order({ amount: 1000 });
    order({ amount: 9000, merchant: 'm_b', email: 'zed@example.com' });
    assert.deepEqual(ordersDal.summaryByMerchant('m_a'), {
      total_orders: 1,
      unique_customers: 1,
      avg_order_value_cents: 1000,
    });
  });
});

describe('ordersDal.topCustomers', () => {
  test('total_spent is completed sales minus completed refunds, ordered descending', () => {
    order({ email: 'ana@example.com', amount: 5000 });
    order({ email: 'ana@example.com', amount: 2000, type: 'refund' });
    order({ email: 'bruno@example.com', amount: 4000 });
    const rows = ordersDal.topCustomers('m_a', 5);
    assert.deepEqual(rows, [
      { customer_email: 'bruno@example.com', order_count: 1, total_spent: 4000 },
      { customer_email: 'ana@example.com', order_count: 2, total_spent: 3000 },
    ]);
  });

  test('non-completed rows count in order_count but not in total_spent', () => {
    order({ email: 'ana@example.com', amount: 1000 });
    order({ email: 'ana@example.com', amount: 7000, status: 'pending' });
    assert.deepEqual(ordersDal.topCustomers('m_a', 5), [
      { customer_email: 'ana@example.com', order_count: 2, total_spent: 1000 },
    ]);
  });

  test('a customer with only refunds has negative total_spent', () => {
    order({ email: 'ana@example.com', amount: 1000 });
    order({ email: 'carla@example.com', amount: 300, type: 'refund' });
    const rows = ordersDal.topCustomers('m_a', 5);
    assert.equal(rows[1]?.customer_email, 'carla@example.com');
    assert.equal(rows[1]?.total_spent, -300);
  });

  test('ties on total_spent are ordered by customer_email ascending', () => {
    order({ email: 'bruno@example.com', amount: 1000 });
    order({ email: 'ana@example.com', amount: 1000 });
    const rows = ordersDal.topCustomers('m_a', 5);
    assert.deepEqual(
      rows.map((r) => r.customer_email),
      ['ana@example.com', 'bruno@example.com'],
    );
  });

  test('limit is respected', () => {
    order({ email: 'ana@example.com', amount: 300 });
    order({ email: 'bruno@example.com', amount: 200 });
    order({ email: 'carla@example.com', amount: 100 });
    const rows = ordersDal.topCustomers('m_a', 2);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.customer_email, 'ana@example.com');
  });

  test('rows of another merchant are excluded', () => {
    order({ email: 'ana@example.com', amount: 300 });
    order({ email: 'zed@example.com', amount: 9000, merchant: 'm_b' });
    assert.equal(ordersDal.topCustomers('m_a', 5).length, 1);
  });
});

describe('ordersDal.revenueByMerchant', () => {
  const FROM = '2026-08-01';
  const TO = '2026-08-31';

  test('golden case: completed sale 10000 + completed refund 3000 => 7000', () => {
    order({ amount: 10000 });
    order({ amount: 3000, type: 'refund' });
    assert.equal(ordersDal.revenueByMerchant('m_a', '2026-09-01', '2026-09-01'), 7000);
  });

  test('merchant with no orders returns 0', () => {
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, TO), 0);
  });

  test('non-completed rows are excluded', () => {
    order({ amount: 1000, createdAt: '2026-08-10T10:00:00.000Z' });
    order({ amount: 5000, status: 'pending', createdAt: '2026-08-10T10:00:00.000Z' });
    order({ amount: 700, type: 'refund', status: 'cancelled', createdAt: '2026-08-10T10:00:00.000Z' });
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, TO), 1000);
  });

  test('refunds larger than sales give a negative revenue', () => {
    order({ amount: 1000, createdAt: '2026-08-10T10:00:00.000Z' });
    order({ amount: 2500, type: 'refund', createdAt: '2026-08-11T10:00:00.000Z' });
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, TO), -1500);
  });

  test('bare-date `to` includes orders from that whole day (ISO created_at)', () => {
    order({ amount: 1000, createdAt: '2026-08-31T12:00:00.000Z' });
    order({ amount: 1, createdAt: '2026-08-31T23:59:59.999Z' });
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, TO), 1001);
  });

  test('bare-date `to` includes orders from that day stored in SQLite CURRENT_TIMESTAMP format', () => {
    order({ amount: 1000, createdAt: '2026-08-31 12:00:00' });
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, TO), 1000);
  });

  test('the day after a bare-date `to` is excluded', () => {
    order({ amount: 1000, createdAt: '2026-09-01T00:00:00.000Z' });
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, TO), 0);
  });

  test('full-timestamp `to` stays exclusive', () => {
    order({ amount: 1000, createdAt: '2026-08-31T12:00:00.000Z' });
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, '2026-08-31T12:00:00.000Z'), 0);
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, '2026-08-31T12:00:00.001Z'), 1000);
  });

  test('`from` is inclusive from midnight', () => {
    order({ amount: 1000, createdAt: '2026-08-01T00:00:00.000Z' });
    order({ amount: 5000, createdAt: '2026-07-31T23:59:59.999Z' });
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, TO), 1000);
  });

  test('rows of another merchant are excluded', () => {
    order({ amount: 1000, createdAt: '2026-08-10T10:00:00.000Z' });
    order({ amount: 9000, merchant: 'm_b', createdAt: '2026-08-10T10:00:00.000Z' });
    assert.equal(ordersDal.revenueByMerchant('m_a', FROM, TO), 1000);
  });
});

describe('ordersDal.getById tenant scoping', () => {
  test('owner gets the row', () => {
    order({ amount: 1000 });
    const id = `o${seq}`;
    assert.equal(ordersDal.getById('m_a', id)?.id, id);
  });

  test("another merchant's order returns undefined", () => {
    order({ amount: 1000, merchant: 'm_b' });
    const id = `o${seq}`;
    assert.equal(ordersDal.getById('m_a', id), undefined);
    assert.equal(ordersDal.getById('m_b', id)?.merchant_id, 'm_b');
  });

  test('missing id returns undefined', () => {
    assert.equal(ordersDal.getById('m_a', 'does_not_exist'), undefined);
  });

  test('create returns the inserted row through the scoped lookup', () => {
    const created = ordersDal.create({
      id: 'created_1',
      merchant_id: 'm_a',
      customer_email: 'ana@example.com',
      total_amount: 1234,
      type: 'sale',
      status: 'completed',
    });
    assert.equal(created.id, 'created_1');
    assert.equal(created.merchant_id, 'm_a');
    assert.equal(created.total_amount, 1234);
  });
});

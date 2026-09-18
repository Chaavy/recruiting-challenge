// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, initSchema } from '../src/db.js';
import { webhooksDal } from '../src/dal/webhooks-dal.js';

initSchema();

beforeEach(() => {
  db.exec(`
    DELETE FROM webhook_events;
    DELETE FROM webhook_subscriptions;
    INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_a', 'A'), ('m_b', 'B');
  `);
});

function sub(merchantId: string, id = `sub_${merchantId}`) {
  return { id, merchant_id: merchantId, url: `https://example.com/${merchantId}`, secret: `secret_${merchantId}` };
}

describe('webhook schema', () => {
  test('initSchema creates both tables and the due index', () => {
    const names = (
      db
        .prepare(`SELECT name FROM sqlite_master WHERE name LIKE 'webhook_%' OR name = 'idx_webhook_events_due'`)
        .all() as Array<{ name: string }>
    ).map((r) => r.name);
    assert.ok(names.includes('webhook_subscriptions'));
    assert.ok(names.includes('webhook_events'));
    assert.ok(names.includes('idx_webhook_events_due'));
  });

  test('initSchema is idempotent', () => {
    assert.doesNotThrow(() => initSchema());
  });

  test('webhook_events defaults: status pending, attempts 0', () => {
    db.prepare(
      `INSERT INTO webhook_events (id, merchant_id, event_type, payload, next_attempt_at)
       VALUES ('e1', 'm_a', 'order.created', '{}', '2026-09-18T00:00:00.000Z')`,
    ).run();
    const row = db.prepare(`SELECT status, attempts, last_error, delivered_at FROM webhook_events WHERE id = 'e1'`).get();
    assert.deepEqual(row, { status: 'pending', attempts: 0, last_error: null, delivered_at: null });
  });
});

describe('webhooksDal subscriptions', () => {
  test('create returns the stored row, including the secret and created_at', () => {
    const created = webhooksDal.createSubscription(sub('m_a'));
    assert.equal(created.id, 'sub_m_a');
    assert.equal(created.merchant_id, 'm_a');
    assert.equal(created.url, 'https://example.com/m_a');
    assert.equal(created.secret, 'secret_m_a');
    assert.ok(created.created_at.length > 0);
  });

  test('getSubscriptionByMerchant is scoped to the merchant', () => {
    webhooksDal.createSubscription(sub('m_a'));
    assert.equal(webhooksDal.getSubscriptionByMerchant('m_a')?.id, 'sub_m_a');
    assert.equal(webhooksDal.getSubscriptionByMerchant('m_b'), undefined);
  });

  test('one subscription per merchant: a second create throws SQLITE_CONSTRAINT_UNIQUE', () => {
    webhooksDal.createSubscription(sub('m_a'));
    assert.throws(
      () => webhooksDal.createSubscription(sub('m_a', 'another_id')),
      (err: unknown) => (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE',
    );
  });

  test('two merchants can each have their own subscription', () => {
    webhooksDal.createSubscription(sub('m_a'));
    webhooksDal.createSubscription(sub('m_b'));
    assert.equal(webhooksDal.getSubscriptionByMerchant('m_a')?.url, 'https://example.com/m_a');
    assert.equal(webhooksDal.getSubscriptionByMerchant('m_b')?.url, 'https://example.com/m_b');
  });

  test('delete removes only the given merchant and reports whether it deleted', () => {
    webhooksDal.createSubscription(sub('m_a'));
    webhooksDal.createSubscription(sub('m_b'));
    assert.equal(webhooksDal.deleteSubscriptionByMerchant('m_a'), true);
    assert.equal(webhooksDal.getSubscriptionByMerchant('m_a'), undefined);
    assert.equal(webhooksDal.getSubscriptionByMerchant('m_b')?.id, 'sub_m_b');
    assert.equal(webhooksDal.deleteSubscriptionByMerchant('m_a'), false);
  });

  test('after delete the merchant can subscribe again', () => {
    webhooksDal.createSubscription(sub('m_a'));
    webhooksDal.deleteSubscriptionByMerchant('m_a');
    assert.doesNotThrow(() => webhooksDal.createSubscription(sub('m_a', 'second')));
  });
});

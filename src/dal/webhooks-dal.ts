import { db } from '../db.js';

export interface WebhookSubscriptionRow {
  id: string;
  merchant_id: string;
  url: string;
  /** Raw HMAC secret. Never return it from an endpoint other than the creation response. */
  secret: string;
  created_at: string;
}

export type WebhookEventStatus = 'pending' | 'delivered' | 'failed';

/** One row of the outbox. `payload` is the exact JSON string that gets sent. */
export interface WebhookEventRow {
  id: string;
  merchant_id: string;
  event_type: string;
  payload: string;
  status: WebhookEventStatus;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  delivered_at: string | null;
}

/**
 * Data-access layer for the Webhooks frontier. Same rules as ordersDal:
 * every query is parameterized and every lookup is scoped by merchant.
 * One subscription per merchant (UNIQUE on merchant_id).
 * Outbox writes (JS-008) are meant to run inside the caller's transaction,
 * see services/orders-service.ts. Delivery functions are added in JS-009.
 */
export const webhooksDal = {
  /**
   * Throws a SqliteError with code SQLITE_CONSTRAINT_UNIQUE if the merchant
   * already has a subscription.
   */
  createSubscription(sub: Omit<WebhookSubscriptionRow, 'created_at'>): WebhookSubscriptionRow {
    db.prepare(
      `INSERT INTO webhook_subscriptions (id, merchant_id, url, secret)
       VALUES (?, ?, ?, ?)`,
    ).run(sub.id, sub.merchant_id, sub.url, sub.secret);
    return this.getSubscriptionByMerchant(sub.merchant_id)!;
  },

  getSubscriptionByMerchant(merchantId: string): WebhookSubscriptionRow | undefined {
    return db
      .prepare(`SELECT * FROM webhook_subscriptions WHERE merchant_id = ?`)
      .get(merchantId) as WebhookSubscriptionRow | undefined;
  },

  /** Returns true if a subscription was deleted, false if the merchant had none. */
  deleteSubscriptionByMerchant(merchantId: string): boolean {
    const result = db.prepare(`DELETE FROM webhook_subscriptions WHERE merchant_id = ?`).run(merchantId);
    return result.changes > 0;
  },

  /**
   * Appends an event to the outbox as `pending` with 0 attempts.
   * Does not open a transaction: the caller decides the atomic unit.
   */
  insertEvent(event: Pick<WebhookEventRow, 'id' | 'merchant_id' | 'event_type' | 'payload' | 'next_attempt_at'>): WebhookEventRow {
    db.prepare(
      `INSERT INTO webhook_events (id, merchant_id, event_type, payload, next_attempt_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(event.id, event.merchant_id, event.event_type, event.payload, event.next_attempt_at);
    return this.getEventById(event.merchant_id, event.id)!;
  },

  /** Tenant-scoped lookup: another merchant's event returns undefined. */
  getEventById(merchantId: string, id: string): WebhookEventRow | undefined {
    return db
      .prepare(`SELECT * FROM webhook_events WHERE id = ? AND merchant_id = ?`)
      .get(id, merchantId) as WebhookEventRow | undefined;
  },
};

import { db } from '../db.js';

export interface WebhookSubscriptionRow {
  id: string;
  merchant_id: string;
  url: string;
  /** Raw HMAC secret. Never return it from an endpoint other than the creation response. */
  secret: string;
  created_at: string;
}

/**
 * Data-access layer for the Webhooks frontier. Same rules as ordersDal:
 * every query is parameterized and every lookup is scoped by merchant.
 * One subscription per merchant (UNIQUE on merchant_id).
 * Event (outbox) functions are added in JS-008.
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
};

import { db } from '../db.js';

/**
 * Signed, completed-only amount used by every money aggregate:
 * a completed sale counts positive, a completed refund counts negative,
 * anything else (other status or type) counts 0.
 *
 * This is a constant SQL fragment, never user input. Interpolating it is the
 * one accepted exception to the "no string interpolation into queries" rule
 * (approved by Javier in JS-004) so the business rule lives in exactly one place.
 */
const SIGNED_COMPLETED_AMOUNT_SQL = `CASE
  WHEN status = 'completed' AND type = 'sale' THEN total_amount
  WHEN status = 'completed' AND type = 'refund' THEN -total_amount
  ELSE 0
END`;

export interface OrderRow {
  id: string;
  merchant_id: string;
  customer_email: string;
  total_amount: number;
  type: 'sale' | 'refund';
  status: string;
  created_at: string;
}

export interface MerchantSummary {
  /** Every order row of the merchant, sales and refunds, any status. */
  total_orders: number;
  /** Distinct customer emails over every order row. */
  unique_customers: number;
  /** Average of completed sales only, rounded to integer cents. */
  avg_order_value_cents: number;
}

export interface TopCustomerRow {
  customer_email: string;
  /** Every order row of the customer, sales and refunds, any status. */
  order_count: number;
  /** Completed sales minus completed refunds, integer cents. */
  total_spent: number;
}

/**
 * Data-access layer for orders. All order queries should go through here.
 *
 * - centralized place for query patterns
 * - the place to add auditing, caching, tenancy filters
 * - the seam for swapping the underlying store
 */
export const ordersDal = {
  listByMerchant(merchantId: string, opts: { from?: string; to?: string; limit?: number } = {}): OrderRow[] {
    const limit = opts.limit ?? 100;
    if (opts.from && opts.to) {
      return db
        .prepare(
          `SELECT * FROM orders
           WHERE merchant_id = ? AND created_at >= ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(merchantId, opts.from, opts.to, limit) as OrderRow[];
    }
    return db
      .prepare(`SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(merchantId, limit) as OrderRow[];
  },

  getById(id: string): OrderRow | undefined {
    return db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as OrderRow | undefined;
  },

  create(order: Omit<OrderRow, 'created_at'>): OrderRow {
    db.prepare(
      `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(order.id, order.merchant_id, order.customer_email, order.total_amount, order.type, order.status);
    return this.getById(order.id)!;
  },

  /**
   * Sum total_amount over a date range for a merchant.
   * Used by the revenue endpoint.
   */
  sumAmountByMerchant(merchantId: string, from: string, to: string): number {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders
         WHERE merchant_id = ? AND created_at >= ? AND created_at < ?`,
      )
      .get(merchantId, from, to) as { total: number };
    return row.total;
  },

  /**
   * Dashboard summary for a merchant. Used by GET /api/metrics/summary.
   */
  summaryByMerchant(merchantId: string): MerchantSummary {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS total_orders,
                COUNT(DISTINCT customer_email) AS unique_customers,
                COALESCE(AVG(CASE WHEN status = 'completed' AND type = 'sale' THEN total_amount END), 0) AS avg_sale_amount
         FROM orders
         WHERE merchant_id = ?`,
      )
      .get(merchantId) as { total_orders: number; unique_customers: number; avg_sale_amount: number };
    return {
      total_orders: row.total_orders,
      unique_customers: row.unique_customers,
      avg_order_value_cents: Math.round(row.avg_sale_amount),
    };
  },

  /**
   * Customers ranked by completed sales minus completed refunds.
   * Used by GET /api/metrics/top-customers.
   */
  topCustomers(merchantId: string, limit: number): TopCustomerRow[] {
    return db
      .prepare(
        `SELECT customer_email,
                COUNT(*) AS order_count,
                SUM(${SIGNED_COMPLETED_AMOUNT_SQL}) AS total_spent
         FROM orders
         WHERE merchant_id = ?
         GROUP BY customer_email
         ORDER BY total_spent DESC, customer_email ASC
         LIMIT ?`,
      )
      .all(merchantId, limit) as TopCustomerRow[];
  },
};

import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { ordersDal, type OrderRow } from '../dal/orders-dal.js';
import { webhooksDal } from '../dal/webhooks-dal.js';
import type { CreateOrderInput } from '../lib/validate-order.js';
import { toIsoUtc } from '../lib/timestamp.js';

/**
 * Event types of the Webhooks frontier. Only `order.created` is emitted today:
 * the system has no refund endpoint (a refund is an order row of type 'refund',
 * not linked to a sale) and no status-change endpoint. The other two values are
 * reserved so consumers can plan for them (BACKLOG PM-14).
 */
export const ORDER_EVENT_TYPES = {
  created: 'order.created',
  refunded: 'order.refunded',
  statusChanged: 'order.status_changed',
} as const;

export const ORDER_EVENT_VERSION = 1;

export interface OrderCreatedPayload {
  /** Also the outbox row id and the consumer's idempotency key (delivery is at-least-once). */
  event_id: string;
  event_type: typeof ORDER_EVENT_TYPES.created;
  version: typeof ORDER_EVENT_VERSION;
  /** ISO 8601 UTC. */
  occurred_at: string;
  merchant_id: string;
  order: {
    id: string;
    customer_email: string;
    /** Integer cents, always positive. A refund is expressed by `type`. */
    total_amount: number;
    type: OrderRow['type'];
    status: string;
    /** ISO 8601 UTC, normalised from the stored value. */
    created_at: string;
  };
}

/** Pure: builds the snapshot of the order that is stored and later sent as is. */
export function buildOrderCreatedPayload(order: OrderRow, eventId: string, occurredAt: Date): OrderCreatedPayload {
  return {
    event_id: eventId,
    event_type: ORDER_EVENT_TYPES.created,
    version: ORDER_EVENT_VERSION,
    occurred_at: occurredAt.toISOString(),
    merchant_id: order.merchant_id,
    order: {
      id: order.id,
      customer_email: order.customer_email,
      total_amount: order.total_amount,
      type: order.type,
      status: order.status,
      created_at: toIsoUtc(order.created_at),
    },
  };
}

/**
 * Service layer for order mutations. It is the only place that knows both the
 * Orders and the Webhooks frontiers, so neither DAL has to know the other.
 */
export const ordersService = {
  /**
   * Creates an order and, if the merchant has a webhook subscription at that
   * moment, its `order.created` outbox event, in ONE transaction: an order can
   * never exist without its event, and an event never without its order. If
   * either insert throws, both are rolled back.
   *
   * Business rule (Javier, JS-008): a merchant only receives events for orders
   * created while subscribed. No subscription, no event row; subscribing later
   * does not backfill.
   *
   * The transaction is synchronous (better-sqlite3): no async work inside it.
   * `now` is injectable for tests.
   */
  createOrder(merchantId: string, input: CreateOrderInput, now: Date = new Date()): OrderRow {
    const run = db.transaction((): OrderRow => {
      const order = ordersDal.create({
        id: randomUUID(),
        merchant_id: merchantId,
        customer_email: input.customer_email,
        total_amount: input.total_amount,
        type: input.type,
        status: 'completed',
      });

      if (webhooksDal.getSubscriptionByMerchant(merchantId)) {
        const eventId = randomUUID();
        const payload = buildOrderCreatedPayload(order, eventId, now);
        webhooksDal.insertEvent({
          id: eventId,
          merchant_id: merchantId,
          event_type: payload.event_type,
          // Stored once as the exact string to send: the dispatcher must not rebuild it.
          payload: JSON.stringify(payload),
          next_attempt_at: now.toISOString(),
        });
      }

      return order;
    });
    return run();
  },
};

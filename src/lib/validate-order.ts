export type OrderType = 'sale' | 'refund';

export interface CreateOrderInput {
  customer_email: string;
  total_amount: number;
  type: OrderType;
}

export type CreateOrderValidation = { ok: true; value: CreateOrderInput } | { ok: false };

const ORDER_TYPES: readonly string[] = ['sale', 'refund'];

/**
 * Validates the body of POST /api/orders. Pure: no DB, no Express.
 *
 * Rules (JS-005):
 * - body is a plain object;
 * - customer_email is a string that is not blank. It is stored as sent, not trimmed;
 * - total_amount is a positive integer (cents). Zero, negatives, fractions,
 *   numeric strings, NaN and Infinity are rejected. The sign of a refund is
 *   carried by `type`, never by a negative amount;
 * - type is required and is exactly 'sale' or 'refund', case-sensitive. There
 *   is no default: whoever creates an order must say which one it is;
 * - unknown extra fields are ignored.
 *
 * The result carries no reason on failure: the API answers a generic
 * `invalid_body` and must not leak which rule failed.
 */
export function validateCreateOrderBody(body: unknown): CreateOrderValidation {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false };
  const { customer_email, total_amount, type } = body as Record<string, unknown>;

  if (typeof customer_email !== 'string' || customer_email.trim() === '') return { ok: false };
  if (typeof total_amount !== 'number' || !Number.isInteger(total_amount) || total_amount <= 0) return { ok: false };
  if (typeof type !== 'string' || !ORDER_TYPES.includes(type)) return { ok: false };

  return {
    ok: true,
    value: { customer_email, total_amount, type: type as OrderType },
  };
}

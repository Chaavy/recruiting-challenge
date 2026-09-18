# API reference

> Quick-and-dirty. Not complete.

All endpoints require the `X-Merchant-Id` header.

## `GET /api/health`
No auth. Returns `{ ok: true }`.

## `GET /api/orders`
List orders for the authenticated merchant. Optional query: `from`, `to`, `limit`.

## `GET /api/orders/:id`
Get a single order by ID, scoped to the authenticated merchant.

- `200 { "order": { ... } }` when the order belongs to the merchant in `X-Merchant-Id`.
- `404 { "error": "not_found" }` when the id does not exist **or belongs to another merchant**. The two cases return the same response on purpose, so the endpoint cannot be used to probe for other merchants' order ids.

## `POST /api/orders`
Creates an order for the merchant in `X-Merchant-Id`. Body: `{ customer_email, total_amount, type }`. All three fields are required.

- `customer_email`: string, not blank. Stored as sent (no trimming, no format check).
- `total_amount`: **positive integer, in cents**. `0`, negatives, fractions (`10.5`) and numeric strings (`"100"`) are rejected. A refund is expressed with `type`, never with a negative amount.
- `type`: **required**, exactly `"sale"` or `"refund"`, case-sensitive. There is no default: a body without `type` is rejected with 400, because whoever creates an order must state which one it is. (Before JS-005 a missing `type` was silently stored as `sale`.)
- Any other field (`id`, `merchant_id`, `status`, ...) is ignored: the id is generated, the merchant comes from the header, the status is `completed`.

Responses: `201 { "order": { ... } }`; `400 { "error": "invalid_body" }` for any rule above (the response does not say which one).

## `GET /api/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD`
Revenue for the merchant in the date range. Both query params are required (`400 { "error": "missing_date_range" }` otherwise).

```json
{ "merchant_id": "m_acme", "from": "2026-08-19", "to": "2026-09-18", "revenue_cents": 123400, "revenue": 1234 }
```

- `revenue_cents`: **completed sales minus completed refunds**, integer cents. Refund rows are stored with a positive `total_amount` and `type = "refund"`; the sign is applied here. Non-completed orders are excluded. Can be negative.
- `from` is inclusive from `00:00:00` UTC.
- `to` as a bare date (`YYYY-MM-DD`) includes that **whole day**. A full ISO timestamp for `to` is treated as an exclusive bound.
- `revenue`: legacy float field (`revenue_cents / 100`). Do not use for arithmetic; kept for compatibility, removal tracked as Post MVP.

## `GET /api/metrics/summary`
Dashboard summary for the merchant. All queries go through `ordersDal.summaryByMerchant`.

```json
{ "merchant_id": "m_acme", "total_orders": 40, "unique_customers": 6, "avg_order_value_cents": 10950 }
```

- `total_orders`: every order row of the merchant (sales and refunds, any status).
- `unique_customers`: distinct `customer_email` over every order row.
- `avg_order_value_cents`: average `total_amount` of **completed sales only**, rounded to integer cents. Refunds and non-completed orders are excluded. `0` when there are no completed sales.

## `GET /api/metrics/top-customers?limit=5`
Customers ranked by money kept. Optional query `limit` (default 5).

```json
{ "customers": [ { "customer_email": "ana@example.com", "order_count": 7, "total_spent": 61200 } ] }
```

- `order_count`: every order row of that customer (sales and refunds, any status).
- `total_spent`: completed sales minus completed refunds, integer cents. Can be negative.
- Ordered by `total_spent` descending, then `customer_email` ascending for ties.

## Webhooks — subscription management

A merchant registers one HTTPS URL to receive order events. **Status: subscriptions (JS-007) and event storage (JS-008) are shipped. Delivery is not: events are persisted as `pending` and nothing is sent to the URL until JS-009.**

All three endpoints act on the subscription of the merchant in `X-Merchant-Id`. There is at most one per merchant.

### `POST /api/webhooks/subscription`
Body: `{ "url": "https://example.com/hooks/orders" }`.

```json
{ "subscription": { "id": "dba372b9-...", "url": "https://example.com/hooks/orders", "created_at": "2026-09-18 17:55:58" }, "secret": "<64 hex characters>" }
```

- `201` on success. **`secret` is returned only in this response.** It is the key used to sign deliveries (HMAC-SHA256); store it. It cannot be read again; to get a new one, delete and re-create.
- `400 { "error": "invalid_url" }` when the URL is not acceptable. Rules: `https` only; no credentials in the URL; at most 2048 characters; the host must not be `localhost`, a loopback, private (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`, includes cloud metadata), CGNAT (`100.64/10`) or unspecified address, in IPv4 or IPv6, including IPv4 embedded in IPv6. Disguised IPv4 forms (`https://2130706433/`, `https://0x7f000001/`) are normalised before the check. The stored `url` is the normalised form.
- `409 { "error": "subscription_exists" }` when the merchant already has one.

### `GET /api/webhooks/subscription`
`200 { "subscription": { "id", "url", "created_at" } }` — never includes the secret. `404 { "error": "not_found" }` when there is none.

### `DELETE /api/webhooks/subscription`
`204` with an empty body. `404 { "error": "not_found" }` when there is none.

### Development flag
`WEBHOOK_ALLOW_INSECURE_URLS=1` (exactly `1`, read per request, default off) additionally accepts **loopback hosts, over `http` or `https`**, so a receiver can run on the same machine (`http://localhost:4000/hook`). Private ranges, link-local, credentials and `http` to public hosts stay rejected. Never set it in production.

## Webhooks — events

### When an event exists
**A merchant only receives events for orders created while it has a subscription.** `POST /api/orders` writes the order and its event in one database transaction, so an order of a subscribed merchant can never exist without its event. An order created before subscribing, or after the subscription was deleted, has no event, and subscribing later does not backfill. `POST /api/orders` itself is unchanged: same request, same `201` body; the event is not exposed in the response.

### Event types
| `event_type` | Emitted | When |
|---|---|---|
| `order.created` | yes | every successful `POST /api/orders` of a subscribed merchant, for sales **and** refunds (check `order.type`) |
| `order.refunded` | reserved, not emitted | no refund operation exists yet: a refund is an order row of type `refund`, not linked to a sale |
| `order.status_changed` | reserved, not emitted | no status-change operation exists yet |

### Payload (`version` 1)
```json
{
  "event_id": "f18fbcfd-e0de-470d-be72-4147bb5fe71d",
  "event_type": "order.created",
  "version": 1,
  "occurred_at": "2026-09-18T18:35:35.099Z",
  "merchant_id": "m_acme",
  "order": {
    "id": "9936730a-6c1c-4d51-bb1f-d68792db1c58",
    "customer_email": "ana@example.com",
    "total_amount": 1500,
    "type": "sale",
    "status": "completed",
    "created_at": "2026-09-18T18:35:35.000Z"
  }
}
```

- `event_id`: unique per event. Delivery will be at-least-once, so **use it as the idempotency key** and ignore an `event_id` you have already processed.
- `total_amount`: integer cents, always positive. A refund is `type: "refund"`, never a negative amount.
- `occurred_at`, `order.created_at`: ISO 8601 UTC. `order.created_at` is normalised for the payload; `GET /api/orders` still returns the stored format.
- The payload is a snapshot taken when the order was created and is stored as the exact JSON string that will be sent; later changes to the order do not alter it.


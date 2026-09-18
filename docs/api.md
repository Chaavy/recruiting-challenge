# API reference

> Quick-and-dirty. Not complete.

All endpoints require the `X-Merchant-Id` header.

## `GET /api/health`
No auth. Returns `{ ok: true }`.

## `GET /api/orders`
List orders for the authenticated merchant. Optional query: `from`, `to`, `limit`.

## `GET /api/orders/:id`
Get a single order by ID.

## `POST /api/orders`
Body: `{ customer_email, total_amount, type? }`.

## `GET /api/revenue?from=...&to=...`
Total revenue for the merchant in the date range.

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

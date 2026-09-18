# JS-008 — Webhooks slice B: transactional outbox on order creation

| Field    | Value                                  |
|----------|----------------------------------------|
| Status   | pending                                |
| Type     | feature                                |
| Priority | 5                                      |
| Commits  | filled at close: short SHAs of the commits that ship this task (source for signoff.md) |

## Context

Second slice of Feature B (see JS-007 for the overall context). The seam is order creation in `POST /api/orders` (`src/routes/orders.ts:25-44`), which calls `ordersDal.create` directly. The `webhook_events` table exists since JS-007 but nothing writes to it. Delivery guarantee decided in JS-003 and accepted by Javier: at-least-once with an event id for consumer-side idempotency, backed by a transactional outbox so an order can never exist without its event row.

## What is wrong / what is missing

- Nothing records that an order was created. If the event were published after the insert in a separate step, a crash between the two would lose it.
- No service layer: the route talks to the DAL directly, so there is no place to make "insert order + insert event" atomic without putting webhook logic in `ordersDal` (wrong layer: the DAL is storage).

## Objective (what I propose)

Introduce `src/services/orders-service.ts` with `createOrder(merchantId, input)` that, inside one `db.transaction`, inserts the order via `ordersDal.create` and, if the merchant has a webhook subscription, inserts an `order.created` event via `webhooksDal.insertEvent` with the JSON payload snapshot and `next_attempt_at = now`. The route calls the service; its response is unchanged. After this task every order created for a subscribed merchant leaves a pending event in the same commit, and stopping here is deliverable as "events are persisted, dispatch pending".

## Scope

- In:
  - `src/services/orders-service.ts`: `createOrder`; exported pure `buildOrderCreatedPayload(order)` for tests.
  - `src/dal/webhooks-dal.ts`: `insertEvent(event)`, `getEventById(id)` (for tests and JS-009).
  - `src/routes/orders.ts`: POST uses the service. Validation from JS-005 stays in the route.
  - Payload (snake_case to match the API):
    ```json
    {
      "event_id": "<uuid>",
      "event_type": "order.created",
      "version": 1,
      "occurred_at": "<ISO 8601 UTC>",
      "merchant_id": "m_acme",
      "order": { "id": "…", "customer_email": "…", "total_amount": 12345, "type": "sale", "status": "completed", "created_at": "…" }
    }
    ```
    `event_id` doubles as the row id and the idempotency key. Amounts are integer cents.
  - Event types: `order.created` emitted; `order.refunded` and `order.status_changed` reserved as documented values, not emitted (no trigger exists). A POST with `type = 'refund'` emits `order.created` with `order.type = 'refund'`.
  - `docs/api.md` (payload schema, event types), `docs/architecture.md` (service layer, outbox).
- Out (explicitly not touched, even if tempting):
  - Sending anything over HTTP (JS-009).
  - Emitting events for merchants without a subscription (decision: no event row; revisit when the Auditlog frontier needs every event).
  - Status-change or refund endpoints.
  - Backfilling events for existing orders.

## Restrictions

- No new dependencies.
- The transaction is `db.transaction(...)` from better-sqlite3 (synchronous). No async work inside it.
- `ordersDal` gains no webhook knowledge. Only the service knows both DALs.
- Payload stored as the exact JSON string that will be sent (JS-009 must not rebuild it), so the event is immutable even if the order changes later.
- Route tests as in previous tasks; tests clear `orders`, `webhook_subscriptions`, `webhook_events` in `beforeEach`.

## Edge cases

- Merchant with subscription: order row + one event row with `status = 'pending'`, `attempts = 0`, `next_attempt_at` <= now, payload parses back to the order data.
- Merchant without subscription: order row, zero events.
- Event insert throws (test: stub `webhooksDal.insertEvent` to throw): no order row is persisted, POST returns 500 `internal_error`.
- Order insert throws (FK, unknown merchant): no event row.
- `type = 'refund'` POST: event type `order.created`, `order.type = 'refund'`.
- Two orders in a row: two distinct `event_id`s.

## Expected result

- `POST /api/orders` behaves exactly as before for the client (same 201 body and codes).
- For a subscribed merchant, `SELECT status, event_type FROM webhook_events` shows a `pending` `order.created` row per POST.
- `npm run check` green.

## Acceptance criteria

- [ ] Order and event are written in one transaction; the stub-throw test proves rollback of the order.
- [ ] No event for a merchant without subscription.
- [ ] `buildOrderCreatedPayload` produces the documented shape with integer cents and ISO UTC `occurred_at`.
- [ ] POST response unchanged (existing JS-005 route tests still pass without modification).
- [ ] `docs/api.md` documents the payload; `docs/architecture.md` documents the outbox and the service layer.

## Validation

- Tests to add (file names and what each asserts):
  - `test/orders-service.test.ts`: the six edge cases above.
  - `test/webhooks-dal.test.ts` (extend): `insertEvent` / `getEventById` round trip, default status and attempts.
- Commands to run: `npm run check`.
- What to click or call in the dashboard / API to see it working: create a subscription (JS-007 curl), POST an order, then `sqlite3 data/dashboard.db 'select id, status, attempts, substr(payload,1,80) from webhook_events'`.

## Confidence and falsification

- Confidence (1–10): 8 [proposed by Claude, Javier confirms]. The outbox pattern with a synchronous SQLite transaction is simple; the risk is scope creep into a full service layer.
- How to know if I am wrong (a specific scenario that would prove the change wrong): the dispatcher (JS-009) needs data that is not in the snapshot (for example the subscription URL at creation time) and has to join back to live tables, defeating the snapshot; or a consumer requires `order.refunded` semantics on a refund POST and `order.created` with `type = 'refund'` is judged wrong.

## Session log

- 2026-09-18 — Contract created in the JS-003 tasks-definition session. Decision (Claude proposed, Javier to confirm in the plan phase): no event row when the merchant has no subscription. No work started.

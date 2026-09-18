# Architecture (DRAFT — needs love)

> This file was started a while ago and hasn't been kept up to date.
> Treat as partial. Update what you change.

## Modules

- **`server.ts`** — Express bootstrapper. Wires routers to paths.
- **`db.ts`** — SQLite connection + schema init. Single shared `db` instance.
- **`auth.ts`** — request authentication. Today: trusts `X-Merchant-Id` header.
  Eventually this becomes a real signed token; the header shape is a placeholder.
- **`dal/`** — data-access layer. All order queries route through `ordersDal`
  so we have one place to add auditing, caching, tenancy filters, etc. Since
  JS-004 every route follows this, including `metrics.ts`, which used to open
  its own read-only connection. Money aggregates (metrics, revenue) share one
  SQL fragment in the DAL: a completed sale counts positive, a completed refund
  counts negative, anything else counts 0. Lookups by id are tenant-scoped:
  `getById(merchantId, id)` never returns another merchant's row (JS-005).
  `webhooksDal` (JS-007) is the DAL of the Webhooks frontier, same rules:
  parameterized, every lookup scoped by merchant.
- **`services/`** — (JS-008) operations that span more than one frontier.
  `orders-service.ts` creates an order and its webhook event in one
  transaction. It is the only module that knows both `ordersDal` and
  `webhooksDal`; neither DAL knows the other. Services use the shared `db` only
  to open a transaction, never to run queries.
- **`routes/`** — Express routers, one file per resource. `webhooks.ts` (JS-007)
  manages the merchant's webhook subscription.
- **`lib/`** — shared helpers with no DB access. `date-range.ts` turns a bare
  `YYYY-MM-DD` upper bound into the next day's midnight so `created_at < ?`
  includes the whole requested day (used by revenue; `listByMerchant` has the
  same boundary and does not use it yet). `validate-order.ts` is the single
  definition of a valid `POST /api/orders` body (positive integer cents,
  required `type` of `sale` or `refund` with no default, non-blank email);
  routes call it and answer a generic `invalid_body`. `webhook-url.ts` is the
  SSRF policy for merchant-supplied URLs (see "Webhooks frontier").
  `timestamp.ts` normalises stored timestamps to ISO 8601 UTC for payloads.

## Data model

Four tables: `merchants`, `orders`, and since JS-007 `webhook_subscriptions` and
`webhook_events` (see "Webhooks frontier"). See `db.ts` for the canonical DDL.

`orders.type` is one of `'sale' | 'refund'`. A refund row records that a sale
was reversed; it does not by itself reverse the sale row.

Known gap: the column is still declared `type TEXT NOT NULL DEFAULT 'sale'` in
`db.ts`. The API never relies on that default (the validator requires `type`
and `ordersDal.create` requires it at compile time), but an insert written in
raw SQL that skips the column would silently become a `sale`. Removing the
default needs a migration that rebuilds the table, so it is tracked as Post MVP.

## Webhooks frontier (Feature B, in slices)

New frontier, depends on Merchant (tenant scope) and, from JS-008, on Orders
(order creation is the event source). Slices: JS-007 subscriptions (shipped),
JS-008 transactional outbox (shipped), JS-009 dispatcher + HMAC + retries,
JS-010 docs. Until JS-009 ships, events are persisted and not delivered.

- **Tables** (`db.ts`): `webhook_subscriptions` (one row per merchant, UNIQUE
  `merchant_id`, `url`, `secret`) and `webhook_events` (the outbox: `payload`
  is the exact JSON to send, `status`, `attempts`, `next_attempt_at`,
  `last_error`, `delivered_at`; index on `(status, next_attempt_at)`).
  `webhook_events` is also the seed of the Auditlog frontier. Both are
  `CREATE TABLE IF NOT EXISTS`, so existing databases gain them on start.
- **Secret**: 32 random bytes, hex. Returned once at creation, never logged,
  never in `GET`. Stored as is, because HMAC signing needs the raw value
  (encryption at rest: BACKLOG PM-30).
- **SSRF policy** (`lib/webhook-url.ts`): we POST to a URL chosen by the
  merchant, so it must not point inside our network. `https` only, no
  credentials, no loopback / private / link-local / CGNAT / unspecified hosts
  in IPv4 or IPv6 (including IPv4 embedded in IPv6). The check runs on the
  hostname after WHATWG URL parsing, which normalises integer, hex, octal and
  short IPv4 forms. Known gap: a public hostname that resolves to an internal
  address (DNS rebinding) is not caught; needs resolution at subscribe and send
  time (BACKLOG PM-16).
- **`WEBHOOK_ALLOW_INSECURE_URLS=1`**: development only. Accepts loopback hosts
  over `http`/`https` for a local receiver. Everything else stays blocked.
- **Transactional outbox** (JS-008): `POST /api/orders` → `ordersService.createOrder`
  → one `db.transaction` that inserts the order and, if the merchant has a
  subscription, one `order.created` row in `webhook_events` (`pending`,
  `attempts 0`, `next_attempt_at = now`). Either both rows exist or neither.
  Publishing after the insert in a separate step would lose the event on a
  crash between the two; this is why the outbox is in the same transaction.
  The transaction is synchronous (better-sqlite3), no async work inside.
- **Business rule** (Javier): a merchant only receives events for orders created
  while subscribed. No subscription, no event row; no backfill on subscribing.
- **Payload**: built by the pure `buildOrderCreatedPayload`, stored as the exact
  JSON string to send so the dispatcher never rebuilds it and the event stays
  immutable. `event_id` = outbox row id = consumer idempotency key. Timestamps
  leave as ISO 8601 UTC (`lib/timestamp.ts` normalises SQLite's format for the
  payload only; the stored mix stays, BACKLOG PM-05).
- **Races**: the route checks for an existing subscription, and the UNIQUE
  constraint is the backstop for two concurrent creations (mapped to 409).

## Development workflow

Work is organised in tasks under `docs/tasks/` (one contract file per task,
priority-ordered index). Claude Code is configured through `CLAUDE.md` and
`.claude/settings.json`: every session starts with a plan that the owner
approves, changes under `src/` ship with unit tests, and the session is
recorded in `prompt_history.md` before the owner commits.

The golden gate is designed in `CLAUDE.md` and implemented in JS-006:
`npm run check` runs `scripts/golden-gate.sh` (`tsc --noEmit`, then the test
suite, red on any failed, cancelled, skipped or todo test, and red if the
summary cannot be read). The versioned hook `.githooks/pre-commit` runs it on
every commit; `npm install` activates the hook through the `prepare` script
(`scripts/install-hooks.sh` sets `core.hooksPath`, a per-clone setting). Known
limits, tracked in `docs/tasks/BACKLOG.md`: `--no-verify` bypasses the hook and
there is no server-side CI (PM-02), ESLint is not in the gate (PM-01), `test/`
is not type-checked because `tsconfig.json` only includes `src/` (PM-28).

## Open items

- ~~Wire `dashboard.tsx` once we pick a frontend framework~~ — went with static HTML+fetch instead. Doc stale.
- Decide whether `analytics-events` is its own service or a route here.
- Audit logging — TBD where it lives.

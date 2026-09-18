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
- **`routes/`** — Express routers, one file per resource.
- **`lib/`** — shared helpers with no DB access. `date-range.ts` turns a bare
  `YYYY-MM-DD` upper bound into the next day's midnight so `created_at < ?`
  includes the whole requested day (used by revenue; `listByMerchant` has the
  same boundary and does not use it yet). `validate-order.ts` is the single
  definition of a valid `POST /api/orders` body (positive integer cents,
  required `type` of `sale` or `refund` with no default, non-blank email);
  routes call it and answer a generic `invalid_body`.

## Data model

Two tables: `merchants`, `orders`. See `db.ts` for the canonical DDL.

`orders.type` is one of `'sale' | 'refund'`. A refund row records that a sale
was reversed; it does not by itself reverse the sale row.

Known gap: the column is still declared `type TEXT NOT NULL DEFAULT 'sale'` in
`db.ts`. The API never relies on that default (the validator requires `type`
and `ordersDal.create` requires it at compile time), but an insert written in
raw SQL that skips the column would silently become a `sale`. Removing the
default needs a migration that rebuilds the table, so it is tracked as Post MVP.

## Development workflow

Work is organised in tasks under `docs/tasks/` (one contract file per task,
priority-ordered index). Claude Code is configured through `CLAUDE.md` and
`.claude/settings.json`: every session starts with a plan that the owner
approves, changes under `src/` ship with unit tests, and the session is
recorded in `prompt_history.md` before the owner commits. The golden gate
(lint with zero warnings + all tests green, enforced by a pre-commit hook) is
designed in `CLAUDE.md` and implemented in task JS-006.

## Open items

- ~~Wire `dashboard.tsx` once we pick a frontend framework~~ — went with static HTML+fetch instead. Doc stale.
- Decide whether `analytics-events` is its own service or a route here.
- Audit logging — TBD where it lives.

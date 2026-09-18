# JS-004 — Revenue and Metrics frontier fix

| Field    | Value                                  |
|----------|----------------------------------------|
| Status   | done                                   |
| Type     | bugfix                                 |
| Priority | 1                                      |
| Commits  | A `f7e813b` (metrics through the DAL) · B `3ba0151` (revenue semantics and `to` boundary) |

## Context

Frontiers: Revenue and Metrics, both read-only consumers of the Orders table. The architecture rule (`CLAUDE.md`, `docs/architecture.md`) says every order query goes through `ordersDal` (`src/dal/orders-dal.ts`). Revenue follows the rule; Metrics does not. The dashboard (`public/app.js`) shows four numbers from these two frontiers: total orders, unique customers, average order value and revenue for the last 30 days.

Decisions taken in the JS-003 architecture session (2026-09-18) and recorded by Javier in `docs/personal-notes.md`: the metrics frontier fix was the original intent of this task; the wrong revenue calculation was found during the session and Javier accepted it as P0 for the same task; the `to` boundary bug is included ("small change, production users will be graceful"); mixed timestamp formats and the float `revenue` field go to Post MVP.

## What is wrong / what is missing

1. **Metrics bypasses the DAL.** `src/routes/metrics.ts:4-5` opens a second `better-sqlite3` connection (`readonly: true`) at module import time and runs three aggregate queries against it (`metrics.ts:17-31`, `45-54`). Consequences: the DAL rule is broken; with `DB_PATH=:memory:` this is a different, empty database, so metrics cannot be unit-tested today; the connection only works because `src/db.ts` is imported first and creates the file (import-order dependency).
2. **Revenue adds refunds.** `ordersDal.sumAmountByMerchant` (`src/dal/orders-dal.ts:54-63`) sums `total_amount` for every row. Refunds are stored as positive amounts with `type = 'refund'` (`src/scripts/seed.ts:43-44`), so a refund increases revenue. `status` is ignored too. Same class in metrics: average order value and top-customers `total_spent` count refunds as spend.
3. **Today's orders are excluded.** The dashboard sends `to=YYYY-MM-DD` (`public/app.js:28`) and the DAL compares `created_at < ?` (`orders-dal.ts:59`). Seeded `created_at` values are ISO timestamps with a `T`, so any order dated today compares greater than the bare date and falls out of the 30-day figure. `from` is unaffected (`>=` on a prefix works).

## Objective (what I propose)

Move the metrics queries into `ordersDal`, delete the second connection, and make `metrics.ts` a thin router like `revenue.ts`. Redefine revenue in one place, the DAL, as the sum of completed sales minus completed refunds. Treat a bare-date `to` as inclusive of that whole day (exclusive bound = `to` + 1 day) so the 30-day figure includes today. After this task, the dashboard revenue and averages exclude refunds, include today, and every Metrics and Revenue number is covered by a unit test against the in-memory DB.

## Scope

- In:
  - `src/dal/orders-dal.ts`: new aggregate functions for metrics (`countByMerchant`, `countDistinctCustomers`, `avgSaleAmount`, `topCustomers` or equivalent names), revenue rewritten (`revenueByMerchant` replacing `sumAmountByMerchant`), date-range normalisation of `to`.
  - `src/routes/metrics.ts`: uses `ordersDal`; second `Database` connection removed; `better-sqlite3` import removed.
  - `src/routes/revenue.ts`: calls the new DAL function; response keeps `revenue_cents`.
  - Semantics (Javier may change them in the plan phase): `total_orders` = all rows for the merchant (unchanged); `unique_customers` = distinct emails over all rows (unchanged); `avg_order_value_cents` = average over completed sales only; `top-customers.total_spent` = completed sales minus completed refunds; `revenue_cents` = completed sales minus completed refunds in the range.
  - Tests listed under Validation.
  - `docs/api.md` (metrics fields documented, revenue semantics), `docs/architecture.md` (metrics now through the DAL).
- Out (explicitly not touched, even if tempting):
  - Mixed `created_at` formats (seed writes ISO with `T`/`Z`, POST writes SQLite `CURRENT_TIMESTAMP` with a space). Post MVP.
  - The float `revenue: total / 100` field in the revenue response. Post MVP. Leave the field as is.
  - The same `to` boundary bug in `ordersDal.listByMerchant` (`orders-dal.ts:27`) used by `GET /api/orders?from&to`. Noticed, same class; report in the session log, do not fix here unless Javier moves it in during the plan phase.
  - `GET /api/orders?limit=abc` producing `NaN` and a 500. Noticed, not fixed.
  - `metrics.top-customers` `limit` unbounded. Noticed, not fixed.
  - Frontend changes.

## Restrictions

- No new dependencies. Route tests use `express` + Node's global `fetch` against `app.listen(0)`; no supertest.
- Do not import `src/server.ts` in tests (it listens and seeds on import). Build a small app in the test with the router and a stub auth middleware that sets `req.merchantId`.
- Amounts stay integer cents end to end. Revenue is computed in SQL with `CASE type WHEN 'sale' THEN total_amount WHEN 'refund' THEN -total_amount END`, never by subtracting floats in JS.
- All SQL parameterized. The date normalisation happens in TypeScript before binding; no string building inside SQL.
- Tests must not depend on execution order: clear `orders` (and insert the test merchant) in `beforeEach`.
- Do not rename or edit the existing `test/orders.test.ts` beyond what compiles.

## Edge cases

- Merchant with no orders: revenue 0, average 0, top customers `[]`, counts 0.
- Refund larger than sales in the range: negative `revenue_cents` is returned and documented (no clamping).
- Order with `status` other than `completed` (insert one directly in the test): excluded from revenue and average.
- `to` as bare date: an order at `<to>T23:59:59.000Z` is included; an order on `<to>` + 1 day at `00:00:00.000Z` is excluded.
- `to` already a full ISO timestamp: passed through unchanged (exclusive).
- `from` bare date: inclusive from `00:00:00` (current behaviour, covered by a test).
- Metrics under `DB_PATH=:memory:` see the rows inserted by the test (proves the second connection is gone).

## Expected result

- Dashboard: "Revenue (30d)" excludes refunds and includes today's orders; "Avg order" excludes refunds. Numbers go down for both seeded merchants.
- `GET /api/revenue?from=2026-08-19&to=2026-09-18` returns `revenue_cents` equal to completed sales minus completed refunds in `[from 00:00, to+1d 00:00)`.
- `GET /api/metrics/summary` and `/top-customers` return the same shape as before with corrected values.
- `src/routes/metrics.ts` has no `better-sqlite3` import.
- `npm test` green with the new test files.

## Acceptance criteria

- [ ] `grep -n "new Database" src/routes` returns nothing.
- [ ] Revenue golden test: sale 10000 + refund 3000 (both completed) => `revenue_cents` 7000.
- [ ] Revenue excludes an order with `status = 'pending'`.
- [ ] Revenue with bare-date `to` includes an order created at `<to>T12:00:00.000Z`.
- [ ] Average order value ignores refunds and non-completed rows.
- [ ] Top customers `total_spent` = sales minus refunds per customer, ordered descending.
- [ ] Metrics route tests pass under `DB_PATH=:memory:`.
- [ ] `docs/api.md` documents the metrics fields and the revenue definition; `docs/architecture.md` no longer says metrics bypasses the DAL.

## Validation

- Tests to add (file names and what each asserts):
  - `test/orders-dal.test.ts`: `revenueByMerchant` golden case, status filter, bare-date `to` inclusive, full-ISO `to` exclusive, `from` inclusive, negative revenue; metrics aggregates (count, distinct customers, average over sales only, top customers ordering and sign).
  - `test/revenue.test.ts`: `GET /` returns 400 `missing_date_range` without params; returns `revenue_cents` from the DAL for a seeded in-memory dataset.
  - `test/metrics.test.ts`: `/summary` and `/top-customers` return the corrected values from the in-memory DB; `limit` respected.
- Commands to run: `npm test` (lint does not exist; golden gate checked by hand until JS-006).
- What to click or call in the dashboard / API to see it working: `npm run dev`, open http://localhost:3000, switch merchants, compare "Revenue (30d)" with `curl -H 'X-Merchant-Id: m_acme' 'localhost:3000/api/orders?limit=100'` summed by hand for sales minus refunds in the last 30 days including today.

## Confidence and falsification

- Confidence (1–10): 8 [proposed by Claude, Javier confirms]. The DAL move is mechanical; the revenue definition is a product decision that the seed data supports but nobody has confirmed.
- How to know if I am wrong (a specific scenario that would prove the change wrong): a consumer of `GET /api/revenue` or the seed already treats refunds as negative `total_amount` (then the fix double-counts the sign); or a business rule says refunds must not reduce revenue of the period in which they happen but of the original sale's period.

## Session log

- 2026-09-18 — Contract created in the JS-003 tasks-definition session from Javier's "Notes after discussion". Javier's decisions: include the `to` boundary fix; timestamps and float money to Post MVP. No work started.
- 2026-09-18 — Execution session (same Claude Code session as JS-003, id `c9c48822-4fb8-46ba-a62e-2cd24be43f40`). Plan approved with five decisions by Javier: (1) one module-level constant SQL fragment for the signed amount ("it is not user input is a rule we can define in code"); (2) `top-customers.order_count` counts all rows; (3) `sumAmountByMerchant` removed ("I have already checked and yes no other uses"); (4) two commits, A metrics through the DAL, B revenue semantics + `to` boundary; (5) Claude allowed to run `npx tsc --noEmit`.
  - Step A: `summaryByMerchant` and `topCustomers` in the DAL, `metrics.ts` rewritten without its own connection, `test/orders-dal.test.ts` (12 tests) and `test/metrics.test.ts` (5 tests), api.md and architecture.md updated. Beyond the plan: a deterministic tie-breaker (`customer_email ASC`) was added to `topCustomers` after Claude's own fixture produced a tie that SQL ordered arbitrarily (caught by a failing test, not by Javier); reported to Javier, who committed A without objection. Commit `f7e813b`.
  - Step B: `src/lib/date-range.ts` (`toExclusiveUpperBound`), `revenueByMerchant` replaces `sumAmountByMerchant`, `revenue.ts` calls it, `test/date-range.test.ts` (5), revenue cases in `test/orders-dal.test.ts` (10), `test/revenue.test.ts` (4). The boundary fix is covered for both `created_at` formats present in the table (ISO with `T` from the seed, `YYYY-MM-DD HH:MM:SS` from SQLite `CURRENT_TIMESTAMP` on POST); the format mix itself stays Post MVP.
  - Golden gate by hand: `npx tsc --noEmit` exit 0; `npm test` 38 tests, 38 pass, 0 fail, 0 skipped, 0 todo, 0 cancelled.
  - Noticed, not fixed (same class or out of scope): `listByMerchant` has the same `to` boundary bug and does not use the helper yet; `GET /api/orders?limit=abc` and `top-customers?limit=abc` bind `NaN` and return 500; the float `revenue` field remains; `detail` string in the revenue 400 remains (Post MVP custom errors).
  - Semantics fixed in this task (product decisions Javier can revisit): `total_orders` and `order_count` count every row; `avg_order_value_cents` averages completed sales only; `total_spent` and `revenue_cents` are completed sales minus completed refunds and may be negative.

# JS-005 — Tenant isolation on order lookup and input validation on order creation

| Field    | Value                                  |
|----------|----------------------------------------|
| Status   | done                                   |
| Type     | bugfix                                 |
| Priority | 2                                      |
| Commits  | A `e9f003b` (tenant isolation) · B `8d67565` (input validation, `type` required) |

## Context

Frontiers: Merchant and Orders. The Merchant boundary is enforced only by the `X-Merchant-Id` header (`src/auth.ts`), and every Orders query is expected to be scoped by `req.merchantId`. This task replaces the "SQL injection" item from `docs/personal-notes.md`: in the JS-003 session Javier verified that every query in `src/` already uses `?` placeholders (better-sqlite3 prepared statements), so there is no injection to fix. Javier's note: "IA was correct, there is not any SQL injection I was confused - expecting to see :param as JPA." The two real findings in the same area are below. Per Javier's notes each vulnerability ships in its own commit.

## What is wrong / what is missing

1. **Cross-tenant read (commit A).** `ordersDal.getById(id)` (`src/dal/orders-dal.ts:38-40`) filters by `id` only. `GET /api/orders/:id` (`src/routes/orders.ts:16-23`) passes the id straight through, so merchant A can read merchant B's order by knowing its UUID. Order IDs will be sent to third parties by the webhook feature (JS-008), so guessing is not required.
2. **Unvalidated order input (commit B).** `POST /api/orders` (`src/routes/orders.ts:25-44`) only checks `customer_email` is truthy and `total_amount` is a number. It accepts negative and fractional amounts (violating the integer-cents rule in `CLAUDE.md`), and any string for `type` (the schema expects `'sale' | 'refund'`, `orders-dal.ts:8`). Invalid rows silently corrupt revenue and metrics.

## Objective (what I propose)

Commit A: `getById` takes `(merchantId, id)` and filters on both; the route returns 404 `not_found` for another merchant's order (404, not 403, so existence is not leaked). `create` reuses the scoped lookup. Commit B: `POST /api/orders` rejects with 400 `invalid_body` unless `customer_email` is a non-empty string, `total_amount` is a positive integer (`Number.isInteger(x) && x > 0`) and `type` is absent, `'sale'` or `'refund'` (**amended 2026-09-18 by Javier: `type` is required, no default; see session log**). After this task no order can be read across merchants and no non-integer or non-positive amount can enter the table through the API.

## Scope

- In:
  - `src/dal/orders-dal.ts`: `getById(merchantId, id)` signature; `create` updated accordingly.
  - `src/routes/orders.ts`: pass `req.merchantId` to `getById`; validation block on POST extracted to a small pure function (`validateCreateOrderBody` in the route file or `src/lib/validate-order.ts`) so it is unit-testable.
  - Tests listed under Validation.
  - `docs/api.md`: `POST /api/orders` body rules and error codes; `GET /api/orders/:id` scoping.
- Out (explicitly not touched, even if tempting):
  - SQL injection: none present. The class gate (an ESLint rule forbidding template literals inside `.prepare()` / `.exec()`) is Post MVP together with ESLint (Javier, 2026-09-18: new dependencies could bring new vulnerabilities; no time).
  - Dependency vulnerabilities (`npm audit`: 1 low, 3 moderate). Post MVP.
  - Error detail leak in `src/routes/revenue.ts:15` (`detail` field). Post MVP (custom project errors).
  - Auth model (header trusted, merchant existence not checked; unknown merchant on POST hits the FK and returns 500). Noticed, not fixed.
  - Email format validation beyond "non-empty string". Noticed, not fixed.
  - `limit` parsing (`NaN` → 500) in `GET /api/orders`. Noticed, not fixed.

## Restrictions

- No new dependencies (no validation library).
- Two commits, in this order: A tenant isolation, B input validation. Each commit must pass `npm test` on its own.
- Error responses stay generic codes: `not_found`, `invalid_body`. No field-level messages.
- Route tests follow the JS-004 pattern: router mounted on a test app with a stub auth middleware, `app.listen(0)`, global `fetch`. Do not import `src/server.ts`.
- Tests clear tables in `beforeEach`; no order dependence.

## Edge cases

- Own order by id → 200 with the order.
- Existing order of another merchant → 404 `not_found` (same body as a non-existent id).
- Non-existent id → 404 `not_found`.
- `total_amount` = 0, -1, 10.5, `"100"` (string), missing → 400 `invalid_body`.
- `total_amount` = 1 → 201.
- ~~`type` missing → stored as `sale`~~ **amended 2026-09-18: `type` missing → 400**; `type` = `'sale'` or `'refund'` → 201; `type` = `'SALE'`, `'gift'`, `1`, `null` → 400.
- `customer_email` = `""` or missing or non-string → 400.
- Body with extra unknown fields → ignored, 201 (no strict schema).

## Expected result

- `curl -H 'X-Merchant-Id: m_bistro' localhost:3000/api/orders/<an m_acme order id>` → `404 {"error":"not_found"}`.
- `curl -X POST -H 'X-Merchant-Id: m_acme' -H 'Content-Type: application/json' -d '{"customer_email":"a@b.com","total_amount":10.5}' localhost:3000/api/orders` → `400 {"error":"invalid_body"}`.
- Dashboard behaviour unchanged (it never fetches by id and never posts).
- `npm test` green.

## Acceptance criteria

- [ ] `ordersDal.getById('m_a', id)` returns `undefined` for an order belonging to `m_b`.
- [ ] `GET /:id` returns 404 for another merchant's order and 200 for the owner.
- [ ] `validateCreateOrderBody` rejects 0, negative, fractional, string and missing amounts.
- [ ] `validateCreateOrderBody` rejects any `type` outside `sale` / `refund` ~~and defaults a missing type to `sale`~~ **and rejects a missing `type` (amended 2026-09-18)**.
- [ ] `POST /` returns 400 `invalid_body` for each rejected case and 201 for a valid body.
- [ ] `docs/api.md` documents the rules and codes.
- [ ] Two commits, each green.

## Validation

- Tests to add (file names and what each asserts):
  - `test/orders-dal.test.ts` (created in JS-004; extend): `getById` scoping across two merchants.
  - `test/orders.test.ts` (exists, holds DAL tests; extend with route tests since the module is `routes/orders.ts`): `GET /:id` 200 own / 404 other / 404 missing; `POST /` table of invalid bodies → 400, valid → 201 ~~with `type` default~~ (amended 2026-09-18: with explicit `type`; missing `type` is in the invalid table).
  - `test/validate-order.test.ts` if the validator lives in `src/lib/validate-order.ts`.
- Commands to run: `npm test` (golden gate by hand until JS-006).
- What to click or call in the dashboard / API to see it working: the two `curl` calls under Expected result, plus a valid POST and `GET /api/orders?limit=1` to see the new row.

## Confidence and falsification

- Confidence (1–10): 9 [proposed by Claude, Javier confirms]. Both fixes are local, small and fully testable; the only open question is the 404-vs-403 choice.
- How to know if I am wrong (a specific scenario that would prove the change wrong): a legitimate cross-merchant reader exists (a back-office role using `X-Merchant-Id` as an admin) and now gets 404; or an existing client sends amounts as decimal currency (e.g. `10.50`) expecting the API to convert to cents, and now every order is rejected.

## Session log

- 2026-09-18 — Contract created in the JS-003 tasks-definition session. Replaces the SQL-injection item after code review showed all queries are parameterized. Javier's decisions: tenant isolation + POST validation in scope; SQL-injection ESLint gate, dependencies and custom errors to Post MVP. No work started.
- 2026-09-18 — Execution session (Claude Code session `c9c48822-4fb8-46ba-a62e-2cd24be43f40`). Plan approved with three decisions by Javier: (1) blank emails are rejected and the email is stored as sent, no trimming ("Reject blank ones"); (2) the one-argument update of the existing `getById` test in `test/orders.test.ts` approved; (3) unknown `X-Merchant-Id` on POST (FK failure, 500) stays out ("we will only do what is defined in the spec").
  - Step A: `getById(merchantId, id)`, `create` and `GET /:id` updated, 4 DAL tests + 4 route tests, api.md. Javier asked for terminal commands to verify the 404 himself against the running server before committing; commit `e9f003b`.
  - Step B: `src/lib/validate-order.ts` (`validateCreateOrderBody`, pure, returns no failure reason), POST route uses it, `test/validate-order.test.ts` (29 cases, table-driven), POST route tests in `test/orders.test.ts` (17: every invalid body returns 400 and stores nothing; body `merchant_id`/`id`/`status` are ignored). api.md and architecture.md updated.
  - Golden gate by hand: `npx tsc --noEmit` exit 0; `npm test` 92 tests, 92 pass, 0 fail, 0 skipped, 0 todo, 0 cancelled.
  - Noticed, not fixed: unknown merchant header on POST → FK error → 500; `limit=abc` → 500; no email format check; `detail` string in the revenue 400. The SQL-injection lint gate stays Post MVP with ESLint.
- 2026-09-18 — Review of step B, before commit B. **Javier rejected one rule Claude had written into the contract and the validator: a missing `type` defaulting to `sale`.** His words: "I think this must be an existing value in the request, we only accept sale or refund and is case-sensitive [...] we are creating an Order - we must know if it is sale or refund and do not decide by default." Done in plan mode:
  - Impact check: `public/app.js` only issues GETs through one `fetch` helper and `public/index.html` posts nothing, so the dashboard is unaffected (Javier had checked this himself first). The only caller of `ordersDal.create` is the POST route; the seed inserts with raw SQL and always passes `type`.
  - Change: `validateCreateOrderBody` requires `type`; `?? 'sale'` removed. Test fixtures changed so every rejected case carries a valid `type` and fails for exactly one reason; new cases `type` missing, `type` undefined, `type` null. api.md marks `type` as required and records the behaviour change; architecture.md updated.
  - Javier's second decision (plan comment): the column default `type TEXT NOT NULL DEFAULT 'sale'` in `src/db.ts` stays, "out of scope since it requires a DDL script". Residual risk recorded in architecture.md (Data model): the DAL requires `type` at compile time, but raw SQL that skips the column would still silently produce a `sale`. Candidate for Javier's Post MVP list.
  - Golden gate by hand after the amendment: `npx tsc --noEmit` exit 0; `npm test` 96 tests, 96 pass, 0 fail, 0 skipped, 0 todo, 0 cancelled.

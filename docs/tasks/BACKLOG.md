# Backlog — Post MVP

**Everything in this file is Post MVP and out of scope for the recruiting challenge.** It exists so that nothing found along the way depends on memory. Created 2026-09-18.

- Rows here are never selected by "next task". That rule only reads `INDEX.md`, and no row in this file is a task yet.
- IDs are `PM-nn`, sequential, never reused. An item receives a `JS-nnn` only when it is promoted.
- Order inside a group is discovery order, not priority. Prioritising is Javier's call at promotion time.
- `State` is `open`, `promoted → JS-nnn`, or `resolved in JS-nnn` when an item got fixed inside another task. Rows are kept, not deleted.
- Promotion procedure and the rule for adding new findings are in [`README.md`](README.md), section "Backlog (Post MVP)".

## Group A — explicit Post MVP decisions by Javier

| ID | Item | Origin | Why deferred | Where | State |
|----|------|--------|--------------|-------|-------|
| PM-01 | ESLint (zero errors, zero warnings) plus the SQL-injection lint gate: a `no-restricted-syntax` rule forbidding template literals inside `.prepare()` / `.exec()`, with the one approved exception `SIGNED_COMPLETED_AMOUNT_SQL` | JS-003 tasks-definition session, plan question 4 | Javier: "Eslint add new dependencies which means possible new vulnerabilities could be found - due to the time i have, please move it to post mvp" | `CLAUDE.md` golden gate (marks ESLint as Post MVP since JS-006); [JS-006](done/JS-006-golden-gate-precommit.md) "Out"; [JS-005](done/JS-005-tenant-isolation-order-validation.md) "Out" | open |
| PM-02 | Server-side CI (GitHub Actions) running the golden gate on every push, so `--no-verify` cannot bypass it | JS-003 architecture session; Javier's notes on Problem 1 | Javier: "GitHub Actions is out of scope and must go to Post MVP section"; only the local pre-commit hook is built in JS-006 | [JS-006](done/JS-006-golden-gate-precommit.md) "Out"; `scripts/golden-gate.sh` is the command a workflow would run | open |
| PM-03 | Dependency audit: `npm audit` reports 1 low + 3 moderate (`qs`, `body-parser`, `esbuild` via `express` / `tsx`); remove unused dependencies; pin used ones to LTS versions with valid SHA | Javier's notes, Problem 2; confirmed in JS-003 with `npm audit` | Javier moved it out of the security task; upgrades need his approval per `CLAUDE.md` | `package.json`, `package-lock.json` | open |
| PM-04 | Custom project errors: responses must be generic codes only. Known instance: the `detail` string in the revenue 400 | Javier's notes, Problem 2; instance found in JS-003 | Javier moved it out of the security task | `src/routes/revenue.ts:16` | open |
| PM-05 | Mixed `created_at` formats in one column: the seed writes ISO (`2026-09-18T10:00:00.000Z`), `POST /api/orders` gets SQLite `CURRENT_TIMESTAMP` (`2026-09-18 10:00:00`). String comparison and ordering differ inside the same day | JS-003 architecture session; Javier's notes on Problem 3 | Javier: out of scope for JS-004. JS-004 tests cover the revenue boundary for both formats, the mix itself remains | `src/db.ts:30`, `src/scripts/seed.ts:21` | open |
| PM-06 | Float money in the API: `revenue: total / 100` breaks the integer-cents rule. The dashboard only reads `revenue_cents`. Removing the field is a breaking change to document | JS-003 architecture session; Javier's notes on Problem 3 | Javier: out of scope for JS-004 | `src/routes/revenue.ts:26`, `docs/api.md` (marked legacy) | open |
| PM-07 | Column default `type TEXT NOT NULL DEFAULT 'sale'`: the API and the DAL never rely on it, but raw SQL that skips the column silently produces a sale. Needs a migration that rebuilds the table, including existing `data/dashboard.db` files | JS-005 step B review (plan comment) | Javier: "We will leave this change out of scope since it requires a DDL script" | `src/db.ts:28`; `docs/architecture.md` Data model "Known gap" | open |
| PM-08 | Dead-letter queue for webhook events that end `failed` after the last retry, with a way to inspect and replay them | Javier's original webhook proposal, point 4 (JS-003 prompt) | Javier: "For out of scope - implement a DLQ for this escenario" | [JS-009 contract](pending/JS-009-webhooks-dispatcher.md) "Out" | open |

## Group B — noticed during tasks, not fixed

Javier on these (notes, JS-004 commit B): "Out of scope we will leave at it is, no time to fix new findings."

| ID | Item | Origin | Why deferred | Where | State |
|----|------|--------|--------------|-------|-------|
| PM-09 | `GET /api/orders?from&to` has the same `to` boundary bug fixed for revenue in JS-004: a bare-date `to` excludes that whole day. Fix is to reuse `toExclusiveUpperBound` | JS-004 (same class as the revenue bug) | Out of the JS-004 contract scope | `src/dal/orders-dal.ts:60` (`listByMerchant`); helper in `src/lib/date-range.ts` | open |
| PM-10 | `limit` query param: a non-numeric value becomes `NaN`, the SQLite bind fails and the API returns 500 instead of 400. `limit` is also unbounded (no maximum) | JS-003 review; confirmed in JS-004 and JS-005 | Out of both contracts' scope | `src/routes/orders.ts:12`, `src/routes/metrics.ts:25` | open |
| PM-11 | `POST /api/orders` with an `X-Merchant-Id` that has no merchant row hits the foreign key and returns 500 instead of a 4xx. Same behaviour on `POST /api/webhooks/subscription` since JS-007 | JS-005 plan question 3 | Javier: "stays out - we will only do what is defined in the spec" | `src/routes/orders.ts` (POST), `src/routes/webhooks.ts` (POST), FKs in `src/db.ts` | open |
| PM-12 | `customer_email` is only checked for "not blank"; no format validation, no normalisation (stored as sent by Javier's decision) | JS-005 | Out of the JS-005 contract scope; normalising customer data is a product decision | `src/lib/validate-order.ts:33` | open |
| PM-13 | Auth model: the `X-Merchant-Id` header is trusted as is, merchant existence is never verified, any string becomes a tenant. The code comments say it is a placeholder for a signed token | JS-003 architecture session | Intentionally simple per the challenge; replacing it is a feature of its own | `src/auth.ts:17-22` | open |
| PM-28 | Test files are not type-checked: `tsconfig.json` only includes `src/`, and `tsx` strips types without checking, so a type error in `test/` passes the golden gate. Needs a `tsconfig` that includes `test/` (and a decision on `rootDir` / `noEmit`) | JS-006 plan question 3 | Javier: "for now we are only including src/. Kept it out and add the backlog row" | `tsconfig.json` (`include`), `scripts/golden-gate.sh` step 1 | open |
| PM-29 | `CLAUDE.md` still says "Node >= 20 (local: 24)" after `engines` moved to `>=22` in JS-006. One-line edit that needs Javier's approval because the file is protected | JS-006 close | Not among the `CLAUDE.md` lines Javier approved in the JS-006 plan | `CLAUDE.md` "Stack and commands" | resolved in JS-006 (2026-09-18): Javier authorised the edit, line now says "Node >= 22" |

## Group C — deferred from the webhook contracts

These come from the "Out" sections of JS-007 to JS-010, written before those tasks run. If a slice does not ship, its rows here still hold.

| ID | Item | Origin | Why deferred | Where | State |
|----|------|--------|--------------|-------|-------|
| PM-14 | Emit `order.refunded` and `order.status_changed`. No trigger exists today: there is no refund endpoint (a refund row is not linked to a sale) and no status-change endpoint. The event type values are reserved | JS-003 architecture session | Needs new order mutations first; MVP emits `order.created` only | [JS-008 contract](pending/JS-008-webhooks-outbox.md) "Scope" and "Out" | open |
| PM-15 | Dashboard UI to create, view and delete the webhook subscription | Javier's original webhook proposal, point 6 | Javier: "no frontend yet just APIs" | [JS-007](done/JS-007-webhooks-subscriptions.md) "Out" | open |
| PM-16 | SSRF hardening: resolve the webhook host and re-check the IP at subscribe time and at send time, to stop DNS rebinding (a public hostname that later resolves to an internal address). MVP only checks literal hosts and IP ranges | JS-003 architecture session (SSRF was the finding missing from Javier's six points) | Residual risk accepted for the MVP | [JS-007](done/JS-007-webhooks-subscriptions.md) "Out"; [JS-009](pending/JS-009-webhooks-dispatcher.md) "Out" | open |
| PM-17 | Multi-process safety for the dispatcher: row claiming or leases so two server processes sharing the SQLite file cannot deliver the same due event twice | JS-003 architecture session | MVP assumes a single process and documents it | [JS-009 contract](pending/JS-009-webhooks-dispatcher.md) "Out" and "How to know if I am wrong" | open |
| PM-18 | Webhook secret rotation and more than one signature version (`v1` only today); `PUT`/`PATCH` on the subscription; multiple subscriptions per merchant; event-type filters | JS-003 architecture session | MVP: one subscription per merchant, secret shown once | [JS-007](done/JS-007-webhooks-subscriptions.md) "Out"; [JS-009](pending/JS-009-webhooks-dispatcher.md) "Out" | open |
| PM-19 | Endpoint to list a merchant's webhook events with their delivery state, and a manual replay endpoint; subscription auto-disable after repeated failures | JS-003 architecture session | Out of the MVP slices; related to PM-08 | [JS-009 contract](pending/JS-009-webhooks-dispatcher.md) "Out" | open |
| PM-30 | Webhook signing secrets are stored in plaintext in `webhook_subscriptions.secret`. HMAC needs the raw value, so hashing is not possible; protecting it means encryption at rest with a key kept outside the database (key management, rotation) | JS-007 plan (stated before approval) | Needs key management; accepted for the MVP | `src/db.ts` (`webhook_subscriptions`), `src/routes/webhooks.ts` (secret generation) | open |

## Group D — Javier's original Post MVP list

Copied from `docs/personal-notes.md` ("Post MVP", items 1 to 8) so the whole backlog is in one place. The notes file stays the source for the wording and is not edited by Claude.

| ID | Item | Origin | Why deferred | Where | State |
|----|------|--------|--------------|-------|-------|
| PM-20 | CI improvement: code scanners | Notes, Post MVP 1 | Not part of the challenge | `docs/personal-notes.md`; related: PM-01, PM-02 | open |
| PM-21 | CD: deployments and rollback | Notes, Post MVP 2 | Not part of the challenge | `docs/personal-notes.md` | open |
| PM-22 | Metrics and observability | Notes, Post MVP 3 | Not part of the challenge | `docs/personal-notes.md` | open |
| PM-23 | Code improvement: Javier's handwritten findings about this repo | Notes, Post MVP 4 | Not part of the challenge; the findings are on paper, not in the repo | `docs/personal-notes.md`; related: Group B | open |
| PM-24 | Scale the frontend: decide technology and framework, create the project, connect it to the backend | Notes, Post MVP 5 | Not part of the challenge | `docs/personal-notes.md`, `public/` | open |
| PM-25 | Scalability: prevent crashes if user interaction grows x10, x100, x1000 | Notes, Post MVP 6 | Not part of the challenge | `docs/personal-notes.md`; related: PM-10 (unbounded `limit`), PM-17 | open |
| PM-26 | Reliability: keep the system running if a disaster occurs, disaster recovery | Notes, Post MVP 7 | Not part of the challenge | `docs/personal-notes.md` | open |
| PM-27 | MVP / release / branch strategy: designed in the notes but not applied; all work goes to `feature/javier-sierra-challenge` with `JS-nnn` commits | Notes, Post MVP 8 | Javier: about 2.5 hours left when decided | `docs/personal-notes.md`, `CLAUDE.md` "Branch and commit conventions" | open |

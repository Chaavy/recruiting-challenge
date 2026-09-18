# JS-007 — Webhooks slice A: schema, DAL and subscription endpoints

| Field    | Value                                  |
|----------|----------------------------------------|
| Status   | done                                   |
| Type     | feature                                |
| Priority | 4                                      |
| Commits  | filled at close: short SHAs of the commits that ship this task (source for signoff.md) |

## Context

Feature B of the challenge (README "Feature menu"): merchants register an HTTPS URL and receive a POST when an order is created, refunded or changes status. Javier chose it for real-world experience. The JS-003 session (2026-09-18) confirmed there is no event mechanism in the codebase: the only mutation path is `POST /api/orders`; there is no refund endpoint (a refund is an order row with `type = 'refund'`, not linked to a sale) and no status-change endpoint (`status` is always `completed`).

The feature is sliced into four tasks so that any stop is a coherent deliverable (Javier: "small deliverables so if we run out of time, we can document and deliver with the proper comments"): JS-007 schema + subscriptions, JS-008 transactional outbox, JS-009 dispatcher + signing, JS-010 docs + end-to-end check. This slice introduces a new frontier, Webhooks, and the tables that later serve as the seed of the Auditlog frontier.

## What is wrong / what is missing

- No way for a merchant to register, read or remove a delivery URL.
- No tables for subscriptions or events.
- No protection against a merchant pointing us at an internal address (SSRF), a risk Javier accepted to prevent from the first slice.

## Objective (what I propose)

Add two tables to `initSchema`, a `webhooksDal`, and three merchant-scoped endpoints under `/api/webhooks/subscription` (POST, GET, DELETE) with one subscription per merchant. The URL is validated by a pure function: `https:` only, no loopback, private, link-local or unspecified hosts, no credentials in the URL. A random secret is generated at creation and returned exactly once. After this task a merchant can manage its subscription through the API and the events table exists, empty, ready for JS-008.

## Scope

- In:
  - `src/db.ts` `initSchema`:
    - `webhook_subscriptions(id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(id), url TEXT NOT NULL, secret TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    - `webhook_events(id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id), event_type TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, delivered_at TEXT)` with index `idx_webhook_events_due ON webhook_events(status, next_attempt_at)`.
  - `src/dal/webhooks-dal.ts`: `createSubscription`, `getSubscriptionByMerchant`, `deleteSubscriptionByMerchant`. Event functions arrive in JS-008.
  - `src/lib/webhook-url.ts`: `validateWebhookUrl(raw: string, opts: { allowInsecure: boolean }): { ok: true; url: string } | { ok: false }`.
  - `src/routes/webhooks.ts` mounted in `server.ts` at `/api/webhooks` behind `authMiddleware`:
    - `POST /subscription` body `{ url }` → 201 `{ subscription: { id, url, created_at }, secret }`; 400 `invalid_url`; 409 `subscription_exists`.
    - `GET /subscription` → 200 `{ subscription: { id, url, created_at } }` (never the secret); 404 `not_found`.
    - `DELETE /subscription` → 204; 404 `not_found`.
  - Env flag `WEBHOOK_ALLOW_INSECURE_URLS=1` (default off) allows `http:` and loopback hosts so Javier can test against a local receiver. Documented as development-only.
  - Secret: 32 random bytes hex from `node:crypto`.
  - `docs/api.md` (three endpoints, codes), `docs/architecture.md` (Webhooks frontier, tables, SSRF policy, env flag).
- Out (explicitly not touched, even if tempting):
  - Event insertion (JS-008), delivery (JS-009), merchant-facing verification docs (JS-010).
  - Multiple subscriptions per merchant, event-type filters, secret rotation, PUT/PATCH on the subscription.
  - DNS resolution of the host to catch rebinding; only literal hosts and IP ranges are checked. Residual risk documented.
  - Dashboard UI for subscriptions (Javier: API only).
  - Behaviour for an `X-Merchant-Id` with no merchant row (FK failure → 500), same as `POST /api/orders`. Noticed, not fixed.

## Restrictions

- No new dependencies. URL parsing with the WHATWG `URL` class; IP checks with `node:net` `isIP` and string prefixes.
- All queries through `webhooksDal`; no DB access in the route.
- Secret appears only in the 201 response body; never logged, never in GET.
- Route tests follow the JS-004 pattern (test app, stub auth, `app.listen(0)`, `fetch`).
- Tests clear both webhook tables in `beforeEach`.

## Edge cases

- URL rejections (each a test): `http://example.com` (scheme), `https://localhost/x`, `https://127.0.0.1/x`, `https://10.0.0.5/x`, `https://172.16.0.1/x`, `https://192.168.1.1/x`, `https://169.254.169.254/x`, `https://[::1]/x`, `https://0.0.0.0/x`, `https://user:pw@example.com/x` (credentials), `not a url`, empty string, `ftp://example.com`.
- Accepted: `https://example.com/hooks/orders`, `https://example.com:8443/x?y=1`.
- With `WEBHOOK_ALLOW_INSECURE_URLS=1`: `http://localhost:4000/hook` accepted; `https://user:pw@…` still rejected.
- Second POST for the same merchant → 409; after DELETE a new POST → 201 with a new secret.
- GET/DELETE for merchant without subscription → 404.
- Two merchants: each sees only its own subscription.
- Body missing `url` or `url` not a string → 400 `invalid_url`.

## Expected result

```sh
curl -X POST -H 'X-Merchant-Id: m_acme' -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/hooks"}' localhost:3000/api/webhooks/subscription
# 201 {"subscription":{"id":"…","url":"https://example.com/hooks","created_at":"…"},"secret":"<64 hex chars>"}
curl -H 'X-Merchant-Id: m_acme' localhost:3000/api/webhooks/subscription     # 200, no secret
curl -X DELETE -H 'X-Merchant-Id: m_acme' localhost:3000/api/webhooks/subscription  # 204
```

`sqlite3 data/dashboard.db .schema` shows both new tables. `npm run check` green.

## Acceptance criteria

- [ ] Both tables and the index exist after `initSchema()` (test queries `sqlite_master`).
- [ ] `validateWebhookUrl` rejects every URL in the rejection list and accepts the accepted ones; insecure flag behaviour covered.
- [ ] POST 201 returns the secret once; GET never returns it.
- [ ] POST twice → 409; DELETE then POST → 201.
- [ ] GET/DELETE without subscription → 404.
- [ ] Merchant scoping: merchant B cannot read or delete merchant A's subscription.
- [ ] `docs/api.md` and `docs/architecture.md` updated.

## Validation

- Tests to add (file names and what each asserts):
  - `test/webhook-url.test.ts`: the rejection and acceptance tables above.
  - `test/webhooks-dal.test.ts`: create/get/delete per merchant, UNIQUE on merchant_id.
  - `test/webhooks.test.ts`: the three endpoints, status codes, secret exposure, 409, scoping.
  - `test/db.test.ts` (or inside `webhooks-dal.test.ts`): schema objects present.
- Commands to run: `npm run check` (JS-006 gate), `npm test`.
- What to click or call in the dashboard / API to see it working: the three `curl` calls above with both seeded merchants.

## Confidence and falsification

- Confidence (1–10): 8 [proposed by Claude, Javier confirms]. CRUD plus a pure validator; the only judgment call is the SSRF block list.
- How to know if I am wrong (a specific scenario that would prove the change wrong): a legitimate merchant endpoint lives on a hostname that resolves to a private address (internal integration) and is rejected; or an attacker registers a public hostname that later resolves to an internal IP (DNS rebinding), which this slice does not prevent.

## Session log

- 2026-09-18 — Contract created in the JS-003 tasks-definition session. Javier accepted: outbox tables, payload/table design, HMAC over asymmetric keys, SSRF prevention, three subscription endpoints, four slices. No work started.
- 2026-09-18 — Execution session (Claude Code session `c9c48822-4fb8-46ba-a62e-2cd24be43f40`). Plan approved with two decisions by Javier: (1) `WEBHOOK_ALLOW_INSECURE_URLS=1` follows option A, loopback hosts only ("For now we will go with Option A"); (2) one commit for the slice ("probably I will not finish the 4 slices completes due to time"). Two facts stated before approval: the secret is stored in plaintext because HMAC needs the raw value (PM-30), and the mount in `server.ts` cannot be unit-tested because the file listens and seeds on import.
  - Built: two tables + index in `initSchema`; `src/lib/webhook-url.ts` (pure, checks the hostname after WHATWG URL parsing); `src/dal/webhooks-dal.ts`; `src/routes/webhooks.ts` (POST/GET/DELETE, secret once, UNIQUE as backstop mapped to 409); mount in `server.ts`.
  - Beyond the contract's list, inside its intent: CGNAT `100.64/10`, IPv4 embedded in IPv6 (mapped, compatible, NAT64), `*.localhost`, trailing-dot hosts, 2048-character limit, and tests proving that integer / hex / octal / short IPv4 forms are rejected. With the flag on, `http` is accepted only for loopback hosts; `http` to a public host stays rejected.
  - Tests: `test/webhook-url.test.ts` (56), `test/webhooks-dal.test.ts` (9, includes schema objects and `webhook_events` defaults), `test/webhooks.test.ts` (23, includes the simulated concurrent creation and the env flag). All passed on the first run.
  - Golden gate: `npm run check` → `golden gate: PASSED - tsc clean, 184 tests, 0 fail, 0 cancelled, 0 skipped, 0 todo`.
  - Live check on port 3055 against the seeded DB (real mount in `server.ts`): GET none 404; POST `http://` 400; POST `https://169.254.169.254` 400; POST `https://2130706433` 400; POST valid 201 with a 64-hex secret; second POST 409; GET own 200 without secret; `m_bistro` GET 404 and DELETE 404; DELETE own 204; GET 404. No row left, no secret in the server log. Claude's first attempt at this check returned 400 everywhere because of its own shell quoting (zsh does not word-split an unquoted variable, so curl got the header flag and value as one argument); re-run with literal arguments.
  - Side effect to know: starting the server created the two new tables in the local `data/dashboard.db` (expected, `IF NOT EXISTS`).
  - Noticed, not fixed: unknown `X-Merchant-Id` on POST hits the FK and returns 500, same as orders (PM-11 extended); `CLAUDE.md` "Frontiers identified so far" does not list Webhooks (protected file, Javier's edit). Backlog: PM-30 added, PM-11 extended.
  - Follow-up in the same session, before the commit: Javier authorised the protected-file edit ("I authorize to add the new frontier to CLAUDE.md"). `CLAUDE.md` "Frontiers identified so far" now lists Webhooks with a pointer to `docs/architecture.md`. No other line of that file changed.

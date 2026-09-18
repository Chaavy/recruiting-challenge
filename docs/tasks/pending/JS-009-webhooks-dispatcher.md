# JS-009 — Webhooks slice C: dispatcher, HMAC signing and retry policy

| Field    | Value                                  |
|----------|----------------------------------------|
| Status   | pending                                |
| Type     | feature                                |
| Priority | 6                                      |
| Commits  | filled at close: short SHAs of the commits that ship this task (source for signoff.md) |

## Context

Third slice of Feature B (see JS-007). After JS-008, `webhook_events` holds pending rows with a stored JSON payload. Nothing sends them. Decisions accepted by Javier in JS-003: in-process poller, sequential delivery, request timeout, no redirects, HMAC-SHA256 signature with the per-subscription secret (industry standard, replaces Javier's initial public/private key idea), retry 3 times with backoff 5, 15, 30 minutes, then `failed`. DLQ is out of scope.

## What is wrong / what is missing

- No delivery. Pending events stay pending forever.
- No authentication between us and the merchant: a receiver cannot tell our POST from anyone else's.
- No retry policy or terminal state.

## Objective (what I propose)

Add `src/jobs/webhook-dispatcher.ts` exposing `createDispatcher(deps)` with `runOnce()` and `start()/stop()`, where `deps` are `{ fetch, now, dal, batchSize, timeoutMs }` so tests inject a fake `fetch` and a fixed clock. Each `runOnce` selects due pending events (`status = 'pending' AND next_attempt_at <= now`, ordered by `next_attempt_at`, limited to `batchSize`), and for each: loads the merchant's subscription, POSTs the stored payload with signature headers, and updates the row: 2xx → `delivered`, `delivered_at`; anything else → `attempts + 1`, `last_error`, and either `next_attempt_at = nextAttemptAt(attempts, now)` or `status = 'failed'` after the fourth failed attempt. `server.ts` starts the poller after `listen`, interval from `WEBHOOK_DISPATCH_INTERVAL_MS` (default 5000), disabled by `WEBHOOK_DISPATCHER_DISABLED=1`. After this task a subscribed merchant receives signed POSTs with automatic retries.

## Scope

- In:
  - `src/lib/retry-schedule.ts`: pure `nextAttemptAt(failedAttempts: number, now: Date): Date | null` → +5 min after the 1st failure, +15 after the 2nd, +30 after the 3rd, `null` after the 4th (terminal). Max attempts constant `MAX_ATTEMPTS = 4` (1 initial + 3 retries).
  - `src/lib/webhook-signature.ts`: pure `signPayload(secret, timestamp, body): string` = hex HMAC-SHA256 over `${timestamp}.${body}`; `buildSignatureHeader(timestamp, hex)` → `t=<unix seconds>,v1=<hex>`.
  - `src/jobs/webhook-dispatcher.ts` as described. Request: `POST`, headers `Content-Type: application/json`, `User-Agent: t1-dashboard-webhooks/1`, `X-Webhook-Id: <event_id>`, `X-Webhook-Event: <event_type>`, `X-Webhook-Timestamp: <unix seconds>`, `X-Webhook-Signature: t=…,v1=…`; body = stored payload string byte for byte; `redirect: 'error'`; `AbortController` timeout `timeoutMs` (default 5000).
  - `src/dal/webhooks-dal.ts`: `listDueEvents(now, limit)`, `markDelivered(id, at)`, `markRetry(id, attempts, nextAttemptAt, lastError)`, `markFailed(id, attempts, lastError)`.
  - `src/server.ts`: create and start the dispatcher after `app.listen`, honouring the two env vars. Nothing starts on module import of the dispatcher.
  - `docs/api.md` (headers, retry policy, statuses), `docs/architecture.md` (job, single-process assumption), README (env vars).
- Out (explicitly not touched, even if tempting):
  - Multi-process or multi-instance safety (row claiming, leases). Single process assumed and documented.
  - DLQ, manual replay endpoint, event listing endpoint, subscription auto-disable on repeated failure.
  - Re-validating the URL against DNS at send time (see JS-007 residual risk).
  - Secret rotation, multiple signature versions beyond `v1`.
  - Merchant-facing verification guide with code (JS-010).

## Restrictions

- No new dependencies. `fetch`, `AbortController`, `node:crypto` only (Node >= 22, see JS-006).
- Tests must not sleep or use real timers: inject `now` and `fetch`; call `runOnce()` directly; never `start()` in tests.
- Delivery is sequential (`for … of` with `await`), one event at a time; batch size default 50.
- `last_error` stores a short generic description (`http_500`, `timeout`, `network_error`, `redirect`, `no_subscription`), never a response body or stack trace.
- Console logging: one line per attempt with event id, attempt number and outcome; no payload, no secret, no URL query string.
- The dispatcher must never throw out of `runOnce`; a failure on one event is recorded and the loop continues.

## Edge cases

- 200 → `delivered`, `delivered_at = now`, `attempts = 1`.
- 204 → delivered (any 2xx).
- 500 on first try → `pending`, `attempts = 1`, `next_attempt_at = now + 5 min`, `last_error = http_500`.
- Second failure → `+15 min`; third → `+30 min`; fourth → `failed`, `next_attempt_at` unchanged, `last_error` set.
- 3xx with `redirect: 'error'` → fetch rejects → counted as a failure `redirect`.
- Timeout (fake fetch rejects with `AbortError`) → failure `timeout`.
- Network error (fetch rejects with `TypeError`) → failure `network_error`.
- Subscription deleted after the event was created → `failed` immediately with `no_subscription`, no HTTP call.
- Event not yet due (`next_attempt_at` in the future) → untouched.
- `batchSize` respected: 3 due events, batch 2 → 2 processed per `runOnce`.
- Signature vector: secret `s`, timestamp `1700000000`, body `{"a":1}` → the HMAC hex computed once by hand with `node -e` during the task and frozen in the test.
- One event's fetch throwing synchronously does not stop the following events.

## Expected result

- With a subscription pointing at a local receiver (`WEBHOOK_ALLOW_INSECURE_URLS=1`, e.g. `http://localhost:4000/hook`) and `npm run dev`, creating an order produces a POST at the receiver within ~5 s, with the headers above; the receiver can recompute the HMAC and match `v1`.
- Receiver returning 500 → the row shows `attempts = 1` and `next_attempt_at` 5 minutes ahead.
- Server log shows one line per attempt.
- `npm run check` green.

## Acceptance criteria

- [ ] `nextAttemptAt` returns +5/+15/+30 minutes for attempts 1..3 and `null` for 4.
- [ ] `signPayload` matches the frozen vector; `buildSignatureHeader` format `t=…,v1=…`.
- [ ] Each edge case above has a test in `test/webhook-dispatcher.test.ts` using fake `fetch` and fixed `now`.
- [ ] Body sent equals the stored payload string exactly (asserted on the fake fetch call).
- [ ] `redirect: 'error'` and an abort signal are passed to fetch (asserted on the fake fetch call).
- [ ] Dispatcher does not start when `WEBHOOK_DISPATCHER_DISABLED=1` and never on import.
- [ ] Docs updated (api, architecture, README env vars).

## Validation

- Tests to add (file names and what each asserts):
  - `test/retry-schedule.test.ts`: schedule table and terminal `null`.
  - `test/webhook-signature.test.ts`: frozen vector, header format, different secret → different signature.
  - `test/webhook-dispatcher.test.ts`: the edge-case list above against the in-memory DB.
  - `test/webhooks-dal.test.ts` (extend): `listDueEvents` ordering and limit, `markDelivered`/`markRetry`/`markFailed`.
- Commands to run: `npm run check`.
- What to click or call in the dashboard / API to see it working: run a local receiver (any small HTTP listener printing headers and body; the JS-010 docs will include one), subscribe with the insecure flag, POST an order, watch the receiver and the `webhook_events` row.

## Confidence and falsification

- Confidence (1–10): 7 [proposed by Claude, Javier confirms]. The pieces are individually simple; the risk is in wiring `fetch` errors and timeouts consistently and in time budget (largest slice).
- How to know if I am wrong (a specific scenario that would prove the change wrong): two server processes share the SQLite file (e.g. `npm run dev` restart overlap) and both dispatch the same due event, producing duplicates faster than the merchant's idempotency window; or a merchant endpoint takes longer than 5 s legitimately and every delivery times out and ends `failed` after ~50 minutes.

## Session log

- 2026-09-18 — Contract created in the JS-003 tasks-definition session. Javier accepted HMAC-SHA256 over public/private keys, the 5/15/30 min schedule then `failed`, and the injected `now`/`fetch` design. No work started.

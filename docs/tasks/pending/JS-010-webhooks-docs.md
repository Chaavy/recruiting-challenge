# JS-010 — Webhooks slice D: merchant-facing documentation and end-to-end check

| Field    | Value                                  |
|----------|----------------------------------------|
| Status   | pending                                |
| Type     | feature                                |
| Priority | 7                                      |
| Commits  | filled at close: short SHAs of the commits that ship this task (source for signoff.md) |

## Context

Last slice of Feature B (see JS-007). Each previous slice updated `docs/api.md` and `docs/architecture.md` for what it changed, as `CLAUDE.md` requires. What is still missing is the document a merchant integrator would read end to end, and one real run of the whole flow against a local receiver. The challenge scores documentation as part of the codebase (README step 5) and "did you run it yourself" (EVALUATION "How you own the outcome").

## What is wrong / what is missing

- No single place explains to a merchant how to subscribe, what they will receive, how to verify the signature, how retries behave and what to do about duplicates.
- The end-to-end flow (subscribe → create order → signed POST received → retry on failure) has only been exercised per slice, never as a whole.
- README does not mention the webhook env vars or how to test locally.

## Objective (what I propose)

Write `docs/webhooks.md` as the integrator guide, link it from `docs/api.md` and README, add a small receiver script for local testing under `scripts/` (outside `src/`, no tests required), run the full flow once with both a 200 and a 500 receiver, and record the raw output in this task's session log. If JS-009 is not finished when time runs out, this task instead documents precisely which slices shipped and what "events are persisted, dispatch pending" means for a merchant.

## Scope

- In:
  - `docs/webhooks.md`: subscribing (three endpoints), one subscription per merchant, URL rules (https, blocked hosts), payload schema and event types (emitted vs reserved), headers, signature verification recipe in Node (`crypto.createHmac`, `timingSafeEqual`, timestamp tolerance suggestion of 5 minutes), delivery semantics (at-least-once, dedupe by `event_id`), retry schedule and terminal `failed`, local testing with the insecure flag and the receiver script, known limitations (single process, no DLQ, no DNS check).
  - `scripts/webhook-receiver.mjs`: plain `node:http` server on a port from argv, prints headers and body, verifies the signature when `WEBHOOK_SECRET` is set, returns the status from `RESPONSE_STATUS` (default 200). No dependencies.
  - `package.json`: `"webhook:receiver": "node scripts/webhook-receiver.mjs 4000"` (script only, no dependency).
  - README: "Webhooks" section with env vars (`WEBHOOK_ALLOW_INSECURE_URLS`, `WEBHOOK_DISPATCH_INTERVAL_MS`, `WEBHOOK_DISPATCHER_DISABLED`) and the local test recipe.
  - `docs/api.md`: link to `docs/webhooks.md`; remove any TODO left from earlier slices in the webhook sections.
  - `docs/architecture.md`: Webhooks frontier summary consistent with what shipped; Auditlog note pointing at `webhook_events` as the seed.
  - End-to-end run recorded in the session log: commands and raw receiver output for a 200 delivery and for a 500 → retry scheduled.
- Out (explicitly not touched, even if tempting):
  - Any `src/` change. If the end-to-end run reveals a bug, it is reported in the session log and fixed in a new task, not here.
  - Dashboard UI.
  - Public hosting or tunnelling instructions.

## Restrictions

- No new dependencies. Receiver uses `node:http` and `node:crypto` only.
- The verification recipe in the docs must be the same algorithm as `src/lib/webhook-signature.ts`; copy the constants from the code, do not paraphrase.
- Documentation states what shipped, not what was planned. Reserved event types are marked "not emitted yet".

## Edge cases

- Receiver with wrong secret → prints "signature mismatch" and still returns the configured status (so the mismatch path is visible).
- Receiver returning 500 → server log shows retry scheduled; `webhook_events.next_attempt_at` is +5 min.
- Merchant without subscription → docs state that no event is stored (JS-008 decision).

## Expected result

- `docs/webhooks.md` exists and is linked from README and `docs/api.md`.
- `npm run webhook:receiver` starts a receiver; the documented recipe produces a verified delivery within ~5 s of `POST /api/orders`.
- Session log contains the raw output of the 200 and the 500 runs.
- `npm run check` green (no `src/` change).

## Acceptance criteria

- [ ] Every endpoint, header, env var and status value named in the docs exists in the code with the same spelling (checked by grep during the task, listed in the session log).
- [ ] Verification recipe validated against a real delivery (receiver prints "signature ok").
- [ ] 500 run shows `attempts = 1` and a future `next_attempt_at` in the DB.
- [ ] README and `docs/api.md` link to `docs/webhooks.md`.
- [ ] If any slice did not ship, the docs say so explicitly.

## Validation

- Tests to add (file names and what each asserts): none (no `src/` change). The receiver script is exercised manually; its output is the evidence.
- Commands to run: `npm run check`; `WEBHOOK_ALLOW_INSECURE_URLS=1 npm run dev`; `WEBHOOK_SECRET=<secret> npm run webhook:receiver`; the subscribe and order `curl` calls from JS-007 / JS-008; `RESPONSE_STATUS=500` variant.
- What to click or call in the dashboard / API to see it working: the sequence above; then `GET /api/orders?limit=1` to confirm the order and `sqlite3` to read the event row.

## Confidence and falsification

- Confidence (1–10): 9 [proposed by Claude, Javier confirms] on the docs; the end-to-end run is where earlier slices can still fail.
- How to know if I am wrong (a specific scenario that would prove the change wrong): an integrator following `docs/webhooks.md` literally cannot verify a signature (byte mismatch between stored payload and sent body, or timestamp encoding differs from the docs).

## Session log

- 2026-09-18 — Contract created in the JS-003 tasks-definition session as the fourth slice, so that a partial delivery of Feature B is documented rather than implied. No work started.

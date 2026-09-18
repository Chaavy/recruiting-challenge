# Task index

Rows are in execution order. The next task is the first row with status `pending`. Statuses: `pending`, `in-progress`, `done`. See `README.md` for the lifecycle.

| ID | Title | Type | Status | Spec |
|----|-------|------|--------|------|
| JS-004 | Revenue and Metrics frontier fix | bugfix | done | [done/JS-004-revenue-metrics-frontier-fix.md](done/JS-004-revenue-metrics-frontier-fix.md) |
| JS-005 | Tenant isolation on order lookup and input validation on order creation | bugfix | in-progress | [pending/JS-005-tenant-isolation-order-validation.md](pending/JS-005-tenant-isolation-order-validation.md) |
| JS-006 | Golden gate: pre-commit hook and regression over JS-004 / JS-005 | bugfix | pending | [pending/JS-006-golden-gate-precommit.md](pending/JS-006-golden-gate-precommit.md) |
| JS-007 | Webhooks slice A: schema, DAL and subscription endpoints | feature | pending | [pending/JS-007-webhooks-subscriptions.md](pending/JS-007-webhooks-subscriptions.md) |
| JS-008 | Webhooks slice B: transactional outbox on order creation | feature | pending | [pending/JS-008-webhooks-outbox.md](pending/JS-008-webhooks-outbox.md) |
| JS-009 | Webhooks slice C: dispatcher, HMAC signing and retry policy | feature | pending | [pending/JS-009-webhooks-dispatcher.md](pending/JS-009-webhooks-dispatcher.md) |
| JS-010 | Webhooks slice D: merchant-facing documentation and end-to-end check | feature | pending | [pending/JS-010-webhooks-docs.md](pending/JS-010-webhooks-docs.md) |

Contracts were defined on 2026-09-18 in the JS-003 tasks-definition session from Javier's decisions in `docs/personal-notes.md` ("Notes after discussion"). Feature B (webhooks) is split into four slices so that any stop is a coherent deliverable. Post MVP items (ESLint and the SQL-injection lint gate, GitHub Actions, dependency audit, custom errors, mixed timestamps, float money field) are tracked in `docs/personal-notes.md`, not here.

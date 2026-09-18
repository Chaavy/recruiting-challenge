// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { db, initSchema } from '../src/db.js';
import { authMiddleware } from '../src/auth.js';
import { webhooksRouter } from '../src/routes/webhooks.js';
import { webhooksDal } from '../src/dal/webhooks-dal.js';

// The router is mounted on a fresh app; src/server.ts is not imported because it listens and seeds on import.
initSchema();
const app = express();
app.use(express.json());
app.use('/api/webhooks', authMiddleware, webhooksRouter);

let server: Server;
let base = '';

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

beforeEach(() => {
  delete process.env.WEBHOOK_ALLOW_INSECURE_URLS;
  db.exec(`
    DELETE FROM webhook_events;
    DELETE FROM webhook_subscriptions;
    INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_a', 'A'), ('m_b', 'B');
  `);
});

afterEach(() => {
  delete process.env.WEBHOOK_ALLOW_INSECURE_URLS;
});

const PATH = '/api/webhooks/subscription';

function call(method: 'GET' | 'POST' | 'DELETE', merchantId: string | undefined, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (merchantId) headers['X-Merchant-Id'] = merchantId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${base}${PATH}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

type Created = { subscription: { id: string; url: string; created_at: string }; secret: string };

describe('POST /api/webhooks/subscription', () => {
  test('201 returns the subscription and a 64-hex secret, and stores it for the header merchant', async () => {
    const res = await call('POST', 'm_a', { url: 'https://example.com/hooks' });
    assert.equal(res.status, 201);
    const body = (await res.json()) as Created;
    assert.equal(body.subscription.url, 'https://example.com/hooks');
    assert.ok(body.subscription.id.length > 0);
    assert.ok(body.subscription.created_at.length > 0);
    assert.match(body.secret, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(body.subscription).sort(), ['created_at', 'id', 'url']);

    const stored = webhooksDal.getSubscriptionByMerchant('m_a');
    assert.equal(stored?.secret, body.secret);
    assert.equal(stored?.id, body.subscription.id);
  });

  test('stores the normalised URL', async () => {
    const res = await call('POST', 'm_a', { url: 'https://EXAMPLE.com' });
    assert.equal(res.status, 201);
    assert.equal(((await res.json()) as Created).subscription.url, 'https://example.com/');
  });

  const invalid: Array<[string, unknown]> = [
    ['http scheme', { url: 'http://example.com/hooks' }],
    ['localhost', { url: 'https://localhost/hooks' }],
    ['private range', { url: 'https://10.0.0.5/hooks' }],
    ['cloud metadata', { url: 'https://169.254.169.254/latest' }],
    ['credentials', { url: 'https://user:pw@example.com/hooks' }],
    ['not a url', { url: 'not a url' }],
    ['url not a string', { url: 42 }],
    ['url missing', {}],
    ['array body', ['https://example.com/hooks']],
  ];
  for (const [label, body] of invalid) {
    test(`${label} is 400 invalid_url and stores nothing`, async () => {
      const res = await call('POST', 'm_a', body);
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'invalid_url' });
      assert.equal(webhooksDal.getSubscriptionByMerchant('m_a'), undefined);
    });
  }

  test('second POST for the same merchant is 409 and keeps the first subscription', async () => {
    const first = (await (await call('POST', 'm_a', { url: 'https://example.com/one' })).json()) as Created;
    const res = await call('POST', 'm_a', { url: 'https://example.com/two' });
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: 'subscription_exists' });
    const stored = webhooksDal.getSubscriptionByMerchant('m_a');
    assert.equal(stored?.url, 'https://example.com/one');
    assert.equal(stored?.secret, first.secret);
  });

  test('UNIQUE constraint is the backstop when the pre-check misses (concurrent creation)', async () => {
    await call('POST', 'm_a', { url: 'https://example.com/one' });
    const original = webhooksDal.getSubscriptionByMerchant;
    let calls = 0;
    // Simulate the race: the route's pre-check sees nothing, the insert then hits UNIQUE.
    webhooksDal.getSubscriptionByMerchant = function (merchantId: string) {
      calls += 1;
      return calls === 1 ? undefined : original.call(webhooksDal, merchantId);
    };
    try {
      const res = await call('POST', 'm_a', { url: 'https://example.com/two' });
      assert.equal(res.status, 409);
      assert.deepEqual(await res.json(), { error: 'subscription_exists' });
    } finally {
      webhooksDal.getSubscriptionByMerchant = original;
    }
  });

  test('without merchant header is 401', async () => {
    const res = await call('POST', undefined, { url: 'https://example.com/hooks' });
    assert.equal(res.status, 401);
  });

  test('WEBHOOK_ALLOW_INSECURE_URLS=1 accepts an http loopback receiver, and only that', async () => {
    const before = await call('POST', 'm_a', { url: 'http://localhost:4000/hook' });
    assert.equal(before.status, 400);

    process.env.WEBHOOK_ALLOW_INSECURE_URLS = '1';
    const privateRange = await call('POST', 'm_a', { url: 'http://192.168.1.10/hook' });
    assert.equal(privateRange.status, 400);
    const loopback = await call('POST', 'm_a', { url: 'http://localhost:4000/hook' });
    assert.equal(loopback.status, 201);
  });

  test('the flag only counts when it is exactly "1"', async () => {
    process.env.WEBHOOK_ALLOW_INSECURE_URLS = 'true';
    const res = await call('POST', 'm_a', { url: 'http://localhost:4000/hook' });
    assert.equal(res.status, 400);
  });
});

describe('GET /api/webhooks/subscription', () => {
  test('200 returns the subscription and never the secret', async () => {
    const created = (await (await call('POST', 'm_a', { url: 'https://example.com/hooks' })).json()) as Created;
    const res = await call('GET', 'm_a');
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes(created.secret), 'secret must not appear in the GET response');
    assert.deepEqual(JSON.parse(text), { subscription: created.subscription });
  });

  test('404 when the merchant has no subscription', async () => {
    const res = await call('GET', 'm_a');
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'not_found' });
  });

  test("a merchant cannot read another merchant's subscription", async () => {
    await call('POST', 'm_a', { url: 'https://example.com/a' });
    assert.equal((await call('GET', 'm_b')).status, 404);
  });
});

describe('DELETE /api/webhooks/subscription', () => {
  test('204 deletes, then GET is 404', async () => {
    await call('POST', 'm_a', { url: 'https://example.com/hooks' });
    const res = await call('DELETE', 'm_a');
    assert.equal(res.status, 204);
    assert.equal(await res.text(), '');
    assert.equal((await call('GET', 'm_a')).status, 404);
  });

  test('404 when there is nothing to delete', async () => {
    const res = await call('DELETE', 'm_a');
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'not_found' });
  });

  test("a merchant cannot delete another merchant's subscription", async () => {
    await call('POST', 'm_a', { url: 'https://example.com/a' });
    assert.equal((await call('DELETE', 'm_b')).status, 404);
    assert.equal((await call('GET', 'm_a')).status, 200);
  });

  test('after DELETE a new POST is 201 with a different secret', async () => {
    const first = (await (await call('POST', 'm_a', { url: 'https://example.com/hooks' })).json()) as Created;
    await call('DELETE', 'm_a');
    const res = await call('POST', 'm_a', { url: 'https://example.com/hooks' });
    assert.equal(res.status, 201);
    const second = (await res.json()) as Created;
    assert.notEqual(second.secret, first.secret);
    assert.notEqual(second.subscription.id, first.subscription.id);
  });
});

import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { webhooksDal, type WebhookSubscriptionRow } from '../dal/webhooks-dal.js';
import { validateWebhookUrl } from '../lib/webhook-url.js';

export const webhooksRouter = Router();

/** The secret never leaves through this shape. */
function toPublic(row: WebhookSubscriptionRow): { id: string; url: string; created_at: string } {
  return { id: row.id, url: row.url, created_at: row.created_at };
}

/** Read per request so the flag can be toggled without restarting (and in tests). */
function allowInsecureUrls(): boolean {
  return process.env.WEBHOOK_ALLOW_INSECURE_URLS === '1';
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE';
}

/**
 * POST /api/webhooks/subscription  body: { url }
 *
 * Registers the merchant's webhook URL. One subscription per merchant.
 * The signing secret is generated here and returned ONLY in this response.
 */
webhooksRouter.post('/subscription', (req, res) => {
  const merchantId = req.merchantId!;
  const body: unknown = req.body;
  const rawUrl = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).url : undefined;

  const validation = validateWebhookUrl(rawUrl, { allowInsecure: allowInsecureUrls() });
  if (!validation.ok) {
    res.status(400).json({ error: 'invalid_url' });
    return;
  }

  if (webhooksDal.getSubscriptionByMerchant(merchantId)) {
    res.status(409).json({ error: 'subscription_exists' });
    return;
  }

  let created: WebhookSubscriptionRow;
  try {
    created = webhooksDal.createSubscription({
      id: randomUUID(),
      merchant_id: merchantId,
      url: validation.url,
      secret: randomBytes(32).toString('hex'),
    });
  } catch (err) {
    // Backstop for two concurrent creations: the UNIQUE constraint decides.
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'subscription_exists' });
      return;
    }
    throw err;
  }

  res.status(201).json({ subscription: toPublic(created), secret: created.secret });
});

/** GET /api/webhooks/subscription — the merchant's subscription, without the secret. */
webhooksRouter.get('/subscription', (req, res) => {
  const row = webhooksDal.getSubscriptionByMerchant(req.merchantId!);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ subscription: toPublic(row) });
});

/** DELETE /api/webhooks/subscription — removes the merchant's subscription. */
webhooksRouter.delete('/subscription', (req, res) => {
  const deleted = webhooksDal.deleteSubscriptionByMerchant(req.merchantId!);
  if (!deleted) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.status(204).end();
});

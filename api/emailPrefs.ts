import { OAuth2Client } from 'google-auth-library';
import crypto from 'node:crypto';
import {
  CLIENT_ID,
  CLIENT_SECRET,
  MAX_WEBHOOKS,
  safeFetch,
  dbGet,
  dbSet,
  dbUpdate,
  dbDelete,
  encryptSecret,
  decryptSecret,
  normalizeWebhookUrl,
  cleanLabel,
  publicDiscordConfig,
  postDiscordWebhook,
} from './lib/digestCore';
import { createGatewayHandler, logger } from './lib/security';
import { withCache, invalidate } from './lib/cache';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function isValidUserId(id: unknown): id is string {
  return typeof id === 'string' && /^\d{1,30}$/.test(id);
}

function cleanWebhookId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{12,80}$/.test(value) ? value : null;
}

interface AuthResult {
  userId?: string;
  error?: string;
  status?: number;
}

async function verifyUser(req: VercelRequest): Promise<AuthResult> {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }
  const token = authHeader.slice(7);
  if (token.length < 10) return { error: 'Invalid token', status: 401 };

  let userId: string | undefined;
  try {
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    userId = ticket.getPayload()?.sub;
  } catch {
    const response = await safeFetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { error: 'Token verification failed', status: 401 };
    userId = ((await response.json()) as { id?: string }).id;
  }
  if (!isValidUserId(userId)) return { error: 'Invalid user identity', status: 400 };
  return { userId };
}

async function exchangeRefreshToken(authCode: string): Promise<string> {
  if (!CLIENT_SECRET) throw new Error('Server configuration error: missing GOOGLE_CLIENT_SECRET');
  if (!authCode || typeof authCode !== 'string') throw new Error('Offline Google authorization is required for Discord delivery');
  const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, 'postmessage');
  const { tokens } = await client.getToken(authCode);
  if (!tokens.refresh_token) {
    throw new Error('No offline authorization was returned. Revoke Aulert access in Google Account settings, then try again.');
  }
  return tokens.refresh_token;
}

async function handleRemoveWebhook(
  path: string,
  cacheKey: string,
  config: Record<string, unknown> | null,
  webhookId: string | null,
  res: VercelResponse
): Promise<void> {
  const cfg = (config ?? {}) as { webhooks?: Record<string, unknown> };
  if (!webhookId || !cfg?.webhooks?.[webhookId]) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  const remaining = { ...cfg.webhooks };
  delete remaining[webhookId];
  if (!Object.keys(remaining).length) await dbDelete(path);
  else await dbUpdate(path, { webhooks: remaining, enabled: true, updatedAt: Date.now() });
  await invalidate(cacheKey);
  res.status(200).json({ success: true, ...publicDiscordConfig({ ...config, webhooks: remaining, enabled: true }) });
}

async function handleTestWebhook(
  path: string,
  cacheKey: string,
  config: Record<string, unknown> | null,
  webhookId: string | null,
  res: VercelResponse
): Promise<void> {
  const cfg = (config ?? {}) as { webhooks?: Record<string, { encryptedUrl?: string }> };
  const webhook = webhookId ? cfg.webhooks?.[webhookId] : undefined;
  if (!webhook) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  const url = decryptSecret(webhook.encryptedUrl as string);
  await postDiscordWebhook(url, [], { test: true });
  await dbUpdate(`${path}/webhooks/${webhookId}`, { lastTestAt: Date.now(), lastError: null });
  await invalidate(cacheKey);
  res.status(200).json({ success: true, message: 'Test message sent' });
}

async function handleAddWebhook(
  path: string,
  cacheKey: string,
  config: Record<string, unknown> | null,
  body: Record<string, unknown>,
  res: VercelResponse
): Promise<void> {
  const cfg = (config ?? {}) as { webhooks?: Record<string, unknown> };
  const webhooks = cfg.webhooks || {};
  if (Object.keys(webhooks).length >= MAX_WEBHOOKS) {
    res.status(400).json({ error: `You can add up to ${MAX_WEBHOOKS} Discord webhooks` });
    return;
  }
  const url = normalizeWebhookUrl(body.webhookUrl as string);
  await postDiscordWebhook(url, [], { test: true });

  let encryptedRefreshToken = (config as { encryptedRefreshToken?: string } | null)?.encryptedRefreshToken;
  if (!encryptedRefreshToken) encryptedRefreshToken = encryptSecret(await exchangeRefreshToken(body.authCode as string));
  const id = `wh_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const now = Date.now();
  const newWebhook = {
    id,
    label: cleanLabel(body.label, `Discord webhook ${Object.keys(webhooks).length + 1}`),
    encryptedUrl: encryptSecret(url),
    createdAt: now,
    lastTestAt: now,
    lastDeliveryAt: null,
    lastError: null,
    deliveries: {},
  };
  await dbSet(path, {
    enabled: true,
    encryptedRefreshToken,
    webhooks: { ...webhooks, [id]: newWebhook },
    lastScannedAt: (config as { lastScannedAt?: number } | null)?.lastScannedAt || now,
    updatedAt: now,
  });
  await invalidate(cacheKey);
  res
    .status(200)
    .json({ success: true, ...publicDiscordConfig({ enabled: true, encryptedRefreshToken, webhooks: { ...webhooks, [id]: newWebhook } }) });
}

export default createGatewayHandler(
  {
    methods: ['POST', 'OPTIONS'],
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 30,
      name: 'emailPrefs',
    },
  },
  async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && (origin.startsWith('http://localhost') || origin.startsWith('https://') || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const auth = await verifyUser(req);
    if (auth.error) {
      res.status(auth.status ?? 401).json({ error: auth.error });
      return;
    }
    const userId = auth.userId as string;
    const path = `users/${encodeURIComponent(userId)}/discord`;
    const cacheKey = `discord:config:${userId}`;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = (body.action as string) || 'list';
    const config = (await dbGet(path)) as Record<string, unknown> | null;

    if (action === 'list') {
      const cached = await withCache(cacheKey, 60, () => publicDiscordConfig(config));
      res.status(200).json(cached);
      return;
    }

    if (action === 'disconnect') {
      await dbDelete(path);
      await invalidate(cacheKey);
      res.status(200).json({ success: true, enabled: false, webhooks: [] });
      return;
    }

    const webhookId = cleanWebhookId(body.webhookId);
    if (action === 'remove') {
      await handleRemoveWebhook(path, cacheKey, config, webhookId, res);
      return;
    }

    if (action === 'test') {
      await handleTestWebhook(path, cacheKey, config, webhookId, res);
      return;
    }

    if (action === 'add') {
      await handleAddWebhook(path, cacheKey, config, body, res);
      return;
    }

    res.status(400).json({ error: 'Unknown Discord action' });
  } catch (error) {
    logger.error('Discord integration error', { message: error instanceof Error ? error.message : String(error) });
    res.status(400).json({ error: 'Unable to update Discord notifications' });
  }
});


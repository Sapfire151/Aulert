const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const {
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
} = require('./lib/digestCore');

function isValidUserId(id) {
  return typeof id === 'string' && /^[0-9]{1,30}$/.test(id);
}

function cleanWebhookId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{12,80}$/.test(value) ? value : null;
}

async function verifyUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { error: 'Missing or invalid authorization header', status: 401 };
  const token = authHeader.slice(7);
  if (token.length < 10) return { error: 'Invalid token', status: 401 };

  let userId;
  try {
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    userId = ticket.getPayload().sub;
  } catch {
    const response = await safeFetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return { error: 'Token verification failed', status: 401 };
    userId = (await response.json()).id;
  }
  if (!isValidUserId(userId)) return { error: 'Invalid user identity', status: 400 };
  return { userId };
}

async function exchangeRefreshToken(authCode) {
  if (!CLIENT_SECRET) throw new Error('Server configuration error: missing GOOGLE_CLIENT_SECRET');
  if (!authCode || typeof authCode !== 'string') throw new Error('Offline Google authorization is required for Discord delivery');
  const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, 'postmessage');
  const { tokens } = await client.getToken(authCode);
  if (!tokens.refresh_token) {
    throw new Error('No offline authorization was returned. Revoke Aulert access in Google Account settings, then try again.');
  }
  return tokens.refresh_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://aulert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const auth = await verifyUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const path = `users/${encodeURIComponent(auth.userId)}/discord`;
    const body = req.body || {};
    const action = body.action || 'list';
    const config = await dbGet(path);

    if (action === 'list') return res.status(200).json(publicDiscordConfig(config));

    if (action === 'disconnect') {
      await dbDelete(path);
      return res.status(200).json({ success: true, enabled: false, webhooks: [] });
    }

    const webhookId = cleanWebhookId(body.webhookId);
    if (action === 'remove') {
      if (!webhookId || !config?.webhooks?.[webhookId]) return res.status(404).json({ error: 'Webhook not found' });
      const remaining = { ...config.webhooks };
      delete remaining[webhookId];
      if (!Object.keys(remaining).length) await dbDelete(path);
      else await dbUpdate(path, { webhooks: remaining, enabled: true, updatedAt: Date.now() });
      return res.status(200).json({ success: true, ...publicDiscordConfig({ ...config, webhooks: remaining, enabled: true }) });
    }

    if (action === 'test') {
      if (!webhookId || !config?.webhooks?.[webhookId]) return res.status(404).json({ error: 'Webhook not found' });
      const url = decryptSecret(config.webhooks[webhookId].encryptedUrl);
      await postDiscordWebhook(url, [], { test: true });
      await dbUpdate(`${path}/webhooks/${webhookId}`, { lastTestAt: Date.now(), lastError: null });
      return res.status(200).json({ success: true, message: 'Test message sent' });
    }

    if (action !== 'add') return res.status(400).json({ error: 'Unknown Discord action' });
    const webhooks = config?.webhooks || {};
    if (Object.keys(webhooks).length >= MAX_WEBHOOKS) return res.status(400).json({ error: `You can add up to ${MAX_WEBHOOKS} Discord webhooks` });
    const url = normalizeWebhookUrl(body.webhookUrl);
    await postDiscordWebhook(url, [], { test: true });

    let encryptedRefreshToken = config?.encryptedRefreshToken;
    if (!encryptedRefreshToken) encryptedRefreshToken = encryptSecret(await exchangeRefreshToken(body.authCode));
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
      lastScannedAt: config?.lastScannedAt || now,
      updatedAt: now,
    });
    return res.status(200).json({ success: true, ...publicDiscordConfig({ enabled: true, encryptedRefreshToken, webhooks: { ...webhooks, [id]: newWebhook } }) });
  } catch (error) {
    console.error('Discord integration error:', error.message);
    return res.status(400).json({ error: error.message || 'Unable to update Discord notifications' });
  }
}

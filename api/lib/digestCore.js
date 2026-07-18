const crypto = require('crypto');
const { google } = require('googleapis');
const { getDb } = require('./firebaseAdmin');

const CLIENT_ID = '4640324' + '46404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_API_HOSTS = ['www.googleapis.com'];
const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com']);
const MAX_WEBHOOKS = 5;
const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const INITIAL_LOOKBACK_MS = 15 * 60 * 1000;
const OVERLAP_MS = 2 * 60 * 1000;

function safeFetch(urlStr, options) {
  const url = new URL(urlStr);
  if (!GOOGLE_API_HOSTS.includes(url.hostname)) {
    throw new Error('Blocked: URL not in allow-list');
  }
  return fetch(url.toString(), options);
}

function getEncryptionKey() {
  const value = process.env.DISCORD_WEBHOOK_ENCRYPTION_KEY;
  if (!value) throw new Error('DISCORD_WEBHOOK_ENCRYPTION_KEY is not configured');

  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('DISCORD_WEBHOOK_ENCRYPTION_KEY must be a 32-byte base64 value or 64-character hex value');
  }
  return key;
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

function decryptSecret(value) {
  const [version, ivValue, tagValue, ciphertextValue] = String(value || '').split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) throw new Error('Stored webhook secret is invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function normalizeWebhookUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid Discord webhook URL');
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid Discord webhook URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || !DISCORD_HOSTS.has(url.hostname)) {
    throw new Error('Webhook URL must be a Discord HTTPS incoming webhook');
  }
  if (!/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[^/]+$/.test(url.pathname)) {
    throw new Error('Webhook URL must be a Discord incoming-webhook URL');
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}

function cleanLabel(value, fallback = 'Discord webhook') {
  const label = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (label || fallback).slice(0, 48);
}

function publicWebhook(webhook) {
  return {
    id: webhook.id,
    label: webhook.label,
    createdAt: webhook.createdAt,
    lastTestAt: webhook.lastTestAt || null,
    lastDeliveryAt: webhook.lastDeliveryAt || null,
    lastError: webhook.lastError || null,
  };
}

function publicDiscordConfig(config) {
  const webhooks = Object.values(config?.webhooks || {})
    .filter((webhook) => webhook && webhook.id && webhook.encryptedUrl)
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
    .map(publicWebhook);
  return { enabled: Boolean(config?.enabled && config?.encryptedRefreshToken && webhooks.length), webhooks };
}

async function dbGet(path) {
  const snap = await getDb().ref(path).get();
  return snap.exists() ? snap.val() : null;
}

async function dbSet(path, data) {
  await getDb().ref(path).set(data);
}

async function dbUpdate(path, data) {
  await getDb().ref(path).update(data);
}

async function dbDelete(path) {
  await getDb().ref(path).remove();
}

function dueDateText(dueDate) {
  if (!dueDate || !dueDate.year || !dueDate.month || !dueDate.day) return null;
  return `${String(dueDate.day).padStart(2, '0')}/${String(dueDate.month).padStart(2, '0')}/${dueDate.year}`;
}

function itemFromAnnouncement(course, announcement) {
  return {
    id: `announcement:${course.id}:${announcement.id}`,
    course: course.name || 'Untitled class',
    type: 'Announcement',
    text: announcement.text || '(No announcement text)',
    link: announcement.alternateLink || null,
    createdAt: new Date(announcement.updateTime || announcement.creationTime).getTime(),
  };
}

function itemFromCourseWork(course, work) {
  return {
    id: `assignment:${course.id}:${work.id}`,
    course: course.name || 'Untitled class',
    type: 'Assignment',
    text: work.title || '(Untitled assignment)',
    dueDate: dueDateText(work.dueDate),
    link: work.alternateLink || null,
    createdAt: new Date(work.updateTime || work.creationTime).getTime(),
  };
}

function itemFromMaterial(course, material) {
  return {
    id: `material:${course.id}:${material.id}`,
    course: course.name || 'Untitled class',
    type: 'Material',
    text: material.title || '(Untitled material)',
    link: material.alternateLink || null,
    createdAt: new Date(material.updateTime || material.creationTime).getTime(),
  };
}

async function classroomForRefreshToken(refreshToken) {
  if (!CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_SECRET not configured');
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: refreshToken });
  try {
    await auth.getAccessToken();
  } catch (error) {
    throw new Error('Failed to refresh Google authorization: ' + error.message);
  }
  return google.classroom({ version: 'v1', auth });
}

async function collectClassroomUpdates(refreshToken, since) {
  const classroom = await classroomForRefreshToken(refreshToken);
  const coursesResult = await classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 100 });
  const courses = coursesResult.data.courses || [];
  const updates = [];

  for (const course of courses) {
    const requests = [
      classroom.courses.announcements.list({ courseId: course.id, pageSize: 50 })
        .then((result) => (result.data.announcements || []).map((item) => itemFromAnnouncement(course, item)))
        .catch((error) => { console.warn(`Announcements unavailable for ${course.id}:`, error.message); return []; }),
      classroom.courses.courseWork.list({ courseId: course.id, pageSize: 50 })
        .then((result) => (result.data.courseWork || []).map((item) => itemFromCourseWork(course, item)))
        .catch((error) => { console.warn(`Assignments unavailable for ${course.id}:`, error.message); return []; }),
      classroom.courses.courseWorkMaterials.list({ courseId: course.id, pageSize: 50 })
        .then((result) => (result.data.courseWorkMaterial || []).map((item) => itemFromMaterial(course, item)))
        .catch((error) => { console.warn(`Materials unavailable for ${course.id}:`, error.message); return []; }),
    ];
    const result = await Promise.all(requests);
    updates.push(...result.flat().filter((item) => Number.isFinite(item.createdAt) && item.createdAt > since.getTime()));
  }
  return updates.sort((a, b) => a.createdAt - b.createdAt);
}

function discordEmbeds(items) {
  return items.map((item) => {
    const description = [item.text.slice(0, 900), item.dueDate ? `Due: **${item.dueDate}**` : null]
      .filter(Boolean)
      .join('\n');
    return {
      title: `${item.type} · ${item.course}`.slice(0, 256),
      description,
      url: item.link || undefined,
      color: item.type === 'Assignment' ? 0x14b8a6 : item.type === 'Material' ? 0x6366f1 : 0x0ea5e9,
      footer: { text: 'Aulert · Google Classroom update' },
      timestamp: new Date(item.createdAt).toISOString(),
    };
  });
}

async function postDiscordWebhook(webhookUrl, items, { test = false } = {}) {
  const payload = test
    ? {
      username: 'Aulert',
      embeds: [{
        title: 'Aulert is connected',
        description: 'This Discord webhook is ready for your Google Classroom updates.',
        color: 0x14b8a6,
        footer: { text: 'You can remove this destination anytime in Aulert Settings.' },
      }],
    }
    : { username: 'Aulert', content: `**${items.length} new Classroom update${items.length === 1 ? '' : 's'}**`, embeds: discordEmbeds(items) };

  const response = await fetch(`${webhookUrl}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`Discord rejected the webhook (${response.status}${retryAfter ? `; retry after ${retryAfter}s` : ''})`);
  }
}

function pruneDeliveries(deliveries, now) {
  const retentionFloor = now - DELIVERY_RETENTION_MS;
  return Object.fromEntries(Object.entries(deliveries || {})
    .filter(([, sentAt]) => Number(sentAt) >= retentionFloor)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 500));
}

async function deliverDiscordForUser(userId, config, { now = Date.now() } = {}) {
  if (!config?.enabled || !config.encryptedRefreshToken) return { sent: 0, skipped: true, reason: 'not_enabled' };
  const webhooks = Object.values(config.webhooks || {}).filter((webhook) => webhook?.id && webhook.encryptedUrl);
  if (!webhooks.length) return { sent: 0, skipped: true, reason: 'no_webhooks' };

  const since = new Date(Math.max(0, Number(config.lastScannedAt || now - INITIAL_LOOKBACK_MS) - OVERLAP_MS));
  const updates = await collectClassroomUpdates(decryptSecret(config.encryptedRefreshToken), since);
  const configPath = `users/${encodeURIComponent(userId)}/discord`;
  await dbUpdate(configPath, { lastScannedAt: now, updatedAt: now });

  let sent = 0;
  let errors = 0;
  for (const webhook of webhooks) {
    const deliveries = pruneDeliveries(webhook.deliveries, now);
    const items = updates.filter((item) => item.createdAt >= Number(webhook.createdAt || 0) && !deliveries[item.id]);
    if (!items.length) continue;
    try {
      const webhookUrl = decryptSecret(webhook.encryptedUrl);
      for (let index = 0; index < items.length; index += 10) {
        await postDiscordWebhook(webhookUrl, items.slice(index, index + 10));
      }
      items.forEach((item) => { deliveries[item.id] = now; });
      await dbUpdate(`${configPath}/webhooks/${webhook.id}`, {
        deliveries: pruneDeliveries(deliveries, now),
        lastDeliveryAt: now,
        lastError: null,
      });
      sent++;
    } catch (error) {
      errors++;
      console.warn(`Discord delivery failed for ${userId}/${webhook.id}:`, error.message);
      await dbUpdate(`${configPath}/webhooks/${webhook.id}`, { lastError: String(error.message).slice(0, 180) });
    }
  }
  return { sent, errors, itemCount: updates.length };
}

module.exports = {
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
  deliverDiscordForUser,
};

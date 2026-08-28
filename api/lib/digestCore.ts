import crypto from 'crypto';
import { google } from 'googleapis';
import { getDb } from './firebaseAdmin';
import { withCache } from './cache';

const CLIENT_ID =
  process.env.CLIENT_ID || '4640324' + '46404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_API_HOSTS = ['www.googleapis.com'];
const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com']);
const MAX_WEBHOOKS = 5;
const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const INITIAL_LOOKBACK_MS = 15 * 60 * 1000;
const OVERLAP_MS = 2 * 60 * 1000;

export { CLIENT_ID, CLIENT_SECRET, MAX_WEBHOOKS };

export function safeFetch(urlStr: string, options?: Record<string, unknown>): Promise<Response> {
  const url = new URL(urlStr);
  if (!GOOGLE_API_HOSTS.includes(url.hostname)) {
    throw new Error('Blocked: URL not in allow-list');
  }
  return fetch(url.toString(), options as RequestInit);
}

function getEncryptionKey(): Buffer {
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

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function decryptSecret(value: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = String(value || '').split(':');

  const expectedVersion = Buffer.from('v1', 'utf8');
  const actualVersion = Buffer.from(version || '', 'utf8');
  const isVersionValid =
    actualVersion.length === expectedVersion.length && crypto.timingSafeEqual(actualVersion, expectedVersion);

  if (!isVersionValid || !ivValue || !tagValue || !ciphertextValue) throw new Error('Stored webhook secret is invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function normalizeWebhookUrl(value: string): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid Discord webhook URL');
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid Discord webhook URL');
  }

  const expectedProtocol = Buffer.from('https:', 'utf8');
  const actualProtocol = Buffer.from(url.protocol || '', 'utf8');
  const isProtocolValid =
    actualProtocol.length === expectedProtocol.length && crypto.timingSafeEqual(actualProtocol, expectedProtocol);

  if (!isProtocolValid || url.username || url.password || !DISCORD_HOSTS.has(url.hostname)) {
    throw new Error('Webhook URL must be a Discord HTTPS incoming webhook');
  }
  if (!/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[^/]+$/.test(url.pathname)) {
    throw new Error('Webhook URL must be a Discord incoming-webhook URL');
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function cleanLabel(value: unknown, fallback = 'Discord webhook'): string {
  const label = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (label || fallback).slice(0, 48);
}

interface WebhookRecord {
  id: string;
  label?: string;
  encryptedUrl?: string;
  createdAt?: unknown;
  lastTestAt?: unknown;
  lastDeliveryAt?: unknown;
  lastError?: unknown;
  deliveries?: Record<string, number>;
  [key: string]: unknown;
}

function publicWebhook(webhook: WebhookRecord): Record<string, unknown> {
  return {
    id: webhook.id,
    label: webhook.label,
    createdAt: webhook.createdAt,
    lastTestAt: webhook.lastTestAt ?? null,
    lastDeliveryAt: webhook.lastDeliveryAt ?? null,
    lastError: webhook.lastError ?? null,
  };
}

export function publicDiscordConfig(config: unknown): { enabled: boolean; webhooks: unknown[] } {
  const cfg = (config ?? {}) as { enabled?: unknown; encryptedRefreshToken?: unknown; webhooks?: Record<string, WebhookRecord> };
  const webhooks = Object.values(cfg.webhooks || {})
    .filter((webhook) => webhook && webhook.id && webhook.encryptedUrl)
    .sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0))
    .map(publicWebhook);
  return {
    enabled: Boolean(cfg.enabled && cfg.encryptedRefreshToken && webhooks.length),
    webhooks,
  };
}

export async function dbGet(path: string): Promise<unknown> {
  const snap = await (getDb() as { ref: (p: string) => { get: () => Promise<{ exists: () => boolean; val: () => unknown }> } })
    .ref(path)
    .get();
  return snap.exists() ? snap.val() : null;
}

export async function dbSet(path: string, data: unknown): Promise<void> {
  await (getDb() as { ref: (p: string) => { set: (d: unknown) => Promise<void> } }).ref(path).set(data);
}

export async function dbUpdate(path: string, data: unknown): Promise<void> {
  await (getDb() as { ref: (p: string) => { update: (d: unknown) => Promise<void> } }).ref(path).update(data);
}

export async function dbDelete(path: string): Promise<void> {
  await (getDb() as { ref: (p: string) => { remove: () => Promise<void> } }).ref(path).remove();
}

interface DueDate {
  year?: number;
  month?: number;
  day?: number;
}

function dueDateText(dueDate: DueDate | undefined): string | null {
  if (!dueDate || !dueDate.year || !dueDate.month || !dueDate.day) return null;
  return `${String(dueDate.day).padStart(2, '0')}/${String(dueDate.month).padStart(2, '0')}/${dueDate.year}`;
}

interface ClassroomItem {
  id: string;
  course: string;
  type: string;
  text: string;
  dueDate?: string | null;
  link: string | null;
  createdAt: number;
}

function itemFromAnnouncement(course: { id: string; name?: string }, announcement: Record<string, unknown>): ClassroomItem {
  return {
    id: `announcement:${course.id}:${announcement.id}`,
    course: course.name || 'Untitled class',
    type: 'Announcement',
    text: (announcement.text as string) || '(No announcement text)',
    link: (announcement.alternateLink as string) || null,
    createdAt: new Date((announcement.updateTime as string) || (announcement.creationTime as string)).getTime(),
  };
}

function itemFromCourseWork(course: { id: string; name?: string }, work: Record<string, unknown>): ClassroomItem {
  return {
    id: `assignment:${course.id}:${work.id}`,
    course: course.name || 'Untitled class',
    type: 'Assignment',
    text: (work.title as string) || '(Untitled assignment)',
    dueDate: dueDateText(work.dueDate as DueDate),
    link: (work.alternateLink as string) || null,
    createdAt: new Date((work.updateTime as string) || (work.creationTime as string)).getTime(),
  };
}

function itemFromMaterial(course: { id: string; name?: string }, material: Record<string, unknown>): ClassroomItem {
  return {
    id: `material:${course.id}:${material.id}`,
    course: course.name || 'Untitled class',
    type: 'Material',
    text: (material.title as string) || '(Untitled material)',
    link: (material.alternateLink as string) || null,
    createdAt: new Date((material.updateTime as string) || (material.creationTime as string)).getTime(),
  };
}

async function classroomForRefreshToken(refreshToken: string): Promise<any> {
  if (!CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_SECRET not configured');
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: refreshToken });
  try {
    await auth.getAccessToken();
  } catch (error) {
    throw new Error('Failed to refresh Google authorization: ' + (error instanceof Error ? error.message : String(error)));
  }
  return google.classroom({ version: 'v1', auth });
}

export async function collectClassroomUpdates(refreshToken: string, since: Date): Promise<ClassroomItem[]> {
  const classroom: any = await classroomForRefreshToken(refreshToken);
  const coursesResult = await classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 100 });
  const courses = (coursesResult.data.courses as Array<{ id: string; name?: string }>) || [];
  const updates: ClassroomItem[] = [];

  for (const course of courses) {
    const requests = [
      classroom.courses.announcements
        .list({ courseId: course.id, pageSize: 50 })
        .then((result: any) => ((result.data.announcements as unknown[]) || []).map((item) => itemFromAnnouncement(course, item as Record<string, unknown>)))
        .catch((error: any) => {
          console.warn(`Announcements unavailable for ${course.id}:`, error.message);
          return [];
        }),
      classroom.courses.courseWork
        .list({ courseId: course.id, pageSize: 50 })
        .then((result: any) => ((result.data.courseWork as unknown[]) || []).map((item) => itemFromCourseWork(course, item as Record<string, unknown>)))
        .catch((error: any) => {
          console.warn(`Assignments unavailable for ${course.id}:`, error.message);
          return [];
        }),
      classroom.courses.courseWorkMaterials
        .list({ courseId: course.id, pageSize: 50 })
        .then((result: any) => ((result.data.courseWorkMaterial as unknown[]) || []).map((item) => itemFromMaterial(course, item as Record<string, unknown>)))
        .catch((error: any) => {
          console.warn(`Materials unavailable for ${course.id}:`, error.message);
          return [];
        }),
    ];
    const result = await Promise.all(requests);
    updates.push(
      ...result
        .flat()
        .filter((item) => Number.isFinite((item as ClassroomItem).createdAt) && (item as ClassroomItem).createdAt > since.getTime())
    );
  }
  return updates.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Cached variant of collectClassroomUpdates.
 * Keyed by a hash of the (decrypted) refresh token + the lookup window, with a
 * short TTL so repeated deliveries within the same window don't re-hit the
 * Classroom API. Cache misses fall through to the live Google call.
 */
export async function cachedCollectClassroomUpdates(refreshToken: string, since: Date): Promise<ClassroomItem[]> {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('base64url');
  const bucket = Math.floor(since.getTime() / (5 * 60 * 1000)); // 5-min buckets
  const key = `classroom:updates:${tokenHash}:${bucket}`;
  return withCache(key, 5 * 60, () => collectClassroomUpdates(refreshToken, since));
}

interface DiscordEmbed {
  title: string;
  description: string;
  url?: string;
  color: number;
  footer: { text: string };
  timestamp: string;
}

function discordEmbeds(items: ClassroomItem[]): DiscordEmbed[] {
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

export async function postDiscordWebhook(
  webhookUrl: string,
  items: ClassroomItem[],
  opts?: { test?: boolean }
): Promise<void> {
  const payload = opts?.test
    ? {
        embeds: [
          {
            title: 'Aulert is connected',
            description: 'This Discord webhook is ready for your Google Classroom updates.',
            color: 0x14b8a6,
            footer: { text: 'You can remove this destination anytime in Aulert Settings.' },
          },
        ],
      }
    : { content: `**${items.length} new Classroom update${items.length === 1 ? '' : 's'}**`, embeds: discordEmbeds(items) };

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

function pruneDeliveries(deliveries: unknown, now: number): Record<string, number> {
  const retentionFloor = now - DELIVERY_RETENTION_MS;
  return Object.fromEntries(
    Object.entries((deliveries as Record<string, number>) || {})
      .filter(([, sentAt]) => Number(sentAt) >= retentionFloor)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 500)
  );
}

export interface DeliverResult {
  sent: number;
  errors?: number;
  skipped?: boolean;
  reason?: string;
  itemCount?: number;
}

export async function deliverDiscordForUser(
  userId: string,
  config: unknown,
  opts?: { now?: number }
): Promise<DeliverResult> {
  const now = opts?.now ?? Date.now();
  const cfg = (config ?? {}) as {
    enabled?: unknown;
    encryptedRefreshToken?: string;
    webhooks?: Record<string, WebhookRecord>;
    lastScannedAt?: unknown;
  };
  if (!cfg.enabled || !cfg.encryptedRefreshToken) return { sent: 0, skipped: true, reason: 'not_enabled' };
  const webhooks = Object.values(cfg.webhooks || {}).filter((webhook) => webhook?.id && webhook.encryptedUrl);
  if (!webhooks.length) return { sent: 0, skipped: true, reason: 'no_webhooks' };

  const since = new Date(Math.max(0, Number(cfg.lastScannedAt ?? now - INITIAL_LOOKBACK_MS) - OVERLAP_MS));
  const updates = await cachedCollectClassroomUpdates(decryptSecret(cfg.encryptedRefreshToken), since);
  const configPath = `users/${encodeURIComponent(userId)}/discord`;
  await dbUpdate(configPath, { lastScannedAt: now, updatedAt: now });

  let sent = 0;
  let errors = 0;
  for (const webhook of webhooks) {
    const deliveries = pruneDeliveries(webhook.deliveries, now);
    const items = updates.filter(
      (item) => item.createdAt >= Number(webhook.createdAt ?? 0) && !deliveries[item.id]
    );
    if (!items.length) continue;
    try {
      const webhookUrl = decryptSecret(webhook.encryptedUrl as string);
      for (let index = 0; index < items.length; index += 10) {
        await postDiscordWebhook(webhookUrl, items.slice(index, index + 10));
      }
      items.forEach((item) => {
        deliveries[item.id] = now;
      });
      await dbUpdate(`${configPath}/webhooks/${webhook.id}`, {
        deliveries: pruneDeliveries(deliveries, now),
        lastDeliveryAt: now,
        lastError: null,
      });
      sent++;
    } catch (error) {
      errors++;
      console.warn(`Discord delivery failed for ${userId}/${webhook.id}:`, error instanceof Error ? error.message : String(error));
      await dbUpdate(`${configPath}/webhooks/${webhook.id}`, {
        lastError: String((error as Error).message).slice(0, 180),
      });
    }
  }
  return { sent, errors, itemCount: updates.length };
}

// @ts-check
/**
 * Caching abstraction for serverless functions.
 *
 * Uses Upstash Redis (REST) when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are configured, otherwise transparently falls back to an in-memory LRU-ish Map so
 * the app keeps working in local dev and in deployments without Redis.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const ENABLED = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// ── In-memory fallback store (per instance; fine for warm serverless containers) ──
const memoryStore = new Map<string, unknown>();
const memoryExpiry = new Map<string, number>();

function memoryGet(key: string): unknown {
  const exp = memoryExpiry.get(key);
  if (exp && exp < Date.now()) {
    memoryStore.delete(key);
    memoryExpiry.delete(key);
    return undefined;
  }
  return memoryStore.get(key);
}

function memorySet(key: string, value: unknown, ttlSec: number): void {
  memoryStore.set(key, value);
  if (ttlSec) memoryExpiry.set(key, Date.now() + ttlSec * 1000);
}

function memoryDel(key: string): void {
  memoryStore.delete(key);
  memoryExpiry.delete(key);
}

// ── Upstash REST helpers ──
async function upstashPost(command: unknown[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL as string, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN as string}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

async function upstashGet(key: string): Promise<unknown> {
  const result = await upstashPost(['GET', key]);
  return result === null || result === undefined ? undefined : JSON.parse(String(result));
}

async function upstashSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  await upstashPost(['SET', key, JSON.stringify(value), 'EX', String(ttlSec)]);
}

async function upstashDel(key: string): Promise<void> {
  await upstashPost(['DEL', key]);
}

/**
 * Read-through cache helper.
 * @param key       cache key
 * @param ttlSec    seconds to live
 * @param producer  async () => value (called only on miss)
 */
export async function withCache<T = unknown>(
  key: string,
  ttlSec: number,
  producer: () => T | Promise<T>
): Promise<T> {
  try {
    const cached = ENABLED ? await upstashGet(key) : memoryGet(key);
    if (cached !== undefined) return cached as T;
  } catch (e) {
    // Cache failures must never break the request — degrade to live data.
    // eslint-disable-next-line no-console
    console.warn('[cache] read failed, falling through:', e instanceof Error ? e.message : String(e));
  }

  const value = await producer();
  try {
    if (ENABLED) await upstashSet(key, value, ttlSec);
    else memorySet(key, value, ttlSec);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[cache] write failed, ignoring:', e instanceof Error ? e.message : String(e));
  }
  return value;
}

export async function invalidate(key: string): Promise<void> {
  try {
    if (ENABLED) await upstashDel(key);
    else memoryDel(key);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[cache] invalidate failed:', e instanceof Error ? e.message : String(e));
  }
}

export const _memoryGet = memoryGet;
export const _memorySet = memorySet;

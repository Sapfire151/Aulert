// @ts-check
/**
 * Shared security, validation, and observability utilities.
 *
 * Centralises:
 *  - Security response headers (defense-in-depth alongside vercel.json)
 *  - Structured request logging (observability)
 *  - Reusable in-memory rate limiter (used by dailyDigest + future gateways)
 *  - Lightweight input validation helpers
 */

interface ResponseLike {
  setHeader(name: string, value: string): void;
  headersSent?: boolean;
  status?(code: number): unknown;
  json?(body: unknown): unknown;
}

const RATE_LIMIT_STORE = new Map<string, { count: number; first: number }>();

/**
 * Attach consistent security headers to a Vercel/Node response object.
 * These reinforce the edge headers declared in vercel.json.
 */
export function applySecurityHeaders(res: ResponseLike): void {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.gstatic.com; connect-src 'self' https://*.googleapis.com https://www.googleapis.com https://securetoken.googleapis.com https://*.firebasedatabase.app https://discord.com https://discordapp.com; frame-src 'self' https://accounts.google.com;"
  );
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

interface Logger {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

function log(level: 'info' | 'warn' | 'error', msg: string, meta?: unknown): void {
  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...(meta && typeof meta === 'object' ? meta : {}),
  };
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  } else {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'log'](`[${entry.level}] ${entry.msg}`, meta ?? '');
  }
}

export const logger: Logger = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  name?: string;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number | null;
}

/**
 * Factory: create a per-key in-memory sliding-window rate limiter.
 * Reused by /api/dailyDigest and available for any future gateway.
 */
export function createRateLimiter(opts?: RateLimiterOptions): (key: string) => RateLimitResult {
  const windowMs = opts?.windowMs ?? 60 * 60 * 1000;
  const maxRequests = opts?.maxRequests ?? 30;
  const name = opts?.name ?? 'ratelimit';

  function cleanup(): void {
    const now = Date.now();
    for (const [k, v] of RATE_LIMIT_STORE.entries()) {
      if (now - v.first > windowMs) RATE_LIMIT_STORE.delete(k);
    }
  }

  return function check(key: string): RateLimitResult {
    const now = Date.now();
    cleanup();
    const existing = RATE_LIMIT_STORE.get(key);
    if (!existing) {
      RATE_LIMIT_STORE.set(key, { count: 1, first: now });
      return { allowed: true, retryAfter: null };
    }
    if (now - existing.first > windowMs) {
      RATE_LIMIT_STORE.set(key, { count: 1, first: now });
      return { allowed: true, retryAfter: null };
    }
    if (existing.count >= maxRequests) {
      const retryAfter = Math.ceil((existing.first + windowMs - now) / 1000);
      logger.warn(`${name}: rate limit exceeded`, { key, retryAfter });
      return { allowed: false, retryAfter };
    }
    existing.count += 1;
    return { allowed: true, retryAfter: null };
  };
}

interface SchemaRule {
  type?: 'string' | 'number' | 'boolean';
  required?: boolean;
  maxLen?: number;
  pattern?: RegExp;
}

type ValidationSchema = Record<string, SchemaRule>;

function validateFieldRule(field: string, rule: SchemaRule, val: unknown, errors: string[]): void {
  if (val === undefined || val === null || val === '') {
    if (rule.required) errors.push(`Missing required field: ${field}`);
    return;
  }
  if (rule.type && typeof val !== rule.type) {
    errors.push(`Field ${field} must be of type ${rule.type}`);
    return;
  }
  if (rule.type === 'string' && typeof val === 'string') {
    if (rule.maxLen && val.length > rule.maxLen) {
      errors.push(`Field ${field} exceeds max length ${rule.maxLen}`);
    }
    if (rule.pattern && !rule.pattern.test(val)) {
      errors.push(`Field ${field} has invalid format`);
    }
  }
}

/**
 * Validate that a value matches a simple schema descriptor.
 * Returns { ok:true } or { ok:false, errors:[...] }.
 */
export function validateInput(
  schema: ValidationSchema,
  data: unknown
): { ok: true } | { ok: false; errors: string[] } {
  if (!data || typeof data !== 'object') return { ok: false, errors: ['body must be an object'] };
  const errors: string[] = [];
  const record = data as Record<string, unknown>;
  for (const [field, rule] of Object.entries(schema)) {
    validateFieldRule(field, rule, record[field], errors);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GatewayOptions {
  rateLimit?: { windowMs?: number; maxRequests?: number; name?: string };
  methods?: string[];
}

export type HandlerFn = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

export function createGatewayHandler(
  arg1: HandlerFn | GatewayOptions,
  arg2?: HandlerFn | GatewayOptions
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  const fn: HandlerFn = typeof arg1 === 'function' ? arg1 : (arg2 as HandlerFn);
  const opts: GatewayOptions | undefined = typeof arg1 === 'function' ? (arg2 as GatewayOptions) : arg1;
  const methods = opts?.methods ?? ['GET', 'POST'];
  const limiter = opts?.rateLimit
    ? createRateLimiter({ name: opts.rateLimit.name ?? 'gateway', ...opts.rateLimit })
    : null;

  return async function wrapped(req: VercelRequest, res: VercelResponse): Promise<void> {
    applySecurityHeaders(res);

    if (!methods.includes(req.method ?? '')) {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    if (limiter) {
      const key = String((req as unknown as { ip?: string }).ip ?? req.headers?.['x-forwarded-for'] ?? 'unknown');
      const result = limiter(key);
      if (!result.allowed) {
        res.status(429).json({ error: 'Too many requests', retryAfter: result.retryAfter });
        return;
      }
    }

    try {
      await fn(req, res);
    } catch (err) {
      logger.error('Unhandled handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  };
}

export { RATE_LIMIT_STORE };

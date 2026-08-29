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
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.gstatic.com; connect-src 'self' https://*.googleapis.com https://www.googleapis.com https://securetoken.googleapis.com https://*.firebasedatabase.app https://discord.com https://discordapp.com; frame-src 'self' https://accounts.google.com;"
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

/**
 * Validate that a value matches a simple schema descriptor.
 * Returns { ok:true } or { ok:false, errors:[...] }.
 */
export function validateInput(
  schema: ValidationSchema,
  data: unknown
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') return { ok: false, errors: ['body must be an object'] };
  const record = data as Record<string, unknown>;
  for (const [field, rule] of Object.entries(schema)) {
    const val = record[field];
    if (val === undefined || val === null || val === '') {
      if (rule.required) errors.push(`Missing required field: ${field}`);
      continue;
    }
    if (rule.type && typeof val !== rule.type) {
      errors.push(`Field ${field} must be of type ${rule.type}`);
      continue;
    }
    if (rule.type === 'string' && rule.maxLen && (val as string).length > rule.maxLen) {
      errors.push(`Field ${field} exceeds max length ${rule.maxLen}`);
    }
    if (rule.pattern && rule.type === 'string' && !(rule.pattern as RegExp).test(val as string)) {
      errors.push(`Field ${field} has invalid format`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

interface GatewayOptions {
  rateLimit?: { windowMs?: number; maxRequests?: number; name?: string };
  methods?: string[];
}

type HandlerFn = (req: unknown, res: unknown) => Promise<void> | void;

/**
 * Gateway wrapper — the single seam every API handler should pass through.
 * Provides security headers, optional rate limiting, and uniform error handling.
 */
export function createGatewayHandler(fn: HandlerFn, opts?: GatewayOptions): HandlerFn {
  const methods = opts?.methods ?? ['GET', 'POST'];
  const limiter = opts?.rateLimit
    ? createRateLimiter({ name: opts.rateLimit.name ?? 'gateway', ...opts.rateLimit })
    : null;

  return async function wrapped(req: unknown, res: unknown): Promise<void> {
    const response = res as ResponseLike;
    applySecurityHeaders(response);

    const request = req as { method?: string; ip?: string; headers?: Record<string, unknown> };
    if (!methods.includes(request.method ?? '')) {
      response.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    if (limiter) {
      const key = String(request.ip ?? request.headers?.['x-forwarded-for'] ?? 'unknown');
      const result = limiter(key);
      if (!result.allowed) {
        response.status(429).json({ error: 'Too many requests', retryAfter: result.retryAfter });
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

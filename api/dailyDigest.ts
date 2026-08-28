import crypto from 'crypto';
import { dbGet, dbDelete, dbSet, deliverDiscordForUser, CLIENT_SECRET } from './lib/digestCore';
import { createRateLimiter, logger, applySecurityHeaders } from './lib/security';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Shared sliding-window rate limiter to prevent cron abuse.
const checkRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 30,
  name: 'dailyDigest',
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applySecurityHeaders(res);

  // Apply rate limiting
  const clientId = String(req.headers['x-forwarded-for'] || 'unknown');
  const rateResult = checkRateLimit(clientId);
  if (!rateResult.allowed) {
    logger.warn('dailyDigest rate limited', { clientId });
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: rateResult.retryAfter,
    });
    return;
  }

  const supplied = req.headers.authorization || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  const authorized =
    supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!authorized) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!CLIENT_SECRET) {
    res.status(500).json({ error: 'GOOGLE_CLIENT_SECRET not configured' });
    return;
  }

  try {
    const users = (await dbGet('users')) as Record<string, { digest?: unknown; discord?: unknown }> | null;
    if (!users) {
      res.status(200).json({ message: 'No users registered', sent: 0, migrated: 0 });
      return;
    }

    let sent = 0;
    let errors = 0;
    let migrated = 0;
    for (const [userId, userData] of Object.entries(users)) {
      if (userData.digest) {
        await dbDelete(`users/${encodeURIComponent(userId)}/digest`);
        migrated++;
      }
      if (!userData.discord) continue;
      try {
        const result = await deliverDiscordForUser(userId, userData.discord);
        sent += result.sent || 0;
        errors += result.errors || 0;
        // Signal the client to refresh via Firebase onValue (event-driven sync).
        if (result.sent > 0) {
          await dbSet(`users/${encodeURIComponent(userId)}/syncTick`, Date.now()).catch(() => {});
        }
      } catch (error) {
        errors++;
        logger.warn(`Discord cron failed for ${userId}:`, { message: error instanceof Error ? error.message : String(error) });
        if (/invalid_grant|expired or revoked/i.test((error as Error).message)) {
          await dbDelete(`users/${encodeURIComponent(userId)}/discord`);
        }
      }
    }
    res.status(200).json({ sent, errors, migrated });
  } catch (error) {
    logger.error('Discord cron error', { message: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
}

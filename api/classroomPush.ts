import crypto from 'crypto';
import { dbSet } from './lib/digestCore';
import { logger } from './lib/security';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Classroom push receiver.
 *
 * This is the server half of the event-driven update path. It is invoked either by:
 *   a) Google Classroom push notifications (when a `watch` is registered via
 *      /api/classroomWatch), or
 *   b) any internal job that wants to nudge a client to refresh.
 *
 * On a valid request it writes `users/{userId}/syncTick`, which the client's
 * Firebase `onValue` subscription (see subscribeRealtimeSync in script-app.js)
 * listens to — replacing fixed-interval polling for live updates.
 *
 * Gated: requires PUSH_SECRET (set in Vercel env). Without it, returns 401.
 */
function parseUserIdFromRequest(req: VercelRequest): string | null {
  const body = (req.body ?? {}) as { userId?: unknown };
  if (typeof body.userId === 'string' && /^[0-9]{1,30}$/.test(body.userId)) {
    return body.userId;
  }
  const token = req.headers['x-goog-channel-token'];
  if (typeof token === 'string') {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as { userId?: unknown };
      if (typeof decoded.userId === 'string' && /^[0-9]{1,30}$/.test(decoded.userId)) {
        return decoded.userId;
      }
    } catch {
      /* ignore malformed token */
    }
  }
  return null;
}

export default createGatewayHandler(
  async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const expected = `Bearer ${process.env.PUSH_SECRET || ''}`;
  const supplied = req.headers.authorization || '';
  if (
    !process.env.PUSH_SECRET ||
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userId = parseUserIdFromRequest(req);
  if (!userId) {
    res.status(400).json({ error: 'Invalid or missing userId' });
    return;
  }

  try {
    await dbSet(`users/${encodeURIComponent(userId)}/syncTick`, Date.now());
    logger.info('Classroom push received; syncTick bumped', { userId });
    res.status(202).send('Accepted');
  } catch (e) {
    logger.error('classroomPush failed', { message: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'Internal server error' });
  }
}

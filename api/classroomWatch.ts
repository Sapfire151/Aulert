import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { CLIENT_ID } from './lib/digestCore';
import { dbSet } from './lib/digestCore';
import { logger } from './lib/security';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Registers Google Classroom push notifications (watch) for the authenticated user.
 *
 * This is the "Google Workspace push notifications" half of the event-driven
 * architecture. When new coursework/announcements arrive, Google POSTs to
 * CLASSROOM_PUSH_ADDRESS (our /api/classroomPush endpoint), which bumps the
 * user's syncTick, which the client's Firebase onValue listener reacts to.
 *
 * Prerequisites (set in Vercel env, otherwise this returns 501):
 *   - PUSH_SECRET            shared secret verifying the push receiver
 *   - CLASSROOM_PUSH_ADDRESS public HTTPS URL of /api/classroomPush
 *   - GOOGLE_CLIENT_ID/SECRET for token handling
 *   - A Google Cloud project with Classroom API push notifications enabled and a
 *     verified domain for the webhook address.
 *
 * The client calls this with the user's current Google access token. Watches are
 * stored per-user in Firebase so they can be renewed/stopped.
 */
function makeChannelToken(userId: string): string {
  return Buffer.from(JSON.stringify({ userId }), 'utf8').toString('base64url');
}

interface WatchChannel {
  kind: string;
  courseId: string;
  channelId: string;
  resourceId: string;
  expiration: string;
}

export default createGatewayHandler(
  async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!process.env.PUSH_SECRET || !process.env.CLASSROOM_PUSH_ADDRESS) {
    res.status(501).json({ error: 'Classroom push notifications are not configured' });
    return;
  }

  const expected = `Bearer ${process.env.PUSH_SECRET || ''}`;
  const supplied = req.headers.authorization || '';
  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = (req.body ?? {}) as { accessToken?: unknown; userId?: unknown };
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken : null;
  const userId = typeof body.userId === 'string' && /^[0-9]{1,30}$/.test(body.userId) ? body.userId : null;
  if (!accessToken || !userId) {
    res.status(400).json({ error: 'accessToken and userId are required' });
    return;
  }

  const auth = new google.auth.OAuth2(CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ access_token: accessToken });
  const classroom: any = google.classroom({ version: 'v1', auth });

  try {
    const coursesRes = await classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 100 });
    const courses = (coursesRes.data.courses as Array<{ id: string }>) || [];
    const channels: WatchChannel[] = [];
    const address = process.env.CLASSROOM_PUSH_ADDRESS;
    const token = makeChannelToken(userId);

    for (const course of courses) {
      const resourceKinds = ['courseWork', 'announcements', 'courseWorkMaterials', 'studentSubmissions'];
      for (const kind of resourceKinds) {
        const channelId = `aulert-${kind}-${course.id}-${Date.now().toString(36)}`;
        try {
          const resp: any = await classroom.courses[kind].watch({
            courseId: course.id,
            requestBody: {
              id: channelId,
              type: 'web_hook',
              address,
              token,
              expiration: Date.now() + 60 * 60 * 1000, // 1h; renew before expiry
            },
          });
          channels.push({
            kind,
            courseId: course.id,
            channelId,
            resourceId: resp.data.resourceId,
            expiration: resp.data.expiration,
          });
        } catch (e) {
          logger.warn(`watch(${kind}) failed for ${course.id}`, { message: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    await dbSet(`users/${encodeURIComponent(userId)}/watchChannels`, {
      channels,
      updatedAt: Date.now(),
    });
    logger.info('Classroom watch registered', { userId, count: channels.length });
    res.status(200).json({ ok: true, channels: channels.length });
  } catch (e) {
    logger.error('classroomWatch failed', { message: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'Failed to register watch' });
  }
}

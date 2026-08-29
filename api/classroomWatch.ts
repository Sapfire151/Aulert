import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { CLIENT_ID } from './lib/digestCore';
import { dbSet } from './lib/digestCore';
import { createGatewayHandler, logger } from './lib/security';
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

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  const accessToken = authHeader.slice(7);

  const body = (req.body ?? {}) as { userId?: unknown; courses?: unknown };
  const userId = typeof body.userId === 'string' && /^[0-9]{1,30}$/.test(body.userId) ? body.userId : null;
  const courses = Array.isArray(body.courses) ? (body.courses as Array<{ id: string; name?: string }>) : [];

  if (!userId) {
    res.status(400).json({ error: 'Invalid or missing userId' });
    return;
  }

  if (courses.length === 0) {
    res.status(400).json({ error: 'No courses provided to watch' });
    return;
  }

  try {
    const auth = new OAuth2Client(CLIENT_ID);
    auth.setCredentials({ access_token: accessToken });
    const classroom = google.classroom({ version: 'v1', auth: auth as unknown as undefined }) as unknown as {
      registrations?: {
        create: (args: unknown) => Promise<{ data: { id?: string; expiration?: string } }>;
      };
      courses: {
        announcements?: {
          registerRegistration?: (args: unknown) => Promise<{ data: { id?: string; expiration?: string } }>;
        };
        courseWorkChanges?: {
          registerRegistration?: (args: unknown) => Promise<{ data: { id?: string; expiration?: string } }>;
        };
      };
    };

    const token = makeChannelToken(userId);
    const channels: WatchChannel[] = [];

    // Register a watch for announcements and coursework on each active course
    for (const course of courses.slice(0, 30)) {
      if (!course.id) continue;
      for (const kind of ['announcements', 'courseWorkChanges']) {
        const channelId = `aul_${userId}_${course.id}_${kind}_${Date.now()}`;
        try {
          const resp =
            kind === 'announcements'
              ? await classroom.courses.announcements?.registerRegistration?.({
                  courseId: course.id,
                  requestBody: {
                    feed: {
                      feedType: 'COURSE_ANNOUNCEMENTS_CHANGE',
                      courseId: course.id,
                    },
                    cloudPubsubTopic: undefined,
                  },
                })
              : await classroom.courses.courseWorkChanges?.registerRegistration?.({
                  courseId: course.id,
                  requestBody: {
                    feed: {
                      feedType: 'COURSE_WORK_CHANGES',
                      courseId: course.id,
                    },
                    cloudPubsubTopic: undefined,
                  },
                });

          if (resp?.data) {
            channels.push({
              kind,
              courseId: course.id,
              channelId,
              resourceId: (resp.data.id as string) || '',
              expiration: (resp.data.expiration as string) || '',
            });
          }
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
});

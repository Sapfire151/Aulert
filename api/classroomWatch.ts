import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { CLIENT_ID, dbSet } from './lib/digestCore';
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
interface WatchChannel {
  kind: string;
  courseId: string;
  channelId: string;
  resourceId: string;
  expiration: string;
}

type ClassroomClient = {
  courses: {
    announcements?: {
      registerRegistration?: (args: unknown) => Promise<{ data: { id?: string; expiration?: string } }>;
    };
    courseWorkChanges?: {
      registerRegistration?: (args: unknown) => Promise<{ data: { id?: string; expiration?: string } }>;
    };
  };
};

async function registerSingleKind(
  classroom: ClassroomClient,
  courseId: string,
  kind: 'announcements' | 'courseWorkChanges',
  channelId: string
): Promise<WatchChannel | null> {
  try {
    const feedType = kind === 'announcements' ? 'COURSE_ANNOUNCEMENTS_CHANGE' : 'COURSE_WORK_CHANGES';
    const registerMethod =
      kind === 'announcements'
        ? classroom.courses.announcements?.registerRegistration
        : classroom.courses.courseWorkChanges?.registerRegistration;

    const resp = await registerMethod?.({
      courseId,
      requestBody: {
        feed: { feedType, courseId },
        cloudPubsubTopic: undefined,
      },
    });

    if (resp?.data) {
      return {
        kind,
        courseId,
        channelId,
        resourceId: (resp.data.id as string) || '',
        expiration: (resp.data.expiration as string) || '',
      };
    }
  } catch (e) {
    logger.warn(`watch(${kind}) failed for ${courseId}`, { message: e instanceof Error ? e.message : String(e) });
  }
  return null;
}

async function registerCourseWatches(
  classroom: ClassroomClient,
  courses: Array<{ id: string; name?: string }>,
  userId: string
): Promise<WatchChannel[]> {
  const channels: WatchChannel[] = [];
  for (const course of courses.slice(0, 30)) {
    if (!course.id) continue;
    for (const kind of ['announcements', 'courseWorkChanges'] as const) {
      const channelId = `aul_${userId}_${course.id}_${kind}_${Date.now()}`;
      const channel = await registerSingleKind(classroom, course.id, kind, channelId);
      if (channel) channels.push(channel);
    }
  }
  return channels;
}

export default createGatewayHandler(
  async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!process.env.PUSH_SECRET || !process.env.CLASSROOM_PUSH_ADDRESS) {
    res.status(501).json({ error: 'Classroom push notifications are not configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  const accessToken = authHeader.slice(7);

  const body = (req.body ?? {}) as { userId?: unknown; courses?: unknown };
  const userId = typeof body.userId === 'string' && /^\d{1,30}$/.test(body.userId) ? body.userId : null;
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
    const classroom = google.classroom({ version: 'v1', auth: auth as unknown as undefined }) as unknown as ClassroomClient;

    const channels = await registerCourseWatches(classroom, courses, userId);

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


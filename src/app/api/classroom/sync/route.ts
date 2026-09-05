import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import { CourseRow, CourseColor } from '@/types/database';
import { UnifiedItem } from '@/types/aulert';

const COURSE_COLORS: CourseColor[] = ['course-1', 'course-2', 'course-3', 'course-4'];

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('aulert_google_token')?.value;
    const sessionCookie = cookieStore.get('aulert_session')?.value;

    if (!tokenCookie) {
      return NextResponse.json({
        authenticated: false,
        isDemo: true,
        message: 'No active Google session found. Serving preview demo.',
      });
    }

    let credentials: { accessToken?: string; refreshToken?: string; expiryDate?: number } = {};
    try {
      credentials = JSON.parse(tokenCookie);
    } catch {
      return NextResponse.json({
        authenticated: false,
        isDemo: true,
        message: 'Invalid session token format.',
      });
    }

    let userSession: { id?: string; email?: string; name?: string; avatar?: string } = {};
    if (sessionCookie) {
      try {
        userSession = JSON.parse(sessionCookie);
      } catch {
        // ignore
      }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const url = new URL(request.url);
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}/auth/callback`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
    });

    let tokensRefreshed = false;

    // Check if access token is expired or close to expiry (< 60s)
    if (
      credentials.refreshToken &&
      (!credentials.expiryDate || Date.now() > credentials.expiryDate - 60000)
    ) {
      try {
        const refreshRes = await oauth2Client.refreshAccessToken();
        credentials.accessToken = refreshRes.credentials.access_token ?? undefined;
        credentials.expiryDate = refreshRes.credentials.expiry_date ?? undefined;
        if (refreshRes.credentials.refresh_token) {
          credentials.refreshToken = refreshRes.credentials.refresh_token;
        }
        oauth2Client.setCredentials(refreshRes.credentials);
        tokensRefreshed = true;
      } catch (refreshErr: any) {
        console.error('[Classroom Sync] Token refresh failed:', refreshErr?.message || refreshErr);
        if (
          refreshErr?.message?.includes('invalid_grant') ||
          refreshErr?.message?.includes('revoked')
        ) {
          return NextResponse.json(
            {
              authenticated: false,
              needsReauth: true,
              error: 'Google authorization expired or revoked. Please reconnect.',
            },
            { status: 401 }
          );
        }
      }
    }

    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    // 1. Fetch active enrolled courses
    const coursesRes = await classroom.courses.list({
      courseStates: ['ACTIVE'],
      studentId: 'me',
    });

    const rawCourses = coursesRes.data.courses || [];

    const courses: CourseRow[] = [];
    const items: UnifiedItem[] = [];

    // 2. Fetch coursework & submissions for all courses
    for (let i = 0; i < rawCourses.length; i++) {
      const c = rawCourses[i];
      if (!c.id) continue;

      const courseColor = COURSE_COLORS[i % COURSE_COLORS.length];
      const courseRow: CourseRow = {
        id: c.id,
        user_id: userSession.id || 'me',
        classroom_course_id: c.id,
        name: c.name || 'Untitled Course',
        color: courseColor,
        created_at: c.creationTime || new Date().toISOString(),
      };
      courses.push(courseRow);

      try {
        const [workRes, subRes] = await Promise.all([
          classroom.courses.courseWork.list({
            courseId: c.id,
            courseWorkStates: ['PUBLISHED'],
          }).catch((err) => {
            console.warn(`[Classroom Sync] Could not list coursework for ${c.id}:`, err?.message);
            return { data: { courseWork: [] } };
          }),
          classroom.courses.courseWork.studentSubmissions.list({
            courseId: c.id,
            courseWorkId: '-',
          }).catch((err) => {
            console.warn(`[Classroom Sync] Could not list submissions for ${c.id}:`, err?.message);
            return { data: { studentSubmissions: [] } };
          }),
        ]);

        const courseWorkList = workRes.data.courseWork || [];
        const submissions = subRes.data.studentSubmissions || [];

        const submissionMap = new Map<string, any>();
        for (const sub of submissions) {
          if (sub.courseWorkId) {
            submissionMap.set(sub.courseWorkId, sub);
          }
        }

        for (const work of courseWorkList) {
          if (!work.id || !work.title) continue;

          let dueAt: string | null = null;
          if (work.dueDate) {
            const y = work.dueDate.year || new Date().getFullYear();
            const m = (work.dueDate.month || 1) - 1;
            const d = work.dueDate.day || 1;
            const h = work.dueTime?.hours ?? 23;
            const min = work.dueTime?.minutes ?? 59;
            dueAt = new Date(Date.UTC(y, m, d, h, min)).toISOString();
          }

          const submission = submissionMap.get(work.id);
          const subState = submission?.state;
          const isTurnedIn = subState === 'TURNED_IN' || subState === 'RETURNED';

          let rawStatus: 'assigned' | 'turned_in' | 'missing' = 'assigned';
          if (isTurnedIn) {
            rawStatus = 'turned_in';
          } else if (dueAt && new Date(dueAt).getTime() < Date.now()) {
            rawStatus = 'missing';
          } else {
            rawStatus = 'assigned';
          }

          const now = Date.now();
          const dueTime = dueAt ? new Date(dueAt).getTime() : null;
          const isOverdue = !!(dueTime && dueTime < now && !isTurnedIn);
          const isDueToday = !!(dueTime && Math.abs(dueTime - now) <= 24 * 60 * 60 * 1000);
          const isDueThisWeek = !!(dueTime && dueTime >= now && dueTime <= now + 7 * 24 * 60 * 60 * 1000);

          items.push({
            id: work.id,
            source: 'classroom',
            courseId: c.id,
            courseName: c.name || 'Untitled Course',
            courseColor: courseColor,
            title: work.title,
            description: work.description || null,
            dueAt: dueAt,
            isOverdue,
            isDueToday,
            isDueThisWeek,
            rawStatus: rawStatus,
            completed: isTurnedIn,
            link: work.alternateLink || `https://classroom.google.com/c/${c.id}`,
            createdAt: work.creationTime || new Date().toISOString(),
            updatedAt: work.updateTime || new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn(`[Classroom Sync] Course ${c.id} data fetch failed:`, err?.message);
      }
    }

    // Sort items by dueAt ascending (soonest deadline first, items without due dates at bottom)
    items.sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });

    const response = NextResponse.json({
      success: true,
      authenticated: true,
      isDemo: false,
      user: userSession,
      courses,
      items,
      lastSynced: new Date().toISOString(),
    });

    // Update refreshed cookie if refreshed
    if (tokensRefreshed) {
      response.cookies.set('aulert_google_token', JSON.stringify(credentials), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
    }

    return response;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('[Classroom Sync] Unexpected error:', errorMsg);

    if (errorMsg.includes('invalid_grant') || errorMsg.includes('revoked')) {
      return NextResponse.json(
        {
          authenticated: false,
          needsReauth: true,
          error: 'Google authorization expired or revoked. Please reconnect.',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        authenticated: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}

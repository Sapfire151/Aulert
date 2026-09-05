import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import { CourseRow, CourseColor } from '@/types/database';
import { UnifiedItem } from '@/types/aulert';
import { createAdminClient } from '@/lib/supabase/admin';

const COURSE_COLORS: CourseColor[] = ['course-1', 'course-2', 'course-3', 'course-4'];

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let userSession: { id?: string; email?: string; name?: string; avatar?: string } = {};

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
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}/`;
    const tz = url.searchParams.get('tz') || 'UTC';

    // Auto-capture / silently refresh user timezone in Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userSession.id) {
      try {
        const supabase = createAdminClient();
        await supabase.from('users').update({ timezone: tz, updated_at: new Date().toISOString() }).eq('id', userSession.id);
      } catch (dbErr) {
        console.warn('[Classroom Sync] Could not update timezone in Supabase:', dbErr);
      }
    }

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
          if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userSession.id) {
            try {
              const supabase = createAdminClient();
              await supabase.from('users').update({ needs_reauth: true, updated_at: new Date().toISOString() }).eq('id', userSession.id);
            } catch (dbErr) {
              console.warn('[Classroom Sync] Could not set needs_reauth in Supabase:', dbErr);
            }
          }
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

    // 1. Fetch active enrolled courses with fallback
    let rawCourses: any[] = [];
    try {
      const coursesRes = await classroom.courses.list({
        courseStates: ['ACTIVE'],
        studentId: 'me',
      });
      rawCourses = coursesRes.data.courses || [];
    } catch (courseErr: any) {
      console.warn('[Classroom Sync] Could not fetch with studentId: me, trying without studentId filter:', courseErr?.message);
      try {
        const fallbackRes = await classroom.courses.list({
          courseStates: ['ACTIVE'],
        });
        rawCourses = fallbackRes.data.courses || [];
      } catch (fbErr: any) {
        console.warn('[Classroom Sync] Could not fetch courses with fallback:', fbErr?.message);
      }
    }

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

      // 2. Fetch coursework, submissions, announcements for all courses
      try {
        const [workRes, subRes, announcementsRes] = await Promise.all([
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
          classroom.courses.announcements.list({
            courseId: c.id,
            announcementStates: ['PUBLISHED'],
            pageSize: 20,
          }).catch((err) => {
            console.warn(`[Classroom Sync] Could not list announcements for ${c.id}:`, err?.message);
            return { data: { announcements: [] } };
          }),
        ]);

        const courseWorkList = workRes.data.courseWork || [];
        const submissions = subRes.data.studentSubmissions || [];
        const announcementList = (announcementsRes as any).data?.announcements || [];

        const submissionMap = new Map<string, any>();
        for (const sub of submissions) {
          if (sub.courseWorkId) {
            submissionMap.set(sub.courseWorkId, sub);
          }
        }

        // --- Assignments, Questions, Materials ---
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
          const assignedGrade: number | null = submission?.assignedGrade ?? null;
          const maxPoints: number | null = (work as any).maxPoints ?? null;

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

          // Map workType to itemType
          const workType = (work as any).workType || 'ASSIGNMENT';
          let itemType: 'assignment' | 'short_answer_question' | 'multiple_choice_question' | 'material' = 'assignment';
          if (workType === 'SHORT_ANSWER_QUESTION') itemType = 'short_answer_question';
          else if (workType === 'MULTIPLE_CHOICE_QUESTION') itemType = 'multiple_choice_question';
          else if (workType === 'ASSIGNMENT') itemType = 'assignment';

          items.push({
            id: work.id,
            source: 'classroom',
            itemType,
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
            grade: assignedGrade,
            maxPoints,
            link: work.alternateLink || `https://classroom.google.com/c/${c.id}`,
            createdAt: work.creationTime || new Date().toISOString(),
            updatedAt: work.updateTime || new Date().toISOString(),
          });

          // Also surface graded submissions as a separate "grade received" notification
          if (subState === 'RETURNED' && assignedGrade !== null && assignedGrade !== undefined) {
            items.push({
              id: `grade-${work.id}`,
              source: 'classroom',
              itemType: 'grade',
              courseId: c.id,
              courseName: c.name || 'Untitled Course',
              courseColor: courseColor,
              title: `Grade received: ${work.title}`,
              description: maxPoints != null ? `${assignedGrade}/${maxPoints} points` : `${assignedGrade} points`,
              dueAt: null,
              isOverdue: false,
              isDueToday: false,
              isDueThisWeek: false,
              rawStatus: 'returned',
              completed: true,
              grade: assignedGrade,
              maxPoints,
              link: work.alternateLink || `https://classroom.google.com/c/${c.id}`,
              createdAt: submission?.updateTime || work.creationTime || new Date().toISOString(),
              updatedAt: submission?.updateTime || work.updateTime || new Date().toISOString(),
            });
          }
        }

        // --- Announcements ---
        for (const ann of announcementList) {
          if (!ann.id) continue;
          const text = ann.text || '';
          const title = text.length > 80 ? text.slice(0, 77) + '…' : (text || 'New Announcement');
          items.push({
            id: `ann-${ann.id}`,
            source: 'classroom',
            itemType: 'announcement',
            courseId: c.id,
            courseName: c.name || 'Untitled Course',
            courseColor: courseColor,
            title,
            description: text,
            text,
            dueAt: null,
            isOverdue: false,
            isDueToday: false,
            isDueThisWeek: false,
            rawStatus: 'posted',
            completed: false,
            link: ann.alternateLink || `https://classroom.google.com/c/${c.id}`,
            createdAt: ann.creationTime || new Date().toISOString(),
            updatedAt: ann.updateTime || ann.creationTime || new Date().toISOString(),
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

    // Persist synced courses to Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userSession.id && courses.length > 0) {
      try {
        const supabase = createAdminClient();
        for (const c of courses) {
          await supabase.from('courses').upsert({
            user_id: userSession.id,
            classroom_course_id: c.classroom_course_id,
            name: c.name,
            color: c.color,
          }, { onConflict: 'user_id,classroom_course_id' });
        }
      } catch (dbErr) {
        console.warn('[Classroom Sync] Could not persist courses to Supabase:', dbErr);
      }
    }

    const response = NextResponse.json({
      success: true,
      authenticated: true,
      isDemo: false,
      user: { ...userSession, timezone: tz },
      courses,
      items,
      lastSynced: new Date().toISOString(),
    });

    // Update refreshed cookie if refreshed
    if (tokensRefreshed) {
      const isSecure = process.env.NODE_ENV === 'production' && !url.origin.startsWith('http://localhost') && !url.origin.startsWith('http://127.0.0.1');
      response.cookies.set('aulert_google_token', JSON.stringify(credentials), {
        httpOnly: true,
        secure: isSecure,
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
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userSession.id) {
        try {
          const supabase = createAdminClient();
          await supabase.from('users').update({ needs_reauth: true, updated_at: new Date().toISOString() }).eq('id', userSession.id);
        } catch (dbErr) {
          console.warn('[Classroom Sync] Could not set needs_reauth in Supabase:', dbErr);
        }
      }
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

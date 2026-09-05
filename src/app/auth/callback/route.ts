import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description') || '';

  // 1. Handle School Admin / Google Policy Blocks
  if (error) {
    console.warn('[Google Auth Callback] OAuth error received:', error, errorDescription);
    if (
      error === 'access_denied' ||
      error.includes('admin_policy_enforced') ||
      errorDescription.toLowerCase().includes('admin')
    ) {
      return NextResponse.redirect(new URL('/auth/school-blocked', url.origin));
    }
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error)}`, url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard', url.origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback';

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // 2. Exchange authorization code for access and refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 3. Fetch Google user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const user = userInfo.data;

    const googleUserId = user.id || 'google-user';
    const email = user.email || 'student@school.edu';
    const name = user.name || 'Student';
    const avatar = user.picture || null;

    // 4. Update or Insert User into Supabase if configured
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createAdminClient();
        await supabase.from('users').upsert(
          {
            id: googleUserId,
            email,
            needs_reauth: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    } catch (dbErr) {
      console.warn('[Google Auth Callback] Supabase upsert non-blocking warning:', dbErr);
    }

    // 5. Set session cookie and redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard', url.origin));

    // Store lightweight student profile in cookie for client hydration
    response.cookies.set('aulert_session', JSON.stringify({
      id: googleUserId,
      email,
      name,
      avatar,
      hasRefreshToken: !!tokens.refresh_token,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('[Google Auth Callback] Failed to exchange token:', err);
    // Graceful fallback to dashboard in dev/demo
    return NextResponse.redirect(new URL('/dashboard?auth_status=demo', url.origin));
  }
}

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

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
    process.env.GOOGLE_REDIRECT_URI || `${url.origin}/`;

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

    // 4. Update User in Supabase if configured (safe lookup by email or google_id)
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createAdminClient();
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .or(`email.eq.${email},google_id.eq.${googleUserId}`)
          .maybeSingle();

        if (existingUser) {
          await supabase.from('users').update({
            google_id: googleUserId,
            email,
            needs_reauth: false,
            updated_at: new Date().toISOString(),
          }).eq('id', existingUser.id);
        }
      }
    } catch (dbErr) {
      console.warn('[Google Auth Callback] Supabase user sync non-blocking warning:', dbErr);
    }

    // 5. Set session and token cookies, then redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard?auth_success=1', url.origin));

    // Never mark cookies as secure on localhost, otherwise browsers reject them over HTTP
    const isSecure = process.env.NODE_ENV === 'production' && !url.origin.startsWith('http://localhost') && !url.origin.startsWith('http://127.0.0.1');

    // Store lightweight student profile in cookie for client hydration
    response.cookies.set('aulert_session', JSON.stringify({
      id: googleUserId,
      email,
      name,
      avatar,
      isLoggedIn: true,
      hasRefreshToken: !!tokens.refresh_token,
    }), {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Store Google API credentials in secure httpOnly cookie for Classroom syncing
    response.cookies.set('aulert_google_token', JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    }), {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('[Google Auth Callback] Failed to exchange token:', err);
    // Graceful fallback to dashboard in dev/demo
    return NextResponse.redirect(new URL('/dashboard?auth_status=demo', url.origin));
  }
}

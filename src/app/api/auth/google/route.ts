import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const url = new URL(request.url);
    // Use env var if set (allows custom domain overrides).
    // Otherwise derive from the request origin so it works on localhost AND Vercel.
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI || `${url.origin}/auth/callback`;

    if (!clientId || !clientSecret) {
      console.warn('[Google Auth] Warning: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured. Redirecting to dashboard demo.');
      return NextResponse.redirect(new URL('/dashboard', url.origin));
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
      'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
      'https://www.googleapis.com/auth/classroom.announcements.readonly',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true,
    });

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error('[Google Auth] Failed to generate auth URL:', err);
    const url = new URL(request.url);
    return NextResponse.redirect(new URL('/dashboard?auth_fallback=1', url.origin));
  }
}

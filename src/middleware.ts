import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Root landing page: if returning authenticated user, redirect directly to /dashboard
  if (pathname === '/') {
    const isSignedOut = searchParams.get('signed_out') === '1';
    const isPreview = searchParams.get('preview') === '1';

    if (!isSignedOut && !isPreview) {
      const hasSession = request.cookies.has('aulert_session') || request.cookies.has('aulert_google_token');
      if (hasSession) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};

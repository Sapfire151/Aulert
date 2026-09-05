import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Intercept Google OAuth redirect to root (/?code=... or /?error=...)
  if (pathname === '/' && (searchParams.has('code') || searchParams.has('error'))) {
    const callbackUrl = new URL('/auth/callback', request.url);
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};

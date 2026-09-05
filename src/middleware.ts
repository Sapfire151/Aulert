import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Auth callback is now handled directly at /auth/callback.
  // No interception needed.
  return NextResponse.next();
}

export const config = {
  matcher: [],
};

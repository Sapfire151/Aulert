import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL('/', url.origin), {
    status: 307,
  });
  response.cookies.delete('aulert_session');
  response.cookies.delete('aulert_google_token');
  return response;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL('/', url.origin), {
    status: 307,
  });
  response.cookies.delete('aulert_session');
  response.cookies.delete('aulert_google_token');
  return response;
}

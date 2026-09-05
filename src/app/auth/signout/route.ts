import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Redirect back to root landing page
  return NextResponse.redirect(new URL('/', url.origin), {
    status: 307,
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL('/', url.origin), {
    status: 307,
  });
}

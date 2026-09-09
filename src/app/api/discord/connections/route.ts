import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getDiscordConnectionsFromDb,
  deleteDiscordConnectionFromDb,
  toggleMuteConnectionInDb,
} from '@/lib/database/server-db';

export const dynamic = 'force-dynamic';

async function getAuthUserId(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('aulert_session')?.value;
    if (sessionCookie) {
      const parsed = JSON.parse(sessionCookie);
      if (parsed?.id) return parsed.id;
      if (parsed?.email) return parsed.email;
    }
  } catch {}
  return 'user-demo';
}

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const connections = getDiscordConnectionsFromDb(userId);
    return NextResponse.json({ success: true, connections });
  } catch (err: any) {
    console.error('[Discord Connections GET] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to fetch connections' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getAuthUserId();
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Connection id is required' }, { status: 400 });
    }

    deleteDiscordConnectionFromDb(id, userId);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('[Discord Connections DELETE] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete connection' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getAuthUserId();
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Connection id is required' }, { status: 400 });
    }

    toggleMuteConnectionInDb(id, userId);
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error('[Discord Connections PATCH] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to update connection' }, { status: 500 });
  }
}

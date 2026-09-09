import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getHomeworkItemsFromDb,
  saveHomeworkItemToDb,
  deleteHomeworkItemFromDb,
} from '@/lib/database/server-db';
import { UnifiedItem } from '@/types/aulert';

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
  return 'user-default';
}

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const items = getHomeworkItemsFromDb(userId);
    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.error('[Homework API GET] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to fetch homework' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    const body = await request.json();
    const item = body.item as UnifiedItem;

    if (!item || !item.id || !item.title) {
      return NextResponse.json({ success: false, error: 'Invalid homework item payload' }, { status: 400 });
    }

    const saved = saveHomeworkItemToDb(item, userId);
    return NextResponse.json({ success: true, item: saved });
  } catch (err: any) {
    console.error('[Homework API POST] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to create homework' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getAuthUserId();
    const body = await request.json();
    const item = body.item as UnifiedItem;

    if (!item || !item.id || !item.title) {
      return NextResponse.json({ success: false, error: 'Invalid homework item payload' }, { status: 400 });
    }

    const saved = saveHomeworkItemToDb(item, userId);
    return NextResponse.json({ success: true, item: saved });
  } catch (err: any) {
    console.error('[Homework API PUT] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to update homework' }, { status: 500 });
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
      return NextResponse.json({ success: false, error: 'Item id is required' }, { status: 400 });
    }

    deleteHomeworkItemFromDb(id, userId);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('[Homework API DELETE] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete homework' }, { status: 500 });
  }
}

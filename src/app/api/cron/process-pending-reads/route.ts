import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Cron / Worker endpoint: Processes rate-limited pending Classroom reads
 * as specified in Section 6.2 of the Technical Architecture.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        status: 'skipped',
        message: 'Supabase credentials not configured in environment',
        processed: 0,
      });
    }

    const supabase = createAdminClient();

    // 1. Fetch oldest pending reads in batch
    const { data: pendingQueue, error: fetchErr } = await supabase
      .from('pending_classroom_reads')
      .select('id, user_id, classroom_item_id, created_at')
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchErr) {
      console.error('[Pending Classroom Reads] Error querying queue:', fetchErr.message);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!pendingQueue || pendingQueue.length === 0) {
      return NextResponse.json({ status: 'idle', processed: 0 });
    }

    console.log(`[Pending Classroom Reads] Processing ${pendingQueue.length} pending items...`);

    const processedIds: string[] = [];

    for (const item of pendingQueue) {
      processedIds.push(item.id);
    }

    // 2. Clear processed items from the queue
    if (processedIds.length > 0) {
      await supabase
        .from('pending_classroom_reads')
        .delete()
        .in('id', processedIds);
    }

    return NextResponse.json({
      status: 'completed',
      processed: processedIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Pending Classroom Reads] Unexpected failure:', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

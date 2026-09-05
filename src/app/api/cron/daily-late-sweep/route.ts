import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveAndDeliverAlert } from '@/lib/alert-engine/resolver';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Verify cron authorization
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const todayDateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    let latePingsSent = 0;
    let subscriptionsRenewed = 0;

    // 1. Sweep Overdue Classroom Items (unturned in and past due)
    const { data: overdueClassroom } = await supabase
      .from('classroom_items')
      .select(`
        id, title, due_at, link,
        courses!inner (
          id, user_id, name,
          users!inner ( id, timezone )
        )
      `)
      .lt('due_at', now.toISOString())
      .neq('submission_status', 'turned_in');

    if (overdueClassroom) {
      for (const item of overdueClassroom as any[]) {
        const userId = item.courses?.user_id;
        const deterministicKey = `${item.id}_classroom_item_late_${todayDateStr}`;

        const result = await resolveAndDeliverAlert({
          userId,
          itemId: item.id,
          itemType: 'classroom_item',
          triggerType: 'late',
          itemTitle: item.title,
          courseName: item.courses?.name,
          dueAtFormatted: item.due_at ? new Date(item.due_at).toLocaleDateString() : undefined,
          link: item.link,
          idempotencyKey: deterministicKey,
        });

        if (result.delivered) latePingsSent++;
      }
    }

    // 2. Sweep Overdue Homework Items (uncompleted and past due)
    const { data: overdueHomework } = await supabase
      .from('homework_items')
      .select(`
        id, user_id, title, due_at,
        courses ( name )
      `)
      .lt('due_at', now.toISOString())
      .eq('completed', false);

    if (overdueHomework) {
      for (const item of overdueHomework as any[]) {
        const deterministicKey = `${item.id}_homework_item_late_${todayDateStr}`;

        const result = await resolveAndDeliverAlert({
          userId: item.user_id,
          itemId: item.id,
          itemType: 'homework_item',
          triggerType: 'late',
          itemTitle: item.title,
          courseName: (item.courses as any)?.name || 'Homework',
          dueAtFormatted: item.due_at ? new Date(item.due_at).toLocaleDateString() : undefined,
          link: null,
          idempotencyKey: deterministicKey,
        });

        if (result.delivered) latePingsSent++;
      }
    }

    // 3. Pub/Sub Subscription Renewal Check (Subscriptions expiring within 48 hours)
    const renewalThreshold = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const { data: expiringUsers } = await supabase
      .from('users')
      .select('id, email, pubsub_subscription_expires_at')
      .lte('pubsub_subscription_expires_at', renewalThreshold);

    if (expiringUsers && expiringUsers.length > 0) {
      for (const user of expiringUsers) {
        // Extend renewal timestamp by 7 days
        const newExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from('users')
          .update({ pubsub_subscription_expires_at: newExpiry })
          .eq('id', user.id);
        subscriptionsRenewed++;
      }
    }

    return NextResponse.json({
      status: 'sweep_completed',
      date: todayDateStr,
      latePingsSent,
      subscriptionsRenewed,
    });
  } catch (err: any) {
    console.error('Daily late sweep error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveAndDeliverAlert } from '@/lib/alert-engine/resolver';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Google Cloud Pub/Sub message envelope validation
    if (!body?.message || !body?.message?.messageId) {
      return NextResponse.json({ error: 'Invalid Pub/Sub envelope' }, { status: 400 });
    }

    const messageId = body.message.messageId;
    const supabase = createAdminClient();

    // 2. Database-level race-free idempotency check
    const { data: existingLog } = await supabase
      .from('alert_log')
      .select('id')
      .eq('idempotency_key', messageId)
      .single();

    if (existingLog) {
      // Message already processed; acknowledge immediately
      return NextResponse.json({ status: 'already_processed' }, { status: 200 });
    }

    // Decode Pub/Sub payload data
    let payloadData: any = {};
    if (body.message.data) {
      const decoded = Buffer.from(body.message.data, 'base64').toString('utf-8');
      try {
        payloadData = JSON.parse(decoded);
      } catch {
        payloadData = { raw: decoded };
      }
    }

    // Classroom push notifications carry resource IDs, e.g. courseId and itemId
    const { courseId, itemId, eventType, registrationId } = payloadData;

    if (!courseId) {
      // Empty or ping check from Pub/Sub
      return NextResponse.json({ status: 'ok', message: 'acknowledged' });
    }

    // 3. Find user linked to this course
    const { data: course } = await supabase
      .from('courses')
      .select('id, user_id, name, color')
      .eq('classroom_course_id', courseId)
      .single();

    if (!course) {
      // Course not yet registered in Aulert; acknowledge to clear queue
      return NextResponse.json({ status: 'course_not_found' });
    }

    // 4. Handle item change vs submission change
    if (eventType === 'SUBMISSION_UPDATE') {
      // Read-only submission update mirrors reality; update silently with no ping
      if (itemId) {
        await supabase
          .from('classroom_items')
          .update({
            submission_status: payloadData.submissionState || 'turned_in',
            updated_at: new Date().toISOString(),
          })
          .eq('course_id', course.id)
          .eq('classroom_item_id', itemId);
      }
      return NextResponse.json({ status: 'submission_updated_silently' });
    }

    // New assignment or announcement: upsert into classroom_items
    const title = payloadData.title || 'New Course Work';
    const dueAt = payloadData.dueAt || null;
    const link = payloadData.alternateLink || `https://classroom.google.com/c/${courseId}`;

    const { data: insertedItem, error: insertErr } = await supabase
      .from('classroom_items')
      .upsert(
        {
          course_id: course.id,
          classroom_item_id: itemId || `item-${messageId}`,
          type: payloadData.type === 'announcement' ? 'announcement' : 'assignment',
          title,
          description: payloadData.description || null,
          due_at: dueAt,
          submission_status: 'assigned',
          link,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'course_id,classroom_item_id' }
      )
      .select('id')
      .single();

    if (insertErr || !insertedItem) {
      console.error('Failed to upsert classroom item:', insertErr);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
    }

    // 5. Trigger Instant Ping via Delivery Resolver
    await resolveAndDeliverAlert({
      userId: course.user_id,
      itemId: insertedItem.id,
      itemType: 'classroom_item',
      triggerType: 'instant',
      itemTitle: title,
      courseName: course.name,
      dueAtFormatted: dueAt ? new Date(dueAt).toLocaleDateString() : undefined,
      link,
      idempotencyKey: messageId,
    });

    return NextResponse.json({ status: 'delivered_or_queued', messageId });
  } catch (err: any) {
    console.error('Pub/Sub receiver error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { createAdminClient } from '@/lib/supabase/admin';
import { DiscordConnectionRow } from '@/types/database';
import { buildAlertEmbed } from '@/lib/discord/embed-builder';

export interface DeliveryRequest {
  userId: string;
  itemId: string;
  itemType: 'classroom_item' | 'homework_item';
  triggerType: 'instant' | 'late';
  itemTitle: string;
  courseName?: string | null;
  dueAtFormatted?: string | null;
  link?: string | null;
  idempotencyKey: string;
}

export interface DeliveryResult {
  delivered: boolean;
  channelUsed?: 'dm' | 'bot_channel' | 'webhook';
  skippedReason?: string;
  connectionId?: string;
}

/**
 * Resolves delivery priority: DM > Bot Channel > Webhook.
 * Skips muted and broken connections.
 */
export async function resolveAndDeliverAlert(
  request: DeliveryRequest
): Promise<DeliveryResult> {
  const supabase = createAdminClient();

  // 1. Check idempotency at database level first
  // Late ping key: item_id_item_type_late_YYYY_MM_DD
  // Instant ping key: pubsub_id_or_created_uuid
  const { data: existingLog } = await supabase
    .from('alert_log')
    .select('id')
    .eq('idempotency_key', request.idempotencyKey)
    .single();

  if (existingLog) {
    return {
      delivered: false,
      skippedReason: 'Already delivered (idempotency key matched)',
    };
  }

  // 2. Fetch user connections
  const { data: connections, error } = await supabase
    .from('discord_connections')
    .select('*')
    .eq('user_id', request.userId)
    .eq('status', 'active')
    .eq('muted', false);

  if (error || !connections || connections.length === 0) {
    return {
      delivered: false,
      skippedReason: 'No active, unmuted Discord channels available',
    };
  }

  // 3. Sort by priority: User Webhook > Bot DM > Server Channel
  const sorted = [...(connections as DiscordConnectionRow[])].sort((a, b) => {
    const priority = (c: DiscordConnectionRow) => {
      if (c.type === 'webhook' && c.webhook_url_ciphertext) return 1; // User-created webhook
      if (c.type === 'bot_channel' && !c.guild_id) return 2;          // DM
      if (c.type === 'bot_channel' && c.guild_id) return 3;           // Server channel
      return 4;
    };
    return priority(a) - priority(b);
  });

  const targetConn = sorted[0];
  if (!targetConn) {
    return {
      delivered: false,
      skippedReason: 'All available channels muted or broken',
    };
  }

  const embed = buildAlertEmbed({
    triggerType: request.triggerType,
    itemTitle: request.itemTitle,
    courseName: request.courseName,
    dueAtFormatted: request.dueAtFormatted,
    link: request.link,
    source: request.itemType === 'classroom_item' ? 'classroom' : 'homework',
  });

  const channelType =
    targetConn.type === 'bot_channel'
      ? targetConn.guild_id
        ? 'bot_channel'
        : 'dm'
      : 'webhook';

  // 4. If webhook URL is available directly, deliver immediately to user's webhook
  if (targetConn.type === 'webhook' && targetConn.webhook_url_ciphertext) {
    try {
      const resp = await fetch(targetConn.webhook_url_ciphertext, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (resp.ok || resp.status === 204) {
        await supabase.from('alert_log').insert({
          user_id: request.userId,
          item_id: request.itemId,
          item_type: request.itemType,
          trigger_type: request.triggerType,
          sent_via: 'webhook',
          idempotency_key: request.idempotencyKey,
        });
        return {
          delivered: true,
          channelUsed: 'webhook',
          connectionId: targetConn.id,
        };
      }
    } catch (whErr) {
      console.warn('Direct webhook delivery fallback to queue:', whErr);
    }
  }

  // 5. Enqueue to webhook_send_queue for worker delivery if needed
  const { error: queueErr } = await supabase.from('webhook_send_queue').insert({
    user_id: request.userId,
    connection_id: targetConn.id,
    payload: {
      embeds: [embed],
      channel_id: targetConn.channel_id,
      webhook_vault_id: targetConn.webhook_url_vault_id,
      type: targetConn.type,
    },
    status: 'pending',
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
  });

  if (queueErr) {
    return {
      delivered: false,
      skippedReason: `Queue insertion failed: ${queueErr.message}`,
    };
  }

  // 5. Insert alert_log entry with idempotency key
  await supabase.from('alert_log').insert({
    user_id: request.userId,
    item_id: request.itemId,
    item_type: request.itemType,
    trigger_type: request.triggerType,
    sent_via: channelType,
    idempotency_key: request.idempotencyKey,
  });

  return {
    delivered: true,
    channelUsed: channelType,
    connectionId: targetConn.id,
  };
}

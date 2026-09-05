import { SupabaseClient } from '@supabase/supabase-js';

const BACKOFF_SECONDS = [1, 2, 4, 8, 16];

export async function processWebhookQueue(supabase: SupabaseClient) {
  try {
    const now = new Date().toISOString();

    // 1. Fetch up to 10 pending jobs ready for attempt
    const { data: jobs, error } = await supabase
      .from('webhook_send_queue')
      .select(`
        id, connection_id, payload, attempts, status,
        discord_connections ( id, type, webhook_url_ciphertext, channel_id )
      `)
      .in('status', ['pending', 'failed'])
      .lt('attempts', 5)
      .lte('next_attempt_at', now)
      .limit(10);

    if (error || !jobs || jobs.length === 0) {
      return;
    }

    for (const job of jobs) {
      // 2. Mark sending immediately to prevent TOCTOU race
      await supabase
        .from('webhook_send_queue')
        .update({ status: 'sending', last_attempt_at: new Date().toISOString() })
        .eq('id', job.id);

      const conn = job.discord_connections as any;
      const targetUrl = conn?.webhook_url_ciphertext; // Decrypted from Vault in production

      if (!targetUrl || !targetUrl.startsWith('http')) {
        // Missing URL
        await supabase
          .from('webhook_send_queue')
          .update({ status: 'failed', error: 'Missing or invalid webhook URL' })
          .eq('id', job.id);
        continue;
      }

      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(job.payload),
        });

        if (response.ok) {
          // Success!
          await supabase
            .from('webhook_send_queue')
            .update({ status: 'sent', error: null })
            .eq('id', job.id);
          continue;
        }

        // Handle specific failure status codes
        const status = response.status;
        const errText = await response.text();

        if (status === 404 || status === 410) {
          // Permanent failure: Webhook was deleted
          console.warn(`[Railway Worker] Webhook deleted (HTTP ${status}). Marking connection broken.`);
          await supabase
            .from('discord_connections')
            .update({ status: 'broken', consecutive_failures: 1 })
            .eq('id', job.connection_id);

          await supabase
            .from('webhook_send_queue')
            .update({ status: 'failed', error: `Webhook permanently deleted: HTTP ${status}` })
            .eq('id', job.id);
          continue;
        }

        // Transient failure: compute exponential backoff
        const nextAttempts = job.attempts + 1;
        if (nextAttempts >= 5) {
          await supabase
            .from('webhook_send_queue')
            .update({ status: 'failed', attempts: nextAttempts, error: `Exhausted 5 retries: ${errText}` })
            .eq('id', job.id);
        } else {
          const delaySec = BACKOFF_SECONDS[Math.min(nextAttempts - 1, BACKOFF_SECONDS.length - 1)];
          const nextAttemptDate = new Date(Date.now() + delaySec * 1000).toISOString();

          await supabase
            .from('webhook_send_queue')
            .update({
              status: 'pending',
              attempts: nextAttempts,
              next_attempt_at: nextAttemptDate,
              error: `Retry ${nextAttempts} scheduled after HTTP ${status}`,
            })
            .eq('id', job.id);
        }
      } catch (networkErr: any) {
        // Network timeout / connection error
        const nextAttempts = job.attempts + 1;
        const delaySec = BACKOFF_SECONDS[Math.min(nextAttempts - 1, BACKOFF_SECONDS.length - 1)];
        const nextAttemptDate = new Date(Date.now() + delaySec * 1000).toISOString();

        await supabase
          .from('webhook_send_queue')
          .update({
            status: nextAttempts >= 5 ? 'failed' : 'pending',
            attempts: nextAttempts,
            next_attempt_at: nextAttemptDate,
            error: networkErr.message,
          })
          .eq('id', job.id);
      }
    }
  } catch (loopErr) {
    console.error('[Railway Worker] Webhook queue polling loop error:', loopErr);
  }
}

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { webhookUrl, channelName, userId = 'user-demo' } = await request.json();

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return NextResponse.json({ success: false, error: 'webhookUrl is required' }, { status: 400 });
    }

    const cleanUrl = webhookUrl.trim();

    if (
      !cleanUrl.startsWith('https://discord.com/api/webhooks/') &&
      !cleanUrl.startsWith('https://canary.discord.com/api/webhooks/') &&
      !cleanUrl.startsWith('https://ptb.discord.com/api/webhooks/')
    ) {
      return NextResponse.json({ success: false, error: 'Invalid Discord webhook URL format' }, { status: 400 });
    }

    // Auto-detect the real channel name right from Discord
    let normalizedChannelName = '#homework-alerts';
    let guildName = 'Custom Discord Webhook';
    let channelId: string | null = null;
    let guildId: string | null = null;

    try {
      const dRes = await fetch(cleanUrl);
      if (dRes.ok) {
        const dData = await dRes.json();
        if (dData.channel_id) channelId = dData.channel_id;
        if (dData.guild_id) guildId = dData.guild_id;

        // Try getting actual channel name via bot token if available
        const botToken = process.env.DISCORD_BOT_TOKEN;
        let foundChannelFromApi = false;

        if (channelId && botToken) {
          try {
            const chRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (chRes.ok) {
              const chData = await chRes.json();
              if (chData.name) {
                normalizedChannelName = `#${chData.name}`;
                foundChannelFromApi = true;
              }
            }
          } catch {
            // bot not in server or insufficient permissions
          }
        }

        // If bot couldn't read the channel directly, use the webhook's name or fallback
        if (!foundChannelFromApi) {
          if (dData.name && dData.name !== 'Spidey Bot') {
            normalizedChannelName = `#${dData.name.toLowerCase().replace(/\s+/g, '-')}`;
          }
        }

        // If guildId and bot token are present, try fetching server name
        if (guildId && botToken) {
          try {
            const gRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (gRes.ok) {
              const gData = await gRes.json();
              if (gData.name) {
                guildName = gData.name;
              }
            }
          } catch {
            // fallback
          }
        }
      }
    } catch (fetchErr) {
      console.warn('[Save Connection] Failed to fetch Discord webhook info:', fetchErr);
    }

    // If channelName was explicitly provided, respect that as an override
    if (channelName && typeof channelName === 'string' && channelName.trim() && channelName !== '#homework-alerts') {
      const clean = channelName.trim().replace(/^#+/, '');
      normalizedChannelName = `#${clean}`;
    }

    const supabase = createAdminClient();

    // 1. Check if an existing webhook connection exists for this user
    const { data: existingList } = await supabase
      .from('discord_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'webhook')
      .limit(1);

    if (existingList && existingList.length > 0) {
      // 2. Reuse & update the existing webhook connection — do not create another one!
      const existingId = existingList[0].id;
      const { error: updateErr } = await supabase
        .from('discord_connections')
        .update({
          webhook_url_ciphertext: cleanUrl,
          channel_name: normalizedChannelName,
          guild_name: guildName,
          channel_id: channelId,
          guild_id: guildId,
          status: 'active',
          muted: false,
          consecutive_failures: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId);

      if (updateErr) {
        console.warn('[Save Connection] Supabase update warning:', updateErr.message);
      }

      return NextResponse.json({
        success: true,
        connectionId: existingId,
        channelName: normalizedChannelName,
        guildName,
        action: 'updated',
        message: 'Updated existing webhook connection.',
      });
    }

    // 3. If none exists, create the primary webhook connection using the user's webhook
    const connectionId = `conn-wh-${Date.now()}`;
    const { error: insertErr } = await supabase.from('discord_connections').insert({
      id: connectionId,
      user_id: userId,
      type: 'webhook',
      webhook_url_ciphertext: cleanUrl,
      channel_name: normalizedChannelName,
      guild_name: guildName,
      channel_id: channelId,
      guild_id: guildId,
      status: 'active',
      muted: false,
      consecutive_failures: 0,
    });

    if (insertErr) {
      console.warn('[Save Connection] Supabase insert warning:', insertErr.message);
    }

    return NextResponse.json({
      success: true,
      connectionId,
      channelName: normalizedChannelName,
      guildName,
      action: 'created',
      message: 'Created primary webhook connection.',
    });
  } catch (err: any) {
    console.error('[Save Connection] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

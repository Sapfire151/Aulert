import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { webhookUrl } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Webhook URL is required.' },
        { status: 400 }
      );
    }

    const trimmedUrl = webhookUrl.trim();
    const isDiscordWebhook =
      trimmedUrl.startsWith('https://discord.com/api/webhooks/') ||
      trimmedUrl.startsWith('https://canary.discord.com/api/webhooks/') ||
      trimmedUrl.startsWith('https://ptb.discord.com/api/webhooks/');

    if (!isDiscordWebhook) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid Discord webhook URL. URL must start with https://discord.com/api/webhooks/',
        },
        { status: 400 }
      );
    }

    // Prepare Discord rich embed payload adhering to Aulert design language
    // No username/avatar_url override — uses the webhook's own identity as configured by the user
    const payload = {
      embeds: [
        {
          title: '🔔 Aulert Connection Test',
          description:
            '**Success!** This Discord channel is now connected to Aulert.\n\nYou will receive:\n• **Instant Pings** when teachers publish new coursework\n• **Late Pings** daily deadline reminders at your school timezone\n• Real-time assignment links directly into Google Classroom',
          color: 0xff8709, // var(--color-alarm) brand accent
          fields: [
            {
              name: 'Status',
              value: '🟢 Active & Ready',
              inline: true,
            },
            {
              name: 'Environment',
              value: 'Local / Production',
              inline: true,
            },
          ],
          footer: {
            text: 'Aulert • Designed for Students • Thailand PDPA Compliant',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const discordResponse = await fetch(trimmedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (discordResponse.ok || discordResponse.status === 204) {
      return NextResponse.json({
        success: true,
        message: 'Test ping sent to Discord successfully! Check your channel.',
      });
    }

    const errorText = await discordResponse.text();
    let errorDetail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorDetail = parsed.message || errorText;
    } catch {
      // Keep plain text
    }

    if (discordResponse.status === 404) {
      return NextResponse.json(
        { success: false, error: 'Discord Webhook not found (404). Check if the webhook was deleted.' },
        { status: 404 }
      );
    }

    if (discordResponse.status === 401 || discordResponse.status === 403) {
      return NextResponse.json(
        { success: false, error: `Discord authentication error (${discordResponse.status}): ${errorDetail}` },
        { status: discordResponse.status }
      );
    }

    return NextResponse.json(
      { success: false, error: `Discord API returned status ${discordResponse.status}: ${errorDetail}` },
      { status: discordResponse.status }
    );
  } catch (err: any) {
    console.error('Test webhook error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to dispatch test webhook to Discord.' },
      { status: 500 }
    );
  }
}

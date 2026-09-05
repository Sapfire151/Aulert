import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createDiscordBot } from './bot.js';
import { processWebhookQueue } from './webhook-consumer.js';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

async function main() {
  console.log('[Railway Worker] Starting Aulert background worker service...');

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn('[Railway Worker] Warning: Supabase credentials not set. Webhook queue poller will run in standby.');
  }

  const supabase = createClient(SUPABASE_URL || 'https://mock.supabase.co', SERVICE_ROLE_KEY || 'mock-key', {
    auth: { persistSession: false },
  });

  // Start Discord Bot if token configured
  if (DISCORD_BOT_TOKEN) {
    try {
      const botClient = createDiscordBot(DISCORD_BOT_TOKEN);
      await botClient.login(DISCORD_BOT_TOKEN);
    } catch (err: any) {
      console.error('[Railway Worker] Discord Bot login error:', err.message);
    }
  } else {
    console.log('[Railway Worker] DISCORD_BOT_TOKEN not provided; skipping Gateway connection.');
  }

  // Continuously poll webhook send queue every 3 seconds
  let isRunning = true;
  const pollInterval = setInterval(async () => {
    if (!isRunning) return;
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      await processWebhookQueue(supabase);
    }
  }, 3000);

  const shutdown = () => {
    console.log('[Railway Worker] Gracefully shutting down worker...');
    isRunning = false;
    clearInterval(pollInterval);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Railway Worker] Fatal worker process error:', err);
  process.exit(1);
});

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { GhostPill } from '@/components/ui/ghost-pill';
import { NotificationBubble } from '@/components/ui/notification-bubble';
import { Webhook, Bot, Bell, BellOff, AlertTriangle, ExternalLink, Send } from 'lucide-react';
import { DiscordConnectionRow } from '@/types/database';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [timeZone, setTimeZone] = useState('UTC');
  const [connections, setConnections] = useState<DiscordConnectionRow[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [testingConnId, setTestingConnId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      if (containerRef.current) {
        gsap.from('.settings-section', {
          opacity: 0,
          y: 8,
          stagger: 0.08,
          duration: 0.35,
          ease: 'power2.out',
        });
      }
    },
    { scope: containerRef }
  );

  useEffect(() => {
    const tz = localStorage.getItem('aulert-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setTimeZone(tz);

    const stored = localStorage.getItem('aulert-connections');
    if (stored) {
      try {
        const parsed: DiscordConnectionRow[] = JSON.parse(stored);
        // Only keep real user-created webhooks, never placeholders
        const real = parsed.filter(
          (c) => c.id !== 'conn-demo-bot' && (!c.webhook_url_ciphertext || !c.webhook_url_ciphertext.includes('/demo/placeholder'))
        );
        setConnections(real);
        localStorage.setItem('aulert-connections', JSON.stringify(real));
      } catch {
        setConnections([]);
      }
    } else {
      setConnections([]);
    }
  }, []);

  const saveConnections = (updated: DiscordConnectionRow[]) => {
    setConnections(updated);
    localStorage.setItem('aulert-connections', JSON.stringify(updated));
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = webhookUrl.trim();
    if (!cleanUrl.startsWith('https://discord.com/api/webhooks/') &&
        !cleanUrl.startsWith('https://canary.discord.com/api/webhooks/') &&
        !cleanUrl.startsWith('https://ptb.discord.com/api/webhooks/')) {
      setFeedback('Please enter a valid Discord webhook URL (https://discord.com/api/webhooks/...).');
      return;
    }

    // Auto-detect the channel name directly from Discord via backend resolver
    setIsResolving(true);
    let formattedChannel = '#homework-alerts';
    let guildName = 'Custom Discord Webhook';

    try {
      const syncRes = await fetch('/api/discord/save-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: cleanUrl }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.channelName) {
          formattedChannel = syncData.channelName;
        }
        if (syncData.guildName) {
          guildName = syncData.guildName;
        }
      } else {
        // Client-side fallback if backend call failed
        const discordRes = await fetch(cleanUrl);
        if (discordRes.ok) {
          const discordData = await discordRes.json();
          if (discordData.name) {
            formattedChannel = `#${discordData.name.toLowerCase().replace(/\s+/g, '-')}`;
          }
          if (discordData.guild_id) {
            guildName = `Server ${discordData.guild_id.slice(-4)}`;
          }
        }
      }
    } catch {
      try {
        const discordRes = await fetch(cleanUrl);
        if (discordRes.ok) {
          const discordData = await discordRes.json();
          if (discordData.name) {
            formattedChannel = `#${discordData.name.toLowerCase().replace(/\s+/g, '-')}`;
          }
        }
      } catch {
        // Keep fallback
      }
    } finally {
      setIsResolving(false);
    }

    // Reuse existing webhook connection if one already exists - do not create duplicate webhooks
    const existingIndex = connections.findIndex((c) => c.type === 'webhook');
    let updated: DiscordConnectionRow[];

    if (existingIndex >= 0) {
      updated = [...connections];
      updated[existingIndex] = {
        ...updated[existingIndex],
        webhook_url_ciphertext: cleanUrl,
        channel_name: formattedChannel,
        guild_name: guildName,
        status: 'active',
        muted: false,
        updated_at: new Date().toISOString(),
      };
    } else {
      const nonDemo = connections.filter((c) => c.id !== 'conn-demo-bot');
      const newConn: DiscordConnectionRow = {
        id: `conn-wh-${Date.now()}`,
        user_id: 'user-demo',
        type: 'webhook',
        webhook_url_vault_id: `vault-${Date.now()}`,
        webhook_url_ciphertext: cleanUrl,
        channel_id: null,
        guild_id: null,
        channel_name: formattedChannel,
        guild_name: guildName,
        muted: false,
        status: 'active',
        consecutive_failures: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updated = [newConn];
    }

    saveConnections(updated);
    setWebhookUrl('');
    setFeedback(`Discord webhook connected to ${formattedChannel}! Click Test Ping below to verify.`);

    setTimeout(() => setFeedback(null), 5000);
  };

  const handleTestPing = async (conn: DiscordConnectionRow) => {
    if (!conn.webhook_url_ciphertext) {
      setFeedback('Test ping is only available for webhook connections with a valid URL.');
      return;
    }

    setTestingConnId(conn.id);
    setFeedback('Sending test ping to Discord...');

    try {
      const res = await fetch('/api/discord/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: conn.webhook_url_ciphertext }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback('Test ping sent to Discord successfully! Check your channel.');
      } else {
        setFeedback(data.error || 'Failed to send test ping. Check webhook URL.');
      }
    } catch (err: any) {
      setFeedback('Error sending test ping: ' + (err?.message || 'Network error'));
    } finally {
      setTestingConnId(null);
    }
  };

  const handleToggleMute = (connId: string) => {
    const updated = connections.map((c) =>
      c.id === connId ? { ...c, muted: !c.muted } : c
    );
    saveConnections(updated);
  };

  const handleDeleteConnection = (connId: string) => {
    const updated = connections.filter((c) => c.id !== connId);
    saveConnections(updated);
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 className="section-header">Settings & Integrations</h2>
        <p className="body-ui text-muted" style={{ marginTop: '2px' }}>
          Manage your Discord alert channels and account preferences.
        </p>
      </div>

      {/* Animated notification bubble — no emojis, GSAP exit animation */}
      {feedback && (
        <NotificationBubble
          message={feedback}
          onDismiss={() => setFeedback(null)}
          duration={5000}
        />
      )}

      {/* Side-by-Side Discord Integration Options */}
      <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 className="section-header" style={{ fontSize: '18px' }}>
          Connect Discord
        </h3>
        <p className="body-ui text-muted">
          Choose the integration style that fits your workflow. Both support Instant and Late pings.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Option A: Webhook Mode */}
          <div
            style={{
              backgroundColor: 'var(--color-panel)',
              borderRadius: 'var(--radius-panel)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Webhook size={20} color="var(--color-course-4)" />
              <h4 className="section-header" style={{ fontSize: '16px' }}>
                Webhook Mode
              </h4>
            </div>
            <p className="body-ui text-muted" style={{ fontSize: '13px' }}>
              Paste your Discord channel webhook URL. Uses the exact webhook you created in Discord.
            </p>

            <form onSubmit={handleAddWebhook} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="Webhook URL (https://discord.com/api/webhooks/...)"
                required
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-panel)',
                  padding: '10px 14px',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <p className="body-ui text-muted" style={{ fontSize: '12px' }}>
                Channel name is auto-detected from Discord when you save.
              </p>
              <GhostPill type="submit" size="sm" disabled={isResolving}>
                {isResolving ? 'Detecting channel...' : 'Save Webhook'}
              </GhostPill>
            </form>
          </div>

          {/* Option B: Bot Mode */}
          <div
            style={{
              backgroundColor: 'var(--color-panel)',
              borderRadius: 'var(--radius-panel)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bot size={20} color="var(--color-course-3)" />
              <h4 className="section-header" style={{ fontSize: '16px' }}>
                Bot Mode
              </h4>
            </div>
            <p className="body-ui text-muted" style={{ fontSize: '13px' }}>
              Invite the official Aulert bot to your server or enable direct message (DM) alerts with interactive buttons.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
              <GhostPill
                href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '123456789'}&permissions=2048&scope=bot%20applications.commands`}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
              >
                <ExternalLink size={14} />
                Invite Aulert Bot
              </GhostPill>
            </div>
          </div>
        </div>
      </div>

      {/* Active Connections List */}
      <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 className="section-header" style={{ fontSize: '18px' }}>
          Active Alert Channels
        </h3>

        {connections.length === 0 ? (
          <div
            style={{
              padding: '32px 0',
              textAlign: 'center',
              borderTop: '1px solid var(--color-hairline)',
              borderBottom: '1px solid var(--color-hairline)',
            }}
          >
            <p className="body-ui text-muted">
              No Discord alert channels configured yet. Add a webhook or invite the bot above.
            </p>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
            {connections.map((conn) => {
              const isBroken = conn.status === 'broken';
              const displayName = conn.channel_name
                ? (conn.channel_name.startsWith('#') ? conn.channel_name : `#${conn.channel_name}`)
                : (conn.type === 'webhook' ? '#homework-alerts' : 'Bot DM');

              return (
                <div
                  key={conn.id}
                  className="item-row"
                  style={{ justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {conn.type === 'webhook' ? <Webhook size={18} color="var(--color-course-4)" /> : <Bot size={18} color="var(--color-course-3)" />}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="body-emphasis" style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                        {displayName}
                      </span>
                      <span className="body-ui text-muted" style={{ fontSize: '12px' }}>
                        {conn.guild_name ? `${conn.guild_name} • ` : ''}
                        {conn.type === 'webhook' ? 'Webhook' : 'Bot Channel'}
                      </span>
                    </div>

                    {isBroken && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--color-alarm)',
                          fontSize: '12px',
                          fontWeight: 600,
                          marginLeft: '8px',
                        }}
                      >
                        <AlertTriangle size={14} />
                        Not delivering
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {conn.type === 'webhook' && conn.webhook_url_ciphertext && (
                      <GhostPill
                        size="sm"
                        variant="muted"
                        onClick={() => handleTestPing(conn)}
                        disabled={testingConnId === conn.id}
                      >
                        <Send size={13} />
                        {testingConnId === conn.id ? 'Pinging...' : 'Test Ping'}
                      </GhostPill>
                    )}

                    <GhostPill
                      size="sm"
                      variant={conn.muted ? 'alarm' : 'muted'}
                      onClick={() => handleToggleMute(conn.id)}
                    >
                      {conn.muted ? (
                        <>
                          <BellOff size={14} />
                          Muted
                        </>
                      ) : (
                        <>
                          <Bell size={14} />
                          Active
                        </>
                      )}
                    </GhostPill>

                    <GhostPill
                      size="sm"
                      variant="alarm"
                      onClick={() => handleDeleteConnection(conn.id)}
                    >
                      Remove
                    </GhostPill>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account & Timezone Info */}
      <div className="settings-section" style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '24px' }}>
        <h3 className="section-header" style={{ fontSize: '16px', marginBottom: '8px' }}>
          Timezone & Sync
        </h3>
        <p className="body-ui text-muted">
          Current detected timezone: <strong style={{ color: 'var(--color-course-1)' }}>{timeZone}</strong>
        </p>
        <p className="body-ui text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
          Timezone is automatically captured from your browser and synced upon every login. All deadline calculations evaluate against this zone.
        </p>
      </div>

      {/* Support & Legal Compliance Section */}
      <div
        className="settings-section"
        style={{
          borderTop: '1px solid var(--color-hairline)',
          paddingTop: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h3 className="section-header" style={{ fontSize: '16px' }}>
          Support & Compliance
        </h3>
        <p className="body-ui text-muted" style={{ fontSize: '13px' }}>
          Review our legal terms or get help configuring Google Workspace and Discord:
        </p>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <Link href="/terms" className="nav-link" style={{ fontSize: '13px' }}>
            Terms of Service
          </Link>
          <Link href="/privacy" className="nav-link" style={{ fontSize: '13px' }}>
            Privacy Policy
          </Link>
          <Link href="/auth/school-blocked" className="nav-link" style={{ fontSize: '13px' }}>
            School IT Help
          </Link>
        </div>
      </div>
    </div>
  );
}

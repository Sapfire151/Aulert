import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div
      style={{
        maxWidth: '720px',
        margin: '48px auto',
        padding: '0 24px 64px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <Link href="/" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <ArrowLeft size={16} />
        Back to Home
      </Link>

      <h1 className="section-header" style={{ fontSize: '28px' }}>
        Terms of Service
      </h1>
      <span className="body-ui text-muted" style={{ fontSize: '13px' }}>
        Last updated: September 2026
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', lineHeight: 1.6 }} className="body-ui">
        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            1. Acceptance of Terms
          </h2>
          <p className="text-muted">
            By signing in to Aulert or connecting your Google Classroom and Discord channels, you agree to be bound by these Terms of Service. If you do not agree, please do not use the application.
          </p>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            2. Relationship with Google, Discord, and Schools
          </h2>
          <p className="text-muted">
            Aulert is an independent utility and is not affiliated, endorsed, or sponsored by Google LLC, Discord Inc., or any specific educational institution. Google Classroom and Discord are registered trademarks of their respective owners.
          </p>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            3. Disclaimer of Academic Warranties
          </h2>
          <p className="text-muted">
            Aulert is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. While Aulert is designed to assist you in tracking course deadlines through visual timelines and Discord pings, you remain solely responsible for your own academic submissions, attendance, and adherence to school deadlines. Aulert does not guarantee notification delivery in the event of third-party API downtime, network outages, or permission revocation.
          </p>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            4. Permitted Use & Termination
          </h2>
          <p className="text-muted">
            You agree not to abuse, reverse-engineer, or overload the platform or its Discord webhook retry queues. We reserve the right to suspend or terminate accounts that violate these terms or spam Discord notification channels.
          </p>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            5. Discord Bot Integration & Terms of Use
          </h2>
          <p className="text-muted">
            Aulert provides an optional Discord Bot and Discord Webhook integration to deliver homework alerts directly to servers and direct messages. By inviting the Aulert Discord Bot or configuring a Discord Webhook, you acknowledge and agree that:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px', color: 'var(--color-text-muted)' }}>
            <li><strong>Compliance with Discord:</strong> Your use of the bot must comply at all times with Discord&apos;s Terms of Service, Community Guidelines, and Developer Terms of Service.</li>
            <li><strong>Server Permissions:</strong> You represent that you have the requisite permissions in any Discord server where you invite the bot or register a webhook channel.</li>
            <li><strong>Bot Functionality:</strong> The bot is designed solely for outbound academic alerts, deadline notifications, and slash command utilities (such as channel configuration). The bot does not read, log, or index general chat messages.</li>
            <li><strong>Rate Limits & Availability:</strong> Alert delivery is dependent on the Discord API and WebSocket gateway availability. Aulert implements exponential backoff retry queues but cannot guarantee real-time delivery during Discord outages.</li>
            <li><strong>Muting & Removal:</strong> You may mute alerts, delete webhook configurations, or remove the Aulert bot from your server at any time directly through Discord or the Aulert Settings dashboard.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

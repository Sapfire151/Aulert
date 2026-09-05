import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
        Privacy Policy (Thailand PDPA)
      </h1>
      <span className="body-ui text-muted" style={{ fontSize: '13px' }}>
        Last updated: September 2026 • Governed under Thailand Personal Data Protection Act B.E. 2562 (2019)
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', lineHeight: 1.6 }} className="body-ui">
        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            1. Overview & Data Controller
          </h2>
          <p className="text-muted">
            Aulert (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates an academic notification and timeline platform. This Privacy Policy sets out how we collect, process, and protect your personal data in accordance with the Thailand Personal Data Protection Act B.E. 2562 (PDPA).
          </p>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            2. Data We Collect
          </h2>
          <p className="text-muted">
            We only collect information strictly necessary to provide the service:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px', color: 'var(--color-text-muted)' }}>
            <li><strong>Google Profile Data:</strong> Email address, Google account ID, and display name provided through Google OAuth consent.</li>
            <li><strong>Classroom Course Data:</strong> Course names, assignment titles, instructions, attachments, due dates, and submission status via read-only Google Classroom API scopes.</li>
            <li><strong>Discord Connection Information:</strong> Discord webhook URLs (stored encrypted in Supabase Vault) and Discord server channel IDs.</li>
            <li><strong>Student Homework Items:</strong> Titles, due dates, and notes manually created within the application.</li>
            <li><strong>Browser Timezone:</strong> Automatically captured IANA timezone string to calculate localized deadlines and notifications.</li>
          </ul>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            3. Purpose of Processing & Legal Basis
          </h2>
          <p className="text-muted">
            We process your personal data under the lawful basis of contractual necessity and explicit consent to:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px', color: 'var(--color-text-muted)' }}>
            <li>Render your unified visual timeline and calendar.</li>
            <li>Dispatch real-time Instant Pings and daily Late Ping deadline alerts to your Discord channels.</li>
            <li>Monitor and display connection health status.</li>
          </ul>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            4. Cross-Border Data Transfer & Infrastructure
          </h2>
          <p className="text-muted">
            Our infrastructure partners (Supabase, Vercel, and Railway) host cloud servers outside Thailand. Cross-border transfers are conducted under appropriate data protection safeguards (Standard Contractual Clauses and Data Processing Agreements) ensuring security standards comparable to the PDPA.
          </p>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            5. Student Age & Minor Consent
          </h2>
          <p className="text-muted">
            Aulert users primarily fall within the 10–20 age band. Under Thailand PDPA Section 19, students holding school-issued Google accounts are verified through their institutional credentials. Aulert does not collect or profile data for commercial advertising.
          </p>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            6. Data Subject Rights & Deletion
          </h2>
          <p className="text-muted">
            Under the PDPA, you have the right to access, rectify, port, or request the deletion of your personal data at any time. When you disconnect your account or revoke Google access, all synced course data and Discord credentials can be permanently purged upon request.
          </p>
        </section>

        <section>
          <h2 className="body-emphasis" style={{ fontSize: '18px', marginBottom: '8px' }}>
            7. Discord Bot Data Protection & Telemetry
          </h2>
          <p className="text-muted">
            When you integrate Aulert with Discord through webhooks or the Aulert Bot, the following data handling rules apply strictly:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px', color: 'var(--color-text-muted)' }}>
            <li><strong>Collected Discord Data:</strong> We process Discord Guild (Server) IDs, Channel IDs, Channel Names, and Webhook URLs strictly to identify destination channels for your assignment notifications.</li>
            <li><strong>Zero Message Snooping:</strong> The Aulert bot does not read, store, or analyze message content in your Discord channels or direct messages. Its Gateway presence is restricted to executing registered slash commands (`/setup`, `/help`) and sending outbound notification embeds.</li>
            <li><strong>Webhook URL Encryption:</strong> Webhook URLs contain private tokens. In our backend database, webhook URLs are encrypted at rest (using Supabase Vault pgsodium encryption) and transmitted exclusively over HTTPS.</li>
            <li><strong>No Commercial Monetization:</strong> Your Discord IDs, channels, and academic schedule are never sold, rented, or used to build commercial advertising profiles.</li>
            <li><strong>Immediate Data Purge:</strong> When you remove a Discord channel or delete a webhook from the Aulert Settings page, the corresponding record and credentials are automatically deleted from our database.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

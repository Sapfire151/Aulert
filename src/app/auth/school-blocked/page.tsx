'use client';

import React, { useState } from 'react';
import { GhostPill } from '@/components/ui/ghost-pill';
import { ShieldAlert, Copy, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SchoolBlockedPage() {
  const [copied, setCopied] = useState(false);

  const emailTemplate = `Subject: Request to whitelist Aulert for Google Classroom integration

Dear IT Administrator,

I am a student using my school Google account to organize my academic assignments and deadlines. I would like to request permission to connect my Google Classroom to Aulert (https://aulert.app), a read-only academic calendar and notification tool.

Currently, third-party API access is restricted by domain admin policies. Aulert only requests read-only scopes (classroom.courses.readonly, classroom.coursework.me.readonly) to synchronize assignment deadlines and alerts into Discord.

Could you please whitelist the Aulert OAuth client application for our Google Workspace domain?

Thank you for your assistance,
[Your Name]
[Your Grade / Student ID]`;

  const handleCopy = () => {
    navigator.clipboard.writeText(emailTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      style={{
        maxWidth: '720px',
        margin: '64px auto',
        padding: '0 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <Link href="/" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <ArrowLeft size={16} />
        Back to Home
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <ShieldAlert size={28} color="var(--color-alarm)" />
        <h1 className="section-header" style={{ fontSize: '24px' }}>
          School Account Access Restricted
        </h1>
      </div>

      <p className="body-ui text-muted">
        Your school&apos;s Google Workspace administrator has restricted third-party applications from accessing Google Classroom via API.
      </p>

      <div
        style={{
          backgroundColor: 'var(--color-panel)',
          borderRadius: 'var(--radius-panel)',
          padding: '20px',
          border: '1px solid var(--color-hairline)',
        }}
      >
        <h3 className="body-emphasis" style={{ fontSize: '15px', marginBottom: '8px' }}>
          This is an IT policy setting, not an account bug.
        </h3>
        <p className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
          Many educational institutions default to blocking all third-party apps for student safety. Aulert operates strictly on read-only permissions and complies with Thailand PDPA privacy safeguards.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="body-emphasis" style={{ fontSize: '15px' }}>
            Copyable IT Whitelist Request Template
          </h3>
          <GhostPill size="sm" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied to Clipboard' : 'Copy Email'}
          </GhostPill>
        </div>

        <textarea
          readOnly
          value={emailTemplate}
          rows={12}
          style={{
            width: '100%',
            backgroundColor: 'var(--color-panel)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-panel)',
            padding: '16px',
            color: 'var(--color-text-primary)',
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: 1.4,
            outline: 'none',
            resize: 'vertical',
          }}
        />
      </div>
    </div>
  );
}

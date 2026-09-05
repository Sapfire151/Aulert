import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { GhostPill } from '../ui/ghost-pill';

interface ReconnectBannerProps {
  onReconnect?: () => void;
}

export function ReconnectBanner({ onReconnect }: ReconnectBannerProps) {
  return (
    <div className="reconnect-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <AlertTriangle size={20} color="var(--color-alarm)" />
        <span className="reconnect-banner-text">
          Google Classroom access has expired or was revoked. Your existing data is still saved, but new assignments won&apos;t sync until you reconnect.
        </span>
      </div>
      <GhostPill
        href="/api/auth/google"
        size="sm"
        variant="alarm"
        onClick={onReconnect}
      >
        Reconnect Google Classroom
      </GhostPill>
    </div>
  );
}

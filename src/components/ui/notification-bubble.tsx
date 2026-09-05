'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import gsap from 'gsap';

interface NotificationBubbleProps {
  message: string;
  onDismiss: () => void;
  /** Auto-dismiss after ms (default 5000, 0 = no auto-dismiss) */
  duration?: number;
}

export function NotificationBubble({ message, onDismiss, duration = 5000 }: NotificationBubbleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);

  const animateDismiss = useCallback(() => {
    if (dismissed || !ref.current) return;
    setDismissed(true);
    gsap.to(ref.current, {
      opacity: 0,
      y: 14,
      scale: 0.95,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: onDismiss,
    });
  }, [dismissed, onDismiss]);

  // Entry animation
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 14, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power2.out' }
    );
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(animateDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, animateDismiss]);

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 2000,
        background: 'var(--color-panel)',
        border: '1px solid var(--color-course-1)',
        color: 'var(--color-text-primary)',
        borderRadius: '100px',
        padding: '12px 20px 12px 24px',
        fontSize: '13px',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '480px',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button
        type="button"
        onClick={animateDismiss}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          padding: '2px',
          borderRadius: '50%',
          transition: 'color 0.12s ease',
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

'use client';

import React, { useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { ArrowUpRight } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, MorphSVGPlugin);
}

interface SimulatorState {
  id: string;
  title: string;
  sub: string;
  badge: string;
  accent: string;
  discordTitle: string;
  discordDesc: string;
  discordTime: string;
  path: string;
}

const SIMULATOR_STATES: SimulatorState[] = [
  {
    id: 'created',
    title: 'Work Published',
    sub: 'Instant Google Cloud webhook',
    badge: 'Pub/Sub Push · 340ms',
    accent: 'var(--color-course-1)',
    discordTitle: '[NEW WORK] Chapter 8: Fluid Dynamics',
    discordDesc: 'Assigned in AP Physics C · Due Friday at 11:59 PM',
    discordTime: 'Just now',
    path: 'M26,14 L58,14 L74,30 L74,86 L26,86 Z',
  },
  {
    id: 'reminder',
    title: '24-Hour Reminder',
    sub: 'Automated daily sweep',
    badge: 'Approaching Deadline',
    accent: 'var(--color-course-5)',
    discordTitle: '[24H WARNING] Problem Set 5: Vector Calculus',
    discordDesc: 'Assigned in Multivariable Calc · Due Tomorrow at 11:59 PM',
    discordTime: '1 day left',
    path: 'M50,14 L86,50 L50,86 L14,50 Z',
  },
  {
    id: 'urgent',
    title: 'Urgent Alert',
    sub: 'Under 1 hour remaining',
    badge: 'Immediate Action Required',
    accent: 'var(--color-alarm)',
    discordTitle: '[URGENT] Final Draft: Comparative Literature Essay',
    discordDesc: 'Assigned in World Lit · Due in 45 minutes',
    discordTime: '45m remaining',
    path: 'M50,14 C38,14 30,22 30,34 C30,50 18,58 18,70 L82,70 C82,58 70,50 70,34 C70,22 62,14 50,14 Z',
  },
];

export function MorphSimulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const switchState = useCallback((idx: number) => {
    setActiveIdx(idx);
    const target = SIMULATOR_STATES[idx];

    if (pathRef.current) {
      gsap.to(pathRef.current, {
        morphSVG: target.path,
        stroke: target.accent,
        duration: 0.24,
        ease: 'power2.out',
      });
    }

    if (previewCardRef.current) {
      gsap.fromTo(
        previewCardRef.current,
        { opacity: 0.7, y: 3 },
        { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }
      );
    }
  }, []);

  const active = SIMULATOR_STATES[activeIdx];

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: 'var(--color-panel)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-panel)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Interactive Vector Signal
          </span>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>
            Simulate an Incoming Discord Notification
          </span>
        </div>

        {/* State Selector Buttons — Accessible 44px Touch Targets */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SIMULATOR_STATES.map((s, idx) => {
            const isSelected = idx === activeIdx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => switchState(idx)}
                style={{
                  minHeight: '44px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${isSelected ? s.accent : 'var(--color-hairline)'}`,
                  backgroundColor: isSelected ? 'var(--color-bg)' : 'transparent',
                  color: isSelected ? s.accent : 'var(--color-text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.15s ease, color 0.15s ease, transform 0.1s ease',
                  willChange: 'transform',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {s.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Simulator Display: Central Morphing Vector + Discord Embed Preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: '20px',
          alignItems: 'center',
        }}
      >
        {/* Central Morphing Vector Canvas */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-panel)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            minHeight: '160px',
          }}
        >
          <svg
            viewBox="0 0 100 100"
            style={{
              width: '64px',
              height: '64px',
              overflow: 'visible',
            }}
          >
            <path
              ref={pathRef}
              d={SIMULATOR_STATES[0].path}
              fill="none"
              stroke={SIMULATOR_STATES[0].accent}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-primary)',
              color: active.accent,
              letterSpacing: '0.04em',
            }}
          >
            {active.badge}
          </span>
        </div>

        {/* Realistic Discord Embed Preview — theme-aware via CSS vars */}
        <div
          ref={previewCardRef}
          style={{
            backgroundColor: 'var(--color-panel)',
            border: '1px solid var(--color-hairline)',
            borderLeft: `4px solid ${active.accent}`,
            borderRadius: '4px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Aulert Bot</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{active.discordTime}</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
            {active.discordTitle}
          </span>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
            {active.discordDesc}
          </p>
          <div style={{ paddingTop: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-hairline)',
                padding: '4px 10px',
                borderRadius: '3px',
                color: 'var(--color-course-4)',
                fontWeight: 500,
              }}
            >
              Open in Google Classroom
              <ArrowUpRight size={12} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

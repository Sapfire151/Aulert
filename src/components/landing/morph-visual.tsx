'use client';

import React, { useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, MorphSVGPlugin);
}

const STAGES = [
  {
    id: 'detection',
    tag: 'Step 1',
    label: 'Classroom Post',
    description: 'Real-time detection of course work & announcements',
    accent: 'var(--color-course-5)',
    path: 'M28,16 L56,16 L72,32 L72,84 L28,84 Z',
  },
  {
    id: 'ingest',
    tag: 'Step 2',
    label: 'Pub/Sub Ingestion',
    description: 'Sub-400ms payload ingestion via Google Cloud push',
    accent: 'var(--color-course-1)',
    path: 'M50,14 L80,31 L80,69 L50,86 L20,69 L20,31 Z',
  },
  {
    id: 'dispatch',
    tag: 'Step 3',
    label: 'Discord Dispatch',
    description: 'Actionable embed with relative countdown timer',
    accent: 'var(--color-alarm)',
    path: 'M50,14 C38,14 30,22 30,34 C30,50 18,58 18,70 L82,70 C82,58 70,50 70,34 C70,22 62,14 50,14 Z',
  },
  {
    id: 'vault',
    tag: 'Step 4',
    label: 'Vault & Calendar',
    description: 'PDPA-compliant sync & color-coded agenda timeline',
    accent: 'var(--color-course-4)',
    path: 'M50,14 L82,26 C82,58 50,86 50,86 C50,86 18,58 18,26 Z',
  },
];

export function MorphVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const morphToStage = useCallback((index: number) => {
    if (!pathRef.current) return;
    const target = STAGES[index];
    setActiveStage(index);

    // Pause auto-rotation when user manually interacts
    if (timelineRef.current) {
      timelineRef.current.pause();
    }

    gsap.to(pathRef.current, {
      morphSVG: target.path,
      stroke: target.accent,
      duration: 0.28,
      ease: 'power2.out',
    });
  }, []);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion || !pathRef.current) return;

      const tl = gsap.timeline({
        repeat: -1,
        defaults: { ease: 'power2.inOut', duration: 1.1 },
      });

      STAGES.forEach((stage, idx) => {
        const nextIdx = (idx + 1) % STAGES.length;
        tl.to(pathRef.current, {
          morphSVG: STAGES[nextIdx].path,
          stroke: STAGES[nextIdx].accent,
          delay: 2.0,
          onStart: () => setActiveStage(nextIdx),
        });
      });

      timelineRef.current = tl;
    },
    { scope: containerRef }
  );

  const currentStage = STAGES[activeStage];

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
        alignItems: 'center',
        gap: '20px',
        minWidth: 0,
        maxWidth: '340px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Morphing Canvas */}
      <div
        style={{
          width: '120px',
          height: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          {/* Subtle guide ring */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.3"
          />

          {/* GSAP Morphing Vector Path */}
          <path
            ref={pathRef}
            d={STAGES[0].path}
            fill="none"
            stroke={STAGES[0].accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Stage Description */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: currentStage.accent,
            fontWeight: 600,
          }}
        >
          {currentStage.tag}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>{currentStage.label}</div>
        <p className="body-ui text-muted" style={{ fontSize: '12px', minHeight: '34px', lineHeight: 1.4 }}>
          {currentStage.description}
        </p>
      </div>

      {/* Interactive Stage Dots with Accessible 44px Touch Targets */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
        {STAGES.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => morphToStage(idx)}
            aria-label={`Morph to ${s.label}`}
            style={{
              width: '44px',
              height: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span
              style={{
                width: idx === activeStage ? '20px' : '7px',
                height: '7px',
                borderRadius: '4px',
                backgroundColor: idx === activeStage ? s.accent : 'var(--color-hairline)',
                transition: 'background-color 0.2s var(--ease-standard), width 0.2s var(--ease-standard)',
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

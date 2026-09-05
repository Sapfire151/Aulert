'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, MorphSVGPlugin, ScrollTrigger);
}

interface JourneyMorphNodeProps {
  stepNumber: string;
  accent: string;
  targetPath: string;
  initialPath?: string;
}

const DEFAULT_CIRCLE_PATH =
  'M50,18 C67.67,18 82,32.33 82,50 C82,67.67 67.67,82 50,82 C32.33,82 18,67.67 18,50 C18,32.33 32.33,18 50,18 Z';

export function JourneyMorphNode({
  stepNumber,
  accent,
  targetPath,
  initialPath = DEFAULT_CIRCLE_PATH,
}: JourneyMorphNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion || !pathRef.current || !nodeRef.current) return;

      const raf = requestAnimationFrame(() => {
        if (!pathRef.current || !nodeRef.current) return;
        gsap.to(pathRef.current, {
          morphSVG: targetPath,
          stroke: accent,
          duration: 0.35,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: nodeRef.current,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
            fastScrollEnd: true,
          },
        });
      });

      return () => cancelAnimationFrame(raf);
    },
    { scope: nodeRef }
  );

  return (
    <div
      ref={nodeRef}
      className="journey-node"
      style={{
        position: 'relative',
        width: '56px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{
          width: '38px',
          height: '38px',
          overflow: 'visible',
        }}
      >
        <path
          ref={pathRef}
          d={initialPath}
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          fontSize: '11px',
          fontWeight: 700,
          color: accent,
          fontFamily: 'var(--font-primary)',
        }}
      >
        {stepNumber}
      </span>
    </div>
  );
}

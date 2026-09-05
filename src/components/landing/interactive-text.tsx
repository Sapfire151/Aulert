'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrambleTextPlugin);
}

interface InteractiveTextProps {
  children: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'p';
  className?: string;
  style?: React.CSSProperties;
  accentHover?: string;
}

export function InteractiveText({
  children,
  as = 'span',
  className = '',
  style = {},
  accentHover,
}: InteractiveTextProps) {
  const textRef = useRef<HTMLElement>(null);
  const isAnimating = useRef(false);

  const handleMouseEnter = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !textRef.current || isAnimating.current) return;

    isAnimating.current = true;

    gsap.to(textRef.current, {
      duration: 0.32,
      scrambleText: {
        text: children,
        chars: '!<>-_\\/[]{}—=+*^?#01',
        speed: 0.4,
      },
      ease: 'power2.out',
      onComplete: () => {
        isAnimating.current = false;
      },
    });

    if (accentHover) {
      gsap.to(textRef.current, {
        color: accentHover,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: 'power1.out',
      });
    }
  };

  const Component = as as any;

  return (
    <Component
      ref={textRef}
      onMouseEnter={handleMouseEnter}
      className={`interactive-gsap-text ${className}`}
      style={{
        cursor: 'default',
        transition: 'color 0.15s ease',
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

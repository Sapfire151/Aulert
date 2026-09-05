'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export function GeometryIllustration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<SVGGElement>(null);
  const ring2Ref = useRef<SVGGElement>(null);
  const ring3Ref = useRef<SVGGElement>(null);
  const polyhedronRef = useRef<SVGGElement>(null);
  const nodesRef = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) return;

      // Smooth continuous rotational orbits for geometric rings
      if (ring1Ref.current) {
        gsap.to(ring1Ref.current, {
          rotation: 360,
          transformOrigin: '150px 150px',
          duration: 32,
          repeat: -1,
          ease: 'none',
        });
      }

      if (ring2Ref.current) {
        gsap.to(ring2Ref.current, {
          rotation: -360,
          transformOrigin: '150px 150px',
          duration: 24,
          repeat: -1,
          ease: 'none',
        });
      }

      if (ring3Ref.current) {
        gsap.to(ring3Ref.current, {
          rotation: 360,
          transformOrigin: '150px 150px',
          duration: 18,
          repeat: -1,
          ease: 'none',
        });
      }

      // Floating gentle breathing motion on central polyhedron
      if (polyhedronRef.current) {
        gsap.to(polyhedronRef.current, {
          y: -6,
          duration: 2.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // Staggered pulsing on orbital vertex nodes
      if (nodesRef.current) {
        gsap.to(nodesRef.current.children, {
          scale: 1.25,
          transformOrigin: 'center center',
          stagger: {
            each: 0.25,
            repeat: -1,
            yoyo: true,
          },
          duration: 1.6,
          ease: 'power1.inOut',
        });
      }
    },
    { scope: containerRef }
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    if (polyhedronRef.current) {
      gsap.to(polyhedronRef.current, {
        x: x * 18,
        y: y * 18,
        duration: 0.4,
        ease: 'power2.out',
      });
    }

    if (ring1Ref.current) {
      gsap.to(ring1Ref.current, {
        x: x * 10,
        y: y * 10,
        duration: 0.5,
        ease: 'power2.out',
      });
    }
  };

  const handleMouseLeave = () => {
    if (polyhedronRef.current) {
      gsap.to(polyhedronRef.current, { x: 0, y: 0, duration: 0.6, ease: 'power2.out' });
    }
    if (ring1Ref.current) {
      gsap.to(ring1Ref.current, { x: 0, y: 0, duration: 0.6, ease: 'power2.out' });
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width: '100%',
        maxWidth: '340px',
        height: '320px',
        backgroundColor: 'var(--color-panel)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-panel)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.4), 0 0 24px rgba(0, 212, 255, 0.1)',
      }}
    >
      {/* Background Radial Glow */}
      <div
        style={{
          position: 'absolute',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 212, 255, 0.18) 0%, rgba(168, 85, 247, 0.12) 50%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <svg
        viewBox="0 0 300 300"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        <defs>
          <linearGradient id="geom-grad-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-course-4)" />
            <stop offset="100%" stopColor="var(--color-course-3)" />
          </linearGradient>
          <linearGradient id="geom-grad-neon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-course-1)" />
            <stop offset="100%" stopColor="var(--color-course-4)" />
          </linearGradient>
          <linearGradient id="geom-grad-pink" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-course-2)" />
            <stop offset="100%" stopColor="var(--color-alarm)" />
          </linearGradient>
        </defs>

        {/* Outer Orbital Ring 1 */}
        <g ref={ring1Ref}>
          <circle
            cx="150"
            cy="150"
            r="120"
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth="1"
            strokeDasharray="4 6"
            opacity="0.5"
          />
          <circle cx="270" cy="150" r="4" fill="var(--color-course-4)" />
          <circle cx="30" cy="150" r="3" fill="var(--color-course-1)" />
        </g>

        {/* Mid Elliptical Orbital Ring 2 */}
        <g ref={ring2Ref}>
          <ellipse
            cx="150"
            cy="150"
            rx="96"
            ry="68"
            fill="none"
            stroke="url(#geom-grad-cyan)"
            strokeWidth="1.5"
            strokeDasharray="2 4"
            opacity="0.7"
          />
          <circle cx="246" cy="150" r="3.5" fill="var(--color-course-3)" />
          <circle cx="54" cy="150" r="3.5" fill="var(--color-course-2)" />
        </g>

        {/* Inner Counter-Rotating Ring 3 */}
        <g ref={ring3Ref}>
          <circle
            cx="150"
            cy="150"
            r="70"
            fill="none"
            stroke="url(#geom-grad-neon)"
            strokeWidth="1"
            opacity="0.8"
          />
        </g>

        {/* Central Wireframe Polyhedron Geometry */}
        <g ref={polyhedronRef}>
          {/* Outer Octahedral Facets */}
          <polygon
            points="150,55 220,110 220,190 150,245 80,190 80,110"
            fill="rgba(19, 23, 34, 0.45)"
            stroke="url(#geom-grad-cyan)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Internal Wireframe Edges */}
          <line x1="150" y1="55" x2="150" y2="245" stroke="var(--color-course-4)" strokeWidth="1.2" opacity="0.65" />
          <line x1="80" y1="110" x2="220" y2="190" stroke="var(--color-course-3)" strokeWidth="1.2" opacity="0.65" />
          <line x1="80" y1="190" x2="220" y2="110" stroke="var(--color-course-1)" strokeWidth="1.2" opacity="0.65" />

          {/* Inner Inverted Diamond Core */}
          <polygon
            points="150,95 190,150 150,205 110,150"
            fill="rgba(0, 212, 255, 0.08)"
            stroke="url(#geom-grad-pink)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Core Center Pulse Node */}
          <circle cx="150" cy="150" r="7" fill="var(--color-course-1)" />
          <circle cx="150" cy="150" r="14" fill="none" stroke="var(--color-course-1)" strokeWidth="1" opacity="0.5" />
        </g>

        {/* Pulsing Vertex Nodes */}
        <g ref={nodesRef}>
          <circle cx="150" cy="55" r="4.5" fill="var(--color-course-4)" />
          <circle cx="220" cy="110" r="4.5" fill="var(--color-course-3)" />
          <circle cx="220" cy="190" r="4.5" fill="var(--color-course-2)" />
          <circle cx="150" cy="245" r="4.5" fill="var(--color-course-1)" />
          <circle cx="80" cy="190" r="4.5" fill="var(--color-course-5)" />
          <circle cx="80" cy="110" r="4.5" fill="var(--color-course-4)" />
        </g>
      </svg>

      {/* Label Ribbon */}
      <div
        style={{
          position: 'absolute',
          bottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-course-4)',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-course-1)',
            boxShadow: '0 0 8px var(--color-course-1)',
          }}
        />
        GSAP Geometry Engine
      </div>
    </div>
  );
}

'use client';

import React, { useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { GhostPill } from '@/components/ui/ghost-pill';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { GoogleIcon } from '@/components/ui/google-icon';
import { MorphVisual } from '@/components/landing/morph-visual';
import { JourneyMorphNode } from '@/components/landing/journey-morph-node';
import {
  Calendar,
  MessageSquare,
  ArrowRight,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Dynamically import below-the-fold simulator to eliminate render-blocking JS chunks
const MorphSimulator = dynamic(
  () => import('@/components/landing/morph-simulator').then((mod) => mod.MorphSimulator),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight: '220px',
          backgroundColor: 'var(--color-panel)',
          borderRadius: 'var(--radius-panel)',
          border: '1px solid var(--color-hairline)',
        }}
      />
    ),
  }
);

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

// Milestone SVG Morph Target Paths
const STEP_PATHS = {
  ingest: 'M50,14 L80,31 L80,69 L50,86 L20,69 L20,31 Z', // Hexagon node
  filter: 'M50,14 L86,50 L50,86 L14,50 Z', // Diamond filter
  bell: 'M50,14 C38,14 30,22 30,34 C30,50 18,58 18,70 L82,70 C82,58 70,50 70,34 C70,22 62,14 50,14 Z', // Bell
  shield: 'M50,14 L82,26 C82,58 50,86 50,86 C50,86 18,58 18,26 Z', // Shield
};

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      ScrollTrigger.config({
        limitCallbacks: true,
        autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load',
      });

      // Keep LCP element visible in the initial render tree — animate transform without hiding text
      gsap.from('.hero-headline', { y: 12, duration: 0.4, ease: 'power2.out' });
      gsap.from('.hero-cta-group', { opacity: 0, y: 8, duration: 0.35, delay: 0.08, ease: 'power2.out' });

      // Defer below-the-fold ScrollTrigger layout measurements after paint to avoid forced reflows
      const raf = requestAnimationFrame(() => {
        // ── Pipeline Section: Eyebrow + Heading batched ─────────────
        gsap.from('#pipeline .section-eyebrow, #pipeline .section-heading-anim', {
          opacity: 0, y: 14, stagger: 0.08, duration: 0.35, ease: 'power2.out',
          scrollTrigger: { trigger: '#pipeline', start: 'top 85%', toggleActions: 'play none none reverse' },
        });

        // ── Journey progress line scrub ─────────────────────────────
        gsap.to('.journey-progress-line', {
          scaleY: 1, ease: 'none',
          scrollTrigger: {
            trigger: '.journey-container',
            start: 'top 75%', end: 'bottom 80%',
            scrub: 0.4,
          },
        });

        // ── Journey steps batched entrance ──────────────────────────
        gsap.from('.journey-step', {
          opacity: 0, y: 20, stagger: 0.12, duration: 0.38, ease: 'power2.out',
          scrollTrigger: { trigger: '.journey-container', start: 'top 80%', toggleActions: 'play none none reverse' },
        });

        // ── Comparison section batched ──────────────────────────────
        gsap.from('#comparison .section-eyebrow, #comparison .section-heading-anim', {
          opacity: 0, y: 14, stagger: 0.08, duration: 0.35, ease: 'power2.out',
          scrollTrigger: { trigger: '#comparison', start: 'top 85%', toggleActions: 'play none none reverse' },
        });

        gsap.from('.comparison-card', {
          opacity: 0, y: 20, stagger: 0.14, duration: 0.38, ease: 'power2.out',
          scrollTrigger: { trigger: '.comparison-container', start: 'top 82%', toggleActions: 'play none none reverse' },
        });

        // ── Capabilities section batched ────────────────────────────
        gsap.from('#capabilities .section-eyebrow, #capabilities .section-heading-anim', {
          opacity: 0, y: 14, stagger: 0.08, duration: 0.35, ease: 'power2.out',
          scrollTrigger: { trigger: '#capabilities', start: 'top 85%', toggleActions: 'play none none reverse' },
        });

        gsap.from('.feature-card', {
          opacity: 0, y: 18, scale: 0.98, stagger: 0.08, duration: 0.35, ease: 'power2.out',
          scrollTrigger: { trigger: '.feature-grid', start: 'top 84%', toggleActions: 'play none none reverse' },
        });

        // ── Simulator reveal ────────────────────────────────────────
        gsap.from('.simulator-wrap', {
          opacity: 0, y: 18, duration: 0.4, ease: 'power2.out',
          scrollTrigger: { trigger: '.simulator-wrap', start: 'top 88%', toggleActions: 'play none none reverse' },
        });

        // ── CTA section ──────────────────────────────────────────────
        gsap.from('.cta-section', {
          opacity: 0, scale: 0.98, duration: 0.4, ease: 'back.out(1.2)',
          scrollTrigger: { trigger: '.cta-section', start: 'top 86%', toggleActions: 'play none none reverse' },
        });

        // ── Footer links ────────────────────────────────────────────
        gsap.from('.footer-anim', {
          opacity: 0, y: 8, stagger: 0.06, duration: 0.28, ease: 'power2.out',
          scrollTrigger: { trigger: '.footer-anim', start: 'top 96%', toggleActions: 'play none none none' },
        });
      });

      return () => cancelAnimationFrame(raf);
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
      }}
    >
      {/* 1. Header (Stationary topbar matching exact 72px height, placement, and sizing across every page) */}
      <header
        className="app-header"
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          height: '72px',
          minHeight: '72px',
          boxSizing: 'border-box',
          backgroundColor: 'var(--color-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            width: '100%',
            height: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.3px',
              color: 'var(--color-text-primary)',
            }}
          >
            Aulert
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Landing Content with Accessibility Landmark */}
      <main
        id="main-content"
        className="landing-content"
      >

      {/* 2. Hero Section */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '48px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              maxWidth: '620px',
            }}
          >
            <h1
              className="hero-headline hero-main-title"
              style={{ lineHeight: 1.12, letterSpacing: '-0.025em' }}
            >
              Never miss a Google Classroom deadline again.
            </h1>

            <p
              className="body-ui text-muted"
              style={{ fontSize: '18px', lineHeight: 1.6, maxWidth: '560px' }}
            >
              Aulert converts scattered classroom announcements into a single visual calendar and
              delivers instant, actionable alerts straight to your Discord server or DMs.
            </p>

            <div
              className="hero-cta-group"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <GhostPill href="/api/auth/google" size="md" variant="google">
                <GoogleIcon size={16} />
                Continue with Google
                <ArrowRight size={16} />
              </GhostPill>
              <GhostPill href="/dashboard" variant="muted" size="md">
                Preview mode
              </GhostPill>
            </div>
          </div>

          <div style={{ flexShrink: 0, margin: '0 auto' }}>
            <MorphVisual />
          </div>
        </div>

        {/* Interactive Morph Simulator (dynamically loaded) */}
        <div className="simulator-wrap">
          <MorphSimulator />
        </div>
      </section>

      {/* 3. Connected Animated Journey with GSAP Morph Nodes */}
      <section
        id="pipeline"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '840px' }}>
          <span
            className="section-eyebrow"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-course-1)',
            }}
          >
            Connected Architecture
          </span>
          <h2 className="section-heading-anim single-line-heading" style={{ fontSize: 'clamp(22px, 4vw, 34px)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            From Teacher Post to Discord Ping in 4 Steps
          </h2>
          <p className="body-ui text-muted" style={{ fontSize: '15px', lineHeight: 1.6 }}>
            Follow the automated lifecycle of an assignment as it travels through Google Cloud Pub/Sub,
            taxonomy filtering, Discord dispatch, and encrypted vault storage.
          </p>
        </div>

        {/* Connected Vertical Timeline */}
        <div className="journey-container">
          <div className="journey-track-line" />
          <div className="journey-progress-line" />

          {/* Step 1: Ingestion */}
          <div className="journey-step">
            <JourneyMorphNode
              stepNumber="01"
              accent="var(--color-course-1)"
              targetPath={STEP_PATHS.ingest}
            />
            <div className="journey-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-course-1)', letterSpacing: '0.05em' }}>
                  Step 01 · Ingestion
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Google Cloud Pub/Sub
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
                Instant Push Event Detection
              </h3>
              <p className="body-ui text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
                The exact second work is published, Google Classroom dispatches an asynchronous push
                payload directly to our edge worker. Zero client polling, zero battery drain.
              </p>
            </div>
          </div>

          {/* Step 2: Taxonomy Engine */}
          <div className="journey-step">
            <JourneyMorphNode
              stepNumber="02"
              accent="var(--color-course-2)"
              targetPath={STEP_PATHS.filter}
            />
            <div className="journey-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-course-2)', letterSpacing: '0.05em' }}>
                  Step 02 · Normalization
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Taxonomy Engine
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
                Deduplication & Color-Coded Taxonomy
              </h3>
              <p className="body-ui text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
                Course titles are normalized into clean subjects, duplicate teacher edits are discarded,
                and timezones are automatically aligned to your local schedule.
              </p>
            </div>
          </div>

          {/* Step 3: Discord Dispatch */}
          <div className="journey-step">
            <JourneyMorphNode
              stepNumber="03"
              accent="var(--color-alarm)"
              targetPath={STEP_PATHS.bell}
            />
            <div className="journey-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-alarm)', letterSpacing: '0.05em' }}>
                  Step 03 · Dispatch
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Webhook Sync
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
                Precision Discord Pings with Deep Links
              </h3>
              <p className="body-ui text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
                Sends a rich embed with dynamic countdown timers (e.g. <i>Due in 3 hours</i>) and a single-click
                direct deep-link to the exact submission page in Google Classroom.
              </p>
            </div>
          </div>

          {/* Step 4: Security & Vault */}
          <div className="journey-step">
            <JourneyMorphNode
              stepNumber="04"
              accent="var(--color-course-4)"
              targetPath={STEP_PATHS.shield}
            />
            <div className="journey-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-course-4)', letterSpacing: '0.05em' }}>
                  Step 04 · Security
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Thailand PDPA Compliant
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
                Supabase Vault & Read-Only Scopes
              </h3>
              <p className="body-ui text-muted" style={{ fontSize: '14px', lineHeight: 1.6 }}>
                Institutional credentials are never exposed. Google OAuth tokens are isolated with AES-GCM-256
                encryption, with zero retention of student files or grades.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Comparison Section */}
      <section
        id="comparison"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '680px' }}>
          <span
            className="section-eyebrow"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-alarm)',
            }}
          >
            The Difference
          </span>
          <h2 className="section-heading-anim" style={{ fontSize: 'clamp(22px, 4vw, 34px)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Why Students Rely on Aulert
          </h2>
          <p className="body-ui text-muted" style={{ fontSize: '15px', lineHeight: 1.6 }}>
            Eliminate stream fatigue and replace manual tab refreshes with automated peace of mind.
          </p>
        </div>

        <div className="comparison-container">
          {/* Without Aulert */}
          <div className="comparison-card">
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--color-alarm)',
                letterSpacing: '0.05em',
              }}
            >
              Google Classroom Alone
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
              Fragmented Stream Noise
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <XCircle size={16} color="var(--color-alarm)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  Assignments drowned beneath stream announcements and comments
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <XCircle size={16} color="var(--color-alarm)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  Notification emails easily missed or caught in spam filters
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <XCircle size={16} color="var(--color-alarm)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  No relative countdown timer before 11:59 PM deadlines
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <XCircle size={16} color="var(--color-alarm)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  Constantly opening multiple course tabs to verify pending work
                </span>
              </div>
            </div>
          </div>

          {/* With Aulert */}
          <div className="comparison-card highlight-card">
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--color-course-1)',
                letterSpacing: '0.05em',
              }}
            >
              Aulert + Discord
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
              Unified, Automated Delivery
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={16} color="var(--color-course-1)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="body-ui" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  Instant Discord channel or DM ping the exact moment work is assigned
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={16} color="var(--color-course-1)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="body-ui" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  Single-pane interactive calendar with month, week, and agenda modes
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={16} color="var(--color-course-1)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="body-ui" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  Actionable embeds with direct deep-links straight into the assignment
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={16} color="var(--color-course-1)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span className="body-ui" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  Automated 24h reminders and overdue warnings for peace of mind
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Core Capabilities */}
      <section
        id="capabilities"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span
            className="section-eyebrow"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-course-3)',
            }}
          >
            Capabilities
          </span>
          <h2 className="section-heading-anim" style={{ fontSize: 'clamp(20px, 3.5vw, 30px)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Engineered for Everyday Student Workflows
          </h2>
        </div>

        <div
          className="feature-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          <div className="pillar-card feature-card">
            <Calendar size={20} color="var(--color-course-1)" />
            <h3 className="body-emphasis" style={{ fontSize: '15px' }}>
              Multi-View Calendar
            </h3>
            <p className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
              Month, Week, and Agenda views with one-click filtering by course taxonomy.
            </p>
          </div>

          <div className="pillar-card feature-card">
            <MessageSquare size={20} color="var(--color-alarm)" />
            <h3 className="body-emphasis" style={{ fontSize: '15px' }}>
              Custom Discord Webhooks
            </h3>
            <p className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
              Route alerts to your private server or study channels with built-in live ping tests.
            </p>
          </div>

          <div className="pillar-card feature-card">
            <Clock size={20} color="var(--color-course-3)" />
            <h3 className="body-emphasis hero-title-clamp" style={{ fontSize: '15px', whiteSpace: 'nowrap' }}>
              Urgency Tiers
            </h3>
            <p className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
              Sub-24h countdowns trigger high-contrast alarm badges for urgent tasks.
            </p>
          </div>

          <div className="pillar-card feature-card">
            <ShieldCheck size={20} color="var(--color-course-4)" />
            <h3 className="body-emphasis hero-title-clamp" style={{ fontSize: '15px', whiteSpace: 'nowrap' }}>
              School IT Help
            </h3>
            <p className="body-ui text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
              Pre-written unblock requests and whitelist guidelines for restricted school networks.
            </p>
          </div>
        </div>
      </section>

      {/* 6. High-Conversion CTA */}
      <section
        className="cta-section"
        style={{
          backgroundColor: 'var(--color-panel)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-panel)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '20px',
          padding: 'clamp(44px, 7vw, 80px) clamp(20px, 4vw, 48px)',
        }}
      >
        <h2 style={{ fontSize: 'clamp(24px, 4.5vw, 36px)', lineHeight: 1.2, maxWidth: '580px', letterSpacing: '-0.02em' }}>
          Take control of your deadlines.
        </h2>

        <p className="body-ui text-muted single-line-sub" style={{ fontSize: '15px', lineHeight: 1.6 }}>
          Sync your Google Classroom schedule in seconds. No passwords required.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <GhostPill href="/api/auth/google" size="md" variant="google">
            <GoogleIcon size={16} />
            Continue with Google
            <ArrowRight size={16} />
          </GhostPill>
          <GhostPill href="/dashboard" variant="muted" size="md">
            Preview mode
          </GhostPill>
        </div>
      </section>

      {/* 7. Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--color-hairline)',
          paddingTop: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <span className="footer-anim body-ui text-muted" style={{ fontSize: '13px' }}>
          © {new Date().getFullYear()} Aulert. Built for students under Thailand PDPA.
        </span>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <Link href="/privacy" className="footer-anim nav-link" style={{ fontSize: '13px' }}>
            Privacy Policy
          </Link>
          <Link href="/terms" className="footer-anim nav-link" style={{ fontSize: '13px' }}>
            Terms of Service
          </Link>
          <Link href="/auth/school-blocked" className="footer-anim nav-link" style={{ fontSize: '13px' }}>
            School IT Help
          </Link>
        </div>
      </footer>
      </main>
    </div>
  );
}

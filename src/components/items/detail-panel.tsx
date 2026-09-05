'use client';

import React, { useRef } from 'react';
import { ExternalLink, X, Trash2, CheckCircle, Circle, Edit2 } from 'lucide-react';
import { UnifiedItem } from '@/types/aulert';
import { GhostPill } from '../ui/ghost-pill';
import { formatDueDateDisplay } from '@/lib/date-utils';
import { getCourseColorClass } from '@/lib/course-colors';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface DetailPanelProps {
  item: UnifiedItem | null;
  timeZone: string;
  onClose: () => void;
  onToggleComplete?: (item: UnifiedItem) => void;
  onEditHomework?: (item: UnifiedItem) => void;
  onDeleteHomework?: (item: UnifiedItem) => void;
}

export function DetailPanel({
  item,
  timeZone,
  onClose,
  onToggleComplete,
  onEditHomework,
  onDeleteHomework,
}: DetailPanelProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      if (overlayRef.current && contentRef.current) {
        gsap.fromTo(
          overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.2, ease: 'power2.out' }
        );
        gsap.fromTo(
          contentRef.current,
          { opacity: 0, scale: 0.96, y: 10 },
          { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power2.out' }
        );
      }
    },
    { dependencies: [item?.id], scope: overlayRef }
  );

  if (!item) return null;

  const isClassroom = item.source === 'classroom';
  const colorClass = getCourseColorClass(item.courseColor);
  const formattedDue = formatDueDateDisplay(item.dueAt, timeZone);

  return (
    <div ref={overlayRef} className="panel-overlay" onClick={onClose}>
      <div ref={contentRef} className="panel-content" onClick={(e) => e.stopPropagation()}>
        {/* Header with Title and Close Button */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h2 className="section-header" style={{ fontSize: '20px' }}>
              {item.title}
            </h2>
            {/* Source indication only surfaced inside detail panel per PRD/Design Rules */}
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Source: {isClassroom ? 'Google Classroom (Synced, Read-Only)' : 'Custom Homework (Self-Created)'}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close detail panel"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Course & Due Date Metadata */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-hairline)',
          }}
        >
          {item.courseName && (
            <span className={`body-emphasis ${colorClass}`} style={{ fontSize: '13px' }}>
              {item.courseName}
            </span>
          )}
          <span
            className="body-ui"
            style={{
              fontSize: '13px',
              color: item.isOverdue && !item.completed ? 'var(--color-alarm)' : 'var(--color-text-muted)',
            }}
          >
            {formattedDue}
          </span>
          {isClassroom && (
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
              Status: <strong style={{ color: 'var(--color-text-primary)' }}>{item.rawStatus}</strong>
            </span>
          )}
        </div>

        {/* Description or Notes */}
        <div style={{ minHeight: '80px' }}>
          {item.description ? (
            <p className="body-ui" style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-primary)' }}>
              {item.description}
            </p>
          ) : (
            <p className="body-ui" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No notes or description provided.
            </p>
          )}
        </div>

        {/* Action Controls (Ghost-pills only) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-hairline)',
          }}
        >
          {isClassroom ? (
            item.link ? (
              <GhostPill href={item.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} />
                Open in Classroom
              </GhostPill>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Direct Classroom link unavailable
              </span>
            )
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onToggleComplete && (
                  <GhostPill
                    variant={item.completed ? 'muted' : 'default'}
                    onClick={() => onToggleComplete(item)}
                  >
                    {item.completed ? (
                      <>
                        <Circle size={14} />
                        Mark Incomplete
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} />
                        Mark Complete
                      </>
                    )}
                  </GhostPill>
                )}

                {onEditHomework && (
                  <GhostPill variant="muted" onClick={() => onEditHomework(item)}>
                    <Edit2 size={14} />
                    Edit
                  </GhostPill>
                )}
              </div>

              {onDeleteHomework && (
                <GhostPill variant="alarm" onClick={() => onDeleteHomework(item)}>
                  <Trash2 size={14} />
                  Delete
                </GhostPill>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


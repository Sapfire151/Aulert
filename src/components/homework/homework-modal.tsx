'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { GhostPill } from '../ui/ghost-pill';
import { CustomDropdown } from '../ui/custom-dropdown';
import { DateTimePicker } from '../ui/date-time-picker';
import { CourseRow } from '@/types/database';
import { UnifiedItem } from '@/types/aulert';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface HomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    title: string;
    courseId: string | null;
    dueAt: string | null;
    notes: string | null;
  }) => Promise<void>;
  courses: CourseRow[];
  initialItem?: UnifiedItem | null;
}

export function HomeworkModal({
  isOpen,
  onClose,
  onSave,
  courses,
  initialItem,
}: HomeworkModalProps) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<string>('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const animateClose = useCallback((cb: () => void) => {
    if (overlayRef.current && contentRef.current) {
      gsap.to(contentRef.current, { opacity: 0, scale: 0.96, y: 10, duration: 0.18, ease: 'power2.in' });
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: cb });
    } else {
      cb();
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    animateClose(onClose);
  }, [isClosing, animateClose, onClose]);

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
    { dependencies: [isOpen], scope: overlayRef }
  );

  useEffect(() => {
    if (initialItem) {
      setTitle(initialItem.title);
      setCourseId(initialItem.courseId || '');
      if (initialItem.dueAt) {
        // Convert ISO string to format suitable for datetime-local input
        const d = new Date(initialItem.dueAt);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setDueAt(formatted);
      } else {
        setDueAt('');
      }
      setNotes(initialItem.description || '');
    } else {
      setTitle('');
      setCourseId('');
      setDueAt('');
      setNotes('');
    }
    setError(null);
    setIsClosing(false);
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let isoDue: string | null = null;
      if (dueAt) {
        isoDue = new Date(dueAt).toISOString();
      }

      await onSave({
        id: initialItem?.id,
        title: title.trim(),
        courseId: courseId ? courseId : null,
        dueAt: isoDue,
        notes: notes.trim() ? notes.trim() : null,
      });

      // Animate out before closing
      setIsClosing(true);
      animateClose(onClose);
    } catch (err: any) {
      setError(err?.message || 'Failed to save homework task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={overlayRef} className="panel-overlay" onClick={handleClose}>
      <div ref={contentRef} className="panel-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="section-header" style={{ fontSize: '20px' }}>
            {initialItem ? 'Edit Homework' : 'New Homework'}
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close modal"
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

        {error && (
          <div style={{ color: 'var(--color-alarm)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="body-emphasis" style={{ fontSize: '13px' }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Read chapter 4, History essay draft"
              required
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-panel)',
                padding: '10px 14px',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {/* Course Tag */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="body-emphasis" style={{ fontSize: '13px' }}>
              Course
            </label>
            <CustomDropdown
              options={[
                { value: '', label: 'Uncategorized' },
                ...courses.map((c) => ({
                  value: c.id,
                  label: c.name,
                  color: c.color ? `var(--color-${c.color})` : undefined,
                })),
              ]}
              value={courseId}
              onChange={setCourseId}
              placeholder="Select course..."
              buttonStyle={{ width: '100%' }}
            />
          </div>

          {/* Due Date & Time — custom picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="body-emphasis" style={{ fontSize: '13px' }}>
              Due Date & Time
            </label>
            <DateTimePicker
              value={dueAt}
              onChange={setDueAt}
              placeholder="Pick a due date and time..."
            />
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="body-emphasis" style={{ fontSize: '13px' }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details, links, or instructions..."
              rows={3}
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-panel)',
                padding: '10px 14px',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Submit / Cancel Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '8px',
            }}
          >
            <GhostPill type="button" variant="muted" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </GhostPill>
            <GhostPill type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : initialItem ? 'Save Changes' : 'Create Task'}
            </GhostPill>
          </div>
        </form>
      </div>
    </div>
  );
}


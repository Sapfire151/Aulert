'use client';

import React, { useRef } from 'react';
import { CheckCircle2, Circle, ExternalLink, Lock } from 'lucide-react';
import { UnifiedItem } from '@/types/aulert';
import { formatDueDateDisplay } from '@/lib/date-utils';
import { getCourseColorClass } from '@/lib/course-colors';
import gsap from 'gsap';

interface ItemRowProps {
  item: UnifiedItem;
  timeZone: string;
  onSelect: (item: UnifiedItem) => void;
  onToggleComplete?: (item: UnifiedItem) => void;
}

export function ItemRow({
  item,
  timeZone,
  onSelect,
  onToggleComplete,
}: ItemRowProps) {
  const isClassroom = item.source === 'classroom';
  const colorClass = getCourseColorClass(item.courseColor);
  const formattedDue = formatDueDateDisplay(item.dueAt, timeZone);
  const checkboxRef = useRef<HTMLButtonElement>(null);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isClassroom) {
      // Classroom synced items are read-only mirror of reality
      return;
    }

    if (checkboxRef.current) {
      gsap.fromTo(
        checkboxRef.current,
        { scale: 0.7 },
        { scale: 1, duration: 0.32, ease: 'back.out(3.5)' }
      );
    }

    if (onToggleComplete) {
      onToggleComplete(item);
    }
  };

  return (
    <div
      className={`item-row ${item.isOverdue && !item.completed ? 'is-overdue' : ''}`}
      onClick={() => onSelect(item)}
      style={{ cursor: 'pointer' }}
    >
      {/* Checkbox or Read-Only Status Indicator */}
      <button
        ref={checkboxRef}
        onClick={handleCheckboxClick}
        className="checkbox-btn"
        aria-label={
          isClassroom
            ? `Classroom status: ${item.rawStatus}`
            : item.completed
            ? 'Mark incomplete'
            : 'Mark complete'
        }
        title={
          isClassroom
            ? 'Synced from Classroom (status mirrors submission)'
            : item.completed
            ? 'Completed'
            : 'Mark as completed'
        }
        style={{
          cursor: isClassroom ? 'default' : 'pointer',
          color: item.completed
            ? 'var(--color-text-muted)'
            : item.isOverdue
            ? 'var(--color-alarm)'
            : 'var(--color-text-muted)',
        }}
      >
        {isClassroom ? (
          item.completed ? (
            <CheckCircle2 size={18} />
          ) : (
            <Circle size={18} style={{ opacity: 0.6 }} />
          )
        ) : item.completed ? (
          <CheckCircle2 size={18} />
        ) : (
          <Circle size={18} />
        )}
      </button>

      {/* Item Title */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          className="item-title body-emphasis"
          style={{
            textDecoration: item.completed ? 'line-through' : 'none',
            opacity: item.completed ? 0.5 : 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </span>
      </div>

      {/* Course Tag (Plain Colored Text, NEVER a badge) */}
      {item.courseName && (
        <span
          className={`item-course ${colorClass}`}
          style={{
            fontSize: '13px',
            whiteSpace: 'nowrap',
          }}
        >
          {item.courseName}
        </span>
      )}

      {/* Due Date */}
      <span
        className="item-due body-ui"
        style={{
          fontSize: '13px',
          color: item.isOverdue && !item.completed ? 'var(--color-alarm)' : 'var(--color-text-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {formattedDue}
      </span>

      {/* Quick link indicator for Classroom items */}
      {isClassroom && item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open in Google Classroom"
          style={{
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: '2px',
          }}
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}


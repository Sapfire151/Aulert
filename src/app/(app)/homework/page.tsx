'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GhostPill } from '@/components/ui/ghost-pill';
import { ItemRow } from '@/components/items/item-row';
import { DetailPanel } from '@/components/items/detail-panel';
import { HomeworkModal } from '@/components/homework/homework-modal';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { UnifiedItem } from '@/types/aulert';
import { CourseRow } from '@/types/database';
import { DEMO_COURSES, getDemoItems } from '@/lib/data-provider';
import { bucketUnifiedItems } from '@/lib/date-utils';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export default function HomeworkPage() {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [courses] = useState<CourseRow[]>(DEMO_COURSES);
  const [timeZone, setTimeZone] = useState<string>('UTC');
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UnifiedItem | null>(null);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      if (containerRef.current) {
        gsap.from('.homework-section', {
          opacity: 0,
          y: 8,
          stagger: 0.08,
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    },
    { scope: containerRef }
  );

  useEffect(() => {
    const tz = localStorage.getItem('aulert-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setTimeZone(tz);

    const stored = localStorage.getItem('aulert-items');
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch {
        setItems(getDemoItems());
      }
    } else {
      const demo = getDemoItems();
      setItems(demo);
      localStorage.setItem('aulert-items', JSON.stringify(demo));
    }
  }, []);

  const updateItems = (newItems: UnifiedItem[]) => {
    setItems(newItems);
    localStorage.setItem('aulert-items', JSON.stringify(newItems));
  };

  // Filter to homework items only for this page
  const homeworkItems = items.filter((item) => item.source === 'homework');
  const bucketed = bucketUnifiedItems(homeworkItems, timeZone);

  const handleToggleComplete = (target: UnifiedItem) => {
    const updated = items.map((i) =>
      i.id === target.id
        ? { ...i, completed: !i.completed, updatedAt: new Date().toISOString() }
        : i
    );
    updateItems(updated);
    if (selectedItem && selectedItem.id === target.id) {
      setSelectedItem({ ...selectedItem, completed: !selectedItem.completed });
    }
  };

  const handleSaveHomework = async (data: {
    id?: string;
    title: string;
    courseId: string | null;
    dueAt: string | null;
    notes: string | null;
  }) => {
    const course = courses.find((c) => c.id === data.courseId);
    if (data.id) {
      const updated = items.map((i) =>
        i.id === data.id
          ? {
              ...i,
              title: data.title,
              courseId: data.courseId,
              courseName: course ? course.name : null,
              courseColor: course ? course.color : undefined,
              dueAt: data.dueAt,
              description: data.notes,
              updatedAt: new Date().toISOString(),
            }
          : i
      );
      updateItems(updated);
    } else {
      const newItem: UnifiedItem = {
        id: `hw-${Date.now()}`,
        source: 'homework',
        title: data.title,
        description: data.notes,
        dueAt: data.dueAt,
        isOverdue: false,
        isDueToday: false,
        isDueThisWeek: false,
        completed: false,
        courseId: data.courseId,
        courseName: course ? course.name : null,
        courseColor: course ? course.color : undefined,
        link: null,
        rawStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateItems([newItem, ...items]);
    }
  };

  const handleDeleteHomework = (target: UnifiedItem) => {
    const updated = items.filter((i) => i.id !== target.id);
    updateItems(updated);
    setSelectedItem(null);
  };

  const renderSection = (title: string, list: UnifiedItem[], isAlarmHeader = false) => {
    if (list.length === 0) return null;
    return (
      <div className="homework-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3
            className="section-header"
            style={{
              fontSize: '15px',
              color: isAlarmHeader ? 'var(--color-alarm)' : 'var(--color-text-primary)',
            }}
          >
            {title}
          </h3>
          <span className="body-ui text-muted" style={{ fontSize: '13px' }}>
            {list.length}
          </span>
        </div>
        <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
          {list.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              timeZone={timeZone}
              onSelect={(selected) => setSelectedItem(selected)}
              onToggleComplete={handleToggleComplete}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 className="section-header">Homework & Tasks</h2>
          <p className="body-ui text-muted" style={{ marginTop: '2px' }}>
            Personal task list with Discord alerts and calendar sync.
          </p>
        </div>

        <GhostPill
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={14} />
          Create Task
        </GhostPill>
      </div>

      {/* Task Buckets: Overdue -> Today -> This Week -> Later */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {renderSection('Overdue', bucketed.overdue, true)}
        {renderSection('Due Today', bucketed.today)}
        {renderSection('Due This Week', bucketed.thisWeek)}
        {renderSection('Later', bucketed.later)}

        {homeworkItems.length === 0 && (
          <div
            style={{
              padding: '64px 0',
              textAlign: 'center',
              borderTop: '1px solid var(--color-hairline)',
              borderBottom: '1px solid var(--color-hairline)',
            }}
          >
            <p className="body-ui text-muted">No custom tasks yet. Click &quot;Create Task&quot; above to add one.</p>
          </div>
        )}

        {/* Completed Section (Collapses to bottom per PRD) */}
        {bucketed.completed.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => setIsCompletedCollapsed(!isCompletedCollapsed)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-text-muted)',
                fontFamily: 'inherit',
                fontSize: '14px',
                fontWeight: 600,
                padding: 0,
              }}
            >
              {isCompletedCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              Completed ({bucketed.completed.length})
            </button>

            {!isCompletedCollapsed && (
              <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
                {bucketed.completed.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    timeZone={timeZone}
                    onSelect={(selected) => setSelectedItem(selected)}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <DetailPanel
        item={selectedItem}
        timeZone={timeZone}
        onClose={() => setSelectedItem(null)}
        onToggleComplete={handleToggleComplete}
        onEditHomework={(item) => {
          setSelectedItem(null);
          setEditingItem(item);
          setIsModalOpen(true);
        }}
        onDeleteHomework={handleDeleteHomework}
      />

      {/* Homework Creation / Edit Modal */}
      <HomeworkModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveHomework}
        courses={courses}
        initialItem={editingItem}
      />
    </div>
  );
}


'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StatCard } from '@/components/dashboard/stat-card';
import { ReconnectBanner } from '@/components/dashboard/reconnect-banner';
import { ItemRow } from '@/components/items/item-row';
import { DetailPanel } from '@/components/items/detail-panel';
import { HomeworkModal } from '@/components/homework/homework-modal';
import { GhostPill } from '@/components/ui/ghost-pill';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { UnifiedItem, DashboardStats } from '@/types/aulert';
import { CourseRow } from '@/types/database';
import { DEMO_COURSES, getDemoItems, computeDashboardStats } from '@/lib/data-provider';
import { bucketUnifiedItems } from '@/lib/date-utils';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

// Time-of-day greeting
function getGreeting(): { headline: string; subtitle: string } {
  const hour = new Date().getHours();
  let headline: string;
  if (hour >= 5 && hour < 12) headline = 'Good morning';
  else if (hour >= 12 && hour < 17) headline = 'Good afternoon';
  else if (hour >= 17 && hour < 22) headline = 'Good evening';
  else headline = 'Late night focus';

  const subtitles = [
    'Here is what needs your attention today.',
    'Ready to tackle today\'s deadlines?',
    'Your synchronized homework radar is active.',
    'Step-by-step, zero stress.',
    'All course streams unified and up to date.',
    'Let\'s clear the board together.',
  ];
  const subtitle = subtitles[Math.floor(Math.random() * subtitles.length)];
  return { headline, subtitle };
}

export default function DashboardPage() {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [courses] = useState<CourseRow[]>(DEMO_COURSES);
  const [timeZone, setTimeZone] = useState<string>('UTC');
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState<boolean>(false);
  const [greeting] = useState(() => getGreeting());
  const [stats, setStats] = useState<DashboardStats>({
    overdueCount: 0,
    dueThisWeekCount: 0,
    completedThisMonthCount: 0,
    needsReauth: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      if (containerRef.current) {
        gsap.from('.stat-card', {
          opacity: 0,
          y: 10,
          stagger: 0.08,
          duration: 0.35,
          ease: 'power2.out',
        });
      }
    },
    { scope: containerRef }
  );

  useEffect(() => {
    const tz = localStorage.getItem('aulert-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setTimeZone(tz);

    // Load items (from local storage or default demo)
    const stored = localStorage.getItem('aulert-items');
    let loadedItems: UnifiedItem[] = [];
    if (stored) {
      try {
        loadedItems = JSON.parse(stored);
      } catch {
        loadedItems = getDemoItems();
      }
    } else {
      loadedItems = getDemoItems();
      localStorage.setItem('aulert-items', JSON.stringify(loadedItems));
    }

    setItems(loadedItems);
    setStats(computeDashboardStats(loadedItems, tz));
  }, []);

  const updateItems = (newItems: UnifiedItem[]) => {
    setItems(newItems);
    localStorage.setItem('aulert-items', JSON.stringify(newItems));
    setStats(computeDashboardStats(newItems, timeZone));
  };

  const handleToggleComplete = (targetItem: UnifiedItem) => {
    if (targetItem.source === 'classroom') return; // Classroom completion is read-only
    const updated = items.map((i) =>
      i.id === targetItem.id
        ? {
            ...i,
            completed: !i.completed,
            updatedAt: new Date().toISOString(),
          }
        : i
    );
    updateItems(updated);
    if (selectedItem && selectedItem.id === targetItem.id) {
      setSelectedItem({
        ...selectedItem,
        completed: !selectedItem.completed,
      });
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
      // Edit existing
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
      // Create new homework item
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

  const handleDeleteHomework = (targetItem: UnifiedItem) => {
    if (targetItem.source === 'classroom') return;
    const updated = items.filter((i) => i.id !== targetItem.id);
    updateItems(updated);
    setSelectedItem(null);
  };

  const bucketed = bucketUnifiedItems(items, timeZone);
  const urgentList = [...bucketed.overdue, ...bucketed.today, ...bucketed.thisWeek];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Reconnect Banner if token expired or revoked */}
      {stats.needsReauth && <ReconnectBanner />}

      {/* Hero Greeting — The SINGLE large display moment per screen */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 className="hero-headline">{greeting.headline}</h1>
          <p className="body-ui text-muted" style={{ marginTop: '4px' }}>
            {greeting.subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <GhostPill onClick={() => setIsHomeworkModalOpen(true)}>
            <Plus size={14} />
            New Task
          </GhostPill>
          <GhostPill href="/calendar" variant="muted">
            <CalendarIcon size={14} />
            Calendar
          </GhostPill>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <StatCard
          number={stats.overdueCount}
          label="Overdue"
          isAlarm={stats.overdueCount > 0}
        />
        <StatCard
          number={stats.dueThisWeekCount}
          label="Due This Week"
        />
        <StatCard
          number={stats.completedThisMonthCount}
          label="Completed This Month"
        />
      </div>

      {/* Urgent Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="section-header" style={{ fontSize: '18px' }}>
            Urgent Items
          </h2>
          <span className="body-ui text-muted">
            {urgentList.length} {urgentList.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {urgentList.length === 0 ? (
          <div
            style={{
              padding: '48px 0',
              textAlign: 'center',
              borderTop: '1px solid var(--color-hairline)',
              borderBottom: '1px solid var(--color-hairline)',
            }}
          >
            <p className="body-ui text-muted">
              All caught up! No overdue assignments or tasks due this week.
            </p>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
            {urgentList.map((item) => (
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

      {/* Detail Panel */}
      <DetailPanel
        item={selectedItem}
        timeZone={timeZone}
        onClose={() => setSelectedItem(null)}
        onToggleComplete={handleToggleComplete}
        onEditHomework={(item) => {
          setSelectedItem(null);
          setIsHomeworkModalOpen(true);
        }}
        onDeleteHomework={handleDeleteHomework}
      />

      {/* Homework Creation Modal */}
      <HomeworkModal
        isOpen={isHomeworkModalOpen}
        onClose={() => setIsHomeworkModalOpen(false)}
        onSave={handleSaveHomework}
        courses={courses}
      />
    </div>
  );
}


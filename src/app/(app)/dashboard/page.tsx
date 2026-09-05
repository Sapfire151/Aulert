'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StatCard } from '@/components/dashboard/stat-card';
import { ReconnectBanner } from '@/components/dashboard/reconnect-banner';
import { ItemRow } from '@/components/items/item-row';
import { DetailPanel } from '@/components/items/detail-panel';
import { HomeworkModal } from '@/components/homework/homework-modal';
import { GhostPill } from '@/components/ui/ghost-pill';
import { Plus, Calendar as CalendarIcon, RefreshCw, Sparkles } from 'lucide-react';
import { UnifiedItem, DashboardStats } from '@/types/aulert';
import { CourseRow } from '@/types/database';
import { computeDashboardStats } from '@/lib/data-provider';
import { bucketUnifiedItems } from '@/lib/date-utils';
import { useClassroomData } from '@/lib/hooks/use-classroom-data';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

// Time-of-day greeting
function getGreeting(userName?: string): { headline: string; subtitle: string } {
  const hour = new Date().getHours();
  const nameSuffix = userName ? `, ${userName}` : '';
  let headline: string;
  if (hour >= 5 && hour < 12) headline = `Good morning${nameSuffix}`;
  else if (hour >= 12 && hour < 17) headline = `Good afternoon${nameSuffix}`;
  else if (hour >= 17 && hour < 22) headline = `Good evening${nameSuffix}`;
  else headline = `Late night focus${nameSuffix}`;

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
  const {
    items,
    courses,
    isLoading,
    isSyncing,
    isAuthenticated,
    isDemo,
    needsReauth,
    lastSynced,
    user,
    syncNow,
    addItem,
    updateItem,
    toggleComplete,
  } = useClassroomData();

  const [timeZone, setTimeZone] = useState<string>('UTC');
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState<boolean>(false);
  const [greeting, setGreeting] = useState(() => getGreeting());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.name) {
      setGreeting(getGreeting(user.name.split(' ')[0]));
    }
  }, [user]);

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
    const tz =
      localStorage.getItem('aulert-tz') ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'UTC';
    setTimeZone(tz);
  }, []);

  const stats = computeDashboardStats(items, timeZone);

  const handleToggleComplete = (targetItem: UnifiedItem) => {
    if (targetItem.source === 'classroom') return; // Classroom completion mirrors submission
    toggleComplete(targetItem.id);
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
      const existing = items.find((i) => i.id === data.id);
      if (existing) {
        updateItem({
          ...existing,
          title: data.title,
          courseId: data.courseId,
          courseName: course ? course.name : null,
          courseColor: course ? course.color : undefined,
          dueAt: data.dueAt,
          description: data.notes,
          updatedAt: new Date().toISOString(),
        });
      }
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
        rawStatus: 'assigned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addItem(newItem);
    }
  };

  const handleDeleteHomework = (targetItem: UnifiedItem) => {
    if (targetItem.source === 'classroom') return;
    const updated = items.filter((i) => i.id !== targetItem.id);
    localStorage.setItem(
      'aulert-custom-homework',
      JSON.stringify(updated.filter((it) => it.source === 'homework'))
    );
    setSelectedItem(null);
  };

  const bucketed = bucketUnifiedItems(items, timeZone);
  const urgentList = [...bucketed.overdue, ...bucketed.today, ...bucketed.thisWeek];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Reconnect Banner if token expired or revoked */}
      {needsReauth && <ReconnectBanner />}

      {/* Preview Mode Callout Banner */}
      {isDemo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 20px',
            backgroundColor: 'var(--color-panel)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                You are currently in Preview Mode with mock data.
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Sign in with Google to synchronize your live Google Classroom courses and assignments.
              </p>
            </div>
          </div>
          <GhostPill href="/api/auth/google" variant="google" size="sm">
            Connect Google Classroom
          </GhostPill>
        </div>
      )}

      {/* Hero Greeting — The SINGLE large display moment per screen */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 className="hero-headline">{greeting.headline}</h1>
          <p className="body-ui text-muted" style={{ marginTop: '4px' }}>
            {greeting.subtitle}
            {isAuthenticated && lastSynced && (
              <span style={{ marginLeft: '8px', fontSize: '13px' }}>
                • Classroom synced {new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {isAuthenticated && (
            <GhostPill
              onClick={() => syncNow()}
              variant="muted"
              size="md"
              disabled={isSyncing}
              title="Fetch latest assignments from Google Classroom"
            >
              <RefreshCw
                size={14}
                style={{
                  animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              {isSyncing ? 'Syncing...' : 'Sync Classroom'}
            </GhostPill>
          )}
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


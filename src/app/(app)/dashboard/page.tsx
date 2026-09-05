'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { StatCard } from '@/components/dashboard/stat-card';
import { ReconnectBanner } from '@/components/dashboard/reconnect-banner';
import { ItemRow } from '@/components/items/item-row';
import { DetailPanel } from '@/components/items/detail-panel';
import { HomeworkModal } from '@/components/homework/homework-modal';
import { GhostPill } from '@/components/ui/ghost-pill';
import { CustomDropdown, DropdownOption } from '@/components/ui/custom-dropdown';
import {
  Plus,
  Calendar as CalendarIcon,
  RefreshCw,
  Sparkles,
  BookOpen,
  Megaphone,
  Star,
  Layers,
  AlertCircle,
  Search,
  X,
  Filter,
} from 'lucide-react';
import { UnifiedItem, DashboardStats } from '@/types/aulert';
import { CourseRow } from '@/types/database';
import { computeDashboardStats } from '@/lib/data-provider';
import { bucketUnifiedItems } from '@/lib/date-utils';
import { useClassroomData } from '@/lib/hooks/use-classroom-data';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

type DashboardTab = 'urgent' | 'all' | 'assignments' | 'announcements' | 'grades';

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

// Announcement card component
function AnnouncementCard({ item, onSelect }: { item: UnifiedItem; onSelect: (item: UnifiedItem) => void }) {
  const colorVar = item.courseColor ? `var(--${item.courseColor})` : 'var(--color-primary)';
  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        display: 'flex',
        gap: '14px',
        padding: '16px',
        borderBottom: '1px solid var(--color-hairline)',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-panel-hover, rgba(255,255,255,0.04))')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          backgroundColor: colorVar,
          opacity: 0.15,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', opacity: 1 / 0.15 * 1 }}>
          <Megaphone size={16} style={{ color: colorVar, opacity: 1 }} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: colorVar,
              backgroundColor: `${colorVar}18`,
              padding: '2px 8px',
              borderRadius: '999px',
              flexShrink: 0,
            }}
          >
            {item.courseName}
          </span>
          <span className="body-ui text-muted" style={{ fontSize: '12px' }}>
            {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 1.45, fontWeight: 500 }}>
          {item.title}
        </p>
        {item.text && item.text.length > 80 && (
          <p className="body-ui text-muted" style={{ margin: '4px 0 0', fontSize: '13px', lineHeight: 1.4 }}>
            {item.text.slice(0, 120)}…
          </p>
        )}
      </div>
    </div>
  );
}

// Grade card component
function GradeCard({ item, onSelect }: { item: UnifiedItem; onSelect: (item: UnifiedItem) => void }) {
  const colorVar = item.courseColor ? `var(--${item.courseColor})` : 'var(--color-primary)';
  const pct = item.maxPoints && item.grade != null ? Math.round((item.grade / item.maxPoints) * 100) : null;
  const gradeColor = pct == null ? 'var(--color-text-primary)' : pct >= 90 ? '#4ade80' : pct >= 70 ? '#facc15' : '#f87171';

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        display: 'flex',
        gap: '14px',
        padding: '16px',
        borderBottom: '1px solid var(--color-hairline)',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-panel-hover, rgba(255,255,255,0.04))')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          backgroundColor: gradeColor,
          opacity: 0.15,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Star size={16} style={{ color: gradeColor, opacity: 1, position: 'absolute' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: colorVar,
              backgroundColor: `${colorVar}18`,
              padding: '2px 8px',
              borderRadius: '999px',
              flexShrink: 0,
            }}
          >
            {item.courseName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500, flex: 1, minWidth: 0 }}>
            {/* Strip "Grade received: " prefix for display */}
            {item.title.replace(/^Grade received: /, '')}
          </p>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: gradeColor,
              flexShrink: 0,
            }}
          >
            {item.grade != null && item.maxPoints != null
              ? `${item.grade}/${item.maxPoints}`
              : item.grade != null
              ? `${item.grade} pts`
              : '—'}
          </span>
        </div>
        {pct != null && (
          <div style={{ marginTop: '8px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-hairline)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                backgroundColor: gradeColor,
                borderRadius: '2px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('urgent');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
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

  // Only count assignments/homework for stats (not announcements/grades)
  const actionableItems = items.filter(
    (i) => i.itemType !== 'announcement' && i.itemType !== 'grade'
  );
  const stats = computeDashboardStats(actionableItems, timeZone);

  const handleToggleComplete = (targetItem: UnifiedItem) => {
    if (targetItem.source === 'classroom') return;
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
      const newItem: UnifiedItem = {
        id: `hw-${Date.now()}`,
        source: 'homework',
        itemType: 'homework',
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

  const bucketed = bucketUnifiedItems(actionableItems, timeZone);
  const urgentList = [...bucketed.overdue, ...bucketed.today, ...bucketed.thisWeek];
  const assignments = items.filter((i) => i.itemType === 'assignment' || i.itemType === 'homework' || i.itemType === 'short_answer_question' || i.itemType === 'multiple_choice_question');
  const announcements = items.filter((i) => i.itemType === 'announcement');
  const grades = items.filter((i) => i.itemType === 'grade');

  const courseOptions: DropdownOption[] = [
    { value: 'all', label: 'All Courses' },
    ...courses.map((c) => ({
      value: c.classroom_course_id || c.id,
      label: c.name,
      color: `var(--${c.color})`,
    })),
  ];

  const statusOptions: DropdownOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending / Assigned' },
    { value: 'completed', label: 'Completed / Turned in' },
  ];

  const typeOptions: DropdownOption[] = [
    { value: 'all', label: 'All Types' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'announcement', label: 'Announcements' },
    { value: 'grade', label: 'Grades' },
    { value: 'homework', label: 'Custom Homework' },
  ];

  const TABS: { id: DashboardTab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'urgent', label: 'Urgent', icon: <AlertCircle size={14} />, count: urgentList.length },
    { id: 'all', label: 'All Activity', icon: <Layers size={14} />, count: items.length },
    { id: 'assignments', label: 'Assignments', icon: <BookOpen size={14} />, count: assignments.length },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone size={14} />, count: announcements.length },
    { id: 'grades', label: 'Grades', icon: <Star size={14} />, count: grades.length },
  ];

  const getActiveList = (): UnifiedItem[] => {
    switch (activeTab) {
      case 'urgent': return urgentList;
      case 'all': return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      case 'assignments': return assignments;
      case 'announcements': return announcements;
      case 'grades': return grades;
    }
  };

  const activeList = getActiveList();

  const filteredList = activeList.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchCourse = item.courseName?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCourse) return false;
    }

    if (selectedCourse !== 'all') {
      if (item.courseId !== selectedCourse && (item as any).classroom_course_id !== selectedCourse) {
        return false;
      }
    }

    if (selectedStatus === 'pending' && item.completed) return false;
    if (selectedStatus === 'completed' && !item.completed) return false;

    if (selectedType !== 'all') {
      if (selectedType === 'assignment') {
        if (
          item.itemType !== 'assignment' &&
          item.itemType !== 'short_answer_question' &&
          item.itemType !== 'multiple_choice_question'
        ) {
          return false;
        }
      } else if (item.itemType !== selectedType) {
        return false;
      }
    }

    return true;
  });

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedCourse !== 'all' || selectedStatus !== 'all' || selectedType !== 'all'
  );

  const renderEmptyState = () => (
    <div
      style={{
        padding: '48px 0',
        textAlign: 'center',
        borderTop: '1px solid var(--color-hairline)',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <p className="body-ui text-muted">
        {hasActiveFilters
          ? 'No items match your search or active filters.'
          : activeTab === 'urgent'
          ? 'All caught up! No overdue assignments or tasks due this week.'
          : activeTab === 'announcements'
          ? 'No announcements yet.'
          : activeTab === 'grades'
          ? 'No graded items yet.'
          : 'Nothing here yet.'}
      </p>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setSelectedCourse('all');
            setSelectedStatus('all');
            setSelectedType('all');
          }}
          style={{
            marginTop: '10px',
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '13px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Clear all filters
        </button>
      )}
    </div>
  );

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

      {/* Hero Greeting */}
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
        <StatCard
          number={grades.length}
          label="Grades Received"
        />
      </div>

      {/* Tab Navigation */}
      <div>
        {/* Tab Bar */}
        <div
          role="tablist"
          aria-label="Dashboard sections"
          style={{
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid var(--color-hairline)',
            overflowX: 'auto',
            paddingBottom: '0',
            scrollbarWidth: 'none',
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s, border-color 0.15s',
                  flexShrink: 0,
                  marginBottom: '-1px',
                  fontFamily: 'inherit',
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.count > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      backgroundColor: isActive ? 'var(--color-primary-dim, rgba(99,102,241,0.15))' : 'var(--color-panel)',
                      padding: '1px 6px',
                      borderRadius: '999px',
                      minWidth: '20px',
                      textAlign: 'center',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '16px 0',
          }}
        >
          {/* Search Box */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 240px',
              maxWidth: '360px',
            }}
          >
            <Search
              size={14}
              color="var(--color-text-muted)"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, course, notes..."
              style={{
                width: '100%',
                padding: '8px 32px 8px 34px',
                fontSize: '13px',
                backgroundColor: 'var(--color-panel)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-panel)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-hairline)')}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <CustomDropdown
              options={courseOptions}
              value={selectedCourse}
              onChange={setSelectedCourse}
              placeholder="All Courses"
              buttonStyle={{ padding: '7px 12px', fontSize: '12px' }}
              menuWidth={200}
            />

            <CustomDropdown
              options={statusOptions}
              value={selectedStatus}
              onChange={setSelectedStatus}
              placeholder="All Status"
              buttonStyle={{ padding: '7px 12px', fontSize: '12px' }}
              menuWidth={170}
            />

            {(activeTab === 'all' || activeTab === 'urgent') && (
              <CustomDropdown
                options={typeOptions}
                value={selectedType}
                onChange={setSelectedType}
                placeholder="All Types"
                buttonStyle={{ padding: '7px 12px', fontSize: '12px' }}
                menuWidth={170}
              />
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCourse('all');
                  setSelectedStatus('all');
                  setSelectedType('all');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ marginTop: '0' }}>
          {filteredList.length === 0 ? (
            renderEmptyState()
          ) : activeTab === 'announcements' ? (
            <div>
              {filteredList.map((item) => (
                <AnnouncementCard key={item.id} item={item} onSelect={setSelectedItem} />
              ))}
            </div>
          ) : activeTab === 'grades' ? (
            <div>
              {filteredList.map((item) => (
                <GradeCard key={item.id} item={item} onSelect={setSelectedItem} />
              ))}
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
              {filteredList
                .filter((item) => item.itemType !== 'announcement' && item.itemType !== 'grade')
                .map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    timeZone={timeZone}
                    onSelect={(selected) => setSelectedItem(selected)}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              {filteredList.filter((item) => item.itemType !== 'announcement' && item.itemType !== 'grade').length === 0 && renderEmptyState()}
            </div>
          )}
        </div>
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

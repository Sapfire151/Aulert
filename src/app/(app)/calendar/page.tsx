'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GhostPill } from '@/components/ui/ghost-pill';
import { CustomDropdown, DropdownOption } from '@/components/ui/custom-dropdown';
import { DetailPanel } from '@/components/items/detail-panel';
import { ItemRow } from '@/components/items/item-row';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Columns, Search, X } from 'lucide-react';
import { UnifiedItem } from '@/types/aulert';
import { useClassroomData } from '@/lib/hooks/use-classroom-data';
import { getCourseColorClass } from '@/lib/course-colors';
import { isOverdueInTimezone, isDueTodayInTimezone } from '@/lib/date-utils';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

type CalendarView = 'month' | 'week' | 'agenda';

export default function CalendarPage() {
  const { items, courses, toggleComplete, timeZone: hookTz } = useClassroomData();
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [timeZone, setTimeZone] = useState<string>('UTC');
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const viewContainerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      if (viewContainerRef.current) {
        gsap.fromTo(
          viewContainerRef.current,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
        );
      }
    },
    { dependencies: [view, currentDate.getMonth(), currentDate.getFullYear()], scope: viewContainerRef }
  );

  useEffect(() => {
    const tz = localStorage.getItem('aulert-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setTimeZone(tz);
  }, []);

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (view === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setMonth(next.getMonth() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (view === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month grid generator
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Total days in month
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Days from previous month to fill grid
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Days from next month to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const courseOptions: DropdownOption[] = [
    { value: 'all', label: 'All Courses' },
    ...courses.map((c) => ({
      value: c.classroom_course_id || c.id,
      label: c.name,
      color: `var(--${c.color})`,
    })),
  ];

  const filteredItems = items.filter((item) => {
    if (selectedCourse !== 'all') {
      if (item.courseId !== selectedCourse && (item as any).classroom_course_id !== selectedCourse) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchCourse = item.courseName?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCourse) return false;
    }
    return true;
  });

  const getItemsForDate = (date: Date) => {
    return filteredItems.filter((item) => {
      if (!item.dueAt) return false;
      const d = new Date(item.dueAt);
      return (
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
      );
    });
  };

  const monthLabel = currentDate.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthDays = getMonthDays();
  const today = new Date();

  // Determines if the user is already viewing the current period — hide the "Today" button if so
  const isViewingCurrentPeriod = (() => {
    if (view === 'week') {
      // Check if today falls in the visible week
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return today >= startOfWeek && today <= endOfWeek;
    }
    // Month or Agenda: same month + year
    return (
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth()
    );
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Calendar Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Recurring nav header: 24px, letter-spacing -0.24px per Design Rules */}
          <h2 className="section-header" style={{ minWidth: '180px' }}>
            {monthLabel}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GhostPill size="sm" variant="muted" onClick={handlePrev} aria-label="Previous">
              <ChevronLeft size={14} />
            </GhostPill>
            {/* Hide Today button when already viewing the current period */}
            {!isViewingCurrentPeriod && (
              <GhostPill size="sm" variant="muted" onClick={handleToday}>
                Today
              </GhostPill>
            )}
            <GhostPill size="sm" variant="muted" onClick={handleNext} aria-label="Next">
              <ChevronRight size={14} />
            </GhostPill>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', width: '180px' }}>
            <Search
              size={13}
              color="var(--color-text-muted)"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              style={{
                width: '100%',
                padding: '7px 26px 7px 28px',
                fontSize: '12px',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-panel)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: '8px',
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
                <X size={12} />
              </button>
            )}
          </div>

          {/* Course Filter */}
          <CustomDropdown
            options={courseOptions}
            value={selectedCourse}
            onChange={setSelectedCourse}
            placeholder="All Courses"
            buttonStyle={{ padding: '7px 12px', fontSize: '12px' }}
            menuWidth={190}
            align="right"
          />

          {/* View Switcher: Custom Dropdown */}
          <CustomDropdown
            options={[
              { value: 'month', label: 'Month View', icon: <CalendarIcon size={14} /> },
              { value: 'week', label: 'Week View', icon: <Columns size={14} /> },
              { value: 'agenda', label: 'Agenda View', icon: <List size={14} /> },
            ]}
            value={view}
            onChange={(val) => setView(val as CalendarView)}
            menuWidth={160}
            align="right"
          />
        </div>
      </div>

      <div ref={viewContainerRef}>
      {/* Month View Grid */}
      {view === 'month' && (
        <div className="calendar-grid-container">
          <div className="calendar-header-row">
            {weekDayNames.map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>

          <div className="calendar-days-grid">
            {monthDays.map(({ date, isCurrentMonth }, idx) => {
              const dateItems = getItemsForDate(date);
              const isTodayCell =
                date.getFullYear() === today.getFullYear() &&
                date.getMonth() === today.getMonth() &&
                date.getDate() === today.getDate();

              const overflow = dateItems.length > 2 ? dateItems.length - 2 : 0;
              const visibleItems = dateItems.slice(0, 2);

              return (
                <div
                  key={idx}
                  className={`calendar-cell ${!isCurrentMonth ? 'outside-month' : ''} ${
                    isTodayCell ? 'is-today' : ''
                  }`}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <span className="day-number-pill">{date.getDate()}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                    {visibleItems.map((item) => {
                      const colorClass = getCourseColorClass(item.courseColor);
                      const isOverdue = isOverdueInTimezone(item.dueAt, timeZone);
                      return (
                        <div
                          key={item.id}
                          className={`calendar-item-line ${isOverdue && !item.completed ? 'text-alarm' : colorClass}`}
                          onClick={() => setSelectedItem(item)}
                          title={item.title}
                        >
                          • {item.title}
                        </div>
                      );
                    })}

                    {overflow > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        +{overflow} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="calendar-grid-container">
          <div className="calendar-header-row">
            {weekDayNames.map((name, i) => {
              const d = new Date(currentDate);
              const startOfWeek = d.getDate() - d.getDay() + i;
              const colDate = new Date(d.setDate(startOfWeek));
              return (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>{name}</span>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                    {colDate.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="calendar-days-grid" style={{ minHeight: '340px' }}>
            {weekDayNames.map((_, i) => {
              const d = new Date(currentDate);
              const startOfWeek = d.getDate() - d.getDay() + i;
              const colDate = new Date(d.setDate(startOfWeek));
              const dateItems = getItemsForDate(colDate);
              const isTodayCol =
                colDate.getFullYear() === today.getFullYear() &&
                colDate.getMonth() === today.getMonth() &&
                colDate.getDate() === today.getDate();

              return (
                <div
                  key={i}
                  className={`calendar-cell ${isTodayCol ? 'is-today' : ''}`}
                  style={{ minHeight: '340px' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dateItems.map((item) => {
                      const colorClass = getCourseColorClass(item.courseColor);
                      const isOverdue = isOverdueInTimezone(item.dueAt, timeZone);
                      return (
                        <div
                          key={item.id}
                          className={`calendar-item-line ${isOverdue && !item.completed ? 'text-alarm' : colorClass}`}
                          onClick={() => setSelectedItem(item)}
                          style={{ whiteSpace: 'normal', fontSize: '12px' }}
                        >
                          • {item.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda (List) View */}
      {view === 'agenda' && (
        <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
          {filteredItems.length === 0 ? (
            <p className="body-ui text-muted" style={{ padding: '32px 0', textAlign: 'center' }}>
              {searchQuery.trim() || selectedCourse !== 'all'
                ? 'No scheduled items match your search or course filter.'
                : 'No items scheduled.'}
            </p>
          ) : (
            filteredItems
              .slice()
              .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''))
              .map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  timeZone={timeZone}
                  onSelect={(selected) => setSelectedItem(selected)}
                />
              ))
          )}
        </div>
      )}
      </div>

      {/* Detail Panel */}
      <DetailPanel
        item={selectedItem}
        timeZone={timeZone}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}


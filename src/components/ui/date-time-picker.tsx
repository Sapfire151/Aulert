'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';
import gsap from 'gsap';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function pad(n: number) { return n.toString().padStart(2, '0'); }

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Select date & time...',
  style,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const parsed = value ? new Date(value) : null;
  const [viewYear, setViewYear] = useState(
    parsed?.getFullYear() ?? new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    parsed?.getMonth() ?? new Date().getMonth()
  );
  const [selDate, setSelDate] = useState<{ y: number; m: number; d: number } | null>(
    parsed ? { y: parsed.getFullYear(), m: parsed.getMonth(), d: parsed.getDate() } : null
  );
  const [hour, setHour] = useState(parsed?.getHours() ?? 23);
  const [minute, setMinute] = useState(parsed?.getMinutes() ?? 59);

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
        setSelDate({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });
        setHour(d.getHours());
        setMinute(d.getMinutes());
      }
    } else {
      setSelDate(null);
      setHour(23);
      setMinute(59);
    }
  }, [value]);

  const animateOpen = useCallback(() => {
    if (!dropRef.current) return;
    gsap.fromTo(
      dropRef.current,
      { opacity: 0, y: -8, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out' }
    );
  }, []);

  const animateClose = useCallback((cb: () => void) => {
    if (!dropRef.current) { cb(); return; }
    gsap.to(dropRef.current, {
      opacity: 0,
      y: -6,
      scale: 0.97,
      duration: 0.16,
      ease: 'power2.in',
      onComplete: cb,
    });
  }, []);

  useEffect(() => {
    if (open) animateOpen();
  }, [open, animateOpen]);

  const handleClose = useCallback(() => {
    animateClose(() => setOpen(false));
  }, [animateClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, handleClose]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { day: number; thisMonth: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: prevMonthDays - firstDay + 1 + i, thisMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, thisMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, thisMonth: false });
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const emitChange = (y: number, m: number, d: number, h: number, min: number) => {
    onChange(`${y}-${pad(m + 1)}-${pad(d)}T${pad(h)}:${pad(min)}`);
  };

  const selectDay = (day: number, thisMonth: boolean) => {
    let y = viewYear, m = viewMonth;
    if (!thisMonth) {
      if (day > 15) { m--; if (m < 0) { m = 11; y--; } }
      else { m++; if (m > 11) { m = 0; y++; } }
      setViewYear(y); setViewMonth(m);
    }
    setSelDate({ y, m, d: day });
    emitChange(y, m, day, hour, minute);
  };

  const handleHour = (delta: number) => {
    const h = (hour + delta + 24) % 24;
    setHour(h);
    if (selDate) emitChange(selDate.y, selDate.m, selDate.d, h, minute);
  };

  const handleMinute = (delta: number) => {
    const min = (minute + delta + 60) % 60;
    setMinute(min);
    if (selDate) emitChange(selDate.y, selDate.m, selDate.d, hour, min);
  };

  const handleHourInput = (v: string) => {
    const h = Math.min(23, Math.max(0, parseInt(v) || 0));
    setHour(h);
    if (selDate) emitChange(selDate.y, selDate.m, selDate.d, h, minute);
  };

  const handleMinuteInput = (v: string) => {
    const min = Math.min(59, Math.max(0, parseInt(v) || 0));
    setMinute(min);
    if (selDate) emitChange(selDate.y, selDate.m, selDate.d, hour, min);
  };

  const handleToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelDate({ y: t.getFullYear(), m: t.getMonth(), d: t.getDate() });
    emitChange(t.getFullYear(), t.getMonth(), t.getDate(), hour, minute);
  };

  const displayValue = selDate
    ? `${MONTHS[selDate.m].slice(0, 3)} ${pad(selDate.d)}, ${selDate.y}  ${pad(hour)}:${pad(minute)}`
    : '';

  const today = new Date();

  const navBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--color-hairline)',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--color-text-primary)',
    padding: 0,
    transition: 'background 0.12s ease',
    fontFamily: 'inherit',
  };

  const spinnerBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
    fontSize: '7px',
    lineHeight: 1,
    padding: '0 2px',
    borderRadius: '2px',
    fontFamily: 'inherit',
  };

  const timeInputStyle: React.CSSProperties = {
    width: '32px',
    textAlign: 'center',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-hairline)',
    borderRadius: '4px',
    padding: '1px 0',
    color: 'var(--color-text-primary)',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'inherit',
    outline: 'none',
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? handleClose() : setOpen(true))}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--color-bg)',
          border: `1px solid ${open ? 'var(--color-text-primary)' : 'var(--color-hairline)'}`,
          borderRadius: 'var(--radius-panel)',
          padding: '5px 10px',
          color: displayValue ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          fontFamily: 'inherit',
          fontSize: '12px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.15s ease',
          minHeight: '32px',
          boxSizing: 'border-box',
        }}
      >
        <Calendar size={13} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
        <span style={{ flex: 1 }}>{displayValue || placeholder}</span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(''); setSelDate(null); }}
            style={{ color: 'var(--color-text-muted)', lineHeight: 1, fontSize: '14px', cursor: 'pointer' }}
          >
            &times;
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 3px)',
            left: 0,
            zIndex: 500,
            background: 'var(--color-panel)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-panel)',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            width: '230px',
            minWidth: '220px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Month navigation + Today */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <button
                type="button"
                onClick={prevMonth}
                style={navBtnStyle}
                aria-label="Previous month"
              >
                <ChevronLeft size={11} />
              </button>
              <button
                type="button"
                onClick={handleToday}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'inherit',
                  transition: 'background 0.12s ease',
                  lineHeight: '16px',
                }}
                title="Jump to today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={nextMonth}
                style={navBtnStyle}
                aria-label="Next month"
              >
                <ChevronRight size={11} />
              </button>
            </div>
          </div>

          {/* Day-of-week header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
            {DAYS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  paddingBottom: '1px',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
            {cells.map((cell, i) => {
              const isToday =
                cell.thisMonth &&
                cell.day === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear();
              const isSelected =
                selDate &&
                cell.thisMonth &&
                cell.day === selDate.d &&
                viewMonth === selDate.m &&
                viewYear === selDate.y;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(cell.day, cell.thisMonth)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    maxHeight: '22px',
                    borderRadius: '50%',
                    border: isToday && !isSelected
                      ? '1px solid var(--color-text-primary)'
                      : '1px solid transparent',
                    background: isSelected ? 'var(--color-text-primary)' : 'transparent',
                    color: isSelected
                      ? 'var(--color-bg)'
                      : cell.thisMonth
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-muted)',
                    opacity: cell.thisMonth ? 1 : 0.28,
                    fontSize: '10px',
                    fontWeight: isSelected || isToday ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.12s ease, color 0.12s ease',
                    padding: 0,
                    margin: '0 auto',
                    fontFamily: 'inherit',
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Time row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderTop: '1px solid var(--color-hairline)',
              paddingTop: '6px',
            }}
          >
            <Clock size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', minWidth: '24px' }}>
              Time
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' }}>
              {/* Hour */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <button type="button" onClick={() => handleHour(1)} style={spinnerBtnStyle} aria-label="Hour up">▲</button>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={pad(hour)}
                  onChange={(e) => handleHourInput(e.target.value)}
                  style={timeInputStyle}
                  aria-label="Hour"
                />
                <button type="button" onClick={() => handleHour(-1)} style={spinnerBtnStyle} aria-label="Hour down">▼</button>
              </div>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '12px', lineHeight: 1 }}>:</span>
              {/* Minute */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <button type="button" onClick={() => handleMinute(5)} style={spinnerBtnStyle} aria-label="Minute up">▲</button>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={pad(minute)}
                  onChange={(e) => handleMinuteInput(e.target.value)}
                  style={timeInputStyle}
                  aria-label="Minute"
                />
                <button type="button" onClick={() => handleMinute(-5)} style={spinnerBtnStyle} aria-label="Minute down">▼</button>
              </div>
            </div>
          </div>

          {/* Done button */}
          <button
            type="button"
            onClick={handleClose}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-text-primary)',
              color: 'var(--color-bg)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginTop: '1px',
              height: '24px',
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

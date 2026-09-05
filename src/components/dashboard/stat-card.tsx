'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface StatCardProps {
  number: number | string;
  label: string;
  isAlarm?: boolean;
}

export function StatCard({ number, label, isAlarm = false }: StatCardProps) {
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (numberRef.current) {
      gsap.fromTo(
        numberRef.current,
        { scale: 0.85, opacity: 0.7 },
        { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' }
      );
    }
  }, [number]);

  return (
    <div className={`stat-card ${isAlarm ? 'alarm-card' : ''}`}>
      <span ref={numberRef} className="stat-number" style={{ display: 'inline-block', willChange: 'transform' }}>
        {number}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

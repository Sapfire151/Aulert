'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('aulert-theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('aulert-theme', next);
    document.documentElement.setAttribute('data-theme', next);

    // Emil Kowalski craft: smooth rotational micro-interaction on trigger
    if (iconRef.current) {
      gsap.fromTo(
        iconRef.current,
        { rotation: -45, scale: 0.8 },
        { rotation: 0, scale: 1, duration: 0.25, ease: 'back.out(2)' }
      );
    }
  };

  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        className={`theme-toggle-btn ${className}`}
        style={{ width: '44px', height: '44px' }}
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`theme-toggle-btn ${className}`}
    >
      <span ref={iconRef} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </span>
    </button>
  );
}

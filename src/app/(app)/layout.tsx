'use client';

import React, { useEffect } from 'react';
import { NavBar } from '@/components/navigation/nav-bar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Capture user's IANA browser timezone on load per PRD & Architecture
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && !localStorage.getItem('aulert-tz')) {
      localStorage.setItem('aulert-tz', tz);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar />
      <main
        className="app-main"
        style={{
          flex: 1,
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}

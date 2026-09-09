'use client';

import React from 'react';

// Pulsing shimmer skeleton block
function Shimmer({ width = '100%', height = '20px', borderRadius = '8px', style = {} }: {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--color-panel)',
        backgroundImage: 'linear-gradient(90deg, var(--color-panel) 0%, var(--color-hairline) 50%, var(--color-panel) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s ease infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

// Skeleton for stat cards row
export function StatCardSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="stat-card"
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          <Shimmer width="52px" height="36px" borderRadius="6px" />
          <Shimmer width="80px" height="13px" borderRadius="4px" />
        </div>
      ))}
    </div>
  );
}

// Skeleton for a single item row
function ItemRowSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 0',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <Shimmer width="18px" height="18px" borderRadius="4px" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <Shimmer width="60%" height="14px" borderRadius="4px" />
        <Shimmer width="35%" height="11px" borderRadius="4px" />
      </div>
      <Shimmer width="56px" height="22px" borderRadius="999px" />
    </div>
  );
}

// Skeleton for the tab + list section
export function ItemListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Tab bar skeleton */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-hairline)',
          paddingBottom: '12px',
        }}
      >
        {[80, 96, 112, 128, 80].map((w, i) => (
          <Shimmer key={i} width={`${w}px`} height="28px" borderRadius="999px" />
        ))}
      </div>
      {/* Search + filter skeleton */}
      <div style={{ display: 'flex', gap: '10px', padding: '16px 0', alignItems: 'center' }}>
        <Shimmer width="240px" height="34px" borderRadius="var(--radius-panel)" />
        <Shimmer width="120px" height="34px" borderRadius="var(--radius-panel)" />
        <Shimmer width="100px" height="34px" borderRadius="var(--radius-panel)" />
      </div>
      {/* List rows */}
      <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
        {[...Array(rows)].map((_, i) => (
          <ItemRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';

interface GhostPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  target?: string;
  rel?: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'muted' | 'alarm' | 'google';
  isActive?: boolean;
  children: React.ReactNode;
}

export function GhostPill({
  href,
  target,
  rel,
  size = 'md',
  variant = 'default',
  isActive = false,
  className = '',
  children,
  ...buttonProps
}: GhostPillProps) {
  const classes = [
    'ghost-pill',
    size === 'sm' ? 'ghost-pill-sm' : '',
    variant === 'muted' && !isActive ? 'ghost-pill-muted' : '',
    variant === 'alarm' ? 'ghost-pill-alarm' : '',
    variant === 'google' ? 'ghost-pill-google' : '',
    isActive ? 'is-active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <Link href={href} target={target} rel={rel} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}

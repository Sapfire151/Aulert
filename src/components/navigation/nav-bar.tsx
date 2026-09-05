'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '../ui/theme-toggle';
import { GhostPill } from '../ui/ghost-pill';
import {
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  BookOpen,
  Settings,
  LogOut,
} from 'lucide-react';

export function NavBar() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id?: string; email?: string; name?: string; avatar?: string } | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/aulert_session=([^;]+)/);
      if (match) {
        try {
          setUser(JSON.parse(decodeURIComponent(match[1])));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aulert-live-items');
      localStorage.removeItem('aulert-live-courses');
      localStorage.removeItem('aulert-last-synced');
      localStorage.removeItem('aulert-custom-homework');
    }
  };

  // Lock body scroll and handle Escape key when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSidebarOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [sidebarOpen]);

  // Close sidebar automatically on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/homework', label: 'Homework', icon: BookOpen },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <header
        className="app-header"
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          height: '72px',
          minHeight: '72px',
          boxSizing: 'border-box',
          backgroundColor: 'var(--color-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            width: '100%',
            height: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          {/* Left: Hamburger (mobile) + Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              className="mobile-only-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation sidebar"
            >
              <Menu size={20} />
            </button>

            <Link
              href="/dashboard"
              style={{
                textDecoration: 'none',
                color: 'var(--color-text-primary)',
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '-0.3px',
                flexShrink: 0,
              }}
            >
              Aulert
            </Link>
          </div>

          {/* Centered Desktop Navigation — constant 500 weight prevents layout shift */}
          <nav className="desktop-only-nav">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    textDecoration: 'none',
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    backgroundColor: isActive ? 'var(--color-panel)' : 'transparent',
                    border: isActive ? '1px solid var(--color-hairline)' : '1px solid transparent',
                    transition: 'color 0.15s var(--ease-out), background-color 0.15s var(--ease-out)',
                  }}
                  className="nav-link-pill"
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Theme + User Profile / Sign In / Sign Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
            <ThemeToggle />

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="desktop-only-signout">
                {user.avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid var(--color-hairline)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-panel)',
                      border: '1px solid var(--color-hairline)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {(user.name || user.email || 'S')[0].toUpperCase()}
                  </div>
                )}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--color-text-primary)',
                  }}
                  title={user.name || user.email}
                >
                  {user.name ? user.name.split(' ')[0] : user.email}
                </span>
                <GhostPill href="/auth/signout" size="sm" variant="alarm" onClick={handleSignOut}>
                  Sign out
                </GhostPill>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="desktop-only-signout">
                <GhostPill href="/api/auth/google" variant="google" size="sm">
                  Sign in
                </GhostPill>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className="sidebar-drawer"
        style={{
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          visibility: sidebarOpen ? 'visible' : 'hidden',
        }}
        aria-label="Mobile Navigation Sidebar"
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-hairline)',
          }}
        >
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            style={{
              textDecoration: 'none',
              color: 'var(--color-text-primary)',
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '-0.2px',
            }}
          >
            Aulert
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation sidebar"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-pill)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              transition: 'background 0.15s var(--ease-out)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Vertical Navigation Links */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginTop: '20px',
            flex: 1,
          }}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon
                  size={18}
                  color={isActive ? 'var(--color-course-1)' : 'var(--color-text-muted)'}
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Drawer Footer */}
        <div
          style={{
            paddingTop: '16px',
            borderTop: '1px solid var(--color-hairline)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="body-ui text-muted" style={{ fontSize: '13px' }}>
              Appearance
            </span>
            <ThemeToggle />
          </div>

          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                {user.avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid var(--color-hairline)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-panel)',
                      border: '1px solid var(--color-hairline)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {(user.name || user.email || 'S')[0].toUpperCase()}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {user.name || 'Student'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </span>
                </div>
              </div>

              <GhostPill
                href="/auth/signout"
                size="sm"
                variant="alarm"
                onClick={handleSignOut}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <LogOut size={14} />
                Sign out
              </GhostPill>
            </>
          ) : (
            <GhostPill
              href="/api/auth/google"
              variant="google"
              size="sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Sign in with Google
            </GhostPill>
          )}
        </div>
      </aside>
    </>
  );
}

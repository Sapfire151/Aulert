'use client';

import { useState, useEffect, useCallback } from 'react';
import { UnifiedItem } from '@/types/aulert';
import { CourseRow } from '@/types/database';
import { DEMO_COURSES, getDemoItems } from '@/lib/data-provider';

export interface UseClassroomDataReturn {
  items: UnifiedItem[];
  courses: CourseRow[];
  isLoading: boolean;
  isSyncing: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
  needsReauth: boolean;
  lastSynced: string | null;
  timeZone: string;
  user: { id?: string; email?: string; name?: string; avatar?: string; timezone?: string } | null;
  syncNow: () => Promise<void>;
  addItem: (item: UnifiedItem) => void;
  updateItem: (item: UnifiedItem) => void;
  deleteItem: (itemId: string) => void;
  toggleComplete: (itemId: string) => void;
}

export function useClassroomData(): UseClassroomDataReturn {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>(DEMO_COURSES);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [needsReauth, setNeedsReauth] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aulert-tz');
      if (stored) return stored;
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) {
          localStorage.setItem('aulert-tz', detected);
          return detected;
        }
      } catch {
        // fallback
      }
    }
    return 'UTC';
  });
  const [user, setUser] = useState<{ id?: string; email?: string; name?: string; avatar?: string; timezone?: string } | null>(null);

  // Fallback cache helper
  const getCachedHomework = (): UnifiedItem[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('aulert-custom-homework');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const setCachedHomework = (customItems: UnifiedItem[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('aulert-custom-homework', JSON.stringify(customItems));
    } catch {}
  };

  // Fetch homework items from backend API
  const fetchBackendHomework = useCallback(async (): Promise<UnifiedItem[]> => {
    try {
      const res = await fetch('/api/homework', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setCachedHomework(data.items);
          return data.items;
        }
      }
    } catch (e) {
      console.warn('[useClassroomData] Failed to fetch backend homework, using cache:', e);
    }
    return getCachedHomework();
  }, []);

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const tzParam = encodeURIComponent(timeZone);
      const res = await fetch(`/api/classroom/sync?tz=${tzParam}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (data.authenticated && !data.isDemo) {
        setIsAuthenticated(true);
        setIsDemo(false);
        setNeedsReauth(false);
        if (data.user) {
          setUser(data.user);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('aulert-user-profile', JSON.stringify(data.user));
              window.dispatchEvent(new CustomEvent('aulert-user-updated', { detail: data.user }));
            } catch {}
          }
        } else {
          setUser(null);
        }

        const liveCourses: CourseRow[] = data.courses || [];
        const liveItems: UnifiedItem[] = data.items || [];
        const backendHomework = await fetchBackendHomework();

        // Merge live classroom items with backend custom homework tasks
        const combined = [...liveItems, ...backendHomework];
        setCourses(liveCourses);
        setItems(combined);
        setLastSynced(data.lastSynced || new Date().toISOString());

        // Cache live data for subsequent loads
        localStorage.setItem('aulert-live-courses', JSON.stringify(liveCourses));
        localStorage.setItem('aulert-live-items', JSON.stringify(liveItems));
        if (data.lastSynced) {
          localStorage.setItem('aulert-last-synced', data.lastSynced);
        }
      } else if (data.needsReauth) {
        setIsAuthenticated(false);
        setNeedsReauth(true);
        setIsDemo(false);
      } else {
        // Preview Mode (Demo) — strictly sample/mockup data only
        setIsAuthenticated(false);
        setIsDemo(true);
        setNeedsReauth(false);
        setCourses(DEMO_COURSES);
        setItems(getDemoItems());
      }
    } catch (err) {
      console.warn('[useClassroomData] Failed to sync with server:', err);
      const cachedItems = localStorage.getItem('aulert-live-items');
      const cachedCourses = localStorage.getItem('aulert-live-courses');
      if (cachedItems && cachedCourses) {
        try {
          const liveItems = JSON.parse(cachedItems);
          const liveCourses = JSON.parse(cachedCourses);
          setItems([...liveItems, ...getCachedHomework()]);
          setCourses(liveCourses);
          setIsAuthenticated(true);
          setIsDemo(false);
        } catch {
          setItems(getDemoItems());
          setCourses(DEMO_COURSES);
        }
      } else {
        setItems(getDemoItems());
        setCourses(DEMO_COURSES);
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [timeZone, fetchBackendHomework]);

  // Initial load
  useEffect(() => {
    if (typeof document !== 'undefined') {
      let sessionUser: any = null;
      const match = document.cookie.match(/aulert_session=([^;]+)/);
      if (match) {
        try {
          const raw = match[1];
          let decoded = raw;
          try {
            decoded = decodeURIComponent(raw);
          } catch {
            decoded = raw;
          }
          sessionUser = JSON.parse(decoded);
          setUser(sessionUser);
          setIsAuthenticated(true);
          setIsDemo(false);
        } catch {}
      }

      if (!sessionUser) {
        try {
          const cachedUser = localStorage.getItem('aulert-user-profile');
          if (cachedUser) {
            sessionUser = JSON.parse(cachedUser);
            setUser(sessionUser);
            setIsAuthenticated(true);
            setIsDemo(false);
          }
        } catch {}
      }

      const cachedLast = localStorage.getItem('aulert-last-synced');
      if (cachedLast) setLastSynced(cachedLast);

      const cachedItems = localStorage.getItem('aulert-live-items');
      const cachedCourses = localStorage.getItem('aulert-live-courses');
      if (cachedItems && cachedCourses && sessionUser) {
        try {
          setItems([...JSON.parse(cachedItems), ...getCachedHomework()]);
          setCourses(JSON.parse(cachedCourses));
          setIsLoading(false);
        } catch {}
      }
    }

    syncData();
  }, [syncData]);

  const addItem = useCallback((item: UnifiedItem) => {
    // Optimistic UI update
    setItems((prev) => [item, ...prev]);

    const cached = getCachedHomework();
    setCachedHomework([item, ...cached]);

    // Backend cloud persistence
    fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }),
    }).catch((e) => console.warn('[useClassroomData] Failed to persist new homework:', e));
  }, []);

  const updateItem = useCallback((updatedItem: UnifiedItem) => {
    // Optimistic UI update
    setItems((prev) =>
      prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
    );

    if (updatedItem.source === 'homework') {
      const cached = getCachedHomework();
      setCachedHomework(cached.map((it) => (it.id === updatedItem.id ? updatedItem : it)));

      // Backend cloud persistence
      fetch('/api/homework', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: updatedItem }),
      }).catch((e) => console.warn('[useClassroomData] Failed to update homework in backend:', e));
    }
  }, []);

  const deleteItem = useCallback((itemId: string) => {
    // Optimistic UI update
    setItems((prev) => prev.filter((it) => it.id !== itemId));

    const cached = getCachedHomework();
    setCachedHomework(cached.filter((it) => it.id !== itemId));

    // Backend cloud deletion
    fetch(`/api/homework?id=${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    }).catch((e) => console.warn('[useClassroomData] Failed to delete homework in backend:', e));
  }, []);

  const toggleComplete = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const nextCompleted = !it.completed;
          const nextStatus = nextCompleted ? 'turned_in' : 'assigned';
          const updated = {
            ...it,
            completed: nextCompleted,
            rawStatus: nextStatus,
            updatedAt: new Date().toISOString(),
          };

          if (it.source === 'homework') {
            const cached = getCachedHomework();
            setCachedHomework(cached.map((c) => (c.id === itemId ? updated : c)));

            fetch('/api/homework', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ item: updated }),
            }).catch((e) => console.warn('[useClassroomData] Failed to update toggleComplete in backend:', e));
          }
          return updated;
        }
        return it;
      })
    );
  }, []);

  return {
    items,
    courses,
    isLoading,
    isSyncing,
    isAuthenticated,
    isDemo,
    needsReauth,
    lastSynced,
    timeZone,
    user,
    syncNow: syncData,
    addItem,
    updateItem,
    deleteItem,
    toggleComplete,
  };
}

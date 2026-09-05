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
  user: { id?: string; email?: string; name?: string; avatar?: string } | null;
  syncNow: () => Promise<void>;
  addItem: (item: UnifiedItem) => void;
  updateItem: (item: UnifiedItem) => void;
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
  const [user, setUser] = useState<{ id?: string; email?: string; name?: string; avatar?: string } | null>(null);

  // Load custom homework items created by user
  const getCustomHomework = (): UnifiedItem[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('aulert-custom-homework');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveCustomHomework = (customItems: UnifiedItem[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('aulert-custom-homework', JSON.stringify(customItems));
  };

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/classroom/sync', {
        cache: 'no-store',
      });
      const data = await res.json();

      const customItems = getCustomHomework();

      if (data.authenticated && !data.isDemo) {
        setIsAuthenticated(true);
        setIsDemo(false);
        setNeedsReauth(false);
        setUser(data.user || null);

        const liveCourses: CourseRow[] = data.courses || [];
        const liveItems: UnifiedItem[] = data.items || [];

        // Merge live classroom items with local custom homework tasks
        const combined = [...liveItems, ...customItems];
        setCourses(liveCourses);
        setItems(combined);
        setLastSynced(data.lastSynced || new Date().toISOString());

        // Cache live data for instant subsequent loads
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
        // Preview Mode (Demo)
        setIsAuthenticated(false);
        setIsDemo(true);
        setNeedsReauth(false);
        setCourses(DEMO_COURSES);

        // In demo mode, load demo items combined with any custom user items
        const demo = getDemoItems();
        setItems([...demo, ...customItems]);
      }
    } catch (err) {
      console.warn('[useClassroomData] Failed to sync with server:', err);
      // Fallback: if cached live items exist, retain them
      const cachedItems = localStorage.getItem('aulert-live-items');
      const cachedCourses = localStorage.getItem('aulert-live-courses');
      if (cachedItems && cachedCourses) {
        try {
          const liveItems = JSON.parse(cachedItems);
          const liveCourses = JSON.parse(cachedCourses);
          setItems([...liveItems, ...getCustomHomework()]);
          setCourses(liveCourses);
          setIsAuthenticated(true);
          setIsDemo(false);
        } catch {
          setItems(getDemoItems());
          setCourses(DEMO_COURSES);
        }
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    // 1. Read session cookie if present
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/aulert_session=([^;]+)/);
      if (match) {
        try {
          const parsed = JSON.parse(decodeURIComponent(match[1]));
          setUser(parsed);
          setIsAuthenticated(true);
          setIsDemo(false);
        } catch {
          // ignore
        }
      }

      // Check cached last synced
      const cachedLast = localStorage.getItem('aulert-last-synced');
      if (cachedLast) setLastSynced(cachedLast);

      // Pre-populate with cached live items if available to avoid flash
      const cachedItems = localStorage.getItem('aulert-live-items');
      const cachedCourses = localStorage.getItem('aulert-live-courses');
      if (cachedItems && cachedCourses) {
        try {
          setItems([...JSON.parse(cachedItems), ...getCustomHomework()]);
          setCourses(JSON.parse(cachedCourses));
          setIsLoading(false);
        } catch {
          // ignore
        }
      }
    }

    // 2. Fetch fresh live data from Classroom API
    syncData();
  }, [syncData]);

  const addItem = useCallback((item: UnifiedItem) => {
    const custom = getCustomHomework();
    const updatedCustom = [item, ...custom];
    saveCustomHomework(updatedCustom);
    setItems((prev) => [item, ...prev]);
  }, []);

  const updateItem = useCallback((updatedItem: UnifiedItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
    );
    if (updatedItem.source === 'homework') {
      const custom = getCustomHomework();
      const updated = custom.map((it) => (it.id === updatedItem.id ? updatedItem : it));
      saveCustomHomework(updated);
    }
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
            const custom = getCustomHomework();
            const nextCustom = custom.map((c) => (c.id === itemId ? updated : c));
            saveCustomHomework(nextCustom);
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
    user,
    syncNow: syncData,
    addItem,
    updateItem,
    toggleComplete,
  };
}

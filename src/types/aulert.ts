import { CourseColor, CourseRow } from './database';

export interface UnifiedItem {
  id: string;
  source: 'classroom' | 'homework';
  title: string;
  description?: string | null;
  dueAt: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueThisWeek: boolean;
  completed: boolean;
  courseId?: string | null;
  courseName?: string | null;
  courseColor?: CourseColor;
  link?: string | null;
  rawStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  overdueCount: number;
  dueThisWeekCount: number;
  completedThisMonthCount: number;
  needsReauth: boolean;
}

export type UrgencyBucket = 'overdue' | 'today' | 'this_week' | 'later' | 'completed';

export interface BucketedItems {
  overdue: UnifiedItem[];
  today: UnifiedItem[];
  thisWeek: UnifiedItem[];
  later: UnifiedItem[];
  completed: UnifiedItem[];
}

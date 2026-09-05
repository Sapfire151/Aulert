import { CourseColor, CourseRow } from './database';

export type ClassroomItemType = 'assignment' | 'short_answer_question' | 'multiple_choice_question' | 'announcement' | 'material' | 'grade';

export interface UnifiedItem {
  id: string;
  source: 'classroom' | 'homework';
  itemType: ClassroomItemType | 'homework';
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
  /** Assigned grade (0-100) — present on grade-type items */
  grade?: number | null;
  /** Max possible points */
  maxPoints?: number | null;
  /** For announcements: the text content */
  text?: string | null;
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

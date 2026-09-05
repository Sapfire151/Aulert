import { CourseRow } from '@/types/database';
import { UnifiedItem, DashboardStats } from '@/types/aulert';
import { bucketUnifiedItems, isOverdueInTimezone, isDueThisWeekInTimezone } from './date-utils';

export const DEMO_COURSES: CourseRow[] = [
  {
    id: 'course-calc',
    user_id: 'user-demo',
    classroom_course_id: 'cls-101',
    name: 'AP Calculus BC',
    color: 'course-1',
    created_at: new Date().toISOString(),
  },
  {
    id: 'course-hist',
    user_id: 'user-demo',
    classroom_course_id: 'cls-102',
    name: 'AP World History',
    color: 'course-2',
    created_at: new Date().toISOString(),
  },
  {
    id: 'course-phys',
    user_id: 'user-demo',
    classroom_course_id: 'cls-103',
    name: 'AP Physics C: Mechanics',
    color: 'course-3',
    created_at: new Date().toISOString(),
  },
  {
    id: 'course-eng',
    user_id: 'user-demo',
    classroom_course_id: 'cls-104',
    name: 'English Literature',
    color: 'course-4',
    created_at: new Date().toISOString(),
  },
];

export function getDemoItems(): UnifiedItem[] {
  const now = new Date();
  
  // Yesterday (overdue)
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(23, 59, 0, 0);

  // Today at 23:59
  const todayNight = new Date(now);
  todayNight.setHours(23, 59, 0, 0);

  // In 2 days
  const inTwoDays = new Date(now);
  inTwoDays.setDate(now.getDate() + 2);
  inTwoDays.setHours(17, 0, 0, 0);

  // In 4 days
  const inFourDays = new Date(now);
  inFourDays.setDate(now.getDate() + 4);
  inFourDays.setHours(23, 59, 0, 0);

  // Completed last week
  const lastWeek = new Date(now);
  lastWeek.setDate(now.getDate() - 6);

  return [
    {
      id: 'item-1',
      source: 'classroom',
      title: 'Problem Set 4: Integration by Parts & Partial Fractions',
      description: 'Complete problems 1 through 18 in section 7.2. Submit PDF scan to Google Classroom.',
      dueAt: yesterday.toISOString(),
      isOverdue: true,
      isDueToday: false,
      isDueThisWeek: false,
      completed: false,
      courseId: 'course-calc',
      courseName: 'AP Calculus BC',
      courseColor: 'course-1',
      link: 'https://classroom.google.com',
      rawStatus: 'assigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item-2',
      source: 'classroom',
      title: 'DBQ Essay Outline: Industrialization in the Americas',
      description: 'Draft the thesis statement and outline primary evidence documents 1–5.',
      dueAt: todayNight.toISOString(),
      isOverdue: false,
      isDueToday: true,
      isDueThisWeek: true,
      completed: false,
      courseId: 'course-hist',
      courseName: 'AP World History',
      courseColor: 'course-2',
      link: 'https://classroom.google.com',
      rawStatus: 'assigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item-3',
      source: 'homework',
      title: 'Review Physics Rotational Dynamics formula sheet',
      description: 'Double check moment of inertia derivations before lab quiz.',
      dueAt: inTwoDays.toISOString(),
      isOverdue: false,
      isDueToday: false,
      isDueThisWeek: true,
      completed: false,
      courseId: 'course-phys',
      courseName: 'AP Physics C: Mechanics',
      courseColor: 'course-3',
      link: null,
      rawStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item-4',
      source: 'classroom',
      title: 'Poetry Analysis: Close Reading of Sonnet 116',
      description: 'Write a 500-word critical reflection on the volta and tone.',
      dueAt: inFourDays.toISOString(),
      isOverdue: false,
      isDueToday: false,
      isDueThisWeek: true,
      completed: false,
      courseId: 'course-eng',
      courseName: 'English Literature',
      courseColor: 'course-4',
      link: 'https://classroom.google.com',
      rawStatus: 'assigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item-5',
      source: 'classroom',
      title: 'Lab 2: Conservation of Linear Momentum',
      description: 'Calculations and collision graphs submitted.',
      dueAt: lastWeek.toISOString(),
      isOverdue: false,
      isDueToday: false,
      isDueThisWeek: false,
      completed: true,
      courseId: 'course-phys',
      courseName: 'AP Physics C: Mechanics',
      courseColor: 'course-3',
      link: 'https://classroom.google.com',
      rawStatus: 'turned_in',
      createdAt: lastWeek.toISOString(),
      updatedAt: lastWeek.toISOString(),
    },
  ];
}

export function computeDashboardStats(items: UnifiedItem[], timeZone: string): DashboardStats {
  let overdueCount = 0;
  let dueThisWeekCount = 0;
  let completedThisMonthCount = 0;

  for (const item of items) {
    if (item.completed) {
      completedThisMonthCount++;
    } else if (item.dueAt) {
      if (isOverdueInTimezone(item.dueAt, timeZone)) {
        overdueCount++;
      } else if (isDueThisWeekInTimezone(item.dueAt, timeZone)) {
        dueThisWeekCount++;
      }
    }
  }

  return {
    overdueCount,
    dueThisWeekCount,
    completedThisMonthCount,
    needsReauth: false,
  };
}

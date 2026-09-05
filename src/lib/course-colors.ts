import { CourseColor } from '@/types/database';

export const COURSE_COLORS: CourseColor[] = [
  'course-1', // Green (#0ae448 dark / #0B8A2E light)
  'course-2', // Pink (#fec5fb dark / #B23FA8 light)
  'course-3', // Lilac (#9d95ff dark / #5B4FD1 light)
  'course-4', // Blue (#00bae2 dark / #0089A8 light)
];

/**
 * Resolves a course color index safely using modulo rotation.
 * Guarantees that Alarm Orange is NEVER assigned to a course,
 * preserving Alarm Orange strictly for overdue/urgent semantics.
 */
export function getCourseColorByIndex(index: number): CourseColor {
  const safeIndex = Math.abs(index) % COURSE_COLORS.length;
  return COURSE_COLORS[safeIndex];
}

/**
 * Maps a course color token to its corresponding CSS class.
 */
export function getCourseColorClass(color?: CourseColor | null): string {
  switch (color) {
    case 'course-1': return 'course-color-1';
    case 'course-2': return 'course-color-2';
    case 'course-3': return 'course-color-3';
    case 'course-4': return 'course-color-4';
    default: return 'text-muted';
  }
}

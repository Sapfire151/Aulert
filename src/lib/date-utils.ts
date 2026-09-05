import { BucketedItems, UnifiedItem } from '@/types/aulert';

/**
 * Returns the current date/time parts in the specified IANA timezone.
 */
export function getNowInTimezone(timeZone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    return new Date(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      parseInt(map.hour, 10),
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    );
  } catch {
    return new Date();
  }
}

/**
 * Converts an ISO string into Date representation in user timezone.
 */
export function parseDateInTimezone(isoString: string, timeZone: string): Date {
  const d = new Date(isoString);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    return new Date(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      parseInt(map.hour, 10),
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    );
  } catch {
    return d;
  }
}

/**
 * Checks if a given due date is overdue compared to user's local "now".
 */
export function isOverdueInTimezone(dueAtIso: string | null | undefined, timeZone: string): boolean {
  if (!dueAtIso) return false;
  const dueDate = new Date(dueAtIso);
  const now = new Date();
  return dueDate.getTime() < now.getTime();
}

/**
 * Checks if a due date falls on the user's current calendar day.
 */
export function isDueTodayInTimezone(dueAtIso: string | null | undefined, timeZone: string): boolean {
  if (!dueAtIso) return false;
  const nowInTz = getNowInTimezone(timeZone);
  const dueInTz = parseDateInTimezone(dueAtIso, timeZone);

  return (
    nowInTz.getFullYear() === dueInTz.getFullYear() &&
    nowInTz.getMonth() === dueInTz.getMonth() &&
    nowInTz.getDate() === dueInTz.getDate()
  );
}

/**
 * Checks if a due date falls within the user's current week (from now through Sunday).
 */
export function isDueThisWeekInTimezone(dueAtIso: string | null | undefined, timeZone: string): boolean {
  if (!dueAtIso) return false;
  const nowInTz = getNowInTimezone(timeZone);
  const dueInTz = parseDateInTimezone(dueAtIso, timeZone);

  // End of current week (upcoming Sunday 23:59:59)
  const dayOfWeek = nowInTz.getDay(); // 0 is Sunday, 1 is Monday
  const daysUntilEndOfWeek = (7 - dayOfWeek) % 7;
  const endOfWeek = new Date(nowInTz);
  endOfWeek.setDate(nowInTz.getDate() + daysUntilEndOfWeek);
  endOfWeek.setHours(23, 59, 59, 999);

  return dueInTz >= nowInTz && dueInTz <= endOfWeek;
}

/**
 * Buckets items for Dashboard and Homework views.
 */
export function bucketUnifiedItems(items: UnifiedItem[], timeZone: string): BucketedItems {
  const buckets: BucketedItems = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    completed: [],
  };

  for (const item of items) {
    if (item.completed) {
      buckets.completed.push(item);
      continue;
    }

    if (item.dueAt) {
      if (isOverdueInTimezone(item.dueAt, timeZone)) {
        buckets.overdue.push(item);
      } else if (isDueTodayInTimezone(item.dueAt, timeZone)) {
        buckets.today.push(item);
      } else if (isDueThisWeekInTimezone(item.dueAt, timeZone)) {
        buckets.thisWeek.push(item);
      } else {
        buckets.later.push(item);
      }
    } else {
      buckets.later.push(item);
    }
  }

  // Sort within buckets by due date ascending
  const sortByDue = (a: UnifiedItem, b: UnifiedItem) => {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  };

  buckets.overdue.sort(sortByDue);
  buckets.today.sort(sortByDue);
  buckets.thisWeek.sort(sortByDue);
  buckets.later.sort(sortByDue);
  buckets.completed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return buckets;
}

/**
 * Format due date for clean UI display.
 */
export function formatDueDateDisplay(dueAtIso: string | null | undefined, timeZone: string): string {
  if (!dueAtIso) return 'No deadline';
  const isOverdue = isOverdueInTimezone(dueAtIso, timeZone);
  const isToday = isDueTodayInTimezone(dueAtIso, timeZone);

  const d = new Date(dueAtIso);
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const timeStr = timeFormatter.format(d);

  if (isToday) {
    return isOverdue ? `Overdue today (${timeStr})` : `Due today, ${timeStr}`;
  }

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  });
  const dateStr = dateFormatter.format(d);

  return isOverdue ? `Overdue (${dateStr})` : `Due ${dateStr}, ${timeStr}`;
}

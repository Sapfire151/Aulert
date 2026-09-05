export interface DiscordEmbedPayload {
  title: string;
  description?: string;
  url?: string;
  color: number; // Decimal color
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

// Decimal color constants
export const EMBED_COLORS = {
  ALARM_ORANGE: 0xff8709, // For Overdue / Late Pings
  COURSE_GREEN: 0x0ae448,
  COURSE_PINK: 0xfec5fb,
  COURSE_LILAC: 0x9d95ff,
  COURSE_BLUE: 0x00bae2,
  DEFAULT: 0xfffce1,
};

export function buildAlertEmbed(params: {
  triggerType: 'instant' | 'late';
  itemTitle: string;
  courseName?: string | null;
  dueAtFormatted?: string | null;
  link?: string | null;
  source: 'classroom' | 'homework';
}): DiscordEmbedPayload {
  const isLate = params.triggerType === 'late';
  const color = isLate ? EMBED_COLORS.ALARM_ORANGE : EMBED_COLORS.COURSE_BLUE;

  const headerPrefix = isLate ? '⚠️ Overdue Alert' : '🔔 New Assignment';

  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (params.courseName) {
    fields.push({
      name: 'Course',
      value: params.courseName,
      inline: true,
    });
  }

  if (params.dueAtFormatted) {
    fields.push({
      name: isLate ? 'Was Due' : 'Due Date',
      value: params.dueAtFormatted,
      inline: true,
    });
  }

  fields.push({
    name: 'Source',
    value: params.source === 'classroom' ? 'Google Classroom' : 'Custom Homework',
    inline: true,
  });

  return {
    title: `${headerPrefix}: ${params.itemTitle}`,
    url: params.link || undefined,
    color,
    fields,
    footer: {
      text: 'Aulert • Keep deadlines in sight',
    },
    timestamp: new Date().toISOString(),
  };
}

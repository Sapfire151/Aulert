export type CourseColor = 'course-1' | 'course-2' | 'course-3' | 'course-4';

export interface UserRow {
  id: string;
  google_id: string | null;
  email: string;
  discord_user_id: string | null;
  timezone: string;
  needs_reauth: boolean;
  pubsub_subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseRow {
  id: string;
  user_id: string;
  classroom_course_id: string;
  name: string;
  color: CourseColor;
  created_at: string;
}

export interface ClassroomItemRow {
  id: string;
  course_id: string;
  classroom_item_id: string;
  type: 'assignment' | 'announcement';
  title: string;
  description: string | null;
  due_at: string | null;
  submission_status: string;
  link: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomeworkItemRow {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  due_at: string | null;
  notes: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscordConnectionRow {
  id: string;
  user_id: string;
  type: 'webhook' | 'bot_channel';
  webhook_url_vault_id: string | null;
  webhook_url_ciphertext: string | null;
  channel_id: string | null;
  guild_id: string | null;
  channel_name: string | null;
  guild_name: string | null;
  muted: boolean;
  status: 'active' | 'broken';
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

export interface AlertLogRow {
  id: string;
  user_id: string;
  item_id: string;
  item_type: 'classroom_item' | 'homework_item';
  trigger_type: 'instant' | 'late';
  sent_via: 'dm' | 'bot_channel' | 'webhook';
  sent_at: string;
  idempotency_key: string;
}

export interface WebhookSendQueueRow {
  id: string;
  user_id: string;
  connection_id: string;
  payload: Record<string, any>;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string;
  error: string | null;
  created_at: string;
}

export interface PendingClassroomReadRow {
  id: string;
  user_id: string;
  classroom_item_id: string;
  created_at: string;
}

export interface SystemLogRow {
  id: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  source: string;
  message: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

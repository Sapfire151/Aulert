import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { UnifiedItem } from '@/types/aulert';
import { DiscordConnectionRow } from '@/types/database';
import { createAdminClient } from '@/lib/supabase/admin';

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'aulert.db');
  const db = new DatabaseSync(dbPath);

  // Initialize SQLite tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS homework_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      course_id TEXT,
      course_name TEXT,
      course_color TEXT,
      title TEXT NOT NULL,
      description TEXT,
      due_at TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      raw_status TEXT NOT NULL DEFAULT 'assigned',
      source TEXT NOT NULL DEFAULT 'homework',
      item_type TEXT NOT NULL DEFAULT 'homework',
      link TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discord_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      webhook_url_ciphertext TEXT,
      channel_id TEXT,
      guild_id TEXT,
      channel_name TEXT,
      guild_name TEXT,
      muted INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      theme TEXT NOT NULL DEFAULT 'dark',
      updated_at TEXT NOT NULL
    );
  `);

  dbInstance = db;
  return dbInstance;
}

// --------------------------------------------------------------------------
// Homework Items Backend Operations
// --------------------------------------------------------------------------

export function getHomeworkItemsFromDb(userId: string): UnifiedItem[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM homework_items 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId) as any[];

  return rows.map((r) => ({
    id: r.id,
    source: (r.source || 'homework') as 'classroom' | 'homework',
    itemType: (r.item_type || 'homework') as any,
    title: r.title,
    description: r.description || null,
    dueAt: r.due_at || null,
    isOverdue: false,
    isDueToday: false,
    isDueThisWeek: false,
    completed: Boolean(r.completed),
    courseId: r.course_id || null,
    courseName: r.course_name || null,
    courseColor: r.course_color || undefined,
    link: r.link || null,
    rawStatus: r.raw_status || (r.completed ? 'turned_in' : 'assigned'),
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  }));
}

export function saveHomeworkItemToDb(item: UnifiedItem, userId: string): UnifiedItem {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO homework_items (
      id, user_id, course_id, course_name, course_color,
      title, description, due_at, completed, raw_status,
      source, item_type, link, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      course_id = excluded.course_id,
      course_name = excluded.course_name,
      course_color = excluded.course_color,
      title = excluded.title,
      description = excluded.description,
      due_at = excluded.due_at,
      completed = excluded.completed,
      raw_status = excluded.raw_status,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    item.id,
    userId,
    item.courseId || null,
    item.courseName || null,
    item.courseColor || null,
    item.title,
    item.description || null,
    item.dueAt || null,
    item.completed ? 1 : 0,
    item.rawStatus || (item.completed ? 'turned_in' : 'assigned'),
    item.source || 'homework',
    item.itemType || 'homework',
    item.link || null,
    item.createdAt || new Date().toISOString(),
    item.updatedAt || new Date().toISOString()
  );

  // Background sync to Supabase if table becomes available
  syncHomeworkToSupabase(item, userId).catch(() => {});

  return item;
}

export function deleteHomeworkItemFromDb(id: string, userId?: string): boolean {
  const db = getDb();
  if (userId) {
    const stmt = db.prepare('DELETE FROM homework_items WHERE id = ? AND user_id = ?');
    stmt.run(id, userId);
  } else {
    const stmt = db.prepare('DELETE FROM homework_items WHERE id = ?');
    stmt.run(id);
  }

  // Background delete from Supabase
  syncDeleteHomeworkFromSupabase(id).catch(() => {});
  return true;
}

// --------------------------------------------------------------------------
// Discord Connections Backend Operations
// --------------------------------------------------------------------------

export function getDiscordConnectionsFromDb(userId: string): DiscordConnectionRow[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM discord_connections 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId) as any[];

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    type: r.type,
    webhook_url_vault_id: null,
    webhook_url_ciphertext: r.webhook_url_ciphertext || null,
    channel_id: r.channel_id || null,
    guild_id: r.guild_id || null,
    channel_name: r.channel_name || null,
    guild_name: r.guild_name || null,
    muted: Boolean(r.muted),
    status: r.status || 'active',
    consecutive_failures: Number(r.consecutive_failures || 0),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function saveDiscordConnectionToDb(conn: Partial<DiscordConnectionRow> & { id: string; user_id: string }): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO discord_connections (
      id, user_id, type, webhook_url_ciphertext,
      channel_id, guild_id, channel_name, guild_name,
      muted, status, consecutive_failures, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      webhook_url_ciphertext = excluded.webhook_url_ciphertext,
      channel_id = excluded.channel_id,
      guild_id = excluded.guild_id,
      channel_name = excluded.channel_name,
      guild_name = excluded.guild_name,
      muted = excluded.muted,
      status = excluded.status,
      consecutive_failures = excluded.consecutive_failures,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    conn.id,
    conn.user_id,
    conn.type || 'webhook',
    conn.webhook_url_ciphertext || null,
    conn.channel_id || null,
    conn.guild_id || null,
    conn.channel_name || null,
    conn.guild_name || null,
    conn.muted ? 1 : 0,
    conn.status || 'active',
    conn.consecutive_failures || 0,
    conn.created_at || new Date().toISOString(),
    conn.updated_at || new Date().toISOString()
  );
}

export function toggleMuteConnectionInDb(id: string, userId: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE discord_connections 
    SET muted = CASE WHEN muted = 1 THEN 0 ELSE 1 END,
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `);
  stmt.run(new Date().toISOString(), id, userId);
  return true;
}

export function deleteDiscordConnectionFromDb(id: string, userId?: string): boolean {
  const db = getDb();
  if (userId) {
    const stmt = db.prepare('DELETE FROM discord_connections WHERE id = ? AND user_id = ?');
    stmt.run(id, userId);
  } else {
    const stmt = db.prepare('DELETE FROM discord_connections WHERE id = ?');
    stmt.run(id);
  }
  return true;
}

// --------------------------------------------------------------------------
// Supabase Background Sync Helpers
// --------------------------------------------------------------------------

async function syncHomeworkToSupabase(item: UnifiedItem, userId: string) {
  try {
    const supabase = createAdminClient();
    await supabase.from('homework_items').upsert({
      id: item.id,
      user_id: userId,
      title: item.title,
      due_at: item.dueAt,
      notes: item.description,
      completed: item.completed,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Fail silently if remote table is not configured
  }
}

async function syncDeleteHomeworkFromSupabase(id: string) {
  try {
    const supabase = createAdminClient();
    await supabase.from('homework_items').delete().eq('id', id);
  } catch {
    // Fail silently if remote table is not configured
  }
}

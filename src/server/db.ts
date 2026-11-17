import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";

mkdirSync(config.dataDir, { recursive: true });

export const db = new Database(join(config.dataDir, "companion.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    is_proactive INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK(kind IN ('summary', 'pin')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const defaults: Record<string, string> = {
  companion_name: config.companionName,
  user_nickname: config.userNickname,
  proactive_enabled: config.proactiveEnabled ? "1" : "0",
  last_proactive_date: "",
};

const insertSetting = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
);
for (const [key, value] of Object.entries(defaults)) {
  insertSetting.run(key, value);
}

export type MessageRow = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  is_proactive: number;
  created_at: string;
};

export type MemoryRow = {
  id: number;
  kind: "summary" | "pin";
  content: string;
  created_at: string;
  updated_at: string;
};

export function getSetting(key: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? "";
}

export function setSetting(key: string, value: string) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function listMessages(limit = 200): MessageRow[] {
  return db
    .prepare(
      `SELECT id, role, content, is_proactive, created_at
       FROM messages
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(limit)
    .reverse() as MessageRow[];
}

export function recentMessages(limit: number): MessageRow[] {
  return db
    .prepare(
      `SELECT id, role, content, is_proactive, created_at
       FROM messages
       WHERE role IN ('user', 'assistant')
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(limit)
    .reverse() as MessageRow[];
}

export function insertMessage(
  role: "user" | "assistant" | "system",
  content: string,
  isProactive = false,
): MessageRow {
  const info = db
    .prepare(
      `INSERT INTO messages (role, content, is_proactive) VALUES (?, ?, ?)`,
    )
    .run(role, content, isProactive ? 1 : 0);
  return db
    .prepare(
      `SELECT id, role, content, is_proactive, created_at FROM messages WHERE id = ?`,
    )
    .get(info.lastInsertRowid) as MessageRow;
}

export function countUserMessages(): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM messages WHERE role = 'user'`)
    .get() as { c: number };
  return row.c;
}

export function listMemories(): MemoryRow[] {
  return db
    .prepare(
      `SELECT id, kind, content, created_at, updated_at FROM memories ORDER BY id ASC`,
    )
    .all() as MemoryRow[];
}

export function addPin(content: string): MemoryRow {
  const info = db
    .prepare(`INSERT INTO memories (kind, content) VALUES ('pin', ?)`)
    .run(content);
  return db
    .prepare(
      `SELECT id, kind, content, created_at, updated_at FROM memories WHERE id = ?`,
    )
    .get(info.lastInsertRowid) as MemoryRow;
}

export function upsertSummary(content: string): MemoryRow {
  const existing = db
    .prepare(`SELECT id FROM memories WHERE kind = 'summary' LIMIT 1`)
    .get() as { id: number } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE memories SET content = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(content, existing.id);
    return db
      .prepare(
        `SELECT id, kind, content, created_at, updated_at FROM memories WHERE id = ?`,
      )
      .get(existing.id) as MemoryRow;
  }
  const info = db
    .prepare(`INSERT INTO memories (kind, content) VALUES ('summary', ?)`)
    .run(content);
  return db
    .prepare(
      `SELECT id, kind, content, created_at, updated_at FROM memories WHERE id = ?`,
    )
    .get(info.lastInsertRowid) as MemoryRow;
}

export function clearMemories() {
  db.prepare(`DELETE FROM memories`).run();
}

export function clearMessages() {
  db.prepare(`DELETE FROM messages`).run();
}

export function hasUserMessageOnLocalDate(dateYmd: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM messages
       WHERE role = 'user'
         AND date(created_at, 'localtime') = ?
       LIMIT 1`,
    )
    .get(dateYmd) as { ok: number } | undefined;
  return Boolean(row);
}

export function hasProactiveOnLocalDate(dateYmd: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM messages
       WHERE is_proactive = 1
         AND date(created_at, 'localtime') = ?
       LIMIT 1`,
    )
    .get(dateYmd) as { ok: number } | undefined;
  return Boolean(row);
}

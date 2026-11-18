import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { MemoryRow, MessageRow, MessageStore } from "../ports/store.js";

type SqliteDb = {
  pragma: (s: string) => unknown;
  exec: (s: string) => unknown;
  prepare: (s: string) => {
    run: (...args: unknown[]) => { lastInsertRowid: number | bigint };
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

function openDatabase(dbPath: string): SqliteDb {
  let Database: new (path: string) => SqliteDb;
  try {
    const require = createRequire(import.meta.url);
    Database = require("better-sqlite3") as new (path: string) => SqliteDb;
  } catch {
    throw new Error(
      "createSqliteMessageStore 需要 better-sqlite3。请在宿主安装：npm i better-sqlite3",
    );
  }
  mkdirSync(dirname(dbPath), { recursive: true });
  return new Database(dbPath);
}

export type SqliteMessageStoreOptions = {
  /** sqlite 文件路径 */
  path: string;
  defaults?: Record<string, string>;
};

/** 基于 better-sqlite3 的 MessageStore（peer 可选依赖） */
export function createSqliteMessageStore(
  opts: SqliteMessageStoreOptions,
): MessageStore {
  const db = openDatabase(opts.path);
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

  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
  );
  for (const [key, value] of Object.entries(opts.defaults ?? {})) {
    insertSetting.run(key, value);
  }

  return {
    get(key) {
      const row = db
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get(key) as { value: string } | undefined;
      return row?.value ?? "";
    },
    set(key, value) {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(key, value);
    },
    listMessages(limit = 200) {
      return db
        .prepare(
          `SELECT id, role, content, is_proactive, created_at
           FROM messages ORDER BY id DESC LIMIT ?`,
        )
        .all(limit)
        .reverse() as MessageRow[];
    },
    recentMessages(limit) {
      return db
        .prepare(
          `SELECT id, role, content, is_proactive, created_at
           FROM messages
           WHERE role IN ('user', 'assistant')
           ORDER BY id DESC LIMIT ?`,
        )
        .all(limit)
        .reverse() as MessageRow[];
    },
    insertMessage(role, content, isProactive = false) {
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
    },
    countUserMessages() {
      const row = db
        .prepare(`SELECT COUNT(*) AS c FROM messages WHERE role = 'user'`)
        .get() as { c: number };
      return row.c;
    },
    listMemories() {
      return db
        .prepare(
          `SELECT id, kind, content, created_at, updated_at FROM memories ORDER BY id ASC`,
        )
        .all() as MemoryRow[];
    },
    addPin(content) {
      const info = db
        .prepare(`INSERT INTO memories (kind, content) VALUES ('pin', ?)`)
        .run(content);
      return db
        .prepare(
          `SELECT id, kind, content, created_at, updated_at FROM memories WHERE id = ?`,
        )
        .get(info.lastInsertRowid) as MemoryRow;
    },
    upsertSummary(content) {
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
    },
    clearMemories() {
      db.prepare(`DELETE FROM memories`).run();
    },
    clearMessages() {
      db.prepare(`DELETE FROM messages`).run();
    },
    hasUserMessageOnLocalDate(dateYmd) {
      const row = db
        .prepare(
          `SELECT 1 AS ok FROM messages
           WHERE role = 'user' AND date(created_at, 'localtime') = ?
           LIMIT 1`,
        )
        .get(dateYmd) as { ok: number } | undefined;
      return Boolean(row);
    },
    hasProactiveOnLocalDate(dateYmd) {
      const row = db
        .prepare(
          `SELECT 1 AS ok FROM messages
           WHERE is_proactive = 1 AND date(created_at, 'localtime') = ?
           LIMIT 1`,
        )
        .get(dateYmd) as { ok: number } | undefined;
      return Boolean(row);
    },
  };
}

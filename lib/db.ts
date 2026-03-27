import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const DB_PATH = path.join(process.cwd(), "german-tracker.db");

const sqlite = new Database(DB_PATH);

// Enable WAL mode and set busy timeout for concurrent build workers
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");

// Run migrations inline (create tables if not exist)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    goal_hours REAL NOT NULL DEFAULT 500,
    goal_date TEXT NOT NULL DEFAULT '2026-12-31'
  );

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes REAL,
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  INSERT OR IGNORE INTO settings (id, goal_hours, goal_date) VALUES (1, 500, '2026-12-31');
`);

// Create resources table if it doesn't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'link' CHECK(type IN ('link', 'kurs', 'buch', 'video', 'sonstiges')),
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add issue_id column to sessions if it doesn't exist yet (safe migration)
try {
  sqlite.exec(`ALTER TABLE sessions ADD COLUMN issue_id INTEGER REFERENCES issues(id) ON DELETE SET NULL;`);
} catch {
  // Column already exists, ignore
}

sqlite.exec(`

  INSERT OR IGNORE INTO topics (id, name, color, created_at) VALUES
    (1, 'Anki – Vokabeln', '#8b5cf6', datetime('now')),
    (2, 'Grammatik', '#3b82f6', datetime('now')),
    (3, 'Hören', '#22c55e', datetime('now')),
    (4, 'Sprechen', '#f97316', datetime('now')),
    (5, 'Lesen', '#14b8a6', datetime('now')),
    (6, 'Schreiben', '#ec4899', datetime('now')),
    (7, 'Kurs', '#eab308', datetime('now')),
    (8, 'Aussprache', '#6366f1', datetime('now'));
`);

export const db = drizzle(sqlite, { schema });

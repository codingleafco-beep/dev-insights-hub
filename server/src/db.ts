import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.LOVEHOG_DB ?? "./data/lovehog.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    ts INTEGER NOT NULL,
    event TEXT NOT NULL,
    distinct_id TEXT,
    session_id TEXT,
    url TEXT,
    referrer TEXT,
    user_agent TEXT,
    properties TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
  CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_distinct ON events(distinct_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    distinct_id TEXT,
    started_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    pageviews INTEGER DEFAULT 0,
    events INTEGER DEFAULT 0,
    user_agent TEXT,
    entry_url TEXT
  );

  CREATE TABLE IF NOT EXISTS flags (
    key TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 0,
    rollout INTEGER NOT NULL DEFAULT 100,
    variants TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    distinct_id TEXT,
    ts INTEGER NOT NULL,
    duration INTEGER DEFAULT 0,
    chunks INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_recordings_session ON recordings(session_id);

  CREATE TABLE IF NOT EXISTS recording_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chunks_rec ON recording_chunks(recording_id, ts);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS notification_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    event TEXT NOT NULL,
    condition TEXT,
    topic TEXT,
    priority INTEGER DEFAULT 3,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
`);

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

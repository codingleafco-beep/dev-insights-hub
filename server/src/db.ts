import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";

const DB_PATH = process.env.LOVEHOG_DB ?? "./data/lovehog.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    project_id TEXT,
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
  CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    distinct_id TEXT,
    started_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    pageviews INTEGER DEFAULT 0,
    events INTEGER DEFAULT 0,
    user_agent TEXT,
    entry_url TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);

  CREATE TABLE IF NOT EXISTS flags (
    project_id TEXT NOT NULL,
    key TEXT NOT NULL,
    name TEXT,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 0,
    rollout INTEGER NOT NULL DEFAULT 100,
    variants TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (project_id, key)
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    session_id TEXT NOT NULL,
    distinct_id TEXT,
    ts INTEGER NOT NULL,
    duration INTEGER DEFAULT 0,
    chunks INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_recordings_session ON recordings(session_id);
  CREATE INDEX IF NOT EXISTS idx_recordings_project ON recordings(project_id);

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
    project_id TEXT,
    name TEXT NOT NULL,
    event TEXT NOT NULL,
    condition TEXT,
    topic TEXT,
    priority INTEGER DEFAULT 3,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
`);

/* ───────── Lightweight migrations for pre-multi-project DBs ───────── */
function hasColumn(table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === col);
}

for (const t of ["events", "sessions", "recordings", "notification_rules"]) {
  if (!hasColumn(t, "project_id")) {
    db.exec(`ALTER TABLE ${t} ADD COLUMN project_id TEXT`);
  }
}

// flags: if the old single-PK schema is still in place, rebuild it.
const flagInfo = db.prepare(`PRAGMA table_info(flags)`).all() as {
  name: string;
  pk: number;
}[];
const flagsHasProject = flagInfo.some((c) => c.name === "project_id");
if (!flagsHasProject && flagInfo.length) {
  db.exec(`
    ALTER TABLE flags RENAME TO flags_old;
    CREATE TABLE flags (
      project_id TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      rollout INTEGER NOT NULL DEFAULT 100,
      variants TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (project_id, key)
    );
  `);
}

/* ───────── Ensure a default project exists ───────── */
export function ensureDefaultProject(): { id: string; api_key: string; name: string } {
  const existing = db.prepare("SELECT * FROM projects LIMIT 1").get() as any;
  if (existing) return existing;
  const id = nanoid(12);
  const api_key = `lh_${nanoid(28)}`;
  db.prepare(
    "INSERT INTO projects(id, name, api_key, created_at) VALUES(?,?,?,?)",
  ).run(id, "Default", api_key, Date.now());

  // Backfill any pre-existing rows so the old data shows up under Default.
  for (const t of [
    "events",
    "sessions",
    "recordings",
    "notification_rules",
  ]) {
    db.prepare(`UPDATE ${t} SET project_id = ? WHERE project_id IS NULL`).run(id);
  }
  // Migrate old flags rows (if any) into the new flags table under default.
  const oldFlags = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='flags_old'",
    )
    .get();
  if (oldFlags) {
    const rows = db.prepare("SELECT * FROM flags_old").all() as any[];
    const ins = db.prepare(
      `INSERT OR IGNORE INTO flags(project_id, key, name, description, enabled, rollout, variants, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?)`,
    );
    for (const f of rows) {
      ins.run(
        id,
        f.key,
        f.name,
        f.description,
        f.enabled,
        f.rollout,
        f.variants,
        f.created_at,
        f.updated_at,
      );
    }
    db.exec("DROP TABLE flags_old");
  }
  return { id, api_key, name: "Default" };
}

export function getProjectByApiKey(key: string) {
  return db.prepare("SELECT * FROM projects WHERE api_key = ?").get(key) as
    | { id: string; name: string; api_key: string }
    | undefined;
}

export function getProjectById(id: string) {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | { id: string; name: string; api_key: string }
    | undefined;
}

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

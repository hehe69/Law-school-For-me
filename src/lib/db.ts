// SQLite holds everything structured: courses, outlines, nodes, links, sources, images, syllabi, snapshots,
// drill results, captures, flashcards and settings. Files (images, PDFs) live next to it under uploads/.
// The database is created on first use; the schema is versioned with PRAGMA user_version.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DATA_DIR, DB_PATH, UPLOADS_DIR } from "./paths.ts";

export type Db = Database.Database;

/** Ordered migrations; each runs once, inside a transaction, and bumps user_version. */
const MIGRATIONS: string[] = [
  // 1: initial schema
  `
CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  exam_date TEXT,
  exam_format TEXT NOT NULL DEFAULT '',
  page_limit INTEGER,
  study_course_slug TEXT,
  syllabus_topics TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE outlines (
  id TEXT PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('full', 'attack', 'scratch')),
  numbering TEXT NOT NULL DEFAULT 'legal' CHECK (numbering IN ('legal', 'decimal', 'bullets')),
  is_default INTEGER NOT NULL DEFAULT 0,
  source_outline_id TEXT,
  options TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_outlines_course ON outlines(course_id);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  outline_id TEXT NOT NULL REFERENCES outlines(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'heading',
  status TEXT NOT NULL DEFAULT 'empty' CHECK (status IN ('empty', 'skeleton', 'drafted', 'final')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  fields TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  collapsed INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  flashcard INTEGER NOT NULL DEFAULT 0,
  linked_note_path TEXT,
  linked_element_index INTEGER,
  linked_note_hash TEXT,
  source_node_id TEXT,
  source_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_nodes_outline ON nodes(outline_id, parent_id, position);
CREATE INDEX idx_nodes_parent ON nodes(parent_id);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  from_node TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_links_from ON links(from_node);
CREATE INDEX idx_links_to ON links(to_node);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  url TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sources_node ON sources(node_id);

CREATE TABLE images (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  width_hint INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_images_node ON images(node_id);

CREATE TABLE syllabi (
  course_id INTEGER PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  outline_id TEXT NOT NULL REFERENCES outlines(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  automatic INTEGER NOT NULL DEFAULT 0,
  tree_json TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_snapshots_outline ON snapshots(outline_id, created_at);

CREATE TABLE drill_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('recite', 'hypo')),
  correct INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_drill_results_node ON drill_results(node_id, created_at);

CREATE TABLE captures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  filed INTEGER NOT NULL DEFAULT 0,
  filed_node_id TEXT
);
CREATE INDEX idx_captures_course ON captures(course_id, filed, created_at);

-- Spaced-repetition state for nodes with flashcards on (same SM-2 as the study app).
CREATE TABLE card_states (
  node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_on TEXT NOT NULL,
  last_reviewed_at TEXT,
  last_rating INTEGER
);
CREATE INDEX idx_card_states_due ON card_states(due_on);

CREATE TABLE card_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  reviewed_at TEXT NOT NULL,
  rating INTEGER NOT NULL,
  interval_days INTEGER NOT NULL,
  ease REAL NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`,
];

export function migrate(db: Db) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

/** Open (and migrate) a database file. ":memory:" works for tests. */
export function openDatabase(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  if (file !== ":memory:") db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

// Keep one connection per process. In dev, Next reloads modules, so stash it on globalThis.
const g = globalThis as unknown as { __outlinesDb?: Db };

export function getDb(): Db {
  if (g.__outlinesDb) return g.__outlinesDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const db = openDatabase(DB_PATH);
  g.__outlinesDb = db;
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getSetting(db: Db, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(db: Db, key: string, value: string | null) {
  if (value === null) db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  else db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

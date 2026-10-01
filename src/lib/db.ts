// SQLite holds test attempts and flashcard review state only. Content never goes here.
// The file lives at data/study.db (gitignored) and is created on first use.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "study.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_slug TEXT NOT NULL,
  unit_slug TEXT NOT NULL,
  scope TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  time_limit_seconds INTEGER NOT NULL,
  time_used_seconds INTEGER NOT NULL,
  auto_submitted INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  score_percent REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS attempt_questions (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  course_slug TEXT NOT NULL,
  unit_slug TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected INTEGER,
  correct_answer INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  flagged INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (attempt_id, position)
);

-- Spaced-repetition state, one row per flashcard. card_key is the note's path under content/.
CREATE TABLE IF NOT EXISTS card_states (
  card_key TEXT PRIMARY KEY,
  course_slug TEXT NOT NULL,
  unit_slug TEXT NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_on TEXT NOT NULL,
  last_reviewed_at TEXT,
  last_rating INTEGER
);

-- Every rating ever given, for history and "last reviewed" queries.
CREATE TABLE IF NOT EXISTS card_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_key TEXT NOT NULL,
  course_slug TEXT NOT NULL,
  unit_slug TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  rating INTEGER NOT NULL,
  interval_days INTEGER NOT NULL,
  ease REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_unit ON attempts(course_slug, unit_slug, finished_at);
CREATE INDEX IF NOT EXISTS idx_attempt_questions_question ON attempt_questions(course_slug, unit_slug, question_id);
CREATE INDEX IF NOT EXISTS idx_card_states_due ON card_states(due_on);
CREATE INDEX IF NOT EXISTS idx_card_reviews_unit ON card_reviews(course_slug, unit_slug, reviewed_at);
`;

// Keep one connection per process. In dev, Next reloads modules, so stash it on globalThis.
const g = globalThis as unknown as { __studyDb?: Database.Database };

export function getDb(): Database.Database {
  if (g.__studyDb) return g.__studyDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  g.__studyDb = db;
  return db;
}

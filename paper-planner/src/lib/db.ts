import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, DB_PATH, MIGRATIONS_DIR, ensureDir } from "./paths";

// One connection per process, kept across hot reloads in dev. The Electron shell (electron/main.ts)
// closes it through the same globalThis key when the app quits, since Next runs in its process.
const globalForDb = globalThis as unknown as { __plannerDb?: Database.Database; __plannerDbExitHook?: boolean };

export function getDb(): Database.Database {
  if (globalForDb.__plannerDb?.open) return globalForDb.__plannerDb;
  ensureDir(DATA_DIR);
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  globalForDb.__plannerDb = db;
  if (!globalForDb.__plannerDbExitHook) {
    globalForDb.__plannerDbExitHook = true;
    process.once("exit", closeDb);
  }
  return db;
}

// Checkpoints the WAL and releases the file. Safe to call more than once.
export function closeDb() {
  const db = globalForDb.__plannerDb;
  if (db?.open) db.close();
}

// Numbered SQL files in db/migrations/, applied in order and recorded in schema_version.
function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_version").all() as { version: number }[]).map((r) => r.version),
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const version = parseInt(file.split("_")[0], 10);
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(version, file);
    })();
  }
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
export function setMeta(key: string, value: string) {
  getDb().prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

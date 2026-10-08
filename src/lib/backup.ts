// Backups: a zip of a consistent copy of the database plus the uploads folder, written to
// ~/Documents/law-outlines-backups/<date-time>.zip. "Back up now" on the Settings page, and automatically on
// start when the newest backup is over a day old.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import { getDb, type Db } from "./db.ts";
import { BACKUP_DIR, UPLOADS_DIR } from "./paths.ts";

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type BackupInfo = { file: string; path: string; mtime: Date; bytes: number };

export type BackupOptions = {
  db?: Db;
  /** Where the zips go (default: the backups folder) */
  dir?: string;
  /** The uploads folder to include (default: the app's) */
  uploadsDir?: string;
  now?: Date;
};

export function listBackups(dir = BACKUP_DIR): BackupInfo[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".zip"))
    .map((f) => {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      return { file: f, path: full, mtime: st.mtime, bytes: st.size };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export function lastBackup(dir = BACKUP_DIR): BackupInfo | null {
  return listBackups(dir)[0] ?? null;
}

export function backupStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function walk(dir: string, prefix: string, out: Record<string, [Uint8Array, { mtime: Date }]>) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) walk(full, rel, out);
    else if (entry.isFile()) out[rel] = [new Uint8Array(fs.readFileSync(full)), { mtime: fs.statSync(full).mtime }];
  }
}

/** Write a new backup zip and return its full path. */
export async function runBackup(opts: BackupOptions = {}): Promise<string> {
  const dir = opts.dir ?? BACKUP_DIR;
  const uploads = opts.uploadsDir ?? UPLOADS_DIR;
  const now = opts.now ?? new Date();
  const db = opts.db ?? getDb();
  fs.mkdirSync(dir, { recursive: true });
  const files: Record<string, [Uint8Array, { mtime: Date }]> = {};
  if (fs.existsSync(uploads)) walk(uploads, "uploads", files);
  // The database is in WAL mode, so copy it through SQLite's backup API for a consistent snapshot.
  const tmpDb = path.join(os.tmpdir(), `law-outlines-${process.pid}-${Date.now()}.db`);
  try {
    await db.backup(tmpDb);
    files["outlines.db"] = [new Uint8Array(fs.readFileSync(tmpDb)), { mtime: now }];
  } finally {
    fs.rmSync(tmpDb, { force: true });
  }
  const zip = zipSync(files, { level: 6 });
  let target = path.join(dir, `${backupStamp(now)}.zip`);
  for (let n = 2; fs.existsSync(target); n++) target = path.join(dir, `${backupStamp(now)}-${n}.zip`);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, zip);
  fs.renameSync(tmp, target);
  return target;
}

/** Back up if the newest backup is older than a day (or there is none). Returns the new path, or null if fresh. */
export async function backupIfStale(opts: BackupOptions = {}): Promise<string | null> {
  const now = opts.now ?? new Date();
  const last = lastBackup(opts.dir ?? BACKUP_DIR);
  if (last && now.getTime() - last.mtime.getTime() < STALE_AFTER_MS) return null;
  return runBackup({ ...opts, now });
}

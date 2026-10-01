// Backups: zip content/ plus a consistent snapshot of the SQLite database into
// ~/Documents/law-school-backups/<date-time>.zip.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import { CONTENT_ROOT } from "./content/loader";
import { getDb } from "./db";

export const BACKUP_DIR = path.join(os.homedir(), "Documents", "law-school-backups");
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type BackupInfo = { file: string; path: string; mtime: Date; bytes: number };

export function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".zip"))
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      const st = fs.statSync(full);
      return { file: f, path: full, mtime: st.mtime, bytes: st.size };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export function lastBackup(): BackupInfo | null {
  return listBackups()[0] ?? null;
}

function stamp(d: Date): string {
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
export async function runBackup(now = new Date()): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const files: Record<string, [Uint8Array, { mtime: Date }]> = {};
  if (fs.existsSync(CONTENT_ROOT)) walk(CONTENT_ROOT, "content", files);

  // The database is in WAL mode, so copy it through SQLite's backup API for a consistent snapshot.
  const snapshot = path.join(os.tmpdir(), `law-study-${process.pid}-${Date.now()}.db`);
  try {
    await getDb().backup(snapshot);
    files["data/study.db"] = [new Uint8Array(fs.readFileSync(snapshot)), { mtime: now }];
  } finally {
    fs.rmSync(snapshot, { force: true });
  }

  const zip = zipSync(files, { level: 6 });
  const target = path.join(BACKUP_DIR, `${stamp(now)}.zip`);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, zip);
  fs.renameSync(tmp, target);
  return target;
}

/** Back up if the newest backup is older than a day (or there is none). Returns the new path, or null if fresh. */
export async function backupIfStale(now = new Date()): Promise<string | null> {
  const last = lastBackup();
  if (last && now.getTime() - last.mtime.getTime() < STALE_AFTER_MS) return null;
  return runBackup(now);
}

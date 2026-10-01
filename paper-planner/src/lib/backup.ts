import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import AdmZip from "adm-zip";
import { getDb } from "./db";
import { BACKUPS_DIR, PAPERS_DIR, ensureDir } from "./paths";
import { stampForFile } from "./format";

// Zip of data/planner.db (a consistent copy made with the SQLite backup API) and the papers folder.
export async function runBackup(): Promise<string> {
  ensureDir(BACKUPS_DIR);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "planner-backup-"));
  const dbCopy = path.join(tmp, "planner.db");
  await getDb().backup(dbCopy);
  const zip = new AdmZip();
  zip.addLocalFile(dbCopy, "data");
  if (fs.existsSync(PAPERS_DIR)) zip.addLocalFolder(PAPERS_DIR, "papers");
  const target = path.join(BACKUPS_DIR, `${stampForFile()}.zip`);
  zip.writeZip(target);
  fs.rmSync(tmp, { recursive: true, force: true });
  return target;
}

export function lastBackupTime(): Date | null {
  if (!fs.existsSync(BACKUPS_DIR)) return null;
  const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".zip"));
  let latest: Date | null = null;
  for (const f of files) {
    const m = fs.statSync(path.join(BACKUPS_DIR, f)).mtime;
    if (!latest || m > latest) latest = m;
  }
  return latest;
}

// Called on server start: back up if the newest backup is more than a day old (or none exists).
export async function backupIfStale(): Promise<string | null> {
  const last = lastBackupTime();
  if (last && Date.now() - last.getTime() < 24 * 60 * 60 * 1000) return null;
  return runBackup();
}

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// All app data lives next to the project: data/planner.db and papers/<slug>/.
export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const DB_PATH = path.join(DATA_DIR, "planner.db");
export const PAPERS_DIR = path.join(ROOT, "papers");
export const MIGRATIONS_DIR = path.join(ROOT, "db", "migrations");

// Paths under ~ are resolved with os.homedir().
export const EXPORTS_DIR = path.join(os.homedir(), "Documents", "paper-exports");
export const BACKUPS_DIR = path.join(os.homedir(), "Documents", "paper-planner-backups");

export function paperDir(slug: string) {
  return path.join(PAPERS_DIR, slug);
}
export function sourcesDir(slug: string) {
  return path.join(PAPERS_DIR, slug, "sources");
}
export function draftsDir(slug: string) {
  return path.join(PAPERS_DIR, slug, "drafts");
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Resolve a path stored in the database (relative to the project root) to an absolute path,
// refusing anything that escapes the papers folder.
export function resolveStored(rel: string) {
  const abs = path.resolve(/*turbopackIgnore: true*/ ROOT, rel);
  if (!abs.startsWith(PAPERS_DIR + path.sep)) throw new Error("Path outside papers folder");
  return abs;
}

export function toStored(abs: string) {
  return path.relative(ROOT, abs);
}

// Keep a user-supplied file name safe for the disk and the URL.
export function safeFileName(name: string, fallbackExt: string) {
  const base = path.basename(name).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const withExt = base.includes(".") ? base : `${base}${fallbackExt}`;
  return withExt || `file${fallbackExt}`;
}

export function uniquePath(dir: string, fileName: string) {
  const ext = path.extname(fileName);
  const stem = fileName.slice(0, fileName.length - ext.length);
  let candidate = path.join(dir, fileName);
  let n = 2;
  while (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
    candidate = path.join(dir, `${stem}-${n}${ext}`);
    n += 1;
  }
  return candidate;
}

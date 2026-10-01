import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Every filesystem location the app uses is decided here.
//
// PAPER_PLANNER_APP_DIR  where the app's own files live (db/migrations, .next). Defaults to the
//                        working directory, which is the project folder for `next dev` / `next start`.
//                        The Electron shell sets it to the packaged app folder.
// PAPER_PLANNER_HOME     where user data lives: <home>/planner.db and <home>/papers/. When unset the
//                        data stays in the project's data/planner.db and papers/ (unchanged dev layout).
//                        The Electron shell sets it to ~/Library/Application Support/Paper Planner.
export const APP_DIR = process.env.PAPER_PLANNER_APP_DIR ? path.resolve(process.env.PAPER_PLANNER_APP_DIR) : process.cwd();
const HOME = process.env.PAPER_PLANNER_HOME ? path.resolve(process.env.PAPER_PLANNER_HOME) : null;

// Stored file paths (sources.pdf_path, drafts.file_path) are relative to DATA_ROOT, e.g.
// "papers/<slug>/sources/x.pdf", so a data folder can be moved or imported as a unit.
export const DATA_ROOT = HOME ?? APP_DIR;
export const DB_PATH = HOME ? path.join(HOME, "planner.db") : path.join(APP_DIR, "data", "planner.db");
export const DATA_DIR = path.dirname(DB_PATH);
export const PAPERS_DIR = path.join(DATA_ROOT, "papers");
export const MIGRATIONS_DIR = path.join(APP_DIR, "db", "migrations");

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

// Resolve a path stored in the database (relative to DATA_ROOT) to an absolute path,
// refusing anything that escapes the papers folder.
export function resolveStored(rel: string) {
  const abs = path.resolve(/*turbopackIgnore: true*/ DATA_ROOT, rel);
  if (!abs.startsWith(PAPERS_DIR + path.sep)) throw new Error("Path outside papers folder");
  return abs;
}

export function toStored(abs: string) {
  return path.relative(DATA_ROOT, abs);
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

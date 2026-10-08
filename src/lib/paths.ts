// Where the app keeps its files. Everything lives under one data folder:
//   <data>/outlines.db      the SQLite database
//   <data>/uploads/         images and syllabus PDFs, under uploads/<course-slug>/
//   <data>/settings.json    plain-JSON settings the launcher reads before Next starts (network access)
// The folder is LAW_OUTLINES_DATA_DIR when set (the Mac app sets it), otherwise ~/Documents/law-outlines.

import os from "node:os";
import path from "node:path";

export const DATA_DIR = process.env.LAW_OUTLINES_DATA_DIR
  ? path.resolve(process.env.LAW_OUTLINES_DATA_DIR)
  : path.join(os.homedir(), "Documents", "law-outlines");

export const DB_PATH = path.join(DATA_DIR, "outlines.db");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

export const EXPORT_DIR = path.join(os.homedir(), "Documents", "law-outlines-export");
export const BACKUP_DIR = path.join(os.homedir(), "Documents", "law-outlines-backups");

/** Default location of the study app's content folder (overridable in Settings). */
export const DEFAULT_STUDY_CONTENT_DIR = path.join(os.homedir(), "Documents", "law-school-for-me", "content");

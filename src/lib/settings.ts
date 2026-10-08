// Two kinds of settings:
//   - the launcher settings in <data>/settings.json (network access), read by scripts/dev.mjs and the Mac app
//     before Next starts, so plain JSON with no dependencies;
//   - app settings in the settings table (the study app's content folder).

import fs from "node:fs";
import path from "node:path";
import { getSetting, setSetting, type Db } from "./db.ts";
import { DEFAULT_STUDY_CONTENT_DIR, SETTINGS_PATH } from "./paths.ts";

export type LauncherSettings = {
  /** true: listen on all interfaces so other devices on the wifi can open the app. false: this computer only. */
  networkAccess: boolean;
};

export function readLauncherSettings(): LauncherSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as Partial<LauncherSettings>;
    return { networkAccess: raw.networkAccess === true };
  } catch {
    return { networkAccess: false };
  }
}

export function writeLauncherSettings(patch: Partial<LauncherSettings>): LauncherSettings {
  const next = { ...readLauncherSettings(), ...patch };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

const STUDY_DIR_KEY = "studyContentDir";

/** The study app's content folder: the setting, else ~/Documents/law-school-for-me/content. */
export function getStudyContentDir(db: Db): { dir: string; isDefault: boolean } {
  const value = getSetting(db, STUDY_DIR_KEY);
  return value ? { dir: value, isDefault: false } : { dir: DEFAULT_STUDY_CONTENT_DIR, isDefault: true };
}

export function setStudyContentDir(db: Db, dir: string | null) {
  const trimmed = dir?.trim() ?? "";
  setSetting(db, STUDY_DIR_KEY, trimmed ? expandHome(trimmed) : null);
}

/** "~/Documents/x" -> "/Users/me/Documents/x". */
export function expandHome(p: string): string {
  if (p === "~") return process.env.HOME ?? p;
  if (p.startsWith("~/")) return path.join(process.env.HOME ?? "", p.slice(2));
  return p;
}

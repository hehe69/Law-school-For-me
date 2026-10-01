// App settings stored in data/settings.json. The launcher script reads the same file before Next starts,
// so keep it plain JSON with no dependencies.

import fs from "node:fs";
import path from "node:path";

export const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export type Settings = {
  /** true: listen on all interfaces so other devices on the wifi can open the app. false: this computer only. */
  networkAccess: boolean;
};

const DEFAULTS: Settings = { networkAccess: false };

export function readSettings(): Settings {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as Partial<Settings>;
    return { ...DEFAULTS, networkAccess: raw.networkAccess === true };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

// Where the Mac app keeps its data. Settings live in ~/Library/Application Support/Law Outlines/settings.json
// and can override the data folder (database + uploads). Plain CommonJS with no dependencies so it is easy to test.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_DATA_DIR = path.join(os.homedir(), "Documents", "law-outlines");

function readSettings(settingsFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    return {
      dataDir: typeof raw.dataDir === "string" && raw.dataDir ? raw.dataDir : null,
      confirmed: raw.confirmed === true,
    };
  } catch {
    return { dataDir: null, confirmed: false };
  }
}

function writeSettings(settingsFile, settings) {
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

/** Resolve the data folder to use: the settings file overrides the default ~/Documents/law-outlines. */
function resolvePaths(settingsFile) {
  const settings = readSettings(settingsFile);
  return { dataDir: settings.dataDir || DEFAULT_DATA_DIR, confirmed: settings.confirmed };
}

module.exports = { DEFAULT_DATA_DIR, readSettings, writeSettings, resolvePaths };

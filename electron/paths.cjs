// Where the Mac app keeps its data. Settings live in ~/Library/Application Support/Law Study/settings.json
// and can override the content and data folders. Plain CommonJS with no dependencies so it is easy to test.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_BASE = path.join(os.homedir(), "Documents", "law-school-for-me");

/** Defaults: ~/Documents/law-school-for-me/{content,data}. If the app was packaged from a repo that already has
 *  content and a database, use those so the app and the dev version share them. */
function defaultPaths(buildOrigin) {
  const repo = buildOrigin && typeof buildOrigin.repoDir === "string" ? buildOrigin.repoDir : null;
  if (repo && fs.existsSync(path.join(repo, "content")) && fs.existsSync(path.join(repo, "data", "study.db"))) {
    return { contentDir: path.join(repo, "content"), dataDir: path.join(repo, "data"), fromRepo: true };
  }
  return { contentDir: path.join(DEFAULT_BASE, "content"), dataDir: path.join(DEFAULT_BASE, "data"), fromRepo: false };
}

function readSettings(settingsFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    return {
      contentDir: typeof raw.contentDir === "string" && raw.contentDir ? raw.contentDir : null,
      dataDir: typeof raw.dataDir === "string" && raw.dataDir ? raw.dataDir : null,
      confirmed: raw.confirmed === true,
    };
  } catch {
    return { contentDir: null, dataDir: null, confirmed: false };
  }
}

function writeSettings(settingsFile, settings) {
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

/** Resolve the folders to use: settings override defaults. */
function resolvePaths(settingsFile, buildOrigin) {
  const settings = readSettings(settingsFile);
  const defaults = defaultPaths(buildOrigin);
  return {
    contentDir: settings.contentDir || defaults.contentDir,
    dataDir: settings.dataDir || defaults.dataDir,
    confirmed: settings.confirmed,
    fromRepo: !settings.contentDir && defaults.fromRepo,
  };
}

module.exports = { DEFAULT_BASE, defaultPaths, readSettings, writeSettings, resolvePaths };

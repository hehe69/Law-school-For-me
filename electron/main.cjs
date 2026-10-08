// Electron entry point: resolve the data folder, start the Next.js server, open one window, build the menu.

const { app, BrowserWindow, dialog, Menu, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { resolvePaths, writeSettings, readSettings } = require("./paths.cjs");
const { startServer } = require("./server.cjs");

// ~/Library/Application Support/Law Outlines/settings.json on macOS (~/.config/Law Outlines on Linux), whatever
// the package name says, so the path in the README is always right.
app.setName("Law Outlines");
const SETTINGS_FILE = path.join(app.getPath("appData"), "Law Outlines", "settings.json");
const STANDALONE_DIR = path.join(__dirname, "..", ".next", "standalone");

let server = null;
let mainWindow = null;

function fail(title, message) {
  // Also on stderr, so the reason shows in Console.app or a terminal launch, not only in the dialog.
  console.error(`[law-outlines] ${title}: ${message}`);
  dialog.showErrorBox(title, message);
  app.exit(1);
}

/** First launch: confirm the data folder once, offer to choose a different one, create it if missing. */
async function confirmFolders(paths) {
  if (paths.confirmed) return paths;
  const detail =
    `Database and uploads:\n${paths.dataDir}\n\n` +
    `Backups go to ~/Documents/law-outlines-backups and exports to ~/Documents/law-outlines-export.\n\n` +
    `You can change the data folder later in:\n${SETTINGS_FILE}`;
  const { response } = await dialog.showMessageBox({
    type: "question",
    title: "Where should Law Outlines keep your outlines?",
    message: "Law Outlines will use this folder.",
    detail,
    buttons: ["Use this folder", "Choose a folder…", "Quit"],
    defaultId: 0,
    cancelId: 2,
  });
  if (response === 2) {
    app.exit(0);
    return null;
  }
  let { dataDir } = paths;
  if (response === 1) {
    const picked = await dialog.showOpenDialog({ title: "Choose the data folder", properties: ["openDirectory", "createDirectory"] });
    if (picked.canceled || picked.filePaths.length === 0) {
      app.exit(0);
      return null;
    }
    dataDir = picked.filePaths[0];
  }
  writeSettings(SETTINGS_FILE, { dataDir, confirmed: true });
  return { dataDir, confirmed: true };
}

function ensureFolders(paths) {
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(path.join(paths.dataDir, "uploads"), { recursive: true });
  // A clear message when the folder cannot be written (for example a read-only disk).
  try {
    fs.accessSync(paths.dataDir, fs.constants.W_OK);
  } catch {
    throw new Error(`Law Outlines cannot write to its data folder:\n${paths.dataDir}\n\nCheck the permissions, or change the folder in:\n${SETTINGS_FILE}`);
  }
}

function readNetworkAccess(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, "settings.json"), "utf8")).networkAccess === true;
  } catch {
    return false;
  }
}

function buildMenu(paths) {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Open data folder",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => shell.showItemInFolder(path.join(paths.dataDir, "outlines.db")),
        },
        {
          label: "Open settings file",
          click: () => shell.showItemInFolder(SETTINGS_FILE),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        { label: "Open data folder in Finder", click: () => shell.showItemInFolder(path.join(paths.dataDir, "outlines.db")) },
        { type: "separator" },
        { role: "close" },
      ],
    },
    // The editor handles its own undo/redo (Cmd-Z / Cmd-Shift-Z) in the page; the roles below cover text fields.
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function main() {
  let paths = resolvePaths(SETTINGS_FILE);
  paths = await confirmFolders(paths);
  if (!paths) return;
  try {
    ensureFolders(paths);
  } catch (e) {
    return fail("Law Outlines cannot start", e.message);
  }
  if (!fs.existsSync(path.join(STANDALONE_DIR, "server.js"))) {
    return fail("Law Outlines cannot start", `The built server is missing from the app bundle:\n${STANDALONE_DIR}\n\nRun npm run package again.`);
  }
  buildMenu(paths);

  try {
    server = await startServer({
      standaloneDir: STANDALONE_DIR,
      execPath: process.execPath,
      dataDir: paths.dataDir,
      networkAccess: readNetworkAccess(paths.dataDir),
      log: (t) => process.stdout.write(t),
    });
  } catch (e) {
    const msg = String(e.message || e);
    const hint = /EADDRINUSE/.test(msg)
      ? "The port is already in use. Quit the other copy of Law Outlines (or the browser version) and try again.\n\n"
      : /SQLITE_BUSY|database is locked/.test(msg)
        ? "The database is locked by another program. Close anything else using outlines.db and try again.\n\n"
        : "";
    return fail("Law Outlines cannot start", hint + msg);
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    title: "Law Outlines",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  console.log(`[law-outlines] server ready at ${server.url}; opening window`);
  mainWindow.loadURL(server.url);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Print views and raw files open in a second window inside the app; anything else goes to the browser.
    if (url.startsWith(server.url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    app.quit();
  });
}

// Keep the settings reader exported for tests of the first-run flow.
module.exports = { readSettings };

app.whenReady().then(main);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (server) server.stop();
});

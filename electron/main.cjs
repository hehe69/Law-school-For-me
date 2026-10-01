// Electron entry point: resolve data folders, start the Next.js server, open one window, build the menu.

const { app, BrowserWindow, dialog, Menu, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { resolvePaths, writeSettings, readSettings } = require("./paths.cjs");
const { startServer } = require("./server.cjs");

// ~/Library/Application Support/Law Study/settings.json on macOS (~/.config/Law Study on Linux), whatever the
// package name says, so the path in the README is always right.
app.setName("Law Study");
const SETTINGS_FILE = path.join(app.getPath("appData"), "Law Study", "settings.json");
const STANDALONE_DIR = path.join(__dirname, "..", ".next", "standalone");
const BUILD_ORIGIN_FILE = path.join(__dirname, "..", "build-origin.json");

let server = null;
let mainWindow = null;

function fail(title, message) {
  // Also on stderr, so the reason shows in Console.app or a terminal launch, not only in the dialog.
  console.error(`[law-study] ${title}: ${message}`);
  dialog.showErrorBox(title, message);
  app.exit(1);
}

function readBuildOrigin() {
  try {
    return JSON.parse(fs.readFileSync(BUILD_ORIGIN_FILE, "utf8"));
  } catch {
    return null;
  }
}

/** First launch: confirm the folders once, offer to choose a different content folder, create what is missing. */
async function confirmFolders(paths) {
  if (paths.confirmed) return paths;
  const detail =
    `Content (notes, questions, maps):\n${paths.contentDir}\n\n` +
    `Database (attempts, flashcards, inbox):\n${paths.dataDir}\n\n` +
    (paths.fromRepo ? "These are the folders your development copy already uses, so both versions share one set of notes.\n\n" : "") +
    `You can change these later in:\n${SETTINGS_FILE}`;
  const { response } = await dialog.showMessageBox({
    type: "question",
    title: "Where should Law Study keep your notes?",
    message: "Law Study will use these folders.",
    detail,
    buttons: ["Use these folders", "Choose a content folder…", "Quit"],
    defaultId: 0,
    cancelId: 2,
  });
  if (response === 2) {
    app.exit(0);
    return null;
  }
  let { contentDir, dataDir } = paths;
  if (response === 1) {
    const picked = await dialog.showOpenDialog({ title: "Choose the content folder", properties: ["openDirectory", "createDirectory"] });
    if (picked.canceled || picked.filePaths.length === 0) {
      app.exit(0);
      return null;
    }
    contentDir = picked.filePaths[0];
    dataDir = path.join(path.dirname(contentDir), "data");
  }
  writeSettings(SETTINGS_FILE, { contentDir, dataDir, confirmed: true });
  return { contentDir, dataDir, confirmed: true, fromRepo: false };
}

function ensureFolders(paths, firstRun) {
  if (!fs.existsSync(paths.contentDir)) {
    if (!firstRun) {
      throw new Error(`The content folder does not exist:\n${paths.contentDir}\n\nCreate it, or point the app somewhere else by editing contentDir in:\n${SETTINGS_FILE}`);
    }
    fs.mkdirSync(paths.contentDir, { recursive: true });
  }
  fs.mkdirSync(paths.dataDir, { recursive: true });
  // A clear message when the folder cannot be written (for example a read-only disk).
  try {
    fs.accessSync(paths.contentDir, fs.constants.W_OK);
    fs.accessSync(paths.dataDir, fs.constants.W_OK);
  } catch {
    throw new Error(`Law Study cannot write to its folders:\n${paths.contentDir}\n${paths.dataDir}\n\nCheck the permissions, or change the folders in:\n${SETTINGS_FILE}`);
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
          label: "Open content folder",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => shell.showItemInFolder(paths.contentDir),
        },
        {
          label: "Open data folder",
          click: () => shell.showItemInFolder(path.join(paths.dataDir, "study.db")),
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
        { label: "Open content folder in Finder", click: () => shell.showItemInFolder(paths.contentDir) },
        { type: "separator" },
        { role: "close" },
      ],
    },
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
  const firstRun = !readSettings(SETTINGS_FILE).confirmed;
  let paths = resolvePaths(SETTINGS_FILE, readBuildOrigin());
  paths = await confirmFolders(paths);
  if (!paths) return;
  try {
    ensureFolders(paths, firstRun);
  } catch (e) {
    return fail("Law Study cannot start", e.message);
  }
  if (!fs.existsSync(path.join(STANDALONE_DIR, "server.js"))) {
    return fail("Law Study cannot start", `The built server is missing from the app bundle:\n${STANDALONE_DIR}\n\nRun npm run package again.`);
  }
  buildMenu(paths);

  try {
    server = await startServer({
      standaloneDir: STANDALONE_DIR,
      execPath: process.execPath,
      contentDir: paths.contentDir,
      dataDir: paths.dataDir,
      networkAccess: readNetworkAccess(paths.dataDir),
      log: (t) => process.stdout.write(t),
    });
  } catch (e) {
    const msg = String(e.message || e);
    const hint = /EADDRINUSE/.test(msg)
      ? "The port is already in use. Quit the other copy of Law Study (or the browser version) and try again.\n\n"
      : /SQLITE_BUSY|database is locked/.test(msg)
        ? "The database is locked by another program. Close anything else using study.db and try again.\n\n"
        : "";
    return fail("Law Study cannot start", hint + msg);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "Law Study",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  console.log(`[law-study] server ready at ${server.url}; opening window`);
  mainWindow.loadURL(server.url);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Print views and raw files open in a second window inside the app; anything else goes to the browser.
    if (url.startsWith(server.url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => { mainWindow = null; app.quit(); });
}

app.whenReady().then(main);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { if (server) server.stop(); });

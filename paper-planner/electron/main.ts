import { app, BrowserWindow, dialog, ipcMain, screen, shell } from "electron";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildMenu } from "./menu";

// ---- paths -------------------------------------------------------------------

// `npm run electron:dev` sets this; Electron then loads the separately running `next dev`
// instead of starting Next itself.
const DEV_URL = process.env.PAPER_PLANNER_DEV_URL;
app.setName("Paper Planner"); // before any getPath(): decides the userData folder name when unpackaged
const APP_DIR = app.getAppPath(); // project folder in dev; Contents/Resources/app when packaged
const USER_DATA = app.getPath("userData"); // ~/Library/Application Support/Paper Planner
const EXPORTS_DIR = path.join(os.homedir(), "Documents", "paper-exports");
const BACKUPS_DIR = path.join(os.homedir(), "Documents", "paper-planner-backups");
const WINDOW_STATE_FILE = path.join(USER_DATA, "window-state.json");
const PENDING_IMPORT_FILE = path.join(USER_DATA, "pending-import.json");

// Mirrors src/lib/paths.ts: with PAPER_PLANNER_HOME set, data is <home>/planner.db + <home>/papers;
// otherwise it is the project's data/planner.db + papers/ (the layout `next dev` uses).
function dataLayout() {
  if (DEV_URL) {
    return { root: APP_DIR, dbPath: path.join(APP_DIR, "data", "planner.db"), papersDir: path.join(APP_DIR, "papers") };
  }
  const home = process.env.PAPER_PLANNER_HOME ? path.resolve(process.env.PAPER_PLANNER_HOME) : USER_DATA;
  return { root: home, dbPath: path.join(home, "planner.db"), papersDir: path.join(home, "papers") };
}
const DATA = dataLayout();

// ---- state -------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let serverUrl = DEV_URL ?? "";
let httpServer: http.Server | null = null;
let nextApp: { close(): Promise<void> } | null = null;
let shuttingDown = false;
let importNotice: string | null = null;

// ---- single instance ---------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(boot).catch((err) => {
    dialog.showErrorBox("Paper Planner could not start", String(err?.stack ?? err));
    app.exit(1);
  });
}

async function boot() {
  fs.mkdirSync(USER_DATA, { recursive: true });
  applyPendingImport();
  if (!DEV_URL) serverUrl = await startNext();
  console.log(`[paper-planner] ${DEV_URL ? "dev server" : "in-process Next"} at ${serverUrl}; data in ${DATA.root}`);
  ipcMain.handle("paper-planner:reveal", (_event, filePath: unknown) => revealFile(filePath));
  buildMenu({
    revealDataFolder: () => {
      fs.mkdirSync(DATA.root, { recursive: true });
      if (fs.existsSync(DATA.dbPath)) shell.showItemInFolder(DATA.dbPath);
      else shell.openPath(DATA.root);
    },
    importData: () => void importData(),
    backupNow: () => void backupNow(),
    goBack: () => mainWindow?.webContents.navigationHistory.goBack(),
    goForward: () => mainWindow?.webContents.navigationHistory.goForward(),
  });
  createWindow();
  if (importNotice && mainWindow) {
    dialog.showMessageBox(mainWindow, { type: "info", message: "Import complete", detail: importNotice });
  }
}

// ---- Next.js in-process ------------------------------------------------------

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function startNext(): Promise<string> {
  process.env.NODE_ENV = "production";
  process.env.PAPER_PLANNER_APP_DIR = APP_DIR;
  process.env.PAPER_PLANNER_HOME = DATA.root;
  fs.mkdirSync(DATA.root, { recursive: true });
  const port = await freePort();
  const hostname = "127.0.0.1";
  // Loaded lazily so the dev shell never pulls Next (and better-sqlite3) into the Electron process.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const next = require("next") as (opts: Record<string, unknown>) => {
    prepare(): Promise<void>;
    getRequestHandler(): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
    close(): Promise<void>;
  };
  httpServer = http.createServer();
  const server = next({ dev: false, dir: APP_DIR, hostname, port, httpServer });
  await server.prepare();
  const handle = server.getRequestHandler();
  httpServer.on("request", (req, res) => {
    handle(req, res).catch((err: unknown) => {
      console.error("[paper-planner] request failed", err);
      if (!res.headersSent) res.writeHead(500);
      res.end("Internal error");
    });
  });
  await new Promise<void>((resolve, reject) => {
    httpServer!.once("error", reject);
    httpServer!.listen(port, hostname, () => resolve());
  });
  nextApp = server;
  return `http://${hostname}:${port}`;
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[paper-planner] shutting down");
  const deadline = new Promise<void>((resolve) => setTimeout(resolve, 4000).unref());
  try {
    // Drop keep-alive connections from the window first, or close() waits on them forever.
    httpServer?.closeAllConnections();
    await Promise.race([
      new Promise<void>((resolve) => (httpServer ? httpServer.close(() => resolve()) : resolve())),
      deadline,
    ]);
    await Promise.race([nextApp?.close() ?? Promise.resolve(), deadline]);
  } catch (err) {
    console.error("[paper-planner] shutdown error", err);
  }
  // src/lib/db.ts keeps the SQLite connection on globalThis; Next runs in this process, so close it here.
  const db = (globalThis as { __plannerDb?: { open: boolean; close(): void } }).__plannerDb;
  if (db?.open) db.close();
  console.log("[paper-planner] database closed");
}

// ---- window ------------------------------------------------------------------

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized?: boolean;
}

function loadWindowState(): WindowState {
  const fallback: WindowState = { width: 1280, height: 860 };
  try {
    const saved = JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, "utf8")) as WindowState;
    if (!saved.width || !saved.height) return fallback;
    if (saved.x !== undefined && saved.y !== undefined) {
      // Only reuse a position that is still on a connected display.
      const bounds = { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
      const display = screen.getDisplayMatching(bounds).workArea;
      const visible =
        bounds.x < display.x + display.width && bounds.x + bounds.width > display.x && bounds.y < display.y + display.height && bounds.y + bounds.height > display.y;
      if (!visible) {
        delete saved.x;
        delete saved.y;
      }
    }
    return saved;
  } catch {
    return fallback;
  }
}

function saveWindowState(win: BrowserWindow) {
  try {
    const maximized = win.isMaximized();
    const b = maximized ? win.getNormalBounds() : win.getBounds();
    const state: WindowState = { x: b.x, y: b.y, width: b.width, height: b.height, maximized };
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state));
  } catch {
    /* not fatal */
  }
}

function isOwnOrigin(url: string) {
  try {
    return new URL(url).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}

function createWindow() {
  const state = loadWindowState();
  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 720,
    minHeight: 480,
    title: "Paper Planner",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true, // built-in Chromium PDF viewer for the source page iframe
    },
  });
  mainWindow = win;
  if (state.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());

  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 300);
  };
  win.on("resize", scheduleSave);
  win.on("move", scheduleSave);
  win.on("close", () => saveWindowState(win));
  win.on("closed", () => {
    mainWindow = null;
  });

  // Same-origin pages stay in this window; anything else goes to the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOwnOrigin(url)) win.loadURL(url);
    else if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isOwnOrigin(url)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  win.loadURL(serverUrl);
}

// ---- Data menu ---------------------------------------------------------------

function revealFile(filePath: unknown): boolean {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) return false;
  const resolved = path.resolve(filePath);
  const allowed = [EXPORTS_DIR, BACKUPS_DIR, DATA.root].some((dir) => resolved === dir || resolved.startsWith(dir + path.sep));
  if (!allowed || !fs.existsSync(resolved)) return false;
  shell.showItemInFolder(resolved);
  return true;
}

async function backupNow() {
  if (!serverUrl) return;
  try {
    const res = await fetch(`${serverUrl}/api/backup`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { file } = (await res.json()) as { file: string };
    const { response } = await dialog.showMessageBox(mainWindow ?? new BrowserWindow({ show: false }), {
      type: "info",
      message: "Backup written",
      detail: file,
      buttons: ["Reveal in Finder", "OK"],
      defaultId: 1,
    });
    if (response === 0) shell.showItemInFolder(file);
  } catch (err) {
    dialog.showErrorBox("Backup failed", String(err));
  }
}

// Find planner.db in a chosen folder: either <folder>/planner.db (the app's data folder layout)
// or <folder>/data/planner.db (a project checkout or an unzipped backup).
function locateImport(folder: string): { db: string; papers: string | null } | null {
  for (const candidate of [path.join(folder, "planner.db"), path.join(folder, "data", "planner.db")]) {
    if (fs.existsSync(candidate)) {
      const papers = path.join(folder, "papers");
      return { db: candidate, papers: fs.existsSync(papers) ? papers : null };
    }
  }
  return null;
}

async function importData() {
  if (!mainWindow) return;
  if (DEV_URL) {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      message: "Import is only available in the packaged app",
      detail: "In development mode the database is held open by `next dev`, so files cannot be swapped underneath it.",
    });
    return;
  }
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a folder containing planner.db and papers/",
    properties: ["openDirectory"],
  });
  if (picked.canceled || picked.filePaths.length === 0) return;
  const folder = picked.filePaths[0];
  const found = locateImport(folder);
  if (!found) {
    dialog.showErrorBox("Nothing to import", `No planner.db (or data/planner.db) found in:\n${folder}`);
    return;
  }
  if (path.resolve(folder) === path.resolve(DATA.root)) {
    dialog.showErrorBox("That is the current data folder", "Choose a different folder to import from.");
    return;
  }
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    message: "Replace the current data?",
    detail:
      `This copies planner.db${found.papers ? " and papers/" : ""} from:\n${folder}\n\n` +
      `into the data folder:\n${DATA.root}\n\n` +
      "The current planner.db and papers/ are overwritten. A backup of the current data is written to " +
      `${BACKUPS_DIR} first, and the app restarts to finish the import.`,
    buttons: ["Replace and restart", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  });
  if (response !== 0) return;
  try {
    const res = await fetch(`${serverUrl}/api/backup`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    dialog.showErrorBox("Import cancelled", `The safety backup failed, so nothing was changed.\n${String(err)}`);
    return;
  }
  // The copy happens on the next launch, before the database is opened.
  fs.writeFileSync(PENDING_IMPORT_FILE, JSON.stringify({ db: found.db, papers: found.papers, requestedAt: new Date().toISOString() }));
  app.relaunch();
  app.quit();
}

// Runs at startup, before Next opens the database.
function applyPendingImport() {
  if (DEV_URL || !fs.existsSync(PENDING_IMPORT_FILE)) return;
  let job: { db: string; papers: string | null };
  try {
    job = JSON.parse(fs.readFileSync(PENDING_IMPORT_FILE, "utf8"));
  } catch {
    fs.rmSync(PENDING_IMPORT_FILE, { force: true });
    return;
  }
  fs.rmSync(PENDING_IMPORT_FILE, { force: true });
  try {
    if (!fs.existsSync(job.db)) throw new Error(`Source database no longer exists: ${job.db}`);
    fs.mkdirSync(DATA.root, { recursive: true });
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(DATA.dbPath + suffix, { force: true });
    for (const suffix of ["", "-wal", "-shm"]) {
      if (fs.existsSync(job.db + suffix)) fs.copyFileSync(job.db + suffix, DATA.dbPath + suffix);
    }
    if (job.papers) {
      fs.rmSync(DATA.papersDir, { recursive: true, force: true });
      fs.cpSync(job.papers, DATA.papersDir, { recursive: true });
    }
    importNotice = `Imported ${job.db}${job.papers ? ` and ${job.papers}` : ""} into ${DATA.root}.`;
  } catch (err) {
    dialog.showErrorBox("Import failed", String(err));
  }
}

// ---- lifecycle ---------------------------------------------------------------

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverUrl) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  shutdown().finally(() => {
    console.log("[paper-planner] exiting");
    app.exit(0);
  });
});

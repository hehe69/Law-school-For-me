// Builds the Mac app: Next.js standalone build -> copy static assets -> check (or rebuild) better-sqlite3 for
// Electron -> electron-builder (unsigned). Run with `npm run package` on a Mac. Everything lands in dist/.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const run = (cmd, env = {}) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
};

if (process.platform !== "darwin") {
  console.warn("Note: this script is meant to run on a Mac; it will build what it can on this platform.");
}

// 0. Electron's binary is fetched by its install script. npm 12 only runs that script when package.json's
//    allowScripts approves it; if the approval was missing (or the download was skipped), fetch it now.
const electronDir = path.join(root, "node_modules", "electron");
const electronBin = path.join(electronDir, "dist", process.platform === "darwin" ? "Electron.app/Contents/MacOS/Electron" : "electron");
if (!fs.existsSync(electronBin)) {
  console.log("Electron's binary is missing (its install script did not run); downloading it now...");
  run(`node "${path.join(electronDir, "install.js")}"`);
  if (!fs.existsSync(electronBin)) throw new Error(`Electron is still missing at ${electronBin}. Run: npm install-scripts approve electron && npm install`);
}

// 1. Production build with standalone output (the flag keeps `next build` / `next start` unchanged otherwise).
fs.rmSync(path.join(root, ".next"), { recursive: true, force: true });
run("npx next build", { LAW_OUTLINES_STANDALONE: "1" });
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) throw new Error(".next/standalone/server.js was not produced");

// 2. Never ship a database inside the app, whatever the file tracer picked up.
fs.rmSync(path.join(standalone, "data"), { recursive: true, force: true });

// 3. The standalone server needs the static assets and public/ next to it.
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
if (fs.existsSync(path.join(root, "public"))) fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

// 4. Make sure the native SQLite module loads under Electron's Node. better-sqlite3 13 ships Node-API prebuilds,
//    which Electron loads as they are, so normally nothing to do. If that check fails (a future version that is
//    not Node-API, or an unusual platform), rebuild it for Electron inside the standalone tree.
const electronVersion = JSON.parse(fs.readFileSync(path.join(electronDir, "package.json"), "utf8")).version;
const sqliteInStandalone = path.join(standalone, "node_modules", "better-sqlite3");
function loadsUnderElectron() {
  try {
    execSync(`"${electronBin}" -e "require(process.argv[1]); require(process.argv[1] + '/lib/index.js')" "${sqliteInStandalone}"`, {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "pipe",
    });
    return true;
  } catch (e) {
    console.log(String(e.stderr || e.message).trim().split("\n").slice(-3).join("\n"));
    return false;
  }
}
if (loadsUnderElectron()) {
  console.log(`better-sqlite3 loads under Electron ${electronVersion} as shipped; no rebuild needed.`);
} else {
  console.log("better-sqlite3 does not load under Electron; rebuilding it (needs the Xcode command line tools)...");
  // The traced copy lacks the sources, so replace it with the full module, drop the prebuilds so the fresh build
  // is the one that loads, and let electron-rebuild compile it for this Electron.
  fs.rmSync(sqliteInStandalone, { recursive: true, force: true });
  fs.cpSync(path.join(root, "node_modules", "better-sqlite3"), sqliteInStandalone, { recursive: true });
  fs.rmSync(path.join(sqliteInStandalone, "prebuilds"), { recursive: true, force: true });
  run(`npx electron-rebuild --version ${electronVersion} --module-dir "${standalone}" --only better-sqlite3 --force`);
  if (!loadsUnderElectron()) throw new Error("better-sqlite3 still does not load under Electron after rebuilding");
}

// 5. electron-builder config, generated so the icon is optional.
const iconPng = path.join(root, "assets", "icon.png");
const config = {
  appId: "local.lawoutlines.app",
  productName: "Law Outlines",
  directories: { output: "dist" },
  asar: false,
  npmRebuild: false,
  files: ["electron/**", ".next/standalone/**", "package.json"],
  mac: {
    category: "public.app-category.education",
    target: ["dir", "dmg"],
    identity: null,
    ...(fs.existsSync(iconPng) ? { icon: "assets/icon.png" } : {}),
  },
  dmg: { title: "Law Outlines" },
};
if (!fs.existsSync(iconPng)) console.log("No assets/icon.png found; using Electron's default icon (supply a 1024x1024 PNG to change it).");
const configFile = path.join(root, "electron-builder.generated.json");
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");

// 6. Build. On a Mac this produces dist/mac*/Law Outlines.app and dist/Law Outlines-<version>.dmg.
run(`npx electron-builder --config "${configFile}" ${process.platform === "darwin" ? "--mac" : ""}`);
console.log("\nDone. Look in dist/ for Law Outlines.app and the .dmg.");

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

// 1. Production build with standalone output (the flag keeps `next build` / `next start` unchanged otherwise).
fs.rmSync(path.join(root, ".next"), { recursive: true, force: true });
run("npx next build", { LAW_STUDY_STANDALONE: "1" });
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) throw new Error(".next/standalone/server.js was not produced");

// 2. Never ship notes or a database inside the app, whatever the file tracer picked up.
for (const stray of ["content", "data"]) fs.rmSync(path.join(standalone, stray), { recursive: true, force: true });

// 3. The standalone server needs the static assets and public/ next to it.
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
if (fs.existsSync(path.join(root, "public"))) fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

// 4. Make sure the native SQLite module loads under Electron's Node. better-sqlite3 13 ships Node-API prebuilds,
//    which Electron loads as they are, so normally nothing to do. If that check fails (a future version that is
//    not Node-API, or an unusual platform), rebuild it for Electron inside the standalone tree.
const electronVersion = JSON.parse(fs.readFileSync(path.join(root, "node_modules", "electron", "package.json"), "utf8")).version;
const electronBin = path.join(root, "node_modules", "electron", "dist", process.platform === "darwin" ? "Electron.app/Contents/MacOS/Electron" : "electron");
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

// 5. Remember where the app was built so the first launch can offer the repo's own content and database.
fs.writeFileSync(path.join(root, "build-origin.json"), JSON.stringify({ repoDir: root, builtAt: new Date().toISOString() }, null, 2) + "\n");

// 6. electron-builder config, generated so the icon is optional.
const iconPng = path.join(root, "assets", "icon.png");
const config = {
  appId: "local.lawstudy.app",
  productName: "Law Study",
  directories: { output: "dist" },
  asar: false,
  npmRebuild: false,
  files: ["electron/**", ".next/standalone/**", "build-origin.json", "package.json"],
  mac: {
    category: "public.app-category.education",
    target: ["dir", "dmg"],
    identity: null,
    ...(fs.existsSync(iconPng) ? { icon: "assets/icon.png" } : {}),
  },
  dmg: { title: "Law Study" },
};
if (!fs.existsSync(iconPng)) console.log("No assets/icon.png found; using Electron's default icon (supply a 1024x1024 PNG to change it).");
const configFile = path.join(root, "electron-builder.generated.json");
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");

// 7. Build. On a Mac this produces dist/mac*/Law Study.app and dist/Law Study-<version>.dmg.
run(`npx electron-builder --config "${configFile}" ${process.platform === "darwin" ? "--mac" : ""}`);
console.log("\nDone. Look in dist/ for Law Study.app and the .dmg.");

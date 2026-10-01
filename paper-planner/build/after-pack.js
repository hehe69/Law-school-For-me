// electron-builder afterPack hook.
//
// Turbopack writes each `serverExternalPackages` entry as a relative symlink under
// .next/node_modules/<name>-<hash> -> ../../node_modules/<name>, and the production server
// requires those hashed names. electron-builder ignores nested node_modules folders when it
// copies `files`, so the links would be missing and Next would fail to load better-sqlite3 etc.
// This recreates the same relative links inside the packaged app, where the layout is identical.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const appDir =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, "Contents", "Resources", "app")
      : path.join(appOutDir, "resources", "app");
  const source = path.join(packager.projectDir, ".next", "node_modules");
  if (!fs.existsSync(source)) return;
  const target = path.join(appDir, ".next", "node_modules");
  fs.mkdirSync(target, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(source)) {
    const from = path.join(source, entry);
    const to = path.join(target, entry);
    fs.rmSync(to, { recursive: true, force: true });
    const stat = fs.lstatSync(from);
    if (stat.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(from), to);
    } else {
      fs.cpSync(from, to, { recursive: true });
    }
    count += 1;
  }
  console.log(`  • afterPack: restored ${count} Next.js external alias link(s) in ${path.relative(packager.projectDir, target)}`);
};

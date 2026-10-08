// Starts Next.js and prints where to open it. Network access is a setting on the Settings page
// (<data folder>/settings.json, default off): off means only this computer can reach the app.
// Everything else is plain `next dev` / `next start`; extra arguments are passed through.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const mode = args[0] === "start" ? "start" : "dev";
const rest = mode === "start" ? args.slice(1) : args;
const portIndex = rest.findIndex((a) => a === "-p" || a === "--port");
const port = portIndex >= 0 ? rest[portIndex + 1] : process.env.PORT || "3000";

const dataDir = process.env.LAW_OUTLINES_DATA_DIR ? path.resolve(process.env.LAW_OUTLINES_DATA_DIR) : path.join(os.homedir(), "Documents", "law-outlines");
let networkAccess = false;
try {
  networkAccess = JSON.parse(fs.readFileSync(path.join(dataDir, "settings.json"), "utf8")).networkAccess === true;
} catch {
  // no settings file yet: default off
}
const host = networkAccess ? "0.0.0.0" : "127.0.0.1";

console.log("");
console.log(`  Law Outlines (${mode}) · port ${port}`);
console.log(`  Data folder:    ${dataDir}`);
console.log(`  This computer:  http://localhost:${port}`);
if (networkAccess) {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  console.log("  Network access: ON (listening on all interfaces; anyone on your local network can open it)");
  for (const a of addresses) console.log(`  Same wifi:      http://${a}:${port}`);
  if (addresses.length === 0) console.log("  (no local network address found)");
} else {
  console.log("  Network access: OFF (localhost only; turn it on from the Settings page and restart)");
}
console.log("");

const child = spawn("npx", ["next", mode, "-H", host, ...rest], { stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));

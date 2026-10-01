// Starts Next.js on every network interface and prints the addresses to open on a phone or another
// machine on the same wifi. Everything else is plain `next dev`; extra arguments are passed through.
import { spawn } from "node:child_process";
import os from "node:os";

const args = process.argv.slice(2);
const mode = args[0] === "start" ? "start" : "dev";
const rest = mode === "start" ? args.slice(1) : args;
const portIndex = rest.findIndex((a) => a === "-p" || a === "--port");
const port = portIndex >= 0 ? rest[portIndex + 1] : process.env.PORT || "3000";

const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i.address);

console.log("");
console.log(`  Law Study (${mode}) listening on all interfaces, port ${port}`);
console.log(`  This computer:  http://localhost:${port}`);
for (const a of addresses) console.log(`  Same wifi:      http://${a}:${port}`);
if (addresses.length === 0) console.log("  (no local network address found; only this computer can reach the app)");
console.log("  Reachable only on your local network. Nothing is exposed to the internet.");
console.log("");

const child = spawn("npx", ["next", mode, "-H", "0.0.0.0", ...rest], { stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));

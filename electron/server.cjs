// Starts the production Next.js server (the standalone build) as a child process running on Electron's own
// Node, waits until it answers, and stops it on quit. No Electron APIs here, so it can be tested with plain Node.

const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

function findFreePort(host) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, host, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

/**
 * Spawn `server.js` from the standalone build. `execPath` is Electron's binary (run as Node) in the app, or
 * plain `node` in tests. Resolves with { port, host, url, child, stop } once GET / answers, or rejects with the
 * server's output when it dies or stays silent for `timeoutMs`.
 */
async function startServer({ standaloneDir, execPath, contentDir, dataDir, networkAccess, timeoutMs = 30000, log = () => {} }) {
  const host = networkAccess ? "0.0.0.0" : "127.0.0.1";
  const port = await findFreePort(host);
  const serverJs = path.join(standaloneDir, "server.js");
  const output = [];
  const child = spawn(execPath, [serverJs], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: host,
      LAW_STUDY_CONTENT_DIR: contentDir,
      LAW_STUDY_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const remember = (chunk) => {
    const text = chunk.toString();
    output.push(text);
    if (output.length > 200) output.shift();
    log(text);
  };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);

  const url = `http://127.0.0.1:${port}/`;
  const started = Date.now();
  let exited = null;
  child.once("exit", (code, signal) => { exited = { code, signal }; });

  while (Date.now() - started < timeoutMs) {
    if (exited) throw new Error(`The study server stopped (exit ${exited.code ?? exited.signal}).\n\n${output.join("").trim().slice(-2000)}`);
    if (await probe(url)) {
      return { port, host, url, child, stop: () => { if (!exited) child.kill(); } };
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  child.kill();
  throw new Error(`The study server did not answer within ${Math.round(timeoutMs / 1000)} seconds.\n\n${output.join("").trim().slice(-2000)}`);
}

module.exports = { findFreePort, startServer, probe };

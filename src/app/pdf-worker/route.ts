import fs from "node:fs";
import path from "node:path";

/** Serves pdf.js's worker script (legacy build, with polyfills) from node_modules so the PDF pane needs no bundler asset tricks. */
export async function GET() {
  const file = path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs");
  if (!fs.existsSync(file)) return new Response("worker not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "private, max-age=86400" },
  });
}

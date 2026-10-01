// Serves PDFs and images from content/<course>/<unit>/{readings,images}/<file>. Nothing else is reachable.

import fs from "node:fs";
import path from "node:path";
import { servedFilePath } from "@/lib/content/writer";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path.map((p) => decodeURIComponent(p));
  if (parts.length !== 4) return new Response("Not found", { status: 404 });
  const [course, unit, folder, file] = parts;
  const full = servedFilePath(course, unit, folder, file);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!full || !type) return new Response("Not found", { status: 404 });
  const data = fs.readFileSync(full);
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": type, "Content-Length": String(data.length), "Content-Disposition": "inline", "Cache-Control": "no-cache" },
  });
}

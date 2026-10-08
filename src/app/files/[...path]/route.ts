import fs from "node:fs";
import type { NextRequest } from "next/server";
import { imageContentType, resolveUpload } from "@/lib/attachments";

/** Serves files from the uploads folder: /files/<course-slug>/<file>. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/files/[...path]">) {
  const { path: segments } = await ctx.params;
  const full = resolveUpload(segments.map(decodeURIComponent));
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return new Response("Not found", { status: 404 });
  const data = fs.readFileSync(full);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": imageContentType(full),
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=60",
    },
  });
}

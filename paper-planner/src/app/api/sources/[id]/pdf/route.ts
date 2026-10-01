import fs from "node:fs";
import path from "node:path";
import { getSource } from "@/lib/queries/sources";
import { resolveStored } from "@/lib/paths";

export const dynamic = "force-dynamic";

// Serves a source's uploaded PDF inline so it can be viewed in an iframe.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = getSource(parseInt(id, 10));
  if (!source?.pdf_path) return new Response("No PDF", { status: 404 });
  let abs: string;
  try {
    abs = resolveStored(source.pdf_path);
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  if (!fs.existsSync(abs)) return new Response("File missing", { status: 404 });
  const bytes = fs.readFileSync(abs);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${path.basename(abs)}"`,
      "Cache-Control": "no-store",
    },
  });
}
